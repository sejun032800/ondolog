/**
 * 상대의 해제 알림(`68-`, 앱 안 표시뿐 - 푸시 없음) - 상대가 연결 해제(또는 탈퇴)를 요청했으면, 내가 **앱에 들어올 때 처음** 커플 화면(H14 유예 화면)을 한 번 보인다.
 *
 * 어디서: 탭 레이아웃(`app/(tabs)/_layout.tsx`)에 붙는다(`useStartDateRecheck`와 같은 자리 · 같은 방식). 설정 > 연인 줄로도 언제든 볼 수 있다.
 * 언제: 탭이 처음 열릴 때와 앱 복귀(AppState `active`). 내가 개시자면 열지 않는다(스스로 한 일). 같은 해제 행(id)은 앱을 켠 동안 한 번만 연다.
 * 읽기만 한다. 실패하면 조용히 넘어간다(다음 복귀 때 다시 본다).
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useDissolutionStore } from '../store/dissolutionStore'
import { useSession } from './useSession'

export const DISSOLUTION_NOTICE_PATH = '/settings-couple'

export function useDissolutionNotice(): void {
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
        await useDissolutionStore.getState().refresh(userId)
        const { dissolution } = useDissolutionStore.getState()
        if (cancelled || !dissolution || dissolution.initiatedByMe) return
        if (shownRef.current === dissolution.dissolutionId) return
        shownRef.current = dissolution.dissolutionId
        router.push(DISSOLUTION_NOTICE_PATH as never)
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
