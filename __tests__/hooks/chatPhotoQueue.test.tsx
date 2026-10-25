/**
 * 사진 영속 큐(R37-2) - 메시지 · 스토리 모두.
 *
 * 실제 훅(`useRealtimeMessages`) · 실제 `chatApi` · `chatCore` · `chatPhotoCore` · 실제 AsyncStorage 목을 쓰고, 서버(Supabase)와 파일만 메모리 가짜로 바꾼다.
 * "앱 재시작"은 훅을 내리고 새로 붙이는 것이다 - 큐 상태는 기기 저장(AsyncStorage)과 복사본 파일에만 남는다.
 * 가짜 서버는 진짜처럼 굴어야 한다: Storage는 같은 경로에 두 번 올리면 409, 메시지는 (couple_id, client_msg_id)가 겹치면 23505.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useRealtimeMessages } from '../../src/hooks/useRealtimeMessages'
import { chatQueueHub } from '../../src/services/chatQueueHub'
import { chatPhotoQueueKey, parseQueuedPhotos, type QueuedPhoto } from '../../src/utils/chatPhotoQueue'
import type { PickedPhoto } from '../../src/utils/dateRecord'

type Row = Record<string, unknown>

/** 메모리 서버. */
class FakeBackend {
  messages: Row[] = []
  stories: Row[] = []
  /** bucket -> 올라간 경로들. */
  objects: Record<string, Set<string>> = { messages: new Set(), stories: new Set() }
  uploadCalls = 0
  /** 다음 삽입을 적용한 뒤 응답만 끊긴 것처럼 던진다(`'messages'` · `'stories'`). */
  dropResponseAfterInsert: 'messages' | 'stories' | null = null
  /** 올리기 자체가 끊긴다. */
  uploadFails = false
  private seq = 0

  table(name: string): Row[] {
    return name === 'messages' ? this.messages : this.stories
  }

  nextId(): string {
    this.seq += 1
    return `row-${this.seq}`
  }
}

let backend = new FakeBackend()

function queryBuilder(b: FakeBackend, tableName: string) {
  let op: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  const filters: Array<(r: Row) => boolean> = []
  let limit: number | undefined
  let single = false
  let maybe = false

  const exec = async (): Promise<{ data: unknown; error: unknown }> => {
    const rows = b.table(tableName)
    if (op === 'insert') {
      if (tableName === 'messages') {
        const dup = rows.some((r) => r.couple_id === payload.couple_id && r.client_msg_id === payload.client_msg_id)
        if (dup) return { data: null, error: { code: '23505', message: 'duplicate key' } }
      }
      const row: Row =
        tableName === 'messages'
          ? { id: b.nextId(), sent_at: new Date().toISOString(), read_at: null, deleted_at: null, ...payload }
          : { id: b.nextId(), created_at: new Date().toISOString(), resolved_at: null, ...payload }
      rows.push(row)
      if (b.dropResponseAfterInsert === tableName) {
        b.dropResponseAfterInsert = null
        throw new TypeError('Network request failed')
      }
      return { data: single ? row : [row], error: null }
    }
    if (op === 'update') return { data: [], error: null }
    let found = rows.filter((r) => filters.every((f) => f(r)))
    if (limit !== undefined) found = found.slice(0, limit)
    if (single) return found.length === 1 ? { data: found[0], error: null } : { data: null, error: { code: 'PGRST116' } }
    if (maybe) return { data: found[0] ?? null, error: null }
    return { data: found, error: null }
  }

  const api: Record<string, unknown> = {
    select: () => api,
    insert: (row: Row) => {
      op = 'insert'
      payload = row
      return api
    },
    update: () => {
      op = 'update'
      return api
    },
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), api),
    gte: (k: string, v: string) => (filters.push((r) => String(r[k]) >= v), api),
    order: () => api,
    limit: (n: number) => ((limit = n), api),
    single: () => ((single = true), api),
    maybeSingle: () => ((maybe = true), api),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => exec().then(resolve, reject),
  }
  return api
}

