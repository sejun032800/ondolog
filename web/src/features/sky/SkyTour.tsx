/**
 * 85- 하늘 둘러보기 - C08(센서) · C08-alt(끌기) · C10(처음 한 번 안내) · "이번 달 별 ›". MASTER 9-8-4 · 보드 `N-R17-Our-Sky-2`(patch9b) 17-a.
 *  - 층 분리: 하늘 사진(`sky_world.jpg`, 부모의 `SkyLayer`)은 이 컴포넌트가 건드리지 않는다(고정 · 시차 0).
 *    이 컴포넌트는 하늘 층(별 · 달 · 라벨)과 방위 층(지평선 위 눈금 · 방위 글자)만 그리고 돌린다.
 *  - 머리 · ✕는 부모(`SkyScreen`)가 그대로 그린다. ✕ · 뒤로 = C01로(부모).
 *  - 센서 값은 메모리 숫자뿐(`useSkyOrientation`) - 저장 · 전송 0. 봤음 표시만 기기에(`skyPrefs`).
 *  - 화면 밖 별은 그리지 않는다(V40). 반짝임은 투명도 · 크기만(1단계 CSS 그대로), 토글 끔 · 줄인 모션이면 멈춤.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  EASE_TURN, FRONT, GUIDE_CLOSE_MOVE_DEG, MOTION_MS, compassMarks, dragView, lerpView, moveDeg, offscreenChip, project, skyPointOf, wrap180, wrap360,
  type View,
} from './tourMath'
import { tourEnv, useSkyOrientation } from './useSkyOrientation'

export const TOUR_COPY = {
  guideSensorTitle: '폰을 하늘 쪽으로 들어 보세요',
  guideSensorBody: '천천히 돌면 하늘이 따라 움직여요.\n별을 누르면 그날 기록을 볼 수 있어요.',
  guideDragTitle: '손가락으로 하늘을 끌어 보세요',
  guideDragBody: '별을 누르면 그날 기록을 볼 수 있어요.',
  guideOk: '알겠어요',
  dragHint: '손가락으로 하늘을 끌어 보세요',
  chip: '이번 달 별',
} as const

export interface TourStar {
  date: string
  pos: { x: number; y: number }
  size: number
  period: number
  delay: number
  label: string
}

export interface TourProps {
  mode: 'sensor' | 'drag'
  /** 나가기 시작 - 리스너는 이때 뗀다(모션표 "나가기 시작 시점에 해제"). */
  leaving: boolean
  reduced: boolean
  twinkle: boolean
  stars: readonly TourStar[]
  monthLabel: string
  warmest: { date: string; title: string; caption: string } | null
  moon: { label: string; draft: boolean } | null
  guideSeen: boolean
  dragHintSeen: boolean
  onGuideSeen: () => void
  onDragHintSeen: () => void
  /** 센서가 값을 주지 않음(센서 없음) - 끌기 모드로. */
  onNoSensor: () => void
  onStar: (date: string) => void
}

const MOON_POS = { x: 88, y: 58 }
const LABEL_POS = { x: 14, y: 24 }

