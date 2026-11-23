/**
 * ONDOLOG 앱 팔레트 v2 — 심야 보라 다크 단일
 * 원본: docs/ONDOLOG_APP_UI_PLAN_v3.md §2-1
 *
 * 대비는 --night(#14102E) 기준 실측값이다.
 * textFaint(2.7)는 선·비활성 전용이며 텍스트에 쓰지 않는다.
 */
export const palette = {
  night: '#14102E',
  nightDeep: '#0C0920',
  nightLift: '#1F1A3D',
  nightLift2: '#2A2350',

  text: '#F3EFFA',      // 16.2
  textSub: '#B9B2D8',   //  9.1
  textMute: '#8A83AE',  //  5.2
  textFaint: '#5C5680', //  2.7 — 선 전용

  coral: '#FF8E7F',     //  8.3 — 수치
  pink: '#F7A8C8',      // 10.0 — 관계
  peri: '#9AA2F7',      //  7.8 — 정보

  rule: '#2C2650',
  lockBadgeText: '#FFD6C8',
  lockBadgeLine: 'rgba(255,142,127,0.55)',
} as const

/** 네 개만 정의한다. 그 밖의 그라디언트는 만들지 않는다. */
export const gradient = {
  sky:  { angle: 180, colors: ['#1B1440', '#14102E', '#0C0920'], locations: [0, 0.46, 1] },
  warm: { angle: 135, colors: ['#FF8E7F', '#F7A8C8'] },
  dawn: { angle: 135, colors: ['#F7A8C8', '#9AA2F7'] },
  veil: { angle: 180, colors: ['rgba(31,26,61,0)', '#1F1A3D'] },
} as const

/** 그림자가 아니라 발광. */
export const glow = {
  soft: { shadowColor: '#FF8E7F', shadowOpacity: 0.18, shadowRadius: 32, shadowOffset: { width: 0, height: 0 } },
  card: { shadowColor: '#080514', shadowOpacity: 0.45, shadowRadius: 32, shadowOffset: { width: 0, height: 8 } },
} as const

export const radius = { card: 20, button: 16, photo: 16, chip: 999, bubble: 20, bubbleTail: 6, input: 999 } as const
export const space  = { screenX: 20, cardPad: 20, section: 32, rowY: 15, minTouch: 48 } as const