function fakeClient() {
  return {
    from: (name: string) => queryBuilder(backend, name),
    storage: {
      from: (bucket: 'messages' | 'stories') => ({
        upload: async (path: string) => {
          backend.uploadCalls += 1
          if (backend.uploadFails) throw new TypeError('Network request failed')
          if (backend.objects[bucket].has(path)) {
            return { error: { statusCode: '409', message: 'The resource already exists' } }
          }
          backend.objects[bucket].add(path)
          return { error: null }
        },
        createSignedUrls: async () => ({ data: [], error: null }),
      }),
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel }
      return channel
    },
    removeChannel: () => {},
  }
}

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockClient().from(...(a as [string])),
    storage: { from: (...a: unknown[]) => mockClient().storage.from(...(a as ['messages'])) },
    channel: (...a: unknown[]) => mockClient().channel(...(a as [])),
    removeChannel: () => {},
  },
}))
function mockClient() {
  return fakeClient()
}

/** 메모리 파일. */
const mockFiles = new Map<string, ArrayBuffer>()
jest.mock('../../src/services/photoQueueFs', () => ({
  photoQueueFs: {
    copyIn: async (_source: string, clientId: string, ext: string) => {
      const uri = `file:///docs/chat-photo-queue/${clientId}.${ext}`
      mockFiles.set(uri, new ArrayBuffer(8))
      return uri
    },
    exists: (uri: string) => mockFiles.has(uri),
    readBytes: async (uri: string) => mockFiles.get(uri) as ArrayBuffer,
    remove: (uri: string) => {
      mockFiles.delete(uri)
    },
  },
}))

const COUPLE = 'cp1'
const USER = 'u1'
const KEY = chatPhotoQueueKey(COUPLE, USER)

const PHOTO: PickedPhoto = {
  uri: 'file:///cache/picked.jpg',
  width: 100,
  height: 100,
  byteSize: 8,
  mimeType: 'image/jpeg',
  ext: 'jpg',
  capturedAt: null,
  lat: null,
  lng: null,
}

async function storedQueue(): Promise<QueuedPhoto[]> {
  return parseQueuedPhotos(await AsyncStorage.getItem(KEY))
}

async function mount() {
  chatQueueHub.detach() // 앱 프로세스가 새로 시작한다 - 큐는 허브가 갖는다(R39-5). 남는 것은 기기 저장과 복사본뿐이다.
  const hook = await renderHook(() => useRealtimeMessages(COUPLE, USER))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

afterEach(() => {
  chatQueueHub.detach()
})

beforeEach(async () => {
  backend = new FakeBackend()
  mockFiles.clear()
  await AsyncStorage.clear()
})

describe('사진 메시지 - 올렸는데 행을 넣기 전에(또는 응답 전에) 끊긴 뒤 앱 재시작', () => {
  it('끊긴 채 큐에 남고, 다시 열면 이어 보내며, 객체 1 · 행 1이다 - 한 번 더 보내도 1 · 1', async () => {
    backend.dropResponseAfterInsert = 'messages'
    const first = await mount()
    await act(async () => {
      await first.result.current.sendPhoto(PHOTO)
    })

    // 올렸고 행도 들어갔지만 응답이 끊겨 앱은 모른다 -> 큐에 남고, 복사본도 남는다. 말풍선은 보내는 중.
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(1)
    const stored = await storedQueue()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ kind: 'message', coupleId: COUPLE, userId: USER, status: 'pending' })
    expect(mockFiles.has(stored[0].localUri)).toBe(true)
    expect(first.result.current.messages[0]).toMatchObject({ pending: true, localUri: stored[0].localUri })
    expect(first.result.current.hasQueued).toBe(true)
    await first.unmount() // 앱 종료

    // 앱을 다시 연다 - 남은 항목을 이어서 보낸다.
    const second = await mount()
    await waitFor(() => expect(second.result.current.messages.some((m) => m.mediaPath !== null)).toBe(true))
    await waitFor(async () => expect(await storedQueue()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1) // 다시 올려도 같은 경로 하나
    expect(backend.messages).toHaveLength(1) // 23505 = 이미 전송됨 -> 행 하나
    expect(second.result.current.messages).toHaveLength(1)
    expect(second.result.current.hasQueued).toBe(false)
    expect(mockFiles.size).toBe(0) // 성공하면 복사본도 지운다
    await second.unmount()

    // 큐 항목이 지워지기 전에 앱이 죽었던 것처럼, 같은 항목이 한 번 더 남아 있다.
    await AsyncStorage.setItem(KEY, JSON.stringify(stored))
    mockFiles.set(stored[0].localUri, new ArrayBuffer(8))
    const third = await mount()
    await waitFor(async () => expect(await storedQueue()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(1)
    expect(third.result.current.messages).toHaveLength(1)
    await third.unmount()
  })

  it('올리기 자체가 끊기면 객체도 행도 없고, 다시 열면 이어 보내 각 하나가 된다', async () => {
    backend.uploadFails = true
    const first = await mount()
    await act(async () => {
      await first.result.current.sendPhoto(PHOTO)
    })
    expect(backend.objects.messages.size).toBe(0)
    expect(backend.messages).toHaveLength(0)
    expect(await storedQueue()).toHaveLength(1)
    await first.unmount()

    backend.uploadFails = false
    const second = await mount()
    await waitFor(async () => expect(await storedQueue()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(1)
    await second.unmount()
  })
})

describe('스토리 - 같은 경로의 행이 이미 있으면 넣지 않는다', () => {
  it('올렸고 행도 들어갔는데 응답이 끊긴 뒤 앱 재시작 -> 객체 1 · 행 1, 한 번 더 보내도 1 · 1', async () => {
    backend.dropResponseAfterInsert = 'stories'
    const first = await mount()
    let ok = false
    await act(async () => {
      ok = await first.result.current.postStory(PHOTO)
    })
    expect(ok).toBe(true) // 큐에서 이어 보내는 중 - 사용자에게 실패를 알리지 않는다
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1)
    const stored = await storedQueue()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ kind: 'story', status: 'pending' })
    await first.unmount()

    const second = await mount()
    await waitFor(async () => expect(await storedQueue()).toEqual([]))
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1) // 조회가 먼저 잡아서 두 번째 행을 넣지 않았다
    expect(mockFiles.size).toBe(0)
    await second.unmount()

    await AsyncStorage.setItem(KEY, JSON.stringify(stored))
    mockFiles.set(stored[0].localUri, new ArrayBuffer(8))
    const third = await mount()
    await waitFor(async () => expect(await storedQueue()).toEqual([]))
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1)
    await third.unmount()
  })

  it('올리기가 끊겼다 다시 열면 이어 올려 객체 1 · 행 1이 되고, 화면의 스토리 목록에도 하나다', async () => {
    backend.uploadFails = true
    const first = await mount()
    await act(async () => {
      await first.result.current.postStory(PHOTO)
    })
    expect(backend.stories).toHaveLength(0)
    expect(await storedQueue()).toHaveLength(1)
    await first.unmount()

    backend.uploadFails = false
    const second = await mount()
    await waitFor(async () => expect(await storedQueue()).toEqual([]))
    expect(backend.objects.stories.size).toBe(1)
    expect(backend.stories).toHaveLength(1)
    await waitFor(() => expect(second.result.current.stories).toHaveLength(1))
    await second.unmount()
  })
})

