/**
 * 오프라인 큐잉 + 재시도 정책 + 멱등 재전송 판단 — 순수 함수만 모아둔다.
 *
 * 근거: 작업 지시 "채팅 전송 큐를 보완해주세요" — 완료 기준 2("메시지
 * 전송 시 클라이언트가 `client_msg_id`(uuid)를 생성해 매 재시도마다
 * 동일 값으로 insert를 시도하고, `uq_messages_client_id` 유니크 제약
 * 위반(Postgres 23505)이 나면 "이미 전송됨"으로 간주해 에러를 삼킨다")과
 * "2. 재시도 정책"(최대 5회, 지수 백오프 2s→4s→8s→16s→32s, 소진 시
 * failed 전환·자동 재시도 중단, 에러 유형별 분기).
 *
 * 이 파일은 실제 네트워크 호출(`src/services/chatApi.ts`)이나 React
 * 상태·타이머(`src/utils/chatRetryQueue.ts`, `src/hooks/useRealtimeMessages.ts`)를
 * 전혀 모른다 — "이 결과라면 큐를 어떻게 바꿔야 하는가"라는 판단만
 * 순수하게 뽑아내 테스트 가능하게 한다.
 */

/** 서버로 보낼(또는 보내려 시도했던) 발신 메시지 1건의 불변 내용. */
export interface OutgoingMessage {
  clientMsgId: string
  coupleId: string
  senderId: string
  body: string
  /**
   * 사용자가 전송을 누른 시각(ISO). 서버에 전송하는 필드가 아니다
   * (서버는 `sent_at`을 자체적으로 채운다) — 낙관적 말풍선과 큐 복원 후
   * 재구성되는 말풍선이 같은 시각/같은 날짜 그룹에 놓이게 하기 위한
   * 화면 표시 전용 값이다.
   */
  sentAt: string
}

/** `src/services/chatApi.ts`의 전송 시도 결과 3종. */
export type SendOutcome = 'sent' | 'already_sent' | 'failed'

/** Postgres 유니크 제약 위반(23505) 여부 — "이미 전송됨"의 판정 기준. */
export function isDuplicateInsertError(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === '23505'
}

/**
 * 전송 시도 결과에 따라 이 항목을 큐에서 제거해야 하는지 판단한다.
 * 'sent'(정상 성공)와 'already_sent'(중복 판정 — 과거 시도가 이미
 * 성공했다는 뜻)는 둘 다 "더 이상 재시도할 필요 없음"으로 취급한다.
 * 'failed'(네트워크 등 그 외 에러)만 큐에 남겨 다음 재시도 대상으로 삼는다.
 */
export function shouldDequeueAfterSendOutcome(outcome: SendOutcome): boolean {
  return outcome === 'sent' || outcome === 'already_sent'
}

/** 동일 `clientMsgId`가 이미 큐에 있으면 추가하지 않는다(중복 큐잉 방지). */
export function enqueueOutgoing<T extends { clientMsgId: string }>(queue: T[], message: T): T[] {
  if (queue.some((m) => m.clientMsgId === message.clientMsgId)) return queue
  return [...queue, message]
}

/** `clientMsgId`로 큐에서 제거한다. 없으면 원본 배열을 그대로 반환한다. */
export function dequeueOutgoing<T extends { clientMsgId: string }>(
  queue: T[],
  clientMsgId: string,
): T[] {
  if (!queue.some((m) => m.clientMsgId === clientMsgId)) return queue
  return queue.filter((m) => m.clientMsgId !== clientMsgId)
}

// ── 재시도 정책 ───────────────────────────────────────────────

/** "완료 기준: 5회 소진 후 failed로 전환" — 최대 재시도 횟수. */
export const MAX_RETRY_COUNT = 5

const BACKOFF_BASE_MS = 2000

/**
 * 큐에 실제로 영속화되는 발신 메시지 1건 — 원본 내용(`OutgoingMessage`) +
 * 재시도 진행 상태.
 */
export interface QueuedMessage extends OutgoingMessage {
  /** 지금까지 소진한 재시도 횟수(재전송 시도 자체가 아니라 "재시도"만 센다). 0 = 아직 재시도 안 함. */
  retryCount: number
  /** 'pending' = 재시도 대기/진행 중(자동 재시도 계속). 'failed' = 소진 또는 영구 실패(자동 재시도 중단). */
  status: 'pending' | 'failed'
}

/** 재시도해서 해결될 여지가 있는 오류인지, 다시 시도해도 똑같이 실패할 오류인지. */
export type SendErrorClass = 'retryable' | 'permanent'