export function SkyTour(props: TourProps) {
  const { mode, leaving, reduced, stars } = props
  const rootRef = useRef<HTMLDivElement>(null)
  const [hpw, setHpw] = useState(844 / 390)
  useLayoutEffect(() => {
    const r = rootRef.current?.getBoundingClientRect()
    if (r && r.width > 0 && r.height > 0) setHpw(r.height / r.width)
  }, [])

  // ── 바라보는 방향 = 바탕(센서 또는 끌기) + 덧(칩 회전) ──
  const sensorOn = mode === 'sensor' && !leaving
  const sensor = useSkyOrientation(sensorOn)
  const [dragBase, setDragBase] = useState<View>(FRONT)
  const [offset, setOffset] = useState<View>(FRONT)
  const base = mode === 'sensor' ? (sensor.view ?? FRONT) : dragBase
  const view: View = { yaw: wrap360(base.yaw + offset.yaw), pitch: Math.min(90, Math.max(-10, base.pitch + offset.pitch)) }

  const onNoSensor = props.onNoSensor
  useEffect(() => { if (mode === 'sensor' && sensor.status === 'none') onNoSensor() }, [mode, sensor.status, onNoSensor])

  // ── C10 처음 한 번 ──
  const [guideOpen, setGuideOpen] = useState(!props.guideSeen)
  const onGuideSeen = props.onGuideSeen
  const closeGuide = useCallback(() => {
    setGuideOpen(false)
    onGuideSeen()
  }, [onGuideSeen])
  useEffect(() => {
    if (!guideOpen || mode !== 'sensor' || !sensor.first || !sensor.view) return
    if (moveDeg(sensor.first, sensor.view) > GUIDE_CLOSE_MOVE_DEG) closeGuide()
  }, [guideOpen, mode, sensor.first, sensor.view, closeGuide])

  // ── C08-alt 끌기 + 관성 ──
  const [hintOpen, setHintOpen] = useState(!props.dragHintSeen)
  const drag = useRef<{ id: number; x: number; y: number; start: View; lastX: number; lastY: number; lastAt: number; vx: number; vy: number } | null>(null)
  const anim = useRef<number | null>(null)
  const stopAnim = () => {
    if (anim.current !== null) tourEnv().caf(anim.current)
    anim.current = null
  }
  useEffect(() => () => stopAnim(), [])
  const width = () => rootRef.current?.getBoundingClientRect().width || 390

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== 'drag' || guideOpen) return
    stopAnim()
    const now = tourEnv().now()
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: dragBase, lastX: e.clientX, lastY: e.clientY, lastAt: now, vx: 0, vy: 0 }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const now = tourEnv().now()
    const dt = Math.max(1, now - d.lastAt)
    d.vx = (e.clientX - d.lastX) / dt
    d.vy = (e.clientY - d.lastY) / dt
    d.lastX = e.clientX
    d.lastY = e.clientY
    d.lastAt = now
    setDragBase(dragView(d.start, e.clientX - d.x, e.clientY - d.y, width()))
    if (hintOpen && (Math.abs(e.clientX - d.x) > 4 || Math.abs(e.clientY - d.y) > 4)) {
      setHintOpen(false)
      props.onDragHintSeen()
    }
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (reduced) return // 줄인 모션: 관성 없음
    const from = dragView(d.start, d.lastX - d.x, d.lastY - d.y, width())
    // 관성 600ms - 놓을 때 속도로 0.3초 더 간 자리까지 cubic-bezier(.2,.8,.2,1)
    const to = dragView(from, d.vx * 300, d.vy * 300, width())
    animate(from, to, MOTION_MS.inertia, setDragBase)
  }

  const animate = (from: View, to: View, ms: number, apply: (v: View) => void) => {
    stopAnim()
    const env = tourEnv()
    const t0 = env.now()
    const step = () => {
      const k = Math.min(1, (env.now() - t0) / ms)
      apply(lerpView(from, to, EASE_TURN(k)))
      anim.current = k < 1 ? env.raf(step) : null
    }
    anim.current = env.raf(step)
  }

  // ── 하늘 층 자리(프레임당 한 번 계산) ──
  const points = useMemo(() => stars.map((s) => ({ s, pt: skyPointOf(s.pos, hpw) })), [stars, hpw])
  const placed = points.map(({ s, pt }) => ({ s, p: project(pt, view, hpw) }))
  const moonPt = useMemo(() => skyPointOf(MOON_POS, hpw), [hpw])
  const labelPt = useMemo(() => skyPointOf(LABEL_POS, hpw), [hpw])
  const moonP = props.moon ? project(moonPt, view, hpw) : null
  const labelP = project(labelPt, view, hpw)
  const warm = props.warmest ? placed.find((x) => x.s.date === props.warmest?.date) ?? null : null

  // ── "이번 달 별 ›" ──
  const targets = stars.length > 0 ? points.map((x) => x.pt) : props.moon ? [moonPt] : []
  const chip = offscreenChip(targets, view, hpw)
  const turnTo = (to: View) => {
    const goal: View = { yaw: wrap180(to.yaw - base.yaw), pitch: to.pitch - base.pitch }
    if (reduced) setOffset(goal)
    else animate(offset, goal, MOTION_MS.chipTurn, setOffset)
  }

  const compass = compassMarks(view.yaw)
  const still = reduced || !props.twinkle

  return (
    <div
      ref={rootRef}
      className={`skyTour ${leaving ? 'leave' : 'enter'} ${reduced ? 'reduced' : ''} ${still ? 'noTwinkle' : ''}`}
      data-testid="sky-tour"
      data-mode={mode}
      data-yaw={view.yaw.toFixed(1)}
      data-pitch={view.pitch.toFixed(1)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="skyTourField" data-testid="sky-tour-field">
        {labelP.visible ? <span className="skyMonthLabel tour" style={{ left: `${labelP.x}%`, top: `${labelP.y}%` }} data-testid="sky-tour-label">{props.monthLabel}</span> : null}
        {placed.filter((x) => x.p.visible).map(({ s, p }) => (
          <button
            key={s.date}
            type="button"
            className="skyStar"
            style={{ left: `${p.x}%`, top: `${p.y}%`, '--s': `${s.size}px`, '--p': `${s.period}s`, '--d': `${s.delay}s` } as CSSProperties}
            data-testid={`sky-tour-star-${s.date}`}
            aria-label={s.label}
            onClick={() => props.onStar(s.date)}
          ><i /></button>
        ))}
        {warm && warm.p.visible && props.warmest ? (
          <span className="skyStarLabel" style={{ left: `${warm.p.x}%`, top: `${warm.p.y}%` }} data-testid="sky-tour-warmest">
            <b>{props.warmest.title}</b>
            <em>{props.warmest.caption}</em>
          </span>
        ) : null}
        {props.moon && moonP?.visible ? (
          <span className={`skyMoon tour ${props.moon.draft ? 'draft' : 'published'}`} style={{ left: `${moonP.x}%`, top: `${moonP.y}%` }} data-testid="sky-tour-moon">
            <i />
            <em>{props.moon.label}</em>
          </span>
        ) : null}
      </div>

      {chip ? (
        <button type="button" className={`skyTourChip press ${chip.side}`} onClick={() => turnTo(chip.to)} data-testid="sky-tour-chip" data-side={chip.side}>
          {chip.side === 'left' ? `‹ ${TOUR_COPY.chip}` : `${TOUR_COPY.chip} ›`}
        </button>
      ) : null}

      <div className="skyCompass" aria-hidden="true" data-testid="sky-compass">
        <div className="hill" />
        <div className="ticks">
          {compass.ticks.map((t, i) => <i key={i} className={t.long ? 'long' : ''} style={{ left: `${t.x}%` }} />)}
        </div>
        {compass.labels.map((l) => (
          <span key={l.name} className={`dir ${l.front ? 'front' : ''}`} style={{ left: `${l.x}%` }} data-testid={l.front ? 'sky-compass-front' : undefined}>{l.name}</span>
        ))}
      </div>

      {mode === 'drag' && hintOpen && !guideOpen ? (
        <div className="skyDragHint" data-testid="sky-drag-hint">
          <div className="row"><span aria-hidden="true">←</span><span className="finger"><HandIcon /></span><span aria-hidden="true">→</span></div>
          <p>{TOUR_COPY.dragHint}</p>
        </div>
      ) : null}

      {guideOpen ? (
        <div className="skyGuide" role="dialog" aria-label={mode === 'sensor' ? TOUR_COPY.guideSensorTitle : TOUR_COPY.guideDragTitle} data-testid="sky-guide">
          <div className="skyGuideArt" aria-hidden="true">{mode === 'sensor' ? <PhoneArcIcon /> : <HandIcon big />}</div>
          <h2>{mode === 'sensor' ? TOUR_COPY.guideSensorTitle : TOUR_COPY.guideDragTitle}</h2>
          <p className="pre">{mode === 'sensor' ? TOUR_COPY.guideSensorBody : TOUR_COPY.guideDragBody}</p>
          <button type="button" className="skyPill press" onClick={closeGuide} data-testid="sky-guide-ok">{TOUR_COPY.guideOk}</button>
        </div>
      ) : null}
    </div>
  )
}

