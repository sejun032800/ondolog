/**
 * `profiles.onboarding_step`(세이브포인트)을 올리는 단 하나의 길 - 저장소 클라이언트를 인자로 받는다.
 *
 * **클라이언트는 이 값을 더 작은 값으로 쓰지 않는다**(MASTER 6-5 r70, R38-3 e). 갱신은 `onboarding_step < step`일 때만
 * 일어난다(`where id = :id and onboarding_step < :step`) - 같은 값·더 작은 값으로 부르면 행이 하나도 바뀌지 않고 오류도 아니다.
 * 앱의 모든 진행 단계 갱신(`personalityApi.updateOnboardingStep` · `coupleApi`의 세 함수)이 이 함수를 지난다.
 * 가입 직후 값(0)은 `personalityCore`가 새 프로필을 넣을 때 정한다 - 이미 있는 프로필은 건드리지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingStepValue } from '../constants/onboardingStep'
import type { Database } from '../types/database'

export type OnboardingStepDb = Pick<SupabaseClient<Database>, 'from'>

export async function advanceOnboardingStep(
  db: OnboardingStepDb,
  userId: string,
  step: OnboardingStepValue,
): Promise<void> {
  const { error } = await db
    .from('profiles')
    .update({ onboarding_step: step })
    .eq('id', userId)
    .lt('onboarding_step', step)
  if (error) throw error
}
