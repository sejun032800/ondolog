/**
 * A20 재표시(`67-`) - 상대가 설정 > 커플에서 사귄 날짜를 고쳤으면, 내가 **다음에 앱에 들어올 때** 사귄 날짜 확인(A20)을 다시 본다.
 *
 * 어디서: 탭 레이아웃(`app/(tabs)/_layout.tsx`)에 붙는다. 탭은 로그인한 사람이 온보딩을 마치고 들어오는 곳이라, 진행 단계가 이미 끝난 상대에게도 닿는다.
 * 언제: 탭이 처음 열릴 때(앱 시작 · 로그인 직후)와 앱 복귀(AppState `active`). 판정은 순수 함수 `needsStartDateConfirm`(정한 사람이 상대 · 확인한 사람 없음).
 * 어떻게: 사귄 날짜 라우트를 `?recheck=1`로 푸시한다 - 그 길은 확인(`start_date_confirmed_by`)만 쓰고 진행 단계는 건드리지 않는다.
 * 같은 값(커플 · 정한 사람 · 날짜)으로는 한 번만 연다 - 확인하면 `start_date_confirmed_by`가 채워져 판정 자체가 거짓이 된다.
 * 읽기만 한다. 실패하면 조용히 넘어간다(다음 복귀 때 다시 본다).
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { fetchMyActiveCouple } from '../services/settingsApi'
import { needsStartDateConfirm } from '../utils/settingsRules'
import { useSession } from './useSession'

export const START_DATE_RECHECK_PATH = '/start-date?recheck=1'

export function useStartDateRecheck(): void {
  const router = useRouter()
  const { session } = useSession()
  const userId = session?.user.id ?? null
  const shownRef = useRef<string | null>(null)
  const checkingRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const check = async () => {
      if (checkingRef.current) return
      checkingRef.current = true
      try {
        const couple = await fetchMyActiveCouple(userId)
        if (cancelled || !couple) return
        if (!needsStartDateConfirm(couple, userId)) return
        const key = `${couple.id}:${couple.start_date_set_by}:${couple.relationship_start_date}`
        if (shownRef.current === key) return
        shownRef.current = key
        router.push(START_DATE_RECHECK_PATH as never)
      } catch {
        // 다음 복귀 때 다시 본다.
      } finally {
        checkingRef.current = false
      }
    }

    void check()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check()
    })
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [userId, router])
}
