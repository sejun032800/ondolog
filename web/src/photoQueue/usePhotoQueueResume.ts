/**
 * 사진 큐 재개(RN `hooks/useChatQueueResume.ts`의 웹판, R39-5) - Shell에 한 번 붙는다. 채팅 탭을 열지 않아도 앱을 켜면 남은 사진이 보내진다.
 *
 *   1. 앱 시작: 로그인했고 커플 연결이 확인되면(`resolveChatQueueTarget`) 허브에 붙여 기기에 저장된 항목을 이어서 보낸다.
 *   2. 앱 복귀: 화면이 다시 보일 때(`visibilitychange` = RN AppState `active`) 남은 항목을 바로 이어서 보낸다(`kick`).
 *   3. 로그아웃 · 미연결: 허브를 멈춘다(기기 저장은 지우지 않는다). 커플 확인이 다시 도는 중(`loading`)에는 돌던 큐를 끊지 않는다.
 * 큐는 허브 한 곳이 갖는다 - 채팅 화면도 같은 허브에 붙으므로 같은 항목이 두 번 올라가지 않는다.
 */
import { useEffect } from 'react'
import { resolveChatQueueTarget } from '@/utils/chatQueueResume'
import { useAuthStore } from '../auth/stores'
import { useCoupleStore } from '../stores/coupleStore'
import { photoQueueHub, type PhotoQueueHub } from './photoQueueHub'

export function usePhotoQueueResume(hub: PhotoQueueHub = photoQueueHub): void {
  const userId = useAuthStore((s) => s.userId)
  const status = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)

  useEffect(() => {
    const target = resolveChatQueueTarget({ userId, coupleStatus: status, coupleId })
    if (!target) {
      if (status !== 'loading') hub.detach()
      return
    }
    hub.attach(target.coupleId, target.userId)
  }, [hub, userId, status, coupleId])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') hub.kick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [hub])
}
