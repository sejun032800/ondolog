/**
 * 매거진 뷰어 덮개 - D10 속표지(첫 장) -> D11 뷰어 (RN `(modals)/magazine-viewer.tsx` + `FrontMatter` + `PageViewer`의 웹판).
 * 경로가 아니라 화면 위 덮개(`PhoneLayer`)다 - 메인 B06 · 서재 어디서 열어도 아래 화면이 그대로 남고, 열려 있는 동안 하드웨어 뒤로 가기는 **이것만 닫는다**(`useBackHandler`).
 *
 *  - 호 하나(`issueId`)의 발행된 호만 연다(`issues_public`). **인쇄용 PDF 경로는 이 화면 어디에도 없다**(절대 규칙 3).
 *  - 속표지의 [읽기] -> 쪽 이미지 넘기기 · 확대. 뷰어의 ←는 속표지로 돌아온다. **목차(D12)는 숨겼다**(R31-8 - 쪽 번호 매니페스트가 아직 없다, R48-1: `issueManifest`는 늘 null).
 *  - [PDF 내려받기]는 디지털 PDF의 서명 URL을 다리(`bridge.openBrowser` = 앱의 시스템 브라우저)에 넘긴다. 앱 안에서 PDF를 그리지 않는다(렌더링 라이브러리는 허가 밖).
 *  - 호를 열면 기기에 "열어 봤다"를 남긴다(`markIssueOpened`) - 메인 B06 카드가 걷힌다. 보던 쪽은 앱을 쓰는 동안만 호별로 기억한다(`@/store/viewerStore`, 메모리).
 *  - 넘기기 · 확대는 `components/PhotoViewer`의 `ZoomableImage`(포인터 이벤트 직접 구현, 라이브러리 0): 배율 1에서 옆으로 밀면 앞뒤 쪽, 두 번 누르면 확대 <-> 처음, 핀치 1~4배.
 *    왼쪽 · 오른쪽 방향키도 넘긴다. 연출은 CSS(쪽이 들어오는 220ms), `prefers-reduced-motion`이면 즉시.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { FRONT_MATTER_NOTICE } from '@/constants/magazineCopy'
import type { FrontMatterCorner, PublishedIssue } from '@/services/magazineApi'
import { useViewerStore } from '@/store/viewerStore'
import { issueMonthLabel, pageCounterLabel } from '@/utils/magazine'
import { useAuthStore } from '../../auth/stores'
import { PhoneLayer } from '../../components/PhoneLayer'
import { ZoomableImage } from '../../components/PhotoViewer'
import { Skeleton } from '../../components/Skeleton'
import { useBackHandler } from '../../platform/backStack'
import type { NativeBridge } from '../../platform/bridge'
import { useCoupleStore } from '../../stores/coupleStore'
import { markIssueOpened } from '../main/issueSeen'
import { useIssueViewer } from './viewerData'

export const VIEWER_COPY = {
  openFailed: '호를 열지 못했어요',
  pdfFailed: 'PDF를 열지 못했어요. 잠시 뒤에 다시 눌러 주세요',
} as const

/** D10 속표지 - 종이 바탕(밤에서 종이로 넘어가는 순간). 호 번호(Vol)는 이 면에 없다(R21-3). */
export function FrontMatter({ issue, coverUrl, nickname, names, corners, onClose, onRead, onPdf, pdfBusy, pdfFailed }: {
  issue: Pick<PublishedIssue, 'issueType' | 'periodStart' | 'title' | 'pdfDigitalPath'>
  coverUrl: string | undefined
  /** 커플 닉네임. 없으면 그리지 않는다. */
  nickname: string | null
  /** "세준 · 서영". 이름을 못 읽었으면 빈 문자열. */
  names: string
  corners: readonly FrontMatterCorner[]
  onClose: () => void
  onRead: () => void
  onPdf: () => void
  pdfBusy: boolean
  pdfFailed: boolean
}) {
  const month = issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title })
  const canPdf = !!issue.pdfDigitalPath && !pdfBusy
  return (
    <div className="fmSheet" data-testid="front-matter">
      <div className="fmCloseRow">
        <button type="button" className="fmClose press" aria-label="닫기" data-testid="front-matter-close" onClick={onClose}>✕</button>
      </div>
      <div className="fmScroll">
        <div className="fmWordmarkBlock">
          <span className="fmWordmark">ONDOLOG</span>
          {nickname ? <span className="fmNickname">{nickname}</span> : null}
        </div>
        <div className="fmCover" data-testid="front-matter-cover">
          {coverUrl ? <img src={coverUrl} alt="" draggable={false} /> : null}
        </div>
        <div className="fmTitleRow">
          <span className="fmMonth">{month}</span>
          {names ? <span className="fmNames">{names}</span> : null}
        </div>
        <div className="fmRule" />
        <div className="fmCorners" data-testid="front-matter-corners">
          {corners.map((c) => (
            <div key={c.id} className="fmCornerRow">
              <span className="fmCornerTitle">{c.pageTitle}</span>
              {c.cornerName ? <span className="fmCornerName">{c.cornerName}</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="fmFooter">
        <button type="button" className="fmRead press" data-testid="front-matter-read" onClick={onRead}>읽기</button>
        <button type="button" className="fmPdf press" disabled={!canPdf} data-testid="front-matter-pdf" onClick={onPdf}>PDF 내려받기</button>
        {pdfFailed ? <p className="fmPdfError" role="status" data-testid="front-matter-pdf-error">{VIEWER_COPY.pdfFailed}</p> : null}
        <p className="fmNotice" data-testid="front-matter-notice">{FRONT_MATTER_NOTICE}</p>
      </div>
    </div>
  )
}

/** D11 뷰어 - 쪽 이미지 한 장씩 넘기기 + 확대. 머리: ← (속표지로) · "N월호" · "8 / 19". 목차 버튼은 없다. */
export function PageReader({ title, pageCount, initialPage, pageUrls, onBack, onPageChange, onImageError }: {
  title: string
  pageCount: number
  /** 처음에 보일 쪽(1부터). */
  initialPage: number
  /** 쪽 번호(1부터) -> 서명 URL. */
  pageUrls: Record<number, string>
  onBack: () => void
  /** 지금 쪽이 바뀌었다(1부터) - 그 쪽 가까이의 URL을 받고 보던 쪽을 기억할 때 쓴다. */
  onPageChange: (page: number) => void
  onImageError: (page: number) => void
}) {
  const clamp = useCallback((p: number) => Math.min(pageCount, Math.max(1, p)), [pageCount])
  const [page, setPage] = useState(() => clamp(initialPage))
  const [dir, setDir] = useState<'none' | 'next' | 'prev'>('none')
  // 연타 · 방향키 반복에서도 지금 쪽을 정확히 읽도록 값을 ref에도 둔다(상태 갱신 함수 안에서는 부수 효과를 부르지 않는다).
  const pageRef = useRef(page)

  const step = useCallback(
    (s: -1 | 1) => {
      const next = clamp(pageRef.current + s)
      if (next === pageRef.current) return
      pageRef.current = next
      setDir(s === 1 ? 'next' : 'prev')
      setPage(next)
      onPageChange(next)
    },
    [clamp, onPageChange],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  // 이웃 쪽 이미지를 미리 받아 둔다(넘길 때 빈 면이 보이지 않게).
  useEffect(() => {
    for (const p of [page - 1, page + 1]) {
      const url = pageUrls[p]
      if (url) new Image().src = url
    }
  }, [page, pageUrls])

  const url = pageUrls[page]
  return (
    <div className="readerSheet" data-testid="page-viewer">
      <div className="readerHead">
        <button type="button" className="readerBack press" aria-label="뒤로" data-testid="page-viewer-back" onClick={onBack}>←</button>
        <div className="readerTitles">
          <span className="readerTitle">{title}</span>
          <span className="readerCounter" data-testid="page-counter">{pageCounterLabel(page, pageCount)}</span>
        </div>
      </div>
      <div className="readerPager" data-testid="page-pager">
        <div key={page} className={`readerPage ${dir}`} data-testid="reader-page" data-page={page}>
          {url ? null : <span className="readerWait skeleton" aria-hidden="true" data-testid="reader-wait" />}
          <ZoomableImage url={url} label={`${page}쪽`} onSwipe={step} onError={() => onImageError(page)} />
        </div>
      </div>
    </div>
  )
}

/** 열린 호 하나의 덮개. 속표지 <-> 뷰어를 오간다. */
export function IssueViewer({ issueId, bridge, onClose }: { issueId: string; bridge: NativeBridge; onClose: () => void }) {
  const userId = useAuthStore((s) => s.userId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const viewer = useIssueViewer(issueId, { userId, partnerId })
  const lastPageOf = useViewerStore((s) => s.lastPageOf)
  const setLastPage = useViewerStore((s) => s.setLastPage)
  const [mode, setMode] = useState<'front' | 'reader'>('front')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfFailed, setPdfFailed] = useState(false)
  // 열려 있는 동안 하드웨어 뒤로 가기는 이 덮개만 닫는다(속표지에서도 뷰어에서도 RN 모달처럼 덮개째 닫힌다).
  useBackHandler(onClose)

  const { issue, ensurePages, pageUrls } = viewer

  // 메인의 "꽂혔어요"(B06)는 이 호를 연 적이 없을 때만 보인다. 연 사실은 기기에만 남긴다(사용자 · 호 단위, 서버 쓰기 없음).
  const openedIssueId = issue?.id ?? null
  useEffect(() => {
    if (userId && openedIssueId) void markIssueOpened(userId, openedIssueId)
  }, [userId, openedIssueId])

  // 속표지: 1쪽(표지) 이미지의 서명 URL을 받는다.
  useEffect(() => {
    if (issue?.pageCount) void ensurePages(1)
  }, [issue, ensurePages])

  const startReading = useCallback(() => {
    if (!issue?.pageCount) return
    void ensurePages(lastPageOf(issue.id, issue.pageCount))
    setMode('reader')
  }, [issue, ensurePages, lastPageOf])

  const onPageChange = useCallback(
    (page: number) => {
      if (!issue) return
      setLastPage(issue.id, page)
      void ensurePages(page)
    },
    [issue, setLastPage, ensurePages],
  )

  const openPdf = useCallback(async () => {
    setPdfBusy(true)
    setPdfFailed(false)
    try {
      const url = await viewer.signPdf()
      if (!url) setPdfFailed(true)
      else await bridge.openBrowser(url)
    } catch {
      setPdfFailed(true)
    } finally {
      setPdfBusy(false)
    }
  }, [viewer, bridge])

  let body
  if (viewer.loading || !issue) {
    body = (
      <div className="fmWait" data-testid="viewer-wait">
        {viewer.error ? (
          <>
            <p className="fmWaitText">{VIEWER_COPY.openFailed}</p>
            <button type="button" className="fmClose press" aria-label="닫기" data-testid="viewer-wait-close" onClick={onClose}>✕</button>
          </>
        ) : (
          <Skeleton width="50%" height={24} />
        )}
      </div>
    )
  } else if (mode === 'front' || !issue.pageCount) {
    body = (
      <FrontMatter
        issue={issue}
        coverUrl={pageUrls[1]}
        nickname={nickname}
        names={viewer.names}
        corners={viewer.corners}
        onClose={onClose}
        onRead={startReading}
        onPdf={() => void openPdf()}
        pdfBusy={pdfBusy}
        pdfFailed={pdfFailed}
      />
    )
  } else {
    body = (
      <PageReader
        title={issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title })}
        pageCount={issue.pageCount}
        initialPage={lastPageOf(issue.id, issue.pageCount)}
        pageUrls={pageUrls}
        onBack={() => setMode('front')}
        onPageChange={onPageChange}
        onImageError={(page) => void viewer.reportImageError(page)}
      />
    )
  }

  return (
    <PhoneLayer>
      <div className={`issueViewer ${mode === 'reader' && issue ? 'night' : 'paper'}`} role="dialog" aria-modal="true" aria-label="매거진" data-testid="issue-viewer">
        {body}
      </div>
    </PhoneLayer>
  )
}
