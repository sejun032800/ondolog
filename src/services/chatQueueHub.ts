/**
 * 채팅 큐 허브 - 텍스트 큐와 사진 큐가 **한 곳에서** 만들어지고 재개된다(R39-5).
 *
 * 전에는 큐가 채팅 탭 훅 안에서만 살아서, 탭을 열지 않으면 남은 글 · 사진이 앱을 켜도 안 나갔다. 이제 큐 인스턴스는 이 허브가 갖는다:
 *   - 앱 시작(로그인 + 커플 확인 직후)과 앱 복귀(AppState `active`)는 `useChatQueueResume`(루트)이 `attach` · `kick`으로 부른다.
 *   - 채팅 탭 훅도 같은 `attach`를 부른다 - 같은 (커플, 사용자)이면 아무 일도 하지 않는다. 그래서 같은 항목이 두 번 올라가지 않는다
 *     (각 큐의 `inflight`가 같은 항목의 겹친 시도를 막는다).
 *   - 커플이 아니거나 로그아웃이면 `detach` - 타이머만 멈춘다. **기기 저장은 지우지 않는다**(사용자 키 그대로, 다음 로그인에 이어 간다).
 * 화면(채팅 탭)은 `subscribe`로 확정 행 · 큐 변화를 받는다. 탭이 안 떠 있어도 큐는 돌고 저장은 갱신된다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  attemptQueuedPhoto,
  sendMessage as apiSendMessage,
  type MessageRow,
  type StoryRow,
} from './chatApi'
import { photoQueueFs } from './photoQueueFs'
import { loadPhotoQueue, savePhotoQueue } from './photoQueueStore'
import type { QueuedPhoto } from '../utils/chatPhotoQueue'
import { ChatPhotoQueue } from '../utils/chatPhotoQueueRunner'
import { chatQueueStorageKey, parseQueuedMessages, type OutgoingMessage, type QueuedMessage } from '../utils/chatQueue'
import { ChatRetryQueue, type AttemptOutcome } from '../utils/chatRetryQueue'

export interface ChatQueueListener {
  /** 서버가 확정한 메시지 행(텍스트 · 사진). */
  onMessage?: (row: MessageRow) => void
  onStory?: (row: StoryRow) => void
  onTextQueue?: (queue: QueuedMessage[]) => void
  onPhotoQueue?: (items: QueuedPhoto[]) => void
  /** 복사본이 사라져 큐에서 빠진 사진. */
  onPhotoLost?: (item: QueuedPhoto) => void
}

export class ChatQueueHub {
  private key: string | null = null
  private text: ChatRetryQueue | null = null
  private photo: ChatPhotoQueue | null = null
  private generation = 0
  private readonly listeners = new Set<ChatQueueListener>()

  /** 지금 큐가 도는 (커플, 사용자). 없으면 null. */
  current(): { coupleId: string; userId: string } | null {
    if (!this.key) return null
    const [coupleId, userId] = this.key.split(':')
    return { coupleId, userId }
  }

  getTextQueue(): ChatRetryQueue | null {
    return this.text
  }

  getPhotoQueue(): ChatPhotoQueue | null {
    return this.photo
  }

  subscribe(listener: ChatQueueListener): () => void {
    this.listeners.add(listener)
    // 늦게 붙은 화면이 이미 있는 큐 상태를 따라잡는다.
    if (this.text) listener.onTextQueue?.(this.text.getQueue())
    if (this.photo) listener.onPhotoQueue?.(this.photo.getQueue())
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

    const textKey = chatQueueStorageKey(coupleId)
    const text = new ChatRetryQueue({
      attemptSend: (item) => this.attemptText(item),
      onQueueChange: (queue) => {
        AsyncStorage.setItem(textKey, JSON.stringify(queue)).catch(() => {
          // 저장 실패해도 이번 세션 메모리 큐는 계속 동작한다 - 다음 변경 때 다시 저장한다.
        })
        for (const l of this.listeners) l.onTextQueue?.(queue)
      },
    })
    this.text = text

    const photo = new ChatPhotoQueue({
      attempt: async (item) => {
        const result = await attemptQueuedPhoto(item)
        if (result.outcome === 'done') {
          if (result.message) for (const l of this.listeners) l.onMessage?.(result.message)
          if (result.story) for (const l of this.listeners) l.onStory?.(result.story)
        }
        return result
      },
      onChange: (items) => {
        void savePhotoQueue(coupleId, userId, items)
        for (const l of this.listeners) l.onPhotoQueue?.(items)
      },
      discard: (item) => {
        void photoQueueFs.remove(item.localUri)
      },
      onLost: (item) => {
        for (const l of this.listeners) l.onPhotoLost?.(item)
      },
    })
    this.photo = photo

    AsyncStorage.getItem(textKey)
      .then((raw) => {
        if (generation === this.generation) text.hydrate(parseQueuedMessages(raw))
      })
      .catch(() => {
        // 복원 읽기가 실패해도 이미 만들어진 빈 큐로 계속 동작한다.
      })
    void loadPhotoQueue(coupleId, userId).then((items) => {
      if (generation === this.generation) photo.hydrate(items)
    })
  }

  /** 큐를 멈춘다(타이머 정리). **기기 저장은 지우지 않는다.** */
  detach(): void {
    this.generation += 1
    this.text?.dispose()
    this.photo?.dispose()
    const had = this.text !== null
    this.text = null
    this.photo = null
    this.key = null
    if (had) {
      for (const l of this.listeners) {
        l.onTextQueue?.([])
        l.onPhotoQueue?.([])
      }
    }
  }

  /** 앱 복귀 신호 - 남은 항목을 바로 이어서 보낸다. 큐가 없으면(커플 아님 · 로그아웃) 아무 일도 없다. 진행 중 항목은 건드리지 않는다. */
  kick(): void {
    this.text?.kick()
    this.photo?.kick()
  }

  /** 텍스트 한 번 전송(최초 시도와 큐 재시도가 공유) - 확정 행은 화면에 알린다. */
  async attemptText(item: OutgoingMessage): Promise<AttemptOutcome> {
    const result = await apiSendMessage(item)
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

export const chatQueueHub = new ChatQueueHub()
