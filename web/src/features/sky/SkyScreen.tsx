/**
 * 우리의 하늘(MASTER 9-8 · 보드 03_Y1-Our-Sky · 화면 C01~C07). 읽기 전용 - 서버 쓰기 0.
 *  - C01 이달의 하늘 / C02 지난 하늘: 한 개의 세로 스크롤. 달들이 오래된 순으로 쌓이고 맨 아래가 이번 달이다(처음에는 맨 아래).
 *    위로 끌면 지난 달이 이어지고(머리가 "지난 하늘"로 바뀐다), 이번 달 근처에서 놓으면 이번 달로 돌아온다(그 밖에서는 머문다 - 지난 별을 누를 수 있게).
 *  - C04 그날(별 누르기) / C05 그날의 사진 / C07 기념일 별 / C06 빈 하늘.
 *  - 모션: 줄인 모션이면 켜짐 · 흐름 · 반짝임 0. 앱이 가려지면(`visibilitychange`) 애니메이션을 멈춘다. 별 애니메이션은 transform · opacity만.
 * 배경 별 반짝임 토글(9-7 결정 4)은 앱에 아직 없어 기본 켬이다(새 설정 화면을 만들지 않는다).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { togetherDates } from '@/engine/togetherDay'
import { assignStop } from '@/utils/dateRecord'
import { kstToday } from '@/utils/magazine'
import { computeDaysTogetherKst } from '@/utils/relationshipDays'
import { useAuthStore } from '../../auth/stores'
import { useBackHandler } from '../../platform/backStack'
import { prefersReducedMotion } from '../../platform/motion'
import { useSheetStore } from '../../stores/sheetStore'
import { useCoupleStore } from '../../stores/coupleStore'
import type { Nav } from '../../navigation'
import { SkyLayer, viewOffsetPt } from '../../ui'
import type { DayRecord } from '../records/dayRecordRead'
import { toDayCounts } from '../records/dayRecordRead'
import { useSky, useSkyNames, useSkyPhotoUrls } from './skyData'
import {
  anniversariesUntil, assignStarSizes, dayNumberOf, monthNumber, monthOf, monthsBetween, moonOfMonth, skyOpenable, starPosition,
  twinkleDelaySeconds, twinklePeriodSeconds, warmestDate, weekdayKo, type Anniversary, type Moon,
} from './skyMath'

export const SKY_COPY = {
  subtitle: '우리가 함께한 하루가 별이 됐어요',
  hintNow: '위로 끌면 지난 하늘', // R103-3 · MASTER r76 9-8-2: 옛 뒷말은 실제 동작과 달라 뺌
  hintPast: '아래로 내리면 이번 달 ↓',
  pastTitle: '지난 하늘',
  emptyTitle: '우리의 하늘',
  emptySub: '아직 별이 없어요',
  emptyBody: '첫 데이트를 기록하면\n이 자리에 첫 별이 떠요',
  emptyHint: '그날이 따뜻할수록 별이 커져요',
  emptyButton: '데이트 기록하기',
  loadFailed: '하늘을 불러오지 못했어요',
  starOf: 'THE STAR OF',
  anniversary: 'ANNIVERSARY',
  warmest: '가장 따뜻했던 날',
  viewPhotos: '사진 보기',
  viewAllPhotos: '사진 모두 보기',
  openDay: '그날 기록 →',
  openDayAnniv: '데이트 기록 →',
  locked: '잠긴 사진',
} as const

/** 별이 날짜 순서대로 켜지는 간격(초). */
export const STAR_ON_STEP_S = 0.22
/** 이번 달에서 이만큼(화면 높이 비율) 안쪽에서 놓으면 이번 달로 돌아온다. */
export const RETURN_RATIO = 0.35

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? '' : new Date(ms + 9 * 3_600_000).toISOString().slice(11, 16)
}
const mdLabel = (date: string) => `${monthNumber(monthOf(date))}월 ${dayNumberOf(date)}일`

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

