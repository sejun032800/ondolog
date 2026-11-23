/**
 * 85- · 89- 하늘 둘러보기 - C08(센서) · C08-alt(끌기) · C10(처음 한 번 안내) · "이번 달 별" 칩. MASTER 9-8-4 · 보드 `N-R17b-Our-Sky-3`(patch10) 2-1 · 2-3 · 17-d+.
 *  - 하늘 한 장(patch9b "층 분리" 대체): 원본(`sky_pano_360.jpg` `<img>` 두 장) · 배경 별 20 · 지평선 실루엣 · 이 달 지면(별 · 달 · 라벨 - C01과 같은 `MonthField`)이
 *    **한 띠의 자식**이다. 띠는 `transform: translate3d`만 바뀐다(배경 위치 애니메이션 0 · 합성층 하나 - V40).
 *  - 좌표: 1° = 3116.8 / 360pt · 둘레 3116.8pt · x는 (−둘레/2, 둘레/2]로 되돌림 · 들어갈 때 바라본 쪽 = 0° = C01 그림. 세로는 끌기에서 아래 10°까지만.
 *  - 센서는 85-b의 yaw 하나만(들어갈 때의 yaw = 0°) · 나침반 차이 보정은 쓰지 않는다(`useSkyOrientation(…, { compass: false })` - 평활은 α 0.2 한 번).
 *  - 바라보는 쪽 이름 하나(네 방향 - 실제 나침반 아님) + 4px 점 4개 · 바뀔 때 교차 페이드 240ms + 6pt 밀림 · 경계 ±45°에 5° 여유.
 *  - "이번 달 별" 칩: 늘 처음 만난 쪽으로 짧은 쪽 800ms. 나가기(✕ · 뒤로): 처음 만난 쪽으로 짧은 쪽 500ms -> 이름 180ms 사라짐(부모가 그 뒤 C01로).
 *  - 머리 · ✕는 부모(`SkyScreen`)가 그대로 그린다. 센서 값은 메모리 숫자뿐 - 저장 · 전송 0. 봤음 표시만 기기에(`skyPrefs`).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  BAND_BOTTOM_PT, CIRC_PT, DIRECTION_NAMES, EASE_TURN, ENTRY, GUIDE_CLOSE_MOVE_DEG, MOTION_MS, PANO_HEIGHT_PT, PANO_SRC, WINDOW_PT,
  backgroundStarSpots, bandLiftPt, bandShiftPt, chipSide, directionIndex, dragBand, groundPath, lerpBand, wrap180, wrap360, type BandView,
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

export interface TourProps {
  mode: 'sensor' | 'drag'
  /** 나가기 시작 - 리스너는 이때 뗀다(모션표 "나가기 시작 시점에 해제"). 처음 만난 쪽으로 돌아간 뒤 부모가 없앤다. */
  leaving: boolean
  reduced: boolean
  twinkle: boolean
  /** 들어가는 창(0~390pt) 안의 이 달 지면 - C01과 같은 부품. */
  field: ReactNode
  /** 칩이 찾는 자리 - 이번 달 별(없으면 달)의 창 안 x(pt). */
  targetsPt: readonly number[]
  guideSeen: boolean
  dragHintSeen: boolean
  onGuideSeen: () => void
  onDragHintSeen: () => void
  /** 센서가 값을 주지 않음(센서 없음) - 끌기 모드로. */
  onNoSensor: () => void
}

const GROUND = groundPath()
const BG_STARS = backgroundStarSpots()

