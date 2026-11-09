/**
 * 피드 탭(E01 피드 · E13 혼자 기록) - 74-4. 그리는 일은 `features/feed/FeedView`, 이 파일은 읽기 훅 결과와 버튼 목적지를 이어 준다.
 *  - 월 챕터(최근 달 먼저) + 대표 카드 + 원문 한 줄 + 2열 카드. 카드 -> E03(`date-detail`).
 *  - 미연결 유저도 이 화면에 들어온다(혼자 기록). 합쳐진 보기(커플 전용)는 `<CoupleGate>` fallback에 E13 배너를 둔다. 배너의 [초대 →]는 I01 시트(한 번).
 *  - 업로드 버튼(FAB) -> E11 기록 시트. 기록할 커플 행이 없으면(규칙 6, HANDOFF 열린 항목 "U2 혼자 기록의 커플 행") 비활성이고 배너가 이유를 적는다.
 *  - 기록하고 돌아오거나 앱이 다시 보이면 다시 읽는다(`feedData.ts`).
 */
import { useAuthStore } from '../auth/stores'
import { CoupleGate } from '../components/CoupleGate'
import { useRecordingCouple, useFeed } from '../features/feed/feedData'
import { AddFab, FeedView, SoloBanner } from '../features/feed/FeedView'
import type { Nav } from '../navigation'
import { useSheetStore } from '../stores/sheetStore'

export function FeedTab({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const recording = useRecordingCouple(userId)
  const feed = useFeed(userId !== null)
  const canRecord = recording.couple !== null
  const openRecord = () => { if (canRecord) useSheetStore.getState().open('record') }

  return (
    <div className="screen solid tabScreen feedTab" data-testid="tab-screen-feed">
      <div className="feedScroll">
        <h1 className="t-display c-text feedTitle">피드</h1>
        {/* 기록할 커플 행을 읽기 전에는 배너 문구를 정하지 않는다(문구가 번쩍 바뀌지 않게). 빈 조각을 넘기는 것은 `CoupleGate`가 null을 "없음"으로 읽어 I01 카드를 보이기 때문이다. */}
        <CoupleGate fallback={recording.loading ? <></> : <SoloBanner canRecord={canRecord} onInvite={() => useSheetStore.getState().open('couple-gate')} />}>
          {null}
        </CoupleGate>
        <FeedView feed={feed} canRecord={canRecord} onOpenDate={(id) => nav.push('date-detail', { params: { id } })} onAdd={openRecord} />
      </div>
      <AddFab disabled={!canRecord} onPress={openRecord} />
    </div>
  )
}
