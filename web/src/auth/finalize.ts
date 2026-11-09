/**
 * 로그인 직후 분기 + 가입 저장(웹판). RN 앱의 `useSignupFinalize`와 **같은 순서 · 같은 판정 · 같은 저장 함수**를 쓴다.
 *
 *  - 먼저 `profiles`를 조회한다(PGRST303이면 한 번 다시). 있으면 기존 계정 - 저장 경로를 부르지 않는다(R38-3, 기존 기록이 이긴다).
 *  - 판정은 정본 `decideAfterLogin`(`src/utils/onboardingRules.ts`) 그대로다. 새 판정을 만들지 않는다.
 *  - 저장은 정본 `createProfileAndAssessment`(`src/services/personalityCore.ts`, 없을 때만 넣기) 그대로다.
 *    서버 호출은 RPC가 아니라 테이블(`profiles` insert · `personality_assessments` insert)이고, 클라이언트만 웹 것을 넣는다.
 *  - 서버 진행 단계 -> 갈 곳은 정본 `resumePathFor`(`src/utils/onboardingResume.ts`)를 웹 화면 이름으로 옮긴다.
 */
import type { PersonalityDb } from '@/services/personalityCore'
import { createProfileAndAssessment } from '@/services/personalityCore'
import { isWithdrawalPending } from '@/utils/dissolution'
import { resumePathFor } from '@/utils/onboardingResume'
import { canEnterLogin, decideAfterLogin, hasCompleteAnswers } from '@/utils/onboardingRules'
import type { Database } from '@/types/database'
import type { useSessionStore } from '@/store/sessionStore'
import type { ScreenName } from '../screens'
import { ONBOARDING_STEP } from '@/constants/onboardingStep'
import { fetchMyActiveCouple } from '../couple/coupleApi'
import type { WebSupabase } from './client'
import { withJwtRetry } from './retry'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
type SessionSnapshot = ReturnType<typeof useSessionStore.getState>

export type FinalizeOutcome =
  | { kind: 'existing'; step: number; hadResult: boolean; deletedAt: string | null }
  | { kind: 'saved' }
  | { kind: 'answers' }
  | { kind: 'consent' }

/** RN `personalityApi.fetchProfile`와 같은 조회. */
export async function fetchProfile(db: PersonalityDb, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

/** RN `personalityApi.fetchLatestAssessment`와 같은 조회. */
export async function fetchLatestAssessment(db: PersonalityDb, userId: string): Promise<AssessmentRow | null> {
  const { data, error } = await db
    .from('personality_assessments')
    .select('*')
    .eq('user_id', userId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function finalizeAfterLogin(
  db: PersonalityDb,
  userId: string,
  state: SessionSnapshot,
): Promise<FinalizeOutcome> {
  const answersComplete = hasCompleteAnswers(state)
  const consentComplete = canEnterLogin(state.birthDate, state.consent, new Date())

  const { profile, hasAssessment } = await withJwtRetry(async () => {
    const p = await fetchProfile(db, userId)
    // 프로필이 있고 메모리 답이 온전할 때만 검사 행을 확인한다(저장이 중간에 끊긴 흔적인지 가르기 위해).
    const a = p && answersComplete && consentComplete ? (await fetchLatestAssessment(db, userId)) !== null : true
    return { profile: p, hasAssessment: a }
  })

  const action = decideAfterLogin({
    hasProfile: profile !== null,
    hasAssessment,
    answersComplete,
    consentComplete,
  })

  if (action === 'existing' && profile) {
    return { kind: 'existing', step: profile.onboarding_step, hadResult: answersComplete, deletedAt: profile.deleted_at }
  }
  if (action === 'answers') return { kind: 'answers' }
  if (action === 'consent') return { kind: 'consent' }

  await createProfileAndAssessment(db, {
    userId,
    name: state.name,
    gender: state.gender!,
    birthDate: state.birthDate!,
    mbti: state.mbti!,
    mbtiSelfReported: state.mbtiSelfReported,
    q1: state.q1!,
    q2: state.q2!,
    q3: state.q3!,
    q4: state.q4!,
    q5: state.q5!,
    result: state.result!,
    marketingAgreed: state.consent.marketing,
  })
  return { kind: 'saved' }
}

/**
 * 서버 진행 단계에서 웹 앱이 갈 화면(RN `resolveResumePath` · `resumePathFor`와 같은 규칙).
 *   0 -> 결과 상세, 1 -> 초대, 2 -> 커플이 연결됐고 사귄 날짜가 없으면 사귄 날짜 아니면 메인, 3 -> 메인.
 * 순수 함수 - `ctx.connectedWithoutStartDate`는 `resolveWebRoute`가 서버에서 읽어 넣는다.
 * 닉네임은 사귄 날짜 화면(A19)에서 날짜와 함께 정한다 - RN에도 닉네임만 따로 묻는 길이 없어 같은 규칙이다.
 */
export function webRouteForStep(step: number, ctx: { connectedWithoutStartDate: boolean } = { connectedWithoutStartDate: false }): ScreenName {
  const path = resumePathFor(step, ctx)
  if (path === '/result-detail') return 'detail'
  if (path === '/invite') return 'invite'
  if (path === '/start-date') return 'start-date'
  return 'main'
}

/**
 * 앱 시작 · 로그인 직후 단계 판정(RN `resolveResumePath`의 웹판). 단계 0 · 1은 서버를 더 부르지 않고,
 * 단계 2만 커플 연결 상태를 확인한다(사귄 날짜 입력이 아직 필요한지). 조회가 실패하면 RN `coupleStore.refresh`처럼 미연결로 보고 메인.
 * 탈퇴 유예(`profiles.deleted_at`)가 있으면 **진행 단계보다 먼저** 탈퇴 취소 화면(`withdraw-cancel`)이다(RN `resolveResumePath`의 `WITHDRAW_CANCEL_PATH`, 74-7).
 * 로그인 직후(`useAccountFinalize`)와 앱을 켤 때(`useBootSession`) 모두 이 함수를 지나므로 유예 계정은 어느 길로 들어와도 유예 화면이 먼저다.
 * 유예 판정은 서버를 더 부르지 않는다 - `deletedAt`은 호출한 쪽이 이미 읽은 프로필 값이다.
 */
export async function resolveWebRoute(db: WebSupabase, userId: string, step: number, deletedAt: string | null = null): Promise<ScreenName> {
  if (isWithdrawalPending({ deleted_at: deletedAt })) return 'withdraw-cancel'
  if (step !== ONBOARDING_STEP.INVITE) return webRouteForStep(step)
  let connectedWithoutStartDate = false
  try {
    const couple = await withJwtRetry(() => fetchMyActiveCouple(db, userId))
    connectedWithoutStartDate = !!couple && !couple.relationship_start_date
  } catch {
    connectedWithoutStartDate = false
  }
  return webRouteForStep(step, { connectedWithoutStartDate })
}

export const EXISTING_ACCOUNT_NOTICE =
  '이미 가입한 계정이에요. 원래 정보로 이어서 보여 드려요. 방금 본 결과는 저장하지 않았어요.'
