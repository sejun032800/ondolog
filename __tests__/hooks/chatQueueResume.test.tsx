/**
 * 큐 재개 시점(R39-5) - 앱 시작 · 복귀에서 텍스트 큐와 사진 큐를 함께 재개한다.
 *
 * 채팅 훅은 처음 네 시험에서 마운트하지 않는다(세 번째에서만 "탭 진입이 겹쳐도 한 번"을 보려고 붙인다). 서버(Supabase)와 파일은 메모리 가짜다.
 * 가짜 서버는 진짜처럼 굴어야 한다: Storage는 같은 경로에 두 번 올리면 409, 메시지는 (couple_id, client_msg_id)가 겹치면 23505.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useChatQueueResume } from '../../src/hooks/useChatQueueResume'
import { useRealtimeMessages } from '../../src/hooks/useRealtimeMessages'
import { useCoupleStore } from '../../src/store/coupleStore'
import { chatQueueStorageKey, parseQueuedMessages } from '../../src/utils/chatQueue'
import { AppState } from 'react-native'
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
  /** 올리기를 붙잡아 두는 문(열기 전까지 응답하지 않는다). */
  uploadGate: Promise<void> | null = null
  /** 같은 경로가 동시에 올라간 적이 있는가. */
  overlap = false
  private uploading = new Set<string>()
  markUpload(path: string, on: boolean) {
    if (on) {
      if (this.uploading.has(path)) this.overlap = true
      this.uploading.add(path)
    } else this.uploading.delete(path)
  }
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
          backend.markUpload(path, true)
          try {
            if (backend.uploadGate) await backend.uploadGate
          } finally {
            backend.markUpload(path, false)
          }
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


jest.mock('../../src/hooks/useSession', () => ({
  useSession: () => ({ session: mockSession, loading: false }),
}))
let mockSession: { user: { id: string } } | null = null

const COUPLE = 'cp1'
const USER = 'u1'

const PHOTO_ITEM: QueuedPhoto = {
  clientId: '22222222-2222-4222-8222-222222222222',
  kind: 'message',
  coupleId: COUPLE,
  userId: USER,
  localUri: 'file:///docs/chat-photo-queue/22222222-2222-4222-8222-222222222222.jpg',
  ext: 'jpg',
  contentType: 'image/jpeg',
  sentAt: '2026-10-25T01:00:00.000Z',
  retryCount: 0,
  status: 'pending',
}
const TEXT_ITEM = {
  clientMsgId: '33333333-3333-4333-8333-333333333333',
  coupleId: COUPLE,
  senderId: USER,
  body: '남은 글',
  sentAt: '2026-10-25T01:00:00.000Z',
  retryCount: 0,
  status: 'pending',
  errorClass: 'retryable',
}

async function seedQueues() {
  await AsyncStorage.setItem(chatPhotoQueueKey(COUPLE, USER), JSON.stringify([PHOTO_ITEM]))
  await AsyncStorage.setItem(chatQueueStorageKey(COUPLE), JSON.stringify([TEXT_ITEM]))
  mockFiles.set(PHOTO_ITEM.localUri, new ArrayBuffer(8))
}

function connect(connected: boolean) {
  useCoupleStore.setState({ status: connected ? 'connected' : 'disconnected', coupleId: connected ? COUPLE : null })
}

/** AppState 'change' 리스너를 붙잡아 앱 복귀를 흉내 낸다. */
let appStateListeners: Array<(s: string) => void> = []

beforeEach(async () => {
  backend = new FakeBackend()
  mockFiles.clear()
  await AsyncStorage.clear()
  chatQueueHub.detach()
  mockSession = { user: { id: USER } }
  connect(true)
  appStateListeners = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (s: string) => void) => {
    appStateListeners.push(cb)
    return { remove: () => (appStateListeners = appStateListeners.filter((x) => x !== cb)) }
  }) as never)
})

afterEach(() => {
  chatQueueHub.detach()
  jest.restoreAllMocks()
})

async function storedPhotos(): Promise<QueuedPhoto[]> {
  return parseQueuedPhotos(await AsyncStorage.getItem(chatPhotoQueueKey(COUPLE, USER)))
}
async function storedTexts() {
  return parseQueuedMessages(await AsyncStorage.getItem(chatQueueStorageKey(COUPLE)))
}

