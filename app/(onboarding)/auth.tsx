/**
 * A11 로그인 수단 - 동의(A10) 다음이다(MASTER 6-1, R24-4). 디자인 `N-A11-Login`.
 *
 * **동의 없이는 이 화면에 머물 수 없다**: 필수 동의가 빠졌거나 만 14세 미만이거나 생년월일(앞 화면 답)이 없으면 A10으로 되돌린다
 * (순수 함수 `canEnterLogin`). 로그인 버튼 자체도 같은 조건일 때만 눌린다.
 *
 * 카카오 로그인은 **기존 코드**(`signInWithSocialProvider`)를 그대로 쓴다. 구글·애플은 아직 동작하지 않아(Supabase 프로바이더 미설정,
 * HANDOFF) 보드의 버튼을 **숨겼다**. 로그인에 성공하면 `useSignupFinalize`가 기존 저장 경로로 답과 동의 시각을 저장하고, **저장이 실패하면
 * 넘어가지 않으며 [다시 시도]가 나온다**(동의·답은 그대로). 로그인 인증이 실패해도 동의 상태는 그대로 남는다(MASTER 6-5).
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { RiseIn } from '../../src/components/nocturne/RiseIn'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { SkyBackground } from '../../src/components/nocturne/SkyBackground'
import { PushHeader } from '../../src/components/nocturne/ExitHeader'
import { useSession } from '../../src/hooks/useSession'
import { useSignupFinalize } from '../../src/hooks/useSignupFinalize'
import { signInWithSocialProvider } from '../../src/services/socialAuth'
import { useSessionStore } from '../../src/store/sessionStore'
import { fontFamily, nocturne, shape, type } from '../../src/theme/nocturne'
import { canEnterLogin } from '../../src/utils/onboardingRules'

export default function AuthScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const birthDate = useSessionStore((s) => s.birthDate)
  const consent = useSessionStore((s) => s.consent)
  const [kakaoPending, setKakaoPending] = useState(false)
  const [loginError, setLoginError] = useState(false)

  const finalize = useSignupFinalize(session, () => router.replace('/result-detail'))
  const entryAllowed = canEnterLogin(birthDate, consent, new Date())

  // 동의 없이는 로그인 화면에 머물 수 없다. 저장이 끝난 뒤 메모리가 비워진 것은 되돌림 사유가 아니다.
  const { isFinished } = finalize
  useEffect(() => {
    if (isFinished()) return
    if (!entryAllowed) router.replace('/consent')
  }, [entryAllowed, isFinished, router])

  const signInKakao = async () => {
    if (!entryAllowed || kakaoPending) return
    setLoginError(false)
    setKakaoPending(true)
    try {
      const { cancelled } = await signInWithSocialProvider('kakao')
      if (cancelled) setKakaoPending(false)
      // 성공하면 onAuthStateChange -> useSession -> useSignupFinalize가 이어받는다.
    } catch {
      setKakaoPending(false)
      setLoginError(true)
    }
  }

  const saving =
    finalize.status === 'saving' || finalize.isFinished() || (!!session && finalize.status === 'idle' && entryAllowed)
  const saveFailed = finalize.status === 'failed'

  return (
    <ScreenFrame>
      <SkyBackground view="sky" bottomVeil>
        <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
          <PushHeader onBack={() => router.back()} />
          <Text style={styles.brand}>ONDOLOG</Text>
        </View>
        <View style={styles.spacer} />
        <RiseIn style={[styles.bottom, { paddingBottom: insets.bottom + 44 }]}>
          <Text style={styles.title}>{'어떤 계정으로\n시작할까요?'}</Text>
          <Text style={styles.sub}>로그인하면 방금 본 결과가 계정에 저장돼요.</Text>

          <View style={styles.buttons}>
            {saveFailed ? (
              <>
                <Text style={styles.error} testID="auth-save-error">저장하지 못했어요. 다시 시도해주세요.</Text>
                <PrimaryButton label="다시 시도" onPress={finalize.retry} testID="auth-retry" />
              </>
            ) : saving ? (
              <PrimaryButton label="저장하는 중이에요" onPress={() => {}} disabled testID="auth-saving" />
            ) : (
              <>
                <PressScale
                  onPress={signInKakao}
                  disabled={!entryAllowed || kakaoPending}
                  accessibilityLabel="카카오로 시작하기"
                  testID="auth-kakao"
                  style={[styles.kakao, kakaoPending && styles.kakaoPending]}
                >
                  <Text style={styles.kakaoLabel}>카카오로 시작하기</Text>
                </PressScale>
                {loginError ? (
                  <Text style={styles.error} testID="auth-login-error">
                    로그인하지 못했어요. 잠시 후 다시 시도해주세요.
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <Text style={styles.foot}>동의한 내용은 로그인이 실패해도 그대로 남아요</Text>
        </RiseIn>
      </SkyBackground>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: shape.space.screen, gap: 12 },
  brand: { ...type.caption, fontSize: 12, letterSpacing: 5, color: nocturne.textSub, paddingLeft: 4 },
  spacer: { flex: 1 },
  bottom: { paddingHorizontal: shape.space.screen, gap: 28 },
  title: { ...type.display, fontSize: 30, lineHeight: 40, color: nocturne.text },
  sub: { ...type.sub, fontSize: 14.5, lineHeight: 23, color: nocturne.textSub, marginTop: -16 },
  buttons: { gap: 10 },
  kakao: {
    height: shape.buttonHeight,
    borderRadius: shape.radius.button,
    backgroundColor: nocturne.kakao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoPending: { opacity: 0.6 },
  kakaoLabel: { fontFamily: fontFamily.semiBold, fontSize: 15.5, color: nocturne.ink },
  error: { ...type.sub, color: nocturne.rose, textAlign: 'center' },
  foot: { ...type.caption, lineHeight: 18, color: nocturne.textMute, textAlign: 'center' },
})
