/**
 * 프로필의 진행 단계로 들어갈 경로를 정한다. 단계 0·1은 서버를 더 부르지 않고, 2·3은 커플 연결 상태를 확인한다
 * (사귄 날짜 입력이 아직 필요한지). 규칙은 순수 함수 `resumePathFor`.
 */
import { ONBOARDING_STEP } from '../constants/onboardingStep'
import { useCoupleStore } from '../store/coupleStore'
import { resumePathFor } from '../utils/onboardingResume'

export async function resolveResumePath(profile: { id: string; onboarding_step: number }): Promise<string> {
  if (profile.onboarding_step === ONBOARDING_STEP.AUTH || profile.onboarding_step === ONBOARDING_STEP.RESULT) {
    return resumePathFor(profile.onboarding_step, { connectedWithoutStartDate: false })
  }
  await useCoupleStore.getState().refresh(profile.id)
  const couple = useCoupleStore.getState()
  return resumePathFor(profile.onboarding_step, {
    connectedWithoutStartDate: couple.status === 'connected' && !couple.relationshipStartDate,
  })
}
