/**
 * 앱 시트 한 칸(B4 · B12 막기). 시트는 **한 번에 하나**다 - 이미 열려 있으면 `open`은 무시한다(같은 시트도 다른 시트도).
 * 시트를 여는 것은 사용자가 그 기능을 누를 때 한 번뿐이다(화면이 열릴 때 저절로 열지 않는다).
 * 경로가 바뀌면(탭을 떠남 포함) Shell이 `closeAll`을 불러 시트도 닫는다 - 다른 탭으로 따라오지 않는다.
 * 시트 종류는 `app/sheets.tsx`가 그리는 법과 함께 더한다.
 */
import { create } from 'zustand'

export type SheetId = 'couple-gate' | 'record'

interface SheetState {
  current: SheetId | null
  /** 열렸으면 true. 이미 무언가 열려 있으면 false(무시). */
  open: (id: SheetId) => boolean
  close: (id?: SheetId) => void
  closeAll: () => void
}

export const useSheetStore = create<SheetState>((set, get) => ({
  current: null,
  open: (id) => {
    if (get().current !== null) return false
    set({ current: id })
    return true
  },
  close: (id) => {
    const cur = get().current
    if (cur !== null && (id === undefined || id === cur)) set({ current: null })
  },
  closeAll: () => {
    if (get().current !== null) set({ current: null })
  },
}))
