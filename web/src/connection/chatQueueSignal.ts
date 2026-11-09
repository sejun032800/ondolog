/**
 * 채팅 큐에 자동 재시도 중인 항목이 있는가(`72c-`의 `useChatQueueWaiting`에 대응).
 * 채팅은 보낼 것이 남아 있을 때 자기 문장(F05 "연결이 끊겼어요. 다시 연결되면 이어서 보내요")을 이미 보이므로,
 * 채팅 화면에서 이 값이 true인 동안 I02 띠는 자리를 내준다(`ConnectionBanner`).
 * 채팅 전송 큐(74-5)가 글 · 사진 큐의 대기 항목 유무를 `setChatQueueWaiting`으로 알린다. 그때까지는 항상 false.
 */
import { create } from 'zustand'

interface ChatQueueSignal {
  waiting: boolean
  setWaiting: (waiting: boolean) => void
}

export const useChatQueueSignal = create<ChatQueueSignal>((set) => ({
  waiting: false,
  setWaiting: (waiting) => set({ waiting }),
}))

export function setChatQueueWaiting(waiting: boolean): void {
  useChatQueueSignal.getState().setWaiting(waiting)
}
