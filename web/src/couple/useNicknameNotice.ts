/**
 * R101-5 닉네임 변경 안내 - F1(`useStartDateRecheck`, 사귄 날짜)과 같은 방식: 상대가 커플 닉네임을 바꿨으면 내가 **다음에 앱을 열거나 메인으로 돌아올 때**
 * 앱 안에 한 번 "{상대}님이 커플 닉네임을 바꿨어요" + 둘째 줄 새 값(`nickname-recheck`)을 보인다.
 *
 * 판정(순수 함수 `needsNicknameNotice`): 78-m1 `couples.nickname_changed_by`(이미 있던 닉네임을 바꾼 사람 - 트리거만 채운다)가 상대일 때. 내가 바꾼 것 · 처음 정하기에는 0.
 * 한 번만: 같은 값(커플 · 바꾼 사람 · 새 닉네임)으로는 한 번 - 띄운 순간 기기에 "봤음"(`main` 범주 · `nickNotice` - 커플 자료 삭제 규칙에 든다).
 * 언제: 탭이 처음 열릴 때 · 메인으로 돌아올 때 · 앱이 앞으로 돌아올 때. 오프라인 · 실패는 조용히(다음 때 다시).
 */
import { useEffect, useRef } from 'react'
import { getSupabase } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { readCache, writeCache } from '../cache/deviceCache'
import type { Nav } from '../navigation'
import { onAppResume } from '../platform/appResume'
import { fetchMyActiveCouple } from './coupleApi'

export const NICKNAME_NOTICE_SCOPE = 'nickNotice'

interface NicknameRow {
  id: string
  nickname: string | null
  nickname_changed_by?: string | null
}

export function needsNicknameNotice(couple: NicknameRow | null, userId: string | null): boolean {
  if (!couple || !userId || !couple.nickname) return false
  const by = couple.nickname_changed_by ?? null
  return by !== null && by !== userId
}

export function nicknameNoticeKey(couple: NicknameRow): string {
  return `${couple.id}:${couple.nickname_changed_by ?? ''}:${couple.nickname ?? ''}`
}

export function useNicknameNotice(nav: Nav, enabled: boolean, onMain = false): void {
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
        const couple = (await fetchMyActiveCouple(db, userId)) as unknown as NicknameRow | null
        if (cancelled || !couple || !needsNicknameNotice(couple, userId)) return
        const key = nicknameNoticeKey(couple)
        if (shownRef.current === key) return
        if (readCache<{ key: string }>(userId, 'main', NICKNAME_NOTICE_SCOPE)?.key === key) return
        shownRef.current = key
        writeCache(userId, 'main', { key }, NICKNAME_NOTICE_SCOPE)
        navRef.current.push('nickname-recheck', { urgent: true })
      } catch {
        // 다음 열기 · 메인 복귀 · 앱 복귀 때 다시
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

  const wasOnMain = useRef(onMain)
  useEffect(() => {
    if (onMain && !wasOnMain.current) checkRef.current()
    wasOnMain.current = onMain
  }, [onMain])
}
