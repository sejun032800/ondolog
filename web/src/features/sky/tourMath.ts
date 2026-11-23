/**
 * 85- 하늘 둘러보기(C08 · C08-alt) 순수 계산 - MASTER 9-8-4 · 보드 `N-R17-Our-Sky-2`(patch9b) 17-a · 17-d 모션표.
 * 시계 · 랜덤 · 저장 · 전송 없음(같은 입력 -> 같은 출력). 센서 값은 여기서 숫자로만 지나간다.
 *
 * 좌표: 하늘 층의 별 자리는 1단계와 같은 `starPosition`(%)이다. 둘러보기 정면(방위 0 = 북 · 높이 0)에서 C01과 같은 배치로 보이도록
 * 가로 % -> 방위각, 화면은 가로 `FOV_H_DEG`도를 덮는다(보드 C08: 북서 · 북 · 북동이 한 화면 - 45°가 화면 폭의 약 35%).
 * 사진 층(`sky_world.jpg`)은 이 계산을 쓰지 않는다(고정 · 시차 0).
 */

/** 화면 가로가 덮는 방위(도). 보드 C08 방위 글자 간격(45° ≈ 135pt / 390pt)에서. */
export const FOV_H_DEG = 130
/** 위아래 볼 수 있는 범위(도) - 보드 "위아래 −10°~90°에서 멈춤". */
export const PITCH_MIN_DEG = -10
export const PITCH_MAX_DEG = 90
/** 지수 평활 계수(모션표 "α = 0.2"). */
export const SMOOTHING_ALPHA = 0.2
/** 센서 솎음 - 30Hz(모션표). 이보다 촘촘한 이벤트는 버린다. */
export const SENSOR_MIN_INTERVAL_MS = 1000 / 30
/** C10이 닫히는 움직임(보드 "폰이 20° 넘게 움직이면 닫힘"). */
export const GUIDE_CLOSE_MOVE_DEG = 20
/** 센서가 이 시간 안에 값을 한 번도 주지 않으면 센서 없음으로 보고 끌기 모드로(데스크톱 · 센서 없는 기기). */
export const SENSOR_WAIT_MS = 1200
/** 방위 눈금 간격(pt, 보드 "20pt 간격"). */
export const COMPASS_TICK_PT = 20
/** 기준 화면 폭(pt) - 눈금 간격을 도로 바꿀 때. */
export const DESIGN_WIDTH_PT = 390

/** 모션표 숫자(ms). */
export const MOTION_MS = {
  enterFadeOut: 180,
  enterRise: 240,
  enterReduced: 150,
  exit: 180,
  exitReduced: 120,
  guideClose: 240,
  dragHintClose: 300,
  reducedFade: 150,
  chipFade: 200,
  chipTurn: 600,
  inertia: 600,
} as const

export interface View {
  /** 바라보는 방위(도, 0 = 북, 시계 방향). */
  yaw: number
  /** 올려다본 높이(도). */
  pitch: number
}

export const FRONT: View = { yaw: 0, pitch: 0 }

/** 각도를 (-180, 180]로. */
export function wrap180(deg: number): number {
  const r = ((((deg + 180) % 360) + 360) % 360) - 180
  return r === -180 ? 180 : r
}
/** 각도를 [0, 360)으로. */
export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_MAX_DEG, Math.max(PITCH_MIN_DEG, pitch))
}

/** 하늘 층 자리(% 0~100) -> 하늘의 방위 · 높이(정면에서 C01 배치 그대로). */
export function skyPointOf(pos: { x: number; y: number }, heightPerWidth: number): { az: number; alt: number } {
  const degPerPct = FOV_H_DEG / 100
  return { az: wrap360((pos.x - 50) * degPerPct), alt: (50 - pos.y) * degPerPct * heightPerWidth }
}

/**
 * 하늘 점 -> 화면 자리(% 0~100). 화면 밖이면 `visible: false`(그리지 않는다 - V40).
 * `heightPerWidth` = 화면 높이 / 폭(세로 %를 도와 같은 비율로 맞춘다).
 */
export function project(point: { az: number; alt: number }, view: View, heightPerWidth: number, marginPct = 6): { x: number; y: number; visible: boolean } {
  const degPerPct = FOV_H_DEG / 100
  const x = 50 + wrap180(point.az - view.yaw) / degPerPct
  const y = 50 - (point.alt - view.pitch) / (degPerPct * heightPerWidth)
  const visible = x >= -marginPct && x <= 100 + marginPct && y >= -marginPct && y <= 100 + marginPct
  return { x, y, visible }
}

