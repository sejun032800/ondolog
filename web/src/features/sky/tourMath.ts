/**
 * 85- · 89- 하늘 둘러보기(C08 · C08-alt) 순수 계산 - MASTER 9-8-4 · 보드 `N-R17b-Our-Sky-3`(patch10) 2-1 · 2-3 · 17-d+ 모션 허용표.
 * 시계 · 랜덤 · 저장 · 전송 없음(같은 입력 -> 같은 출력). 센서 값은 여기서 숫자로만 지나간다.
 *
 * 89-(patch10 2-1 "하늘 한 장"): 원본(`sky_pano_360.jpg`) · 별 · 달 · 라벨 · 지평선이 **한 띠**로 함께 가로 이동한다(patch9b "층 분리"를 대체).
 *  - 원통 띠: 가로 360° = 원본 폭 3896px ÷ 1.25 = **3116.8pt**(1° = 3116.8 / 360 ≈ 8.658pt - 보드 표기 8.656pt). 둘레를 원본 폭과 같게 둬야
 *    한 바퀴 돌았을 때 그림이 이음매 없이 같은 자리로 온다(보드의 `360 × 8.656 = 3116.16`을 쓰면 한 바퀴마다 0.64pt 어긋난다).
 *  - 들어갈 때 바라본 방향 = yaw 0° = 띠 이동 0 = C01 그림(0~45°, 화면 폭 390pt).
 *  - 세로는 아래로 10°(87pt)까지만(끌기 모드에서만 - 센서는 yaw 하나만, 보드 17-d+ "센서 -> 회전"). 기울기(roll)는 쓰지 않는다.
 */

/** 원본 그림(`docs/design/nocturne/sky/sky_pano_360.jpg`와 바이트까지 같은 앱 자산). */
export const PANO_SRC = './img/sky_pano_360.jpg'
export const PANO_PX = { width: 3896, height: 1136 } as const
/** 원본 배율(px / pt) - make_sky_pano.py `S`. */
export const PANO_SCALE = 1.25
/** 띠 둘레(pt) = 원본 폭 ÷ 배율. */
export const CIRC_PT = PANO_PX.width / PANO_SCALE
/** 원본 높이(pt) - 지평선 아래 −15°까지. */
export const PANO_HEIGHT_PT = PANO_PX.height / PANO_SCALE
/** 1° = 몇 pt. */
export const PT_PER_DEG = CIRC_PT / 360
/** 화면 폭(pt) - C01 그림이 들어가는 창(0~45°). */
export const WINDOW_PT = 390
/**
 * C01은 `sky_world.jpg`의 620 ~ 1464pt를 화면 아래에 붙여 보인다(`ui.tsx` `SkyLayer` · `viewOffsetPt.sky`). 원본 띠의 맨 위 줄은 sky_world 620pt라
 * 띠의 y = 844pt 줄이 화면 아래 끝에 온다 - 화면 높이가 달라도 C01과 같은 자리.
 */
export const BAND_BOTTOM_PT = 844
/** 아래로 볼 수 있는 한도(도). */
export const DOWN_MAX_DEG = 10

/** 지수 평활 계수(모션표 "α = 0.2"). */
export const SMOOTHING_ALPHA = 0.2
/** 센서 솎음 - 30Hz(모션표). 이보다 촘촘한 이벤트는 버린다. */
export const SENSOR_MIN_INTERVAL_MS = 1000 / 30
/** C10이 닫히는 움직임(보드 "폰이 20° 넘게 움직이면 닫힘"). */
export const GUIDE_CLOSE_MOVE_DEG = 20
/** 센서가 이 시간 안에 값을 한 번도 주지 않으면 센서 없음으로 보고 끌기 모드로(데스크톱 · 센서 없는 기기). */
export const SENSOR_WAIT_MS = 1200
/** 85-b 시선 계산이 쓰는 높이 범위(도) - 둘러보기 화면은 높이를 쓰지 않는다(89-). */
export const PITCH_MIN_DEG = -10
export const PITCH_MAX_DEG = 90

