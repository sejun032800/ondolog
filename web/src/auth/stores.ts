/**
 * 웹 앱의 작은 상태 둘. 둘 다 메모리에만 있다(영속 저장 0 - 로그인 세션 자체는 Supabase 클라이언트가 Preferences에 보관한다).
 */
import { create } from 'zustand'

interface AuthState {
  /** 로그인된 사용자 id(없으면 null). 화면은 id만 안다 - 토큰은 클라이언트 안에만 있다. */
  userId: string | null
  setUserId: (id: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  setUserId: (userId) => set({ userId }),
}))

interface NoticeState {
  message: string | null
  show: (message: string) => void
  clear: () => void
}

/** 한 번 보이고 사라지는 알림(예: 기존 계정 안내). */
export const useNoticeStore = create<NoticeState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}))
