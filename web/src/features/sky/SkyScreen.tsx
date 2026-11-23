/**
 * 우리의 하늘(MASTER 9-8 · 보드 03_Y1-Our-Sky · 화면 C01~C07). 읽기 전용 - 서버 쓰기 0.
 *  - C01 이달의 하늘 / C02 지난 하늘: 한 개의 세로 스크롤. 달들이 오래된 순으로 쌓이고 맨 아래가 이번 달이다(처음에는 맨 아래).
 *    위로 끌면 지난 달이 이어지고(머리가 "지난 하늘"로 바뀐다), 이번 달 근처에서 놓으면 이번 달로 돌아온다(그 밖에서는 머문다 - 지난 별을 누를 수 있게).
 *  - C04 그날(별 누르기) / C05 그날의 사진 / C07 기념일 별 / C06 빈 하늘.
 *  - 모션: 줄인 모션이면 켜짐 · 흐름 · 반짝임 0. 앱이 가려지면(`visibilitychange`) 애니메이션을 멈춘다. 별 애니메이션은 transform · opacity만.
 * 85-(MASTER 9-8-4 · 보드 patch9b): C01 ✕ 왼쪽 [둘러보기] 칩(폭 380pt 미만이면 40pt 원 아이콘 · 읽기 이름 "하늘 둘러보기") -> (iOS만 C09) ->
 *   C08 센서 / C08-alt 끌기(`SkyTour`). 둘러보기 중 ✕ · 뒤로 = C01로. 별 반짝임(H01 OUR SKY, 기기에만)을 끄면 배경 별 + 데이트 별 반짝임이 멈춘다.
 * 84-e(MASTER 9-8-4 r80 · 보드 17-b): 유성(C01 이번 달 · C08 둘러보기)과 떨어진 말(C03) - `Meteor.tsx` · 규칙 `meteorRules.ts` · 읽기 `meteorData.ts`.
 *   지난 하늘 · 별 시트 · 사진 · 권한 앞 화면 · 빈 하늘에서는 떨어지지 않는다. 서버 쓰기 0.
 * 89-(patch10 · 보드 `N-R17b-Our-Sky-3`): 별 3단계 빛 모양 · 점선 고리 · 초승달(`skyGlyphs`) · 켜짐 연출은 그날 처음 열 때만(기기의 하늘 범주 `lit:{커플}`) ·
 *   둘러보기는 하늘 한 장(`SkyTour` 띠 - 이 달 지면은 C01과 같은 `MonthField`) · C04 인용 출처 시각 "밤 9시 30분"(`skyClock`).
 * 84-h(R145-2): 시험판 전용 유성 미리 보기(`meteorPreview.tsx`) - `IS_TRIAL_BUILD` 분기 안에서만(출시 빌드에서는 번들째 빠짐).
 *   미리 보기로 연 하늘에서는 실제 유성을 쉬게 한다(한 번에 하나 · 실제 기록과 섞이지 않게).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { togetherDates } from '@/engine/togetherDay'
import { assignStop } from '@/utils/dateRecord'
import { kstToday } from '@/utils/magazine'
import { computeDaysTogetherKst } from '@/utils/relationshipDays'
import { useAuthStore } from '../../auth/stores'
import { readCache, writeCache } from '../../cache/deviceCache'
import { useBackHandler } from '../../platform/backStack'
import { prefersReducedMotion } from '../../platform/motion'
import { useSheetStore } from '../../stores/sheetStore'
import { useCoupleStore } from '../../stores/coupleStore'
import type { Nav } from '../../navigation'
import { SkyLayer, viewOffsetPt } from '../../ui'
import type { DayRecord } from '../records/dayRecordRead'
import { toDayCounts } from '../records/dayRecordRead'
import { useSky, useSkyNames, useSkyPhotoUrls } from './skyData'
import { SkyTour } from './SkyTour'
import { MoonGlyph, RingGlyph, SkyGlyphDefs, StarGlyph } from './skyGlyphs'
import { FallenWords, MeteorLayer, useMeteorDrop } from './Meteor'
import { IS_TRIAL_BUILD } from '../../config/env'
import { MeteorPreviewHost, takeMeteorPreview } from './meteorPreview'
import { useSkyPrefStore, useSkyPrefs } from './skyPrefs'
import { MOTION_MS, WINDOW_PT, decideTourStart } from './tourMath'
import { hasOrientationApi, orientationPermissionNeeded, requestOrientationPermission } from './useSkyOrientation'
import {
  STAR_ON_STEP_MS, anniversariesUntil, assignStarSizes, dayNumberOf, monthNumber, monthOf, monthsBetween, moonOfMonth, shouldLightUp, skyClock,
  skyOpenable, starPosition, twinkleDelaySeconds, twinklePeriodSeconds, warmestDate, weekdayKo, type Anniversary, type Moon,
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
  // 85- C01 칩 · C09(문구 = 보드 patch9b C09 그대로)
  tour: '둘러보기',
  tourA11y: '하늘 둘러보기',
  askTitle: '폰을 들고 하늘을 둘러볼까요?',
  askBody: '폰을 움직이는 방향으로 하늘이 따라 돌아요. 이를 위해 기기의 움직임 정보를 써요.',
  askNotice: '움직임 정보는 이 폰 안에서만 쓰고, 저장하거나 보내지 않아요.',
  askAllow: '움직임 사용하기',
  askDrag: '손가락으로 둘러볼게요',
} as const

/** 이번 달에서 이만큼(화면 높이 비율) 안쪽에서 놓으면 이번 달로 돌아온다. */
export const RETURN_RATIO = 0.35

