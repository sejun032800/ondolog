/**
 * 커플 연결 · 사귄 날짜 서버 호출(RN `src/services/coupleApi.ts`의 웹판). 같은 테이블 · 같은 RPC · 같은 순서다.
 * RN은 싱글턴 클라이언트(`services/supabase.ts`)를 쓰지만 웹은 클라이언트를 인자로 받는다(시험은 가짜 클라이언트).
 *
 *  - 연결은 026 `fn_connect_couple` RPC만 한다(`@/services/coupleConnectCore`). 앱은 `user_b_id` · `status` · `connected_at`을 직접 쓰지 않는다.
 *  - 진행 단계(`profiles.onboarding_step`)는 `advanceOnboardingStep`(`.lt` 조건, 올리기만)으로만 올린다.
 *  - 초대 코드 문자 규칙은 RN과 같다(0/O · 1/I 제외 6자리). 채점 로직이 아니라 무작위여도 결정론 계약과 무관하다.
 *  - 쓰는 칸: couples = invite insert · relationship_start_date · start_date_set_by · start_date_confirmed_by · nickname.
 */
import { connectCouple, type ConnectDb } from '@/services/coupleConnectCore'
import { advanceOnboardingStep } from '@/services/onboardingStepCore'
import { ONBOARDING_STEP } from '@/constants/onboardingStep'
import type { Database } from '@/types/database'
import { isStartDateSelectable, isValidNickname, normalizeNickname } from '@/utils/coupleStart'
import type { WebSupabase } from '../auth/client'

export type CoupleRow = Database['public']['Tables']['couples']['Row']

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const INVITE_CODE_LENGTH = 6

export function generateInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_CODE_CHARS[Math.floor(random() * INVITE_CODE_CHARS.length)]
  return code
}

export type InviteStatus =
  | { status: 'connected'; couple: CoupleRow }
  | { status: 'pending'; couple: CoupleRow }

/** A17 - 읽기만 한다(없으면 만들지 않는다). pending/active 커플 행이 있으면 그 상태, 없으면 null. */
export async function fetchExistingInvite(db: WebSupabase, userId: string): Promise<InviteStatus | null> {
  const { data, error } = await db
    .from('couples')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { status: data.status === 'active' ? 'connected' : 'pending', couple: data }
}

/** 이미 pending/active 행이 있으면 그대로, 없으면 새로 발급한다(사람이 [초대 코드 만들기]를 누를 때만 부른다). */
export async function getOrCreateInvite(db: WebSupabase, userId: string): Promise<InviteStatus> {
  const existing = await fetchExistingInvite(db, userId)
  if (existing) return existing
  // 코드 충돌(unique 위반)이면 다시 만든다.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from('couples')
      .insert({ user_a_id: userId, invite_code: generateInviteCode() })
      .select()
      .single()
    if (!error) return { status: 'pending', couple: data }
    if (error.code !== '23505') throw error
  }
  throw new Error('초대 코드 발급에 반복 실패했습니다.')
}

/** A18 - 026 연결 함수를 부른다. 실패는 `ConnectCoupleError`(message = A18 문구). */
export async function redeemInviteCode(db: WebSupabase, code: string): Promise<CoupleRow> {
  const coupleId = await connectCouple(db as unknown as ConnectDb, code)
  const { data, error } = await db.from('couples').select('*').eq('id', coupleId).single()
  if (error) throw error
  return data
}

/** "나중에 할게요" / "솔로예요" - 커플 없이 온보딩을 완료 처리한다(진행 단계 COMPLETE). */
export function completeOnboardingWithoutCouple(db: WebSupabase, userId: string): Promise<void> {
  return advanceOnboardingStep(db, userId, ONBOARDING_STEP.COMPLETE)
}

/** 연결 성공 - 사귄 날짜 입력이 남았으므로 COMPLETE가 아니라 INVITE(2)에서 멈춘다. */
export function markInviteDoneAwaitingStartDate(db: WebSupabase, userId: string): Promise<void> {
  return advanceOnboardingStep(db, userId, ONBOARDING_STEP.INVITE)
}

/** 사귄 날짜까지 끝 - 온보딩 전체 완료. */
export function markStartDateOnboardingComplete(db: WebSupabase, userId: string): Promise<void> {
  return advanceOnboardingStep(db, userId, ONBOARDING_STEP.COMPLETE)
}

export async function fetchCouple(db: WebSupabase, coupleId: string): Promise<CoupleRow> {
  const { data, error } = await db.from('couples').select('*').eq('id', coupleId).single()
  if (error) throw error
  return data
}

/** 내가 속한 active 커플 행(없으면 null). A20 재표시 판정이 쓴다. */
export async function fetchMyActiveCouple(db: WebSupabase, userId: string): Promise<CoupleRow | null> {
  const { data, error } = await db
    .from('couples')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

/** 먼저 입력한 값이 확정되고 상대는 확인만 한다(MASTER 9-1 화면 +). 기존 규칙 그대로. */
export async function setOrConfirmStartDate(db: WebSupabase, coupleId: string, userId: string, date: string): Promise<CoupleRow> {
  const current = await fetchCouple(db, coupleId)
  if (!current.relationship_start_date) {
    const { data, error } = await db
      .from('couples')
      .update({ relationship_start_date: date, start_date_set_by: userId })
      .eq('id', coupleId)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await db
    .from('couples')
    .update({ start_date_confirmed_by: userId })
    .eq('id', coupleId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** A19 [시작하기] - 날짜(기존 규칙)와 닉네임. 닉네임은 내가 날짜를 정한 쪽일 때만 쓴다. */
export async function saveStartDateAndNickname(
  db: WebSupabase,
  coupleId: string,
  userId: string,
  date: string,
  nickname: string,
  now: Date = new Date(),
): Promise<CoupleRow> {
  if (!isStartDateSelectable(date, now)) throw new Error('사귄 날짜는 오늘까지만 고를 수 있어요.')
  if (!isValidNickname(nickname)) throw new Error('커플 닉네임은 1자 이상 20자 이하여야 해요.')
  const row = await setOrConfirmStartDate(db, coupleId, userId, date)
  if (row.start_date_set_by !== userId) return row
  const { data, error } = await db
    .from('couples')
    .update({ nickname: normalizeNickname(nickname) })
    .eq('id', coupleId)
    .select()
    .single()
  if (error) throw error
  return data
}
