import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../constants/theme'

interface ScoreBarProps {
  label: string
  value: number
  max?: number
}

export function ScoreBar({ label, value, max = 100 }: ScoreBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '600', width: 52 },
  track: {
    backgroundColor: COLORS.card,
    borderRadius: 999,
    flex: 1,
    height: 10,
    overflow: 'hidden',
  },
  fill: { backgroundColor: COLORS.primary, borderRadius: 999, height: '100%' },
  value: { color: COLORS.textMuted, fontSize: 12, width: 28 },
})
