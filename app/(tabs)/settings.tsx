/**
 * H01 · H02 설정 목록 - 설정 탭. 디자인 `N-H01-Settings` · `N-S-H1-Settings`(H02).
 *
 * 목록 표는 `src/utils/settingsRules.ts`의 `SETTINGS_GROUPS`다 - **이번에 갈 곳이 있는 항목만** 있다(프로필 · 연결된 계정 · 연인 ·
 * 커플 닉네임 · 성격 프로필 · 개인정보 & 약관). 보드에 있지만 갈 곳이 없는 항목(구독 · 사진 & 데이터 · 알림 · 데이터 내려받기 ·
 * 앱 정보 · 문의 · 빠진 지면 기본값 · 생체정보 · OUR SKY · 발행물 테마)과 [연결 해제] · [회원 탈퇴]는 `HIDDEN_SETTINGS_ITEMS`에 이유와 함께 적고 그리지 않는다.
 * 누르면 빈 화면이 나오는 행은 없다. 미연결이어도 5개 탭은 모두 보이고 이 탭은 전부 열린다(MASTER 11-2) -
 * "연인" 행은 "연결 전"으로 보이고, 눌러서 열리는 커플 화면이 잠긴 문(`CoupleGate`)을 보인다.
 *
 * 값은 읽기뿐이다(이름 · 로그인 방식 · 연인 이름과 D+N · 닉네임 · 성격 영문 라벨). 쓰는 것은 하위 화면이 한다.
 * 탭 바는 떠 있는 섬이라 화면 아래에 그만큼 띄운다.
 */
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListGroup, ListRow } from '../../src/components/nocturne/ListGroup'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { useSession } from '../../src/hooks/useSession'
import { useSettingsSummary } from '../../src/hooks/useSettingsSummary'
import { useCoupleStore } from '../../src/store/coupleStore'
import { nocturne, shape, type } from '../../src/theme/nocturne'
import { computeDaysTogetherKst } from '../../src/utils/relationshipDays'
import { SETTINGS_GROUPS, socialProviderLabel, type SettingsItemKey } from '../../src/utils/settingsRules'

export default function SettingsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const userId = session?.user.id ?? null
  const coupleStatus = useCoupleStore((s) => s.status)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const refreshCouple = useCoupleStore((s) => s.refresh)
  const summary = useSettingsSummary(userId, partnerId)

  useEffect(() => {
    if (userId) void refreshCouple(userId)
  }, [userId, refreshCouple])

  const connected = coupleStatus === 'connected'
  const days = connected && startDate ? computeDaysTogetherKst(startDate) : null
  const partnerValue = connected
    ? [summary.partnerName, days !== null ? `D+${days}` : null].filter(Boolean).join(' · ')
    : coupleStatus === 'disconnected'
      ? '연결 전'
      : ''

  const values: Record<SettingsItemKey, string> = {
    profile: summary.displayName ?? '',
    social: socialProviderLabel(session?.user.app_metadata?.provider as string | undefined),
    partner: partnerValue,
    nickname: connected ? (nickname ?? '') : '',
    personality: summary.loveTypeLabelEn ?? '',
    privacy: '',
  }

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + shape.tabBarGap + shape.tabBarHeight + 24 },
        ]}
      >
        <Text style={styles.title} accessibilityRole="header">
          설정
        </Text>
        {SETTINGS_GROUPS.map((group) => (
          <View key={group.kicker} style={styles.section}>
            <Text style={styles.kicker}>{group.kicker}</Text>
            <ListGroup>
              {group.items.map((item) => (
                <ListRow
                  key={item.key}
                  label={item.label}
                  value={values[item.key]}
                  onPress={() => router.push(item.href as never)}
                  testID={`settings-row-${item.key}`}
                />
              ))}
            </ListGroup>
          </View>
        ))}
      </ScrollView>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: shape.space.screen },
  title: { ...type.display, color: nocturne.text },
  section: { marginTop: 32, gap: 12 },
  kicker: { ...type.kicker, color: nocturne.textMute, paddingHorizontal: 4 },
})
