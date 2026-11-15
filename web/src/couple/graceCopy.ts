/**
 * 유예 중 초대 · 연결 거부(75-m1 서버 규칙, A-24)의 오류 코드 -> 안내 문구.
 *  - `OG001`: 해제 유예 중인 커플의 구성원(본인 또는 초대한 사람) - 기존 문구.
 *  - `OG002`: 탈퇴 유예 중인 계정(본인 또는 초대한 사람) - 새 문구(R94-9 잠정, `51-` 녹화로 PM 확정). 탈퇴 사실을 상대에게 드러내지 않도록 중립적으로 쓴다.
 * 코드는 초대 발급(`couples` insert 오류의 `code`)과 연결(`ConnectCoupleError.code`) 모두 같은 값이다.
 */
export const GRACE_NO_INVITE = '해제 예정 기간에는 새로 연결할 수 없어요'
export const WITHDRAWAL_NO_CONNECT = '지금은 연결할 수 없는 계정이에요'

export const GRACE_ERROR_CODES = { dissolution: 'OG001', withdrawal: 'OG002' } as const

/** 유예 거부 코드면 문구, 아니면 null. */
export function graceMessageForCode(code: unknown): string | null {
  if (code === GRACE_ERROR_CODES.dissolution) return GRACE_NO_INVITE
  if (code === GRACE_ERROR_CODES.withdrawal) return WITHDRAWAL_NO_CONNECT
  return null
}
