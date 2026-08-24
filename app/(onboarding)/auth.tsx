/**
 * 화면 6. 회원가입/로그인.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 6 —
 *   소셜 로그인: 카카오/구글/애플 3종. 배치: 카카오 최상단.
 *   데이터: "세션 유지 상태면 화면 2~5 데이터 귀속(재입력 없음)"
 *
 * 로그인에 성공하는 순간 이 화면이 화면 2~5의 메모리 데이터를 서버로
 * 귀속시키는 지점이다(profiles + personality_assessments 저장) —
 * 그 뒤에 `resetSession()`으로 메모리를 비운다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton } from '../../src/components/PrimaryButton'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { COLORS } from '../../src/constants/theme'
import { useSession } from '../../src/hooks/useSession'
import { createProfileAndAssessment } from '../../src/services/personalityApi'
import { signInWithSocialProvider, type SocialProvider } from '../../src/services/socialAuth'
import { useSessionStore } from '../../src/store/sessionStore'

const PROVIDERS: Array<{ key: SocialProvider; label: string }> = [
  { key: 'kakao', label: '카카오로 계속하기' },
  { key: 'google', label: 'Google로 계속하기' },
  { key: 'apple', label: 'Apple로 계속하기' },
]

export default function AuthScreen() {
  const router = useRouter()
  const { session } = useSession()
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittedRef = useRef(false)

  const name = useSessionStore((s) => s.name)
  const gender = useSessionStore((s) => s.gender)
  const birthDate = useSessionStore((s) => s.birthDate)
  const mbti = useSessionStore((s) => s.mbti)
  const mbtiSelfReported = useSessionStore((s) => s.mbtiSelfReported)
  const q1 = useSessionStore((s) => s.q1)
  const q2 = useSessionStore((s) => s.q2)
  const q3 = useSessionStore((s) => s.q3)
  const q4 = useSessionStore((s) => s.q4)
  const q5 = useSessionStore((s) => s.q5)
  const result = useSessionStore((s) => s.result)
  const resetSession = useSessionStore((s) => s.resetSession)

  const hasCompleteSessionData =
    name.trim().length > 0 &&
    !!gender &&
    !!birthDate &&
    !!mbti &&
    !!q1 &&
    !!q2 &&
    !!q3 &&
    !!q4 &&
    !!q5 &&
    !!result

  useEffect(() => {
    if (!session || submittedRef.current) return

    if (!hasCompleteSessionData) {
      // 세션은 있는데 화면 2~5 메모리 데이터가 없다 — 앱이 중간에 죽었던
      // 경우 등. 재입력 화면으로 보낸다(index.tsx의 분기와 동일 원칙).
      return
    }

    submittedRef.current = true
    setSubmitting(true)
    ;(async () => {
      try {
        await createProfileAndAssessment({
          userId: session.user.id,
          name,
          gender: gender!,
          birthDate: birthDate!,
          mbti: mbti!,
          mbtiSelfReported,
          q1: q1!,
          q2: q2!,
          q3: q3!,
          q4: q4!,
          q5: q5!,
          result: result!,
        })
        resetSession()
        router.replace('/result-detail')
      } catch (e) {
        submittedRef.current = false
        Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
      } finally {
        setSubmitting(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasCompleteSessionData])

  const handlePress = async (provider: SocialProvider) => {
    setPendingProvider(provider)
    try {
      const { cancelled } = await signInWithSocialProvider(provider)
      if (cancelled) setPendingProvider(null)
      // 성공 시 onAuthStateChange → useSession → 위 useEffect가 이어받는다.
    } catch (e) {
      setPendingProvider(null)
      Alert.alert(
        '로그인에 실패했어요',
        e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.',
      )
    }
  }

  return (
    <ScreenContainer
      title="시작하기"
      subtitle="소셜 계정으로 간편하게 시작해요."
    >
      <View style={styles.buttons}>
        {PROVIDERS.map((p) => (
          <PrimaryButton
            key={p.key}
            label={p.label}
            onPress={() => handlePress(p.key)}
            loading={pendingProvider === p.key || (submitting && !!session)}
            disabled={
              (pendingProvider !== null && pendingProvider !== p.key) ||
              (submitting && !!session)
            }
          />
        ))}
      </View>
      <Text style={styles.notice}>
        계속 진행하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주합니다.
      </Text>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  buttons: { gap: 12 },
  notice: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
})