// ---------------------------------------------------------------------------
// 85-b 기기 방향 -> 시선 방향(회전 행렬) - R147-3
// ---------------------------------------------------------------------------
// 85-는 alpha · beta를 그대로 방위 · 높이로 썼다(gamma 무시). 폰을 세운 자세(beta ≈ 90)에서는 alpha와 gamma가 같은 축을 돌려
// (짐벌 잠김) alpha 혼자 크게 흔들리거나 180° 뒤집힌다 -> 방위 띠가 튀고, 위아래 기울임이 방위에 섞였다.
// 이제 세 각도로 W3C 회전 행렬 R = Rz(alpha) · Rx(beta) · Ry(gamma)(기기 -> 땅: 동 · 북 · 위)를 만들고
// 카메라 시선(기기 -Z)과 화면 위쪽(화면 방향 보정)에서 방위 · 높이를 읽는다. 같은 자세의 다른 각도 표현은 같은 결과다.

const D2R = Math.PI / 180

/** `deviceorientation`의 세 각도(도). */
export interface DeviceAngles {
  alpha: number | null
  beta: number | null
  gamma?: number | null
}

function finite(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * 기기 방향 -> 시선(높이는 자르지 않음). 방위 = 시선의 수평 성분 + 올려다본 만큼 "화면 위쪽의 반대" 수평 성분.
 *  - 지평선 쪽을 볼 때는 시선만(화면 위쪽 가중 0 - 폰을 조금 비틀어도 방위가 움직이지 않음).
 *  - 하늘 꼭대기 쪽으로 갈수록 화면 위쪽이 방위를 정한다(시선의 수평 성분이 0으로 가도 끊기지 않음).
 *  - 순수한 위아래 기울임(시선 · 화면 위쪽이 같은 수직면)에서는 두 성분이 같은 방위라 방위가 그대로다.
 * `screenAngleDeg` = 화면 방향(세로 0 · 가로 90/270) - 화면 위쪽 축을 고른다. gamma가 없으면 0. 값이 없거나 방위를 못 정하면 null.
 * alpha는 기기가 주는 기준(Android 대개 북 · iOS 임의) - 나침반 보정은 `nextCompass`.
 */
export function lookFromOrientation(o: DeviceAngles, screenAngleDeg = 0): View | null {
  if (!finite(o.alpha) || !finite(o.beta)) return null
  const g = finite(o.gamma) ? o.gamma : 0
  const cA = Math.cos(o.alpha * D2R), sA = Math.sin(o.alpha * D2R)
  const cB = Math.cos(o.beta * D2R), sB = Math.sin(o.beta * D2R)
  const cG = Math.cos(g * D2R), sG = Math.sin(g * D2R)
  // R의 세 열 = 기기 X · Y · Z 축을 땅(동 E · 북 N · 위 U)에서 본 것.
  const xE = cA * cG - sA * sB * sG, xN = sA * cG + cA * sB * sG
  const yE = -sA * cB, yN = cA * cB
  const zE = cA * sG + sA * sB * cG, zN = sA * sG - cA * sB * cG, zU = cB * cG
  // 시선 = 기기 -Z(뒷면 카메라 쪽). 화면 위쪽 = 기기 축을 화면 방향만큼 돌린 것.
  const fE = -zE, fN = -zN, fU = -zU
  const s = finite(screenAngleDeg) ? screenAngleDeg * D2R : 0
  const uE = Math.sin(s) * xE + Math.cos(s) * yE
  const uN = Math.sin(s) * xN + Math.cos(s) * yN
  const w = Math.max(0, fU)
  const hE = fE - w * uE, hN = fN - w * uN
  if (Math.hypot(hE, hN) < 1e-9) return null
  return {
    yaw: wrap360(tidy(Math.atan2(hE, hN) / D2R)),
    pitch: tidy(Math.asin(Math.min(1, Math.max(-1, fU))) / D2R),
  }
}

/** 부동소수 찌꺼기(1e-15 꼴)를 0으로 - 같은 자세는 같은 숫자로 보이게(−0도 0). */
function tidy(deg: number): number {
  return Math.round(deg * 1e9) / 1e9 + 0
}

/** 기기 방향 -> 바라보는 방향(높이는 −10°~90°). 세로로 든 폰이 지평선을 보면 높이 0, 젖힐수록 오른다. */
export function viewFromOrientation(o: DeviceAngles, screenAngleDeg = 0): View | null {
  const v = lookFromOrientation(o, screenAngleDeg)
  return v ? { yaw: v.yaw, pitch: clampPitch(v.pitch) } : null
}

// iOS `webkitCompassHeading`(북 = 0, 시계 방향): iOS의 alpha는 시작 자세 기준이라 북과의 차이(offset)를 따로 잡는다.
// 85-는 나침반 값을 방위로 그대로 썼다 - 나침반 값 자체도 폰을 세울 때 튈 수 있어 차이만 천천히 따라간다.
/** 나침반 차이를 받는 높이 범위(도) - 폰을 대략 세워 든 자세에서만(눕히면 나침반 값이 윗변 기준으로 바뀐다). */
export const COMPASS_GATE_PITCH = { min: -30, max: 75 } as const
/** 지금 차이와 이보다 멀면 튄 값으로 보고 버린다(도). */
export const COMPASS_OUTLIER_DEG = 30
/** 튄 값이 이만큼 이어지면(30Hz 0.5초) 진짜로 바뀐 것으로 보고 새 값을 받는다. */
export const COMPASS_RESET_COUNT = 15
/** 차이를 따라가는 평활 계수. */
export const COMPASS_ALPHA = 0.1

export interface CompassState {
  offset: number | null
  misses: number
}
export const COMPASS_NONE: CompassState = { offset: null, misses: 0 }

/** 나침반 값 한 개 -> 다음 차이 상태(순수). 나침반 값이 없으면(Android) 그대로. */
export function nextCompass(prev: CompassState, heading: number | null | undefined, look: View): CompassState {
  if (!finite(heading)) return prev
  const sample = wrap360(heading - look.yaw)
  if (prev.offset === null) return { offset: sample, misses: 0 }
  if (look.pitch < COMPASS_GATE_PITCH.min || look.pitch > COMPASS_GATE_PITCH.max) return prev
  const d = wrap180(sample - prev.offset)
  if (Math.abs(d) > COMPASS_OUTLIER_DEG) {
    const misses = prev.misses + 1
    return misses >= COMPASS_RESET_COUNT ? { offset: sample, misses: 0 } : { offset: prev.offset, misses }
  }
  return { offset: wrap360(prev.offset + d * COMPASS_ALPHA), misses: 0 }
}

/** 시선 + 나침반 차이 -> 화면 방향. */
export function withCompass(look: View, c: CompassState): View {
  return { yaw: c.offset === null ? look.yaw : wrap360(look.yaw + c.offset), pitch: clampPitch(look.pitch) }
}

/**
 * 지수 평활 한 걸음(방위는 짧은 쪽으로 돈다 - 355° -> 5°는 +10°). 85-b: 각도별 최단 경로를 고른다(slerp 아님) -
 * 입력이 이제 회전 행렬에서 나온 연속 값이라 방위 · 높이 두 숫자만 평활하면 되고, 화면이 쓰는 것도 이 두 숫자뿐이다.
 */
export function smoothView(prev: View, target: View, alpha = SMOOTHING_ALPHA): View {
  return {
    yaw: wrap360(prev.yaw + wrap180(target.yaw - prev.yaw) * alpha),
    pitch: clampPitch(prev.pitch + (target.pitch - prev.pitch) * alpha),
  }
}

/** 두 방향 사이의 움직임(도) - C10 "20° 넘게". */
export function moveDeg(a: View, b: View): number {
  return Math.max(Math.abs(wrap180(a.yaw - b.yaw)), Math.abs(a.pitch - b.pitch))
}

/** 끌기(손가락 이동 px) -> 새 방향. 손가락을 오른쪽으로 끌면 하늘도 오른쪽으로(= 왼쪽을 본다). */
export function dragView(start: View, dxPx: number, dyPx: number, widthPx: number): View {
  const degPerPx = FOV_H_DEG / Math.max(1, widthPx)
  return { yaw: wrap360(start.yaw - dxPx * degPerPx), pitch: clampPitch(start.pitch + dyPx * degPerPx) }
}

// ---------------------------------------------------------------------------
// 방위 층(가로만) - 지평선 위 눈금 · 방위 글자
// ---------------------------------------------------------------------------

export const COMPASS_NAMES = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'] as const

/** 지금 정면 방위 이름(가장 가까운 45°). */
export function facingName(yaw: number): (typeof COMPASS_NAMES)[number] {
  return COMPASS_NAMES[Math.round(wrap360(yaw) / 45) % 8]
}

/**
 * 화면 안의 눈금(%) · 방위 글자. 짧은 눈금은 20pt 간격, 방위 자리(45°마다)는 긴 눈금 + 글자. 정면 글자만 강조.
 */
export function compassMarks(yaw: number): { ticks: { x: number; long: boolean }[]; labels: { x: number; name: string; front: boolean }[] } {
  const degPerPct = FOV_H_DEG / 100
  const tickDeg = (COMPASS_TICK_PT / DESIGN_WIDTH_PT) * FOV_H_DEG
  const ticks: { x: number; long: boolean }[] = []
  const first = Math.ceil((yaw - FOV_H_DEG / 2) / tickDeg)
  for (let k = first; k * tickDeg <= yaw + FOV_H_DEG / 2; k += 1) ticks.push({ x: 50 + (k * tickDeg - yaw) / degPerPct, long: false })
  const labels: { x: number; name: string; front: boolean }[] = []
  const front = facingName(yaw)
  for (let i = 0; i < 8; i += 1) {
    const d = wrap180(i * 45 - yaw)
    if (Math.abs(d) > FOV_H_DEG / 2) continue
    const x = 50 + d / degPerPct
    ticks.push({ x, long: true })
    labels.push({ x, name: COMPASS_NAMES[i], front: COMPASS_NAMES[i] === front })
  }
  return { ticks: ticks.sort((a, b) => a.x - b.x), labels: labels.sort((a, b) => a.x - b.x) }
}

// ---------------------------------------------------------------------------
// "이번 달 별 ›" - 이번 달 별이 하나도 안 보일 때 가까운 가장자리
// ---------------------------------------------------------------------------

export type ChipSide = 'left' | 'right' | 'bottom' | 'top'

/**
 * 이번 달 별(없으면 달) 중 하나라도 보이면 null. 아니면 가장 가까운 점과 그쪽 가장자리 · 그 점을 정면에 두는 방향.
 * 가로로 벗어났으면 좌우, 가로는 안인데 위아래로 벗어났으면 위 · 아래.
 */
export function offscreenChip(
  targets: readonly { az: number; alt: number }[],
  view: View,
  heightPerWidth: number,
): { side: ChipSide; to: View } | null {
  if (targets.length === 0) return null
  if (targets.some((t) => project(t, view, heightPerWidth, 0).visible)) return null
  let best = targets[0]
  let bestDist = Infinity
  for (const t of targets) {
    const d = Math.abs(wrap180(t.az - view.yaw)) + Math.abs(t.alt - view.pitch)
    if (d < bestDist) { best = t; bestDist = d }
  }
  const dx = wrap180(best.az - view.yaw)
  const p = project(best, view, heightPerWidth, 0)
  const side: ChipSide = p.x < 0 || p.x > 100 ? (dx > 0 ? 'right' : 'left') : p.y > 100 ? 'bottom' : 'top'
  return { side, to: { yaw: wrap360(best.az), pitch: clampPitch(best.alt) } }
}

// ---------------------------------------------------------------------------
// 들어가는 길 - C01 [둘러보기] -> (iOS만 C09) -> C08 / C08-alt
// ---------------------------------------------------------------------------

/**
 * 줄인 모션 · 방향 API 없음 · iOS에서 한 번 거부함 -> 끌기(C08-alt). iOS(권한 필요)는 C09로 묻고, 그 밖은 센서(C08).
 * Android는 C09가 없다(MASTER 9-8-4).
 */
export function decideTourStart(i: { reduced: boolean; hasApi: boolean; needsPermission: boolean; denied: boolean }): 'drag' | 'ask' | 'sensor' {
  if (i.reduced || !i.hasApi) return 'drag'
  if (i.needsPermission) return i.denied ? 'drag' : 'ask'
  return 'sensor'
}

// ---------------------------------------------------------------------------
// 곡선 - cubic-bezier(.2,.8,.2,1)(칩 회전 · 관성)
// ---------------------------------------------------------------------------

/** CSS cubic-bezier(x1,y1,x2,y2)의 t(0~1) -> 진행(0~1). 뉴턴법. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s ** 2 * (1 - s) + s ** 3
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s ** 2 * (1 - s) + s ** 3
  const dbx = (s: number) => 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s ** 2
  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let s = t
    for (let i = 0; i < 8; i += 1) {
      const d = dbx(s)
      if (Math.abs(d) < 1e-6) break
      s = Math.min(1, Math.max(0, s - (bx(s) - t) / d))
    }
    return by(s)
  }
}

export const EASE_TURN = cubicBezier(0.2, 0.8, 0.2, 1)

/** 두 방향 사이(짧은 쪽) 진행 k(0~1). */
export function lerpView(a: View, b: View, k: number): View {
  return { yaw: wrap360(a.yaw + wrap180(b.yaw - a.yaw) * k), pitch: clampPitch(a.pitch + (b.pitch - a.pitch) * k) }
}
