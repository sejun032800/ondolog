/**
 * 채팅 데이터 · 큐 시험(74-5) - 원본: `__tests__/hooks/useRealtimeGapFill.test.tsx`(메우기) · `__tests__/hooks/chatQueueResume.test.tsx`(글 큐 재개) ·
 * `__tests__/hooks/chatPhotoQueue.test.tsx`(채팅 쪽 사진 말풍선) · `__tests__/services/chatCore.test.ts`(빈 본문 거부 · 멱등) · `__tests__/utils/chatMessages.test.ts`(병합 · 정렬 · 읽음 대상) ·
 * `__tests__/utils/chatRetryQueue.test.ts`(재시도 정책 - 웹이 같은 파일을 가져다 쓰므로 루트 jest가 계속 지키고, 여기서는 웹 허브를 거쳐 같은 행동이 나오는지).
 * 서버는 가짜(`chatTestSupport.ts`) - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { chatQueueStorageKey, type QueuedMessage } from '@/utils/chatQueue'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { useChatQueueSignal } from '../../connection/chatQueueSignal'
import { useCoupleStore } from '../../stores/coupleStore'
import { makeChatWorld as world, messageRow } from './chatTestSupport'
import { useChatMessages } from './useChatMessages'
import { useChatQueueResume } from './useChatQueueResume'

const T0 = '2026-11-09T09:00:00.000Z'
const at = (min: number) => new Date(Date.parse(T0) + min * 60000).toISOString()

beforeEach(() => {
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
  useChatQueueSignal.getState().setWaiting(false)
})

const ids = (r: { current: { messages: { id: string }[] } }) => r.current.messages.map((m) => m.id)

// ---------------------------------------------------------------------------
describe('불러오기 · 병합 · 정렬', () => {
  it('처음 불러온 메시지는 보낸 시각 순이고 지운 메시지는 없다', async () => {
    const w = world({ messages: [messageRow('b', at(2)), messageRow('a', at(1)), messageRow('x', at(3), { deleted_at: at(4) })] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(ids(result)).toEqual(['a', 'b'])
  })

  it('커플이 없으면(미연결) 서버를 부르지 않고 빈 목록', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages(null, 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toEqual([])
    expect(w.db.channels).toHaveLength(0)
  })
})

describe('실시간(Realtime) 채널', () => {
  it('RN과 같은 채널 이름 · 같은 테이블 · 같은 필터로 구독하고, 나가면 채널을 정리한다', async () => {
    const w = world({ messages: [messageRow('a', at(1))] })
    const { result, unmount } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(w.db.channels).toHaveLength(1)
    expect(w.db.channels[0].name).toBe('messages:c1')
    expect(w.db.channels[0].filter).toEqual({ event: '*', schema: 'public', table: 'messages', filter: 'couple_id=eq.c1' })
    unmount()
    expect((w.db.client.removeChannel as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
  })

  it('상대가 보낸 메시지가 실시간으로 들어오고, 같은 이벤트가 두 번 와도 하나다', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const row = messageRow('n1', at(5), { read_at: at(6) })
    act(() => { w.db.channels[0].event?.({ eventType: 'INSERT', new: row }) })
    act(() => { w.db.channels[0].event?.({ eventType: 'INSERT', new: row }) })
    expect(ids(result)).toEqual(['n1'])
  })

  it('내가 보낸 낙관적 말풍선과 서버가 확정한 행(같은 client_msg_id)은 하나로 합쳐진다', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.sendText('안녕') })
    const sent = w.db.inserts[0]
    // 같은 행이 실시간으로 또 한 번 들어온다(내 다른 기기 · 내 삽입의 알림).
    act(() => { w.db.channels[0].event?.({ eventType: 'INSERT', new: { ...w.db.tables.messages[0] } }) })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].clientMsgId).toBe(sent.client_msg_id)
    expect(result.current.messages[0].pending).toBeFalsy()
  })

  it('삭제 이벤트는 무시하고, 읽음 갱신(UPDATE)은 같은 말풍선에 합쳐진다', async () => {
    const w = world({ messages: [messageRow('m1', at(1), { sender_id: 'me' })] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { w.db.channels[0].event?.({ eventType: 'DELETE', new: messageRow('m1', at(1)) }) })
    expect(ids(result)).toEqual(['m1'])
    act(() => { w.db.channels[0].event?.({ eventType: 'UPDATE', new: messageRow('m1', at(1), { sender_id: 'me', read_at: at(3) }) }) })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].readAt).toBe(at(3))
  })
})

describe('메우기(R37-3) - 끊겼다 돌아오면 빠진 메시지를 채운다', () => {
  it('구독이 SUBSCRIBED가 되면 마지막 메시지 이후를 조회해 합치고, 실시간과 겹쳐도 하나다', async () => {
    const w = world({ messages: [messageRow('a', at(1))] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(ids(result)).toEqual(['a']))
    // 끊긴 사이 서버에 b · c가 쌓였고, 실시간은 b만 가져왔다.
    w.db.tables.messages.push(messageRow('b', at(2), { read_at: at(9) }), messageRow('c', at(3), { read_at: at(9) }))
    act(() => { w.db.channels[0].event?.({ eventType: 'INSERT', new: messageRow('b', at(2), { read_at: at(9) }) }) })
    expect(ids(result)).toEqual(['a', 'b'])
    await act(async () => { w.db.channels[0].status?.('SUBSCRIBED') })
    await waitFor(() => expect(ids(result)).toEqual(['a', 'b', 'c']))
  })

  it('화면이 다시 보일 때(visibilitychange)도 같은 메우기를 한다', async () => {
    const w = world({ messages: [messageRow('a', at(1))] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(ids(result)).toEqual(['a']))
    w.db.tables.messages.push(messageRow('d', at(4), { read_at: at(9) }))
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(ids(result)).toEqual(['a', 'd']))
  })

  it('조회가 실패해도 조용히 넘어간다(다음 신호에서 다시)', async () => {
    const w = world({ messages: [messageRow('a', at(1))] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(ids(result)).toEqual(['a']))
    const original = w.db.client.from
    ;(w.db.client as unknown as { from: unknown }).from = () => { throw new Error('boom') }
    await act(async () => { w.db.channels[0].status?.('SUBSCRIBED') })
    ;(w.db.client as unknown as { from: unknown }).from = original
    expect(ids(result)).toEqual(['a'])
  })
})

describe('읽음', () => {
  it('상대가 보낸 안 읽은 메시지만 읽음으로 갱신하고, 내가 보낸 행은 대상에서 뺀다', async () => {
    const w = world({ messages: [messageRow('p1', at(1)), messageRow('p2', at(2)), messageRow('mine', at(3), { sender_id: 'me' })] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(w.db.updates).toHaveLength(1))
    const u = w.db.updates[0]
    expect(u.table).toBe('messages')
    expect(u.match).toMatchObject({ couple_id: 'c1' })
    expect(u.neq).toEqual({ sender_id: 'me' }) // 발신자가 나인 행은 갱신 대상이 아니다
    expect(typeof u.payload.read_at).toBe('string')
    await waitFor(() => expect(result.current.messages.filter((m) => m.senderId === 'you').every((m) => m.readAt !== null)).toBe(true))
    expect(w.db.tables.messages.find((r) => r.id === 'mine')?.read_at).toBeNull()
  })

  it('안 읽은 상대 메시지가 없으면 갱신 요청을 보내지 않는다', async () => {
    const w = world({ messages: [messageRow('p1', at(1), { read_at: at(2) }), messageRow('mine', at(3), { sender_id: 'me' })] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(w.db.updates).toHaveLength(0)
  })
})

describe('글 보내기 · 빈 본문 막음(R21-5)', () => {
  it('공백뿐인 글은 서버에 가지 않고 말풍선도 만들지 않는다', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.sendText('   ') })
    await act(async () => { await result.current.sendText('') })
    expect(w.db.inserts).toHaveLength(0)
    expect(result.current.messages).toHaveLength(0)
  })

  it('앞뒤 공백을 떼고 한 번 보낸다(client_msg_id 하나 · 보낸 뒤 보내는 중 표시가 사라진다)', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.sendText('  안녕  ') })
    expect(w.db.inserts).toHaveLength(1)
    expect(w.db.inserts[0]).toMatchObject({ body: '안녕', couple_id: 'c1', sender_id: 'me' })
    expect(typeof w.db.inserts[0].client_msg_id).toBe('string')
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].pending).toBeFalsy()
    expect(result.current.hasQueued).toBe(false)
  })
})

describe('전송 큐(글) - 오프라인이면 쌓고 돌아오면 순서대로, 중복 0', () => {
  it('끊긴 동안 보낸 글은 보내는 중으로 쌓이고(hasQueued), 돌아오면 한 번씩만 순서대로 간다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }) // 같은 밀리초 정렬이 흔들리지 않게 시각도 흉내
    const w = world({ offline: true })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    for (const body of ['하나', '둘', '셋']) {
      await act(async () => { await result.current.sendText(body); await vi.advanceTimersByTimeAsync(1) })
    }
    expect(w.db.inserts).toHaveLength(0)
    expect(result.current.messages.map((m) => [m.body, m.pending])).toEqual([['하나', true], ['둘', true], ['셋', true]])
    expect(result.current.hasQueued).toBe(true)
    // 연결이 돌아온다 - 앱 복귀 신호(kick)로 바로, 아니어도 백오프로.
    w.db.state.offline = false
    await act(async () => { w.hubs.text.kick(); await vi.advanceTimersByTimeAsync(10) })
    expect(w.db.inserts.map((r) => r.body)).toEqual(['하나', '둘', '셋'])
    expect(result.current.messages.map((m) => m.body)).toEqual(['하나', '둘', '셋'])
    expect(result.current.messages.every((m) => !m.pending && !m.failed)).toBe(true)
    expect(result.current.hasQueued).toBe(false)
    // 더 기다려도 다시 보내지 않는다.
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(w.db.inserts).toHaveLength(3)
  })

  it('백오프로도 이어 보낸다(2초 -> ...) · 같은 글이 두 번 가지 않는다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world({ insertFailures: 2 }) // 처음 두 번은 네트워크 오류
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await result.current.sendText('다시'); await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.messages[0].pending).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(w.db.inserts).toHaveLength(1)
    expect(w.db.tables.messages).toHaveLength(1)
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].pending).toBeFalsy()
  })

  it('같은 client_msg_id로 다시 시도해도 행은 하나(23505 = 이미 전송)', async () => {
    const w = world()
    const item = { clientMsgId: 'cm-1', coupleId: 'c1', senderId: 'me', body: '안녕', sentAt: at(1) }
    w.hubs.text.attach('c1', 'me')
    expect((await w.hubs.text.attemptText(item)).outcome).toBe('sent')
    expect((await w.hubs.text.attemptText(item)).outcome).toBe('already_sent')
    expect(w.db.tables.messages.filter((r) => r.client_msg_id === 'cm-1')).toHaveLength(1)
  })

  it('앱을 껐다 켜도(새 허브가 같은 기기 저장을 이어받음) 쌓인 글이 이어서 한 번만 간다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w1 = world({ offline: true })
    const first = renderHook(() => useChatMessages('c1', 'me', w1.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await first.result.current.sendText('남은 글'); await vi.advanceTimersByTimeAsync(1) })
    expect(w1.textStore.data.get(chatQueueStorageKey('c1'))?.map((q) => q.body)).toEqual(['남은 글'])
    first.unmount()
    w1.hubs.text.detach() // 앱 종료 - 타이머만 멈추고 저장은 남는다
    expect(w1.textStore.data.get(chatQueueStorageKey('c1'))).toHaveLength(1)

    // 다시 켬: 새 허브 + 같은 저장 + 연결이 돌아온 서버.
    const w2 = world({}, { textStore: w1.textStore, files: w1.files })
    const second = renderHook(() => useChatMessages('c1', 'me', w2.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(w2.db.inserts.map((r) => r.body)).toEqual(['남은 글'])
    expect(second.result.current.messages.map((m) => [m.body, m.pending])).toEqual([['남은 글', false]])
    expect(w2.textStore.data.get(chatQueueStorageKey('c1'))).toEqual([])
  })

  it('보내는 중 말풍선을 취소하면 큐와 화면에서 사라지고 다시 보내지 않는다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world({ offline: true })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await result.current.sendText('취소할 글'); await vi.advanceTimersByTimeAsync(1) })
    const clientMsgId = result.current.messages[0].clientMsgId as string
    act(() => { result.current.cancelPending(clientMsgId) })
    expect(result.current.messages).toHaveLength(0)
    expect(result.current.hasQueued).toBe(false)
    w.db.state.offline = false
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(w.db.inserts).toHaveLength(0)
  })

  it('재시도가 소진되면 실패 말풍선(다시 보내기)이 되고, 누르면 횟수를 새로 세어 보낸다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world({ offline: true })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await result.current.sendText('안 가는 글'); await vi.advanceTimersByTimeAsync(1) })
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000) }) // 5회 백오프를 모두 지난다
    expect(result.current.messages[0].failed).toBe(true)
    expect(result.current.hasQueued).toBe(false) // 자동 재시도 중이 아니면 F05 안내 줄도 없다
    w.db.state.offline = false
    act(() => { result.current.retryFailed(result.current.messages[0].clientMsgId as string) })
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(w.db.inserts.map((r) => r.body)).toEqual(['안 가는 글'])
    expect(result.current.messages[0].failed).toBeFalsy()
  })
})

describe('글 큐 재개 + 대기 신호(useChatQueueResume)', () => {
  it('커플로 연결돼 있으면 앱 시작에 허브에 붙고, 미연결이면 붙지 않는다(기기 저장은 지우지 않는다)', async () => {
    const w = world()
    const attach = vi.spyOn(w.hubs.text, 'attach')
    const detach = vi.spyOn(w.hubs.text, 'detach')
    renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    expect(attach).toHaveBeenCalledWith('c1', 'me')
    detach.mockClear() // attach가 안에서 이전 큐를 정리하느라 부르는 것은 센 값에서 뺀다
    act(() => { useCoupleStore.setState({ status: 'loading' }) })
    expect(detach).not.toHaveBeenCalled() // 커플 확인이 다시 도는 중에는 큐를 끊지 않는다
    act(() => { useCoupleStore.setState({ status: 'disconnected', coupleId: null }) })
    expect(detach).toHaveBeenCalled()
  })

  it('저장돼 있던 글을 앱 시작에 이어서 보내고, 앱이 다시 보이면 바로 이어 보낸다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world()
    const queued: QueuedMessage = { clientMsgId: 'old-1', coupleId: 'c1', senderId: 'me', body: '저장돼 있던 글', sentAt: at(1), retryCount: 1, status: 'pending' }
    w.textStore.data.set(chatQueueStorageKey('c1'), [queued])
    renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(w.db.inserts.map((r) => r.body)).toEqual(['저장돼 있던 글'])
  })

  it('복귀(visibilitychange)는 kick을 부른다', () => {
    const w = world()
    const kick = vi.spyOn(w.hubs.text, 'kick')
    renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(kick).toHaveBeenCalled()
  })

  it('글 · 사진 큐 어느 쪽이든 대기 항목이 있으면 신호가 켜지고, 모두 비면 꺼진다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world({ offline: true })
    renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    expect(useChatQueueSignal.getState().waiting).toBe(false)
    const item = { clientMsgId: 'w-1', coupleId: 'c1', senderId: 'me', body: '대기', sentAt: at(1) }
    await act(async () => {
      const r = await w.hubs.text.attemptText(item)
      if (r.outcome === 'failed') w.hubs.text.getTextQueue()?.enqueueAfterInitialFailure(item, r.errorClass)
    })
    expect(useChatQueueSignal.getState().waiting).toBe(true)
    w.db.state.offline = false
    await act(async () => { w.hubs.text.kick(); await vi.advanceTimersByTimeAsync(10) })
    expect(useChatQueueSignal.getState().waiting).toBe(false)
  })

  it('화면에서 나가면(언마운트) 신호를 끈다', async () => {
    const w = world()
    const { unmount } = renderHook(() => useChatQueueResume(w.hubs.text, w.hubs.photo))
    useChatQueueSignal.getState().setWaiting(true)
    unmount()
    expect(useChatQueueSignal.getState().waiting).toBe(false)
  })
})

describe('사진 · 스토리 말풍선(채팅 쪽)', () => {
  const photo = { uri: 'blob:p', ext: 'jpg', mimeType: 'image/jpeg' }

  it('사진 보내기: 올리는 중에는 복사본 말풍선(보내는 중), 끝나면 서버 행(media_path)으로 합쳐져 하나다', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.sendPhoto(photo) })
    expect(w.db.uploads).toHaveLength(1)
    expect(w.db.uploads[0].bucket).toBe('messages')
    expect(w.db.tables.messages).toHaveLength(1)
    await waitFor(() => expect(result.current.messages).toHaveLength(1))
    expect(result.current.messages[0].mediaPath).toMatch(/^c1\//)
    expect(result.current.messages[0].pending).toBeFalsy()
    expect(result.current.hasQueued).toBe(false)
  })

  it('끊긴 상태의 사진은 말풍선이 보내는 중으로 남고, 돌아오면 객체 1 · 행 1로 끝난다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world({ offline: true })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await result.current.sendPhoto(photo); await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.messages[0].pending).toBe(true)
    expect(result.current.messages[0].localUri).toMatch(/^chat-photo-queue\//)
    expect(result.current.hasQueued).toBe(true)
    w.db.state.offline = false
    await act(async () => { w.hubs.photo.kick(); await vi.advanceTimersByTimeAsync(10) })
    expect(w.db.uploads).toHaveLength(1)
    expect(w.db.tables.messages).toHaveLength(1)
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].pending).toBeFalsy()
  })

  it('복사본이 사라진 사진은 이 세션에서 실패로 보이고, 다시 보내기는 동작하지 않으며, 취소하면 지워진다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = world({ offline: true })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await result.current.sendPhoto(photo); await vi.advanceTimersByTimeAsync(1) })
    w.files.clear() // 저장공간을 비웠다
    w.db.state.offline = false
    await act(async () => { w.hubs.photo.kick(); await vi.advanceTimersByTimeAsync(10) })
    const m = result.current.messages[0]
    expect(m.failed).toBe(true)
    expect(w.db.uploads).toHaveLength(0)
    act(() => { result.current.retryFailed(m.clientMsgId as string) })
    expect(result.current.messages[0].failed).toBe(true)
    act(() => { result.current.cancelPending(m.clientMsgId as string) })
    expect(result.current.messages).toHaveLength(0)
  })

  it('스토리 올리기: 한 장을 올리면 true, 스토리 행이 하나 생기고 줄에 합쳐진다(편집 · 캡션 없음)', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.storiesLoading).toBe(false))
    let ok = false
    await act(async () => { ok = await result.current.postStory(photo) })
    expect(ok).toBe(true)
    expect(w.db.uploads[0].bucket).toBe('stories')
    expect(w.db.tables.stories).toHaveLength(1)
    expect(w.db.tables.stories[0]).toMatchObject({ caption: null, author_id: 'me', couple_id: 'c1' })
    await waitFor(() => expect(result.current.stories).toHaveLength(1))
  })

  it('만료된 스토리는 읽지 않는다(24시간)', async () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    const future = new Date(Date.now() + 3600_000).toISOString()
    const w = world({ stories: [
      { id: 's1', couple_id: 'c1', author_id: 'you', media_path: 'c1/s1.jpg', created_at: past, expires_at: past },
      { id: 's2', couple_id: 'c1', author_id: 'you', media_path: 'c1/s2.jpg', created_at: past, expires_at: future },
    ] })
    const { result } = renderHook(() => useChatMessages('c1', 'me', w.hubs))
    await waitFor(() => expect(result.current.storiesLoading).toBe(false))
    expect(result.current.stories.map((s) => s.id)).toEqual(['s2'])
  })

  it('큐가 없으면(미연결) 사진 · 스토리 보내기는 아무 일도 하지 않고 스토리는 false', async () => {
    const w = world()
    const { result } = renderHook(() => useChatMessages(null, null, w.hubs))
    await act(async () => { await result.current.sendPhoto(photo) })
    let ok = true
    await act(async () => { ok = await result.current.postStory(photo) })
    expect(ok).toBe(false)
    expect(w.db.uploads).toHaveLength(0)
  })
})