/** 화면 안에 들어와 있는가(IntersectionObserver가 없는 환경에서는 늘 true). */
function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => { for (const e of entries) setInView(e.isIntersecting) }, { rootMargin: '10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

const useNow = (): Date => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

type Selection = { kind: 'day'; date: string } | { kind: 'anniv'; anniv: Anniversary }

export function SkyScreen({ nav }: { nav: Nav }) {
  const userId = useAuthStore((s) => s.userId)
  const status = useCoupleStore((s) => s.status)
  const grace = useCoupleStore((s) => s.grace)
  const connectedCoupleId = useCoupleStore((s) => s.coupleId)
  const connectedPartnerId = useCoupleStore((s) => s.partnerId)
  const graceCoupleId = useCoupleStore((s) => s.graceCoupleId)
  const gracePartnerId = useCoupleStore((s) => s.gracePartnerId)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const connected = status === 'connected'
  const openable = skyOpenable(status, grace)
  const coupleId = connected ? connectedCoupleId : graceCoupleId
  const partnerId = connected ? connectedPartnerId : gracePartnerId
  const now = useNow()
  const today = kstToday(now)
  const thisMonth = monthOf(today)
  const reduced = prefersReducedMotion()
  const pageVisible = usePageVisible()

  // 연결 전(혼자)에는 하늘이 없다 - 어떻게든 이 경로에 와도 메인으로 돌려보낸다.
  useEffect(() => {
    if ((status === 'disconnected' || status === 'connected') && !openable) nav.back()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, openable])

  const sky = useSky({ userId, partnerId, coupleId: openable ? coupleId : null, now, persist: connected })

  // ── 별(함께한 하루) · 달 ──
  const recordByDate = useMemo(() => {
    const m = new Map<string, DayRecord>()
    for (const r of sky.records) if (!m.has(r.date)) m.set(r.date, r)
    return m
  }, [sky.records])
  const starDates = useMemo(() => togetherDates(toDayCounts(sky.records)), [sky.records])
  const months = useMemo(() => {
    const first = starDates.length > 0 ? monthOf(starDates[0]) : thisMonth
    return monthsBetween(first < thisMonth ? first : thisMonth, thisMonth)
  }, [starDates, thisMonth])
  const starsByMonth = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const d of starDates) m.set(monthOf(d), [...(m.get(monthOf(d)) ?? []), d])
    return m
  }, [starDates])
  const anniversaries = useMemo(() => (startDate ? anniversariesUntil(startDate, today) : []), [startDate, today])
  const moonCount = useMemo(() => months.filter((m) => moonOfMonth(m, sky.moons, null)?.kind === 'published').length, [months, sky.moons])

  // ── 스크롤: 처음엔 맨 아래(이번 달) · 놓으면 이번 달 근처에서는 돌아온다 ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const distRef = useRef(0)
  const snapTimer = useRef<number | undefined>(undefined)
  const [inPast, setInPast] = useState(false)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - distRef.current)
  }, [months.length])
  const toThisMonth = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTo?.({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [reduced])
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const dist = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop)
    distRef.current = dist
    const past = dist > el.clientHeight * RETURN_RATIO
    setInPast((p) => (p === past ? p : past))
    window.clearTimeout(snapTimer.current)
    snapTimer.current = window.setTimeout(() => {
      const e = scrollRef.current
      if (e && distRef.current > 0 && distRef.current <= e.clientHeight * RETURN_RATIO) toThisMonth()
    }, 160)
  }
  useEffect(() => () => window.clearTimeout(snapTimer.current), [])

  // ── 선택(C04 · C07) · 사진(C05) ──
  const [sel, setSel] = useState<Selection | null>(null)
  const [photoView, setPhotoView] = useState<{ date: string; index: number } | null>(null)
  useBackHandler(photoView ? () => setPhotoView(null) : sel ? () => setSel(null) : undefined)

  const days = (month: string) => (starsByMonth.get(month) ?? []).map((date) => ({ date, temperature: sky.tempStatus[month] === 'ok' ? (sky.temps[date] ?? null) : null }))
  const selDate = sel ? (sel.kind === 'day' ? sel.date : sel.anniv.date) : null
  const selRecord = selDate ? recordByDate.get(selDate) ?? null : null
  const selMonth = selDate ? monthOf(selDate) : null

  const empty = sky.allLoaded && starDates.length === 0
  const firstMonth = months[0]
  const totalStars = starDates.length
  const daysTogether = startDate ? computeDaysTogetherKst(startDate, now) : null
  const showPast = inPast && months.length > 1

  let headTitle: string
  let headSub: string
  let headKicker: string | null = null
  if (sel?.kind === 'day') { headKicker = SKY_COPY.starOf; headTitle = `${mdLabel(sel.date)} ${weekdayKo(sel.date)}`; headSub = '' }
  else if (sel?.kind === 'anniv') { headKicker = SKY_COPY.anniversary; headTitle = `${mdLabel(sel.anniv.date)}의 별`; headSub = '' }
  else if (empty) { headTitle = SKY_COPY.emptyTitle; headSub = SKY_COPY.emptySub }
  else if (showPast) { headTitle = SKY_COPY.pastTitle; headSub = `${monthNumber(firstMonth)}월부터 · 별 ${totalStars} · 달 ${moonCount}` }
  else { headTitle = `${monthNumber(thisMonth)}월의 하늘`; headSub = SKY_COPY.subtitle }

  const centered = headKicker !== null
  const rootClass = `screen skyScreen ${reduced ? 'still' : ''} ${pageVisible ? '' : 'paused'} ${sel ? 'zoomed' : ''}`

  return (
    <div className={rootClass} data-testid="sky-screen" data-view={empty ? 'empty' : sel ? (sel.kind === 'day' ? 'star' : 'anniversary') : showPast ? 'past' : 'month'}>
      <div className="skyDrift" aria-hidden="true">
        <SkyLayer sky={{ visible: true, offset: viewOffsetPt.sky, veil: 0.3, bottomVeil: false, moveMs: 0 }} />
      </div>

      {empty ? (
        <EmptySky onRecord={() => { useSheetStore.getState().open('record') }} />
      ) : (
        <div className="skyScroll" ref={scrollRef} onScroll={onScroll} data-testid="sky-scroll" style={sel ? { overflowY: 'hidden' } : undefined}>
          {months.map((month) => (
            <MonthPanel
              key={month}
              month={month}
              current={month === thisMonth}
              inPast={showPast}
              dates={starsByMonth.get(month) ?? []}
              days={days(month)}
              recordByDate={recordByDate}
              moon={moonOfMonth(month, sky.moons, sky.draftPeriodStart)}
              anniversaries={anniversaries.filter((a) => monthOf(a.date) === month)}
              sel={sel}
              selMonth={selMonth}
              reduced={reduced}
              ready={!sky.loading}
              onSeen={() => sky.ensureTemps(month)}
              onStar={(date) => setSel({ kind: 'day', date })}
              onAnniv={(a) => setSel({ kind: 'anniv', anniv: a })}
            />
          ))}
        </div>
      )}

      {sky.error && starDates.length === 0 ? <p className="skyError" role="status">{SKY_COPY.loadFailed}</p> : null}

      {/* 머리 */}
      <div className={`skyHead ${centered ? 'center' : ''}`}>
        <div className="skyHeadText">
          {headKicker ? <div className="skyKicker">{headKicker}</div> : null}
          <h1 className="skyTitle" data-testid="sky-title">{headTitle}</h1>
          {headSub ? <p className="skySub" data-testid="sky-sub">{headSub}</p> : null}
        </div>
        <button type="button" className="skyClose press" aria-label="닫기" data-testid="sky-close" onClick={() => (sel ? setSel(null) : nav.back())}>✕</button>
      </div>

      {/* 지평선 + D+ + 안내 */}
      {!empty && !sel ? (
        <div className="skyHorizon" data-testid="sky-horizon">
          <div className="hill" />
          <div className="hillText">
            {showPast ? null : daysTogether !== null ? <div className="skyDays" data-testid="sky-days">{`D+${daysTogether}`}</div> : null}
            {showPast
              ? <button type="button" className="skyHint press" onClick={toThisMonth} data-testid="sky-hint">{SKY_COPY.hintPast}</button>
              : months.length > 1 ? <div className="skyHint" data-testid="sky-hint">{SKY_COPY.hintNow}</div> : null}
          </div>
        </div>
      ) : null}

      {/* C04 · C07 시트 */}
      {sel && selRecord ? (
        sel.kind === 'day' ? (
          <DaySheet
            record={selRecord}
            temperature={sky.tempStatus[monthOf(sel.date)] === 'ok' ? (sky.temps[sel.date] ?? null) : null}
            order={(starsByMonth.get(monthOf(sel.date)) ?? []).indexOf(sel.date) + 1}
            onPhotos={() => setPhotoView({ date: sel.date, index: 0 })}
            onOpenDay={() => nav.push('date-detail', { params: { id: selRecord.id } })}
          />
        ) : (
          <AnnivSheet
            anniv={sel.anniv}
            record={selRecord}
            onPhotos={() => setPhotoView({ date: sel.anniv.date, index: 0 })}
            onOpenDay={() => nav.push('date-detail', { params: { id: selRecord.id } })}
          />
        )
      ) : null}

      {/* C05 */}
      {photoView && recordByDate.get(photoView.date) ? (
        <PhotoPager
          record={recordByDate.get(photoView.date) as DayRecord}
          index={photoView.index}
          onIndex={(i) => setPhotoView({ date: photoView.date, index: i })}
          onClose={() => setPhotoView(null)}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 한 달 지면
// ---------------------------------------------------------------------------

function MonthPanel(props: {
  month: string
  current: boolean
  inPast: boolean
  dates: string[]
  days: { date: string; temperature: number | null }[]
  recordByDate: Map<string, DayRecord>
  moon: Moon | null
  anniversaries: Anniversary[]
  sel: Selection | null
  selMonth: string | null
  reduced: boolean
  ready: boolean
  onSeen: () => void
  onStar: (date: string) => void
  onAnniv: (a: Anniversary) => void
}) {
  const { month, dates, recordByDate, sel } = props
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref)
  const onSeen = props.onSeen
  useEffect(() => { if (inView && props.ready) onSeen() }, [inView, props.ready, dates.length, onSeen])

  const sizes = useMemo(() => assignStarSizes(props.days), [props.days])
  const warmest = warmestDate(props.days)
  const zoomed = props.selMonth === month && sel !== null
  const selDate = sel ? (sel.kind === 'day' ? sel.date : sel.anniv.date) : null
  const selPos = zoomed && selDate && recordByDate.get(selDate) ? starPosition((recordByDate.get(selDate) as DayRecord).id) : null
  const fieldStyle: CSSProperties | undefined = selPos
    ? { transformOrigin: `${selPos.x}% ${selPos.y}%`, transform: `translate3d(${50 - selPos.x}%, ${32 - selPos.y}%, 0) scale(2.6)` }
    : undefined
  // 그날 별이 없는 기념일은 고리만(누를 수 없다). 별이 있는 날은 별에 고리를 두른다.
  const ringOnly = props.anniversaries.filter((a) => !dates.includes(a.date))
  const label = props.current && !props.inPast ? `${monthNumber(month)}월 · 별 ${dates.length}` : props.current ? `${monthNumber(month)}월 · 이번 달 · 별 ${dates.length}` : `${monthNumber(month)}월 · 별 ${dates.length}`

  return (
    <section className={`skyPanel ${inView ? 'live' : ''} ${props.reduced ? '' : 'flow'}`} ref={ref} data-testid={`sky-month-${month}`} aria-label={`${monthNumber(month)}월의 하늘`}>
      <div className={`skyField ${zoomed ? 'zoom' : ''} ${sel && !zoomed ? 'dim' : ''}`} style={fieldStyle}>
        <span className="skyMonthLabel" data-testid={`sky-month-label-${month}`}>{label}</span>
        {dates.map((date, i) => {
          const rec = recordByDate.get(date) as DayRecord
          const pos = starPosition(rec.id)
          const anniv = props.anniversaries.find((a) => a.date === date)
          const isSel = selDate === date
          const showOn = props.current && !props.reduced
          const style = {
            left: `${pos.x}%`, top: `${pos.y}%`,
            '--s': `${sizes.get(date) ?? 5}px`, '--p': `${twinklePeriodSeconds(rec.id)}s`, '--d': `${twinkleDelaySeconds(rec.id)}s`,
            ...(showOn ? { animationDelay: `${i * 0.22}s`, '--on': `${i * 0.22}s` } : {}),
          } as CSSProperties
          return (
            <button
              key={date}
              type="button"
              className={`skyStar ${showOn ? 'turnOn' : ''} ${anniv ? 'ring' : ''} ${isSel ? 'sel' : ''}`}
              style={style}
              data-testid={`sky-star-${date}`}
              data-size={sizes.get(date) ?? 5}
              data-period={twinklePeriodSeconds(rec.id)}
              aria-label={anniv ? `${anniv.label} 기념일 별` : `${mdLabel(date)}의 별`}
              onClick={() => (anniv ? props.onAnniv(anniv) : props.onStar(date))}
            >
              <i />
              {anniv ? <b className="ringMark" /> : null}
              {anniv ? <span className="ringLabel">{anniv.label}</span> : null}
            </button>
          )
        })}
        {warmest && recordByDate.get(warmest) ? (
          <span className="skyStarLabel" style={{ left: `${starPosition((recordByDate.get(warmest) as DayRecord).id).x}%`, top: `${starPosition((recordByDate.get(warmest) as DayRecord).id).y}%` }} data-testid={`sky-warmest-${month}`}>
            <b>{`${monthNumber(month)}.${dayNumberOf(warmest)}${firstPlace(recordByDate.get(warmest) as DayRecord) ? ` ${firstPlace(recordByDate.get(warmest) as DayRecord)}` : ''}`}</b>
            <em>{SKY_COPY.warmest}</em>
          </span>
        ) : null}
        {ringOnly.map((a) => {
          const pos = starPosition(`anniv:${a.date}`)
          return (
            <span key={a.date} className="skyRingOnly" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} data-testid={`sky-ring-${a.days}`}>
              <b className="ringMark" />
              <span className="ringLabel">{a.label}</span>
            </span>
          )
        })}
        {props.moon ? (
          <span className={`skyMoon ${props.moon.kind}`} data-testid={`sky-moon-${month}`}>
            <i />
            <em>{props.moon.kind === 'published' ? `VOL.${String(props.moon.volume).padStart(2, '0')} · ${monthNumber(month)}월호` : `${monthNumber(month)}월호`}</em>
          </span>
        ) : null}
      </div>
    </section>
  )
}

function firstStop(r: DayRecord) {
  return [...r.stops].sort((a, b) => a.seq - b.seq)[0] ?? null
}
function firstPlace(r: DayRecord): string | null {
  return firstStop(r)?.placeName?.trim() || null
}

// ---------------------------------------------------------------------------
// C04 · C07 시트
// ---------------------------------------------------------------------------

function memoOf(r: DayRecord) {
  return r.memos.find((m) => m.text.trim() !== '') ?? null
}

function MemoQuote({ record }: { record: DayRecord }) {
  const memo = memoOf(record)
  const names = useSkyNames(memo ? [memo.authorId] : [])
  if (!memo) return null
  const who = names[memo.authorId]
  const time = fmtTime(memo.createdAt)
  return (
    <blockquote className="skyQuote" data-testid="sky-memo">
      <p>{`“${memo.text.trim()}”`}</p>
      <cite>{[who, time].filter(Boolean).join(' · ')}</cite>
    </blockquote>
  )
}

function DaySheet({ record, temperature, order, onPhotos, onOpenDay }: { record: DayRecord; temperature: number | null; order: number; onPhotos: () => void; onOpenDay: () => void }) {
  const places = [...record.stops].sort((a, b) => a.seq - b.seq).map((s) => s.placeName?.trim()).filter((p): p is string => !!p)
  const title = firstPlace(record)
  return (
    <div className="skySheet" data-testid="sky-sheet-day" role="dialog" aria-label="그날">
      <i className="skySheetHandle" />
      <div className="skySheetTop">
        <span className="skyPlaces" data-testid="sky-places">{places.join(' · ')}</span>
        {temperature !== null ? <span className="skyTemp" data-testid="sky-temp">{`그날의 온도 `}<b>{`${temperature.toFixed(1)}°`}</b></span> : null}
      </div>
      {title ? <h2 className="skySheetTitle" data-testid="sky-day-title">{title}</h2> : null}
      <MemoQuote record={record} />
      <p className="skyCounts" data-testid="sky-counts">{`사진 ${record.counts.photos} · 메모 ${record.counts.memos} · ${monthNumber(monthOf(record.date))}월의 ${order}번째 별`}</p>
      <div className="skySheetButtons">
        {record.counts.photos > 0 ? <button type="button" className="skyBtn ghost press" onClick={onPhotos} data-testid="sky-view-photos">{SKY_COPY.viewPhotos}</button> : null}
        <button type="button" className="skyBtn primary press" onClick={onOpenDay} data-testid="sky-open-day">{SKY_COPY.openDay}</button>
      </div>
    </div>
  )
}

function AnnivSheet({ anniv, record, onPhotos, onOpenDay }: { anniv: Anniversary; record: DayRecord; onPhotos: () => void; onOpenDay: () => void }) {
  const place = firstPlace(record)
  return (
    <div className="skySheet" data-testid="sky-sheet-anniv" role="dialog" aria-label="기념일 별">
      <i className="skySheetHandle" />
      <div className="skyBig metric" data-testid="sky-anniv-days"><span>{anniv.days}</span><small>일</small></div>
      <p className="skyCounts" data-testid="sky-counts">{[place, `사진 ${record.counts.photos}`, `메모 ${record.counts.memos}`].filter(Boolean).join(' · ')}</p>
      <MemoQuote record={record} />
      <div className="skySheetButtons">
        {record.counts.photos > 0 ? <button type="button" className="skyBtn ghost press" onClick={onPhotos} data-testid="sky-view-photos">{SKY_COPY.viewAllPhotos}</button> : null}
        <button type="button" className="skyBtn primary press" onClick={onOpenDay} data-testid="sky-open-day">{SKY_COPY.openDayAnniv}</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// C05 그날의 사진
// ---------------------------------------------------------------------------

function PhotoPager({ record, index, onIndex, onClose }: { record: DayRecord; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const photos = useMemo(
    () => [...record.photos].sort((a, b) => (a.capturedAt ?? a.createdAt).localeCompare(b.capturedAt ?? b.createdAt) || a.id.localeCompare(b.id)),
    [record.photos],
  )
  const urls = useSkyPhotoUrls(photos.filter((p) => !p.accessLocked).map((p) => p.storagePath))
  const n = photos.length
  const i = Math.min(Math.max(0, index), Math.max(0, n - 1))
  const photo = photos[i]
  const stop = photo ? assignStop(photo.capturedAt, record.stops) : null
  const stopMemo = stop ? record.memos.find((m) => m.dateStopId === stop.id && m.text.trim() !== '') : undefined
  const names = useSkyNames(stopMemo ? [stopMemo.authorId] : [])
  const touchX = useRef<number | null>(null)
  const go = (d: number) => { const next = i + d; if (next >= 0 && next < n) onIndex(next) }
  if (!photo) return null
  const place = stop?.placeName?.trim() || firstPlace(record)
  return (
    <div className="skyPhotos" data-testid="sky-photos" role="dialog" aria-label="그날의 사진">
      <div className="skyPhotosHead">
        <div>
          <div className="skyPhotosDate" data-testid="sky-photos-date">{`${mdLabel(record.date)} ${weekdayKo(record.date)}${firstPlace(record) ? ` · ${firstPlace(record)}` : ''}`}</div>
          <div className="skyPhotosCount" data-testid="sky-photos-count"><b>{i + 1}</b>{` / ${n}`}</div>
        </div>
        <button type="button" className="skyClose press" aria-label="닫기" data-testid="sky-photos-close" onClick={onClose}>✕</button>
      </div>
      <div
        className="skyPhotoBox"
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null }}
        onTouchEnd={(e) => {
          const x0 = touchX.current
          touchX.current = null
          const x1 = e.changedTouches[0]?.clientX
          if (x0 === null || x1 === undefined) return
          if (x1 - x0 > 50) go(-1)
          else if (x0 - x1 > 50) go(1)
        }}
      >
        {photo.accessLocked ? (
          <div className="skyLocked" data-testid="sky-photo-locked">{SKY_COPY.locked}</div>
        ) : urls[photo.storagePath] ? (
          <img src={urls[photo.storagePath]} alt={`${i + 1} / ${n}`} draggable={false} data-testid="sky-photo-img" />
        ) : null}
        <button type="button" className="skyPrev" aria-label="이전 사진" disabled={i === 0} onClick={() => go(-1)} />
        <button type="button" className="skyNext" aria-label="다음 사진" disabled={i >= n - 1} onClick={() => go(1)} />
      </div>
      <div className="skyPhotoCaption" data-testid="sky-photo-caption">
        {[fmtTime(photo.capturedAt ?? photo.createdAt), place].filter(Boolean).join(' · ')}
      </div>
      {stopMemo ? (
        <p className="skyPhotoMemo" data-testid="sky-photo-memo">{`“${stopMemo.text.trim()}”`}{names[stopMemo.authorId] ? <span>{` — ${names[stopMemo.authorId]}`}</span> : null}</p>
      ) : null}
      <div className="skyThumbs" data-testid="sky-thumbs">
        {photos.map((p, k) => (
          <button key={p.id} type="button" className={`skyThumb ${k === i ? 'on' : ''}`} aria-label={`${k + 1}번째 사진`} onClick={() => onIndex(k)}>
            {!p.accessLocked && urls[p.storagePath] ? <img src={urls[p.storagePath]} alt="" draggable={false} /> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// C06 빈 하늘
// ---------------------------------------------------------------------------

function EmptySky({ onRecord }: { onRecord: () => void }) {
  return (
    <div className="skyEmpty" data-testid="sky-empty">
      <div className="skyEmptyRing" aria-hidden="true" />
      <p className="skyEmptyBody pre">{SKY_COPY.emptyBody}</p>
      <p className="skyEmptyHint">{SKY_COPY.emptyHint}</p>
      <button type="button" className="skyBtn primary big press" onClick={onRecord} data-testid="sky-empty-record">{SKY_COPY.emptyButton}</button>
    </div>
  )
}
