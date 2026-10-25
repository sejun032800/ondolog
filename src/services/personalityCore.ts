/**
 * 가입 마무리 저장의 알맹이 - 저장소 클라이언트를 인자로 받는다(`PersonalityDb`).
 *
 * 앱은 `src/services/personalityApi.ts`가 전역 `supabase`를 넣어 부르고, 원격 실증 스크립트(Deno)는 시험 계정의 사용자 세션
 * 클라이언트를 넣어 **같은 함수**를 부른다(`chatCore.ts`와 같은 방식). 동작은 `personalityApi`의 옛 `createProfileAndAssessment`와
 * 같다 - 이 파일로 옮기기만 했다. `supabase.ts`(앱 환경변수·AsyncStorage)는 가져오지 않는다.
 *
 * 근거·동의 시각 규칙은 아래 함수 주석 그대로다: terms/privacy/ai_usage는 이 호출 시각, 마케팅은 체크했을 때만.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { ONBOARDING_STEP } from '../constants/onboardingStep'
import { LOVE_TYPE_ENGINE_VERSION, type LoveTypeInferenceResult } from '../engine/loveTypeInference'
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
  db: PersonalityDb,
  input: CreateProfileAndAssessmentInput,
): Promise<AssessmentRow> {
  const now = new Date().toISOString()

  const { error: profileError } = await db.from('profiles').upsert(
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

  const { data: assessment, error: assessmentError } = await db
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
