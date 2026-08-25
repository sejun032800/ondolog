/**
 * 화면 6. 회원가입/로그인 (개정판 — 약관 동의 포함).
 *
 * 근거: docs/ONDOLOG_MASTER.md "MASTER Part 9-1 보강 — 화면 6 약관 동의
 *   명세". 기존 "화면 6. 회원가입/로그인" 절을 대체한다.
 *
 *   6-1 화면 구성: 1) 소셜 로그인 3종 2) 동의 항목 체크리스트
 *   3) 버튼(필수 항목 전체 체크 시에만 활성화). "동의를 먼저 받고
 *   로그인한다"는 순서 원칙에 따라, 이 화면은 별도의 4번째 CTA를 더
 *   두지 않고 소셜 로그인 버튼 3개 자체를 그 CTA로 쓴다 — 필수 동의가
 *   전부 체크되기 전까지는 3개 버튼이 전부 비활성 상태다. 자세한 근거는
 *   `.claude/state/DECISIONS.md` 2026-08-25 항목 참조.
 *
 * 로그인에 성공하는 순간 이 화면이 화면 2~5의 메모리 데이터를 서버로
 * 귀속시키는 지점이다(profiles + personality_assessments 저장) —
 * 그 뒤에 `resetSession()`으로 메모리를 비운다.
 *
 * 동의 체크박스 상태(`consent`)는 이 화면 컴포넌트가 마운트돼 있는 한
 * (OAuth 인앱 브라우저가 열렸다 돌아오는 동안 포함) 그대로 유지된다 —
 * 6-5 "인증 실패 시: 동의 상태를 세션에 유지하고 재시도 가능하게 한다.
 * 다시 체크하게 만들지 않는다"를 별도 저장 없이 React 로컬 state만으로
 * 충족한다(성공 전까지 이 상태를 리셋하는 코드 경로가 없다).
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import {
  ConsentChecklist,
  INITIAL_CONSENT_VALUE,
  type ConsentValue,
} from '../../src/components/ConsentChecklist'
import { PrimaryButton } from '../../src/components/PrimaryButton'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { MIN_AGE_YEARS } from '../../src/constants/consent'
import { COLORS } from '../../src/constants/theme'
import { useSession } from '../../src/hooks/useSession'
import { createProfileAndAssessment } from '../../src/services/personalityApi'
import { signInWithSocialProvider, type SocialProvider } from '../../src/services/socialAuth'
import { useSessionStore } from '../../src/store/sessionStore'
import { calculateAge } from '../../src/utils/age'

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
  const [consent, setConsent] = useState<ConsentValue>(INITIAL_CONSENT_VALUE)

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

  // 6-3 ①: "화면 2에서 수집한 birth_date로 자동 검증한다."
  const ageEligible = !!birthDate && calculateAge(birthDate, new Date()) >= MIN_AGE_YEARS
  const requiredConsentChecked = consent.terms && consent.privacy && consent.aiUsage
  const canProceed = ageEligible && requiredConsentChecked

  useEffect(() => {
    if (!session || submittedRef.current) return

    if (!hasCompleteSessionData) {
      // 세션은 있는데 화면 2~5 메모리 데이터가 없다 — 앱이 중간에 죽었던
      // 경우 등. 재입력 화면으로 보낸다(index.tsx의 분기와 동일 원칙).
      return
    }

    if (!canProceed) {
      // 이론상 도달하지 않는다 — 로그인 버튼 자체가 canProceed일 때만
      // 눌린다. 방어적으로 한 번 더 막아 "동의 없이 profiles 레코드가
      // 생성되지 않는다"(6-6 완료기준)를 이 함수 하나가 아니라 이
      // 화면도 함께 보장한다.
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
          marketingAgreed: consent.marketing,
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
  }, [session, hasCompleteSessionData, canProceed])

  const handlePress = async (provider: SocialProvider) => {
    if (!canProceed) return // 방어적 가드 — 버튼은 이미 비활성 상태다.
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
      subtitle="약관에 동의하고 소셜 계정으로 간편하게 시작해요."
    >
      <View style={styles.buttons}>
        {PROVIDERS.map((p) => (
          <PrimaryButton
            key={p.key}
            label={p.label}
            onPress={() => handlePress(p.key)}
            loading={pendingProvider === p.key || (submitting && !!session)}
            disabled={
              !canProceed ||
              (pendingProvider !== null && pendingProvider !== p.key) ||
              (submitting && !!session)
            }
          />
        ))}
      </View>

      {!canProceed && (
        <Text style={styles.gateNotice}>필수 항목에 모두 동의하면 버튼이 활성화돼요.</Text>
      )}

      <ConsentChecklist value={consent} onChange={setConsent} ageEligible={ageEligible} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  buttons: { gap: 12 },
  gateNotice: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
})
