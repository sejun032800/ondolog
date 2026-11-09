/**
 * 사진 영속 큐 시험(74-4) - 원본: `__tests__/hooks/chatPhotoQueue.test.tsx`(끊김 -> 앱 재시작 -> 객체 1 · 행 1, 스토리, 복사본 사라짐 · 취소) ·
 * `__tests__/hooks/chatQueueResume.test.tsx`(앱 시작 · 복귀 재개, 같은 항목 동시 업로드 0, 커플 아님 · 로그아웃 처리) · `__tests__/utils/chatPhotoQueue.test.ts`(러너 규칙 - 웹이 같은 파일을
 * 가져다 쓰므로 루트 jest가 계속 지킨다).
 * 서버는 진짜처럼 구는 가짜: Storage는 같은 경로에 두 번 올리면 409, 메시지는 (couple_id, client_msg_id)가 겹치면 23505. "앱 재시작"은 같은 기기 저장 · 파일을 새 허브가 이어받는 것으로 흉내 낸다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { Preferences } from '@capacitor/preferences'
import { Directory } from '@capacitor/filesystem'
import { attemptQueuedPhoto, type PhotoFs } from '@/services/chatPhotoCore'
import type { ChatDb } from '@/services/chatCore'
import { chatPhotoQueueKey, type QueuedPhoto } from '@/utils/chatPhotoQueue'
import { useAuthStore } from '../auth/stores'
import { useCoupleStore } from '../stores/coupleStore'
import { contentTypeOf, PhotoQueueHub } from './photoQueueHub'
import { photoQueueStore, type PhotoQueueStore } from './photoQueueStore'
import { createWebPhotoFs, QUEUE_DIR, type FilesystemLike } from './webPhotoFs'
import { usePhotoQueueResume } from './usePhotoQueueResume'

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store.set(key, value) }),
      remove: vi.fn(async ({ key }: { key: string }) => { store.delete(key) }),
      clear: vi.fn(async () => { store.clear() }),
    },
  }
})

type Row = Record<string, unknown>

/** 메모리 서버. */
class FakeBackend {
  messages: Row[] = []
  stories: Row[] = []
  objects: Record<string, Set<string>> = { messages: new Set(), stories: new Set() }
  uploadCalls = 0
  uploadGate: Promise<void> | null = null
  overlap = false
  private uploading = new Set<string>()
  /** 다음 삽입을 적용한 뒤 응답만 끊긴 것처럼 던진다. */
  dropResponseAfterInsert: 'messages' | 'stories' | null = null
  uploadFails = false
  private seq = 0
  markUpload(path: string, on: boolean) {
    if (on) {
      if (this.uploading.has(path)) this.overlap = true
      this.uploading.add(path)
    } else this.uploading.delete(path)
  }
  table(name: string): Row[] { return name === 'messages' ? this.messages : this.stories }
  nextId(): string { this.seq += 1; return `row-${this.seq}` }
}

function queryBuilder(b: FakeBackend, tableName: string) {
  let op: 'select' | 'insert' = 'select'
  let payload: Row = {}
  const filters: Array<(r: Row) => boolean> = []
  let limit: number | undefined
  let single = false
  let maybe = false
  const exec = async (): Promise<{ data: unknown; error: unknown }> => {
    const rows = b.table(tableName)
    if (op === 'insert') {
      if (tableName === 'messages' && rows.some((r) => r.couple_id === payload.couple_id && r.client_msg_id === payload.client_msg_id)) {
        return { data: null, error: { code: '23505', message: 'duplicate key' } }
      }
      const row: Row = tableName === 'messages'
        ? { id: b.nextId(), sent_at: new Date().toISOString(), read_at: null, deleted_at: null, ...payload }
        : { id: b.nextId(), created_at: new Date().toISOString(), resolved_at: null, ...payload }
      rows.push(row)
      if (b.dropResponseAfterInsert === tableName) {
        b.dropResponseAfterInsert = null
        throw new TypeError('Network request failed')
      }
      return { data: single ? row : [row], error: null }
    }
    let found = rows.filter((r) => filters.every((f) => f(r)))
    if (limit !== undefined) found = found.slice(0, limit)
    if (maybe) return { data: found[0] ?? null, error: null }
    return { data: found, error: null }
  }
  const api: Record<string, unknown> = {
    select: () => api,
    insert: (row: Row) => { op = 'insert'; payload = row; return api },
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    limit: (n: number) => ((limit = n), api),
    single: () => ((single = true), api),
    maybeSingle: () => ((maybe = true), api),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => exec().then(resolve, reject),
  }
  return api
}

