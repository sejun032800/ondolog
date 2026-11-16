/**
 * A20 재표시(RN `useStartDateRecheck`의 웹판) - 상대가 설정 > 커플에서 사귄 날짜를 고쳤으면, 내가 **다음에 앱을 열거나 메인으로 돌아올 때** 앱 안에 한 번
 * "{상대}님이 사귄 날짜를 바꿨어요" + 새 값(`start-date-recheck`)을 보인다(R102-3 · F1).
 *
 * 어디서: Shell이 탭 화면에 있을 때만 켠다(`enabled`). 탭은 로그인한 사람이 온보딩을 마치고 들어오는 곳이라, 진행 단계가 이미 끝난 상대에게도 닿는다.
 * 언제(76-r F1 원인 수정): 탭이 처음 열릴 때(앱 시작 · 로그인 직후) · **메인 탭으로 돌아올 때**(`onMain`이 거짓 -> 참) · 앱이 앞으로 돌아올 때(`onAppResume` -
 *   Capacitor `resume` + `visibilitychange`). 전에는 탭끼리 옮겨도 `enabled`가 계속 참이라 다시 보지 않았다(설정 -> 메인으로 와도 안내 0).
 * 판정: 순수 함수 `needsStartDateConfirm`(정한 사람이 상대 · 확인한 사람 없음) - 내가 바꾼 것(`start_date_set_by` = 나)에는 뜨지 않는다. 읽기만 한다.
 *   오프라인 · 실패면 조용히 넘어간다(다음 열기 · 메인 복귀 · 복귀 때 다시 본다 = 다음 온라인 때).
 * 한 번만: 같은 값(커플 · 정한 사람 · 날짜)으로는 한 번만 연다 - 띄운 순간 기기에 "봤음"을 남긴다(`main` 저장 범주 · `dateNotice` - 커플 자료 삭제 규칙에 이미 든다).
 *   [확인했어요]를 누르면 `start_date_confirmed_by`가 채워져(기존 쓰기) 판정 자체도 거짓이 된다. 뒤로 닫아도 같은 값으로는 다시 뜨지 않는다.
 */
import { useEffect, useRef } from 'react'
import { needsStartDateConfirm } from '@/utils/settingsRules'
import { getSupabase } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { readCache, writeCache } from '../cache/deviceCache'
import type { Nav } from '../navigation'
import { onAppResume } from '../platform/appResume'
import { fetchMyActiveCouple } from './coupleApi'

/** 기기에 남기는 "이 값의 날짜 변경 안내를 봤다" 표시(scope). */
export const DATE_NOTICE_SCOPE = 'dateNotice'

export function startDateNoticeKey(couple: { id: string; start_date_set_by: string | null; relationship_start_date: string | null }): string {
  return `${couple.id}:${couple.start_date_set_by}:${couple.relationship_start_date}`
}

export function useStartDateRecheck(nav: Nav, enabled: boolean, onMain = false): void {
  const userId = useAuthStore((s) => s.userId)
  const navRef = useRef(nav)
  navRef.current = nav
  const shownRef = useRef<string | null>(null)
  const checkingRef = useRef(false)
  const checkRef = useRef<() => void>(() => {})

  useEffect(() => {
    const db = getSupabase()
    if (!enabled || !userId || !db) { checkRef.current = () => {}; return }
    let cancelled = false

    const check = async () => {
      if (checkingRef.current) return
      checkingRef.current = true
      try {
        const couple = await fetchMyActiveCouple(db, userId)
        if (cancelled || !couple) return
        if (!needsStartDateConfirm(couple, userId)) return
        const key = startDateNoticeKey(couple)
        if (shownRef.current === key) return
        if (readCache<{ key: string }>(userId, 'main', DATE_NOTICE_SCOPE)?.key === key) return
        shownRef.current = key
        writeCache(userId, 'main', { key }, DATE_NOTICE_SCOPE)
        navRef.current.push('start-date-recheck', { urgent: true })
      } catch {
        // 다음 열기 · 메인 복귀 · 앱 복귀 때 다시 본다.
      } finally {
        checkingRef.current = false
      }
    }
    checkRef.current = () => { void check() }

    void check()
    const off = onAppResume(() => { void check() })
    return () => {
      cancelled = true
      checkRef.current = () => {}
      off()
    }
  }, [enabled, userId])

  // 메인 탭으로 돌아올 때(다른 탭 · 설정에서). 첫 마운트는 위 효과가 이미 본다.
  const wasOnMain = useRef(onMain)
  useEffect(() => {
    if (onMain && !wasOnMain.current) checkRef.current()
    wasOnMain.current = onMain
  }, [onMain])
}
