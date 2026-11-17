/**
 * 로그인 유지 기반: 계정 구간(탭 · 스택)에 들어와 있고 로그인이 있으면 내 프로필 · 커플 상태를 서버에서 읽어 저장소(zustand)에 둔다.
 * 로그인이 사라지면(로그아웃 · 탈퇴) 둘 다 비운다. 기기 저장분(`cache/deviceCache`)은 로그아웃 · 탈퇴 요청이 지우고(`resetAccountMemory`), 여기서는 계정 전환만 지운다. 온보딩 중에는 읽지 않는다(가입 저장 전이라 값이 낡을 수 있다).
 * 세션 자체(`userId`)는 `auth/stores.ts`의 `useAuthStore`(앱 시작 때 `useBootSession`이 채움)다.
 */
import { useEffect } from 'react'
import { useAuthStore } from '../auth/stores'
import { purgeOtherUsers, sweepDeviceCache } from '../cache/deviceCache'
import { startQueueOwnerPurge } from '../cache/queueOwner'
import { claimThisDevice, clearDeliveredHere } from '../push/pushCore'
import { useConnectionStore } from '../connection/connectionMonitor'
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
    const switched = purgeOtherUsers(userId) > 0
    // 82-(R120-4): 다른 계정이 로그인하는 순간 이전 주인의 글 · 사진 대기열 항목(+ 사진 파일)을 지운다(R118-2와 같은 원칙). 같은 계정이면 지울 것 0(R39-5 b).
    // 로그아웃이 위 기기 저장분을 이미 지웠어도(전환 신호 0) 대기열은 항목 주인으로 판정한다. 지운 건수는 숫자뿐(오류 기록 0). 대기열 읽기는 이것이 끝난 뒤.
    void startQueueOwnerPurge(userId)
    // 81-(R117-2): 이 계정의 기기 저장 범주를 한 번 훑어 깨진 · 옛 버전 값을 미리 버린다(실패해도 시작은 그대로 - 던지지 않음).
    sweepDeviceCache(userId)
    // 78-: 같은 자리 - 이 기기에 남은 다른 사람의 알림 토큰 행을 지운다(계정 전환).
    // 76-i: 다른 사람의 저장분이 있었으면(계정 전환) 그 사람의 알림이 남은 서랍을 먼저 지운다. 같은 사람의 앱 시작 · 재로그인에는 0.
    void (async () => {
      if (switched) await clearDeliveredHere()
      await claimThisDevice()
    })()
    if (!inAccount) return
    useCoupleStore.getState().hydrate(userId)
    void useProfileStore.getState().refresh(userId)
    void useCoupleStore.getState().refresh(userId)
    void useDissolutionStore.getState().refresh(userId)
  }, [userId, inAccount])

  // 81-b: 오프라인으로 시작해 못 읽은 계정 상태는 연결이 돌아오면(끊김 -> 풀림) 다시 읽는다 - 자리 표시가 그대로 남지 않게.
  useEffect(() => {
    if (!userId || !inAccount) return
    return useConnectionStore.subscribe((s, prev) => {
      if (!prev.offline || s.offline) return
      void useProfileStore.getState().refresh(userId)
      void useCoupleStore.getState().refresh(userId)
      void useDissolutionStore.getState().refresh(userId)
    })
  }, [userId, inAccount])
}
