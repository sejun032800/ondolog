/**
 * E01 피드 · E13 혼자 기록의 그리는 부분(RN `feed.tsx` · `FeedChapterView` · `MonthChapterHeader` · `SoloBanner` · `AddFab`의 웹판). 값만 받아 그린다.
 * 보드 `N-T-Tabs` E01 · `N-S-E2-Feed` E13 + CURRENT.md 바뀐 점: 월 머리는 "메모 N · 사진 N · 데이트 N"("기록 4" -> "메모 4", 별 0).
 * 피드형/지도형 토글은 숨긴다(지도는 범위 밖). 얼굴 인식 안내 카드 없음(R13-2).
 */
import { useRef } from 'react'
import { buildCardTexts, englishMonth } from '@/utils/dateRecord'
import { EmptyState } from '../../components/EmptyState'
import { Skeleton } from '../../components/Skeleton'
import type { FeedChapter, FeedState } from './feedData'

export function monthCountsLabel({ memoTotal, photoTotal, dateTotal }: { memoTotal: number; photoTotal: number; dateTotal: number }): string {
  return `메모 ${memoTotal} · 사진 ${photoTotal} · 데이트 ${dateTotal}`
}

/** 날짜 카드(사진 + 하단 장막). 큰 카드 230 / 2열 작은 카드(compact) 180. */
export function DateCard({ photoUrl, dateLabel, title, meta, compact, onOpen }: {
  photoUrl?: string
  dateLabel: string
  title: string
  meta?: string
  compact?: boolean
  onOpen: () => void
}) {
  return (
    <button type="button" className={`dateCard press ${compact ? 'compact' : ''}`} aria-label={`${dateLabel} ${title}`} onClick={onOpen}>
      {photoUrl ? <img src={photoUrl} alt="" draggable={false} /> : null}
      <span className="dateScrim" aria-hidden="true" />
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
export function FeedChapterView({ chapter, urls, names, onOpenDate }: {
  chapter: FeedChapter
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
  return (
    <section className="feedChapter" data-testid={`chapter-${chapter.key}`}>
      <MonthChapterHeader chapter={chapter} />
      <DateCard
        photoUrl={photoOf(lead.coverPath)}
        dateLabel={leadTexts.dateLabel}
        title={leadTexts.title}
        meta={`사진 ${lead.photoCount} · 메모 ${lead.memoCount}`}
        onOpen={() => onOpenDate(lead.id)}
      />
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
                <DateCard compact photoUrl={photoOf(d.coverPath)} dateLabel={texts.dateLabel} title={texts.title} onOpen={() => onOpenDate(d.id)} />
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

/** E13 혼자 기록 - 미연결 유저의 피드 머리 카드. 기록할 커플 행이 아직 없으면(규칙 6) 그 사실을 글로 적는다. */
export function SoloBanner({ canRecord, onInvite }: { canRecord: boolean; onInvite: () => void }) {
  return (
    <div className="soloBanner" data-testid="solo-banner">
      <div className="soloAvatars" aria-hidden="true"><i className="me" /><i className="empty" /></div>
      <div className="soloText">
        <p className="soloTitle">{canRecord ? '혼자서도 기록할 수 있어요' : '초대 코드를 만들면 기록할 수 있어요'}</p>
        <p className="t-caption c-mute">연결하면 두 사람 기록이 하나로 합쳐져요</p>
      </div>
      <button type="button" className="soloInvite press" aria-label="초대" onClick={onInvite}>{'초대 →'}</button>
    </div>
  )
}

/** 업로드 버튼(FAB, 56 원). 기록할 커플 행이 없으면(규칙 6) 비활성 - 이유는 화면의 배너가 글로 적는다. */
export function AddFab({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`feedFab press ${disabled ? 'off' : 'on'}`} aria-label="데이트 기록하기" data-testid="feed-add-fab" disabled={disabled} onClick={onPress}>
      +
    </button>
  )
}

export function FeedView({ feed, canRecord, onOpenDate, onAdd }: {
  feed: FeedState
  canRecord: boolean
  onOpenDate: (dateId: string) => void
  onAdd: () => void
}) {
  const chapterEls = useRef<Record<string, HTMLElement | null>>({})
  const showIndex = feed.chapters.length > 1
  return (
    <>
      {feed.loading ? (
        <div className="feedSkeleton" data-testid="feed-skeleton">
          <Skeleton width="30%" height={48} />
          <Skeleton height={190} radius={24} />
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
          actionDisabled={!canRecord}
          testId="feed-empty"
        />
      ) : (
        feed.chapters.map((chapter) => (
          <div key={chapter.key} ref={(el) => { chapterEls.current[chapter.key] = el }}>
            <FeedChapterView chapter={chapter} urls={feed.urls} names={feed.names} onOpenDate={onOpenDate} />
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
