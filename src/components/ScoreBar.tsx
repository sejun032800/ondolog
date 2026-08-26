/**
 * 값 하나를 가로 막대로 보여주는 최소 지표 시각화.
 * 근거: docs/ONDOLOG_DESIGN.md §4-3 "수치는 항상 액센트 색, 라벨은
 * ink-mute" — 막대 자체는 발행물에 없는 시각화지만(Phase 3가 이미
 * 채택한 로직), 색 배치만 그 규칙을 그대로 따른다. 트랙에는 둥근
 * 모서리를 쓰지 않는다(§3-4 radius 0).
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'

interface ScoreBarProps {
  label: string
  value: number
  max?: number
}

export function ScoreBar({ label, value, max = 100 }: ScoreBarProps) {
  const { colors, typography, spacing } = useTheme()
  const pct = Math.max(0, Math.min(100, (value / max) * 100))

  return (
    <View style={[styles.row, { gap: spacing.s3 }]}>
      <Text style={[typography.caption, { color: colors.inkMute, width: 52 }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: colors.rule }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
      </View>
      <Text style={[typography.caption, { color: colors.accent, width: 28 }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  track: {
    borderRadius: 0,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  fill: { borderRadius: 0, height: '100%' },
})
