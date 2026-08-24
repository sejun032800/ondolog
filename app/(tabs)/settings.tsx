/**
 * 설정 탭 — Part 11-2: "설정 | 미연결 시: 전면 진입 가능".
 * Phase 3 범위에서는 로그아웃만 제공한다(나머지 설정 항목은 후속 Phase).
 */
import { StyleSheet, Text, View } from 'react-native'
import { SecondaryButton } from '../../src/components/SecondaryButton'
import { COLORS, SPACING } from '../../src/constants/theme'
import { supabase } from '../../src/services/supabase'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function SettingsTab() {
  const resetCouple = useCoupleStore((s) => s.reset)

  return (
    <View style={styles.container}>
      <Text style={styles.text}>설정 항목은 차차 늘어날 예정이에요.</Text>
      <SecondaryButton
        label="로그아웃"
        onPress={async () => {
          resetCouple()
          await supabase.auth.signOut()
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg, flex: 1, gap: SPACING.lg, padding: SPACING.lg },
  text: { color: COLORS.textMuted, fontSize: 14 },
})
