/**
 * E01 피드 · E13 혼자 기록의 그리는 부분(RN `feed.tsx` · `FeedChapterView` · `MonthChapterHeader` · `SoloBanner` · `AddFab`의 웹판). 값만 받아 그린다.
 * 보드 `N-T-Tabs` E01 · `N-S-E2-Feed` E13 + CURRENT.md 바뀐 점: 월 머리는 "메모 N · 사진 N · 데이트 N"("기록 4" -> "메모 4", 별 0).
 * 피드형/지도형 토글은 숨긴다(지도는 범위 밖). 얼굴 인식 안내 카드 없음(R13-2).
 */
import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { buildCardTexts, englishMonth } from '@/utils/dateRecord'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import type { FeedChapter, FeedState } from './feedData'
import { DAY_DELETE_COPY } from './dayDelete'

// ---------------------------------------------------------------------------
// 76-d 하루 지우기 - 날짜 카드를 왼쪽으로 밀면 오른쪽에 빨간 [지우기]
// ---------------------------------------------------------------------------

/** 오른쪽에 드러나는 [지우기] 폭(px). */
export const SWIPE_ACTION_W = 88
/** 가로 · 세로를 가르는 첫 이동 문턱(px). 세로가 먼저 넘으면 이 카드는 손을 뗄 때까지 세로 스크롤에 맡긴다. */
export const SWIPE_AXIS_SLOP = 8

/**
 * 밀어서 지우기 줄. 카드에 가로 사진 줄이 없으므로(보드 E01 · 76- 대조) 카드 전체에서 민다.
 * - 세로 스크롤과 겹치지 않게: `touch-action: pan-y`(세로는 브라우저 몫) + 첫 이동이 가로일 때만 붙잡는다.
 * - 열려 있을 때 카드를 누르면 열지 않고 닫는다. 민 직후의 클릭은 삼킨다.
 */