let backend = new FakeBackend()

function fakeDb(): ChatDb {
  return {
    from: (name: string) => queryBuilder(backend, name),
    storage: {
      from: (bucket: 'messages' | 'stories') => ({
        upload: async (path: string) => {
          backend.uploadCalls += 1
          backend.markUpload(path, true)
          try {
            if (backend.uploadGate) await backend.uploadGate
          } finally {
            backend.markUpload(path, false)
          }
          if (backend.uploadFails) throw new TypeError('Network request failed')
          if (backend.objects[bucket].has(path)) return { error: { statusCode: '409', message: 'The resource already exists' } }
          backend.objects[bucket].add(path)
          return { error: null }
        },
      }),
    },
  } as unknown as ChatDb
}

// ── 기기: 메모리 저장 · 메모리 파일(앱이 꺼져도 남는다) ──────────────────────────
let files = new Map<string, ArrayBuffer>()
let saved = new Map<string, string>()
const memoryFs: PhotoFs = {
  copyIn: async (_source, clientId, ext) => {
    const uri = `${QUEUE_DIR}/${clientId}.${ext}`
    files.set(uri, new ArrayBuffer(8))
    return uri
  },
  exists: (uri) => files.has(uri),
  readBytes: async (uri) => files.get(uri) as ArrayBuffer,
  remove: (uri) => { files.delete(uri) },
}
const memoryStore: PhotoQueueStore = {
  load: async (coupleId, userId) => {
    const raw = saved.get(chatPhotoQueueKey(coupleId, userId))
    return raw ? (JSON.parse(raw) as QueuedPhoto[]) : []
  },
  save: async (coupleId, userId, items) => { saved.set(chatPhotoQueueKey(coupleId, userId), JSON.stringify(items)) },
}
const storedQueue = (): QueuedPhoto[] => JSON.parse(saved.get(chatPhotoQueueKey(COUPLE, USER)) ?? '[]')

/** 앱을 한 번 켠 것 - 같은 기기(저장 · 파일 · 서버) 위의 새 허브. */
function bootHub(over: Partial<ConstructorParameters<typeof PhotoQueueHub>[0]> = {}): PhotoQueueHub {
  return new PhotoQueueHub({ attempt: (item) => attemptQueuedPhoto(fakeDb(), item, memoryFs), fs: memoryFs, store: memoryStore, ...over })
}

const COUPLE = 'cp1'
const USER = 'u1'
const PHOTO = { uri: 'blob:picked', ext: 'jpg', mimeType: 'image/jpeg' }
const ITEM: QueuedPhoto = {
  clientId: '22222222-2222-4222-8222-222222222222', kind: 'message', coupleId: COUPLE, userId: USER,
  localUri: `${QUEUE_DIR}/22222222-2222-4222-8222-222222222222.jpg`, ext: 'jpg', contentType: 'image/jpeg',
  sentAt: '2026-10-25T01:00:00.000Z', retryCount: 0, status: 'pending',
}
function seed(item: QueuedPhoto = ITEM) {
  saved.set(chatPhotoQueueKey(COUPLE, USER), JSON.stringify([item]))
  files.set(item.localUri, new ArrayBuffer(8))
}
function connect(connected: boolean, userId: string | null = USER) {
  useAuthStore.setState({ userId })
  useCoupleStore.setState({ status: connected ? 'connected' : 'disconnected', coupleId: connected ? COUPLE : null })
}
function appVisible() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

let hubs: PhotoQueueHub[] = []
const track = (h: PhotoQueueHub) => (hubs.push(h), h)

