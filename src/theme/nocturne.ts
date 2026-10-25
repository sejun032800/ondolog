/**
 * Nocturne v5 토큰 - 앱 UI의 색·빛·활자·형태·모션 원본.
 *
 * 값의 출처: docs/design/nocturne/canvas/Tokens.dc.html, Build.dc.html.
 * 색은 이 파일에서만 정의한다. 다른 파일은 값을 여기서 가져오거나
 * `withAlpha()`로 같은 색의 투명도만 바꿔 쓴다(하드코딩 색 0건).
 *
 * 규칙(README 구현 규칙):
 * - `textFaint`는 비활성 컨트롤(비활성 버튼·비활성 ListRow)의 글자에만 쓴다(R20-5).
 * - `lilac`은 12pt 이하 글자에 쓰지 않는다.
 * - `moon`은 발행된 호·Vol·종이로 넘어가는 순간에만 쓴다.
 * - 웨이트는 fontFamily로만 구분한다. 굵기 전용 스타일 속성은 쓰지 않는다.
 * - 블러 없음. 금지 모션: 카운트업 · 진행률 채움 · 스피너.
 *
 * 옛 테마(`src/theme/index.ts` 등)는 마지막 옛 화면이 사라질 때 지운다(R13-10).
 * 이 파일은 옛 테마를 import하지 않는다.
 */
import type { TextStyle } from 'react-native'

/** 바탕·면·활자·빛·종이 색. 원본 Build 보드의 `nocturne` 객체 그대로. */
export const nocturne = {
  // 바탕
  ink: '#0A0814',
  inkRaise: '#14111F',
  inkRaise2: '#1C1829',
  glass: 'rgba(20,17,31,0.62)',
  hairline: 'rgba(243,239,247,0.10)',
  veil: 'rgba(10,8,20,0.55)',

  // 활자
  text: '#F3EFF7',
  textSub: '#C9C1DA',
  textMute: '#9C93B4',
  /** 선·비활성 컨트롤 글자 전용(R20-5). 그 밖의 글자 금지. */
  textFaint: '#6E6688',

  // 빛
  rose: '#F4B9C8',
  orchid: '#E3A0C8',
  /** 12pt 이하 글자 금지. */
  lilac: '#B9A2F0',
  /** lilac 칩 위 글자 하나(참여 대기 칩). 디자인 토큰 이름 그대로(R20-6, R22-2). */
  lilacText: '#D7C9FA',
  mist: '#A9B6EC',
  /** 발행된 호·Vol 번호·종이로 넘어가는 순간만. */
  moon: '#E7D9C3',

  /** B05 연애유형 영문 라벨 전용(R36-4, 디자인 `N-B-Main` 값). 다른 글자에 쓰지 않는다. */
  ember: '#C08A64',

  // 종이(발행물 세계)
  paper: '#F1ECE4',
  paperInk: '#2A2530',
  paperMute: '#6B6370',
} as const

export type NocturneColor = keyof typeof nocturne

/**
 * 같은 색의 투명도만 바꾼다. 컴포넌트가 색 리터럴을 쓰지 않고 파생 면·선을
 * 만드는 유일한 통로다. `#RRGGBB` 입력만 받는다.
 */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)
  if (!m) throw new Error(`withAlpha: #RRGGBB 형식이 아님 (${hex})`)
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * 메인 전용 하단 장막(R22-1, 디자인 `N-B-Main`): 화면 아래 460pt, ink 0 -> .75(45%) -> .94(100%).
 * 위쪽 별이 보이고 아래 카드 글자가 읽히게 한다. 색은 ink 토큰에서 만든다.
 */
export const mainBottomVeil = {
  height: 460,
  gradient: `linear-gradient(180deg, ${withAlpha(nocturne.ink, 0)} 0%, ${withAlpha(nocturne.ink, 0.75)} 45%, ${withAlpha(
    nocturne.ink,
    0.94,
  )} 100%)`,
} as const

/** 발광 3종. numeral은 온도·수치 글자에만, star는 데이트 별 후광, lift는 시트·떠 있는 카드만. */
export const glow = {
  numeral: {
    textShadowColor: 'rgba(244,185,200,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  star: { boxShadow: '0 0 10px 3px rgba(185,162,240,0.7)' },
  lift: { boxShadow: '0 12px 40px rgba(0,0,0,0.55)' },
} as const

/** 웨이트는 fontFamily 키로 구분한다. 키는 `app/_layout.tsx`의 `useFonts`와 일치해야 한다. */
export const fontFamily = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semiBold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  serifLight: 'MaruBuri-Light',
  serif: 'MaruBuri-Regular',
} as const

