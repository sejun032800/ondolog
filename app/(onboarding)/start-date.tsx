/**
 * 화면 +. 사귄 날짜 입력.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 + —
 *   노출 시점: 커플 매칭 완료 직후(양측 모두)
 *   UI: 날짜 피커 + 확인
 *   저장: `couples.relationship_start_date`
 *   엣지 케이스: 양쪽이 다른 날짜 입력 시 → 먼저 입력한 값 적용,
 *     상대는 확인만(미확정) — `src/services/coupleApi.ts`
 *     `setOrConfirmStartDate`가 이 규칙을 그대로 구현한다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { DateInput } from '../../src/components/DateInput'
import { Button } from '../../src/components/Button'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { useTheme } from '../../src/theme'
import { useSession } from '../../src/hooks/useSession'
import { markStartDateOnboardingComplete, setOrConfirmStartDate } from '../../src/services/coupleApi'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function StartDateScreen() {
  const router = useRouter()
  const { colors, typography } = useTheme()
  const { session } = useSession()
  const coupleId = useCoupleStore((s) => s.coupleId)
  const refresh = useCoupleStore((s) => s.refresh)
  const [date, setDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session) return
    refresh(session.user.id).finally(() => setLoading(false))
  }, [session, refresh])

  const handleConfirm = async () => {
    if (!session || !coupleId || !date) return
    setSubmitting(true)
    try {
      await setOrConfirmStartDate(coupleId, session.user.id, date)
      await markStartDateOnboardingComplete(session.user.id)
      router.replace('/main')
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.inkFull} size="large" />
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer
      title="언제부터 사귀었나요?"
      subtitle="온도 기록은 이 날짜를 기준으로 시작해요."
      footer={
        <Button label="확인" onPress={handleConfirm} disabled={!date} loading={submitting} />
      }
    >
      <DateInput value={date} onChange={setDate} maxYear={new Date().getFullYear()} />
      <Text style={[typography.caption, { color: colors.inkMute }]}>
        상대가 먼저 입력했다면 확인만 하면 돼요.
      </Text>
    </ScreenContainer>
  )
}
