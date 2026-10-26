/**
 * 연결 해제 · 회원 탈퇴 (`68-`) - 027 함수 호출과 읽기. 저장소 클라이언트를 인자로 받는다(`coupleConnectCore.ts`와 같은 방식).
 *
 * **쓰기는 함수 호출뿐이다.** `couple_dissolutions` · `couples.status` · `profiles.deleted_at` · `purge_scheduled_at`은 앱이 직접 쓰지 않는다(027에서 권한 회수).
 * 함수 이름 · 인자 · 오류 코드는 `supabase/migrations/027_dissolution_withdrawal_retest.sql`에서 읽었다:
 *   fn_request_dissolution()        -> couple_dissolutions.id      28000 비로그인 · 23505 이미 진행 중 · P0002 active 커플 없음
 *   fn_cancel_dissolution(uuid)     -> void                        42501 개시자 아님 · P0002 없는 id · 22023 실행됨 / 탈퇴로 생긴 해제
 *   fn_request_withdrawal()         -> purge_scheduled_at          (이미 요청됨은 그대로 반환)
 *   fn_cancel_withdrawal()          -> void                        22023 유예 끝남
 * 유예 7일은 서버가 정한다(인자 없음).
 */
import type { DissolutionReason, DissolutionState } from '../utils/dissolution'

export const FN_REQUEST_DISSOLUTION = 'fn_request_dissolution'
export const FN_CANCEL_DISSOLUTION = 'fn_cancel_dissolution'
export const FN_REQUEST_WITHDRAWAL = 'fn_request_withdrawal'
export const FN_CANCEL_WITHDRAWAL = 'fn_cancel_withdrawal'

type DbError = { code?: string | null; message?: string } | null

/** 읽기 + rpc만 쓰는 최소 저장소 모양(앱은 전역 `supabase`, 시험은 가짜). */
export interface DissolutionDb {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

export type DissolutionErrorKind = 'in-progress' | 'no-couple' | 'not-allowed' | 'grace-over' | 'other'

export const DISSOLUTION_ERROR_COPY: Record<DissolutionErrorKind, string> = {
  'in-progress': '이미 해제를 요청한 상태예요.',
  'no-couple': '연결된 상대가 없어요.',
  'not-allowed': '해제를 요청한 사람만 취소할 수 있어요.',
  'grace-over': '유예 기간이 끝나 취소할 수 없어요.',
  other: '처리하지 못했어요. 다시 시도해주세요.',
}

const KIND_BY_CODE: Record<string, DissolutionErrorKind> = {
  '23505': 'in-progress',
  P0002: 'no-couple',
  '42501': 'not-allowed',
  '22023': 'grace-over',
}

export class DissolutionError extends Error {
  readonly kind: DissolutionErrorKind
  readonly code: string | null
  constructor(error: DbError | undefined) {
    const kind = (error?.code && KIND_BY_CODE[error.code]) || 'other'
    super(DISSOLUTION_ERROR_COPY[kind])
    this.name = 'DissolutionError'
    this.kind = kind
    this.code = error?.code ?? null
  }
}

/** 해제 요청 -> 해제 행 id. */
export async function requestDissolution(db: DissolutionDb): Promise<string> {
  const { data, error } = await db.rpc(FN_REQUEST_DISSOLUTION)
  if (error) throw new DissolutionError(error)
  if (typeof data !== 'string') throw new DissolutionError(null)
  return data
}

/** 해제 취소(개시자만). */
export async function cancelDissolution(db: DissolutionDb, dissolutionId: string): Promise<void> {
  const { error } = await db.rpc(FN_CANCEL_DISSOLUTION, { p_dissolution_id: dissolutionId })
  if (error) throw new DissolutionError(error)
}

/** 탈퇴 요청 -> 서버가 정한 파기 예정 시각. */
export async function requestWithdrawal(db: DissolutionDb): Promise<string | null> {
  const { data, error } = await db.rpc(FN_REQUEST_WITHDRAWAL)
  if (error) throw new DissolutionError(error)
  return typeof data === 'string' ? data : null
}

/** 탈퇴 취소. */
export async function cancelWithdrawal(db: DissolutionDb): Promise<void> {
  const { error } = await db.rpc(FN_CANCEL_WITHDRAWAL)
  if (error) throw new DissolutionError(error)
}

/**
 * 내 커플의 진행 중 해제(유예 중)를 읽는다. 없으면 null. 읽기만 한다.
 * 커플 행은 `dissolving` 상태로 찾고(SELECT는 두 사람 모두 열려 있다), 진행 중 = 실행 · 취소 모두 null인 해제 행이다.
 */
export async function fetchDissolutionState(db: DissolutionDb, userId: string): Promise<DissolutionState | null> {
  const { data: couple, error: coupleError } = await db
    .from('couples')
    .select('id, user_a_id, user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'dissolving')
    .maybeSingle()
  if (coupleError) throw coupleError
  if (!couple) return null

  const { data: row, error: rowError } = await db
    .from('couple_dissolutions')
    .select('id, couple_id, initiated_by, reason, purge_scheduled_at')
    .eq('couple_id', couple.id)
    .is('executed_at', null)
    .is('cancelled_at', null)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (rowError) throw rowError
  if (!row) return null

  return {
    dissolutionId: row.id,
    coupleId: couple.id,
    partnerId: couple.user_a_id === userId ? couple.user_b_id : couple.user_a_id,
    reason: row.reason as DissolutionReason,
    initiatedByMe: row.initiated_by === userId,
    purgeScheduledAt: row.purge_scheduled_at,
  }
}
