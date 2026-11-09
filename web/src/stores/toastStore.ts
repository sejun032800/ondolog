/**
 * I06 공통 토스트 상태(RN `toastStore`의 웹판). 한 번에 하나만 보인다(새 토스트가 이전 것을 바꾼다). 사라지는 시간은 `TOAST_DURATION_MS`.
 * 토스트가 뜨는 곳(`ToastHost`)은 Shell에 하나다.
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
  show: (input: ToastInput) => void
  hide: () => void
}

let seq = 0

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (input) => {
    seq += 1
    set({ toast: { ...input, id: seq } })
  },
  hide: () => set({ toast: null }),
}))

/** 어느 화면에서나 부르는 한 줄 알림. */
export function showToast(message: string, action?: { label: string; onPress: () => void }): void {
  useToastStore.getState().show({ message, actionLabel: action?.label, onAction: action?.onPress })
}
