/**
 * 76- 웹 묶음 1 시험 - A1 기기 저장(오프라인 · 다시 그릴 때 먼저 표시 · 계정 격리 · 지우는 때) · B1 스토리 실시간 · C1 다시 연결 즉시 큐 비우기 · A2 사진 올리는 중 거짓 끊김 안내 0.
 * 서버는 가짜(`chatTestSupport.ts`) - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { clearAllDeviceCache, clearCoupleCache, purgeOtherUsers, readCache, writeCache } from '../../cache/deviceCache'
import { clearSignedUrlCache } from '../../cache/signedUrlCache'
import { useChatQueueSignal } from '../../connection/chatQueueSignal'
import { useConnectionStore } from '../../connection/connectionMonitor'
import { useCoupleStore } from '../../stores/coupleStore'
import { resetAccountMemory } from '../settings/accountActions'
import { usePartnerName } from '../main/useMainData'
import { CHAT_CACHE_LIMIT, readChatCache, writeChatCache } from './chatCache'
import { makeChatWorld as world, messageRow } from './chatTestSupport'
import { useChatMessages } from './useChatMessages'
import { useChatQueueResume } from './useChatQueueResume'

const T0 = '2026-11-09T09:00:00.000Z'
const at = (min: number) => new Date(Date.parse(T0) + min * 60000).toISOString()
const cached = (id: string, min: number, over: Record<string, unknown> = {}) => ({
  id, clientMsgId: `cm-${id}`, coupleId: 'c1', senderId: 'you', body: `body-${id}`, mediaPath: null, sentAt: at(min), readAt: at(min), ...over,
})

beforeEach(() => {
  try { localStorage.clear() } catch { /* */ }
  clearSignedUrlCache()
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
  useConnectionStore.setState({ offline: false })
  useChatQueueSignal.setState({ waiting: false })
})

describe('A1 기기 저장 - 먼저 표시하고, 서버 읽기가 오면 교체한다', () => {
  it('저장된 최근 메시지가 있으면 첫 그림부터 보이고(빈 채팅 0 · 뼈대 0), 서버 읽기가 오면 서버 목록으로 교체된다(서버에서 지워진 것은 사라진다)', async () => {
    writeChatCache('me', 'c1', [cached('old', 1), cached('gone', 2)] as never)
    const w = world({ messages: [messageRow('old', at(1)), messageRow('new', at(3))] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    expect(result.current.loading).toBe(false) // 첫 그림 - 서버 읽기 전
    expect(result.current.messages.map((m) => m.id)).toEqual(['old', 'gone'])
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['old', 'new']))
  })

  it('오프라인(서버 읽기 실패)이어도 저장된 대화가 그대로 남는다', async () => {
    writeChatCache('me', 'c1', [cached('a', 1), cached('b', 2)] as never)
    const w = world()
    ;(w.db.client as unknown as { from: unknown }).from = () => { throw new TypeError('network') }
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await Promise.resolve() })
    expect(result.current.messages.map((m) => m.id)).toEqual(['a', 'b'])
    expect(result.current.loading).toBe(false)
  })

  it('서버가 확정한 최근 100건만 저장하고, 보내는 중 · 실패 · 기기 미리보기는 저장하지 않는다', () => {
    const many = Array.from({ length: 130 }, (_, i) => cached(`m${i}`, i))
    writeChatCache('me', 'c1', [...many, cached('p', 200, { pending: true }), cached('f', 201, { failed: true }), cached('l', 202, { localUri: 'x' }), cached('local:z', 203)] as never)
    const saved = readChatCache('me', 'c1')
    expect(saved).toHaveLength(CHAT_CACHE_LIMIT)
    expect(saved[saved.length - 1].id).toBe('m129') // 가장 최근 100건
    expect(saved.some((m) => m.id === 'p' || m.id === 'f' || m.id === 'l' || m.id === 'local:z')).toBe(false)
  })

  it('불러온 메시지는 기기에 남는다 - 사진은 경로만(서명 URL · 파일 0)', async () => {
    const w = world({ messages: [messageRow('a', at(1)), messageRow('p', at(2), { body: null, media_path: 'c1/p.jpg' })] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    await waitFor(() => expect(readChatCache('me', 'c1')).toHaveLength(2))
    const raw = JSON.stringify(Object.entries(localStorage))
    expect(raw).toContain('c1/p.jpg')
    expect(raw).not.toContain('signed.invalid')
  })

  it('다른 계정은 읽지 못한다 · 다른 커플 id의 저장은 읽지 않는다', () => {
    writeChatCache('me', 'c1', [cached('a', 1)] as never)
    expect(readChatCache('other-user', 'c1')).toEqual([])
    expect(readChatCache('me', 'c2')).toEqual([])
    expect(readChatCache('me', 'c1')).toHaveLength(1)
  })

  it('상대 이름: 저장된 이름이 첫 그림부터 보이고(기본 글자 "상대" 0.1초도 0), 서버 값이 오면 바뀐다', async () => {
    world({ profiles: [{ id: 'you', display_name: '서영' }] })
    writeCache('me', 'name', { name: '옛이름' }, 'you')
    const { result } = renderHook(() => usePartnerName('you'))
    expect(result.current).toBe('옛이름')
    await waitFor(() => expect(result.current).toBe('서영'))
    expect(readCache<{ name: string }>('me', 'name', 'you')?.name).toBe('서영')
  })

  it('커플 상태: 저장된 메인 요약(커플 이름 · 사귄 날짜 · 온도)으로 조회 전에 연결 상태를 먼저 채운다', () => {
    useCoupleStore.getState().reset()
    writeCache('me', 'main', { coupleId: 'c1', partnerId: 'you', nickname: '우리', temperature: 37.2, temperatureDateOn: '2026-11-08', relationshipStartDate: '2026-01-01', referencePhotoPath: null })
    useCoupleStore.getState().hydrate('me')
    const s = useCoupleStore.getState()
    expect([s.status, s.nickname, s.temperature, s.relationshipStartDate]).toEqual(['connected', '우리', 37.2, '2026-01-01'])
  })

  it('이미 읽은 커플 상태는 저장값으로 덮지 않는다', () => {
    writeCache('me', 'main', { coupleId: 'old', partnerId: 'x', nickname: '옛', temperature: 40, temperatureDateOn: null, relationshipStartDate: null, referencePhotoPath: null })
    useCoupleStore.getState().hydrate('me') // status가 이미 connected(c1)
    expect(useCoupleStore.getState().coupleId).toBe('c1')
  })
})

