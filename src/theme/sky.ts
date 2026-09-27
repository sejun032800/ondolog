/**
 * 우리의 하늘 — 하나의 연속된 세계
 * 원본: docs/ONDOLOG_APP_UI_PLAN_v3.md §5-8
 *
 * 메인 탭에서 끌어내리는 동작 = 고개를 들어 밤하늘을 올려다보는 동작.
 * 모든 화면은 같은 이미지(sky_world.jpg)의 다른 높이를 비춘다.
 *
 * ⚠ transform 은 쌓임 맥락을 만든다.
 *   메인 시트에 translateY 를 걸면 내부 zIndex 가 바깥 veil 을 넘지 못한다.
 *   시트 자체에 zIndex 를 명시할 것.
 */
export const WORLD_HEIGHT_RATIO = 2.37 // 세계 높이 = 화면 높이 × 2.37

export const viewOffsetPt = {
  main: 1156,        // 지평선·산 — 메인 탭
  pullStart: 1040,   // 끌어내리는 중
  pullRelease: 900,  // 놓기 직전
  sky: 620,          // 우리의 하늘
  past: 60,          // 지난 하늘
} as const

export const veilOpacity = { main: 0.72, pullStart: 0.5, pullRelease: 0.2, sky: 0 } as const

export const pullGesture = {
  idleMax: 60,        // 여기까지는 일반 오버스크롤
  threshold: 140,     // 넘으면 햅틱 1회 + 문구 변경
  hapticOnce: true,   // 오가며 여러 번 울리지 않는다
  onlyAtScrollTop: true,
} as const

export const dateStar = {
  coreMin: 2.2,
  coreMax: 4.2,
  haloScale: 10,      // 후광 지름 = core × 10
  spikeScale: 8.4,    // 십자광 폭 = core × 8.4 — 배경 별과 구분되는 신호
  memoRingScale: 6.4,
  annivRingScale: 10,
  touchTarget: 44,    // 점은 작아도 누르기는 쉽게
} as const

export const meteor = {
  head: 4,
  tail: 236,
  thickness: 1.4,
  angleDeg: -31,
  flightMs: 2400,
  intervalMs: [12000, 25000] as const,
  maxOnScreen: 1,
  delayDays: 7,       // 보낸 지 7일 지난 말만. 원문이 연출되는 것을 막는다
} as const

/** 그날 대표 사진의 평균색 → 별빛. 기기에서 계산하고 서버로 보내지 않는다. */
export function photoToStarColor(avg: { r: number; g: number; b: number }): string {
  const [h, , s] = rgbToHsl(avg.r / 255, avg.g / 255, avg.b / 255)
  return hslToHex(h, Math.max(s, 0.62), 0.8)
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
          : max === g ? ((b - r) / d + 2) / 6
          : ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase()
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
