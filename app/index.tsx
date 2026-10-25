/**
 * A01 스플래시 -> A02 시작 + 앱 실행 분기점. 디자인 `N-A01-Splash` · `N-S-A1-Onboarding`.
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   Part 9-1 화면 1 - "UI: 로고, 슬로건, '시작하기' 버튼. 인터랙션: 탭 -> 화면 2"
 *   Part 11-1 앱 실행 분기 -
 *     로그인 세션 없음 -> 온보딩 화면 1(처음부터)
 *     로그인 세션 있음 -> onboarding_step에 따라 재개, 완료면 메인 탭
 *   Part 11-3 라우트 트리 - `app/index.tsx  # 스플래시/로고`
 *
 * 세션이 없으면 스플래시(A01)를 잠깐 보인 뒤 시작(A02)으로 바뀐다. 모션은 진입 떠오름뿐이다.
 * 세션 확인 중·재개 분기 중에는 스플래시를 그대로 둔다(스피너 없음). 이 화면이 서버를 부르는 것은 **이미 로그인된 세션이 있을 때뿐**이다
 * (`useSession`의 기기 안 세션 복원 + 재개 분기의 프로필 조회) - 로그인 전 온보딩 화면(A03~A13)은 서버를 부르지 않는다.
 *
 * 보드의 "이미 계정이 있어요" 링크는 두지 않았다: 동의(A10)가 로그인(A11) 앞이어야 하는데(MASTER 6-1) 이 링크는 동의 없이
 * 로그인으로 가는 길이 된다. 이미 로그인된 기기는 위 재개 분기가 맡는다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Wordmark } from '../src/components/onboarding/Wordmark'
import { PrimaryButton } from '../src/components/nocturne/Buttons'
import { RiseIn } from '../src/components/nocturne/RiseIn'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { SkyBackground } from '../src/components/nocturne/SkyBackground'
import { ONBOARDING_STEP } from '../src/constants/onboardingStep'
import { useSession } from '../src/hooks/useSession'
import { fetchProfile } from '../src/services/personalityApi'
import { useCoupleStore } from '../src/store/coupleStore'
import { nocturne, type } from '../src/theme/nocturne'

/** 스플래시(A01)를 보이는 시간. 이 뒤에 시작(A02)으로 바뀐다. */
const SPLASH_MS = 1400

export default function LogoStart() {
  const router = useRouter()
  const { session, loading } = useSession()
  const [resolving, setResolving] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

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

  // 세션 확인 중 · 재개 분기 중 · 로그인된 세션 · 스플래시 시간 안에는 스플래시(A01)를 그대로 둔다.
  if (loading || resolving || session || !splashDone) {
    return (
      <ScreenFrame>
        <SkyBackground view="main">
          <View style={styles.splash}>
            <RiseIn>
              <Wordmark caption="온도록" />
            </RiseIn>
          </View>
        </SkyBackground>
      </ScreenFrame>
    )
  }

  return (
    <ScreenFrame>
      <SkyBackground view="main" bottomVeil>
        <View style={styles.startTop}>
          <RiseIn style={styles.startCopy}>
            <Wordmark size={14} />
            <Text style={styles.headline}>{'두 사람의 기록이\n한 권의 잡지가 돼요'}</Text>
          </RiseIn>
        </View>
        <View style={[styles.startFooter, { paddingBottom: insets.bottom + 40 }]}>
          <PrimaryButton label="시작하기" onPress={() => router.push('/basic-info')} testID="start-button" />
        </View>
      </SkyBackground>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  startTop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  startCopy: { alignItems: 'center', gap: 44 },
  headline: { ...type.display, color: nocturne.text, textAlign: 'center' },
  startFooter: { paddingHorizontal: 20 },
})
