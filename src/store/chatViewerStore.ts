/**
 * 채팅 시트(스토리 보기 F03 · 사진 크게 보기 F06)로 넘기는 값 - 메모리 전용.
 *
 * 라우트 매개변수에 서명 URL·긴 목록을 싣지 않으려고 화면이 열기 직전에 여기에 둔다. 영속 저장 없음(앱 종료 시 사라진다).
 */
import { create } from 'zustand'

export interface StoryViewItem {
  id: string
  /** `stories` 버킷 경로. 시트가 서명한다. */
  path: string
  createdAt: string
}

export interface StoryViewPayload {
  authorName: string
  isMine: boolean
  /** 오래된 것부터. */
  items: StoryViewItem[]
}

export interface PhotoViewPayload {
  /** `messages` 버킷 경로. */
  path: string
  senderName: string
  sentAt: string
}

interface ChatViewerState {
  story: StoryViewPayload | null
  photo: PhotoViewPayload | null
  openStory: (payload: StoryViewPayload) => void
  openPhoto: (payload: PhotoViewPayload) => void
  clear: () => void
}

export const useChatViewerStore = create<ChatViewerState>((set) => ({
  story: null,
  photo: null,
  openStory: (story) => set({ story }),
  openPhoto: (photo) => set({ photo }),
  clear: () => set({ story: null, photo: null }),
}))
