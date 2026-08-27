import { ChatRetryQueue, type AttemptOutcome } from '../../src/utils/chatRetryQueue'
import type { OutgoingMessage, QueuedMessage } from '../../src/utils/chatQueue'

/**
 * 백오프 타이밍 결정론 검증 — 작업 지시 "백오프 타이밍 테스트(결정론 —
 * 타이머를 fake timer로)". 실제로 몇십 초를 기다리지 않고
 * `jest.advanceTimersByTimeAsync`로 가상 시간을 흘려보내며, 매 지점에서
 * `attemptSend`가 정확히 몇 번 호출됐는지·큐 상태가 어떻게 바뀌는지를
 * 검증한다.
 */

const base = (clientMsgId: string): OutgoingMessage => ({
  clientMsgId,
  coupleId: 'couple-1',
  senderId: 'user-1',
  body: 'hi',
  sentAt: '2026-08-27T00:00:00.000Z',
})

function collectQueueChanges() {
  const snapshots: QueuedMessage[][] = []
  const onQueueChange = (queue: QueuedMessage[]) => {
    snapshots.push(queue.map((item) => ({ ...item })))
  }
  return { snapshots, onQueueChange }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('ChatRetryQueue — 지수 백오프(2s→4s→8s→16s→32s), 최대 5회', () => {
  it('재시도 가능 오류가 5회 연속되면 정확한 간격으로 5번만 재시도하고 failed로 전환해 자동 재시도를 멈춘다', async () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    for (let i = 0; i < 5; i++) {
      attemptSend.mockResolvedValueOnce({ outcome: 'failed', errorClass: 'retryable' })
    }
    const { snapshots, onQueueChange } = collectQueueChanges()

    const queue = new ChatRetryQueue({ attemptSend, onQueueChange })
    const enqueued = queue.enqueueAfterInitialFailure(base('a'), 'retryable')
    expect(enqueued.status).toBe('pending')
    expect(enqueued.retryCount).toBe(0)
    expect(attemptSend).not.toHaveBeenCalled() // 최초 시도는 이 클래스 밖(훅)에서 이미 실행된 뒤라 여기선 재시도만 센다

    const delays = [2000, 4000, 8000, 16000, 32000]
    for (const delay of delays) {
      // eslint-disable-next-line no-await-in-loop
      await jest.advanceTimersByTimeAsync(delay)
    }

    expect(attemptSend).toHaveBeenCalledTimes(5)
    const final = queue.getQueue()
    expect(final).toHaveLength(1)
    expect(final[0].status).toBe('failed')
    expect(final[0].retryCount).toBe(5)

    // 소진 후에는 시간이 더 지나도 추가 시도가 없다.
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(attemptSend).toHaveBeenCalledTimes(5)

    // 마지막 스냅샷도 failed다(화면/영속화에 반영된 최종 상태).
    expect(snapshots.at(-1)?.[0].status).toBe('failed')
  })

  it('3번째 재시도에서 성공하면 그 시점에 큐에서 제거되고 이후 시도가 없다', async () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    attemptSend.mockResolvedValueOnce({ outcome: 'failed', errorClass: 'retryable' })
    attemptSend.mockResolvedValueOnce({ outcome: 'failed', errorClass: 'retryable' })
    attemptSend.mockResolvedValueOnce({ outcome: 'sent' })
    const { onQueueChange } = collectQueueChanges()

    const queue = new ChatRetryQueue({ attemptSend, onQueueChange })
    queue.enqueueAfterInitialFailure(base('a'), 'retryable')

    await jest.advanceTimersByTimeAsync(2000) // 재시도 1 실패
    await jest.advanceTimersByTimeAsync(4000) // 재시도 2 실패
    await jest.advanceTimersByTimeAsync(8000) // 재시도 3 성공

    expect(attemptSend).toHaveBeenCalledTimes(3)
    expect(queue.getQueue()).toHaveLength(0)

    await jest.advanceTimersByTimeAsync(60000)
    expect(attemptSend).toHaveBeenCalledTimes(3) // 제거됐으니 더 이상 시도하지 않는다
  })

  it('permanent 오류(RLS 거부 등)는 재시도 없이 즉시 failed로 전환한다', () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    const { onQueueChange } = collectQueueChanges()

    const queue = new ChatRetryQueue({ attemptSend, onQueueChange })
    const item = queue.enqueueAfterInitialFailure(base('a'), 'permanent')

    expect(item.status).toBe('failed')
    expect(attemptSend).not.toHaveBeenCalled()

    jest.advanceTimersByTime(10 * 60 * 1000)
    expect(attemptSend).not.toHaveBeenCalled()
  })
})

