/**
 * 화면 1(로고/시작) 겸 앱 실행 분기점.
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   Part 9-1 화면 1 — "UI: 로고, 슬로건, '시작하기' 버튼. 인터랙션: 탭 → 화면 2"
 *   Part 11-1 앱 실행 분기 —
 *     로그인 세션 없음 → 온보딩 화면 1(처음부터)
 *     로그인 세션 있음 → onboarding_step에 따라 재개, 완료면 메인 탭
 *   Part 11-3 라우트 트리 — `app/index.tsx  # 스플래시/로고`
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Button } from '../src/components/Button'
import { ONBOARDING_STEP } from '../src/constants/onboardingStep'
import { useSession } from '../src/hooks/useSession'
import { fetchProfile } from '../src/services/personalityApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { useTheme } from '../src/theme'

export default function LogoStart() {
  const router = useRouter()
  const { session, loading } = useSession()
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (loading || !session) return

    let cancelled = false
    setResolving(true)
    ;(async () => {
      try {
        const profile = await fetchProfile(session.user.id)

        if (cancelled) return

        if (!profile) {
          // 세션은 있는데 profiles 행이 없다 — 화면 2~5 메모리 데이터가
          // 이미 소멸했을 가능성이 높은 에지 케이스. 재입력부터 시작한다.
          router.replace('/basic-info')
          return
        }

        if (profile.onboarding_step === ONBOARDING_STEP.AUTH) {
          router.replace('/result-detail')
          return
        }
        if (profile.onboarding_step === ONBOARDING_STEP.RESULT) {
          router.replace('/invite')
          return
        }

        // INVITE 또는 COMPLETE — 커플 연결 상태를 확인해 사귄 날짜
        // 입력이 아직 필요한지 판단한다.
        await useCoupleStore.getState().refresh(session.user.id)
        const couple = useCoupleStore.getState()
        if (
          profile.onboarding_step === ONBOARDING_STEP.INVITE &&
          couple.status === 'connected' &&
          !couple.relationshipStartDate
        ) {
          router.replace('/start-date')
          return
        }

        router.replace('/main')
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loading, session, router])

  const { colors, typography, spacing } = useTheme()

  if (loading || resolving) {
    return (
      <View style={{ alignItems: 'center', backgroundColor: colors.paper, flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.inkFull} size="large" />
      </View>
    )
  }

  if (session) {
    // 세션은 있지만 아직 라우팅 결정 전(useEffect가 위에서 처리) — 빈 화면.
    return <View style={{ backgroundColor: colors.paper, flex: 1 }} />
  }

  return (
    <View style={{ backgroundColor: colors.paper, flex: 1 }}>
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        {/* §13-7 화면 1: "화면 중앙 O N D O L O G(label-en) + 하단 시작하기" */}
        <Text style={[typography.labelEn, { color: colors.inkFull }]}>ONDOLOG</Text>
        <Text style={[typography.caption, { color: colors.inkMute, marginTop: spacing.s2 }]}>
          우리의 온도를 기록하는 잡지
        </Text>
      </View>
      <View style={{ padding: spacing.s5 }}>
        <Button label="시작하기" onPress={() => router.push('/basic-info')} />
      </View>
    </View>
  )
}