beforeEach(() => {
  backend = new FakeBackend()
  files = new Map()
  saved = new Map()
  hubs = []
  connect(true)
})
afterEach(() => {
  for (const h of hubs) h.detach()
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.setState({ userId: null })
  useCoupleStore.getState().reset()
})

// ---------------------------------------------------------------------------
describe('사진 메시지 - 올렸는데 행을 넣기 전에(또는 응답 전에) 끊긴 뒤 앱 재시작', () => {
  it('끊긴 채 큐에 남고, 다시 열면 이어 보내며, 객체 1 · 행 1이다 - 한 번 더 보내도 1 · 1', async () => {
    backend.dropResponseAfterInsert = 'messages'
    const first = track(bootHub())
    first.attach(COUPLE, USER)
    const sent = await first.enqueue(PHOTO, 'message')
    // 올렸고 행도 들어갔지만 응답이 끊겨 앱은 모른다 -> 큐에 남고, 복사본도 남는다.
    expect(sent?.outcome).toBe('retry')
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(1)
    await waitFor(() => expect(storedQueue()).toHaveLength(1))
    expect(storedQueue()[0]).toMatchObject({ kind: 'message', coupleId: COUPLE, userId: USER, status: 'pending', contentType: 'image/jpeg' })
    expect(files.has(storedQueue()[0].localUri)).toBe(true)
    const stored = storedQueue()
    first.detach() // 앱 종료

    // 앱을 다시 연다 - 남은 항목을 이어서 보낸다.
    const second = track(bootHub())
    const arrived = vi.fn()
    second.subscribe({ onMessage: arrived })
    second.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1) // 다시 올려도 같은 경로 하나(409 = 성공으로 본다)
    expect(backend.messages).toHaveLength(1) // 23505 = 이미 전송됨 -> 행 하나
    expect(arrived).toHaveBeenCalledTimes(1) // 화면에는 서버가 확정한 행이 한 번
    expect(files.size).toBe(0) // 성공하면 복사본도 지운다
    second.detach()

    // 큐 항목이 지워지기 전에 앱이 죽었던 것처럼, 같은 항목이 한 번 더 남아 있다.
    saved.set(chatPhotoQueueKey(COUPLE, USER), JSON.stringify(stored))
    files.set(stored[0].localUri, new ArrayBuffer(8))
    const third = track(bootHub())
    third.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(1)
  })

  it('올리기 자체가 끊기면 객체도 행도 없고, 다시 열면 이어 보내 각 하나가 된다', async () => {
    backend.uploadFails = true
    const first = track(bootHub())
    first.attach(COUPLE, USER)
    await first.enqueue(PHOTO, 'message')
    expect(backend.objects.messages.size).toBe(0)
    expect(backend.messages).toHaveLength(0)
    await waitFor(() => expect(storedQueue()).toHaveLength(1))
    first.detach()

    backend.uploadFails = false
    const second = track(bootHub())
    second.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(1)
  })
})

describe('스토리 - 같은 경로의 행이 이미 있으면 넣지 않는다', () => {
  it('올렸고 행도 들어갔는데 응답이 끊긴 뒤 앱 재시작 -> 객체 1 · 행 1, 한 번 더 보내도 1 · 1', async () => {
    backend.dropResponseAfterInsert = 'stories'
    const first = track(bootHub())
    first.attach(COUPLE, USER)
    await first.enqueue(PHOTO, 'story')
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1)
    await waitFor(() => expect(storedQueue()).toHaveLength(1))
    const stored = storedQueue()
    first.detach()

    const second = track(bootHub())
    second.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1)
    second.detach()

    saved.set(chatPhotoQueueKey(COUPLE, USER), JSON.stringify(stored))
    files.set(stored[0].localUri, new ArrayBuffer(8))
    const third = track(bootHub())
    third.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1)
  })

  it('올리기가 끊겼다 다시 열면 이어 올려 객체 1 · 행 1이 된다', async () => {
    backend.uploadFails = true
    const first = track(bootHub())
    first.attach(COUPLE, USER)
    await first.enqueue(PHOTO, 'story')
    expect(backend.objects.stories.size).toBe(0)
    expect(backend.stories).toHaveLength(0)
    await waitFor(() => expect(storedQueue()).toHaveLength(1))
    first.detach()

    backend.uploadFails = false
    const second = track(bootHub())
    const arrived = vi.fn()
    second.subscribe({ onStory: arrived })
    second.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1)
    expect(arrived).toHaveBeenCalledTimes(1) // 화면에는 서버가 확정한 스토리가 한 번
  })

  it('멈춰 있던 스토리는 앱을 열 때 한 번 다시 시도한다', async () => {
    seed({ ...ITEM, kind: 'story', status: 'failed', retryCount: 5 })
    const hub = track(bootHub())
    hub.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.stories).toHaveLength(1)
  })
})

