/**
 * 채팅 메시지 목록에 대한 순수 함수 — 병합(중복 제거)/정렬/읽음 대상
 * 판단/날짜 구분.
 *
 * 근거: 작업 지시 "완료 기준 1" — "로컬 낙관적 추가 + 구독 이벤트 병합
 * 시 중복 렌더링 없이". `mergeMessage`가 이 계약의 핵심이다: 낙관적으로
 * 추가한 로컬 메시지(임시 id, `clientMsgId`만 확정)와 서버가 확정한
 * 행(실제 id, 동일 `clientMsgId`)이 같은 메시지로 취급돼 하나로
 * 합쳐져야 한다.
 *
 * "완료 기준 3" — 읽음 갱신은 발신자 자신의 메시지를 제외해야 한다
 * (`docs/ONDOLOG_SCHEMA.md` §7: `messages_update` RLS가 발신자 제한을
 * 두지 않아 앱 로직에서 지켜야 하는 계약). `pickUnreadFromPartner`가
 * 그 판단을 순수 함수로 뽑아낸 것 — "쿼리를 보낼 가치가 있는 미확인
 * 메시지가 있는가"만 여기서 판단하고, 실제 UPDATE는
 * `src/services/chatApi.ts`가 `sender_id`로 다시 한 번 필터링한다(이중
 * 방어).
 */
import type { Database } from '../types/database'
import type { QueuedMessage } from './chatQueue'

type MessageRow = Database['public']['Tables']['messages']['Row']

export interface ChatMessage {
  /** 서버 확정 전에는 `local:${clientMsgId}` 형태의 임시 id를 쓴다. */
  id: string
  clientMsgId: string | null
  coupleId: string
  senderId: string
  body: string | null
  mediaPath: string | null
  sentAt: string
  readAt: string | null
  /** true면 전송 중(낙관적 로컬 항목 또는 재시도 큐 대기 중) — §13-3 "전송 중". */
  pending?: boolean
  /** true면 재시도 소진 또는 영구 실패로 자동 재시도가 멈춘 상태 — §13-3 "전송 실패". */
  failed?: boolean
  /**
   * 내가 방금 고른 사진의 기기 안 주소(서버 확정 전의 사진 말풍선). 서버 행에는 없다.
   * 텍스트 오프라인 큐와 무관한 이 세션 메모리 값이라, 큐 동기화가 이 항목을 지우지 않는다.
   */
  localUri?: string | null
}

/**
 * 본문이 비었거나 공백뿐인지. **보내기 막음의 단 하나의 규칙**이다 - 화면(보내기 버튼)·훅(`sendText`)·API(`chatApi.sendMessage`)가
 * 모두 이 함수를 쓴다(R21-5). 생성 단계(R20-1)가 빼는 기준과 같다: 비었거나 공백뿐인 본문만.
 */
export function isBlankBody(body: string | null | undefined): boolean {
  return body == null || body.trim().length === 0
}

