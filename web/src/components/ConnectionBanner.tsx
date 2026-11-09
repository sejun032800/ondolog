/**
 * I02 연결 끊김 띠 - 보드 I02. 화면 위쪽 둥근 알약 한 줄(점 + "연결이 끊겼어요 · 마지막으로 받은 내용이에요"). 정지 점 - 스피너 없음. 눌리지 않는다.
 *
 * **채팅의 큐 문장과 겹치지 않는다**: 채팅은 보낼 것이 남아 있을 때 자기 문장(F05)을 이미 보인다. 채팅 화면에서(`inChat`)
 * 보낼 것이 남은 동안(`chatQueueSignal.waiting`)에는 이 띠를 그리지 않는다. 다른 탭에서는 큐와 관계없이 끊김을 보인다 -
 * 그 쪽이 "보낼 것"을 말하고, 이 띠는 "받은 것"을 말한다(`72b-`).
 * 끊김 판정은 `connectionMonitor`(감싼 fetch의 거부 + 브라우저 offline 이벤트), 풀기는 `useOfflineProbe`다.
 */
import { useEffect } from 'react'
import { useChatQueueSignal } from '../connection/chatQueueSignal'
import { listenBrowserOffline, useConnectionStore } from '../connection/connectionMonitor'
import { useOfflineProbe } from '../connection/useOfflineProbe'

export const CONNECTION_COPY = { offline: '연결이 끊겼어요 · 마지막으로 받은 내용이에요' } as const

export function ConnectionBanner({ inChat = false }: { inChat?: boolean }) {
  useOfflineProbe()
  useEffect(() => listenBrowserOffline(), [])
  const offline = useConnectionStore((s) => s.offline)
  const queueWaiting = useChatQueueSignal((s) => s.waiting)
  if (!offline || (inChat && queueWaiting)) return null
  return (
    <div className="connBanner" role="alert" data-testid="connection-banner">
      <span className="connDot" />
      <span className="connText">{CONNECTION_COPY.offline}</span>
    </div>
  )
}
