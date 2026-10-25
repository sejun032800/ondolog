/**
 * 사진 영속 큐 러너 - 백오프 스케줄링(`setTimeout`)과 사용자 조작(다시 보내기 · 취소)을 맡는다(R37-2).
 *
 * `ChatRetryQueue`(텍스트)와 같은 모양이다. 실제 한 번의 시도(`attempt`), 항목이 큐에서 나갈 때 복사본을 지우는 일(`discard`),
 * 큐 변경 반영(`onChange` - 기기 저장 + 화면)은 생성자가 받는다. 그래서 fake timer로 백오프를, 가짜 `attempt`로 "끊겼다 다시 열기"를 결정론적으로
 * 시험한다. 같은 항목이 겹쳐 시도되지 않게 진행 중 표시(`inflight`)를 둔다 - 스토리는 "같은 경로의 행이 있으면 넣지 않기"가 조회 뒤 삽입이라
 * 같은 항목의 동시 시도가 있으면 두 행이 생길 수 있기 때문이다.
 */
import {
  computeBackoffDelayMs,
  type SendErrorClass,
} from './chatQueue'
import {
  dequeuePhoto,
  enqueuePhoto,
  recordPhotoFailure,
  resetPhotoForRetry,
  restoreForStart,
  type PhotoAttemptOutcome,
  type QueuedPhoto,
} from './chatPhotoQueue'

export interface PhotoAttemptResult {
  outcome: PhotoAttemptOutcome
  /** `retry`일 때의 오류 종류(생략하면 일시). `failed`는 늘 영구로 본다. */
  errorClass?: SendErrorClass
}

export interface ChatPhotoQueueDeps {
  /** 한 번의 시도(네트워크 · 파일). 던지지 않고 결과로 알린다. */
  attempt: (item: QueuedPhoto) => Promise<PhotoAttemptResult>
  /** 큐가 바뀔 때마다 - 기기 저장 + 화면 반영. */
  onChange: (queue: QueuedPhoto[]) => void
  /** 항목이 끝났거나(done) 사라졌거나(lost) 취소됐다 - 복사본을 지운다. 실패해도 던지지 않는다. */
  discard: (item: QueuedPhoto, reason: 'done' | 'lost' | 'cancelled') => void
  /** 복사본이 사라져 큐에서 뺐다(화면은 실패 표시로 보인다). */
  onLost?: (item: QueuedPhoto) => void
}

export class ChatPhotoQueue {
  private queue: QueuedPhoto[] = []
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly inflight = new Set<string>()

  constructor(private readonly deps: ChatPhotoQueueDeps) {}

  getQueue(): QueuedPhoto[] {
    return this.queue
  }

  has(clientId: string): boolean {
    return this.queue.some((q) => q.clientId === clientId)
  }

  /**
   * 앱을 열 때 기기에서 읽은 항목을 합친다. 이미 있는 `clientId`는 건드리지 않는다.
   * 대기(pending) 항목은 지연 없이 바로 이어서 보낸다.
   */
  hydrate(restored: QueuedPhoto[]): void {
    for (const item of restoreForStart(restored)) {
      if (this.has(item.clientId)) continue
      this.queue = enqueuePhoto(this.queue, item)
      if (item.status === 'pending') this.schedule(item.clientId, 0)
    }
    this.emit()
  }

  /** 새 항목을 넣고 **바로 한 번 시도**한다. 결과(`done` / `retry` / `failed` / `lost`)를 돌려준다 - 실패해도 큐에 남아 이어 시도한다. */
  async add(item: QueuedPhoto): Promise<PhotoAttemptOutcome> {
    this.queue = enqueuePhoto(this.queue, item)
    this.emit()
    return this.runAttempt(item.clientId, true)
  }

  /**
   * 앱 복귀 · 재개 신호 - 대기(pending) 항목을 기다리지 않고 바로 시도한다(R39-5). 진행 중(`inflight`)인 항목은 건드리지 않는다 -
   * 끝나면 그쪽이 다음 일을 잡는다(같은 항목 동시 업로드 0).
   */
  kick(): void {
    for (const item of this.queue) {
      if (item.status === 'pending' && !this.inflight.has(item.clientId)) this.schedule(item.clientId, 0)
    }
  }

  /** [다시 보내기] - 횟수를 0으로 돌리고 바로 시도한다. */
  retryNow(clientId: string): void {
    const item = this.queue.find((q) => q.clientId === clientId)
    if (!item) return
    this.replace(resetPhotoForRetry(item))
    this.schedule(clientId, 0)
  }

  /** 전송 취소 - 큐에서 빼고 복사본을 지운다. */
  cancel(clientId: string): void {
    const item = this.queue.find((q) => q.clientId === clientId)
    if (!item) return
    this.clearTimer(clientId)
    this.queue = dequeuePhoto(this.queue, clientId)
    this.emit()
    this.deps.discard(item, 'cancelled')
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }

  private schedule(clientId: string, delayMs: number): void {
    this.clearTimer(clientId)
    const timer = setTimeout(() => {
      this.timers.delete(clientId)
      void this.runAttempt(clientId)
    }, delayMs)
    this.timers.set(clientId, timer)
  }

  private clearTimer(clientId: string): void {
    const timer = this.timers.get(clientId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(clientId)
    }
  }

  /** `initial`이면 최초 시도다 - 텍스트 큐처럼 첫 실패는 재시도 횟수를 쓰지 않고 첫 백오프(2초)부터 시작한다. */
  private async runAttempt(clientId: string, initial = false): Promise<PhotoAttemptOutcome> {
    const item = this.queue.find((q) => q.clientId === clientId)
    if (!item || item.status !== 'pending') return 'failed'
    if (this.inflight.has(clientId)) return 'retry' // 이미 시도 중 - 끝나면 그쪽이 결과를 반영한다

    this.inflight.add(clientId)
    let result: PhotoAttemptResult
    try {
      result = await this.deps.attempt(item)
    } catch {
      result = { outcome: 'retry' }
    } finally {
      this.inflight.delete(clientId)
    }

    // 시도 중에 취소됐으면 아무것도 하지 않는다.
    if (!this.has(clientId)) return result.outcome

    if (result.outcome === 'done') {
      this.queue = dequeuePhoto(this.queue, clientId)
      this.emit()
      this.deps.discard(item, 'done')
      return 'done'
    }
    if (result.outcome === 'lost') {
      this.queue = dequeuePhoto(this.queue, clientId)
      this.emit()
      this.deps.discard(item, 'lost')
      this.deps.onLost?.(item)
      return 'lost'
    }

    const errorClass = result.outcome === 'failed' ? 'permanent' : (result.errorClass ?? 'retryable')
    const next = initial && errorClass === 'retryable' ? item : recordPhotoFailure(item, errorClass)
    this.replace(next)
    if (next.status === 'pending') this.schedule(clientId, computeBackoffDelayMs(next.retryCount + 1))
    return result.outcome
  }

  private replace(next: QueuedPhoto): void {
    this.queue = this.queue.map((q) => (q.clientId === next.clientId ? next : q))
    this.emit()
  }

  private emit(): void {
    this.deps.onChange(this.queue)
  }
}
