/**
 * 서재 뷰어(D10 속표지 -> D11 뷰어)가 열려 있는 호 한 칸. 뷰어는 경로가 아니라 화면 위 덮개(`PhoneLayer`)라 여기에 "어느 호가 열려 있나"만 둔다.
 * `app/viewerEntry.ts`의 `openIssueViewer`(메인 B06 [읽기] · 지난 호 다시 읽기 · 서재 표지)가 `open`을 부른다. 메모리뿐이다.
 * 경로가 바뀌면 `ViewerHost`가 닫는다(시트와 같다 - 다른 화면으로 따라오지 않는다).
 */
import { create } from 'zustand'

interface ViewerOpenState {
  issueId: string | null
  open: (issueId: string) => void
  close: () => void
}

export const useViewerOpenStore = create<ViewerOpenState>((set) => ({
  issueId: null,
  open: (issueId) => set({ issueId }),
  close: () => set((s) => (s.issueId === null ? s : { issueId: null })),
}))
