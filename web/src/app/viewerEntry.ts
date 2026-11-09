/**
 * 발행된 호를 뷰어로 여는 문 한 곳(메인의 B06 [읽기] · 지난 호 다시 읽기, 이후 서재가 부른다).
 * 뷰어 화면은 74-6이 만든다 - 그때 `setViewerEntry`로 실제 이동을 꽂는다. 꽂기 전에는 짧은 안내 토스트만(아무 일도 없는 버튼은 두지 않는다).
 * 뷰어가 호를 열 때 `features/main/issueSeen.markIssueOpened`를 불러 "열어 봄"을 남겨야 B06 카드가 사라진다.
 */
import { showToast } from '../stores/toastStore'

type Entry = (issueId: string) => void

const PLACEHOLDER: Entry = () => showToast('매거진 뷰어는 곧 열려요')
let entry: Entry = PLACEHOLDER

export function setViewerEntry(next: Entry | null): void {
  entry = next ?? PLACEHOLDER
}

export function openIssueViewer(issueId: string): void {
  entry(issueId)
}
