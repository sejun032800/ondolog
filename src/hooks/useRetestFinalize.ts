/**
 * 재검사 저장(`67-`, H05 -> A04~A07 뒤) - 방금 푼 5문항(메모리 `sessionStore`)을 새 assessment 행 + 한 번의 UPDATE로 저장한다(`settingsCore.retestPersonality`).
 *
 * 화면 상태는 글자로만 보인다(스피너 없음): `idle` -> `saving` -> (`done` | `error`). 실패 종류에 따라 [다시 시도]가 의미가 있는지가 갈린다 -
 * `failed`(네트워크 · 서버)는 다시 시도할 수 있고, `already-used`는 다시 보내도 같다(`retryable` = false).
 * 성공하면 메모리 답을 비운다(`resetSession`) - 이 값은 저장소에 남기지 않는다.
 */
import { useCallback, useState } from 'react'
import { RetestError, type RetestErrorKind } from '../services/settingsCore'
import { retestPersonality } from '../services/settingsApi'
import { useSessionStore } from '../store/sessionStore'

export type RetestPhase = 'idle' | 'saving' | 'error' | 'done'

export interface UseRetestFinalize {
  phase: RetestPhase
  errorKind: RetestErrorKind | null
  /** 오류 문구(화면이 그대로 보인다). */
  errorMessage: string | null
  retryable: boolean
  /** 저장한다. 성공하면 `'saved'`(또는 복구된 `'recovered'`). 실패하거나 답이 덜 찼으면(아무것도 보내지 않음) false. */
  run: (userId: string) => Promise<false | 'saved' | 'recovered'>
}

export function useRetestFinalize(): UseRetestFinalize {
  const [phase, setPhase] = useState<RetestPhase>('idle')
  const [errorKind, setErrorKind] = useState<RetestErrorKind | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const run = useCallback(async (userId: string): Promise<false | 'saved' | 'recovered'> => {
    const { mbti, mbtiSelfReported, q1, q2, q3, q4, q5, result } = useSessionStore.getState()
    if (!mbti || !q1 || !q2 || !q3 || !q4 || !q5 || !result) return false
    setPhase('saving')
    setErrorKind(null)
    setErrorMessage(null)
    try {
      const outcome = await retestPersonality(userId, { mbti, mbtiSelfReported, q1, q2, q3, q4, q5, result })
      useSessionStore.getState().resetSession()
      setPhase('done')
      // 'recovered' = 끊겼던 재검사를 서버가 기존 행으로 마저 끝냈다 - 저장된 결과가 방금 답한 것과 다를 수 있다.
      return outcome.recovered ? 'recovered' : 'saved'
    } catch (e) {
      const err = e instanceof RetestError ? e : new RetestError('failed')
      setErrorKind(err.kind)
      setErrorMessage(err.message)
      setPhase('error')
      return false
    }
  }, [])

  return { phase, errorKind, errorMessage, retryable: errorKind === 'failed', run }
}
