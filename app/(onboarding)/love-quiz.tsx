/**
 * 화면 4. 연애유형 5문항.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 4 — "Part 10 전체 참조.
 * MBTI 유형별로 5문항이 다르게 제시된다." 문항 원문은
 * `src/data/onboardingQuestions.ts`(Part 10-3 원문 그대로, 요약·의역 없음).
 *
 * docs/ONDOLOG_DESIGN.md §13-7 화면 4 — "진행 표시는 0 1 / 0 5(kicker-en).
 * 프로그레스 바 금지." `ScreenContainer`의 `title`(display, 큰 헤드라인)
 * 대신 진행 표시 전용의 작은 kicker-en 텍스트를 본문 최상단에 별도로
 * 그린다 — 문서가 명시한 배치를 그대로 따르기 위한 화면 4만의 예외.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Button } from '../../src/components/Button'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { useTheme } from '../../src/theme'
import { ONBOARDING_QUESTIONS } from '../../src/data/onboardingQuestions'
import type { QuizChoice } from '../../src/constants/quizTypes'
import { useSessionStore } from '../../src/store/sessionStore'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export default function LoveQuizScreen() {
  const router = useRouter()
  const { colors, typography, spacing, radius } = useTheme()
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
      footer={
        isLast ? (
          <Button
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
      <Text style={[typography.kickerEn, { color: colors.inkMute }]}>
        {pad2(index + 1).split('').join(' ')} / {pad2(questions.length).split('').join(' ')}
      </Text>

      <Text style={[typography.headline, { color: colors.inkFull, marginTop: spacing.s3 }]}>
        {question.prompt}
      </Text>

      <View style={{ gap: spacing.s3 }}>
        {question.options.map((opt) => {
          const isSelected = selected === opt.choice
          return (
            <Pressable
              key={opt.choice}
              onPress={() => handleSelect(opt.choice)}
              style={{
                backgroundColor: isSelected ? colors.inkFull : colors.paperAlt,
                borderColor: colors.rule,
                borderRadius: radius.touch,
                borderWidth: 1,
                padding: spacing.s4,
              }}
            >
              <Text style={[typography.bodySerif, { color: isSelected ? colors.paper : colors.inkFull }]}>
                {opt.text}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {index > 0 && (
        <Pressable onPress={() => setIndex((i) => Math.max(0, i - 1))} hitSlop={8}>
          <Text style={[typography.caption, { color: colors.inkMute, textAlign: 'center' }]}>
            이전 질문
          </Text>
        </Pressable>
      )}
    </ScreenContainer>
  )
}
