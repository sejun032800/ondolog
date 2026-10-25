/**
 * A04~A06 MBTI - 알아요(네 글자 고르기) / 몰라요(간이 4문항). 디자인 `N-S-A1-Onboarding`.
 *
 * MASTER 9-1 화면 3: 어느 길이든 **네 글자 하나로 모인다**(`sessionStore.mbti`). 저장은 메모리뿐이다.
 * 간이 4문항의 글은 MASTER 9-1 화면 3 표의 초안 원문 그대로, A/B -> 글자 매핑은 `quickMbti.ts`(스토어가 쓴다).
 * 한 화면 라우트 안에서 세 모드(choose · known · unknown)를 오간다 - ←는 모드를 한 단계씩 되돌린다.
 */
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ChoiceCard } from '../../src/components/onboarding/ChoiceCard'
import { OnboardingScreen, StepBars, StepCounter } from '../../src/components/onboarding/OnboardingScreen'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { PressScale } from '../../src/components/nocturne/PressScale'
import type { QuickMbtiChoice } from '../../src/constants/quickMbti'
import type { MbtiType } from '../../src/constants/quizTypes'
import { useSessionStore } from '../../src/store/sessionStore'
import { fontFamily, nocturne, shape, type } from '../../src/theme/nocturne'

type Mode = 'choose' | 'known' | 'unknown'
type Axis = 'ei' | 'sn' | 'ft' | 'jp'

const MBTI_AXES: Array<{
  key: Axis
  left: { letter: string; name: string }
  right: { letter: string; name: string }
}> = [
  { key: 'ei', left: { letter: 'E', name: '외향' }, right: { letter: 'I', name: '내향' } },
  { key: 'sn', left: { letter: 'S', name: '감각' }, right: { letter: 'N', name: '직관' } },
  { key: 'ft', left: { letter: 'F', name: '감정' }, right: { letter: 'T', name: '사고' } },
  { key: 'jp', left: { letter: 'J', name: '판단' }, right: { letter: 'P', name: '인식' } },
]

/** MASTER 9-1 화면 3 "간이 4문항(초안)" 원문. */
const QUICK_QUESTIONS: Array<{ axis: Axis; kicker: string; prompt: string; a: string; b: string }> = [
  {
    axis: 'ei',
    kicker: 'E · I',
    prompt: '친구들과의 모임에서 나는?',
    a: '여러 사람과 어울리며 에너지를 얻는다',
    b: '소수와 깊게 대화할 때 더 편하다',
  },
  {
    axis: 'sn',
    kicker: 'S · N',
    prompt: '새로운 걸 배울 때 나는?',
    a: '구체적인 사실과 경험을 먼저 확인한다',
    b: '전체 흐름과 가능성을 먼저 상상한다',
  },
  {
    axis: 'ft',
    kicker: 'F · T',
    prompt: '결정을 내릴 때 나는?',
    a: '사람들의 감정과 관계를 먼저 고려한다',
    b: '논리와 원칙을 먼저 고려한다',
  },
  {
    axis: 'jp',
    kicker: 'J · P',
    prompt: '계획을 세울 때 나는?',
    a: '미리 정해두고 그대로 진행하는 게 편하다',
    b: '상황에 따라 유연하게 바꾸는 게 편하다',
  },
]

function lettersFromMbti(mbti: MbtiType | null, selfReported: boolean): Partial<Record<Axis, string>> {
  if (!mbti || !selfReported) return {}
  return { ei: mbti[0], sn: mbti[1], ft: mbti[2], jp: mbti[3] }
}