export interface NocturneTypeToken {
  fontFamily: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
}

/** 활자 10단. letterSpacing은 pt로 환산한 값이다(em 재환산 금지). */
export const type = {
  /** 92/88, -4.6pt, 소수 42% */
  hero: { fontFamily: fontFamily.regular, fontSize: 92, lineHeight: 88, letterSpacing: -4.6 },
  /** 28/36, -0.6pt */
  display: { fontFamily: fontFamily.semiBold, fontSize: 28, lineHeight: 36, letterSpacing: -0.6 },
  /** 18/26 */
  title: { fontFamily: fontFamily.semiBold, fontSize: 18, lineHeight: 26, letterSpacing: 0 },
  /** 15/24 */
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 24, letterSpacing: 0 },
  /** 13.5/21 */
  sub: { fontFamily: fontFamily.regular, fontSize: 13.5, lineHeight: 21, letterSpacing: 0 },
  /** 12/17 */
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, letterSpacing: 0 },
  /** 10.5/14, +2.7pt, 영문 대문자만 */
  kicker: { fontFamily: fontFamily.semiBold, fontSize: 10.5, lineHeight: 14, letterSpacing: 2.7 },
  /** MaruBuri 17/30. 두 사람의 원문 인용에만. */
  quote: { fontFamily: fontFamily.serif, fontSize: 17, lineHeight: 30, letterSpacing: 0 },
  /** MaruBuri Light 23/36. 유성 카드 전용. */
  quoteLg: { fontFamily: fontFamily.serifLight, fontSize: 23, lineHeight: 36, letterSpacing: 0 },
  /** 11/14, +0.44pt. 텍스트 탭. */
  tab: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.44 },
} as const satisfies Record<string, NocturneTypeToken>

/** 정수/소수 크기 비율(GlowNumeral). */
export const NUMERAL_DECIMAL_RATIO = 0.42

/** 형태: 모서리·여백·터치. */
export const shape = {
  radius: {
    card: 24,
    sheet: 28,
    button: 18,
    photo: 18,
    pill: 999,
    tabBar: 22,
  },
  space: {
    screen: 24,
    section: 40,
  },
  /** 최소 터치 48 x 48 */
  touch: 48,
  buttonHeight: 54,
  tabBarHeight: 64,
  /** 탭 바와 안전영역 사이 띄움. bottom = insets.bottom + tabBarGap */
  tabBarGap: 12,
  /** 사진 위 장막 높이(DateCard) */
  photoScrimHeight: 140,
} as const

/** 모션 상수. 숨·떠오름·촉감·스켈레톤. */
export const motion = {
  /** 화면 진입: 8px 위로 + 페이드, 260ms, ease-out */
  rise: { distance: 8, durationMs: 260 },
  /** 누름: scale .98, 120ms */
  press: { scale: 0.98, durationMs: 120 },
  /** 시트 스프링 */
  sheetSpring: { damping: 18 },
  /** 배경 별 명멸: 9-12초, 투명도 .35 <-> .75 */
  starTwinkle: { minMs: 9000, maxMs: 12000, from: 0.35, to: 0.75 },
  /** 스켈레톤 펄스: .06 <-> .12, 1.6초 */
  skeletonPulse: { from: 0.06, to: 0.12, durationMs: 1600 },
} as const

/** 잉크 위계: 내용의 성격만 선언한다. 시그니처는 옛 `createInk()`가 돌려주던 `ink(level)`와 같다. */
export type InkLevel = 'metric' | 'narrative' | 'verbatim'

/**
 * metric    온도록이 계산한 값 - rose + glow.numeral
 * narrative 온도록이 쓴 문장 - text 산세리프
 * verbatim  두 사람의 말 그대로 - textSub + MaruBuri
 */
export function ink(level: InkLevel): TextStyle {
  switch (level) {
    case 'metric':
      return { color: nocturne.rose, ...glow.numeral }
    case 'narrative':
      return { color: nocturne.text, fontFamily: fontFamily.regular }
    case 'verbatim':
      return { color: nocturne.textSub, fontFamily: fontFamily.serif }
    default: {
      const _exhaustive: never = level
      return _exhaustive
    }
  }
}
