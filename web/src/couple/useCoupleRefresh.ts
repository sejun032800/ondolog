/**
 * 커플 값 다시 읽기(A-19) - 연결 여부 · 닉네임 · 사귄 날짜 · 해제 유예는 앱 시작 때만 읽혀 상대 폰에서 바뀐 값이 늦게 보였다.
 * 메인 · 설정 · 채팅(스토리) 탭이 이 훅 하나를 쓴다:
 *  - 탭에 들어올 때(탭 화면은 옮길 때마다 새로 그려진다) 한 번,
 *  - 앱이 앞으로 돌아올 때(`platform/appResume`: Capacitor resume / visibilitychange) 한 번 다시 읽는다.
 * 읽는 일은 `stores/coupleRefresh`(한 번에 하나). 로그인이 없으면 아무것도 하지 않는다.
 */
import { useEffect } from 'react'
import { useAuthStore } from '../auth/stores'
import { onAppResume } from '../platform/appResume'
import { refreshCoupleState } from '../stores/coupleRefresh'

export function useCoupleRefresh(enabled = true): void {
  const userId = useAuthStore((s) => s.userId)
  useEffect(() => {
    if (!enabled || !userId) return
    void refreshCoupleState(userId)
    return onAppResume(() => { void refreshCoupleState(userId) })
  }, [enabled, userId])
}
