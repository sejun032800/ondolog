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
import {
  computeLoveTypeCode,
  LOVE_TYPE_ENGINE_VERSION,
  type LoveTypeInferenceResult,
} from '../engine/loveTypeInference'
import { supabase } from './supabase'
import type { Database } from '../types/database'
import type { MbtiType, QuizChoice } from '../constants/quizTypes'
import type { Gender } from '../store/sessionStore'

type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
type ProfileRow = Database['public']['Tables']['personality_profiles']['Row']

export interface CreateProfileAndAssessmentInput {
  userId: string
  name: string
  gender: Gender
  birthDate: string
  mbti: MbtiType
  mbtiSelfReported: boolean
  q1: QuizChoice
  q2: QuizChoice
  q3: QuizChoice
  q4: QuizChoice
  q5: QuizChoice
  result: LoveTypeInferenceResult
  /** 화면 6 "마케팅 정보 수신 동의(선택)" 체크 여부. */
  marketingAgreed: boolean
}

/**
 * 화면 6 성공 직후 1회 호출. 세이브포인트가 여기서부터 서버로 넘어간다
 * — 이후 앱이 죽어도 화면 7부터 정상 재개할 수 있어야 하므로, 원본
 * 응답(q1~q5)과 산출값을 이 시점에 전부 저장한다.
 *
 * 필수 동의 3종(terms/privacy/ai_usage)은 이 함수가 불리는 시점 자체가
 * "동의 체크 완료 → 소셜 로그인 성공"을 의미하므로 전부 `now()`로
 * 채운다. 호출부(`app/(onboarding)/auth.tsx`)가 `ConsentChecklist`의
 * 필수 항목이 전부 체크된 경우에만 로그인 버튼을 활성화하므로, 동의
 * 없이 이 함수가 호출되는 경로는 없다.
 */
export async function createProfileAndAssessment(
  input: CreateProfileAndAssessmentInput,
): Promise<AssessmentRow> {
  const now = new Date().toISOString()

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: input.userId,
      display_name: input.name,
      gender: input.gender,
      birth_date: input.birthDate,
      mbti: input.mbti,
      onboarding_step: ONBOARDING_STEP.AUTH,
      terms_agreed_at: now,
      privacy_agreed_at: now,
      ai_usage_agreed_at: now,
      marketing_agreed_at: input.marketingAgreed ? now : null,
    },
    { onConflict: 'id' },
  )
  if (profileError) throw profileError

  const { data: assessment, error: assessmentError } = await supabase
    .from('personality_assessments')
    .insert({
      user_id: input.userId,
      seq: 1,
      engine_version: LOVE_TYPE_ENGINE_VERSION,
      mbti: input.mbti,
      mbti_self_reported: input.mbtiSelfReported,
      q1: input.q1,
      q2: input.q2,
      q3: input.q3,
      q4: input.q4,
      q5: input.q5,
      enneagram_core: input.result.enneagramCore,
      big_e: input.result.big5.bigE,
      big_o: input.result.big5.bigO,
      big_a: input.result.big5.bigA,
      big_c: input.result.big5.bigC,
      big_n: input.result.big5.bigN,
      stern_intimacy: input.result.sternberg.intimacy,
      stern_passion: input.result.sternberg.passion,
      stern_commitment: input.result.sternberg.commitment,
      attach_anxiety: input.result.attachAnxiety,
      attach_avoidance: input.result.attachAvoidance,
      attachment: input.result.attachment,
    })
    .select()
    .single()
  if (assessmentError) throw assessmentError

  return assessment
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

export async function updateOnboardingStep(
  userId: string,
  step: (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP],
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: step })
    .eq('id', userId)
  if (error) throw error
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
