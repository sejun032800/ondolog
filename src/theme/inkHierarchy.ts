/**
 * 잉크 위계 API — docs/ONDOLOG_DESIGN.md §0, §9-2.
 *
 * 컴포넌트가 색을 직접 고르지 않고 "내용의 성격"만 선언한다.
 *
 *   metric     세이지(다크: 샴페인) — 온도록이 "계산한" 값(온도·일치율·스탯)
 *   narrative  먹 — 온도록이 "쓴" 문장(AI 서사, 기사, 제목)
 *   verbatim   담묵 — 두 사람의 말 "그대로"(채팅 인용, 유저 메모)
 *
 * 색이 옅어질수록 개입도가 낮다는 것이 시그니처다(§0) — 어겨서는 안 된다.
 */
import type { TextStyle } from 'react-native'
import type { BroadsheetPalette } from './palette'

export type InkLevel = 'metric' | 'narrative' | 'verbatim'

/**
 * 현재 팔레트를 받아 `ink(level)` 함수를 만든다. `useTheme()`이 현재
 * resolvedMode의 팔레트로 이미 바인딩해 반환하므로, 화면 코드는 보통
 * `const { ink } = useTheme()` 형태로만 쓰면 된다.
 */
export function createInk(colors: BroadsheetPalette) {
  return function ink(level: InkLevel): TextStyle {
    switch (level) {
      case 'metric':
        return { color: colors.accent }
      case 'narrative':
        return { color: colors.inkFull }
      case 'verbatim':
        return { color: colors.inkWash }
      default: {
        const _exhaustive: never = level
        return _exhaustive
      }
    }
  }
}

export type InkFn = ReturnType<typeof createInk>