describe('큐 재개(R39-5) - 채팅 탭을 열지 않는다', () => {
  it('앱 시작(로그인 + 커플 확인 직후): 남은 글 · 사진이 보내진다 - 채팅 훅은 마운트하지 않았다', async () => {
    await seedQueues()
    const root = await renderHook(() => useChatQueueResume())

    await waitFor(() => expect(backend.messages).toHaveLength(2))
    expect(backend.objects.messages.size).toBe(1) // 객체 1
    expect(backend.messages.filter((m) => m.media_path)).toHaveLength(1) // 사진 행 1
    expect(backend.messages.filter((m) => m.body === '남은 글')).toHaveLength(1) // 글 행 1
    await waitFor(async () => expect(await storedPhotos()).toEqual([]))
    await waitFor(async () => expect(await storedTexts()).toEqual([]))
    expect(mockFiles.size).toBe(0)
    await root.unmount()
  })

  it('앱 복귀(AppState active): 백오프로 기다리던 항목을 바로 이어서 보낸다', async () => {
    backend.uploadFails = true
    await seedQueues()
    const root = await renderHook(() => useChatQueueResume())
    await waitFor(() => expect(backend.uploadCalls).toBeGreaterThanOrEqual(1)) // 첫 시도 실패 -> 백오프 대기
    expect(backend.objects.messages.size).toBe(0)

    backend.uploadFails = false
    await act(async () => {
      for (const cb of appStateListeners) cb('active')
    })
    await waitFor(() => expect(backend.objects.messages.size).toBe(1))
    await waitFor(async () => expect(await storedPhotos()).toEqual([]))
    expect(backend.messages.filter((m) => m.media_path)).toHaveLength(1)
    await root.unmount()
  })

  it('같은 항목 동시 업로드 0 - 올리는 중에 복귀 신호가 여러 번 와도, 채팅 훅이 붙어도 한 번만 올린다', async () => {
    let open!: () => void
    backend.uploadGate = new Promise<void>((resolve) => (open = resolve))
    await seedQueues()
    const root = await renderHook(() => useChatQueueResume())
    await waitFor(() => expect(backend.uploadCalls).toBe(1)) // 올리는 중

    await act(async () => {
      for (let i = 0; i < 3; i += 1) for (const cb of appStateListeners) cb('active')
    })
    const chat = await renderHook(() => useRealtimeMessages(COUPLE, USER)) // 채팅 탭 진입 - 같은 허브에 붙는다
    await act(async () => {
      open()
    })
    await waitFor(async () => expect(await storedPhotos()).toEqual([]))
    expect(backend.uploadCalls).toBe(1)
    expect(backend.overlap).toBe(false)
    expect(backend.messages.filter((m) => m.media_path)).toHaveLength(1)
    expect(backend.messages.filter((m) => m.body === '남은 글')).toHaveLength(1)
    await chat.unmount()
    await root.unmount()
  })

  it('커플이 아니면 돌지 않는다 - 저장된 항목도 그대로다', async () => {
    connect(false)
    await seedQueues()
    const root = await renderHook(() => useChatQueueResume())
    await act(async () => {
      for (const cb of appStateListeners) cb('active')
    })
    expect(backend.uploadCalls).toBe(0)
    expect(backend.messages).toHaveLength(0)
    expect(await storedPhotos()).toHaveLength(1)
    expect(await storedTexts()).toHaveLength(1)
    await root.unmount()
  })

  it('로그아웃 상태에서는 돌지 않고, 로그아웃해도 큐는 지워지지 않으며, 다음 로그인에 이어 간다', async () => {
    backend.uploadFails = true
    await seedQueues()
    const root = await renderHook(() => useChatQueueResume())
    await waitFor(() => expect(backend.uploadCalls).toBeGreaterThanOrEqual(1))
    const callsBefore = backend.uploadCalls

    // 로그아웃: 세션이 사라진다.
    backend.uploadFails = false
    mockSession = null
    await act(async () => {
      root.rerender({})
    })
    expect(chatQueueHub.current()).toBeNull()
    await act(async () => {
      for (const cb of appStateListeners) cb('active')
    })
    expect(backend.uploadCalls).toBe(callsBefore) // 더 안 돈다
    expect(await storedPhotos()).toHaveLength(1) // 기기 저장은 그대로 (글은 첫 시도에서 이미 나갔다)
    expect(mockFiles.has(PHOTO_ITEM.localUri)).toBe(true)

    // 다음 로그인 - 이어서 보낸다.
    mockSession = { user: { id: USER } }
    await act(async () => {
      root.rerender({})
    })
    await waitFor(async () => expect(await storedPhotos()).toEqual([]))
    expect(backend.objects.messages.size).toBe(1)
    expect(backend.messages).toHaveLength(2)
    await root.unmount()
  })
})
