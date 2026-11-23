/**
 * 85-b 둘러보기 센서 안정화(ROADMAP r147 R147-3) - 녹화 패턴(방위 띠 0.1초에 90° 넘게 건너뜀 · 위아래 기울임이 좌우에 섞임) 재현.
 * 가짜 센서 값 열은 "실제 자세(방위 · 높이 · 비틀림)" -> W3C 세 각도(alpha · beta · gamma, 기기가 주는 범위 그대로)로 만든다.
 * 같은 값 열을 85-의 옛 계산(방위 = 360 − alpha · 높이 = beta − 90)에 넣으면 튄다는 것도 함께 보여 준다(증인).
 * 시계 · 프레임은 주입(실제 시계 0 - 76-j). 랜덤 0(값 열은 sin 꼴로 고정).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  COMPASS_NONE, COMPASS_OUTLIER_DEG, COMPASS_RESET_COUNT, SENSOR_MIN_INTERVAL_MS,
  lookFromOrientation, nextCompass, smoothView, withCompass, wrap180, wrap360, type CompassState, type View,
} from './tourMath'
import { setTourEnvForTest, useSkyOrientation } from './useSkyOrientation'

/** 한 틱(1/30초) 화면 방위 변화 문턱. 15°/틱 = 450°/초 - 사람이 하늘을 둘러보며 도는 속도(이 시험 30°/초 · 빨라도 90°/초 = 3°/틱)보다
 *  한참 크고, 녹화의 튐(0.1초 = 3틱에 90° 넘게 = 30°/틱 넘게)보다 작다. */
const MAX_STEP_DEG = 15
const TICK_MS = Math.ceil(SENSOR_MIN_INTERVAL_MS) + 1 // 30Hz 솎음을 넘는 간격

// ---------------------------------------------------------------------------
// 자세 -> W3C 세 각도(시험 도구)
// ---------------------------------------------------------------------------
type M3 = number[][]
const d2r = Math.PI / 180
const mul = (a: M3, b: M3): M3 => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]))
const rx = (t: number): M3 => { const c = Math.cos(t * d2r), s = Math.sin(t * d2r); return [[1, 0, 0], [0, c, -s], [0, s, c]] }
const rz = (t: number): M3 => { const c = Math.cos(t * d2r), s = Math.sin(t * d2r); return [[c, -s, 0], [s, c, 0], [0, 0, 1]] }

interface Angles { alpha: number; beta: number; gamma: number }

/** 회전 행렬 -> W3C 세 각도(alpha [0,360) · beta [-180,180) · gamma [-90,90)) - 기기가 고르는 표현. 경계(R22 = 0)를 넘으면 alpha · gamma가 뒤집힌다. */
function anglesOf(R: M3): Angles {
  const h = Math.hypot(R[2][0], R[2][2])
  const pos = R[2][2] >= 0
  const beta = Math.atan2(R[2][1], pos ? h : -h) / d2r
  const gamma = (pos ? Math.atan2(-R[2][0], R[2][2]) : Math.atan2(R[2][0], -R[2][2])) / d2r
  const alpha = (pos ? Math.atan2(-R[0][1], R[1][1]) : Math.atan2(R[0][1], -R[1][1])) / d2r
  return { alpha: wrap360(alpha), beta: beta >= 180 ? beta - 360 : beta, gamma }
}

/**
 * 실제 자세 -> 세 각도. 폰을 세로로 세워 `yaw`(북 0 · 시계 방향)를 보고 `pitch`만큼 올려다보며, 시선 축으로 `roll`만큼 비튼다.
 * `screenTurn` = 기기를 화면 쪽에서 볼 때 반시계로 돌린 각(가로 90). `alphaOrigin` = 기기 alpha 기준이 북에서 어긋난 각(iOS 임의).
 */
function poseAngles(p: { yaw: number; pitch: number; roll?: number; screenTurn?: number; alphaOrigin?: number }): Angles {
  const R = mul(mul(mul(rz(-p.yaw + (p.alphaOrigin ?? 0)), rx(90 + p.pitch)), rz(p.roll ?? 0)), rz(p.screenTurn ?? 0))
  return anglesOf(R)
}

/** 85-의 옛 계산(증인). */
const oldYaw = (a: Angles) => wrap360(360 - a.alpha)

function maxStep(yaws: number[]): number {
  let m = 0
  for (let i = 1; i < yaws.length; i += 1) m = Math.max(m, Math.abs(wrap180(yaws[i] - yaws[i - 1])))
  return m
}
function totalTurn(yaws: number[]): number {
  let t = 0
  for (let i = 1; i < yaws.length; i += 1) t += wrap180(yaws[i] - yaws[i - 1])
  return t
}

