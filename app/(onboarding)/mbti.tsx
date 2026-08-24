/**
 * 화면 3. MBTI 입력.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 3 —
 *   분기: "MBTI 알아요" → 4글자 선택 / "몰라요" → 4문항 간이 질문
 *   간이 질문: 지표당 1문항, 총 4문항 이지선다(E/I, S/N, F/T, J/P)
 *   수렴: "몰라요" 경로도 반드시 4글자 코드 하나로 수렴
 *   저장: 메모리
 *
 * 간이 4문항 문항 워딩은 마스터 문서에 "초안 — 워딩 다듬기 예정"으로
 * 명시된 원문을 그대로 쓴다(다른 워딩이 없어 지어내지 않기 위함).
 * A/B → MBTI 글자 매핑 자체는 `src/constants/quickMbti.ts`(확정 표)를
 * 그대로 쓴다.
 */
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton } from '../../src/components/PrimaryButton'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { SecondaryButton } from '../../src/components/SecondaryButton'
import { COLORS } from '../../src/constants/theme'
import { QUICK_MBTI_AXIS_MAP, type QuickMbtiChoice } from '../../src/constants/quickMbti'
import type { MbtiType } from '../../src/constants/quizTypes'
import { useSessionStore } from '../../src/store/sessionStore'

type Mode = 'choose' | 'known' | 'unknown'

const MBTI_AXES: Array<{
  key: 'ei' | 'sn' | 'ft' | 'jp'
  left: 'E' | 'S' | 'F' | 'J'
  right: 'I' | 'N' | 'T' | 'P'
}> = [
  { key: 'ei', left: 'E', right: 'I' },
  { key: 'sn', left: 'S', right: 'N' },
  { key: 'ft', left: 'F', right: 'T' },
  { key: 'jp', left: 'J', right: 'P' },
]

/** Part 9-1 화면 3 "간이 4문항(초안)" 원문. */
const QUICK_QUESTIONS: Array<{
  axis: 'ei' | 'sn' | 'ft' | 'jp'
  prompt: string
  a: string
  b: string
}> = [
  {
    axis: 'ei',
    prompt: '친구들과의 모임에서 나는?',
    a: '여러 사람과 어울리며 에너지를 얻는다',
    b: '소수와 깊게 대화할 때 더 편하다',
  },
  {
    axis: 'sn',
    prompt: '새로운 걸 배울 때 나는?',
    a: '구체적인 사실과 경험을 먼저 확인한다',
    b: '전체 흐름과 가능성을 먼저 상상한다',
  },
  {
    axis: 'ft',
    prompt: '결정을 내릴 때 나는?',
    a: '사람들의 감정과 관계를 먼저 고려한다',
    b: '논리와 원칙을 먼저 고려한다',
  },
  {
    axis: 'jp',
    prompt: '계획을 세울 때 나는?',
    a: '미리 정해두고 그대로 진행하는 게 편하다',
    b: '상황에 따라 유연하게 바꾸는 게 편하다',
  },
]

export default function MbtiScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const storeMbti = useSessionStore((s) => s.mbti)
  const setMbtiSelfReported = useSessionStore((s) => s.setMbtiSelfReported)
  const quickAnswers = useSessionStore((s) => s.quickMbtiAnswers)
  const setQuickMbtiAnswer = useSessionStore((s) => s.setQuickMbtiAnswer)
  const [knownLetters, setKnownLetters] = useState<Partial<Record<'ei' | 'sn' | 'ft' | 'jp', string>>>({})

  const goNext = () => router.push('/love-quiz')

  if (mode === 'choose') {
    return (
      <ScreenContainer title="MBTI를 알고 있나요?" subtitle="알고 있다면 바로 선택해주세요.">
        <View style={styles.choiceGap}>
          <PrimaryButton label="알아요" onPress={() => setMode('known')} />
          <SecondaryButton label="몰라요, 간단히 알려주세요" onPress={() => setMode('unknown')} />
        </View>
      </ScreenContainer>
    )
  }

  if (mode === 'known') {
    const code = MBTI_AXES.map((ax) => knownLetters[ax.key] ?? '').join('')
    const complete = code.length === 4

    return (
      <ScreenContainer
        title="MBTI 선택"
        subtitle="네 가지 지표를 골라주세요."
        footer={
          <PrimaryButton
            label="다음"
            disabled={!complete}
            onPress={() => {
              setMbtiSelfReported(code as MbtiType)
              goNext()
            }}
          />
        }
      >
        {MBTI_AXES.map((ax) => (
          <View key={ax.key} style={styles.axisRow}>
            {[ax.left, ax.right].map((letter) => (
              <Pressable
                key={letter}
                onPress={() =>
                  setKnownLetters((prev) => ({ ...prev, [ax.key]: letter }))
                }
                style={[
                  styles.letterButton,
                  knownLetters[ax.key] === letter && styles.letterButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.letterText,
                    knownLetters[ax.key] === letter && styles.letterTextSelected,
                  ]}
                >
                  {letter}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScreenContainer>
    )
  }

  // mode === 'unknown'
  const allAnswered =
    !!quickAnswers.ei && !!quickAnswers.sn && !!quickAnswers.ft && !!quickAnswers.jp

  return (
    <ScreenContainer
      title="몇 가지만 물어볼게요"
      subtitle="네 개의 질문으로 MBTI를 추정해요."
      footer={
        <PrimaryButton label="다음" disabled={!allAnswered || !storeMbti} onPress={goNext} />
      }
    >
      {QUICK_QUESTIONS.map((q) => {
        const selected = quickAnswers[q.axis]
        return (
          <View key={q.axis} style={styles.questionBlock}>
            <Text style={styles.questionPrompt}>{q.prompt}</Text>
            {(['A', 'B'] as QuickMbtiChoice[]).map((choice) => (
              <Pressable
                key={choice}
                onPress={() => setQuickMbtiAnswer(q.axis, choice)}
                style={[
                  styles.optionButton,
                  selected === choice && styles.optionButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected === choice && styles.optionTextSelected,
                  ]}
                >
                  {choice === 'A' ? q.a : q.b}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      })}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  choiceGap: { gap: 12 },
  axisRow: { flexDirection: 'row', gap: 12 },
  letterButton: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 18,
  },
  letterButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  letterText: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  letterTextSelected: { color: COLORS.primaryText },
  questionBlock: { gap: 8 },
  questionPrompt: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  optionButton: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  optionButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  optionTextSelected: { color: COLORS.primaryText },
})
