/**
 * 로그인 직후 분기 + 가입 마무리 - 로그인 뒤 **언제 무엇을** 할지 정한다(MASTER 6-5, R37-6 규칙 12, r70 R38-3).
 *
 * 로그인이 되면 먼저 `profiles`를 조회하고, 순수 함수 `decideAfterLogin`이 고른 길로 간다:
 *   - `existing` (프로필이 이미 있다): **저장 경로를 부르지 않는다.** 메모리의 답·동의를 버리고(`resetSession`) 서버의 진행 단계로 들어간다.
 *   - `save` (프로필이 없고 답·동의가 메모리에 있다): 기존 경로 `createProfileAndAssessment`(없을 때만 넣기)로 저장한다.
 *     저장이 **실패하면 넘어가지 않는다**(`failed`, 메모리 그대로, `retry()`로 다시). 성공하면 메모리를 비우고 `/result-detail`로.
 *   - `answers` (프로필이 없고 답이 비었다 - 이미 계정 길 · 로그인 사이 앱 종료): 로그인한 채 A03부터 다시.
 *   - `consent` (프로필이 없고 답은 있는데 동의가 비었다): 로그인한 채 A10부터.
 * 가입 도중 저장이 끊겨 프로필만 들어가고 검사는 없는 상태에서 메모리 답이 온전하면 `save`로 끝까지 간다(`decideAfterLogin` 주석).
 *
 * 다른 규칙:
 *   - `auto`(기본 true)면 세션이 처음 생겼을 때 한 번 자동으로 시작한다(A11). `auto: false`면 `start()`를 부를 때만 시작한다
 *     (이미 로그인한 채 A10에서 [동의하고 시작하기]를 누를 때 - A11을 건너뛴다).
 *   - 실패(`failed`) 뒤에는 자동으로 다시 하지 않는다(세션 토큰이 갱신돼 세션 객체가 바뀌어도 반복하지 않는다) - 사람이 [다시 시도]를 누른다.
 *   - 성공하면 `isFinished()`가 true가 되고, 화면의 "동의 없이는 못 들어온다" 되돌림이 빈 메모리를 잘못 보지 않는다.
 *   - 이 훅은 로그인 전에는 서버를 부르지 않는다(세션이 있어야 시작).
 */
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createProfileAndAssessment, fetchLatestAssessment, fetchProfile } from '../services/personalityApi'
import { useSessionStore } from '../store/sessionStore'
import { canEnterLogin, decideAfterLogin, hasCompleteAnswers } from '../utils/onboardingRules'
import { resolveResumePath } from './resolveResumePath'

export type FinalizeStatus = 'idle' | 'saving' | 'failed'

export interface UseSignupFinalizeResult {
  status: FinalizeStatus
  /** 실패 뒤 [다시 시도]. */
  retry: () => void
  /** 로그인한 채 A10에서 누를 때 시작(`auto: false`일 때). 실패 상태에서도 다시 시작한다. */
  start: () => void
  /** 분기가 끝나 메모리를 비웠는가(렌더 밖에서 읽는 값). */
  isFinished: () => boolean
}

export interface UseSignupFinalizeOptions {
  /** 세션이 처음 생기면 자동으로 시작할지. 기본 true. */
  auto?: boolean
}

/** `onResolved`는 분기가 끝나 이동할 경로를 받는다(`/result-detail` · 서버 진행 단계 경로 · `/basic-info` · `/consent`). */
export function useSignupFinalize(
  session: Session | null,
  onResolved: (path: string) => void,
  options: UseSignupFinalizeOptions = {},
): UseSignupFinalizeResult {
  const auto = options.auto ?? true
  const [status, setStatus] = useState<FinalizeStatus>('idle')
  const finishedRef = useRef(false)
  const runningRef = useRef(false)
  const autoRanRef = useRef(false)
  const onResolvedRef = useRef(onResolved)
  onResolvedRef.current = onResolved

  const run = useCallback(async () => {
    if (!session || runningRef.current || finishedRef.current) return
    const userId = session.user.id

    runningRef.current = true
    setStatus('saving')
    try {
      const state = useSessionStore.getState()
      const answersComplete = hasCompleteAnswers(state)
      const consentComplete = canEnterLogin(state.birthDate, state.consent, new Date())

      const profile = await fetchProfile(userId)
      // 프로필이 있고 메모리 답이 온전할 때만 검사 행을 확인한다(저장이 중간에 끊긴 흔적인지 가르기 위해).
      const hasAssessment =
        profile && answersComplete && consentComplete ? (await fetchLatestAssessment(userId)) !== null : true

      const action = decideAfterLogin({
        hasProfile: profile !== null,
        hasAssessment,
        answersComplete,
        consentComplete,
      })

      if (action === 'existing' && profile) {
        // 기존 계정: 저장 경로 호출 0. 메모리의 답·동의는 버리고 서버 진행 단계로.
        const path = await resolveResumePath(profile)
        finishedRef.current = true
        useSessionStore.getState().resetSession()
        runningRef.current = false
        setStatus('idle')
        onResolvedRef.current(path)
        return
      }

      if (action === 'answers' || action === 'consent') {
        runningRef.current = false
        setStatus('idle')
        onResolvedRef.current(action === 'answers' ? '/basic-info' : '/consent')
        return
      }

      // action === 'save'
      await createProfileAndAssessment({
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
      finishedRef.current = true
      runningRef.current = false
      useSessionStore.getState().resetSession()
      setStatus('idle')
      onResolvedRef.current('/result-detail')
    } catch {
      runningRef.current = false
      setStatus('failed')
    }
  }, [session])

  // 세션이 처음 생겼을 때 한 번 자동으로 시작한다. 실패(failed) 뒤에는 자동으로 다시 하지 않는다.
  useEffect(() => {
    if (!auto || !session || status !== 'idle' || autoRanRef.current) return
    autoRanRef.current = true
    void run()
  }, [auto, session, status, run])

  const retry = useCallback(() => {
    if (status === 'failed') void run()
  }, [status, run])

  const start = useCallback(() => {
    if (status !== 'saving') void run()
  }, [status, run])

  const isFinished = useCallback(() => finishedRef.current, [])

  return { status, retry, start, isFinished }
}
