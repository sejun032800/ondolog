/**
 * 글 큐 재개 + 대기 신호(RN `hooks/useChatQueueResume.ts`의 글 쪽 웹판, R39-5) - Shell에 한 번 붙는다(사진 큐는 `photoQueue/usePhotoQueueResume`).
 *
 *   1. 앱 시작: 로그인했고 커플 연결이 확인되면(`resolveChatQueueTarget`) 글 큐 허브에 붙여 기기에 저장된 항목을 이어서 보낸다.
 *   2. 앱 복귀: 화면이 다시 보일 때(`visibilitychange`) 남은 글을 바로 이어서 보낸다(`kick`).
 *   3. 로그아웃 · 미연결: 허브를 멈춘다(기기 저장은 지우지 않는다). 커플 확인이 다시 도는 중(`loading`)에는 돌던 큐를 끊지 않는다.
 *   3-1. 다시 연결 감지(`online` 이벤트 · 끊김 띠 풀림) 즉시 큐를 한 번 비운다(76-C1).
 *   4. 글 · 사진 큐 중 자동 재시도 중인 항목(`pending`)이 하나라도 있으면 `setChatQueueWaiting(true)` - 채팅 화면에서 I02 띠가 자리를 내준다(`ConnectionBanner`).
 * 채팅 화면도 같은 허브에 붙으므로(같은 커플 · 사용자면 아무 일도 없다) 같은 글이 두 번 가지 않는다.
 */
import { useEffect } from 'react'
import { resolveChatQueueTarget } from '@/utils/chatQueueResume'
import { useAuthStore } from '../../auth/stores'
import { setChatQueueWaiting } from '../../connection/chatQueueSignal'
import { deviceSaysOffline, useConnectionStore } from '../../connection/connectionMonitor'
import { photoWaitingForRetry } from '../../connection/queueNotice'
import { photoQueueHub, type PhotoQueueHub } from '../../photoQueue/photoQueueHub'
import { useCoupleStore } from '../../stores/coupleStore'
import { textQueueHub, type TextQueueHub } from './textQueueHub'

/** 다시 연결 감지 뒤 한 번씩 더 찔러 보는 시각(ms). */
export const RECONNECT_FOLLOW_UP_MS = [1_000, 2_000, 4_000] as const

export function useChatQueueResume(hub: TextQueueHub = textQueueHub, photoHub: PhotoQueueHub = photoQueueHub): void {
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

  // 76-C1: 다시 연결을 알아챈 즉시(브라우저 `online` 이벤트 · 끊김 띠가 풀린 순간 = 확인 요청 성공) 남은 글 · 사진을 한 번 바로 보낸다 - 다음 백오프 시각(15~20초)까지 기다리지 않는다.
  // 진행 중인 항목은 허브가 건드리지 않아 겹쳐 보내지 않는다.
  // 76-r F6(R102-4): 기기 네트워크 상태 이벤트(`online` · `navigator.connection`의 `change`)에서 바로 비우고, 잠깐 뒤(1 · 2 · 4초) 한 번씩 더 찔러 본다.
  // 비행기 모드를 끈 직후 첫 시도는 경로가 아직 안 잡혀 실패하기 쉽고, 그러면 다음 백오프(약 8~16초)까지 기다렸다(폰 약 10초). kick은 진행 중 항목을 건드리지 않아 겹쳐 보내지 않는다.
  useEffect(() => {
    const kickAll = () => { hub.kick(); photoHub.kick() }
    let timers: ReturnType<typeof setTimeout>[] = []
    const burst = () => {
      timers.forEach(clearTimeout)
      kickAll()
      timers = RECONNECT_FOLLOW_UP_MS.map((ms) => setTimeout(() => { if (!deviceSaysOffline()) kickAll() }, ms))
    }
    const onNetworkChange = () => { if (!deviceSaysOffline()) burst() }
    window.addEventListener('online', burst)
    const conn = (navigator as Navigator & { connection?: EventTarget }).connection
    conn?.addEventListener?.('change', onNetworkChange)
    const offStore = useConnectionStore.subscribe((state, prev) => { if (prev.offline && !state.offline) kickAll() })
    return () => {
      window.removeEventListener('online', burst)
      conn?.removeEventListener?.('change', onNetworkChange)
      timers.forEach(clearTimeout)
      offStore()
    }
  }, [hub, photoHub])

  // 대기 유무를 I02 띠에 알린다. 글 · 사진 어느 쪽이든 자동 재시도 중인 항목이 있으면 true(소진 · 영구 실패는 말풍선의 [다시 보내기]가 맡는다).
  useEffect(() => {
    let text = false
    let photo = false
    const push = () => setChatQueueWaiting(text || photo)
    const offText = hub.subscribe({ onTextQueue: (q) => { text = q.some((i) => i.status === 'pending'); push() } })
    const offPhoto = photoHub.subscribe({ onPhotoQueue: (q) => { photo = q.some((i) => photoWaitingForRetry(i, photoHub.isAttempting(i.clientId))); push() } })
    return () => {
      offText()
      offPhoto()
      setChatQueueWaiting(false)
    }
  }, [hub, photoHub])
}
