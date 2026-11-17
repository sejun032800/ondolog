/**
 * 채팅 탭(F01~F06) - 74-5. 그리는 일과 상태는 `features/chat/`(`ChatView` · `useChatMessages`), 이 파일은 탭 틀만 둔다.
 * 미연결 유저도 이 탭에 들어온다(잠긴 문을 보여주는 것이 설계) - 안내(F02)는 화면 안 카드이고 시트가 저절로 뜨지 않는다.
 */
import { useEffect } from 'react'
import { useCoupleRefresh } from '../couple/useCoupleRefresh'
import { ChatScreen } from '../features/chat/ChatView'
import type { ChatHubs } from '../features/chat/useChatMessages'
import type { NativeBridge } from '../platform/bridge'
import { clearCoupleMessageNoticesHere } from '../push/pushCore'
import { useCoupleStore } from '../stores/coupleStore'

export function ChatTab({ bridge, hubs }: { bridge: NativeBridge; hubs?: ChatHubs }) {
  useCoupleRefresh() // 탭에 들어올 때 · 앱 복귀 때 커플 값을 다시 읽는다(A-19)
  // 82-(R120-2): 이 커플 채팅에 들어오면 그 커플의 메시지 알림만 서랍에서 지운다(변경 안내 · 다른 앱 알림은 남김).
  const coupleId = useCoupleStore((s) => (s.status === 'connected' ? s.coupleId : null))
  useEffect(() => {
    if (coupleId) void clearCoupleMessageNoticesHere(coupleId)
  }, [coupleId])
  return (
    <div className="screen solid tabScreen chatTab" data-testid="tab-screen-chat">
      <ChatScreen bridge={bridge} hubs={hubs} />
    </div>
  )
}