/** 모션표 숫자(ms) - patch10 17-d+ 모션 허용표. */
export const MOTION_MS = {
  /** C01 -> C08: 칩 · D+ · 안내 사라짐. */
  enterFadeOut: 180,
  /** C01 -> C08: 이름 · 점 나타남(아래에서 6pt). */
  enterRise: 240,
  enterReduced: 150,
  /** C08 -> C01: 처음 만난 쪽으로 짧은 쪽 회전. */
  exitTurn: 500,
  /** C08 -> C01: 회전 뒤 이름 사라짐. */
  exit: 180,
  exitReduced: 120,
  guideClose: 240,
  dragHintClose: 300,
  reducedFade: 150,
  chipFade: 200,
  /** "이번 달 별" 칩 - patch9b 600 -> patch10 800(하늘이 함께 돌아 거리가 길어짐). */
  chipTurn: 800,
  /** 이름 바뀜 - 교차 페이드 + 6pt 밀림. */
  nameFade: 240,
  inertia: 600,
} as const

export interface View {
  /** 바라보는 방위(도, 0 = 북 또는 들어갈 때의 방향, 시계 방향). */
  yaw: number
  /** 올려다본 높이(도). */
  pitch: number
}

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

// ---------------------------------------------------------------------------
// 89- 하늘 한 장 - 띠 이동 · 끌기 (patch10 2-1)
// ---------------------------------------------------------------------------

/** 띠 가로 이동(pt) - 오른쪽을 볼수록 왼쪽으로. 둘레만큼 되돌려 (−둘레/2, 둘레/2]에 둔다(x mod 3116.8 - 숫자가 커지지 않게). */
export function bandShiftPt(yaw: number): number {
  let w = ((-yaw * PT_PER_DEG) % CIRC_PT + CIRC_PT) % CIRC_PT
  if (w > CIRC_PT / 2) w -= CIRC_PT
  return Math.abs(w) < 1e-9 ? 0 : w
}

/** 아래로 본 정도(도)를 0 ~ 10°로. */
export function clampDown(down: number): number {
  return Math.min(DOWN_MAX_DEG, Math.max(0, down))
}

/** 띠 세로 이동(pt) - 아래를 볼수록 위로(87pt까지). */
export function bandLiftPt(down: number): number {
  return -clampDown(down) * PT_PER_DEG
}

export interface BandView {
  /** 들어갈 때의 방향 기준(도, [0, 360)). */
  yaw: number
  /** 아래로 본 정도(도, 0 ~ 10). */
  down: number
}
export const ENTRY: BandView = { yaw: 0, down: 0 }

/** 끌기(손가락 이동 pt) -> 새 방향. 손가락을 오른쪽으로 끌면 하늘도 오른쪽으로(= 왼쪽을 본다) · 위로 끌면 아래를 본다(10°까지). */
export function dragBand(start: BandView, dxPt: number, dyPt: number): BandView {
  return { yaw: wrap360(start.yaw - dxPt / PT_PER_DEG), down: clampDown(start.down - dyPt / PT_PER_DEG) }
}

/** 두 방향 사이(짧은 쪽) 진행 k(0~1). */
export function lerpBand(a: BandView, b: BandView, k: number): BandView {
  return { yaw: wrap360(a.yaw + wrap180(b.yaw - a.yaw) * k), down: clampDown(a.down + (b.down - a.down) * k) }
}

// ---------------------------------------------------------------------------
// 89- 네 방향 이름 (patch10 2-3) - 실제 나침반이 아니다
// ---------------------------------------------------------------------------

