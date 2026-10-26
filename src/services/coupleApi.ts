/**
 * 화면 8(연인 초대) + 화면 +(사귄 날짜 입력) 서버 API.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 8/화면 +.
 * RLS: `supabase/migrations/012_rls_policies.sql` + 026
 *   couples_insert: 초대 발급만 허용(user_a_id = auth.uid() · user_b_id null · pending · free).
 *   couples_update: 구성원 본인 행만, 앱이 쓰는 다섯 칸(사귄 날짜 · 확인자 · 닉네임 · 기준 사진)만.
 *   대기 행(pending, user_b_id null)은 구성원이 아니면 SELECT로 보이지 않는다 - 정책을 넓히면 모든 초대 코드가 노출되므로 넓히지 않는다.
 *   그래서 **연결은 026 `fn_connect_couple` RPC만 한다**(`redeemInviteCode`). 앱은 `user_b_id` · `status` · `connected_at`을 직접 쓰지 않는다.
 *
 * 초대 코드 자체는 채점 로직이 아니므로(CLAUDE.md 절대 규칙 2는 연애유형
 * 채점에만 적용) 무작위 생성을 써도 결정론 계약을 위반하지 않는다.
 */

import { ONBOARDING_STEP } from '../constants/onboardingStep'
import { supabase } from './supabase'
import { advanceOnboardingStep } from './onboardingStepCore'
import { connectCouple, type ConnectDb } from './coupleConnectCore'
import type { Database } from '../types/database'
import { isStartDateSelectable, isValidNickname, normalizeNickname } from '../utils/coupleStart'

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
 * "상대 코드 입력" - 026 연결 함수(`fn_connect_couple`)를 부른다. 성공하면 연결된 커플 행을 읽어 돌려준다(이제 구성원이라 읽힌다).
 * 실패는 `ConnectCoupleError`(message = A18 문구): 무효/만료/이미 쓴 코드 · 자기 코드 · 이미 커플.
 */
export async function redeemInviteCode(_userId: string, code: string): Promise<CoupleRow> {
  const coupleId = await connectCouple(supabase as unknown as ConnectDb, code)
  const { data, error } = await supabase.from('couples').select('*').eq('id', coupleId).single()
  if (error) throw error
  return data
}

/** "나중에 할게요" / "솔로예요" — 커플 없이 온보딩을 완료 처리한다. */
export async function completeOnboardingWithoutCouple(userId: string): Promise<void> {
  await advanceOnboardingStep(supabase, userId, ONBOARDING_STEP.COMPLETE)
}

/**
 * 코드 입력으로 연결에 성공했을 때 — 화면 8은 완료됐지만 사귄 날짜
 * 입력(화면 +)이 남아있으므로 아직 COMPLETE(3)이 아니라 INVITE(2)로
 * 멈춘다. 사귄 날짜까지 끝나면 그때 COMPLETE(3)이 된다
 * (`markStartDateOnboardingComplete` 참조).
 */
export async function markInviteDoneAwaitingStartDate(userId: string): Promise<void> {
  await advanceOnboardingStep(supabase, userId, ONBOARDING_STEP.INVITE)
}

/** 화면 +(사귄 날짜) 완료 — 온보딩 전체를 완료 처리한다. */
export async function markStartDateOnboardingComplete(userId: string): Promise<void> {
  await advanceOnboardingStep(supabase, userId, ONBOARDING_STEP.COMPLETE)
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

/**
 * A17 - **읽기만 한다**(없으면 만들지 않는다). 이미 pending/active 커플 행이 있으면 그 상태를, 없으면 null.
 * 화면이 열릴 때(이미 발급한 코드를 다시 보이기 · 이미 연결됐으면 건너가기)와, 코드를 보여 둔 채 상대가 입력했는지 살필 때 쓴다.
 * 발급은 사람이 [초대 코드 만들기]를 누를 때 `getOrCreateInvite`가 한다 - 이 함수는 커플 행을 만들지 않는다.
 */
export async function fetchExistingInvite(userId: string): Promise<InviteStatus | null> {
  const { data, error } = await supabase
    .from('couples')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { status: data.status === 'active' ? 'connected' : 'pending', couple: data }
}

/** A19 · A20 - 커플 행 하나(사귄 날짜 · 누가 정했는지 · 닉네임)를 읽는다. */
export async function fetchCouple(coupleId: string): Promise<CoupleRow> {
  const { data, error } = await supabase.from('couples').select('*').eq('id', coupleId).single()
  if (error) throw error
  return data
}

/**
 * A19 [시작하기] - 사귄 날짜와 커플 닉네임을 저장한다(R13-11 #4: 닉네임은 사귄 날짜 화면에서 함께 묻는다).
 *
 * 날짜는 **기존 규칙 그대로** `setOrConfirmStartDate`가 정한다(먼저 입력한 값 적용, 상대는 확인만). 이 함수는 앞에서 입력 규칙
 * (미래 날짜 불가 - KST 오늘까지, 닉네임 1~20자)을 한 번 더 막고, **내가 날짜를 정한 쪽일 때만** 닉네임을 쓴다 - 상대가 먼저 정했다면
 * 닉네임도 상대가 정한 것이라 덮지 않는다. 반환한 행의 `start_date_set_by`로 화면이 누가 정했는지 안다.
 */
export async function saveStartDateAndNickname(
  coupleId: string,
  userId: string,
  date: string,
  nickname: string,
  now: Date = new Date(),
): Promise<CoupleRow> {
  if (!isStartDateSelectable(date, now)) throw new Error('사귄 날짜는 오늘까지만 고를 수 있어요.')
  if (!isValidNickname(nickname)) throw new Error('커플 닉네임은 1자 이상 20자 이하여야 해요.')

  const row = await setOrConfirmStartDate(coupleId, userId, date)
  if (row.start_date_set_by !== userId) return row

  const { data, error } = await supabase
    .from('couples')
    .update({ nickname: normalizeNickname(nickname) })
    .eq('id', coupleId)
    .select()
    .single()
  if (error) throw error
  return data
}
