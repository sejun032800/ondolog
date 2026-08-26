/**
 * 지면 헤더 — docs/ONDOLOG_DESIGN.md §4-1, §13-1.
 *
 * 모든 화면 공통 골격("발행물의 러닝헤드를 그대로 옮긴다"):
 *   좌: 화면명(한글 키커, 자간 0.18em) / 우: 맥락 정보(caption) / 아래: masthead 선
 *
 * §13-1 예시 그대로 각 탭 화면 최상단에서 SafeAreaView 바로 아래 쓴다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'

interface PageHeaderProps {
  /** 화면명. kicker-ko로 렌더링한다(예: "메 인"의 자간 효과는 letterSpacing이 대신한다). */
  left: string
  /** 맥락 정보(예: "D+298", "연남동 · 2026년 8월"). */
  right?: string
}

export function PageHeader({ left, right }: PageHeaderProps) {
  const { colors, typography, spacing, layout, lines } = useTheme()

  return (
    <View style={{ paddingHorizontal: layout.pageMarginX, paddingTop: layout.pageTopMargin }}>
      <View style={[styles.row, { paddingBottom: spacing.s3 }]}>
        <Text style={[typography.kickerKo, { color: colors.inkFull }]}>{left}</Text>
        {right ? (
          <Text style={[typography.caption, { color: colors.inkMute }]}>{right}</Text>
        ) : null}
      </View>
      <View style={{ height: lines.masthead, backgroundColor: colors.ruleStrong }} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