// ---------------------------------------------------------------------------
// 실제 훅에 값 열 흘리기(30Hz · 틱마다 프레임 2개 = 60fps)
// ---------------------------------------------------------------------------
function runHook(stream: (Angles & { webkitCompassHeading?: number })[], screenAngle = 0): View[] {
  let clock = 0
  const frames = new Map<number, (t: number) => void>()
  const listeners = new Set<(e: Event) => void>()
  let seq = 0
  setTourEnvForTest({
    target: {
      addEventListener: (_t: string, l: EventListenerOrEventListenerObject) => { listeners.add(l as (e: Event) => void) },
      removeEventListener: (_t: string, l: EventListenerOrEventListenerObject) => { listeners.delete(l as (e: Event) => void) },
    },
    now: () => clock,
    raf: (cb) => { seq += 1; frames.set(seq, cb); return seq },
    caf: (id) => { frames.delete(id) },
    setTimer: () => 0,
    clearTimer: () => {},
    screenAngle: () => screenAngle,
  })
  const { result, unmount } = renderHook(() => useSkyOrientation(true))
  const out: View[] = []
  for (const s of stream) {
    clock += TICK_MS
    const e = Object.assign(new Event('deviceorientation'), s)
    act(() => { for (const l of [...listeners]) l(e) })
    for (let k = 0; k < 2; k += 1) {
      const pending = [...frames.values()]
      frames.clear()
      act(() => { for (const f of pending) f(clock) })
    }
    out.push(result.current.view!)
  }
  unmount()
  return out
}

afterEach(() => setTourEnvForTest(undefined))

// ---------------------------------------------------------------------------

describe('85-b 회전 행렬 -> 시선', () => {
  it('같은 자세의 다른 각도 표현은 같은 시선: (α, β, γ) ≡ (α+180, 180−β, γ+180) · β = 90에서 (α+δ, γ−δ)', () => {
    for (const [a, b, g] of [[30, 85, 4], [200, 95, -7], [10, 120, 30], [300, 60, -45]]) {
      const v1 = lookFromOrientation({ alpha: a, beta: b, gamma: g })!
      const v2 = lookFromOrientation({ alpha: a + 180, beta: 180 - b, gamma: g + 180 })!
      expect(Math.abs(wrap180(v1.yaw - v2.yaw))).toBeLessThan(1e-6)
      expect(v1.pitch).toBeCloseTo(v2.pitch, 6)
    }
    // 짐벌 잠김: beta 90이면 alpha와 gamma가 같은 축 - 85-는 alpha만 봐서 60° 튀었다.
    const lock1 = lookFromOrientation({ alpha: 20, beta: 90, gamma: 0 })!
    const lock2 = lookFromOrientation({ alpha: 80, beta: 90, gamma: -60 })!
    expect(Math.abs(wrap180(lock1.yaw - lock2.yaw))).toBeLessThan(1e-6)
    expect(Math.abs(wrap180(oldYaw({ alpha: 20, beta: 90, gamma: 0 }) - oldYaw({ alpha: 80, beta: 90, gamma: -60 })))).toBeCloseTo(60, 6)
  })

  it('자세를 그대로 읽는다(방위 · 높이) - 세로 · 가로 화면(화면 방향 보정)', () => {
    for (const yaw of [0, 45, 170, 300]) {
      for (const pitch of [-10, 0, 30, 60, 85]) {
        const v = lookFromOrientation(poseAngles({ yaw, pitch }))!
        expect(Math.abs(wrap180(v.yaw - yaw))).toBeLessThan(1e-6)
        expect(v.pitch).toBeCloseTo(pitch, 6)
        const land = lookFromOrientation(poseAngles({ yaw, pitch, screenTurn: 90 }), 90)!
        expect(Math.abs(wrap180(land.yaw - yaw))).toBeLessThan(1e-6)
        expect(land.pitch).toBeCloseTo(pitch, 6)
      }
    }
    // 보정이 없으면(가로인데 0으로 계산) 올려다볼수록 방위가 옆으로 샌다.
    const wrong = lookFromOrientation(poseAngles({ yaw: 0, pitch: 60, screenTurn: 90 }), 0)!
    expect(Math.abs(wrap180(wrong.yaw))).toBeGreaterThan(MAX_STEP_DEG)
  })

  it('꼭대기(높이 90) 근처에서도 끊기지 않는다 - 시선이 수평 성분을 잃어도 화면 위쪽이 방위를 잇는다', () => {
    const yaws: number[] = []
    for (let p = 70; p <= 90; p += 0.5) yaws.push(lookFromOrientation(poseAngles({ yaw: 210, pitch: p, roll: 1 }))!.yaw)
    expect(maxStep(yaws)).toBeLessThan(1)
    for (const y of yaws) expect(Math.abs(wrap180(y - 210))).toBeLessThan(2)
  })
})

