/**
 * 피드 탭 — Part 11-2: "피드 | 미연결 시: 진입 가능 — 혼자서도 기록 가능".
 * Phase 3 범위에서는 골격만(실제 업로드/타임라인은 Phase 6+).
 */
import { StyleSheet, Text, View } from 'react-native'
import { COLORS, SPACING } from '../../src/constants/theme'

export default function FeedTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>혼자서도 기록할 수 있어요. (Phase 6 범위)</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg, flex: 1, padding: SPACING.lg },
  text: { color: COLORS.textMuted, fontSize: 14 },
})
