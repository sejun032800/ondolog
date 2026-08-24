/**
 * 화면 4. 연애유형 5문항.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 4 — "Part 10 전체 참조.
 * MBTI 유형별로 5문항이 다르게 제시된다." 문항 원문은
 * `src/data/onboardingQuestions.ts`(Part 10-3 원문 그대로, 요약·의역 없음).
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton } from '../../src/components/PrimaryButton'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { COLORS } from '../../src/constants/theme'
import { ONBOARDING_QUESTIONS } from '../../src/data/onboardingQuestions'
import type { QuizChoice } from '../../src/constants/quizTypes'
import { useSessionStore } from '../../src/store/sessionStore'

export default function LoveQuizScreen() {
  const router = useRouter()
  const mbti = useSessionStore((s) => s.mbti)
  const q1 = useSessionStore((s) => s.q1)
  const q2 = useSessionStore((s) => s.q2)
  const q3 = useSessionStore((s) => s.q3)
  const q4 = useSessionStore((s) => s.q4)
  const q5 = useSessionStore((s) => s.q5)
  const setQuizAnswer = useSessionStore((s) => s.setQuizAnswer)
  const computeResult = useSessionStore((s) => s.computeResult)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!mbti) router.replace('/mbti')
  }, [mbti, router])

  if (!mbti) return null

  const questions = ONBOARDING_QUESTIONS[mbti]
  const question = questions[index]
  const answers: Record<number, QuizChoice | null> = { 1: q1, 2: q2, 3: q3, 4: q4, 5: q5 }
  const selected = answers[question.q]
  const isLast = index === questions.length - 1

  const handleSelect = (choice: QuizChoice) => {
    setQuizAnswer(question.q, choice)

    if (isLast) return

    setIndex((i) => Math.min(i + 1, questions.length - 1))
  }

  const allAnswered = [1, 2, 3, 4, 5].every((q) => answers[q] !== null)

  return (
    <ScreenContainer
      title={`${index + 1} / ${questions.length}`}
      footer={
        isLast ? (
          <PrimaryButton
            label="결과 보기"
            disabled={!allAnswered}
            onPress={() => {
              computeResult()
              router.push('/result-brief')
            }}
          />
        ) : undefined
      }
    >
      <Text style={styles.prompt}>{question.prompt}</Text>
      <View style={styles.options}>
        {question.options.map((opt) => (
          <Pressable
            key={opt.choice}
            onPress={() => handleSelect(opt.choice)}
            style={[styles.option, selected === opt.choice && styles.optionSelected]}
          >
            <Text
              style={[
                styles.optionText,
                selected === opt.choice && styles.optionTextSelected,
              ]}
            >
              {opt.text}
            </Text>
          </Pressable>
        ))}
      </View>
      {index > 0 && (
        <Pressable onPress={() => setIndex((i) => Math.max(0, i - 1))}>
          <Text style={styles.backLink}>이전 질문</Text>
        </Pressable>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  prompt: { color: COLORS.text, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  options: { gap: 10 },
  option: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  optionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { color: COLORS.text, fontSize: 15, lineHeight: 21 },
  optionTextSelected: { color: COLORS.primaryText },
  backLink: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
})