/** C05 사진 아래 시각(24시간 `14:20` 그대로 - patch10 2-4는 C03 · C04만). */
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
  const prefs = useSkyPrefs(userId)
  // 84-h: 설정의 시험판 줄로 열렸는가(열 때 한 번 읽고 지운다). 출시 빌드에서는 상수 false.
  const [previewOn] = useState(() => (IS_TRIAL_BUILD ? takeMeteorPreview() : false))

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

  // ── 89- 켜짐 연출: 하늘을 그날(KST) 처음 열 때만. 본 날은 기기의 하늘 범주(`sky` · `lit:{커플}`)에만 - 로그아웃 · 계정 전환 · 해제 때 지워진다 ──
  //   별이 처음 보이는 그리기에서 한 번 정한다(그 뒤에 바꾸면 이미 보인 별이 다시 꺼졌다 켜진다).
  const litRef = useRef<{ coupleId: string; on: boolean } | null>(null)
  if (coupleId && userId && starDates.length > 0 && litRef.current?.coupleId !== coupleId) {
    litRef.current = { coupleId, on: shouldLightUp(readCache<{ day: string }>(userId, 'sky', `lit:${coupleId}`)?.day, today) }
  }
  const lightUp = !!coupleId && litRef.current?.coupleId === coupleId && litRef.current.on
  useEffect(() => {
    if (lightUp && connected && userId && coupleId) writeCache(userId, 'sky', { day: today }, `lit:${coupleId}`)
  }, [lightUp, connected, userId, coupleId, today])

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

  // ── 85- 둘러보기: C01 칩 -> (iOS C09) -> C08 / C08-alt. ✕ · 뒤로 = C01로 ──
  const [tour, setTour] = useState<{ mode: 'sensor' | 'drag'; leaving: boolean } | null>(null)
  const [asking, setAsking] = useState(false)
  /** 둘러보기에서 막 돌아왔다 - C01 요소(칩 · D+ · 안내)가 나타나는 연출 한 번. */
  const [tourBack, setTourBack] = useState(false)
  useEffect(() => {
    if (!tourBack) return
    const t = window.setTimeout(() => setTourBack(false), MOTION_MS.exit + 60)
    return () => window.clearTimeout(t)
  }, [tourBack])
  const leaveTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])
  const startTour = () => {
    const how = decideTourStart({ reduced, hasApi: hasOrientationApi(), needsPermission: orientationPermissionNeeded(), denied: prefs.motionDenied })
    if (how === 'ask') setAsking(true)
    else setTour({ mode: how, leaving: false })
  }
  const allowMotion = async () => {
    setAsking(false)
    const granted = await requestOrientationPermission()
    if (!granted) useSkyPrefStore.getState().markMotionDenied() // 한 번 거부한 뒤에는 C09 없이 C08-alt
    setTour({ mode: granted ? 'sensor' : 'drag', leaving: false })
  }
  const exitTour = useCallback(() => {
    setTour((t) => (t ? { ...t, leaving: true } : t))
    window.clearTimeout(leaveTimer.current)
    // 89-: 처음 만난 쪽으로 짧은 쪽 500ms 회전 -> 이름 180ms 사라짐 -> C01 요소가 나타남(줄인 모션은 회전 없이 120ms)
    leaveTimer.current = window.setTimeout(() => { setTour(null); setTourBack(true) }, reduced ? MOTION_MS.exitReduced : MOTION_MS.exitTurn + MOTION_MS.exit)
  }, [reduced])
  const toDrag = useCallback(() => setTour((t) => (t ? { ...t, mode: 'drag' } : t)), [])
  const markGuideSeen = useCallback(() => useSkyPrefStore.getState().markGuideSeen(), [])
  const markDragHintSeen = useCallback(() => useSkyPrefStore.getState().markDragHintSeen(), [])

  useBackHandler(
    photoView ? () => setPhotoView(null) : sel ? () => setSel(null) : asking ? () => setAsking(false) : tour && !tour.leaving ? exitTour : undefined,
  )

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

  const touring = tour !== null
  if (touring && !sel) { headTitle = `${monthNumber(thisMonth)}월의 하늘`; headSub = SKY_COPY.subtitle; headKicker = null }
  const centered = headKicker !== null
  const showChip = !empty && !sel && !showPast && !touring

  // ── 84-e 유성 · 떨어진 말 ──
  const meteorNames = useSkyNames(useMemo(() => [userId, partnerId].filter((v): v is string => !!v), [userId, partnerId]))
  const meteorCanShow = !empty && !sel && !photoView && !asking && !(tour?.leaving ?? false) && (touring || !showPast)
  const meteor = useMeteorDrop({
    userId, coupleId: openable ? coupleId : null, enabled: prefs.meteor && !previewOn, ready: !sky.loading && sky.allLoaded,
    canShow: meteorCanShow,
    visible: pageVisible, names: meteorNames, namesReady: true,
  })
  const rootClass = `screen skyScreen ${reduced ? 'still' : ''} ${pageVisible ? '' : 'paused'} ${sel ? 'zoomed' : ''} ${prefs.twinkle ? '' : 'noTwinkle'} ${touring ? 'touring' : ''} ${tourBack ? 'tourBack' : ''}`

  // 89- 둘러보기 띠의 "들어가는 창" = C01 이번 달 지면과 같은 부품(`MonthField`) · 칩이 찾는 자리(pt) = 이번 달 별(없으면 달)
  const thisDays = days(thisMonth)
  const tourTargets: number[] = useMemo(() => {
    if (!touring) return []
    const xs = (starsByMonth.get(thisMonth) ?? []).map((date) => (starPosition((recordByDate.get(date) as DayRecord).id).x / 100) * WINDOW_PT)
    if (xs.length > 0) return xs
    return moonOfMonth(thisMonth, sky.moons, sky.draftPeriodStart) ? [WINDOW_PT * 0.88 - 22] : []   // `.skyMoon` right 12% · 달 44pt의 가운데
  }, [touring, starsByMonth, thisMonth, recordByDate, sky.moons, sky.draftPeriodStart])

  return (
    <div className={rootClass} data-testid="sky-screen" data-view={empty ? 'empty' : sel ? (sel.kind === 'day' ? 'star' : 'anniversary') : showPast ? 'past' : 'month'}>
      <SkyGlyphDefs />
      <div className="skyDrift" aria-hidden="true">
        <SkyLayer sky={{ visible: true, offset: viewOffsetPt.sky, veil: 0.3, bottomVeil: false, moveMs: 0 }} />
      </div>

      {empty ? (
        <EmptySky onRecord={() => { useSheetStore.getState().open('record') }} />
      ) : (
        <div className={`skyScroll ${tour ? (tour.leaving ? 'tourReturning' : 'tourHidden') : ''}`} ref={scrollRef} onScroll={onScroll} data-testid="sky-scroll" style={sel || touring ? { overflowY: 'hidden' } : undefined} aria-hidden={touring || undefined}>
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
              lightUp={lightUp}
              ready={!sky.loading}
              onSeen={() => sky.ensureTemps(month)}
              onStar={(date) => setSel({ kind: 'day', date })}
              onAnniv={(a) => setSel({ kind: 'anniv', anniv: a })}
            />
          ))}
        </div>
      )}

      {tour ? (
        <SkyTour
          mode={tour.mode}
          leaving={tour.leaving}
          reduced={reduced}
          twinkle={prefs.twinkle}
          targetsPt={tourTargets}
          field={
            <MonthField
              month={thisMonth}
              current
              inPast={false}
              dates={starsByMonth.get(thisMonth) ?? []}
              days={thisDays}
              recordByDate={recordByDate}
              moon={moonOfMonth(thisMonth, sky.moons, sky.draftPeriodStart)}
              anniversaries={anniversaries.filter((a) => monthOf(a.date) === thisMonth)}
              sel={null}
              selMonth={null}
              reduced={reduced}
              lightUp={false}
              idPrefix="sky-tour"
              onStar={(date) => setSel({ kind: 'day', date })}
              onAnniv={(a) => setSel({ kind: 'anniv', anniv: a })}
            />
          }
          guideSeen={prefs.guideSeen}
          dragHintSeen={prefs.dragHintSeen}
          onGuideSeen={markGuideSeen}
          onDragHintSeen={markDragHintSeen}
          onNoSensor={toDrag}
        />
      ) : null}

      {sky.error && starDates.length === 0 ? <p className="skyError" role="status">{SKY_COPY.loadFailed}</p> : null}

      {/* 머리 */}
      <div className={`skyHead ${centered ? 'center' : ''}`}>
        <div className="skyHeadText">
          {headKicker ? <div className="skyKicker">{headKicker}</div> : null}
          <h1 className="skyTitle" data-testid="sky-title">{headTitle}</h1>
          {headSub ? <p className="skySub" data-testid="sky-sub">{headSub}</p> : null}
        </div>
        <div className="skyHeadButtons">
          {showChip ? (
            <button type="button" className="skyTourBtn press" aria-label={SKY_COPY.tourA11y} data-testid="sky-tour-open" onClick={startTour}>
              <TourIcon />
              <span className="skyTourBtnText" data-testid="sky-tour-open-text">{SKY_COPY.tour}</span>
            </button>
          ) : null}
          <button type="button" className="skyClose press" aria-label="닫기" data-testid="sky-close" onClick={() => (sel ? setSel(null) : tour ? exitTour() : nav.back())}>✕</button>
        </div>
      </div>

      {/* 지평선 + D+ + 안내 */}
      {/* 89-: 둘러보기로 들어갈 때 언덕은 180ms 동안 흐려지고(`.touring`) D+ · 안내는 빠진다 - 띠의 지평선이 이어 받는다 */}
      {!empty && !sel ? (
        <div className="skyHorizon" data-testid="sky-horizon" aria-hidden={touring || undefined}>
          <div className="hill" />
          <div className="hillText">
            {showPast || touring ? null : daysTogether !== null ? <div className="skyDays" data-testid="sky-days">{`D+${daysTogether}`}</div> : null}
            {showPast
              ? <button type="button" className="skyHint press" onClick={toThisMonth} data-testid="sky-hint">{SKY_COPY.hintPast}</button>
              : months.length > 1 && !touring ? <div className="skyHint" data-testid="sky-hint">{SKY_COPY.hintNow}</div> : null}
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

      {/* C09 iOS 움직임 권한 앞 화면(코드만 - 실행 확인은 Mac 뒤) */}
      {asking ? (
        <div className="skySheet skyAsk" data-testid="sky-motion-ask" role="dialog" aria-label={SKY_COPY.askTitle}>
          <i className="skySheetHandle" />
          <div className="skyAskIcon" aria-hidden="true"><MotionIcon /></div>
          <h2 className="skySheetTitle">{SKY_COPY.askTitle}</h2>
          <p className="skyAskBody">{SKY_COPY.askBody}</p>
          <p className="skyAskNotice">{SKY_COPY.askNotice}</p>
          <button type="button" className="skyPill wide press" onClick={() => void allowMotion()} data-testid="sky-motion-allow">{SKY_COPY.askAllow}</button>
          <button type="button" className="skyTextBtn press" onClick={() => { setAsking(false); setTour({ mode: 'drag', leaving: false }) }} data-testid="sky-motion-drag">{SKY_COPY.askDrag}</button>
        </div>
      ) : null}

      {/* 84-e 유성(C01 · C08) - 한 번에 하나 · 가려지면 멈춘다 */}
      {meteor.falling ? (
        <MeteorLayer key={meteor.falling.candidate.id} plan={meteor.falling} reduced={reduced} paused={!pageVisible} onCatch={meteor.catchIt} onEnd={meteor.ended} />
      ) : null}

      {/* 84-e C03 떨어진 말 */}
      {meteor.fallenOpen ? (
        <FallenWords coupleId={openable ? coupleId : null} caught={meteor.fallenOpen} names={meteorNames} onClose={meteor.closeFallen} />
      ) : null}

      {/* 84-h 시험판 유성 미리 보기(C01 · C08 -> C03) - 견본만 · 기록 0 */}
      {/*   하늘이 다 읽힌 뒤 실제 유성과 같은 조건(canShow)에서만 떨어진다 · 서버 · 기기 저장 0 */}
      {IS_TRIAL_BUILD && previewOn ? (
        <MeteorPreviewHost touring={touring} canShow={meteorCanShow && !sky.loading && sky.allLoaded} visible={pageVisible} reduced={reduced} />
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
  lightUp: boolean
  ready: boolean
  onSeen: () => void
  onStar: (date: string) => void
  onAnniv: (a: Anniversary) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref)
  const onSeen = props.onSeen
  useEffect(() => { if (inView && props.ready) onSeen() }, [inView, props.ready, props.dates.length, onSeen])
  return (
    <section className={`skyPanel ${inView ? 'live' : ''} ${props.reduced ? '' : 'flow'}`} ref={ref} data-testid={`sky-month-${props.month}`} aria-label={`${monthNumber(props.month)}월의 하늘`}>
      <MonthField {...props} idPrefix="sky" />
    </section>
  )
}

/**
 * 한 달의 하늘 지면(별 · 고리 · 달 · 라벨) - C01 달 지면과 C08 둘러보기 띠의 "들어가는 창"이 **같은 부품 · 같은 자리**를 쓴다(patch10 2-1 "들어가는 45° = C01 그림").
 * 89-: 별 3단계 빛 모양 · 장밋빛 점선 고리 · 초승달(`skyGlyphs`). 켜짐 연출은 하늘을 그날 처음 열 때만(`lightUp`) - 별마다 45ms 간격 · 700ms.
 */
export function MonthField(props: {
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
  lightUp: boolean
  idPrefix: 'sky' | 'sky-tour'
  onStar: (date: string) => void
  onAnniv: (a: Anniversary) => void
}) {
  const { month, dates, recordByDate, sel, idPrefix } = props
  const tour = idPrefix === 'sky-tour'
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
  const showOn = props.current && props.lightUp && !props.reduced && !tour

  return (
    <div className={`skyField ${zoomed ? 'zoom' : ''} ${sel && !zoomed ? 'dim' : ''}`} style={fieldStyle}>
      <span className="skyMonthLabel" data-testid={tour ? 'sky-tour-label' : `sky-month-label-${month}`}>{label}</span>
      {dates.map((date, i) => {
        const rec = recordByDate.get(date) as DayRecord
        const pos = starPosition(rec.id)
        const anniv = props.anniversaries.find((a) => a.date === date)
        const isSel = selDate === date
        const size = sizes.get(date) ?? 5
        const style = {
          left: `${pos.x}%`, top: `${pos.y}%`,
          '--s': `${size}px`, '--p': `${twinklePeriodSeconds(rec.id)}s`, '--d': `${twinkleDelaySeconds(rec.id)}s`,
          ...(showOn ? { '--on': `${i * STAR_ON_STEP_MS}ms` } : {}),
        } as CSSProperties
        return (
          <button
            key={date}
            type="button"
            className={`skyStar ${showOn ? 'turnOn' : ''} ${anniv ? 'ring' : ''} ${isSel ? 'sel' : ''}`}
            style={style}
            data-testid={`${idPrefix}-star-${date}`}
            data-size={size}
            data-period={twinklePeriodSeconds(rec.id)}
            aria-label={anniv ? `${anniv.label} 기념일 별` : `${mdLabel(date)}의 별`}
            onClick={() => (anniv ? props.onAnniv(anniv) : props.onStar(date))}
          >
            <StarGlyph size={size} />
            {anniv ? <RingGlyph size={size} /> : null}
            {anniv ? <span className="ringLabel">{anniv.label}</span> : null}
          </button>
        )
      })}
      {warmest && recordByDate.get(warmest) ? (
        <span className="skyStarLabel" style={{ left: `${starPosition((recordByDate.get(warmest) as DayRecord).id).x}%`, top: `${starPosition((recordByDate.get(warmest) as DayRecord).id).y}%` }} data-testid={tour ? 'sky-tour-warmest' : `sky-warmest-${month}`}>
          <b>{`${monthNumber(month)}.${dayNumberOf(warmest)}${firstPlace(recordByDate.get(warmest) as DayRecord) ? ` ${firstPlace(recordByDate.get(warmest) as DayRecord)}` : ''}`}</b>
          <em>{SKY_COPY.warmest}</em>
        </span>
      ) : null}
      {ringOnly.map((a) => {
        const pos = starPosition(`anniv:${a.date}`)
        return (
          <span key={a.date} className="skyRingOnly" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} data-testid={`${idPrefix}-ring-${a.days}`}>
            <RingGlyph size={null} />
            <span className="ringLabel">{a.label}</span>
          </span>
        )
      })}
      {props.moon ? (
        <span className={`skyMoon ${props.moon.kind}`} data-testid={tour ? 'sky-tour-moon' : `sky-moon-${month}`}>
          <MoonGlyph />
          <em>{props.moon.kind === 'published' ? `VOL.${String(props.moon.volume).padStart(2, '0')} · ${monthNumber(month)}월호` : `${monthNumber(month)}월호`}</em>
        </span>
      ) : null}
    </div>
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
  const time = skyClock(memo.createdAt)   // 89- patch10 2-4 - 밤 9시 30분 꼴
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

function TourIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M5 17a7 7 0 0 1 14 0" />
      <path d="M3 20h18" />
      <path d="M12 4v2.5M5.2 7.2l1.7 1.7M18.8 7.2l-1.7 1.7" />
    </svg>
  )
}

function MotionIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <rect x="8" y="4" width="8" height="14" rx="2" />
      <path d="M6 20h12" />
      <path d="M5 6.5a6 6 0 0 0-1 3M19 6.5a6 6 0 0 1 1 3" />
    </svg>
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