describe('복사본이 사라진 항목 · 취소 · 큐에 못 넣는 경우', () => {
  it('복사본이 없으면 서버를 부르지 않고, 큐에서 빠지며 알린다', async () => {
    seed()
    files.clear()
    const hub = track(bootHub())
    const lost = vi.fn()
    hub.subscribe({ onPhotoLost: lost })
    hub.attach(COUPLE, USER)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.uploadCalls).toBe(0)
    expect(backend.messages).toHaveLength(0)
    expect(lost).toHaveBeenCalledWith(expect.objectContaining({ clientId: ITEM.clientId }))
  })

  it('전송 취소는 큐 항목과 복사본을 지운다', async () => {
    backend.uploadFails = true
    const hub = track(bootHub())
    hub.attach(COUPLE, USER)
    const sent = await hub.enqueue(PHOTO, 'message')
    await waitFor(() => expect(storedQueue()).toHaveLength(1))
    hub.getPhotoQueue()?.cancel(sent!.item.clientId)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(files.size).toBe(0)
  })

  it('큐가 없으면(커플 아님) 넣지 않고 복사도 하지 않는다 · 복사에 실패해도 null', async () => {
    const copyIn = vi.fn(memoryFs.copyIn)
    const hub = track(bootHub({ fs: { ...memoryFs, copyIn } }))
    expect(await hub.enqueue(PHOTO, 'message')).toBeNull()
    expect(copyIn).not.toHaveBeenCalled()
    hub.attach(COUPLE, USER)
    copyIn.mockRejectedValueOnce(new Error('저장 공간 없음'))
    expect(await hub.enqueue(PHOTO, 'message')).toBeNull()
    expect(storedQueue()).toEqual([])
  })

  it('큐 항목은 보낸 사람 · 커플 · 클라이언트 id로 정해진다 - 같은 항목은 몇 번 다시 보내도 같은 경로(`entryStoragePath`)', async () => {
    backend.uploadFails = true
    const hub = track(bootHub({ newId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }))
    hub.attach(COUPLE, USER)
    const sent = await hub.enqueue({ uri: 'blob:x', ext: 'heic', mimeType: null }, 'message')
    expect(sent?.item).toMatchObject({ clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', contentType: 'image/heic', status: 'pending', retryCount: 0, coupleId: COUPLE, userId: USER })
    expect(sent?.item.localUri).toBe(`${QUEUE_DIR}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.heic`)
  })

  it('같은 (커플, 사용자)로 attach를 다시 불러도 큐는 하나다 · 늦게 붙은 화면은 지금 큐 상태를 받는다 · detach는 빈 큐를 알린다', async () => {
    backend.uploadFails = true
    const hub = track(bootHub())
    hub.attach(COUPLE, USER)
    const queue = hub.getPhotoQueue()
    hub.attach(COUPLE, USER)
    expect(hub.getPhotoQueue()).toBe(queue)
    await hub.enqueue(PHOTO, 'message')
    const seen = vi.fn()
    hub.subscribe({ onPhotoQueue: seen })
    expect(seen).toHaveBeenLastCalledWith([expect.objectContaining({ kind: 'message' })])
    hub.detach()
    expect(seen).toHaveBeenLastCalledWith([])
    expect(hub.current()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('큐 재개 시점 - 채팅 탭을 열지 않는다(R39-5, 65-)', () => {
  it('앱 시작(로그인 + 커플 확인 직후): 남은 사진이 보내진다', async () => {
    seed()
    const hub = track(bootHub())
    renderHook(() => usePhotoQueueResume(hub))
    await waitFor(() => expect(backend.messages).toHaveLength(1))
    expect(backend.objects.messages.size).toBe(1)
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(files.size).toBe(0)
  })

  it('앱 복귀(화면이 다시 보임): 백오프로 기다리던 항목을 바로 이어서 보낸다', async () => {
    backend.uploadFails = true
    seed()
    const hub = track(bootHub())
    renderHook(() => usePhotoQueueResume(hub))
    await waitFor(() => expect(backend.uploadCalls).toBeGreaterThanOrEqual(1)) // 첫 시도 실패 -> 백오프 대기
    expect(backend.objects.messages.size).toBe(0)
    backend.uploadFails = false
    await act(async () => { appVisible() })
    await waitFor(() => expect(backend.objects.messages.size).toBe(1))
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.messages).toHaveLength(1)
  })

  it('같은 항목 동시 업로드 0 - 올리는 중에 복귀 신호가 여러 번 와도, 같은 곳에 다시 붙어도 한 번만 올린다', async () => {
    let open!: () => void
    backend.uploadGate = new Promise<void>((resolve) => (open = resolve))
    seed()
    const hub = track(bootHub())
    renderHook(() => usePhotoQueueResume(hub))
    await waitFor(() => expect(backend.uploadCalls).toBe(1)) // 올리는 중
    await act(async () => { for (let i = 0; i < 3; i += 1) appVisible() })
    hub.attach(COUPLE, USER) // 채팅 화면이 같은 허브에 붙는다
    await act(async () => { open() })
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.uploadCalls).toBe(1)
    expect(backend.overlap).toBe(false)
    expect(backend.messages).toHaveLength(1)
  })

  it('커플이 아니면 돌지 않는다 - 저장된 항목도 그대로다', async () => {
    connect(false)
    seed()
    const hub = track(bootHub())
    renderHook(() => usePhotoQueueResume(hub))
    await act(async () => { appVisible() })
    expect(backend.uploadCalls).toBe(0)
    expect(backend.messages).toHaveLength(0)
    expect(storedQueue()).toHaveLength(1)
    expect(files.has(ITEM.localUri)).toBe(true)
  })

  it('커플 확인이 다시 도는 중(loading)에는 돌던 큐를 끊지 않는다', async () => {
    backend.uploadFails = true
    seed()
    const hub = track(bootHub())
    renderHook(() => usePhotoQueueResume(hub))
    await waitFor(() => expect(hub.current()).toEqual({ coupleId: COUPLE, userId: USER }))
    act(() => { useCoupleStore.setState({ status: 'loading' }) })
    expect(hub.current()).toEqual({ coupleId: COUPLE, userId: USER })
    act(() => { useCoupleStore.setState({ status: 'disconnected', coupleId: null }) })
    expect(hub.current()).toBeNull()
  })

  it('로그아웃하면 돌지 않고, 큐는 지워지지 않으며, 다음 로그인에 이어 간다', async () => {
    backend.uploadFails = true
    seed()
    const hub = track(bootHub())
    renderHook(() => usePhotoQueueResume(hub))
    await waitFor(() => expect(backend.uploadCalls).toBeGreaterThanOrEqual(1))
    const callsBefore = backend.uploadCalls

    backend.uploadFails = false
    act(() => { useAuthStore.setState({ userId: null }) }) // 로그아웃
    expect(hub.current()).toBeNull()
    await act(async () => { appVisible() })
    expect(backend.uploadCalls).toBe(callsBefore) // 더 안 돈다
    expect(storedQueue()).toHaveLength(1) // 기기 저장은 그대로
    expect(files.has(ITEM.localUri)).toBe(true)

    act(() => { useAuthStore.setState({ userId: USER }) }) // 다음 로그인
    await waitFor(() => expect(storedQueue()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('기기 저장 · 파일(웹판)', () => {
  it('Preferences에 RN과 같은 키로 저장하고 읽는다 · 깨진 저장은 빈 큐', async () => {
    await photoQueueStore.save(COUPLE, USER, [ITEM])
    expect(Preferences.set).toHaveBeenCalledWith({ key: `chat_photo_queue:${COUPLE}:${USER}`, value: JSON.stringify([ITEM]) })
    expect(await photoQueueStore.load(COUPLE, USER)).toEqual([ITEM])
    await Preferences.set({ key: chatPhotoQueueKey(COUPLE, USER), value: '{깨짐' })
    expect(await photoQueueStore.load(COUPLE, USER)).toEqual([])
    expect(await photoQueueStore.load(COUPLE, 'someone-else')).toEqual([])
  })

  describe('webPhotoFs (Filesystem 플러그인, 앱 데이터 폴더)', () => {
    const disk = new Map<string, string>()
    const fs: FilesystemLike = {
      writeFile: vi.fn(async ({ path, data, directory }) => { expect(directory).toBe(Directory.Data); disk.set(path, data) }),
      readFile: vi.fn(async ({ path }) => { const d = disk.get(path); if (d === undefined) throw new Error('없음'); return { data: d } }),
      stat: vi.fn(async ({ path }) => { if (!disk.has(path)) throw new Error('없음'); return {} }),
      deleteFile: vi.fn(async ({ path }) => { if (!disk.delete(path)) throw new Error('없음') }),
    }
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 1, 2, 3, 250, 251, 252])

    beforeEach(() => {
      disk.clear()
      vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob([bytes], { type: 'image/jpeg' }) })))
    })
    afterEach(() => { vi.unstubAllGlobals() })

    it('복사해 두면(copyIn) 폴더 안 상대 경로가 돌아오고, 있는지 · 바이트 그대로 읽기 · 지우기가 된다', async () => {
      const w = createWebPhotoFs(fs)
      const uri = await w.copyIn('blob:picked', 'abc-123', 'jpg')
      expect(uri).toBe(`${QUEUE_DIR}/abc-123.jpg`)
      expect(await w.exists(uri)).toBe(true)
      expect(Array.from(new Uint8Array(await w.readBytes(uri)))).toEqual(Array.from(bytes))
      await w.remove(uri)
      expect(await w.exists(uri)).toBe(false)
      await expect(w.remove(uri)).resolves.toBeUndefined() // 이미 없어도 던지지 않는다
    })

    it('웹 개발 서버처럼 읽기가 Blob으로 돌아와도 바이트를 읽는다', async () => {
      const blobFs: FilesystemLike = { ...fs, readFile: async () => ({ data: { arrayBuffer: async () => bytes.buffer } as unknown as Blob }) }
      expect(new Uint8Array(await createWebPhotoFs(blobFs).readBytes('x')).length).toBe(bytes.length)
    })

    it('읽기가 실패하면 항목은 일시 실패로 다시 시도된다(큐가 던지지 않는다)', async () => {
      const failing = createWebPhotoFs({ ...fs, readFile: async () => { throw new Error('읽기 실패') } })
      disk.set(ITEM.localUri, 'AAAA')
      const result = await attemptQueuedPhoto(fakeDb(), ITEM, failing)
      expect(result.outcome).toBe('retry')
      expect(backend.uploadCalls).toBe(0)
    })
  })
})

describe('보내는 형식', () => {
  it('mime이 있으면 그것, 없으면 확장자로, 모르면 jpeg', () => {
    expect(contentTypeOf({ ext: 'png', mimeType: 'image/png' })).toBe('image/png')
    expect(contentTypeOf({ ext: 'HEIC', mimeType: null })).toBe('image/heic')
    expect(contentTypeOf({ ext: 'webp', mimeType: null })).toBe('image/webp')
    expect(contentTypeOf({ ext: 'xyz', mimeType: null })).toBe('image/jpeg')
  })
})
