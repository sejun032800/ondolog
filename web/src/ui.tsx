/**
 * 앱 Nocturne 컴포넌트의 웹 이식판 — 원본: src/components/nocturne/*, src/components/onboarding/*.
 * 스타일 값은 원본 StyleSheet 그대로 styles.css로 옮겼다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBackHandler } from './platform/backStack'

/* ── 하늘 (SkyBackground + sky.ts) ───────────────────────────── */
export const WORLD_HEIGHT_RATIO = 2.37
export const DESIGN_HEIGHT = 844
export const viewOffsetPt = { main: 1156, pullStart: 1040, pullRelease: 900, sky: 620, deep: 470 } as const

/** BackgroundStars.tsx 고정 표 그대로. */
const BACKGROUND_STARS = [
  { x: 0.08, y: 0.06, size: 2 }, { x: 0.22, y: 0.14, size: 1.5 }, { x: 0.37, y: 0.05, size: 2 },
  { x: 0.55, y: 0.11, size: 1.5 }, { x: 0.71, y: 0.04, size: 2.5 }, { x: 0.88, y: 0.13, size: 1.5 },
  { x: 0.14, y: 0.27, size: 1.5 }, { x: 0.31, y: 0.33, size: 2 }, { x: 0.48, y: 0.24, size: 1.5 },
  { x: 0.64, y: 0.3, size: 2 }, { x: 0.82, y: 0.26, size: 1.5 }, { x: 0.94, y: 0.36, size: 2 },
  { x: 0.06, y: 0.44, size: 2 }, { x: 0.26, y: 0.5, size: 1.5 }, { x: 0.43, y: 0.42, size: 2.5 },
  { x: 0.6, y: 0.49, size: 1.5 }, { x: 0.77, y: 0.45, size: 2 }, { x: 0.9, y: 0.54, size: 1.5 },
]
function twinklePeriodMs(i: number) { return 9000 + ((i * 3) % 7) * (3000 / 6) }

export interface SkyState {
  visible: boolean
  offset: number
  veil: number
  bottomVeil: boolean
  /** 하늘 이동 시간(ms). */
  moveMs: number
  ease?: string
  meteors?: boolean
}

/**
 * 화면 비율이 기기마다 달라도(특히 툴바가 있는 모바일 인앱 브라우저) 지평선·산이 잘리지 않게,
 * 앱의 오프셋(390×844 기준, 세계 2000pt)을 "이미지 아래끝에서 얼마나 올라왔나"로 바꿔 순수 CSS로 맞춘다.
 * 이미지는 폭에 맞춰 원래 비율 그대로 두고, 컨테이너 단위(cqw/cqh)로 위치를 잡는다 — JS 높이 측정이 필요 없다.
 */
const DESIGN_WORLD = DESIGN_HEIGHT * WORLD_HEIGHT_RATIO // ≈ 2000
export function SkyLayer({ sky }: { sky: SkyState; height?: number }) {
  const fromBottom = Math.max(0, DESIGN_WORLD - DESIGN_HEIGHT - sky.offset)
  return (
    <div className="sky" style={{ opacity: sky.visible ? 1 : 0 }}>
      <img
        src="./img/sky_world.jpg"
        alt=""
        draggable={false}
        style={{
          transform: `translateY(calc(-100% + 100cqh + ${(fromBottom / 390) * 100}cqw))`,
          transition: `transform ${sky.moveMs}ms ${sky.ease ?? 'cubic-bezier(.45,.05,.35,1)'}`,
        }}
      />
      <div className="veil" style={{ opacity: sky.veil }} />
      {BACKGROUND_STARS.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: s.size, height: s.size,
            ['--p' as string]: `${twinklePeriodMs(i) / 2}ms`, ['--d' as string]: `${-((i * 997) % 4500)}ms`,
          }}
        />
      ))}
      <div className="bottomVeil" style={{ opacity: sky.bottomVeil ? 1 : 0 }} />
      {sky.meteors ? <Meteors /> : null}
    </div>
  )
}

/** 유성 — sky.ts `meteor` 상수(꼬리 236, 각도 -31°, 2.4초, 한 번에 하나). 데모라 간격을 짧게 둔다. */
function Meteors() {
  const [m, setM] = useState<{ id: number; x: number; y: number } | null>(null)
  useEffect(() => {
    let id = 0
    let t: number
    const fire = (delay: number) => {
      t = window.setTimeout(() => {
        id += 1
        setM({ id, x: 55 + Math.random() * 40, y: 6 + Math.random() * 30 })
        fire(5200 + Math.random() * 4000)
      }, delay)
    }
    fire(2600)
    return () => window.clearTimeout(t)
  }, [])
  if (!m) return null
  return <span key={m.id} className="meteor fly" style={{ left: `${m.x}%`, top: `${m.y}%` }} />
}

