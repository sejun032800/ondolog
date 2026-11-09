/**
 * 로그인 유지 기반: 계정 구간(탭 · 스택)에 들어와 있고 로그인이 있으면 내 프로필 · 커플 상태를 서버에서 읽어 저장소(zustand)에 둔다.
 * 로그인이 사라지면(로그아웃 · 탈퇴) 둘 다 비운다. 온보딩 중에는 읽지 않는다(가입 저장 전이라 값이 낡을 수 있다).
 * 세션 자체(`userId`)는 `auth/stores.ts`의 `useAuthStore`(앱 시작 때 `useBootSession`이 채움)다.
 */
import { useEffect } from 'react'
import { useAuthStore } from '../auth/stores'
import { useCoupleStore } from '../stores/coupleStore'
import { useDissolutionStore } from '../stores/dissolutionStore'
import { useProfileStore } from '../stores/profileStore'
import { isAccountRoute, type ScreenName } from './routes'

export function useAccountData(route: ScreenName | null): void {
  const userId = useAuthStore((s) => s.userId)
  const inAccount = isAccountRoute(route)
  useEffect(() => {
    if (!userId) {
      useProfileStore.getState().reset()
      useCoupleStore.getState().reset()
      useDissolutionStore.getState().reset()
      return
    }
    if (!inAccount) return
    void useProfileStore.getState().refresh(userId)
    void useCoupleStore.getState().refresh(userId)
  }, [userId, inAccount])
}
