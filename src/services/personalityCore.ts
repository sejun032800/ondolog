/**
 * 가입 마무리 저장의 알맹이 - 저장소 클라이언트를 인자로 받는다(`PersonalityDb`).
 *
 * 앱은 `src/services/personalityApi.ts`가 전역 `supabase`를 넣어 부르고, 원격 실증 스크립트(Deno)는 시험 계정의 사용자 세션
 * 클라이언트를 넣어 **같은 함수**를 부른다(`chatCore.ts`와 같은 방식). 동작은 `personalityApi`의 옛 `createProfileAndAssessment`와
 * 같다 - 이 파일로 옮겼고, r70(R38-3)에서 "없을 때만 넣기"로 바꿨다. `supabase.ts`(앱 환경변수·AsyncStorage)는 가져오지 않는다.
 *
 * 근거·동의 시각 규칙은 아래 함수 주석 그대로다: terms/privacy/ai_usage는 이 호출 시각, 마케팅은 체크했을 때만.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { ONBOARDING_STEP } from '../constants/onboardingStep'
import {
  LOVE_TYPE_ENGINE_VERSION,
  computeLoveTypeCode,
  type LoveTypeInferenceResult,
} from '../engine/loveTypeInference'
import type { EnneagramCore } from '../constants/enneagram'
import type { MbtiType, QuizChoice } from '../constants/quizTypes'
import type { Database } from '../types/database'

export type PersonalityDb = Pick<SupabaseClient<Database>, 'from'>
/** DB `gender_type` enum(male/female/other) - `sessionStore.Gender`와 같다(스토어를 가져오지 않기 위해 여기서 정한다). */
type Gender = Database['public']['Enums']['gender_type']
type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']

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
 * `personality_assessments` 한 행의 넣을 값 - 가입 저장(seq 1)과 재검사(seq 2, `settingsCore`)가 같은 모양을 쓴다.
 * 채점 결과(`result`)는 엔진 출력 그대로이고, 이 함수는 계산하지 않는다.
 */
export function buildAssessmentInsert(
  userId: string,
  seq: 1 | 2,
  input: Pick<CreateProfileAndAssessmentInput, 'mbti' | 'mbtiSelfReported' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'result'>,
) {
  return {
    user_id: userId,
    seq,
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
  }
}

/** Postgres 유니크 제약 위반 - "이미 들어 있다"는 뜻이라 이 저장 경로에서는 성공이다. */
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === UNIQUE_VIOLATION
}

/**
 * 화면 6 성공 직후 호출. 세이브포인트가 여기서부터 서버로 넘어간다
 * — 이후 앱이 죽어도 화면 7부터 정상 재개할 수 있어야 하므로, 원본
 * 응답(q1~q5)과 산출값을 이 시점에 전부 저장한다.
 *
 * **없을 때만 넣는다**(MASTER 6-5 r70, R38-3 d). 이미 있는 행은 덮어쓰지 않는다:
 *   - `profiles`는 insert이고, 기본키 중복(23505)은 성공으로 본다 - 기존 이름·동의 시각·`onboarding_step`을 건드리지 않는다.
 *     (예전 upsert는 이미 있는 프로필의 동의 시각과 진행 단계를 새 값으로 덮었다.)
 *   - `personality_assessments`는 `seq = 1` insert이고, 중복(23505)은 성공으로 본다 - 이미 들어간 검사를 읽어 돌려준다.
 *   그래서 응답만 끊긴 재시도, 프로필만 들어가고 검사는 못 들어간 상태에서의 재호출 모두 끝까지 간다(같은 결과).
 *
 * 필수 동의 3종(terms/privacy/ai_usage)은 이 함수가 불리는 시점 자체가
 * "동의 체크 완료 → 소셜 로그인 성공"을 의미하므로 전부 `now()`로
 * 채운다(새로 넣는 프로필에만 해당). 호출부(`useSignupFinalize`)가
 * 필수 동의와 만 14세를 확인한 경우에만 이 함수를 부른다.
 */
