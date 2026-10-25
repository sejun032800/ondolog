/**
 * 화면 6(회원가입/로그인)~7(결과 랜딩 상세) 서버 귀속 API.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1
 *   화면 6: "세션 유지 상태면 화면 2~5 데이터 귀속(재입력 없음)"
 *   화면 7: "저장: personality_profiles 정식 생성", "결과와 달라요" →
 *     애니어그램 코어만 오버라이드, enneagram_inferred/override 둘 다 보관.
 *
 * 세이브포인트 정수는 `src/constants/onboardingStep.ts`(SCHEMA.md
 * `profiles.onboarding_step` 0~3 CHECK 제약) 참조.
 *
 * `createProfileAndAssessment`는 화면 6 동의 체크리스트
 * (`ConsentChecklist`)가 필수 항목 전체 체크를 확인한 뒤에만 호출된다
 * (`app/(onboarding)/auth.tsx`) — terms_agreed_at/privacy_agreed_at/
 * ai_usage_agreed_at는 이 호출 시점의 `now()`를 그대로 쓴다(MASTER.md
 * 6-5 데이터 처리 다이어그램과 동일: "인증 성공 시 profiles 레코드
 * 생성 → terms_agreed_at = now() …"). marketing_agreed_at은 선택
 * 항목이라 체크 여부(`marketingAgreed`)에 따라 now() 또는 null이다.
 * 017 마이그레이션이 terms_agreed_at/privacy_agreed_at의 default now()를
 * 제거했으므로, 이 함수를 거치지 않고는(즉 동의 없이는) profiles
 * insert 자체가 not-null 제약 위반으로 실패한다.
 *
 * ⚠️ `.env`의 EXPO_PUBLIC_SUPABASE_ANON_KEY가 플레이스홀더 상태라 이
 * 파일의 호출부는 실기기/에뮬레이터에서 아직 end-to-end 검증이
 * 불가능하다(.claude/state/HANDOFF.md 참조). 스키마·RLS 정책
 * (`supabase/migrations/003_profiles.sql`, `004_personality.sql`,
 * `012_rls_policies.sql`, `017_profiles_marketing_consent.sql`)과
 * 대조해 컬럼명은 맞춰뒀다.
 */

import { ONBOARDING_STEP } from '../constants/onboardingStep'
import { computeLoveTypeCode } from '../engine/loveTypeInference'
import { supabase } from './supabase'
import { advanceOnboardingStep } from './onboardingStepCore'
import {
  createProfileAndAssessment as createProfileAndAssessmentCore,
  type CreateProfileAndAssessmentInput,
} from './personalityCore'
import type { Database } from '../types/database'

type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
type ProfileRow = Database['public']['Tables']['personality_profiles']['Row']

export type { CreateProfileAndAssessmentInput } from './personalityCore'

/**
 * 화면 6 성공 직후 호출(U6 이후: A11 로그인 직후, `useSignupFinalize`). 없을 때만 넣는다(r70). 알맹이는 `personalityCore.ts` -
 * 앱 전역 `supabase`를 넣어 부른다. 동의 시각·세이브포인트 규칙은 그쪽 주석 그대로다.
 */
export function createProfileAndAssessment(input: CreateProfileAndAssessmentInput): Promise<AssessmentRow | null> {
  return createProfileAndAssessmentCore(supabase, input)
}

/** 화면 7 재진입(세이브포인트 재개) 시 최신 assessment를 읽어온다. */
export async function fetchLatestAssessment(
  userId: string,
): Promise<AssessmentRow | null> {
  const { data, error } = await supabase
    .from('personality_assessments')
    .select('*')
    .eq('user_id', userId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPersonalityProfile(
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('personality_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * 화면 7 "저장: personality_profiles 정식 생성". 이미 있으면 그대로
 * 반환한다(재진입 시 중복 생성 방지).
 */
export async function ensurePersonalityProfile(
  userId: string,
  assessment: AssessmentRow,
): Promise<ProfileRow> {
  const existing = await fetchPersonalityProfile(userId)
  if (existing) return existing

  const loveTypeCode = computeLoveTypeCode(
    assessment.enneagram_core as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
    assessment.attachment,
  )

  const { data, error } = await supabase
    .from('personality_profiles')
    .insert({
      user_id: userId,
      active_assessment_id: assessment.id,
      enneagram_inferred: assessment.enneagram_core,
      enneagram_effective: assessment.enneagram_core,
      attachment: assessment.attachment,
      love_type_code: loveTypeCode,
    })
    .select()
    .single()
  if (error) throw error

  await updateOnboardingStep(userId, ONBOARDING_STEP.RESULT)
  return data
}

/**
 * 화면 7 "결과와 달라요" — 애니어그램 코어만 오버라이드. 무제한, 원본
 * 추론값(enneagram_inferred)은 절대 덮어쓰지 않는다.
 */
export async function overrideEnneagramCore(
  userId: string,
  newCore: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
): Promise<ProfileRow> {
  const current = await fetchPersonalityProfile(userId)
  if (!current) throw new Error('personality_profiles 행이 없습니다.')

  const { data, error } = await supabase
    .from('personality_profiles')
    .update({
      enneagram_override: newCore,
      enneagram_effective: newCore,
      override_count: current.override_count + 1,
      override_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 진행 단계를 **올린다**(같거나 작은 값은 아무 일도 하지 않는다 - r70). 알맹이는 `onboardingStepCore.ts`. */
export function updateOnboardingStep(
  userId: string,
  step: (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP],
): Promise<void> {
  return advanceOnboardingStep(supabase, userId, step)
}

export async function fetchProfile(
  userId: string,
): Promise<Database['public']['Tables']['profiles']['Row'] | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