export function SkyTour(props: TourProps) {
  const { mode, leaving, reduced } = props
  const rootRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 390, h: 844 })
  useLayoutEffect(() => {
    const r = rootRef.current?.getBoundingClientRect()
    if (r && r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height })
  }, [])
  const s = box.w / WINDOW_PT   // px / pt

  // ── 바라보는 쪽 = 바탕(센서 yaw 또는 끌기) + 덧(칩 · 나가기 회전) ──
  const sensorOn = mode === 'sensor' && !leaving
  const sensor = useSkyOrientation(sensorOn, { compass: false })
  const sensorYaw = sensor.view && sensor.first ? wrap360(sensor.view.yaw - sensor.first.yaw) : 0
  const [dragBase, setDragBase] = useState<BandView>(ENTRY)
  const [offset, setOffset] = useState(0)
  const base: BandView = mode === 'sensor' ? { yaw: sensorYaw, down: 0 } : dragBase
  const yaw = wrap360(base.yaw + offset)

  const onNoSensor = props.onNoSensor
  useEffect(() => { if (mode === 'sensor' && sensor.status === 'none') onNoSensor() }, [mode, sensor.status, onNoSensor])

  // ── 움직임(칩 · 나가기 · 관성) - 주입한 프레임으로 ──
  const anim = useRef<number | null>(null)
  const stopAnim = () => {
    if (anim.current !== null) tourEnv().caf(anim.current)
    anim.current = null
  }
  useEffect(() => () => stopAnim(), [])
  const run = (ms: number, step: (k: number) => void) => {
    stopAnim()
    const env = tourEnv()
    const t0 = env.now()
    const tick = () => {
      const k = Math.min(1, (env.now() - t0) / ms)
      step(EASE_TURN(k))
      anim.current = k < 1 ? env.raf(tick) : null
    }
    anim.current = env.raf(tick)
  }
  /** 처음 만난 쪽(yaw 0)으로 짧은 쪽 회전 - 덧(offset)만 움직인다. */
  const turnHome = (ms: number) => {
    const from = offset
    const to = offset - wrap180(yaw)
    if (reduced || ms <= 0) { setOffset(to); return }
    run(ms, (k) => setOffset(from + (to - from) * k))
  }

  // ── C10 처음 한 번 ──
  const [guideOpen, setGuideOpen] = useState(!props.guideSeen)
  const onGuideSeen = props.onGuideSeen
  const closeGuide = useCallback(() => {
    setGuideOpen(false)
    onGuideSeen()
  }, [onGuideSeen])
  useEffect(() => {
    if (!guideOpen || mode !== 'sensor' || !sensor.view || !sensor.first) return
    if (Math.abs(wrap180(sensorYaw)) > GUIDE_CLOSE_MOVE_DEG) closeGuide()
  }, [guideOpen, mode, sensor.view, sensor.first, sensorYaw, closeGuide])

  // ── C08-alt 끌기 + 관성 ──
  const [hintOpen, setHintOpen] = useState(!props.dragHintSeen)
  const drag = useRef<{ id: number; x: number; y: number; start: BandView; lastX: number; lastY: number; lastAt: number; vx: number; vy: number } | null>(null)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== 'drag' || guideOpen || leaving) return
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
    setDragBase(dragBand(d.start, (e.clientX - d.x) / s, (e.clientY - d.y) / s))
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
    const from = dragBand(d.start, (d.lastX - d.x) / s, (d.lastY - d.y) / s)
    // 관성 600ms - 놓을 때 속도로 0.3초 더 간 자리까지 cubic-bezier(.2,.8,.2,1)
    const to = dragBand(from, (d.vx * 300) / s, (d.vy * 300) / s)
    run(MOTION_MS.inertia, (k) => setDragBase(lerpBand(from, to, k)))
  }

  // ── 나가기: 처음 만난 쪽으로 짧은 쪽 500ms(아래로 본 것도 제자리로) ──
  const leftOnce = useRef(false)
  useEffect(() => {
    if (!leaving || leftOnce.current) return
    leftOnce.current = true
    drag.current = null
    const fromDown = dragBase.down
    const from = offset
    const to = offset - wrap180(yaw)
    if (reduced) { setOffset(to); setDragBase((b) => ({ ...b, down: 0 })); return }
    run(MOTION_MS.exitTurn, (k) => {
      setOffset(from + (to - from) * k)
      setDragBase((b) => ({ ...b, down: fromDown * (1 - k) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  // ── 바라보는 쪽 이름(5° 여유) · 바뀔 때 앞 이름은 밀려 사라진다 ──
  const nameRef = useRef<number | null>(null)
  const idx = directionIndex(yaw, nameRef.current)
  const [names, setNames] = useState<{ cur: number; prev: number | null; dir: 1 | -1; seq: number }>({ cur: idx, prev: null, dir: 1, seq: 0 })
  useEffect(() => {
    const before = nameRef.current
    nameRef.current = idx
    if (before === null || before === idx) return
    setNames((n) => ({ cur: idx, prev: before, dir: wrap180((idx - before) * 90) > 0 ? 1 : -1, seq: n.seq + 1 }))
  }, [idx])
  useEffect(() => {
    if (names.prev === null) return
    const t = window.setTimeout(() => setNames((n) => (n.seq === names.seq ? { ...n, prev: null } : n)), MOTION_MS.nameFade)
    return () => window.clearTimeout(t)
  }, [names.prev, names.seq])

  // ── "이번 달 별" 칩 ──
  const chip = leaving ? null : chipSide(props.targetsPt, yaw)

  // ── 띠 ──
  const shiftPx = bandShiftPt(yaw) * s
  const liftPx = bandLiftPt(base.down) * s
  const bandTop = box.h - BAND_BOTTOM_PT * s   // 띠 y(pt) 0 줄의 화면 자리 - C01처럼 화면 아래에 맞춘다
  const bandStyle = { transform: `translate3d(${shiftPx.toFixed(2)}px, ${liftPx.toFixed(2)}px, 0)` } as CSSProperties
  const panoStyle = (copy: number): CSSProperties => ({ left: `${(copy * CIRC_PT * s).toFixed(2)}px`, top: `${bandTop.toFixed(2)}px`, width: `${(CIRC_PT * s).toFixed(2)}px`, height: `${(PANO_HEIGHT_PT * s).toFixed(2)}px` })
  const bgStars = useMemo(() => BG_STARS.map((p, k) => (
    <span
      key={k}
      className="star"
      style={{ left: `${(p.x * s).toFixed(1)}px`, top: `${(bandTop + p.y * s).toFixed(1)}px`, width: 1.5, height: 1.5, '--p': `${(9 + (p.i % 4)) / 2}s`, '--d': `${-((p.i * 997) % 4500)}ms` } as CSSProperties}
    />
  )), [s, bandTop])
  const still = reduced || !props.twinkle

  return (
    <div
      ref={rootRef}
      className={`skyTour ${leaving ? 'leave' : 'enter'} ${reduced ? 'reduced' : ''} ${still ? 'noTwinkle' : ''}`}
      data-testid="sky-tour"
      data-mode={mode}
      data-yaw={yaw.toFixed(1)}
      data-down={base.down.toFixed(1)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="skyBand" style={bandStyle} data-testid="sky-band" data-shift={bandShiftPt(yaw).toFixed(2)}>
        <img className="skyPano" src={PANO_SRC} alt="" draggable={false} style={panoStyle(-1)} />
        <img className="skyPano" src={PANO_SRC} alt="" draggable={false} style={panoStyle(0)} />
        <div className="skyBandVeil" style={{ left: `${(-CIRC_PT * s).toFixed(2)}px`, width: `${(2 * CIRC_PT * s).toFixed(2)}px` }} />
        {bgStars}
        <svg
          className="skyBandGround"
          style={{ left: `${(-CIRC_PT * s).toFixed(2)}px`, top: `${bandTop.toFixed(2)}px`, width: `${(2 * CIRC_PT * s).toFixed(2)}px`, height: `${(BAND_BOTTOM_PT * s).toFixed(2)}px` }}
          viewBox={`${-CIRC_PT} 0 ${2 * CIRC_PT} ${BAND_BOTTOM_PT}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="skyGroundFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0E0B19" /><stop offset="1" stopColor="#06050B" /></linearGradient>
          </defs>
          {[-CIRC_PT, 0].map((o) => (
            <g key={o} transform={`translate(${o} 0)`}>
              <path d={`${GROUND} L${CIRC_PT} ${BAND_BOTTOM_PT} L0 ${BAND_BOTTOM_PT}Z`} fill="url(#skyGroundFill)" />
              <path d={GROUND} fill="none" stroke="rgba(201,193,218,.45)" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>
        <div className="skyBandWindow" style={{ width: `${box.w}px`, height: `${box.h}px` }} data-testid="sky-tour-field">{props.field}</div>
      </div>

      {chip ? (
        <button type="button" className={`skyTourChip press ${chip}`} onClick={() => turnHome(MOTION_MS.chipTurn)} data-testid="sky-tour-chip" data-side={chip}>
          {chip === 'left' ? `‹ ${TOUR_COPY.chip}` : `${TOUR_COPY.chip} ›`}
        </button>
      ) : null}

      <div className="skyDirs" aria-live="polite" data-testid="sky-dirs">
        <div className="skyDirNames">
          {names.prev !== null ? (
            <span key={`p${names.seq}`} className="skyDirName out" style={{ '--to': `${-6 * names.dir}px` } as CSSProperties} aria-hidden="true">{DIRECTION_NAMES[names.prev]}</span>
          ) : null}
          <span key={`c${names.seq}`} className={`skyDirName ${names.seq > 0 ? 'in' : ''}`} style={{ '--from': `${6 * names.dir}px` } as CSSProperties} data-testid="sky-dir" data-index={names.cur}>{DIRECTION_NAMES[names.cur]}</span>
        </div>
        <div className="skyDirDots" aria-hidden="true" data-testid="sky-dir-dots">
          {DIRECTION_NAMES.map((n, k) => <i key={n} className={k === names.cur ? 'on' : ''} />)}
        </div>
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
  const sz = big ? 40 : 22
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
