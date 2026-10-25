/**
 * A10 약관 동의 - 동의가 로그인 앞이다(MASTER 6-1, R24-4). 디자인 `N-S-A2-Onboarding`.
 *
 * 다섯 항목(MASTER 6-2): ① 만 14세 이상(생년월일로 자동 판정 - 사람이 체크하지 않는다, KST 날짜·생일 당일이면 만 14세)
 * ② 이용약관 ③ 개인정보 처리방침 ④ AI 콘텐츠 생성을 위한 데이터 활용(셋 다 필수) ⑤ 마케팅 수신(선택).
 * 문서가 있는 ②~⑤에는 [보기]가 있다(A12, 6-3). [동의하고 시작하기]는 필수가 전부 체크됐을 때만 켜진다 - 판단은 순수 함수 `canAgree`.
 *
 * 이 화면은 **로그인 전에는 서버를 부르지 않는다**. 체크 상태는 `sessionStore.consent`(메모리)에 두고, 로그인(A11)이 이어받는다.
 * 이미 로그인한 채 여기 온 길(A02 "이미 계정이 있어요"로 로그인했는데 `profiles`가 없어 A03부터 다시 온 경우, R38-3)에서는 A11을 건너뛴다:
 * [동의하고 시작하기]가 바로 가입 마무리(`useSignupFinalize`, `auto: false`)를 시작한다.
 * 만 14세 미만이면 이 화면 대신 A13으로 간다(가입 차단). 생년월일이 없으면(앞 화면 답이 사라짐) 처음 입력으로 돌려보낸다.
 */
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ConsentRow } from '../../src/components/onboarding/ConsentRow'
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { SoftCard } from '../../src/components/nocturne/GlassCard'
import { AI_USAGE_HELPER } from '../../src/constants/consent'
import { useSession } from '../../src/hooks/useSession'
import { useSignupFinalize } from '../../src/hooks/useSignupFinalize'
import { useSessionStore } from '../../src/store/sessionStore'
import { nocturne, type } from '../../src/theme/nocturne'
import {
  canAgree,
  isAgeEligible,
  isAllConsented,
  toggleAllConsent,
} from '../../src/utils/onboardingRules'
import type { LegalDocumentKey } from '../../src/constants/legalDocuments'

export default function ConsentScreen() {
  const router = useRouter()
  const { session } = useSession()
  const finalize = useSignupFinalize(session, (path) => router.replace(path as never), { auto: false })
  const birthDate = useSessionStore((s) => s.birthDate)
  const consent = useSessionStore((s) => s.consent)
  const setConsent = useSessionStore((s) => s.setConsent)

  const ageEligible = isAgeEligible(birthDate, new Date())
  const enabled = canAgree(consent, ageEligible)

  useEffect(() => {
    if (!birthDate) router.replace('/basic-info')
    else if (!ageEligible) router.replace('/underage')
  }, [birthDate, ageEligible, router])

  const view = (key: LegalDocumentKey) => router.push({ pathname: '/legal-document', params: { key } })
  const toggle = (key: 'terms' | 'privacy' | 'aiUsage' | 'marketing') => setConsent({ ...consent, [key]: !consent[key] })

  return (
    <OnboardingScreen
      onBack={() => router.back()}
      title={'시작하기 전에\n확인해주세요'}
      subtitle="동의한 다음 계정을 골라요"
      footer={
        <PrimaryButton
          label="동의하고 시작하기"
          disabled={!enabled || finalize.status === 'saving'}
          onPress={() => (session ? finalize.start() : router.push('/auth'))}
          testID="consent-proceed"
        />
      }
    >
      <SoftCard style={styles.card}>
        <ConsentRow
          label="전체 동의"
          strong
          checked={isAllConsented(consent)}
          onToggle={() => setConsent(toggleAllConsent(consent))}
          testID="consent-all"
        />
        <View style={styles.rule} />
        <ConsentRow label="만 14세 이상입니다" checked={ageEligible} trailingNote="생년월일로 확인함" testID="consent-age" />
        <View style={styles.rule} />
        <ConsentRow
          label="이용약관"
          tag="필수"
          checked={consent.terms}
          onToggle={() => toggle('terms')}
          onView={() => view('terms')}
          testID="consent-terms"
          viewTestID="consent-terms-view"
        />
        <View style={styles.rule} />
        <ConsentRow
          label="개인정보 처리방침"
          tag="필수"
          checked={consent.privacy}
          onToggle={() => toggle('privacy')}
          onView={() => view('privacy')}
          testID="consent-privacy"
          viewTestID="consent-privacy-view"
        />
        <View style={styles.rule} />
        <ConsentRow
          label="AI 콘텐츠 생성을 위한 데이터 활용"
          tag="필수"
          helper={AI_USAGE_HELPER}
          checked={consent.aiUsage}
          onToggle={() => toggle('aiUsage')}
          onView={() => view('aiUsage')}
          testID="consent-ai"
          viewTestID="consent-ai-view"
        />
        <View style={styles.rule} />
        <ConsentRow
          label="마케팅 정보 수신"
          tag="선택"
          checked={consent.marketing}
          onToggle={() => toggle('marketing')}
          onView={() => view('marketing')}
          testID="consent-marketing"
          viewTestID="consent-marketing-view"
        />
      </SoftCard>
      {finalize.status === 'failed' ? (
        <Text style={styles.error} testID="consent-save-error">
          저장하지 못했어요. 다시 시도해주세요.
        </Text>
      ) : null}
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: 32, paddingVertical: 8, paddingHorizontal: 20 },
  rule: { height: 1, backgroundColor: nocturne.hairline },
  error: { ...type.sub, color: nocturne.rose, textAlign: 'center', marginTop: 16 },
})