describe('A1 기기 저장 - 지우는 때(공유 폰에 대화가 남지 않게)', () => {
  const seed = (user: string) => {
    writeChatCache(user, 'c1', [cached('a', 1)] as never)
    writeCache(user, 'main', { coupleId: 'c1', partnerId: 'you' })
    writeCache(user, 'feed', { chapters: [], names: {} })
    writeCache(user, 'name', { name: '서영' }, 'you')
  }

  it('로그아웃 · 탈퇴 요청(resetAccountMemory)은 이 기기의 저장분을 모두 지운다', () => {
    seed('me')
    resetAccountMemory()
    expect(localStorage.length).toBe(0)
    expect(readChatCache('me', 'c1')).toEqual([])
  })

  it('계정 전환: 다른 사용자 id로 로그인하면 이전 계정의 저장분을 지운다(이전 대화 0)', () => {
    seed('user-A')
    purgeOtherUsers('user-B')
    expect(readChatCache('user-A', 'c1')).toEqual([])
    expect(readChatCache('user-B', 'c1')).toEqual([])
    expect(localStorage.length).toBe(0)
  })

  it('계정 전환 정리는 지금 사용자의 저장분은 남긴다', () => {
    seed('user-A')
    seed('user-B')
    purgeOtherUsers('user-B')
    expect(readChatCache('user-B', 'c1')).toHaveLength(1)
    expect(readChatCache('user-A', 'c1')).toEqual([])
  })

  it('해제 완료(커플이 더는 없음): 커플 자료(채팅 · 메인 요약 · 피드)만 지우고 이름은 남는다', () => {
    seed('me')
    clearCoupleCache('me')
    expect(readChatCache('me', 'c1')).toEqual([])
    expect(readCache('me', 'main')).toBeNull()
    expect(readCache('me', 'feed')).toBeNull()
    expect(readCache('me', 'name', 'you')).not.toBeNull()
  })

  it('커플 상태 조회가 "연결 없음"(오류 아님)으로 끝나면(해제 완료) 커플 자료를 지운다 - 조회 오류(오프라인)에서는 지우지 않는다', async () => {
    seed('me')
    const w = world({ couples: [] })
    useCoupleStore.getState().reset()
    await act(async () => { await useCoupleStore.getState().refresh('me') })
    expect(useCoupleStore.getState().status).toBe('disconnected')
    expect(readChatCache('me', 'c1')).toEqual([])
    seed('me')
    ;(w.db.client as unknown as { from: unknown }).from = () => { throw new TypeError('network') }
    await act(async () => { await useCoupleStore.getState().refresh('me') })
    expect(readChatCache('me', 'c1')).toHaveLength(1)
  })

  it('clearAllDeviceCache는 이 앱 저장분만 지운다(다른 키는 건드리지 않는다)', () => {
    localStorage.setItem('other-key', '1')
    seed('me')
    clearAllDeviceCache()
    expect(localStorage.getItem('other-key')).toBe('1')
    expect(localStorage.length).toBe(1)
  })
})

