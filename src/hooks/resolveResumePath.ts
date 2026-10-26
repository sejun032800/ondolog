/**
 * 프로필의 진행 단계로 들어갈 경로를 정한다. 탈퇴 유예 중(`deleted_at`이 있음)이면 진행 단계보다 먼저 탈퇴 취소 화면이다. 단계 0·1은 서버를 더 부르지 않고, 2·3은 커플 연결 상태를 확인한다
 * (사귄 날짜 입력이 아직 필요한지). 규칙은 순수 함수 `resumePathFor`.
 */
import { ONBOARDING_STEP } from '../constants/onboardingStep'
import { useCoupleStore } from '../store/coupleStore'
import { isWithdrawalPending } from '../utils/dissolution'
import { resumePathFor } from '../utils/onboardingResume'

/** 탈퇴 유예 중 로그인 -> 다른 어떤 화면보다 먼저 탈퇴 취소 화면(`68-`, H16). */
export const WITHDRAW_CANCEL_PATH = '/withdraw-cancel'

export async function resolveResumePath(profile: {
  id: string
  onboarding_step: number
  deleted_at?: string | null
}): Promise<string> {
  if (isWithdrawalPending(profile)) return WITHDRAW_CANCEL_PATH
  if (profile.onboarding_step === ONBOARDING_STEP.AUTH || profile.onboarding_step === ONBOARDING_STEP.RESULT) {
    return resumePathFor(profile.onboarding_step, { connectedWithoutStartDate: false })
  }
  await useCoupleStore.getState().refresh(profile.id)
  const couple = useCoupleStore.getState()
  return resumePathFor(profile.onboarding_step, {
    connectedWithoutStartDate: couple.status === 'connected' && !couple.relationshipStartDate,
  })
}