describe('복사본이 사라진 항목 · 취소', () => {
  it('복사본이 없으면 서버를 부르지 않고, 실패로 보이며 큐에서 빠진다 - 길게 눌러 지울 수 있다', async () => {
    const orphan: QueuedPhoto = {
      clientId: '11111111-1111-4111-8111-111111111111',
      kind: 'message',
      coupleId: COUPLE,
      userId: USER,
      localUri: 'file:///docs/chat-photo-queue/gone.jpg', // 파일은 없다
      ext: 'jpg',
      contentType: 'image/jpeg',
      sentAt: '2026-10-25T01:00:00.000Z',
      retryCount: 0,
      status: 'pending',
    }
    await AsyncStorage.setItem(KEY, JSON.stringify([orphan]))
    const hook = await mount()
    await waitFor(() => expect(hook.result.current.messages.find((m) => m.clientMsgId === orphan.clientId)?.failed).toBe(true))
    expect(backend.uploadCalls).toBe(0)
    expect(backend.messages).toHaveLength(0)
    await waitFor(async () => expect(await storedQueue()).toEqual([]))
    expect(hook.result.current.hasQueued).toBe(false)

    await act(async () => {
      hook.result.current.cancelPending(orphan.clientId)
    })
    expect(hook.result.current.messages).toHaveLength(0)
    await hook.unmount()
  })

  it('전송 취소는 큐 항목과 복사본을 지운다', async () => {
    backend.uploadFails = true
    const hook = await mount()
    await act(async () => {
      await hook.result.current.sendPhoto(PHOTO)
    })
    const [item] = await storedQueue()
    expect(mockFiles.has(item.localUri)).toBe(true)
    await act(async () => {
      hook.result.current.cancelPending(item.clientId)
    })
    expect(await storedQueue()).toEqual([])
    expect(mockFiles.has(item.localUri)).toBe(false)
    expect(hook.result.current.messages).toHaveLength(0)
    await hook.unmount()
  })
})