export function SwipeRow({ enabled, open, onOpenChange, onDelete, label, children, testId }: {
  enabled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
  label: string
  children: ReactNode
  testId?: string
}) {
  const [drag, setDragState] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const setDrag = (v: number | null) => { dragRef.current = v; setDragState(v) }
  const start = useRef<{ x: number; y: number; id: number; axis: 'x' | 'y' | null; base: number } | null>(null)
  const swiped = useRef(false)
  if (!enabled) return <>{children}</>
  const offset = drag ?? (open ? -SWIPE_ACTION_W : 0)

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    swiped.current = false
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, base: open ? -SWIPE_ACTION_W : 0 }
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.axis === null) {
      if (Math.abs(dx) < SWIPE_AXIS_SLOP && Math.abs(dy) < SWIPE_AXIS_SLOP) return
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (s.axis === 'x') { try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* 지원 안 함 */ } }
    }
    if (s.axis !== 'x') return
    swiped.current = true
    setDrag(Math.max(-SWIPE_ACTION_W, Math.min(0, s.base + dx)))
  }
  const up = () => {
    const s = start.current
    start.current = null
    const last = dragRef.current
    if (!s || s.axis !== 'x' || last === null) { setDrag(null); return }
    const next = last < -SWIPE_ACTION_W / 2
    setDrag(null)
    if (next !== open) onOpenChange(next)
  }
  const clickCapture = (e: ReactMouseEvent) => {
    if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; return }
    if (open) { e.preventDefault(); e.stopPropagation(); onOpenChange(false) }
  }

  return (
    <div className={`swipeRow ${open ? 'open' : ''}`} data-testid={testId}>
      <button
        type="button"
        className="swipeAction press"
        aria-label={`${label} ${DAY_DELETE_COPY.action}`}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        disabled={!open}
        onClick={onDelete}
        data-testid="day-delete-action"
      >
        {DAY_DELETE_COPY.action}
      </button>
      <div
        className={`swipeFront ${drag === null ? 'settle' : ''}`}
        style={{ transform: offset ? `translate3d(${offset}px, 0, 0)` : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={clickCapture}
        data-testid="swipe-front"
      >
        {children}
      </div>
    </div>
  )
}

/** 피드가 하루 지우기에 넘겨 주는 것. 없으면(미연결 등) 밀기 없음. */
export interface DaySwipe {
  openId: string | null
  setOpenId: (id: string | null) => void
  onDelete: (dateId: string, dateOn: string) => void
}

/** 연결 전 E13 배너의 제목(= 이유). 기록 시트가 직접 열렸을 때도 같은 문장을 쓴다. */
export const SOLO_CLOSED_TITLE = '연인과 연결되면 기록할 수 있어요'

export function monthCountsLabel({ memoTotal, photoTotal, dateTotal }: { memoTotal: number; photoTotal: number; dateTotal: number }): string {
  return `메모 ${memoTotal} · 사진 ${photoTotal} · 데이트 ${dateTotal}`
}

/** 날짜 카드(사진 + 하단 장막). 큰 카드 230 / 2열 작은 카드(compact) 180. */
export function DateCard({ photoUrl, noPhoto, dateLabel, title, meta, compact, onOpen }: {
  photoUrl?: string
  /** 사진이 없는 기록(대표 사진 경로가 없음) - 큰 빈 사진 자리를 두지 않고 글 카드로 줄인다(A-11). 사진 주소를 읽는 중이면 false라 자리가 흔들리지 않는다. */
  noPhoto?: boolean
  dateLabel: string
  title: string
  meta?: string
  compact?: boolean
  onOpen: () => void
}) {
  return (
    <button type="button" className={`dateCard ${compact ? 'compact' : ''} ${noPhoto ? 'noPhoto' : ''}`} aria-label={`${dateLabel} ${title}`} onClick={onOpen}>
      {photoUrl ? <img src={photoUrl} alt="" draggable={false} /> : null}
      {!noPhoto ? <span className="dateScrim" aria-hidden="true" /> : null}
      <span className="dateText">
        <span className="t-caption c-sub">{dateLabel}</span>
        <span className="dateTitle">{title}</span>
        {meta ? <span className="dateMeta">{meta}</span> : null}
      </span>
    </button>
  )
}

export function MonthChapterHeader({ chapter }: { chapter: FeedChapter }) {
  return (
    <div className="monthHead">
      <div className="monthRow">
        <span className="monthNumeral" aria-label={`${chapter.month}월`}>{String(chapter.month).padStart(2, '0')}</span>
        <div className="monthSide">
          <span className="t-kicker c-mute">{englishMonth(chapter.month)}</span>
          <span className="t-sub c-mute" data-testid={`month-counts-${chapter.key}`}>
            {monthCountsLabel({ memoTotal: chapter.memoTotal, photoTotal: chapter.photoTotal, dateTotal: chapter.dates.length })}
          </span>
        </div>
      </div>
      <div className="monthRule" />
    </div>
  )
}

/** 피드의 한 달 - 머리 + 대표 카드(그 달 가장 최근 데이트) + 원문 한 줄 + 2열 작은 카드. */
export function FeedChapterView({ chapter, urls, names, onOpenDate, swipe }: {
  chapter: FeedChapter
  /** 76-d 하루 지우기(연결 · 유예 중일 때만). */
  swipe?: DaySwipe
  /** 사진 경로 -> 서명 URL */
  urls: Record<string, string>
  /** 작성자 id -> 표시 이름 */
  names: Record<string, string>
  onOpenDate: (dateId: string) => void
}) {
  const [lead, ...rest] = chapter.dates
  const photoOf = (path: string | null) => (path ? urls[path] : undefined)
  const leadTexts = buildCardTexts(lead, false)
  const quoteAuthor = lead.quote ? names[lead.quote.authorId] : undefined
  const row = (id: string, dateOn: string, label: string, card: ReactNode) => (
    <SwipeRow
      enabled={!!swipe}
      open={swipe?.openId === id}
      onOpenChange={(o) => swipe?.setOpenId(o ? id : null)}
      onDelete={() => swipe?.onDelete(id, dateOn)}
      label={label}
      testId={`day-swipe-${id}`}
    >
      {card}
    </SwipeRow>
  )
  return (
    <section className="feedChapter" data-testid={`chapter-${chapter.key}`}>
      <MonthChapterHeader chapter={chapter} />
      {row(lead.id, lead.dateOn, leadTexts.dateLabel, (
        <DateCard
          photoUrl={photoOf(lead.coverPath)}
          noPhoto={lead.coverPath === null}
          dateLabel={leadTexts.dateLabel}
          title={leadTexts.title}
          meta={`사진 ${lead.photoCount} · 메모 ${lead.memoCount}`}
          onOpen={() => onOpenDate(lead.id)}
        />
      ))}
      {lead.quote ? (
        <div className="quoteRow">
          <span className="feedQuote" data-testid="feed-quote">{`“${lead.quote.text}”`}</span>
          {quoteAuthor ? <span className="t-caption c-mute">{quoteAuthor}</span> : null}
        </div>
      ) : null}
      {rest.length > 0 ? (
        <div className="dateGrid">
          {rest.map((d) => {
            const texts = buildCardTexts(d, true)
            return (
              <div key={d.id} className="dateCell">
                {row(d.id, d.dateOn, texts.dateLabel, <DateCard compact photoUrl={photoOf(d.coverPath)} noPhoto={d.coverPath === null} dateLabel={texts.dateLabel} title={texts.title} onOpen={() => onOpenDate(d.id)} />)}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

/**
 * E13 혼자 기록 - 미연결 유저의 피드 머리 카드. **연결 전에는 기록이 닫혀 있다**(R30-3 · R77-1) - 이유와 초대 안내를 적는다.
 * 보드(`E13.jpg`)의 "혼자서도 기록할 수 있어요"는 R30-3과 맞지 않아 쓰지 않는다(결정 기록). 문구는 기존 비활성 문구 그대로, 아래 줄은 보드 원문이다.
 * 연결된 커플에게는 이 카드가 그려지지 않는다(`CoupleGate` fallback).
 */
export function SoloBanner({ onInvite }: { onInvite?: () => void }) {
  return (
    <div className="soloBanner" data-testid="solo-banner">
      <div className="soloAvatars" aria-hidden="true"><i className="me" /><i className="empty" /></div>
      <div className="soloText">
        <p className="soloTitle" data-testid="solo-title">{SOLO_CLOSED_TITLE}</p>
        <p className="t-caption c-mute">연결하면 두 사람 기록이 하나로 합쳐져요</p>
      </div>
      {onInvite ? <button type="button" className="soloInvite press" aria-label="초대" onClick={onInvite}>{'초대 →'}</button> : null}
    </div>
  )
}

/**
 * 업로드 버튼(FAB, 56 원). 연결 전에는 흐리게(`off`) 보이지만 **눌림은 살아 있다** - 누르면 이유 + [초대하러 가기](기록 시트의 닫힘 안내)가 나온다(74-h2 ②, 눌러도 반응 없는 상태 0).
 * `disabled` 속성은 쓰지 않는다(스크린 리더에도 "연결되면 열려요"로 읽히도록 `aria-disabled`).
 */
export function AddFab({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`feedFab press ${disabled ? 'off' : 'on'}`} aria-label="데이트 기록하기" aria-disabled={disabled || undefined} data-testid="feed-add-fab" onClick={onPress}>
      +
    </button>
  )
}

export function FeedView({ feed, onOpenDate, onAdd, addOff, swipe }: {
  feed: FeedState
  /** 76-d 하루 지우기. */
  swipe?: DaySwipe
  onOpenDate: (dateId: string) => void
  onAdd: () => void
  /** 연결 전: [첫 기록 남기기]를 + 버튼과 같은 비활성 모양으로(A-5). 눌림은 살아 있어 기록 시트의 닫힘 안내가 뜬다. */
  addOff?: boolean
}) {
  const chapterEls = useRef<Record<string, HTMLElement | null>>({})
  const showIndex = feed.chapters.length > 1
  return (
    <>
      {feed.loading ? (
        <div className="feedSkeleton" data-testid="feed-skeleton">
          <Skeleton width="30%" height={48} />
          <Skeleton height={190} radius={24} />
          <div className="feedSkeletonGrid">
            <Skeleton height={140} radius={24} />
            <Skeleton height={140} radius={24} />
          </div>
        </div>
      ) : feed.error ? (
        <div className="feedError" data-testid="feed-error">
          <p className="t-title c-text">기록을 불러오지 못했어요</p>
          <button type="button" className="btn ghost press" onClick={() => void feed.reload()}>다시 불러오기</button>
        </div>
      ) : feed.chapters.length === 0 ? (
        <EmptyState
          title="기록을 남기면 여기에 쌓여요"
          body={'사진 몇 장과 한 줄이면 충분해요.\n이번 호의 재료가 돼요.'}
          actionLabel="첫 기록 남기기"
          onAction={onAdd}
          actionOff={addOff}
          testId="feed-empty"
        />
      ) : (
        feed.chapters.map((chapter) => (
          <div key={chapter.key} ref={(el) => { chapterEls.current[chapter.key] = el }}>
            <FeedChapterView chapter={chapter} urls={feed.urls} names={feed.names} onOpenDate={onOpenDate} swipe={swipe} />
          </div>
        ))
      )}
      {showIndex ? (
        <nav className="feedIndex" aria-label="월 바로 가기" data-testid="feed-index">
          {feed.chapters.map((chapter, i) => (
            <button
              key={chapter.key}
              type="button"
              className={`feedIndexItem ${i === 0 ? 'on' : ''}`}
              aria-label={`${chapter.month}월로 가기`}
              onClick={() => chapterEls.current[chapter.key]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
            >
              {String(chapter.month).padStart(2, '0')}
            </button>
          ))}
        </nav>
      ) : null}
    </>
  )
}
