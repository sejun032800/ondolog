/**
 * 상대의 해제 알림(RN `useDissolutionNotice`의 웹판, 앱 안 표시뿐 - 푸시 없음) - 상대가 연결 해제(또는 탈퇴)를 요청했으면, 내가 **앱에 들어올 때 처음** 커플 화면(H14 유예 화면)을 한 번 보인다.
 *
 * 어디서: Shell이 탭 화면에 있을 때만 켠다(`enabled`, `useStartDateRecheck`와 같은 자리 · 같은 방식). 설정 > 연인 줄로도 언제든 볼 수 있다.
 * 언제: 탭이 처음 열릴 때(앱 시작 · 로그인 직후)와 앱이 다시 보일 때(`visibilitychange` - RN의 AppState `active`). 내가 개시자면 열지 않는다(스스로 한 일).
 * 같은 해제 행(id)은 앱을 켠 동안 한 번만 연다. 읽기만 한다. 실패하면 조용히 넘어간다(다음 복귀 때 다시 본다).
 */
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { useDissolutionStore } from '../../stores/dissolutionStore'

export function useDissolutionNotice(nav: Nav, enabled: boolean): void {
  const userId = useAuthStore((s) => s.userId)
  const navRef = useRef(nav)
  navRef.current = nav
  const shownRef = useRef<string | null>(null)
  const checkingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false

    const check = async () => {
      if (checkingRef.current) return
      checkingRef.current = true
      try {
        await useDissolutionStore.getState().refresh(userId)
        const { dissolution } = useDissolutionStore.getState()
        if (cancelled || !dissolution || dissolution.initiatedByMe) return
        if (shownRef.current === dissolution.dissolutionId) return
        shownRef.current = dissolution.dissolutionId
        navRef.current.push('settings-couple', { urgent: true })
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
