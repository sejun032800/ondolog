/**
 * 채팅 오프라인 재전송 큐 러너 — 지수 백오프 스케줄링(`setTimeout`)과
 * 사용자 조작("다시 시도"/취소)을 담당한다.
 *
 * 근거: 작업 지시 "채팅 전송 큐를 보완해주세요" — "2. 재시도 정책",
 * "3. 사용자 조작".
 *
 * React를 전혀 모른다 — 상태 판단은 `chatQueue.ts`의 순수 함수에
 * 위임하고, 실제 전송(`attemptSend`)과 큐 변경 반영(`onQueueChange`,
 * AsyncStorage 저장 + 화면 상태 갱신)은 생성자가 주입받는다. 그 덕에
 * `__tests__/utils/chatRetryQueue.test.ts`가 jest fake timer로 백오프
 * 타이밍을 결정론적으로 검증할 수 있다 — 실제 몇 초를 기다릴 필요가
 * 없다. `src/hooks/useRealtimeMessages.ts`가 이 클래스를 인스턴스화해서
 * React state/AsyncStorage에 연결한다.
 */
import {
  computeBackoffDelayMs,
  dequeueOutgoing,
  enqueueOutgoing,
  recordFailedRetry,
  resetForRetry,
  shouldDequeueAfterSendOutcome,
  toQueuedMessage,
  type OutgoingMessage,
  type QueuedMessage,
  type SendErrorClass,
  type SendOutcome,
} from './chatQueue'

export type AttemptOutcome =
  | { outcome: Extract<SendOutcome, 'sent' | 'already_sent'> }
  | { outcome: Extract<SendOutcome, 'failed'>; errorClass: SendErrorClass }

export interface ChatRetryQueueDeps {
  /** 실제 전송 1회 시도(네트워크 호출) — 이 클래스는 그 결과 판단만 한다. */
  attemptSend: (item: OutgoingMessage) => Promise<AttemptOutcome>
  /** 큐 내용이 바뀔 때마다 호출된다. 호출부가 AsyncStorage 저장 + 화면 상태 반영을 함께 한다. */
  onQueueChange: (queue: QueuedMessage[]) => void
}

export class ChatRetryQueue {
  private queue: QueuedMessage[]
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly deps: ChatRetryQueueDeps,
    restored: QueuedMessage[] = [],
  ) {
    this.queue = restored
    // 완료 기준: "앱 강제 종료 후 재실행 시 미전송 메시지가 pending으로
    // 복원되고 재시도가 재개된다" — 복원된 pending 항목은 지연 없이 바로
    // 재시도를 건다(failed 항목은 사용자가 "다시 시도"를 눌러야만 재개).
    for (const item of this.queue) {
      if (item.status === 'pending') this.schedule(item.clientMsgId, 0)
    }
  }

  getQueue(): QueuedMessage[] {
    return this.queue
  }

  /**
   * 생성 이후 비동기로 도착한 복원 데이터(AsyncStorage 읽기)를 합친다.
   * 이미 있는 `clientMsgId`는 건드리지 않는다 — 큐 인스턴스가 만들어진
   * 뒤 복원이 끝나기 전 사이에 (극히 드물게) 새로 실패해 들어온 항목이
   * 있어도 덮어쓰지 않기 위함이다. pending 항목은 지연 없이 재시도를
   * 건다(생성자와 동일한 정책).
   */
  hydrate(restored: QueuedMessage[]): void {
    for (const item of restored) {
      if (this.queue.some((m) => m.clientMsgId === item.clientMsgId)) continue
      this.queue = enqueueOutgoing(this.queue, item)
      if (item.status === 'pending') this.schedule(item.clientMsgId, 0)
    }
    this.emit()
  }

  /** 최초 전송(이 클래스 밖에서 실행됨)이 실패한 직후 호출해 큐에 적재한다. */
  enqueueAfterInitialFailure(message: OutgoingMessage, errorClass: SendErrorClass): QueuedMessage {
    const item = toQueuedMessage(message, errorClass)
    this.queue = enqueueOutgoing(this.queue, item)
    this.emit()
    if (item.status === 'pending') {
      this.schedule(item.clientMsgId, computeBackoffDelayMs(item.retryCount + 1))
    }
    return item
  }

  /** "다시 시도" 탭 — 카운터 리셋 후 큐 즉시 재투입, pending으로 전환한다. */
  retryNow(clientMsgId: string): void {
    const item = this.queue.find((m) => m.clientMsgId === clientMsgId)
    if (!item) return
    this.replace(resetForRetry(item))
    this.schedule(clientMsgId, 0)
  }

  /** 말풍선 길게 누르기 → 전송 취소 — 큐에서 제거하고 타이머를 정리한다. */
  cancel(clientMsgId: string): void {
    this.clearTimer(clientMsgId)
    this.queue = dequeueOutgoing(this.queue, clientMsgId)
    this.emit()
  }

  /** 화면/훅이 언마운트되거나 커플이 바뀔 때 예약된 타이머를 전부 정리한다. */
  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }

  private schedule(clientMsgId: string, delayMs: number): void {
    this.clearTimer(clientMsgId)
    const timer = setTimeout(() => {
      this.timers.delete(clientMsgId)
      void this.runAttempt(clientMsgId)
    }, delayMs)
    this.timers.set(clientMsgId, timer)
  }

  private clearTimer(clientMsgId: string): void {
    const timer = this.timers.get(clientMsgId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(clientMsgId)
    }
  }

  private async runAttempt(clientMsgId: string): Promise<void> {
    const item = this.queue.find((m) => m.clientMsgId === clientMsgId)
    if (!item || item.status !== 'pending') return // 그 사이 취소/다시시도로 상태가 바뀌었을 수 있다

    const result = await this.deps.attemptSend(item)

    // attemptSend가 비동기로 도는 동안 취소됐을 수 있다 — 이미 사라졌으면 아무것도 하지 않는다.
    if (!this.queue.some((m) => m.clientMsgId === clientMsgId)) return

    if (shouldDequeueAfterSendOutcome(result.outcome)) {
      this.queue = dequeueOutgoing(this.queue, clientMsgId)
      this.emit()
      return
    }
    // shouldDequeueAfterSendOutcome이 false면 SendOutcome 3종 중 남는 건
    // 'failed'뿐이다 — TS 판별 유니온 좁히기를 위해 한 번 더 명시한다.
    if (result.outcome !== 'failed') return

    const next = recordFailedRetry(item, result.errorClass)
    this.replace(next)
    if (next.status === 'pending') {
      this.schedule(clientMsgId, computeBackoffDelayMs(next.retryCount + 1))
    }
  }

  private replace(next: QueuedMessage): void {
    this.queue = this.queue.map((m) => (m.clientMsgId === next.clientMsgId ? next : m))
    this.emit()
  }

  private emit(): void {
    this.deps.onQueueChange(this.queue)
  }
}
