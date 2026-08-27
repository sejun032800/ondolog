/**
 * 피드 탭 — Part 9-4 게이팅: "부분 — 혼자서도 업로드 가능, 통합 뷰는
 * 커플 전용". Phase 4 범위에서는 골격만(실제 업로드/자동 인식/지도는
 * Phase 6+) — 개인 기록 영역은 항상 열려 있고, 통합(커플 병합) 뷰만
 * `<CoupleGate>`로 감싸 부분 게이팅 원칙을 보여준다.
 *
 * Phase 6 첫 단계(생체정보 동의) 추가분: docs/ONDOLOG_MASTER.md "MASTER
 * 보강 — 생체정보(얼굴 인식) 별도 동의" "화면 순서 — 피드 탭 최초
 * 진입 시": 사진 앱 미연동이면 안내 카드 → [연동하기] → 화면 A(생체정보
 * 동의). 화면 B(사진 라이브러리 권한 요청)·화면 C(대표사진 등록)·실제
 * 얼굴 인식은 이번 범위가 아니다(메인 세션이 Phase 6 본작업에서
 * 진행) — 그래서 동의가 끝난 뒤에도 "준비 중" 문구만 보여주고 더
 * 진행하지 않는다.
 */
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../src/components/Button'
import { CoupleGate } from '../../src/components/CoupleGate'
import { PageHeader } from '../../src/components/PageHeader'
import { useTheme } from '../../src/theme'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'
import { useProfileStore } from '../../src/store/profileStore'
import { isBiometricConsentActive } from '../../src/utils/biometricConsent'

function PhotoSyncPromptCard() {
  const router = useRouter()
  const status = useProfileStore((s) => s.status)
  const biometricConsentAt = useProfileStore((s) => s.biometricConsentAt)
  const biometricConsentRevokedAt = useProfileStore((s) => s.biometricConsentRevokedAt)
  const { colors, typography, spacing, lines } = useTheme()

  if (status === 'unknown' || status === 'loading') return null

  const consentAgreed = isBiometricConsentActive(biometricConsentAt, biometricConsentRevokedAt)

  return (
    <View
      style={{
        borderBottomColor: colors.rule,
        borderBottomWidth: lines.section,
        gap: spacing.s2,
        paddingBottom: spacing.s5,
      }}
      testID="photo-sync-prompt-card"
    >
      {consentAgreed ? (
        <>
          <Text style={[typography.title, { color: colors.inkFull }]}>사진 자동 정리</Text>
          <Text style={[typography.body, { color: colors.inkMute }]}>
            생체정보 동의가 완료됐어요. 사진 라이브러리 연동은 아직 준비 중이에요. (Phase 6 범위)
          </Text>
        </>
      ) : (
        <>
          <Text style={[typography.title, { color: colors.inkFull }]}>
            사진 자동으로 정리해드릴까요?
          </Text>
          <Text style={[typography.body, { color: colors.inkMute }]}>
            두 사람이 함께 있는 사진만 찾아 피드에 정리해요. 얼굴 정보는 이 기기 안에서만 처리돼요.
          </Text>
          <View style={{ marginTop: spacing.s2, width: '100%' }}>
            <Button
              label="연동하기"
              onPress={() => router.push('/biometric-consent')}
              testID="photo-sync-connect"
            />
          </View>
        </>
      )}
    </View>
  )
}

export default function FeedTab() {
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)
  const refreshProfile = useProfileStore((s) => s.refresh)
  const { colors, typography, spacing, lines } = useTheme()

  useEffect(() => {
    if (session) {
      refresh(session.user.id)
      refreshProfile(session.user.id)
    }
  }, [session, refresh, refreshProfile])

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.paper, flex: 1 }}>
      <PageHeader left="피 드" />
      <View style={{ gap: spacing.s7, paddingHorizontal: 24, paddingTop: spacing.s6 }}>
        <PhotoSyncPromptCard />

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
