/**
 * 매거진 탭 본문 - D01 서재 · D14 첫 호 시작 · D16 미연결 (RN `components/magazine/*`의 웹판). 값을 받아 그리기만 한다(`MagazineTab`이 훅으로 읽어 넘긴다).
 *
 *  - 서재에는 **발행된 호만** 꽂힌다(`issues_public`). 표지는 `cover_path`(1쪽 이미지) 그대로이고 **표지 그림 위에는 아무것도 얹지 않는다** - 호 번호는 표지 밖 라벨 "VOL.NN" + "N월호".
 *    `moon` 색은 이 Vol 라벨에만 쓴다(발행된 호만).
 *  - 다음 호 카드의 진행률은 기간 경과율이고 **정지 값**이다(채움 · 카운트업 0). "제작 현황 →"는 없다(D02는 범위 밖). 재료 수는 못 셌으면 그리지 않는다.
 *  - 발행된 호가 0권이면 D14(초안이 있으면 그 진행률). 서재에 호가 있는데 초안이 없으면 다음 호 카드를 그리지 않는다.
 *  - D16(미연결)은 `<CoupleGate fallback>`이 그린다 - 탭은 보이고 잠긴 문을 보여 준다. 버튼은 초대로(`openInvite`).
 *  - D13(정렬 · 검색)으로 가는 것은 없다. 서재 목록은 최신순 한 가지뿐이다.
 */
import { FIRST_ISSUE_COPY, NEXT_ISSUE_COPY, UNCONNECTED_COPY } from '@/constants/magazineCopy'
import type { PublishedIssue } from '@/services/magazineApi'
import { issueMonthLabel, type LibraryMode } from '@/utils/magazine'
import { Skeleton } from '../../components/Skeleton'
import { PrimaryButton } from '../../ui'
import type { LibraryState, NextIssueData } from './libraryData'

/** "VOL.03" - 번호는 발행된 호의 `issue_number`. */
export function formatVol(volume: number): string {
  return `VOL.${String(Math.max(0, Math.trunc(volume))).padStart(2, '0')}`
}

/** 표지 밖 라벨의 두 줄. */
export function shelfLabels(issue: Pick<PublishedIssue, 'issueNumber' | 'issueType' | 'periodStart' | 'title'>): { vol: string; month: string } {
  return {
    vol: formatVol(issue.issueNumber),
    month: issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title }),
  }
}

/** "대화 412 · 사진 18" / "데이트 3" - 두 줄. 못 셌으면 null. */
export function materialLines(counts: NextIssueData['counts']): [string, string] | null {
  if (!counts) return null
  return [`대화 ${counts.messages} · 사진 ${counts.photos}`, `데이트 ${counts.dates}`]
}

