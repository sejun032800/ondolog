/**
 * 사진(메시지 · 스토리) 영속 큐의 순수 규칙 - R37-2, MASTER 9-3 오프라인 규칙.
 *
 * 텍스트 큐(`chatQueue.ts`)와 같은 정책(최대 5회 · 2s -> 32s 백오프 · 영구 실패는 즉시 failed)을 쓴다. 큐 항목은 **고른 사진의 복사본 경로**를
 * 가진다 - 앱 문서 폴더에 복사해 둬서 앱이 꺼지고 임시 파일이 지워져도 이어서 보낼 수 있다. 항목 저장은 AsyncStorage
 * (`chat_photo_queue:{coupleId}:{userId}`) - 채팅용이라 온보딩 답을 영속 저장소에 두지 않는 규칙 11과 무관하다.
 *
 * 항목의 `clientId`가 **모든 것의 열쇠**다: 업로드 경로(`{couple_id}/{clientId}.{ext}`)가 여기서 정해지므로 다시 보내도 Storage 객체는 하나이고,
 * 메시지는 `client_msg_id = clientId`로 멱등 삽입(23505 = 이미 전송), 스토리는 같은 경로의 행이 이미 있으면 넣지 않는다(`chatPhotoCore.ts`).
 * 이 파일은 네트워크·파일·React를 모른다.
 */
import type { ChatMessage } from './chatMessages'
import { MAX_RETRY_COUNT, type SendErrorClass } from './chatQueue'

export type QueuedPhotoKind = 'message' | 'story'

export interface QueuedPhoto {
  /** 클라이언트가 만든 uuid. 메시지는 `client_msg_id`, 스토리는 업로드 경로의 파일 이름이 된다. */
  clientId: string
  kind: QueuedPhotoKind
  coupleId: string
  /** 보낸 사람(메시지 `sender_id` · 스토리 `author_id`). */
  userId: string
  /** 앱 문서 폴더에 복사해 둔 파일의 주소. */
  localUri: string
  ext: string
  contentType: string
  /** 사진을 고른 시각(ISO) - 말풍선 자리(같은 날짜 그룹)를 정한다. 서버에는 보내지 않는다. */
  sentAt: string
  retryCount: number
  status: 'pending' | 'failed'
}

/** 한 번의 시도 결과. */
export type PhotoAttemptOutcome =
  /** 올렸고 행도 있다(이미 있던 것 포함). */
  | 'done'
  /** 일시 실패 - 백오프로 다시. */
  | 'retry'
  /** 영구 실패(권한 거부 등) - 사람이 다시 보내기를 누를 때까지 멈춘다. */
  | 'failed'
  /** 복사본이 사라졌다(저장공간을 비움 등) - 다시 보낼 수 없다. 큐에서 뺀다. */
  | 'lost'

export function chatPhotoQueueKey(coupleId: string, userId: string): string {
  return `chat_photo_queue:${coupleId}:${userId}`
}

function isQueuedPhoto(value: unknown): value is QueuedPhoto {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.clientId === 'string' &&
    (v.kind === 'message' || v.kind === 'story') &&
    typeof v.coupleId === 'string' &&
    typeof v.userId === 'string' &&
    typeof v.localUri === 'string' &&
    typeof v.ext === 'string' &&
    typeof v.contentType === 'string' &&
    typeof v.sentAt === 'string' &&
    typeof v.retryCount === 'number' &&
    (v.status === 'pending' || v.status === 'failed')
  )
}

/** 저장된 원문을 큐로 되돌린다. 깨져 있으면 던지지 않고 빈 큐(복원 실패가 채팅 전체의 크래시로 번지지 않게). */
export function parseQueuedPhotos(raw: string | null | undefined): QueuedPhoto[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isQueuedPhoto)
  } catch {
    return []
  }
}

/** 같은 `clientId`가 이미 있으면 추가하지 않는다(중복 큐잉 방지). */
export function enqueuePhoto(queue: QueuedPhoto[], item: QueuedPhoto): QueuedPhoto[] {
  if (queue.some((q) => q.clientId === item.clientId)) return queue
  return [...queue, item]
}

export function dequeuePhoto(queue: QueuedPhoto[], clientId: string): QueuedPhoto[] {
  if (!queue.some((q) => q.clientId === clientId)) return queue
  return queue.filter((q) => q.clientId !== clientId)
}

/** 일시 실패 뒤 다음 상태 - 영구 실패는 즉시 failed, 일시 실패는 횟수를 올려 `MAX_RETRY_COUNT`에서 failed. */
export function recordPhotoFailure(item: QueuedPhoto, errorClass: SendErrorClass): QueuedPhoto {
  if (errorClass === 'permanent') return { ...item, status: 'failed' }
  const retryCount = item.retryCount + 1
  return { ...item, retryCount, status: retryCount >= MAX_RETRY_COUNT ? 'failed' : 'pending' }
}

export function resetPhotoForRetry(item: QueuedPhoto): QueuedPhoto {
  return { ...item, retryCount: 0, status: 'pending' }
}

/**
 * 앱을 다시 열어 복원할 때의 상태. 메시지는 그대로(failed는 말풍선의 [다시 보내기]가 맡는다).
 * 스토리는 [다시 보내기] 화면이 없어서, 멈춰 있던 항목도 앱을 열 때 한 번 다시 시도하게 pending으로 돌린다.
 */
export function restoreForStart(items: QueuedPhoto[]): QueuedPhoto[] {
  return items.map((item) => (item.kind === 'story' && item.status === 'failed' ? resetPhotoForRetry(item) : item))
}

/** 올리기(Storage) 오류의 재시도 여부. 인증·권한·크기·형식 거부(4xx)는 다시 해도 같아서 영구, 나머지(네트워크 · 5xx)는 일시. */
export function classifyUploadError(error: unknown): SendErrorClass {
  const status = Number((error as { statusCode?: string | number } | null)?.statusCode)
  if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) return 'permanent'
  return 'retryable'
}

/** 큐의 사진 메시지를 화면에 그릴 말풍선으로. 서버 행이 오면 같은 `clientMsgId`로 하나로 합쳐진다. */
export function photoItemToChatMessage(item: QueuedPhoto): ChatMessage {
  return {
    id: `local:${item.clientId}`,
    clientMsgId: item.clientId,
    coupleId: item.coupleId,
    senderId: item.userId,
    body: null,
    mediaPath: null,
    sentAt: item.sentAt,
    readAt: null,
    pending: item.status === 'pending',
    failed: item.status === 'failed',
    localUri: item.localUri,
  }
}

/**
 * 큐의 사진 메시지를 메시지 목록에 반영한다(추가 또는 갱신). 이미 서버가 확정한 행(`pending`도 `failed`도 아님)은 건드리지 않는다 -
 * 올라간 직후 큐에서 빠지기 전에 도착한 확정 행이 로컬 말풍선으로 되돌아가면 안 된다.
 */
export function syncPhotoMessages(list: ChatMessage[], queue: QueuedPhoto[]): ChatMessage[] {
  let next = list
  for (const item of queue) {
    if (item.kind !== 'message') continue
    const existing = next.find((m) => m.clientMsgId === item.clientId)
    if (existing && !existing.pending && !existing.failed) continue
    const bubble = photoItemToChatMessage(item)
    next = existing
      ? next.map((m) => (m.clientMsgId === item.clientId ? bubble : m))
      : [...next, bubble].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id))
  }
  return next
}