/* ── 버튼·카드·머리 ─────────────────────────────────────────── */
export function PrimaryButton({ label, onClick, disabled, variant = 'primary' }: {
  label: string; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'kakao'
}) {
  return (
    <button className={`btn press ${variant}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )
}

export function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="link press" onClick={onClick}>{label}</button>
}

export function StepBars({ current, total = 4 }: { current: number; total?: number }) {
  return (
    <div className="bars" aria-label={`${total}단계 중 ${current}단계`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < current ? 'on' : ''} />)}
    </div>
  )
}

export function StepCounter({ current, total }: { current: number; total: number }) {
  return <span className="counter">{current} / {total}</span>
}

export function BackArrow({ onClick }: { onClick: () => void }) {
  return <button className="back press" aria-label="뒤로" onClick={onClick}>←</button>
}

/** OnboardingScreen.tsx 이식: 머리(← · 오른쪽) · 본문(RiseIn) · 아래 고정 영역. */
export function OnboardingScreen({ onBack, headerRight, belowHeader, title, subtitle, children, footer, animKey }: {
  onBack?: () => void; headerRight?: ReactNode; belowHeader?: ReactNode; title?: string; subtitle?: string
  children?: ReactNode; footer?: ReactNode; animKey?: string | number
}) {
  useBackHandler(onBack)
  return (
    <div className="screen solid">
      <div className="header">
        {onBack ? <BackArrow onClick={onBack} /> : <span style={{ height: 48 }} />}
        <div>{headerRight}</div>
      </div>
      {belowHeader ? <div className="belowHeader">{belowHeader}</div> : null}
      <div className="content">
        <div className="rise" key={animKey}>
          {title ? <h1 className="t-display c-text pre">{title}</h1> : null}
          {subtitle ? <p className="t-sub c-sub subtitle pre">{subtitle}</p> : null}
          {children}
        </div>
      </div>
      {footer ? <div className="footer">{footer}</div> : null}
    </div>
  )
}

export function ChoiceCard({ label, sub, letter, selected, onClick }: {
  label: string; sub?: string; letter?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button className={`choice press ${selected ? 'on' : ''}`} role="radio" aria-checked={selected} onClick={onClick}>
      {letter ? <span className="letter">{letter}</span> : null}
      <span className="texts">
        <span className={sub ? 'title' : 'only'}>{label}</span>
        {sub ? <span className="t-sub c-mute">{sub}</span> : null}
      </span>
    </button>
  )
}

export function CheckBox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return <span className={`check ${checked ? 'on' : ''} ${disabled && !checked ? 'disabled' : ''}`}>{checked ? '✓' : ''}</span>
}

export function ConsentRow({ label, tag, helper, checked, trailingNote, onToggle, onView, strong }: {
  label: string; tag?: string; helper?: string; checked: boolean; trailingNote?: string
  onToggle?: () => void; onView?: () => void; strong?: boolean
}) {
  const body = (
    <>
      <CheckBox checked={checked} />
      <span className="texts">
        <span className="nameLine">
          <span className={`name ${strong ? 'strong' : ''}`}>{label}</span>
          {tag ? <span className="t-caption c-mute">{tag}</span> : null}
        </span>
        {helper ? <span className="t-sub c-mute" style={{ fontSize: 13 }}>{helper}</span> : null}
      </span>
    </>
  )
  return (
    <div className="crow">
      {onToggle ? <button className="main press" role="checkbox" aria-checked={checked} onClick={onToggle}>{body}</button> : <div className="main">{body}</div>}
      {trailingNote ? <span className="t-caption c-mute" style={{ paddingTop: 4 }}>{trailingNote}</span> : null}
      {onView ? <button className="view" onClick={onView}>보기</button> : null}
    </div>
  )
}

/** ONDOLOG 글자표(Wordmark.tsx) — 결과 화면용 정지판. */
export function Wordmark({ size = 14 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 5, height: 5, borderRadius: 9, background: 'var(--text)', boxShadow: '0 0 14px 5px rgba(244,185,200,.5)' }} />
      <span style={{ fontWeight: 500, fontSize: size, letterSpacing: size * 0.46, paddingLeft: size * 0.46 }}>ONDOLOG</span>
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<number | undefined>(undefined)
  const show = (m: string) => {
    setMsg(m)
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setMsg(null), 1800)
  }
  const node = msg ? <div className="toast" key={msg + Date.now()}>{msg}</div> : null
  return { show, node }
}

/** 지정한 ms 뒤 true. 등장 연출 순서용. */
export function useAfter(ms: number, deps: unknown[] = []) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(false)
    const t = window.setTimeout(() => setOn(true), ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return on
}

/** 요소가 화면에 한 번이라도 보였는가 — 설명이 길어져 아래로 밀린 차트를 보일 때 움직이게 한다. */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting && e.intersectionRatio > 0.35)) setSeen(true) }, { threshold: [0, 0.35, 0.6] })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return { ref, seen }
}