export async function createProfileAndAssessment(
  db: PersonalityDb,
  input: CreateProfileAndAssessmentInput,
): Promise<AssessmentRow | null> {
  const now = new Date().toISOString()

  const { error: profileError } = await db.from('profiles').insert({
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
  })
  if (profileError && !isUniqueViolation(profileError)) throw profileError

  const { data: assessment, error: assessmentError } = await db
    .from('personality_assessments')
    .insert(buildAssessmentInsert(input.userId, 1, input))
    .select()
    .single()
  if (assessmentError) {
    if (!isUniqueViolation(assessmentError)) throw assessmentError
    // 이미 들어 있다 - 덮어쓰지 않고 있는 것을 읽어 돌려준다.
    const { data: existing, error: readError } = await db
      .from('personality_assessments')
      .select('*')
      .eq('user_id', input.userId)
      .eq('seq', 1)
      .maybeSingle()
    if (readError) throw readError
    return existing
  }

  return assessment
}

type ProfileRow = Database['public']['Tables']['personality_profiles']['Row']

/**
 * A14 - `personality_profiles` 정식 생성. 이미 있으면 그대로 돌려준다(`created: false`).
 *
 * **쓰는 칸**: user_id · active_assessment_id · enneagram_inferred · attachment · love_type_code. `enneagram_effective`는 서버가
 * `coalesce(override, inferred)`로 계산하는 생성 칸(004, `generated always`)이라 **넣지 않는다**(넣으면 거부되어 A14가 막힌다 - `65-` 실증).
 */
export async function ensurePersonalityProfileCore(
  db: PersonalityDb,
  userId: string,
  assessment: AssessmentRow,
): Promise<{ row: ProfileRow; created: boolean }> {
  const { data: existing, error: readError } = await db
    .from('personality_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (existing) return { row: existing, created: false }

  const { data, error } = await db
    .from('personality_profiles')
    .insert({
      user_id: userId,
      active_assessment_id: assessment.id,
      enneagram_inferred: assessment.enneagram_core,
      attachment: assessment.attachment,
      love_type_code: computeLoveTypeCode(assessment.enneagram_core as EnneagramCore, assessment.attachment),
    })
    .select()
    .single()
  if (error) throw error
  return { row: data, created: true }
}

/**
 * A16 "결과와 달라요" - 애니어그램 코어만 오버라이드한다. 무제한(횟수 제한 없음).
 *
 * **쓰는 칸은 `enneagram_override` · `override_count` · `override_updated_at` · `love_type_code` 넷뿐이다.** 원본 추론값(`enneagram_inferred`)은
 * 건드리지 않아 둘 다 보관된다(MASTER 9-1 화면 7). `love_type_code`는 **같은 UPDATE에서** 새 실효 코어(= 방금 고른 코어) 약어 + 애착 약어로 다시
 * 쓴다(R40-4, MASTER 10-5-4) - 계산은 엔진 `computeLoveTypeCode`다. `enneagram_effective`는 `coalesce(override, inferred)`로 서버가 계산하는 생성 칸이라
 * 클라이언트가 쓰지 않는다(쓰면 거부된다). 빅5 · 스턴버그 · 애착은 `personality_assessments`에 있어 이 함수가 읽지도 쓰지도 않는다.
 */
export async function overrideEnneagramCore(
  db: PersonalityDb,
  userId: string,
  newCore: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
): Promise<ProfileRow> {
  const { data: current, error: readError } = await db
    .from('personality_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (!current) throw new Error('personality_profiles 행이 없습니다.')

  const { data, error } = await db
    .from('personality_profiles')
    .update({
      enneagram_override: newCore,
      override_count: current.override_count + 1,
      override_updated_at: new Date().toISOString(),
      love_type_code: computeLoveTypeCode(newCore, current.attachment),
    })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
