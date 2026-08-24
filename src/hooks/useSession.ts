/**
 * 현재 Supabase 인증 세션을 구독하는 훅.
 *
 * Part 11-1 라우팅 분기("로그인 세션 없음/있음")의 기준이 되는 단일
 * 진실 소스. `.env`의 anon key가 플레이스홀더 상태인 동안에는 실제
 * 세션 응답을 받을 수 없다(`.claude/state/HANDOFF.md` 참조) — 이 훅
 * 자체는 세션이 없을 때와 아직 확인 중일 때를 구분해 반환한다.
 */
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

interface SessionState {
  session: Session | null
  /** true인 동안은 "로그인 세션 없음"으로 단정하지 않는다(초기 확인 중). */
  loading: boolean
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session, loading: false })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) setState({ session, loading: false })
      },
    )

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return state
}