describe('85-b 녹화 패턴 재현(실제 훅 · 30Hz · α 0.2)', () => {
  it('(a) 폰을 세운 채 천천히 한 바퀴(30°/초 · 비틀림 ±2° · 높이 ±3° 흔들림): 틱마다 ≤ 15° · 실제 돈 만큼(360°)만 · 방위가 차례로', () => {
    const stream: Angles[] = []
    for (let i = 0; i <= 360; i += 1) stream.push(poseAngles({ yaw: i, pitch: 3 * Math.sin(i * 0.3), roll: 2 * Math.sin(i * 0.7) }))
    // 증인: 같은 값 열을 85- 계산에 넣으면 튄다(지평선을 오갈 때 alpha가 뒤집힘).
    expect(maxStep(stream.map(oldYaw))).toBeGreaterThan(90)
    const yaws = runHook(stream).map((v) => v.yaw)
    expect(maxStep(yaws)).toBeLessThanOrEqual(MAX_STEP_DEG)
    expect(totalTurn(yaws)).toBeGreaterThan(350)
    expect(totalTurn(yaws)).toBeLessThan(362)
    // 시계 방향으로만(되돌아 도는 틱 0 - 평활이 따라가는 중에도)
    for (let i = 1; i < yaws.length; i += 1) expect(wrap180(yaws[i] - yaws[i - 1])).toBeGreaterThan(-0.5)
  })

  it('(b) β 85° ↔ 95°를 오가며 α · γ가 180° 뒤집히는 값 열(비틀림 1°): 방위 그대로 · 틱마다 ≤ 15°', () => {
    const stream: Angles[] = []
    for (let i = 0; i < 120; i += 1) stream.push(poseAngles({ yaw: 40, pitch: 5 * Math.sin(i * 0.2), roll: 1 }))
    // 값 열이 정말 뒤집히는 꼴인지(β 85~95 · α가 180° 건너뜀)
    expect(Math.min(...stream.map((s) => s.beta))).toBeLessThan(86)
    expect(Math.max(...stream.map((s) => s.beta))).toBeGreaterThan(94)
    expect(maxStep(stream.map((s) => s.alpha))).toBeGreaterThan(90)
    expect(maxStep(stream.map(oldYaw))).toBeGreaterThan(90) // 증인
    const views = runHook(stream)
    expect(maxStep(views.map((v) => v.yaw))).toBeLessThanOrEqual(MAX_STEP_DEG)
    for (const v of views) expect(Math.abs(wrap180(v.yaw - 40))).toBeLessThan(1)
    // 한 틱 걸러 같은 자세를 다른 표현(α+180 · 180−β · γ+180)으로 주는 값 열 - α · γ가 틱마다 정확히 180° 뒤집힌다.
    const flipped = stream.map((s, i) => (i % 2 === 0 ? s : { alpha: wrap360(s.alpha + 180), beta: 180 - s.beta, gamma: s.gamma + 180 }))
    expect(maxStep(flipped.map(oldYaw))).toBeCloseTo(180, 0) // 증인
    const views2 = runHook(flipped)
    expect(maxStep(views2.map((v) => v.yaw))).toBeLessThanOrEqual(MAX_STEP_DEG)
    for (const v of views2) expect(Math.abs(wrap180(v.yaw - 40))).toBeLessThan(1)
  })

  it('(c) 방위 355° ↔ 5°를 오가기: 반대로 한 바퀴 0 · 북쪽 ±12° 밖으로 나가지 않음 · 틱마다 ≤ 15°', () => {
    const stream: Angles[] = []
    for (let i = 0; i < 150; i += 1) stream.push(poseAngles({ yaw: wrap360(5 * Math.sin(i * 0.15) * 2), pitch: 20 }))
    const yaws = runHook(stream).map((v) => v.yaw)
    expect(maxStep(yaws)).toBeLessThanOrEqual(MAX_STEP_DEG)
    for (const y of yaws) expect(Math.abs(wrap180(y))).toBeLessThan(12)
    // 평활 한 걸음도 짧은 쪽: 355 -> 5는 +2(357), 5 -> 355는 −2(3)
    expect(smoothView({ yaw: 355, pitch: 0 }, { yaw: 5, pitch: 0 }).yaw).toBeCloseTo(357, 6)
    expect(smoothView({ yaw: 5, pitch: 0 }, { yaw: 355, pitch: 0 }).yaw).toBeCloseTo(3, 6)
  })

  it('(d) 방위는 그대로 · 위아래로만 기울이기(−10° -> 85° -> −10°): 방위 변화 ≈ 0 · 높이는 따라 움직임', () => {
    const stream: Angles[] = []
    for (let i = 0; i <= 190; i += 1) stream.push(poseAngles({ yaw: 120, pitch: i <= 95 ? -10 + i : 85 - (i - 95) }))
    const views = runHook(stream)
    for (const v of views) expect(Math.abs(wrap180(v.yaw - 120))).toBeLessThan(0.5)
    expect(Math.max(...views.map((v) => v.pitch))).toBeGreaterThan(75)
    expect(Math.min(...views.map((v) => v.pitch))).toBeLessThan(0)
  })

  it('(d′) 같은 위아래 기울임에 손이 2° 비틀려 있어도: 방위 변화 ≤ 3° · 85-는 180° 뒤집힘(폰A · 폰B의 상하 튐)', () => {
    const stream: Angles[] = []
    for (let i = 0; i <= 190; i += 1) stream.push(poseAngles({ yaw: 120, pitch: i <= 95 ? -10 + i : 85 - (i - 95), roll: 2 }))
    expect(maxStep(stream.map(oldYaw))).toBeGreaterThan(150) // 증인 - 지평선을 지날 때
    const views = runHook(stream)
    expect(maxStep(views.map((v) => v.yaw))).toBeLessThanOrEqual(MAX_STEP_DEG)
    for (const v of views) expect(Math.abs(wrap180(v.yaw - 120))).toBeLessThan(3)
  })

  it('가로 화면(90°)에서 위아래로 기울여도 방위 그대로', () => {
    const stream: Angles[] = []
    for (let i = 0; i <= 80; i += 1) stream.push(poseAngles({ yaw: 250, pitch: i, screenTurn: 90 }))
    const views = runHook(stream, 90)
    for (const v of views) expect(Math.abs(wrap180(v.yaw - 250))).toBeLessThan(0.5)
  })
})

