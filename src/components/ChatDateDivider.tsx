/**
 * 날짜 구분선 — docs/ONDOLOG_DESIGN.md §13-3 "날짜 구분 | 가운데 hairline + caption".
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'

export function ChatDateDivider({ label }: { label: string }) {
  const { colors, typography, spacing, lines } = useTheme()
  return (
    <View style={[styles.row, { gap: spacing.s3, marginVertical: spacing.s3 }]}>
      <View style={{ backgroundColor: colors.rule, flex: 1, height: lines.hairline }} />
      <Text style={[typography.caption, { color: colors.inkMute }]}>{label}</Text>
      <View style={{ backgroundColor: colors.rule, flex: 1, height: lines.hairline }} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
})
