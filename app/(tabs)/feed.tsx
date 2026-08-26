/**
 * 피드 탭 — Part 9-4 게이팅: "부분 — 혼자서도 업로드 가능, 통합 뷰는
 * 커플 전용". Phase 4 범위에서는 골격만(실제 업로드/자동 인식/지도는
 * Phase 6+) — 개인 기록 영역은 항상 열려 있고, 통합(커플 병합) 뷰만
 * `<CoupleGate>`로 감싸 부분 게이팅 원칙을 보여준다.
 */
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CoupleGate } from '../../src/components/CoupleGate'
import { PageHeader } from '../../src/components/PageHeader'
import { useTheme } from '../../src/theme'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function FeedTab() {
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)
  const { colors, typography, spacing, lines } = useTheme()

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.paper, flex: 1 }}>
      <PageHeader left="피 드" />
      <View style={{ gap: spacing.s7, paddingHorizontal: 24, paddingTop: spacing.s6 }}>
        <View style={{ gap: spacing.s2 }}>
          <Text style={[typography.title, { color: colors.inkFull }]}>내 기록</Text>
          <Text style={[typography.body, { color: colors.inkMute }]}>
            혼자서도 기록할 수 있어요. (Phase 6 범위)
          </Text>
        </View>

        <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section, gap: spacing.s2, paddingTop: spacing.s5 }}>
          <Text style={[typography.title, { color: colors.inkFull }]}>통합 타임라인</Text>
          <CoupleGate
            fallback={
              <Text style={[typography.body, { color: colors.inkMute }]}>
                연결되면 양측 기록이 하나의 타임라인으로 합쳐져요.
              </Text>
            }
          >
            <Text style={[typography.body, { color: colors.inkMute }]}>
              아직 준비 중이에요. (Phase 6 범위)
            </Text>
          </CoupleGate>
        </View>
      </View>
    </SafeAreaView>
  )
}