export default function MbtiScreen() {
  const router = useRouter()
  const mbtiKnown = useSessionStore((s) => s.mbtiKnown)
  const setMbtiKnown = useSessionStore((s) => s.setMbtiKnown)
  const storeMbti = useSessionStore((s) => s.mbti)
  const selfReported = useSessionStore((s) => s.mbtiSelfReported)
  const setMbtiSelfReported = useSessionStore((s) => s.setMbtiSelfReported)
  const quickAnswers = useSessionStore((s) => s.quickMbtiAnswers)
  const setQuickMbtiAnswer = useSessionStore((s) => s.setQuickMbtiAnswer)

  const [mode, setMode] = useState<Mode>('choose')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [letters, setLetters] = useState<Partial<Record<Axis, string>>>(() => lettersFromMbti(storeMbti, selfReported))

  const goNext = () => router.push('/love-quiz')

  if (mode === 'choose') {
    return (
      <OnboardingScreen
        onBack={() => router.back()}
        headerRight={<StepBars current={2} />}
        title={'MBTI를\n알고 있나요?'}
        footer={
          <PrimaryButton
            label="다음"
            disabled={mbtiKnown === null}
            onPress={() => setMode(mbtiKnown ? 'known' : 'unknown')}
            testID="mbti-choose-next"
          />
        }
      >
        <View style={styles.cards}>
          <ChoiceCard
            label="알아요"
            sub="네 글자를 직접 고를게요"
            selected={mbtiKnown === true}
            onPress={() => setMbtiKnown(true)}
            testID="mbti-known"
          />
          <ChoiceCard
            label="몰라요"
            sub="네 가지만 물어볼게요"
            selected={mbtiKnown === false}
            onPress={() => setMbtiKnown(false)}
            testID="mbti-unknown"
          />
        </View>
      </OnboardingScreen>
    )
  }

  if (mode === 'known') {
    const code = MBTI_AXES.map((ax) => letters[ax.key] ?? '').join('')
    const complete = code.length === 4
    return (
      <OnboardingScreen
        onBack={() => setMode('choose')}
        headerRight={<StepBars current={2} />}
        title="네 글자를 골라주세요"
        footer={
          <PrimaryButton
            label="다음"
            disabled={!complete}
            onPress={() => {
              setMbtiSelfReported(code as MbtiType)
              goNext()
            }}
            testID="mbti-known-next"
          />
        }
      >
        <Text style={styles.preview} accessibilityLabel={complete ? `선택한 MBTI ${code}` : 'MBTI를 고르는 중'} testID="mbti-preview">
          {MBTI_AXES.map((ax) => letters[ax.key] ?? '·').join('')}
        </Text>
        <View style={styles.grid}>
          {MBTI_AXES.map((ax) => (
            <View key={ax.key} style={styles.gridRow}>
              {[ax.left, ax.right].map((opt) => {
                const selected = letters[ax.key] === opt.letter
                return (
                  <PressScale
                    key={opt.letter}
                    onPress={() => setLetters((prev) => ({ ...prev, [ax.key]: opt.letter }))}
                    accessibilityRole="radio"
                    accessibilityLabel={`${opt.letter} ${opt.name}`}
                    accessibilityState={{ selected }}
                    testID={`mbti-letter-${opt.letter}`}
                    style={[styles.letter, selected ? styles.letterOn : styles.letterOff]}
                  >
                    <Text style={[styles.letterLabel, selected ? styles.letterLabelOn : styles.letterLabelOff]}>
                      {opt.letter} {opt.name}
                    </Text>
                  </PressScale>
                )
              })}
            </View>
          ))}
        </View>
      </OnboardingScreen>
    )
  }

  // mode === 'unknown' - 문항 하나씩. 고르면 다음 문항으로, 마지막은 네 글자로 모여 다음 화면으로.
  const q = QUICK_QUESTIONS[questionIndex]
  const picked = quickAnswers[q.axis]
  const choose = (choice: QuickMbtiChoice) => {
    setQuickMbtiAnswer(q.axis, choice)
    if (questionIndex < QUICK_QUESTIONS.length - 1) {
      setQuestionIndex(questionIndex + 1)
    } else {
      goNext()
    }
  }

  return (
    <OnboardingScreen
      onBack={() => (questionIndex > 0 ? setQuestionIndex(questionIndex - 1) : setMode('choose'))}
      headerRight={<StepCounter current={questionIndex + 1} total={QUICK_QUESTIONS.length} />}
      footer={<Text style={styles.footnote}>하나를 고르면 다음 질문으로 넘어가요</Text>}
    >
      <Text style={styles.kicker}>{q.kicker}</Text>
      <Text style={styles.question} testID="quick-question">{q.prompt}</Text>
      <View style={styles.cards}>
        <ChoiceCard label={q.a} selected={picked === 'A'} onPress={() => choose('A')} testID="quick-a" />
        <ChoiceCard label={q.b} selected={picked === 'B'} onPress={() => choose('B')} testID="quick-b" />
      </View>
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  cards: { marginTop: 36, gap: 12 },
  preview: {
    fontFamily: fontFamily.regular,
    fontSize: 46,
    lineHeight: 56,
    letterSpacing: 14,
    textAlign: 'center',
    color: nocturne.text,
    marginTop: 32,
  },
  grid: { marginTop: 28, gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  letter: { flex: 1, height: 50, borderRadius: shape.radius.button, alignItems: 'center', justifyContent: 'center' },
  letterOn: { backgroundColor: nocturne.text },
  letterOff: { backgroundColor: nocturne.inkRaise, borderWidth: 1, borderColor: nocturne.hairline },
  letterLabel: { fontSize: 15.5 },
  letterLabelOn: { fontFamily: fontFamily.semiBold, color: nocturne.ink },
  letterLabelOff: { fontFamily: fontFamily.medium, color: nocturne.textSub },
  kicker: { ...type.kicker, color: nocturne.textMute, marginTop: 4 },
  question: { ...type.display, color: nocturne.text, marginTop: 20 },
  footnote: { ...type.sub, color: nocturne.textMute, textAlign: 'center' },
})