function HandIcon({ big }: { big?: boolean }) {
  const s = big ? 40 : 22
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2" />
      <path d="M15 11a1.5 1.5 0 0 1 3 0v3.5a5.5 5.5 0 0 1-5.5 5.5h-.8a5 5 0 0 1-3.9-1.9L5 14.5a1.4 1.4 0 0 1 2.1-1.8L9 14" />
    </svg>
  )
}

function PhoneArcIcon() {
  return (
    <svg width="200" height="150" viewBox="0 0 200 150" fill="none">
      <path d="M20 90 A80 80 0 0 1 180 90" stroke="rgba(185,162,240,.8)" strokeWidth="2" strokeDasharray="6 6" />
      <path d="M172 82 l8 8 l-12 2" stroke="rgba(185,162,240,.8)" strokeWidth="2" fill="none" />
      <g transform="rotate(-18 100 70)">
        <rect x="78" y="30" width="44" height="76" rx="10" stroke="#D7C9FA" strokeWidth="3" fill="#0E0B1C" />
        <circle cx="96" cy="54" r="4" fill="#F3EFF7" />
        <circle cx="108" cy="66" r="2.5" fill="#F3EFF7" />
        <circle cx="94" cy="72" r="2" fill="#F3EFF7" />
      </g>
      <path d="M62 128 h76" stroke="rgba(185,162,240,.6)" strokeWidth="2" />
    </svg>
  )
}
