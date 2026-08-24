/**
 * 메인 탭 — Phase 3 범위에서는 최소 골격만.
 * Part 11-2: "메인 | 미연결 시: 진입 가능(36.5도 + 결과 요약 + 초대 CTA)"
 * 온도 실결합 공식은 미확정(`src/engine/temperature.ts` 참조) — 여기서는
 * 미연결 고정값(36.5)만 표시한다. 연결 상태의 실제 온도/코너 노출은
 * Phase 4(메인 탭) 범위.
 */
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CoupleGate } from '../../src/components/CoupleGate'
import { COLORS, SPACING } from '../../src/constants/theme'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function MainTab() {
  const { session } = useSession()
  const temperature = useCoupleStore((s) => s.temperature)
  const refresh = useCoupleStore((s) => s.refresh)

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.temperature}>{temperature.toFixed(1)}°</Text>
        <Text style={styles.heroCaption}>오늘의 온도</Text>
      </View>

      <CoupleGate>
        <Text>커플 전용 콘텐츠 (Phase 4 범위)</Text>
      </CoupleGate>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg, flex: 1, gap: SPACING.lg, padding: SPACING.lg },
  hero: { alignItems: 'center', paddingVertical: SPACING.xl },
  temperature: { color: COLORS.primary, fontSize: 56, fontWeight: '800' },
  heroCaption: { color: COLORS.textMuted, fontSize: 14, marginTop: SPACING.xs },
})