describe('ChatRetryQueue — 사용자 조작', () => {
  it('retryNow는 카운터를 리셋하고 지연 없이 즉시 재시도한다', async () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    for (let i = 0; i < 5; i++) {
      attemptSend.mockResolvedValueOnce({ outcome: 'failed', errorClass: 'retryable' })
    }
    attemptSend.mockResolvedValueOnce({ outcome: 'sent' })
    const { onQueueChange } = collectQueueChanges()

    const queue = new ChatRetryQueue({ attemptSend, onQueueChange })
    queue.enqueueAfterInitialFailure(base('a'), 'retryable')
    for (const delay of [2000, 4000, 8000, 16000, 32000]) {
      // eslint-disable-next-line no-await-in-loop
      await jest.advanceTimersByTimeAsync(delay)
    }
    expect(queue.getQueue()[0].status).toBe('failed')

    queue.retryNow('a')
    expect(queue.getQueue()[0].status).toBe('pending')
    expect(queue.getQueue()[0].retryCount).toBe(0)

    await jest.advanceTimersByTimeAsync(0) // 지연 없이 바로 시도
    expect(attemptSend).toHaveBeenCalledTimes(6)
    expect(queue.getQueue()).toHaveLength(0) // 이번엔 성공 응답이라 큐에서 빠진다
  })

  it('cancel은 큐에서 제거하고 예약된 재시도를 멈춘다', async () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    attemptSend.mockResolvedValue({ outcome: 'failed', errorClass: 'retryable' })
    const { onQueueChange } = collectQueueChanges()

    const queue = new ChatRetryQueue({ attemptSend, onQueueChange })
    queue.enqueueAfterInitialFailure(base('a'), 'retryable')

    queue.cancel('a')
    expect(queue.getQueue()).toHaveLength(0)

    await jest.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(attemptSend).not.toHaveBeenCalled() // 취소됐으니 예약돼 있던 재시도도 실행되지 않는다
  })
})

describe('ChatRetryQueue — 복원(완료 기준: 강제 종료 후 재실행 시 pending 복원 + 재시도 재개)', () => {
  it('생성 시 pending 항목은 지연 없이 즉시 재시도를 재개한다', async () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    attemptSend.mockResolvedValueOnce({ outcome: 'sent' })
    const { onQueueChange } = collectQueueChanges()

    const restored: QueuedMessage[] = [{ ...base('a'), retryCount: 2, status: 'pending' }]
    // eslint-disable-next-line no-new
    new ChatRetryQueue({ attemptSend, onQueueChange }, restored)

    await jest.advanceTimersByTimeAsync(0)
    expect(attemptSend).toHaveBeenCalledTimes(1)
  })

  it('생성 시 failed 항목은 자동으로 재시도하지 않는다(사용자가 다시 시도를 눌러야 함)', async () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    const { onQueueChange } = collectQueueChanges()

    const restored: QueuedMessage[] = [{ ...base('a'), retryCount: 5, status: 'failed' }]
    const queue = new ChatRetryQueue({ attemptSend, onQueueChange }, restored)

    await jest.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(attemptSend).not.toHaveBeenCalled()
    expect(queue.getQueue()[0].status).toBe('failed')
  })

  it('hydrate — 생성 후 비동기로 도착한 복원 데이터를 합치고 pending 항목은 즉시 재시도한다(AsyncStorage 읽기 대기 중 큐가 비어있는 창을 없애기 위한 설계)', async () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    attemptSend.mockResolvedValueOnce({ outcome: 'sent' })
    const { onQueueChange } = collectQueueChanges()

    const queue = new ChatRetryQueue({ attemptSend, onQueueChange }) // 복원 전 — 빈 큐로 시작
    expect(queue.getQueue()).toHaveLength(0)

    queue.hydrate([{ ...base('a'), retryCount: 1, status: 'pending' }])
    expect(queue.getQueue()).toHaveLength(1)

    await jest.advanceTimersByTimeAsync(0)
    expect(attemptSend).toHaveBeenCalledTimes(1)
    expect(queue.getQueue()).toHaveLength(0) // 성공 응답이라 큐에서 빠진다
  })

  it('hydrate는 이미 큐에 있는(생성 이후 새로 실패해 들어온) clientMsgId를 덮어쓰지 않는다', () => {
    const attemptSend = jest.fn<Promise<AttemptOutcome>, [OutgoingMessage]>()
    const { onQueueChange } = collectQueueChanges()

    const queue = new ChatRetryQueue({ attemptSend, onQueueChange })
    const live = queue.enqueueAfterInitialFailure(base('a'), 'permanent') // failed, retryCount 0

    // 복원 데이터에 같은 clientMsgId가 다른(더 오래된) 상태로 들어있어도 무시한다.
    queue.hydrate([{ ...base('a'), retryCount: 3, status: 'pending' }])

    expect(queue.getQueue()).toHaveLength(1)
    expect(queue.getQueue()[0]).toEqual(live)
  })
})
