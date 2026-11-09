/**
 * 앱을 켤 때: 저장된 로그인(Preferences)이 있으면 서버 진행 단계(`profiles.onboarding_step`)로 바로 들어간다(앱을 다시 켜도 로그인 유지).
 * 로그인이 없거나 확인이 안 되면 조용히 첫 화면으로 간다. 환경 변수가 없으면 원격으로 가지 않는다.
 * 돌려주는 값은 "확인이 끝났는가" - 끝나기 전에는 첫 화면을 그리지 않는다(첫 화면이 잠깐 보였다 바뀌는 일 방지).
 */
import { useEffect, useRef, useState } from 'react'
import type { Nav } from '../screens'
import { getSupabase } from './client'
import { fetchProfile, webRouteForStep } from './finalize'
import { withJwtRetry } from './retry'
import { useAuthStore } from './stores'

/** 네트워크가 막혀 확인이 길어져도 첫 화면은 이 시간 안에 보인다. */
export const BOOT_TIMEOUT_MS = 4000

export function useBootSession(nav: Nav): boolean {
  const [done, setDone] = useState(() => getSupabase() === null)
  const navRef = useRef(nav)
  navRef.current = nav

  useEffect(() => {
    const db = getSupabase()
    if (!db) return
    let cancelled = false
    const finish = () => {
      if (!cancelled) setDone(true)
    }
    const timer = window.setTimeout(finish, BOOT_TIMEOUT_MS)
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setUserId(session?.user.id ?? null)
    })
    void (async () => {
      try {
        const { data } = await db.auth.getSession()
        const id = data.session?.user.id
        if (id) {
          useAuthStore.getState().setUserId(id)
          const profile = await withJwtRetry(() => fetchProfile(db, id))
          if (profile && !cancelled) navRef.current.enterAccount(webRouteForStep(profile.onboarding_step))
        }
      } catch {
        // 조용히 첫 화면으로 간다.
      } finally {
        finish()
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
  }, [])

  return done
}
