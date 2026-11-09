/**
 * A20 재표시(RN `useStartDateRecheck`의 웹판) - 상대가 설정 > 커플에서 사귄 날짜를 고쳤으면, 내가 **다음에 앱에 들어올 때** 사귄 날짜 확인(A20)을 다시 본다.
 *
 * 어디서: Shell이 탭 화면에 있을 때만 켠다(`enabled`). 탭은 로그인한 사람이 온보딩을 마치고 들어오는 곳이라, 진행 단계가 이미 끝난 상대에게도 닿는다.
 * 언제: 탭이 처음 열릴 때(앱 시작 · 로그인 직후)와 앱이 다시 보일 때(`visibilitychange` - RN의 AppState `active`).
 * 판정: 순수 함수 `needsStartDateConfirm`(정한 사람이 상대 · 확인한 사람 없음). 읽기만 한다. 실패하면 조용히 넘어간다(다음 복귀 때 다시 본다).
 * 어떻게: `start-date-recheck` 스택 화면을 푸시한다 - 그 길은 확인만 쓰고 진행 단계는 건드리지 않는다.
 * 같은 값(커플 · 정한 사람 · 날짜)으로는 한 번만 연다 - 확인하면 `start_date_confirmed_by`가 채워져 판정 자체가 거짓이 된다.
 */
import { useEffect, useRef } from 'react'
import { needsStartDateConfirm } from '@/utils/settingsRules'
import { getSupabase } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import type { Nav } from '../navigation'
import { fetchMyActiveCouple } from './coupleApi'

export function useStartDateRecheck(nav: Nav, enabled: boolean): void {
  const userId = useAuthStore((s) => s.userId)
  const navRef = useRef(nav)
  navRef.current = nav
  const shownRef = useRef<string | null>(null)
  const checkingRef = useRef(false)

  useEffect(() => {
    const db = getSupabase()
    if (!enabled || !userId || !db) return
    let cancelled = false

    const check = async () => {
      if (checkingRef.current) return
      checkingRef.current = true
      try {
        const couple = await fetchMyActiveCouple(db, userId)
        if (cancelled || !couple) return
        if (!needsStartDateConfirm(couple, userId)) return
        const key = `${couple.id}:${couple.start_date_set_by}:${couple.relationship_start_date}`
        if (shownRef.current === key) return
        shownRef.current = key
        navRef.current.push('start-date-recheck', { urgent: true })
      } catch {
        // 다음 복귀 때 다시 본다.
      } finally {
        checkingRef.current = false
      }
    }

    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, userId])
}