/** 고정 문구(데이터 · 사람 이름 · 장소 이름 0). 0° = 들어갈 때 바라본 쪽, 오른쪽으로 90°마다. */
export const DIRECTION_NAMES = ['처음 만난 쪽', '함께 웃던 쪽', '나란히 걷던 쪽', '서로 기다리던 쪽'] as const
/** 경계(±45°)에서 깜빡이지 않게 두는 여유(도). */
export const DIRECTION_HYSTERESIS_DEG = 5

/**
 * 지금 바라보는 쪽의 이름 번호(0~3). 이름마다 가운데 ±45°. 지금 이름(`prev`)의 가운데에서 45° + 5°를 넘어야 바뀐다
 * (되돌아올 때는 새 이름 가운데에서 40° - 같은 띠의 반대편). `prev`가 없으면 가장 가까운 이름.
 */
export function directionIndex(yaw: number, prev: number | null): number {
  if (prev !== null && Math.abs(wrap180(yaw - prev * 90)) <= 45 + DIRECTION_HYSTERESIS_DEG) return prev
  return Math.round(wrap360(yaw) / 90) % 4
}

// ---------------------------------------------------------------------------
// "이번 달 별" 칩 - 늘 처음 만난 쪽으로
// ---------------------------------------------------------------------------

/**
 * 이번 달 별(없으면 달)이 모두 화면 밖이면 칩. 별은 들어가는 창(0~390pt) 안에 있다 - `targetsPt` = 창 안 x(pt).
 * 화살표는 처음 만난 쪽으로 가는 짧은 쪽(오른쪽으로 돌아 있으면 ‹). 보이는 별이 하나라도 있으면 null.
 */
export function chipSide(targetsPt: readonly number[], yaw: number, marginPt = 0): 'left' | 'right' | null {
  if (targetsPt.length === 0) return null
  const shift = bandShiftPt(yaw)
  if (targetsPt.some((x) => x + shift >= -marginPt && x + shift <= WINDOW_PT + marginPt)) return null
  return wrap180(yaw) > 0 ? 'left' : 'right'
}

// ---------------------------------------------------------------------------
// 지평선 · 배경 별 - 띠 위의 모양 (보드 스크립트 그대로)
// ---------------------------------------------------------------------------

/** 둘레로 이어지는 지평선 path(보드 `groundPath()`) - 0~390pt는 C01 실루엣, 나머지는 낮은 언덕. y는 띠 좌표(pt, 844 = 화면 아래). */
export function groundPath(): string {
  let d = 'M0 779 C 60 775, 120 762, 205 761 S 330 768, 390 764'
  const hills: [number, number][] = [[700, 772], [1050, 758], [1420, 770], [1800, 756], [2200, 769], [2600, 760], [2950, 771], [CIRC_PT, 779]]
  let px = 390
  for (const [x, y] of hills) {
    const m = (px + x) / 2
    d += ` S ${m} ${y + 6}, ${x} ${y}`
    px = x
  }
  return d
}

/**
 * 숨 쉬는 배경 별 20개(patch9b 그대로 · 하늘 띠에 붙음) - 자리는 보드 스크립트 `breathStars`. 띠는 (−둘레/2, 둘레/2 + 화면] 범위를 보이므로
 * 그 범위에 들도록 별마다 한 자리(둘레/2 ~ 둘레/2 + 390 사이 별만 두 자리). `i` = 별 번호(주기 · 지연 계산용).
 */
export function backgroundStarSpots(): { i: number; x: number; y: number }[] {
  const out: { i: number; x: number; y: number }[] = []
  for (let i = 0; i < 20; i += 1) {
    const x = (i * 157.3) % CIRC_PT
    const y = 60 + ((i * 97) % 640)
    if (x <= CIRC_PT / 2 + WINDOW_PT) out.push({ i, x, y })
    if (x >= CIRC_PT / 2) out.push({ i, x: x - CIRC_PT, y })
  }
  return out
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
// 곡선 - cubic-bezier(.2,.8,.2,1)(칩 회전 · 나가기 회전 · 관성)
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