describe('B1 스토리 실시간 구독(R98-3)', () => {
  const story = (id: string, min: number) => ({ id, couple_id: 'c1', author_id: 'you', media_path: `c1/${id}.jpg`, created_at: at(min), expires_at: new Date(Date.now() + 3600_000).toISOString() })

  it('채팅에 머무는 동안 상대의 새 스토리가 INSERT 알림으로 나타나고, 같은 스토리가 두 번 와도 하나다', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.storiesLoading).toBe(false))
    const ch = w.db.channels.find((c) => c.name === 'stories:c1')
    expect(ch?.filter).toEqual({ event: 'INSERT', schema: 'public', table: 'stories', filter: 'couple_id=eq.c1' })
    expect(result.current.stories).toHaveLength(0)
    act(() => { ch?.event?.({ eventType: 'INSERT', new: story('s1', 1) }) })
    act(() => { ch?.event?.({ eventType: 'INSERT', new: story('s1', 1) }) })
    expect(result.current.stories.map((s) => s.id)).toEqual(['s1'])
  })

  it('탭을 떠나면(언마운트) 스토리 구독도 풀린다', async () => {
    const w = world()
    const { unmount } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await Promise.resolve() })
    const removed = w.db.client.removeChannel as unknown as ReturnType<typeof vi.fn>
    const before = removed.mock.calls.length
    unmount()
    expect(removed.mock.calls.length - before).toBe(2) // 메시지 + 스토리
  })

  it('다시 연결(두 번째 SUBSCRIBED)에서는 놓친 스토리를 조회로 메운다', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.storiesLoading).toBe(false))
    const ch = w.db.channels.find((c) => c.name === 'stories:c1')
    await act(async () => { ch?.status?.('SUBSCRIBED') }) // 처음 확정 - 목록 로드가 맡는다
    w.db.tables.stories.push(story('missed', 2))
    await act(async () => { ch?.status?.('SUBSCRIBED') })
    await waitFor(() => expect(result.current.stories.map((s) => s.id)).toEqual(['missed']))
  })
})

describe('C1 다시 연결 감지 즉시 큐 한 번 비우기', () => {
  it('끊겨 쌓인 글이 브라우저 online 이벤트에서 백오프를 기다리지 않고 바로 나간다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const w = world({ offline: true })
    const chat = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await chat.result.current.sendText('하나'); await vi.advanceTimersByTimeAsync(1) })
    expect(w.db.inserts).toHaveLength(0)
    w.db.state.offline = false
    await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(10) }) // 백오프(2초~)보다 한참 앞
    expect(w.db.inserts.map((r) => r.body)).toEqual(['하나'])
  })

  it('끊김 띠가 풀리는 순간(확인 요청 성공)에도 바로 비운다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const w = world({ offline: true })
    const chat = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await chat.result.current.sendText('둘'); await vi.advanceTimersByTimeAsync(1) })
    useConnectionStore.setState({ offline: true })
    w.db.state.offline = false
    await act(async () => { useConnectionStore.getState().report(true); await vi.advanceTimersByTimeAsync(10) })
    expect(w.db.inserts.map((r) => r.body)).toEqual(['둘'])
  })
})

describe('A2 사진 · 스토리를 올리는 동안은 "연결이 끊겼어요" 안내가 없다', () => {
  const photo = { uri: 'blob:p', ext: 'jpg', mimeType: 'image/jpeg' }
  /** 업로드만 `ms` 지연시킨다(0이면 끝나지 않는다). */
  const delayUpload = (w: ReturnType<typeof world>, ms: number) => {
    const storage = w.db.client.storage as unknown as { from: (b: string) => { upload: (...a: unknown[]) => Promise<unknown> } }
    const realFrom = storage.from.bind(storage)
    storage.from = (bucket: string) => {
      const b = realFrom(bucket)
      return { ...b, upload: async (...a: unknown[]) => { await (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : new Promise(() => {})); return b.upload(...a) } }
    }
  }

  it('업로드가 30초 걸려도(가짜 타이머) 올리는 동안 안내 0 · 끝난 뒤에도 0', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world()
    delayUpload(w, 30_000)
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    let sending: Promise<void> = Promise.resolve()
    await act(async () => { sending = result.current.sendPhoto(photo); await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.messages[0].pending).toBe(true) // 보내는 중 말풍선은 있다
    for (const ms of [1_000, 9_000, 10_000, 9_000]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
      expect(result.current.hasQueued).toBe(false) // 올리는 동안 띠 0
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); await sending })
    expect(result.current.hasQueued).toBe(false)
    expect(result.current.messages.every((m) => !m.pending)).toBe(true)
  })

  it('실제로 실패해 다시 시도를 기다리는 사진은 안내가 나온다(실제 오프라인에서는 띠)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world({ offline: true })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await result.current.sendPhoto(photo); await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.hasQueued).toBe(true)
  })

  it('다른 탭의 대기 신호(useChatQueueResume)도 올리는 중에는 켜지지 않는다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world()
    delayUpload(w, 0) // 끝나지 않는 업로드
    const chat = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { void chat.result.current.sendPhoto(photo); await vi.advanceTimersByTimeAsync(20_000) })
    expect(useChatQueueSignal.getState().waiting).toBe(false)
  })
})
