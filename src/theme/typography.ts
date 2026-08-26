/**
 * 서체·스케일 — docs/ONDOLOG_DESIGN.md §11-4 표 그대로.
 *
 * - 굵기 지정용 스타일 속성(RN `TextStyle`의 weight 필드)을 쓰지 않는다.
 *   웨이트는 `fontFamily`로만 구분한다(§11-3).
 * - `letterSpacing`은 §11-4에 이미 pt로 환산된 값이다. em 재환산 금지(§11-5).
 * - 폰트 파일(MaruBuri/Pretendard 5종)은 아직 `assets/fonts/`에 없다
 *   (§11-6). `app/_layout.tsx`가 로드를 시도하되 실패해도 앱이 뜨도록
 *   처리하고, 이 파일의 fontFamily 값은 파일 유무와 무관하게 문서 그대로
 *   유지한다 — 파일이 없으면 RN이 시스템 폰트로 폴백한다.
 */
import type { TextStyle } from 'react-native'

export interface TypeToken {
  fontFamily: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
}

export const FONT_FAMILY = {
  maruBuriLight: 'MaruBuri-Light',
  maruBuriRegular: 'MaruBuri-Regular',
  maruBuriSemiBold: 'MaruBuri-SemiBold',
  pretendardRegular: 'Pretendard-Regular',
  pretendardSemiBold: 'Pretendard-SemiBold',
} as const

export const typography = {
  numeralXl: {
    fontFamily: FONT_FAMILY.maruBuriLight,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -1,
  },
  numeral: {
    fontFamily: FONT_FAMILY.maruBuriLight,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  display: {
    fontFamily: FONT_FAMILY.maruBuriRegular,
    fontSize: 30,
    lineHeight: 42,
    letterSpacing: -0.3,
  },
  headline: {
    fontFamily: FONT_FAMILY.maruBuriRegular,
    fontSize: 21,
    lineHeight: 32,
    letterSpacing: 0,
  },
  bodySerif: {
    fontFamily: FONT_FAMILY.maruBuriRegular,
    fontSize: 16,
    lineHeight: 29,
    letterSpacing: 0,
  },
  quote: {
    fontFamily: FONT_FAMILY.maruBuriRegular,
    fontSize: 16,
    lineHeight: 29,
    letterSpacing: 0,
  },
  title: {
    fontFamily: FONT_FAMILY.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  body: {
    fontFamily: FONT_FAMILY.pretendardRegular,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: FONT_FAMILY.pretendardRegular,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0,
  },
  kickerEn: {
    fontFamily: FONT_FAMILY.maruBuriRegular,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 3.0,
  },
  kickerKo: {
    fontFamily: FONT_FAMILY.maruBuriRegular,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 2.0,
  },
  labelEn: {
    fontFamily: FONT_FAMILY.maruBuriRegular,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 3.5,
  },
} satisfies Record<string, TypeToken>

export type TypographyToken = keyof typeof typography

/** RN `TextStyle`로 바로 쓸 수 있는 형태. 색은 포함하지 않는다(잉크 위계가 담당). */
export function textStyle(token: TypographyToken): TextStyle {
  return typography[token]
}
