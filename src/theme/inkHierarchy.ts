/**
 * 잉크 위계 — 인쇄의 '먹 농도'를 화면의 '광도'로 번역한 것.
 * 원본: docs/ONDOLOG_APP_UI_PLAN_v3.md §2-3
 *
 * 컴포넌트는 색을 고르지 않는다. 내용의 성격만 선언한다.
 * 함수 시그니처는 기존과 동일하므로 화면 코드는 수정이 없다.
 *
 *   인쇄            →  앱
 *   세이지 액센트    →  코랄 + 글로우   (가장 빛남)
 *   먹              →  크림, 산세리프
 *   담묵(가장 옅음)  →  회보라 + 세리프
 *
 * 은유가 뒤집힌 게 아니다. 둘 다 "온도록이 손댄 것일수록 눈에 띈다"이다.
 */
import { TextStyle } from 'react-native'
import { palette, glow } from './palette'
import { typography } from './typography'

export type InkRole =
  | 'metric'     // 온도록이 계산한 값 (온도, 일치율, 재료 수치)
  | 'narrative'  // 온도록이 쓴 문장 (코너 리드, AI 캡션, 설명)
  | 'verbatim'   // 두 사람의 말 그대로 (메모, 채팅 인용)

export function ink(role: InkRole): TextStyle {
  switch (role) {
    case 'metric':
      return { color: palette.coral, ...glow.soft }
    case 'narrative':
      return { color: palette.text, fontFamily: typography.body.fontFamily }
    case 'verbatim':
      return { color: palette.textSub, fontFamily: typography.quote.fontFamily }
  }
}
