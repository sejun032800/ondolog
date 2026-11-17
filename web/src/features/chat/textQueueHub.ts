/**
 * 글(텍스트) 전송 큐 허브(RN `services/chatQueueHub.ts`의 글 쪽 웹판, R39-5). 사진 큐(`photoQueue/photoQueueHub.ts`) 옆에 두는 짝이다.
 *
 * 행동은 RN 그대로이고 규칙 파일은 루트 것을 가져다 쓴다 - 재시도 러너 `@/utils/chatRetryQueue`(백오프 2s -> 32s · 5회 · 영구 실패는 즉시 멈춤 · 같은 항목 겹침 0),
 * 순수 규칙 `@/utils/chatQueue`(멱등 재전송 = 같은 `client_msg_id`로 다시 넣고 23505는 "이미 전송"), 한 번의 전송 `@/services/chatCore`의 `sendMessage`(빈 본문 거부 R21-5).
 *  - 오프라인이면 큐에 쌓고, 돌아오면 순서대로 보낸다. 같은 메시지는 한 번만 간다(`client_msg_id`).
 *  - 기기 저장: Preferences `chat_queue:{coupleId}`(RN AsyncStorage와 같은 키). 로그인 이후 구간이라 영속 저장이 허용된다. 읽기 · 쓰기 실패는 던지지 않는다.
 *  - 커플이 아니거나 로그아웃이면 `detach` - 타이머만 멈춘다. **기기 저장은 지우지 않는다**(다음 로그인에 이어 간다).
 *  - 같은 (커플, 사용자)로 `attach`를 여러 번 불러도 큐는 하나다.
 */
import { Preferences } from '@capacitor/preferences'
import { sendMessage, type ChatDb, type MessageRow, type SendInput, type SendMessageResult } from '@/services/chatCore'
import { chatQueueStorageKey, type OutgoingMessage, type QueuedMessage } from '@/utils/chatQueue'
import { loadQueue, saveQueue, type PrefsLike } from '../../cache/queueStorage'
import { convertTextItem } from '../../cache/queueShapes'
import { ChatRetryQueue, type AttemptOutcome } from '@/utils/chatRetryQueue'
import { getSupabase } from '../../auth/client'
import { reportAppError } from '../../errorLog/errorLog'
import { makeGiveUpTracker } from '../../errorLog/errorLogRules'

export interface TextQueueListener {
  /** 서버가 확정한 메시지 행. */
  onMessage?: (row: MessageRow) => void
  onTextQueue?: (queue: QueuedMessage[]) => void
}

export interface TextQueueStore {
  /** `userId`(81-): 변환하지 못한 원본을 보존할 칸의 주인. */
  load: (coupleId: string, userId?: string) => Promise<QueuedMessage[]>
  save: (coupleId: string, queue: QueuedMessage[]) => Promise<void>
}

/** 81-(R117-2): 저장 모양 버전 · 옛 모양 변환 · 변환 불가 원본 보존(`cache/queueStorage`). 버리지 않는다. */
export function createTextQueueStore(prefs: PrefsLike = Preferences, now: () => Date = () => new Date()): TextQueueStore {
  return {
    load: (coupleId, userId) => loadQueue(prefs, chatQueueStorageKey(coupleId), 'text', { coupleId, userId: userId ?? null, now: now() }, convertTextItem),
    save: (coupleId, queue) => saveQueue(prefs, chatQueueStorageKey(coupleId), queue),
  }
}

export const textQueueStore: TextQueueStore = createTextQueueStore()

export interface TextQueueHubDeps {
  /** 한 번의 전송. 던지지 않는 것이 규칙이다(`sendMessage`가 던지지 않고 결과로 돌려준다). */
  send: (input: SendInput) => Promise<SendMessageResult>
  store: TextQueueStore
}

export class TextQueueHub {
  private key: string | null = null
  private text: ChatRetryQueue | null = null
  private generation = 0
  private readonly listeners = new Set<TextQueueListener>()

  constructor(private readonly deps: TextQueueHubDeps) {}

  current(): { coupleId: string; userId: string } | null {
    if (!this.key) return null
    const [coupleId, userId] = this.key.split(':')
    return { coupleId, userId }
  }

  getTextQueue(): ChatRetryQueue | null {
    return this.text
  }

  subscribe(listener: TextQueueListener): () => void {
    this.listeners.add(listener)
    // 늦게 붙은 화면이 이미 있는 큐 상태를 따라잡는다.
    if (this.text) listener.onTextQueue?.(this.text.getQueue())
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 큐를 만들고 기기에서 읽은 항목을 이어서 보낸다. 같은 (커플, 사용자)이면 아무것도 하지 않는다. */
  attach(coupleId: string, userId: string): void {
    const key = `${coupleId}:${userId}`
    if (this.key === key) return
    this.detach()
    this.key = key
    const generation = ++this.generation
    const giveUps = makeGiveUpTracker()
    const text = new ChatRetryQueue({
      attemptSend: (item) => this.attemptText(item),
      onQueueChange: (queue) => {
        if (giveUps.observe(queue.map((q) => ({ id: q.clientMsgId, failed: q.status === 'failed' }))) > 0) reportAppError('queue_giveup')
        void this.deps.store.save(coupleId, queue)
        for (const l of this.listeners) l.onTextQueue?.(queue)
      },
    })
    this.text = text
    void this.deps.store.load(coupleId, userId).then((items) => {
      giveUps.prime(items.map((q) => ({ id: q.clientMsgId, failed: q.status === 'failed' })))
      if (generation === this.generation) text.hydrate(items)
    })
  }

  /** 큐를 멈춘다(타이머 정리). **기기 저장은 지우지 않는다.** */
  detach(): void {
    this.generation += 1
    this.text?.dispose()
    const had = this.text !== null
    this.text = null
    this.key = null
    if (had) for (const l of this.listeners) l.onTextQueue?.([])
  }

  /** 앱 복귀 신호 - 남은 항목을 바로 이어서 보낸다. 큐가 없으면 아무 일도 없다. 진행 중 항목은 건드리지 않는다. */
  kick(): void {
    this.text?.kick()
  }

  /** 글 한 번 전송(최초 시도와 큐 재시도가 공유) - 확정 행은 화면에 알린다. */
  async attemptText(item: OutgoingMessage): Promise<AttemptOutcome> {
    const result = await this.deps.send(item)
    if (result.status === 'sent') {
      for (const l of this.listeners) l.onMessage?.(result.row)
      return { outcome: 'sent' }
    }
    if (result.status === 'already_sent') {
      const row = result.row
      if (row) for (const l of this.listeners) l.onMessage?.(row)
      return { outcome: 'already_sent' }
    }
    return { outcome: 'failed', errorClass: result.errorClass }
  }
}

/** 앱의 허브 하나. 서버는 웹 클라이언트, 저장은 Preferences. */
export const textQueueHub = new TextQueueHub({
  send: async (input) => {
    const db = getSupabase()
    // 클라이언트가 없으면(설정 비어 있음) 서버에 갈 수 없다 - 일시 실패로 큐에 남는다.
    if (!db) return { status: 'failed', errorClass: 'retryable', error: new Error('no_client') }
    return sendMessage(db as unknown as ChatDb, input)
  },
  store: textQueueStore,
})
