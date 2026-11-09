/**
 * 매거진 탭(D01 서재 · D14 첫 호 시작 · D16 미연결) - 74-6. 그리는 일은 `features/magazine/LibraryView`, 이 파일은 읽기 훅 결과와 버튼 목적지를 이어 준다.
 *  - 커플 전용이라 `<CoupleGate>`로 감싼다. 미연결 유저도 탭에 들어오고, 화면 안에서 D16(잠긴 문)을 본다. 연결 여부가 정해지기 전에는 아무것도 확정해 그리지 않는다.
 *  - 표지 -> 뷰어(`openIssueViewer`: 화면 위 덮개, 경로 아님). [연인 초대하기](D16) -> 초대(`openInvite('intro')` - 74-2 `couple-invite`).
 *  - 다음 호 카드의 "제작 현황 →"(D02) · 정렬 · 검색(D13)으로 가는 것은 없다(범위 밖).
 */
import { libraryMode } from '@/utils/magazine'
import { openInvite } from '../app/inviteEntry'
import { openIssueViewer } from '../app/viewerEntry'
import { CoupleGate } from '../components/CoupleGate'
import { useLibrary } from '../features/magazine/libraryData'
import { LibraryContent, Unconnected } from '../features/magazine/LibraryView'
import { useCoupleStore } from '../stores/coupleStore'

export function MagazineTab() {
  const status = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const library = useLibrary(status === 'connected' ? coupleId : null)
  const mode = libraryMode({ connection: status, loading: library.loading, error: library.error, publishedCount: library.issues.length })

  return (
    <div className="screen solid tabScreen magazineTab" data-testid="tab-screen-magazine">
      <div className="magazineScroll">
        <h1 className="t-display c-text magazineTitle">매거진</h1>
        <CoupleGate fallback={<Unconnected onInvite={() => openInvite('intro')} />}>
          <LibraryContent mode={mode} library={library} onOpen={(issue) => openIssueViewer(issue.id)} onRetry={() => void library.reload()} />
        </CoupleGate>
      </div>
    </div>
  )
}