describe('85-b iOS 나침반(webkitCompassHeading) - 차이만 천천히', () => {
  const look: View = { yaw: 100, pitch: 0 }

  it('첫 값으로 차이를 잡고 · 가까운 값은 천천히 따라감', () => {
    let c: CompassState = nextCompass(COMPASS_NONE, 160, look)
    expect(c.offset).toBe(60)
    expect(withCompass(look, c).yaw).toBe(160)
    c = nextCompass(c, 170, look)
    expect(c.offset).toBeCloseTo(61, 6)
  })

  it(`튄 값(±${COMPASS_OUTLIER_DEG}° 밖)은 버리고 · ${COMPASS_RESET_COUNT}번 이어지면 받아들임 · 눕힌 자세 값은 받지 않음`, () => {
    let c: CompassState = nextCompass(COMPASS_NONE, 160, look)
    for (let i = 1; i < COMPASS_RESET_COUNT; i += 1) {
      c = nextCompass(c, 340, look)
      expect(c.offset).toBe(60)
    }
    c = nextCompass(c, 340, look)
    expect(c.offset).toBe(240)
    const flat = nextCompass({ offset: 60, misses: 0 }, 165, { yaw: 100, pitch: 80 })
    expect(flat.offset).toBe(60)
    expect(nextCompass({ offset: 60, misses: 0 }, null, look)).toEqual({ offset: 60, misses: 0 })
  })

  it('iOS 값 열(alpha 기준 임의 · 세운 채 한 바퀴 · 나침반이 가끔 180° 튐): 화면 방위는 나침반 기준으로 차례로 · 틱마다 ≤ 15°', () => {
    const stream: (Angles & { webkitCompassHeading: number })[] = []
    for (let i = 0; i <= 180; i += 1) {
      const yaw = i * 2
      const a = poseAngles({ yaw, pitch: 10 + 3 * Math.sin(i * 0.3), roll: 2 * Math.sin(i * 0.7), alphaOrigin: 137 })
      const glitch = i % 40 >= 20 && i % 40 < 24 // 4틱 동안 반대로
      stream.push({ ...a, webkitCompassHeading: wrap360(yaw + (glitch ? 180 : 0)) })
    }
    const yaws = runHook(stream).map((v) => v.yaw)
    expect(maxStep(yaws)).toBeLessThanOrEqual(MAX_STEP_DEG)
    expect(Math.abs(wrap180(yaws[yaws.length - 1] - 0))).toBeLessThan(10) // 한 바퀴 뒤 다시 북
    expect(totalTurn(yaws)).toBeGreaterThan(345)
  })
})
