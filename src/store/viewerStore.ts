/**
 * 뷰어에서 보던 쪽을 호별로 기억한다(U3, `58-`) - **메모리에만** 둔다(앱을 닫으면 처음 쪽부터).
 * 저장소(AsyncStorage 등)에 쓰지 않는다: 읽던 자리는 편의일 뿐 기록이 아니다.
 */
import { create } from 'zustand'

interface ViewerState {
  /** 호 id -> 마지막으로 본 쪽(1부터). */
  lastPageByIssue: Record<string, number>
  setLastPage: (issueId: string, page: number) => void
  lastPageOf: (issueId: string, pageCount: number) => number
  reset: () => void
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  lastPageByIssue: {},
  setLastPage: (issueId, page) =>
    set((s) => ({ lastPageByIssue: { ...s.lastPageByIssue, [issueId]: Math.max(1, Math.trunc(page)) } })),
  lastPageOf: (issueId, pageCount) => {
    const page = get().lastPageByIssue[issueId] ?? 1
    return Math.min(Math.max(1, page), Math.max(1, pageCount))
  },
  reset: () => set({ lastPageByIssue: {} }),
}))
