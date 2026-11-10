/**
 * A14 · A15 · A16 온보딩 결과 상세의 데이터(RN `useResultDetail` onboarding 모드의 웹판) - **같은 순서**:
 *   서버 최신 검사(`fetchLatestAssessment`) -> 성격 프로필 한 번 만들기(`ensurePersonalityProfileCore`, 이미 있으면 그대로) -> **만들었을 때만** 진행 단계를 RESULT로 올린다(`advanceOnboardingStep`).
 * 표시는 메모리가 아니라 **서버에 저장된 값**이다(결정론, 이 훅은 계산하지 않는다). 그래서 새 계정이 첫 로그인한 직후에도, 앱을 다시 켜 단계 0으로 들어와도 같은 화면이다.
 * 오버라이드는 정본 `overrideEnneagramCore`(쓰는 칸 넷)로 저장한다. 서버(트리거 · RPC · 정책)는 바꾸지 않았다 - 클라이언트 insert는 012 · 027 정책이 이미 허용한다.
 */
import { useCallback, useEffect, useState } from 'react'
import type { EnneagramCore } from '@/constants/enneagram'
import { ONBOARDING_STEP } from '@/constants/onboardingStep'
import { ensurePersonalityProfileCore, overrideEnneagramCore } from '@/services/personalityCore'
import { advanceOnboardingStep } from '@/services/onboardingStepCore'
import type { Database } from '@/types/database'
import { IS_TRIAL_BUILD } from '../config/env'
import { safeKind, useTrialDiag } from '../platform/trialDiag'
import { getSupabase } from './client'
import { fetchLatestAssessment } from './finalize'
import { withJwtRetry } from './retry'

export type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
export type PersonalityProfileRow = Database['public']['Tables']['personality_profiles']['Row']

export type OnboardingResultState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; assessment: AssessmentRow; profile: PersonalityProfileRow }

export function useOnboardingResult(userId: string | null): {
  state: OnboardingResultState
  reload: () => void
  /** 코어 오버라이드 저장. 성공하면 true. 횟수 제한 없음. */
  override: (core: EnneagramCore) => Promise<boolean>
} {
  const [state, setState] = useState<OnboardingResultState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const db = getSupabase()
    if (!userId || !db) {
      // 세션이 없거나 연결 값이 없다 - 빈 화면 대신 안내 화면(다시 시도 · 로그아웃)으로 보낸다.
      setState({ status: 'error' })
      if (IS_TRIAL_BUILD) useTrialDiag.getState().record('detail', !userId ? 'no_session' : 'no_client')
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      try {
        const assessment = await withJwtRetry(() => fetchLatestAssessment(db, userId))
        if (cancelled) return
        if (!assessment) {
          setState({ status: 'missing' })
          if (IS_TRIAL_BUILD) useTrialDiag.getState().record('detail', 'no_assessment')
          return
        }
        const { row, created } = await withJwtRetry(() => ensurePersonalityProfileCore(db, userId, assessment))
        if (created) await advanceOnboardingStep(db, userId, ONBOARDING_STEP.RESULT)
        if (!cancelled) setState({ status: 'ready', assessment, profile: row })
      } catch (e) {
        if (IS_TRIAL_BUILD) useTrialDiag.getState().record('detail', safeKind(e))
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [userId, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const override = useCallback(async (core: EnneagramCore): Promise<boolean> => {
    const db = getSupabase()
    if (!userId || !db) return false
    try {
      const profile = await overrideEnneagramCore(db, userId, core)
      setState((prev) => (prev.status === 'ready' ? { ...prev, profile } : prev))
      return true
    } catch {
      return false
    }
  }, [userId])

  return { state, reload, override }
}
