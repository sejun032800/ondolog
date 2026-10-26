/**
 * 커플 연결 - 026 `fn_connect_couple(p_invite_code text)` RPC 호출과 오류 문구 매핑 (SCHEMA 9-F, R40-2).
 *
 * 연결 칸(`user_b_id` · `status` · `connected_at`)은 이 함수만 쓴다 - 앱은 `couples`를 직접 UPDATE하지 않는다.
 * 저장소 클라이언트를 인자로 받아(`rpc`만 쓴다) 원격 실증 스크립트(Deno)가 사용자 세션으로 같은 함수를 부를 수 있다.
 *
 * 오류 코드(026 파일에서 읽음): 28000 비로그인 · P0002 없는/만료/이미 쓴 코드(구분 안 함) · 22023 자기 코드 · 23505 이미 커플.
 */

/** 026 함수 이름. */
export const CONNECT_COUPLE_FN = 'fn_connect_couple'

export type ConnectErrorKind = 'invalid' | 'own' | 'already' | 'other'

/** A18 오류 문구. `already`는 N-S-A3 A18 보드 원문, 나머지는 보드에 문구가 없어 기존 앱 문구/자리표시자(보고 참조). */
export const CONNECT_ERROR_COPY: Record<ConnectErrorKind, string> = {
  invalid: '연결할 수 없어요. 코드를 다시 확인해주세요.',
  own: '내가 만든 코드는 쓸 수 없어요',
  already: '이미 다른 사람과 연결된 코드는 쓸 수 없어요',
  other: '연결하지 못했어요. 다시 시도해주세요.',
}

const KIND_BY_CODE: Record<string, ConnectErrorKind> = {
  P0002: 'invalid',
  '22023': 'own',
  '23505': 'already',
}

export function classifyConnectError(error: { code?: string | null } | null | undefined): ConnectErrorKind {
  return (error?.code && KIND_BY_CODE[error.code]) || 'other'
}

export function connectErrorMessage(error: { code?: string | null } | null | undefined): string {
  return CONNECT_ERROR_COPY[classifyConnectError(error)]
}

/** 연결 실패. 화면은 `message`를 그대로 보인다. */
export class ConnectCoupleError extends Error {
  readonly kind: ConnectErrorKind
  readonly code: string | null
  constructor(error: { code?: string | null } | null | undefined) {
    super(connectErrorMessage(error))
    this.name = 'ConnectCoupleError'
    this.kind = classifyConnectError(error)
    this.code = error?.code ?? null
  }
}

export interface ConnectDb {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string | null; message?: string } | null }>
}

/** 초대 코드로 연결하고 커플 id를 돌려준다. 실패는 `ConnectCoupleError`. */
export async function connectCouple(db: ConnectDb, code: string): Promise<string> {
  const { data, error } = await db.rpc(CONNECT_COUPLE_FN, { p_invite_code: code })
  if (error) throw new ConnectCoupleError(error)
  if (typeof data !== 'string') throw new ConnectCoupleError(null)
  return data
}
