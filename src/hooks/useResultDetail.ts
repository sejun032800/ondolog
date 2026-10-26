/**
 * A14 · A15 · A16 상세 결과 데이터 - 서버의 최신 검사(`personality_assessments`)와 `personality_profiles`를 읽고, 코어 오버라이드를 쓴다.
 *
 * 값은 서버에 있는 결과 그대로다(채점은 가입 때 끝났다 - 이 훅은 계산하지 않는다). 프로필 행은 처음 열 때 한 번 만들어진다
 * (`ensurePersonalityProfile` - 이미 있으면 그대로, 만들 때 진행 단계를 RESULT로 올린다. 올리는 길은 `advanceOnboardingStep` 하나).
 * 오버라이드는 `enneagram_override`만 쓰고 추론값 · 빅5 · 스턴버그 · 애착은 건드리지 않는다(`personalityCore.overrideEnneagramCore`).
 */
import { useCallback, useEffect, useState } from 'react'
import type { EnneagramCore } from '../constants/enneagram'
import {
  ensurePersonalityProfile,
  fetchLatestAssessment,
  fetchPersonalityProfile,
  overrideEnneagramCore,
} from '../services/personalityApi'
import { fetchAssessmentById } from '../services/settingsApi'
import type { Database } from '../types/database'

export type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
export type PersonalityProfileRow = Database['public']['Tables']['personality_profiles']['Row']

export type ResultDetailState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; assessment: AssessmentRow; profile: PersonalityProfileRow }

export interface UseResultDetailResult {
  state: ResultDetailState
  reload: () => void
  /** 코어 오버라이드. 성공하면 true. 횟수 제한 없음. */
  override: (core: EnneagramCore) => Promise<boolean>
}

/**
 * `mode`
 *   - `onboarding`(기본): 가입 길 - 최신 검사를 읽고, 프로필 행이 없으면 처음 한 번 만든다(만들 때 진행 단계를 올린다).
 *   - `settings`(`67-`): 설정 > 성격 프로필 - **읽기만 한다**. 프로필 행을 만들지 않고(진행 단계를 건드리지 않는다), 지금 쓰고 있는 검사
 *     (`active_assessment_id`, 재검사 뒤에는 새 행)를 읽는다. 프로필이 없으면 `missing`이다.
 */
export function useResultDetail(
  userId: string | null,
  mode: 'onboarding' | 'settings' = 'onboarding',
): UseResultDetailResult {
  const [state, setState] = useState<ResultDetailState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setState({ status: 'loading' })
    ;(async () => {
      try {
        if (mode === 'settings') {
          const existing = await fetchPersonalityProfile(userId)
          if (cancelled) return
          const active = existing ? await fetchAssessmentById(existing.active_assessment_id) : null
          if (cancelled) return
          setState(existing && active ? { status: 'ready', assessment: active, profile: existing } : { status: 'missing' })
          return
        }
        const assessment = await fetchLatestAssessment(userId)
        if (cancelled) return
        if (!assessment) {
          setState({ status: 'missing' })
          return
        }
        const profile = await ensurePersonalityProfile(userId, assessment)
        if (!cancelled) setState({ status: 'ready', assessment, profile })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, nonce, mode])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const override = useCallback(
    async (core: EnneagramCore): Promise<boolean> => {
      if (!userId) return false
      try {
        const profile = await overrideEnneagramCore(userId, core)
        setState((prev) => (prev.status === 'ready' ? { ...prev, profile } : prev))
        return true
      } catch {
        return false
      }
    },
    [userId],
  )

  return { state, reload, override }
}
