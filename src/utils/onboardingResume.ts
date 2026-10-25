/**
 * 서버의 진행 단계(`profiles.onboarding_step`, 세이브포인트)에서 앱이 어디로 들어가는가 - 순수 함수.
 *
 * 앱을 다시 열 때(`app/index.tsx`)와 기존 계정으로 로그인한 직후(`useSignupFinalize`)가 같은 규칙을 쓴다(MASTER 11-1, 6-5 r70).
 *   0 AUTH   -> 화면 7(결과 상세)
 *   1 RESULT -> 화면 8(초대)
 *   2 INVITE -> 커플이 연결됐고 사귄 날짜가 아직 없으면 사귄 날짜, 아니면 메인
 *   3 COMPLETE -> 메인
 */
import { ONBOARDING_STEP } from '../constants/onboardingStep'

export function resumePathFor(step: number, ctx: { connectedWithoutStartDate: boolean }): string {
  if (step === ONBOARDING_STEP.AUTH) return '/result-detail'
  if (step === ONBOARDING_STEP.RESULT) return '/invite'
  if (step === ONBOARDING_STEP.INVITE && ctx.connectedWithoutStartDate) return '/start-date'
  return '/main'
}
