/**
 * 채팅 탭(F01~F06) - 74-5. 그리는 일과 상태는 `features/chat/`(`ChatView` · `useChatMessages`), 이 파일은 탭 틀만 둔다.
 * 미연결 유저도 이 탭에 들어온다(잠긴 문을 보여주는 것이 설계) - 안내(F02)는 화면 안 카드이고 시트가 저절로 뜨지 않는다.
 */
import { ChatScreen } from '../features/chat/ChatView'
import type { ChatHubs } from '../features/chat/useChatMessages'
import type { NativeBridge } from '../platform/bridge'

export function ChatTab({ bridge, hubs }: { bridge: NativeBridge; hubs?: ChatHubs }) {
  return (
    <div className="screen solid tabScreen chatTab" data-testid="tab-screen-chat">
      <ChatScreen bridge={bridge} hubs={hubs} />
    </div>
  )
}
