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
 * A02 "이미 계정이 있어요"(R38-3, MASTER 6-5 r70): 동의 없이 로그인(A11)으로 바로 간다 - 동의는 이미 `profiles`에 찍혀 있다. 이 길로 왔다는
 * 표시는 `sessionStore.existingAccountPath`(메모리)뿐이다. 로그인 뒤 `profiles`가 없으면 로그인한 채 A03부터 다시(아래 재개 분기와 같다).
 * 재개 분기의 경로 규칙은 기존 계정 로그인 직후와 같은 함수(`resolveResumePath`)를 쓴다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Wordmark } from '../src/components/onboarding/Wordmark'
import { PrimaryButton } from '../src/components/nocturne/Buttons'
import { PressScale } from '../src/components/nocturne/PressScale'
import { RiseIn } from '../src/components/nocturne/RiseIn'
import { ScreenFrame } from '../src/components/nocturne/ScreenFrame'
import { SkyBackground } from '../src/components/nocturne/SkyBackground'
import { resolveResumePath } from '../src/hooks/resolveResumePath'
import { useSession } from '../src/hooks/useSession'
import { fetchProfile } from '../src/services/personalityApi'
import { useSessionStore } from '../src/store/sessionStore'
import { nocturne, shape, type } from '../src/theme/nocturne'

/** 스플래시(A01)를 보이는 시간. 이 뒤에 시작(A02)으로 바뀐다. */
const SPLASH_MS = 1400

export default function LogoStart() {
  const router = useRouter()
  const { session, loading } = useSession()
  const [resolving, setResolving] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  /** 앱을 열었을 때 이미 로그인돼 있었는가(null = 아직 모름). 열린 뒤에 생긴 세션은 이 화면이 맡지 않는다. */
  const startedLoggedInRef = useRef<boolean | null>(null)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (loading) return
    if (startedLoggedInRef.current === null) startedLoggedInRef.current = !!session
    // 로그인 화면(A11)에서 방금 로그인한 세션은 거기서 `useSignupFinalize`가 분기한다. 이 화면은 스택 아래에 남아 있어서
    // 같은 세션 변화를 보고 끼어들면(`/basic-info`로 갈아치움) 저장·분기와 다투게 된다.
    if (!session || !startedLoggedInRef.current) return

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

        router.replace((await resolveResumePath(profile)) as never)
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
          <PrimaryButton
            label="시작하기"
            onPress={() => {
              useSessionStore.getState().setExistingAccountPath(false)
              router.push('/basic-info')
            }}
            testID="start-button"
          />
          <PressScale
            onPress={() => {
              useSessionStore.getState().setExistingAccountPath(true)
              router.push('/auth')
            }}
            accessibilityLabel="이미 계정이 있어요"
            style={styles.existing}
            testID="existing-account"
          >
            <Text style={styles.existingLabel}>이미 계정이 있어요</Text>
          </PressScale>
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
  startFooter: { paddingHorizontal: 20, gap: 4 },
  existing: { minHeight: shape.touch, alignItems: 'center', justifyContent: 'center' },
  existingLabel: { ...type.body, fontSize: 15.5, color: nocturne.mist },
})
