/**
 * 로그인 직후 가입 마무리 - 메모리의 답(A03~A08)과 동의 시각을 서버에 저장한다(MASTER 6-5, R37-6 규칙 12).
 *
 * 저장은 **기존 경로** `createProfileAndAssessment`(`src/services/personalityApi.ts`)를 그대로 쓴다: profiles upsert
 * (`terms_agreed_at`·`privacy_agreed_at`·`ai_usage_agreed_at`은 이 호출 시각, 마케팅은 체크했을 때만) + personality_assessments insert.
 * 이 훅은 그 호출을 **언제** 하는가만 정한다:
 *   - 세션이 생겼고(로그인 성공), 필수 동의가 전부 있고 만 14세 이상이며, 앞 화면 답이 전부 있을 때만 부른다. 하나라도 없으면 부르지 않는다.
 *   - 저장이 **실패하면 넘어가지 않는다**(`onSaved` 안 부름, 메모리의 답·동의는 그대로). 상태가 `failed`가 되고 `retry()`로 다시 시도한다.
 *   - 성공하면 메모리를 비우고(`resetSession`) `onSaved`를 부른다. 비우기 전에 `isFinished()`가 true가 되므로, 화면의 "동의 없이는 못 들어온다"
 *     되돌림이 성공 직후의 빈 메모리를 보고 잘못 작동하지 않는다.
 *   - 실패 뒤에는 자동으로 다시 부르지 않는다(세션 토큰이 갱신돼 세션 객체가 바뀌어도 반복하지 않는다) - 사람이 [다시 시도]를 누른다.
 */
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createProfileAndAssessment } from '../services/personalityApi'
import { useSessionStore } from '../store/sessionStore'
import { canEnterLogin } from '../utils/onboardingRules'

export type FinalizeStatus = 'idle' | 'saving' | 'failed'

export interface UseSignupFinalizeResult {
  status: FinalizeStatus
  retry: () => void
  /** 저장이 끝나 메모리를 비웠는가(렌더 밖에서 읽는 값). */
  isFinished: () => boolean
}

export function useSignupFinalize(session: Session | null, onSaved: () => void): UseSignupFinalizeResult {
  const [status, setStatus] = useState<FinalizeStatus>('idle')
  const finishedRef = useRef(false)
  const runningRef = useRef(false)
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const run = useCallback(async () => {
    const state = useSessionStore.getState()
    if (!session || runningRef.current || finishedRef.current) return
    if (!canEnterLogin(state.birthDate, state.consent, new Date())) return
    if (
      state.name.trim().length === 0 ||
      !state.gender ||
      !state.birthDate ||
      !state.mbti ||
      !state.q1 ||
      !state.q2 ||
      !state.q3 ||
      !state.q4 ||
      !state.q5 ||
      !state.result
    ) {
      return
    }

    runningRef.current = true
    setStatus('saving')
    try {
      await createProfileAndAssessment({
        userId: session.user.id,
        name: state.name,
        gender: state.gender,
        birthDate: state.birthDate,
        mbti: state.mbti,
        mbtiSelfReported: state.mbtiSelfReported,
        q1: state.q1,
        q2: state.q2,
        q3: state.q3,
        q4: state.q4,
        q5: state.q5,
        result: state.result,
        marketingAgreed: state.consent.marketing,
      })
    } catch {
      runningRef.current = false
      setStatus('failed')
      return
    }
    finishedRef.current = true
    runningRef.current = false
    state.resetSession()
    setStatus('idle')
    onSavedRef.current()
  }, [session])

  // 세션이 처음 생겼을 때 한 번 자동으로 저장한다. 실패(failed) 뒤에는 자동으로 다시 하지 않는다.
  useEffect(() => {
    if (session && status === 'idle') void run()
  }, [session, status, run])

  const retry = useCallback(() => {
    if (status === 'failed') void run()
  }, [status, run])

  const isFinished = useCallback(() => finishedRef.current, [])

  return { status, retry, isFinished }
}
