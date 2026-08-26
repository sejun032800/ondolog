/**
 * 간격·선·모서리 — docs/ONDOLOG_DESIGN.md §3.
 */
import { StyleSheet } from 'react-native'

/** §3-1 4pt 그리드 */
export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
} as const

/** §3-2 판면 */
export const layout = {
  pageMarginX: 24,
  sectionGap: spacing.s7,
  pageTopMargin: spacing.s6,
  /** §13-1 스크롤 하단 여백 — 탭바에 가리지 않도록. */
  scrollBottomPadding: spacing.s8,
} as const

/** §3-3 선 */
export const lines = {
  hairline: StyleSheet.hairlineWidth,
  section: 1,
  masthead: 1.5,
} as const

/** §3-4 모서리·그림자 — 그림자는 전면 금지, 지면에는 둥근 모서리가 없다. */
export const radius = {
  /** 지면 전반. 0. */
  none: 0,
  /** 버튼·입력창·말풍선만. */
  touch: 2,
} as const
