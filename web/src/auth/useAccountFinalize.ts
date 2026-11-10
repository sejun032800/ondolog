/**
 * 로그인 뒤 분기 + 저장을 화면에서 쓰는 훅(RN `useSignupFinalize`의 웹판).
 * 실패하면 넘어가지 않고 `failed`로 남는다 - 메모리의 답 · 동의는 그대로이고 `start()`로 다시 한다.
 * 저장 중에는 두 번 시작하지 않는다.
 */
import { useCallback, useRef, useState } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import type { Nav } from '../screens'
import { IS_TRIAL_BUILD } from '../config/env'
import { safeKind, useTrialDiag } from '../platform/trialDiag'
import { getSupabase } from './client'
import { EXISTING_ACCOUNT_NOTICE, finalizeAfterLogin, resolveWebRoute } from './finalize'
import { useAuthStore, useNoticeStore } from './stores'

export type FinalizeStatus = 'idle' | 'saving' | 'failed'

export function useAccountFinalize(nav: Nav): { status: FinalizeStatus; start: () => void } {
  const [status, setStatus] = useState<FinalizeStatus>('idle')
  const running = useRef(false)
  const navRef = useRef(nav)
  navRef.current = nav

  const start = useCallback(() => {
    const db = getSupabase()
    const userId = useAuthStore.getState().userId
    if (!db || !userId || running.current) return
    running.current = true
    setStatus('saving')
    void (async () => {
      try {
        const outcome = await finalizeAfterLogin(db, userId, useSessionStore.getState())
        const n = navRef.current
        if (outcome.kind === 'existing') {
          // 기존 계정: 저장 0. 메모리의 답 · 동의는 버리고 서버 진행 단계로. 방금 본 결과가 있었던 경우에만 한 번 알린다.
          useSessionStore.getState().resetSession()
          if (outcome.hadResult) useNoticeStore.getState().show(EXISTING_ACCOUNT_NOTICE)
          const route = await resolveWebRoute(db, userId, outcome.step, outcome.deletedAt)
          setStatus('idle')
          n.enterAccount(route)
        } else if (outcome.kind === 'saved') {
          useSessionStore.getState().resetSession()
          setStatus('idle')
          n.enterAccount('detail')
        } else {
          setStatus('idle')
          n.reset(outcome.kind === 'answers' ? 'basic' : 'consent')
        }
      } catch (e) {
        if (IS_TRIAL_BUILD) useTrialDiag.getState().record('finalize', safeKind(e))
        setStatus('failed')
      } finally {
        running.current = false
      }
    })()
  }, [])

  return { status, start }
}
