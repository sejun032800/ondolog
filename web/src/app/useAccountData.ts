/**
 * 로그인 유지 기반: 계정 구간(탭 · 스택)에 들어와 있고 로그인이 있으면 내 프로필 · 커플 상태를 서버에서 읽어 저장소(zustand)에 둔다.
 * 로그인이 사라지면(로그아웃 · 탈퇴) 둘 다 비운다. 기기 저장분(`cache/deviceCache`)은 로그아웃 · 탈퇴 요청이 지우고(`resetAccountMemory`), 여기서는 계정 전환만 지운다. 온보딩 중에는 읽지 않는다(가입 저장 전이라 값이 낡을 수 있다).
 * 세션 자체(`userId`)는 `auth/stores.ts`의 `useAuthStore`(앱 시작 때 `useBootSession`이 채움)다.
 */
import { useEffect } from 'react'
import { useAuthStore } from '../auth/stores'
import { purgeOtherUsers } from '../cache/deviceCache'
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
    // 76-A1: 다른 계정으로 로그인했으면 이전 계정의 기기 저장분을 지우고, 이 계정의 저장 요약이 있으면 서버 읽기 전에 먼저 채운다.
    purgeOtherUsers(userId)
    if (!inAccount) return
    useCoupleStore.getState().hydrate(userId)
    void useProfileStore.getState().refresh(userId)
    void useCoupleStore.getState().refresh(userId)
    void useDissolutionStore.getState().refresh(userId)
  }, [userId, inAccount])
}