export function LibraryShelf({ issues, coverUrls, onOpen }: {
  issues: readonly PublishedIssue[]
  /** 표지 경로 -> 서명 URL. 없는 호는 빈 종이 면으로 둔다. */
  coverUrls: Record<string, string>
  onOpen: (issue: PublishedIssue) => void
}) {
  return (
    <div data-testid="library-shelf">
      <div className="libHead">
        <span className="t-kicker c-mute">LIBRARY</span>
        <span className="t-caption c-mute" data-testid="library-count">{`${issues.length}권`}</span>
      </div>
      <div className="libGrid">
        {issues.map((issue) => {
          const labels = shelfLabels(issue)
          const url = issue.coverPath ? coverUrls[issue.coverPath] : undefined
          return (
            <button
              key={issue.id}
              type="button"
              className="libItem press"
              aria-label={`${labels.vol} · ${labels.month}`}
              data-testid={`shelf-issue-${issue.id}`}
              onClick={() => onOpen(issue)}
            >
              <span className="libCover" data-testid="shelf-cover">
                {url ? <img src={url} alt="" draggable={false} /> : null}
              </span>
              <span className="libLabels">
                <span className="libVol">{labels.vol}</span>
                {labels.month ? <span className="libMonth">{labels.month}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function NextIssueCard({ data }: { data: NextIssueData }) {
  const lines = materialLines(data.counts)
  const monthNumber = /^(\d+)/.exec(data.monthLabel)?.[1] ?? ''
  return (
    <div data-testid="next-issue-card" aria-label={`${data.monthLabel} ${NEXT_ISSUE_COPY.status} ${data.percent}%`}>
      <div className="nextStage">
        {monthNumber ? <span className="nextBig" aria-hidden="true">{monthNumber}</span> : null}
        <div className="nextSilhouette">
          <span className="nextBelow" style={{ top: `${100 - data.percent}%` }} />
          <span className="nextLine" style={{ top: `${100 - data.percent}%` }} />
          <span className="nextWriting t-caption c-mute">{NEXT_ISSUE_COPY.writing}</span>
        </div>
        <div className="nextTitles">
          <span className="t-kicker c-mute">{NEXT_ISSUE_COPY.kicker}</span>
          <span className="nextMonth">{data.monthLabel}</span>
          <span className="t-sub c-mute">{NEXT_ISSUE_COPY.status}</span>
        </div>
      </div>
      <div className="nextMetric">
        <span className="metric nextPercent" data-testid="next-issue-percent">{`${data.percent}%`}</span>
        {lines ? (
          <span className="nextCounts t-caption c-mute" data-testid="next-issue-counts">
            <span>{lines[0]}</span>
            <span>{lines[1]}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Silhouette() {
  return <div className="issueSilhouette" data-testid="issue-silhouette" />
}

/** D14 첫 호 시작. `percent`: 기간 경과율(0~100), 초안이 없으면 0. */
export function FirstIssue({ percent }: { percent: number }) {
  return (
    <div className="emptyShelf" data-testid="first-issue">
      <Silhouette />
      <div className="emptyShelfTitles">
        <span className="t-kicker c-mute">{FIRST_ISSUE_COPY.kicker}</span>
        <span className="emptyShelfTitle">{FIRST_ISSUE_COPY.title}</span>
      </div>
      <div className="ruleTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span className="ruleFill" style={{ width: `${percent}%` }} />
      </div>
      <span className="metric firstPercent" data-testid="first-issue-percent">{`${percent}%`}</span>
    </div>
  )
}

/** D14 아래 선반 문구. */
export function ShelfHint() {
  return (
    <div className="shelfHint">
      <span className="shelfLine" />
      <span className="t-caption c-mute">{FIRST_ISSUE_COPY.shelfHint}</span>
    </div>
  )
}

/** D16 미연결 - 잠긴 자리. 버튼은 초대로 간다. */
export function Unconnected({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="unconnectedLib" data-testid="unconnected-library">
      <div className="emptyShelf">
        <Silhouette />
        <div className="emptyShelfTitles">
          <span className="emptyShelfTitle">{UNCONNECTED_COPY.title}</span>
          <span className="t-sub c-sub">{UNCONNECTED_COPY.body}</span>
        </div>
      </div>
      <div className="unconnectedBtn">
        <PrimaryButton label={UNCONNECTED_COPY.invite} onClick={onInvite} />
      </div>
    </div>
  )
}

/** 연결된 유저 쪽 본문 - 상태(`LibraryMode`)에 따라 뼈대 / 오류 / D14 / D01. `pending` · `unconnected`는 그리지 않는다(게이트가 맡는다). */
export function LibraryContent({ mode, library, onOpen, onRetry }: {
  mode: LibraryMode
  library: Pick<LibraryState, 'issues' | 'coverUrls' | 'next'>
  onOpen: (issue: PublishedIssue) => void
  onRetry: () => void
}) {
  if (mode === 'loading') {
    return (
      <div className="libSkeleton" data-testid="library-skeleton" data-library-mode="loading">
        <Skeleton width="40%" height={32} />
        <Skeleton height={226} radius={4} />
        <Skeleton width="30%" height={20} />
      </div>
    )
  }
  if (mode === 'error') {
    return (
      <div className="libError" data-testid="library-error" data-library-mode="error">
        <p className="t-title c-text">서재를 불러오지 못했어요</p>
        <PrimaryButton label="다시 불러오기" variant="ghost" onClick={onRetry} />
      </div>
    )
  }
  if (mode === 'first') {
    return (
      <div className="libFirst" data-library-mode="first">
        <FirstIssue percent={library.next?.percent ?? 0} />
        <ShelfHint />
      </div>
    )
  }
  if (mode === 'shelf') {
    return (
      <div className="libShelfWrap" data-library-mode="shelf">
        {library.next ? <NextIssueCard data={library.next} /> : null}
        {library.next ? <div className="libRule" /> : null}
        <LibraryShelf issues={library.issues} coverUrls={library.coverUrls} onOpen={onOpen} />
      </div>
    )
  }
  return null
}