/**
 * Postgres/PostgREST 에러 코드로 재시도 여부를 가른다(작업 지시
 * "에러 유형별 분기" 그대로).
 *
 *   - 코드 자체가 없음(fetch 실패, 타임아웃 등 네트워크 계층 오류) → 재시도
 *   - `42501`(insufficient_privilege, RLS 거부) → 즉시 실패
 *   - 에러 클래스 `08`(connection_exception) · `53`(insufficient_resources) ·
 *     `57`(operator_intervention) — PostgreSQL 공식 에러 코드 부록(Appendix A)의
 *     클래스 구분 그대로, 서버 쪽 일시 장애(5xx급)로 간주해 재시도
 *   - 그 외(제약 위반 `23xxx` 등 4xx급) → 즉시 실패
 *
 * `23505`(중복 삽입)는 이 함수에 도달하기 전에 `isDuplicateInsertError`가
 * "already_sent"로 먼저 처리하므로 여기서는 다루지 않는다(도달해도
 * `23`이 위 재시도 클래스에 없어 안전하게 permanent로 떨어진다).
 */
export function classifySendError(
  error: { code?: string | null } | null | undefined,
): SendErrorClass {
  const code = error?.code
  if (!code) return 'retryable'
  if (code === '42501') return 'permanent'
  const errorClass = code.slice(0, 2)
  if (errorClass === '08' || errorClass === '53' || errorClass === '57') return 'retryable'
  return 'permanent'
}

/**
 * N번째(1-based) 재시도 전에 대기할 시간 — 2s→4s→8s→16s→32s.
 * N=1일 때 2000ms, 이후 매번 2배.
 */
export function computeBackoffDelayMs(retryAttemptNumber: number): number {
  return BACKOFF_BASE_MS * 2 ** (retryAttemptNumber - 1)
}

/** 다음(아직 소진하지 않은) 재시도 전에 대기할 시간 — 스케줄링 시점에 호출한다. */
export function nextRetryDelayMs(item: QueuedMessage): number {
  return computeBackoffDelayMs(item.retryCount + 1)
}

/** 최초 전송 시도(큐 밖에서 실행됨)가 실패한 직후 큐 항목을 만든다. */
export function toQueuedMessage(message: OutgoingMessage, errorClass: SendErrorClass): QueuedMessage {
  return { ...message, retryCount: 0, status: errorClass === 'permanent' ? 'failed' : 'pending' }
}

/**
 * 큐에 있는 항목의 재시도 시도가 실패한 뒤 다음 상태를 계산한다.
 * permanent면 재시도 횟수와 무관하게 즉시 failed(완료 기준: "RLS 거부 시
 * 재시도 없이 즉시 failed"). retryable이면 재시도 횟수를 1 늘리고,
 * `MAX_RETRY_COUNT`에 도달했으면 failed로 전환해 자동 재시도를 멈춘다.
 */
export function recordFailedRetry(item: QueuedMessage, errorClass: SendErrorClass): QueuedMessage {
  if (errorClass === 'permanent') return { ...item, status: 'failed' }
  const retryCount = item.retryCount + 1
  return { ...item, retryCount, status: retryCount >= MAX_RETRY_COUNT ? 'failed' : 'pending' }
}

/** 사용자 "다시 시도" 탭 — 카운터를 리셋하고 즉시 재투입 가능한 상태로 되돌린다. */
export function resetForRetry(item: QueuedMessage): QueuedMessage {
  return { ...item, retryCount: 0, status: 'pending' }
}

// ── 영속화 ───────────────────────────────────────────────────

/** AsyncStorage 키 — 커플 단위로 큐를 분리한다. */
export function chatQueueStorageKey(coupleId: string): string {
  return `chat_queue:${coupleId}`
}

function isQueuedMessageShape(value: unknown): value is QueuedMessage {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.clientMsgId === 'string' &&
    typeof v.coupleId === 'string' &&
    typeof v.senderId === 'string' &&
    typeof v.body === 'string' &&
    typeof v.sentAt === 'string' &&
    typeof v.retryCount === 'number' &&
    (v.status === 'pending' || v.status === 'failed')
  )
}

/**
 * AsyncStorage에서 읽어온 원문을 안전하게 큐로 되돌린다. 형식이 깨져
 * 있거나(예: 앱 업데이트로 스키마가 바뀜) 파싱 자체가 실패해도 던지지
 * 않고 빈 큐를 반환한다 — 복원 실패가 곧 전송 기능 전체의 크래시로
 * 번지면 안 된다.
 */
export function parseQueuedMessages(raw: string | null | undefined): QueuedMessage[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isQueuedMessageShape)
  } catch {
    return []
  }
}
