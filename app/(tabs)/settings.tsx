/**
 * 설정 탭 — Part 11-2: "설정 | 미연결 시: 전면 진입 가능".
 * docs/ONDOLOG_DESIGN.md §13-6 구성 — 그룹 제목 kicker-ko, 항목 title,
 * 값 caption + `→`, 행 높이 56.
 *
 * "화면 · 테마" 행은 §7 "수동: 설정 탭에서 라이트/다크/시스템"을 실제로
 * 구현한다(`useTheme().setMode`) — 탭할 때마다 시스템→라이트→다크→시스템
 * 순으로 순환한다. 그 외 "계정" 그룹은 Phase 3 범위(로그아웃)만 유지한다
 * — 프로필 편집·연결 계정 표시 등은 아직 구현되지 않은 기능이라 값 없는
 * 자리표시 행을 새로 만들지 않는다(문서에 없는 기능 임의 추가 금지).
 *
 * "개인정보 & 약관" 그룹(Phase 6 첫 단계 추가분): docs/ONDOLOG_MASTER.md
 * "MASTER 보강 — 생체정보(얼굴 인식) 별도 동의" "설정 탭 — 동의 관리
 * (Part 9-6 보강)". 탭하면 `/biometric-consent`가 현재 동의 상태를 보고
 * 스스로 관리 모드로 렌더링한다(이 화면은 상태 표시만 하고 철회 로직을
 * 직접 갖지 않는다).
 *
 * "사진 & 데이터" 그룹(Phase 6 대표사진 등록 추가분): MASTER.md Part 9-6
 * "사진 & 데이터 | 사진 앱 연동 on/off, 대표사진(개인/커플) 등록·교체,
 * 스캔 진행률" 중 "대표사진 등록·교체"만 구현한다 — 나머지 둘(연동
 * on/off, 스캔 진행률)은 화면 B/C 이후 단계(사진 라이브러리 권한·백그라운드
 * 스캔)가 있어야 의미가 생겨 아직 자리표시 행을 만들지 않는다.
 */
import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PageHeader } from '../../src/components/PageHeader'
import { useSession } from '../../src/hooks/useSession'
import { supabase } from '../../src/services/supabase'
import { useCoupleStore } from '../../src/store/coupleStore'
import { useProfileStore } from '../../src/store/profileStore'
import { useTheme, type ThemeMode } from '../../src/theme'
import { isBiometricConsentActive } from '../../src/utils/biometricConsent'

const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  system: '시스템 설정',
  light: '라이트',
  dark: '다크',
}

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

export default function SettingsTab() {
  const router = useRouter()
  const { session } = useSession()
  const resetCouple = useCoupleStore((s) => s.reset)
  const biometricStatus = useProfileStore((s) => s.status)
  const biometricConsentAt = useProfileStore((s) => s.biometricConsentAt)
  const biometricConsentRevokedAt = useProfileStore((s) => s.biometricConsentRevokedAt)
  const referencePhotoPath = useProfileStore((s) => s.referencePhotoPath)
  const refreshProfile = useProfileStore((s) => s.refresh)
  const resetProfile = useProfileStore((s) => s.reset)
  const { colors, typography, spacing, lines, mode, setMode } = useTheme()

  useEffect(() => {
    if (session) refreshProfile(session.user.id)
  }, [session, refreshProfile])

  const biometricAgreed = isBiometricConsentActive(biometricConsentAt, biometricConsentRevokedAt)
  const biometricValueLabel =
    biometricStatus === 'loaded' ? (biometricAgreed ? '동의함' : '미동의') : '—'
  const referencePhotoValueLabel =
    biometricStatus === 'loaded' ? (referencePhotoPath ? '등록됨' : '미등록') : '—'

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.paper, flex: 1 }}>
      <PageHeader left="설 정" />
      <View style={{ paddingHorizontal: 24, paddingTop: spacing.s6 }}>
        <Text style={[typography.kickerKo, { color: colors.inkFull, marginBottom: spacing.s2 }]}>
          계 정
        </Text>
        <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section }}>
          <Pressable
            onPress={async () => {
              resetCouple()
              resetProfile()
              await supabase.auth.signOut()
            }}
            style={{
              alignItems: 'center',
              borderBottomColor: colors.rule,
              borderBottomWidth: lines.hairline,
              flexDirection: 'row',
              height: 56,
              justifyContent: 'space-between',
            }}
          >
            <Text style={[typography.title, { color: colors.inkFull }]}>로그아웃</Text>
            <Text style={[typography.caption, { color: colors.inkMute }]}>→</Text>
          </Pressable>
        </View>

        <Text
          style={[typography.kickerKo, { color: colors.inkFull, marginBottom: spacing.s2, marginTop: spacing.s7 }]}
        >
          화 면
        </Text>
        <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section }}>
          <Pressable
            onPress={() => setMode(NEXT_MODE[mode])}
            style={{
              alignItems: 'center',
              borderBottomColor: colors.rule,
              borderBottomWidth: lines.hairline,
              flexDirection: 'row',
              height: 56,
              justifyContent: 'space-between',
            }}
          >
            <Text style={[typography.title, { color: colors.inkFull }]}>테마</Text>
            <Text style={[typography.caption, { color: colors.inkMute }]}>
              {THEME_MODE_LABEL[mode]} →
            </Text>
          </Pressable>
        </View>

        <Text
          style={[typography.kickerKo, { color: colors.inkFull, marginBottom: spacing.s2, marginTop: spacing.s7 }]}
        >
          개인정보 & 약관
        </Text>
        <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section }}>
          <Pressable
            onPress={() => router.push('/biometric-consent')}
            testID="settings-biometric-consent-row"
            style={{
              alignItems: 'center',
              borderBottomColor: colors.rule,
              borderBottomWidth: lines.hairline,
              flexDirection: 'row',
              height: 56,
              justifyContent: 'space-between',
            }}
          >
            <Text style={[typography.title, { color: colors.inkFull }]}>
              생체정보(얼굴 인식) 동의
            </Text>
            <Text style={[typography.caption, { color: colors.inkMute }]}>
              {biometricValueLabel} →
            </Text>
          </Pressable>
        </View>

        <Text
          style={[typography.kickerKo, { color: colors.inkFull, marginBottom: spacing.s2, marginTop: spacing.s7 }]}
        >
          사진 & 데이터
        </Text>
        <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section }}>
          <Pressable
            onPress={() => router.push('/reference-photo')}
            testID="settings-reference-photo-row"
            style={{
              alignItems: 'center',
              borderBottomColor: colors.rule,
              borderBottomWidth: lines.hairline,
              flexDirection: 'row',
              height: 56,
              justifyContent: 'space-between',
            }}
          >
            <Text style={[typography.title, { color: colors.inkFull }]}>대표사진 등록·교체</Text>
            <Text style={[typography.caption, { color: colors.inkMute }]}>
              {referencePhotoValueLabel} →
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
