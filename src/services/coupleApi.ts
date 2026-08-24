/**
 * 화면 8(연인 초대) + 화면 +(사귄 날짜 입력) 서버 API.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 8/화면 +.
 * RLS: `supabase/migrations/012_rls_policies.sql`
 *   couples_insert: user_a_id = auth.uid()만 허용
 *   couples_update: 본인 행이거나, (user_b_id is null and status='pending')인
 *     행 — 초대 코드로 "빈 슬롯에 들어가는" 참여를 이 정책 하나로 허용한다.
 *     참여자는 사전에 그 행을 SELECT할 권한이 없어도(본인 행이 아니므로)
 *     UPDATE ... WHERE invite_code = ? 는 성립한다(RLS는 갱신 시점에
 *     해당 행에 대해서만 USING을 평가한다).
 *
 * 초대 코드 자체는 채점 로직이 아니므로(CLAUDE.md 절대 규칙 2는 연애유형
 * 채점에만 적용) 무작위 생성을 써도 결정론 계약을 위반하지 않는다.
 */

import { ONBOARDING_STEP } from '../constants/onboardingStep'
import { supabase } from './supabase'
import type { Database } from '../types/database'

type CoupleRow = Database['public']['Tables']['couples']['Row']

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 0/O, 1/I 혼동 문자 제외
const INVITE_CODE_LENGTH = 6

function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]
  }
  return code
}

export type InviteStatus =
  | { status: 'connected'; couple: CoupleRow }
  | { status: 'pending'; couple: CoupleRow }

/**
 * 이미 pending/active 커플 행이 있으면 그대로 반환하고, 없으면 새로
 * 발급한다("초대코드 발급+공유", Part 9-1 화면 8). `couples`는 사용자당
 * 활성(pending/active) 행이 최대 1개다(부분 유니크 인덱스).
 */
export async function getOrCreateInvite(userId: string): Promise<InviteStatus> {
  const { data: existing, error: fetchError } = await supabase
    .from('couples')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle()
  if (fetchError) throw fetchError

  if (existing) {
    return { status: existing.status === 'active' ? 'connected' : 'pending', couple: existing }
  }

  // 코드 충돌 시 재시도(unique 제약 위반, 확률적으로 매우 드묾)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('couples')
      .insert({ user_a_id: userId, invite_code: generateInviteCode() })
      .select()
      .single()

    if (!error) return { status: 'pending', couple: data }
    if (error.code !== '23505') throw error // unique_violation 외에는 즉시 던진다
  }

  throw new Error('초대 코드 발급에 반복 실패했습니다.')
}

/**
 * "상대 코드 입력" — 상대가 발급한 코드로 빈 슬롯에 들어간다.
 * 무효/만료/이미 연결된 코드는 매칭되는 행이 없어 null을 반환한다
 * (AC: "코드 중복 불가, 이미 연결된 유저 코드 무효").
 */
export async function redeemInviteCode(
  userId: string,
  code: string,
): Promise<CoupleRow | null> {
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('couples')
    .update({ user_b_id: userId, status: 'active', connected_at: nowIso })
    .eq('invite_code', code.toUpperCase())
    .eq('status', 'pending')
    .is('user_b_id', null)
    .neq('user_a_id', userId) // 자기 자신의 코드로는 참여 불가(DB chk_not_self와 이중 방어)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

/** "나중에 할게요" / "솔로예요" — 커플 없이 온보딩을 완료 처리한다. */
export async function completeOnboardingWithoutCouple(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: ONBOARDING_STEP.COMPLETE })
    .eq('id', userId)
  if (error) throw error
}

/**
 * 코드 입력으로 연결에 성공했을 때 — 화면 8은 완료됐지만 사귄 날짜
 * 입력(화면 +)이 남아있으므로 아직 COMPLETE(3)이 아니라 INVITE(2)로
 * 멈춘다. 사귄 날짜까지 끝나면 그때 COMPLETE(3)이 된다
 * (`markStartDateOnboardingComplete` 참조).
 */
export async function markInviteDoneAwaitingStartDate(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: ONBOARDING_STEP.INVITE })
    .eq('id', userId)
  if (error) throw error
}

/** 화면 +(사귄 날짜) 완료 — 온보딩 전체를 완료 처리한다. */
export async function markStartDateOnboardingComplete(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: ONBOARDING_STEP.COMPLETE })
    .eq('id', userId)
  if (error) throw error
}

/**
 * 화면 +. 먼저 입력한 값이 확정되고 상대는 확인만 한다
 * (Part 9-1 화면 +, `couples.relationship_start_date` 컬럼 주석 동일 원문).
 */
export async function setOrConfirmStartDate(
  coupleId: string,
  userId: string,
  date: string,
): Promise<CoupleRow> {
  const { data: current, error: fetchError } = await supabase
    .from('couples')
    .select('*')
    .eq('id', coupleId)
    .single()
  if (fetchError) throw fetchError

  if (!current.relationship_start_date) {
    const { data, error } = await supabase
      .from('couples')
      .update({ relationship_start_date: date, start_date_set_by: userId })
      .eq('id', coupleId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  // 이미 상대가 먼저 입력했다면 나는 확인만 한다(엣지 케이스, Part 9-1 미확정 항목).
  const { data, error } = await supabase
    .from('couples')
    .update({ start_date_confirmed_by: userId })
    .eq('id', coupleId)
    .select()
    .single()
  if (error) throw error
  return data
}
