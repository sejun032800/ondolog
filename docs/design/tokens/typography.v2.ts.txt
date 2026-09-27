/**
 * ONDOLOG 앱 타이포 v2
 * 원본: docs/ONDOLOG_APP_UI_PLAN_v3.md §2-2
 *
 * 세리프(MaruBuri)는 quote 하나뿐이다 — 두 사람의 말 인용 전용.
 * 앱 전체가 산세리프인데 원문만 세리프면 그 문장이 다른 재질로 보인다.
 * fontWeight 를 쓰지 않는다. fontFamily 로 웨이트를 구분한다.
 */
import { TextStyle } from 'react-native'

const S = {
  black: 'Pretendard-Black',
  bold: 'Pretendard-Bold',
  medium: 'Pretendard-Medium',
  regular: 'Pretendard-Regular',
  serif: 'MaruBuri-Regular',
} as const

export const typography = {
  hero:     { fontFamily: S.black,   fontSize: 72, lineHeight: 76, letterSpacing: -3.2 },
  heroUnit: { fontFamily: S.bold,    fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  display:  { fontFamily: S.bold,    fontSize: 28, lineHeight: 38, letterSpacing: -0.56 },
  title:    { fontFamily: S.bold,    fontSize: 19, lineHeight: 28, letterSpacing: -0.38 },
  body:     { fontFamily: S.regular, fontSize: 16, lineHeight: 26, letterSpacing: -0.16 },
  sub:      { fontFamily: S.regular, fontSize: 14, lineHeight: 22, letterSpacing: -0.14 },
  caption:  { fontFamily: S.medium,  fontSize: 12, lineHeight: 18 },
  kicker:   { fontFamily: S.bold,    fontSize: 11, lineHeight: 14, letterSpacing: 1.98 },
  quote:    { fontFamily: S.serif,   fontSize: 17, lineHeight: 30 },
} satisfies Record<string, TextStyle>