/** 보낼 수 있는 메시지인가: 사진이 있거나, 본문이 공백뿐이 아니다. */
export function canSendBody(body: string | null | undefined, hasMedia = false): boolean {
  return hasMedia || !isBlankBody(body)
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 날짜 구분선 글자 - "10월 20일 화요일"(올해), 다른 해는 "2025년 10월 20일 월요일". `dateKey`는 `YYYY-MM-DD`(기기 로컬 날짜). */
export function chatDateLabel(dateKey: string, currentYear: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekday = WEEKDAY_KO[new Date(y, m - 1, d).getDay()]
  const core = `${m}월 ${d}일 ${weekday}요일`
  return y === currentYear ? core : `${y}년 ${core}`
}

/** 스토리 올린 뒤 지난 시간 "방금" / "N분 전" / "N시간 전"(스토리는 24시간만 보여 일 단위가 없다). */
export function relativeAgeLabel(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}

/** 말풍선 옆 시각 "09:20"(기기 로컬, 24시간). */
export function chatTimeLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** 사진 크게 보기 머리의 "10월 20일 12:34"(기기 로컬). */
export function photoStampLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${chatTimeLabel(iso)}`
}

export function rowToChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    clientMsgId: row.client_msg_id,
    coupleId: row.couple_id,
    senderId: row.sender_id,
    body: row.body,
    mediaPath: row.media_path,
    sentAt: row.sent_at,
    readAt: row.read_at,
    pending: false,
  }
}

/** sentAt 오름차순, 동률이면 id로 2차 정렬(결정론적 순서). */
export function sortMessagesBySentAt(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    const bySentAt = a.sentAt.localeCompare(b.sentAt)
    if (bySentAt !== 0) return bySentAt
    return a.id.localeCompare(b.id)
  })
}

/**
 * `incoming`을 리스트에 병합한다. 아래 순서로 "같은 메시지"를 찾는다:
 *   1) id가 같다 (예: 이미 확정된 행에 read_at UPDATE가 온 경우)
 *   2) clientMsgId가 같다 (예: 낙관적 로컬 항목 ↔ 서버 확정 행 — id는
 *      다르지만 같은 발신 시도다)
 * 못 찾으면 새 항목으로 추가한다. 결과는 항상 sentAt 순으로 정렬된 채
 * 반환한다.
 */
export function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = list.findIndex(
    (m) =>
      m.id === incoming.id ||
      (incoming.clientMsgId !== null && m.clientMsgId === incoming.clientMsgId),
  )
  if (idx === -1) {
    return sortMessagesBySentAt([...list, incoming])
  }
  const next = [...list]
  next[idx] = incoming
  return sortMessagesBySentAt(next)
}

export function mergeMessages(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return incoming.reduce(mergeMessage, list)
}

/** 오프라인 큐 항목을 화면에 그릴 말풍선으로 바꾼다 — `sentAt`을 그대로 물려받아 낙관적 말풍선과 같은 자리(같은 날짜 그룹)에 복원된다. */
export function queuedMessageToChatMessage(item: QueuedMessage): ChatMessage {
  return {
    id: `local:${item.clientMsgId}`,
    clientMsgId: item.clientMsgId,
    coupleId: item.coupleId,
    senderId: item.senderId,
    body: item.body,
    mediaPath: null,
    sentAt: item.sentAt,
    readAt: null,
    pending: item.status === 'pending',
    failed: item.status === 'failed',
  }
}

/**
 * 오프라인 큐 상태를 메시지 목록에 반영한다.
 *   1) 큐에 있는 항목은 병합(추가 또는 갱신)한다.
 *   2) 아직 서버 확정 전(pending/failed)인데 큐에서는 사라진 로컬 항목은
 *      제거한다 — "말풍선 길게 누르기 → 전송 취소, 큐와 화면에서 제거"
 *      완료 기준이 여기서 성립한다. 이미 서버가 확정한 메시지
 *      (`pending`도 `failed`도 아님)는 큐와 무관하게 항상 유지한다.
 */
export function syncQueuedMessages(list: ChatMessage[], queue: QueuedMessage[]): ChatMessage[] {
  const queuedIds = new Set(queue.map((item) => item.clientMsgId))
  const withoutCancelled = list.filter((m) => {
    if (!m.pending && !m.failed) return true
    if (!m.clientMsgId) return true
    if (m.localUri) return true // 사진 말풍선은 이 세션 메모리 작업이라 텍스트 큐와 무관하다
    return queuedIds.has(m.clientMsgId)
  })
  return mergeMessages(withoutCancelled, queue.map(queuedMessageToChatMessage))
}

/**
 * "상대가 보낸, 아직 안 읽은" 메시지의 id만 뽑는다. 내가 보낸 메시지는
 * 애초에 대상에서 제외한다(읽음은 수신자만 갱신 — 위 docblock 참조).
 * 아직 서버에 확정되지 않은(pending) 항목은 id가 임시값이라 대상에서
 * 제외한다.
 */
export function pickUnreadFromPartner(list: ChatMessage[], currentUserId: string): string[] {
  return list
    .filter((m) => m.senderId !== currentUserId && m.readAt === null && !m.pending)
    .map((m) => m.id)
}

export interface MessageDateGroup {
  dateKey: string
  label: string
  messages: ChatMessage[]
}

/**
 * 기기 로컬 타임존 기준 날짜 키(YYYY-MM-DD)를 만든다. `ChatBubble`의
 * `formatTime`이 `new Date(iso).getHours()`로 로컬 시각을 보여주는 것과
 * 기준을 맞추기 위함이다 — UTC 문자열을 그대로 slice하면(과거 구현)
 * KST 자정~오전 9시(UTC 15:00~24:00)에 온 메시지가 날짜 구분선은
 * 하루 전으로, 시각은 "오전 X시"로 표시돼 서로 모순돼 보였다
 * (2026-08-26 코디네이터 리뷰에서 발견).
 */
function dateKeyOf(sentAt: string): string {
  const d = new Date(sentAt)
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

/** §13-3 "날짜 구분 | 가운데 hairline + caption" — 날짜별로 묶는다. */
export function groupMessagesByDate(list: ChatMessage[]): MessageDateGroup[] {
  const sorted = sortMessagesBySentAt(list)
  const groups: MessageDateGroup[] = []
  for (const message of sorted) {
    const dateKey = dateKeyOf(message.sentAt)
    const last = groups[groups.length - 1]
    if (last && last.dateKey === dateKey) {
      last.messages.push(message)
    } else {
      groups.push({ dateKey, label: formatDateLabel(dateKey), messages: [message] })
    }
  }
  return groups
}
