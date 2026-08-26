/**
 * 오프라인 큐잉 + 멱등 재전송 판단 — 순수 함수만 모아둔다.
 *
 * 근거: 작업 지시 "완료 기준 2" — 메시지 전송 시 클라이언트가
 * `client_msg_id`(uuid)를 생성해 매 재시도마다 동일 값으로 insert를
 * 시도하고, `uq_messages_client_id` 유니크 제약 위반(Postgres 23505)이
 * 나면 "이미 전송됨"으로 간주해 에러를 삼킨다(중복이 아니라 성공 처리).
 *
 * 이 파일은 실제 네트워크 호출(`src/services/chatApi.ts`)이나 React
 * 상태(`src/hooks/useRealtimeMessages.ts`)를 전혀 모른다 — "이 결과라면
 * 큐에서 빼야 하는가"라는 판단만 순수하게 뽑아내 테스트 가능하게 한다.
 */

/** 서버로 아직 확정되지 않은, 큐에 대기 중인 발신 메시지 1건. */
export interface OutgoingMessage {
  clientMsgId: string
  coupleId: string
  senderId: string
  body: string
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
export function enqueueOutgoing(
  queue: OutgoingMessage[],
  message: OutgoingMessage,
): OutgoingMessage[] {
  if (queue.some((m) => m.clientMsgId === message.clientMsgId)) return queue
  return [...queue, message]
}

/** `clientMsgId`로 큐에서 제거한다. 없으면 원본 배열을 그대로 반환한다. */
export function dequeueOutgoing(
  queue: OutgoingMessage[],
  clientMsgId: string,
): OutgoingMessage[] {
  if (!queue.some((m) => m.clientMsgId === clientMsgId)) return queue
  return queue.filter((m) => m.clientMsgId !== clientMsgId)
}
