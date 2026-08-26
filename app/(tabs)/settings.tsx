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
 */
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PageHeader } from '../../src/components/PageHeader'
import { supabase } from '../../src/services/supabase'
import { useCoupleStore } from '../../src/store/coupleStore'
import { useTheme, type ThemeMode } from '../../src/theme'

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
  const resetCouple = useCoupleStore((s) => s.reset)
  const { colors, typography, spacing, lines, mode, setMode } = useTheme()

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
      </View>
    </SafeAreaView>
  )
}
