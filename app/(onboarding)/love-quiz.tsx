/**
 * A07 연애유형 5문항. 디자인 `N-S-A2-Onboarding`.
 *
 * 문항 원문은 `src/data/onboardingQuestions.ts`(MASTER 10-3 원문 그대로), 채점은 `sessionStore.computeResult`가 부르는
 * 기존 엔진(`inferLoveType`, 결정론) 그대로다 - 이 화면은 엔진을 바꾸지 않는다. 저장은 메모리뿐이다.
 * 하나를 고르면 다음 문항으로, 마지막 문항을 고르면 채점해 결과(A08)로 간다. **재검사(`?retest=1`, `67-`)**에서는 A08 대신 바로 저장한다
 * (`useRetestFinalize` - 새 assessment 행 + 한 번의 UPDATE) - 성공하면 설정 > 성격 프로필(H05)로, 실패하면 이 화면에서 글자로 알리고 다시 시도하게 한다. ←는 이전 문항(첫 문항에서는 앞 화면).
 * 진행 선은 정지 상태로 그린다(채움 애니메이션 금지).
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ChoiceCard } from '../../src/components/onboarding/ChoiceCard'
import { OnboardingScreen, StepCounter } from '../../src/components/onboarding/OnboardingScreen'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import type { QuizChoice } from '../../src/constants/quizTypes'
import { ONBOARDING_QUESTIONS } from '../../src/data/onboardingQuestions'
import { useRetestFinalize } from '../../src/hooks/useRetestFinalize'
import { useSession } from '../../src/hooks/useSession'
import { useSessionStore } from '../../src/store/sessionStore'
import { nocturne, type, withAlpha } from '../../src/theme/nocturne'

export default function LoveQuizScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ retest?: string }>()
  const retest = params?.retest === '1'
  const { session } = useSession()
  const finalize = useRetestFinalize()
  const mbti = useSessionStore((s) => s.mbti)
  const q1 = useSessionStore((s) => s.q1)
  const q2 = useSessionStore((s) => s.q2)
  const q3 = useSessionStore((s) => s.q3)
  const q4 = useSessionStore((s) => s.q4)
  const q5 = useSessionStore((s) => s.q5)
  const setQuizAnswer = useSessionStore((s) => s.setQuizAnswer)
  const computeResult = useSessionStore((s) => s.computeResult)
  const [index, setIndex] = useState(0)
  const [recoveredNotice, setRecoveredNotice] = useState(false)
  /** 재검사 저장 중 - 성공하면 메모리 답이 비워지는데, 그것을 "처음부터"로 오해해 되돌리지 않는다. */
  const savingRef = useRef(false)

  useEffect(() => {
    if (!mbti && !recoveredNotice && !savingRef.current) router.replace((retest ? '/mbti?retest=1' : '/mbti') as never)
  }, [mbti, router, retest, recoveredNotice])

  const goBackToPersonality = () => router.dismissTo('/settings-personality' as never)

  if (retest && recoveredNotice) {
    return (
      <OnboardingScreen
        title={'이전에 하던 재검사를 마저 저장했어요'}
        footer={<PrimaryButton label="확인" onPress={goBackToPersonality} testID="retest-recovered-ok" />}
      >
        <Text style={styles.recoveredNote} testID="retest-recovered-note">
          방금 답한 내용과 저장된 결과가 다를 수 있어요. 성격 프로필에서 확인해주세요.
        </Text>
      </OnboardingScreen>
    )
  }

  if (!mbti) return null

  const questions = ONBOARDING_QUESTIONS[mbti]
  const question = questions[index]
  const answers: Record<number, QuizChoice | null> = { 1: q1, 2: q2, 3: q3, 4: q4, 5: q5 }
  const selected = answers[question.q]
  const isLast = index === questions.length - 1

  const handleSelect = (choice: QuizChoice) => {
    setQuizAnswer(question.q, choice)
    if (!isLast) {
      setIndex(index + 1)
      return
    }
    // 마지막 문항 - 스토어에 방금 고른 답이 들어간 뒤 채점한다(모두 채워졌을 때만 결과가 생긴다).
    if (!computeResult()) return
    if (retest) void saveRetest()
    else router.push('/result-brief')
  }

  const saveRetest = async () => {
    const userId = session?.user.id
    if (!userId) return
    // 복구된 경우(끊겼던 재검사를 서버가 마저 끝냄)에는 알림 화면을 먼저 보인다 - 저장된 결과가 방금 답한 것과 다를 수 있다.
    savingRef.current = true
    const done = await finalize.run(userId)
    if (!done) savingRef.current = false
    if (done === 'recovered') setRecoveredNotice(true)
    else if (done) goBackToPersonality()
  }

  if (retest && (finalize.phase === 'saving' || finalize.phase === 'error')) {
    const saving = finalize.phase === 'saving'
    return (
      <OnboardingScreen
        title={saving ? '결과를 저장하고 있어요' : (finalize.errorMessage ?? '저장하지 못했어요. 다시 시도해주세요.')}
        footer={
          saving ? undefined : finalize.retryable ? (
            <PrimaryButton label="다시 시도" onPress={saveRetest} testID="retest-retry" />
          ) : (
            <PrimaryButton label="돌아가기" onPress={goBackToPersonality} testID="retest-back" />
          )
        }
      />
    )
  }

  return (
    <OnboardingScreen
      onBack={() => (index > 0 ? setIndex(index - 1) : router.back())}
      headerRight={<StepCounter current={index + 1} total={questions.length} />}
      belowHeader={
        <View
          style={styles.track}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: questions.length, now: index + 1 }}
        >
          <View style={[styles.fill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
        </View>
      }
      footer={<Text style={styles.footnote}>정답은 없어요. 가장 가까운 쪽을 골라주세요</Text>}
    >
      <Text style={styles.prompt} testID="quiz-prompt">{question.prompt}</Text>
      <View style={styles.cards}>
        {question.options.map((opt) => (
          <ChoiceCard
            key={opt.choice}
            letter={opt.choice}
            label={opt.text}
            selected={selected === opt.choice}
            onPress={() => handleSelect(opt.choice)}
            testID={`quiz-option-${opt.choice}`}
          />
        ))}
      </View>
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  track: { height: 2, borderRadius: 2, backgroundColor: withAlpha(nocturne.text, 0.1) },
  fill: { height: 2, borderRadius: 2, backgroundColor: nocturne.text },
  prompt: { ...type.display, color: nocturne.text, marginTop: 8 },
  cards: { marginTop: 32, gap: 12 },
  recoveredNote: { ...type.body, color: nocturne.textSub },
  footnote: { ...type.sub, color: nocturne.textMute, textAlign: 'center' },
})
