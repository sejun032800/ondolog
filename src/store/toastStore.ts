/**
 * I06 공통 토스트 상태 - 화면마다 따로 쓰던 짧은 알림을 한 곳에 모은다(`72-`).
 * 한 번에 하나만 보인다(새 토스트가 이전 것을 바꾼다). 사라지는 시간은 `TOAST_DURATION_MS`.
 *
 * 토스트가 뜨는 곳(`ToastHost`)은 화면 층마다 하나씩 붙는다 - 네이티브 모달(`(modals)`) 위에는 루트의 것이 가려지기 때문이다.
 * 여러 곳이 동시에 붙어 있으면 **가장 나중에 붙은 곳만** 그린다(`hostStack`).
 */
import { create } from 'zustand'

export const TOAST_DURATION_MS = 3000

export interface ToastInput {
  message: string
  /** 오른쪽 글자 버튼(보드의 "보기"). */
  actionLabel?: string
  onAction?: () => void
}

export interface ToastItem extends ToastInput {
  /** 같은 글이 연달아 떠도 사라지는 시간을 새로 세도록 하는 번호. */
  id: number
}

interface ToastState {
  toast: ToastItem | null
  hostStack: string[]
  show: (input: ToastInput) => void
  hide: () => void
  registerHost: (id: string) => () => void
}

let seq = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  hostStack: [],
  show: (input) => {
    seq += 1
    set({ toast: { ...input, id: seq } })
  },
  hide: () => set({ toast: null }),
  registerHost: (id) => {
    set({ hostStack: [...get().hostStack.filter((h) => h !== id), id] })
    return () => set({ hostStack: get().hostStack.filter((h) => h !== id) })
  },
}))

/** 어느 화면에서나 부르는 한 줄 알림. */
export function showToast(message: string, action?: { label: string; onPress: () => void }): void {
  useToastStore.getState().show({ message, actionLabel: action?.label, onAction: action?.onPress })
}
