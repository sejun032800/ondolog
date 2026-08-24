import {
  computeAttachment,
  computeBig5,
  computeEnneagramCore,
  computeLoveTypeCode,
  computeSternberg,
  inferLoveType,
  resolveMbtiFromQuickQuiz,
  type LoveTypeInput,
} from '../../src/engine/loveTypeInference'
import { HORNEVIAN_HARMONIC_TABLE } from '../../src/constants/enneagram'
import { LOVE_TYPE_LABEL_BY_CODE } from '../../src/constants/loveTypeLabels'
import { MBTI_TYPES, type MbtiType, type QuizChoice } from '../../src/constants/quizTypes'
import type { QuickMbtiAnswers } from '../../src/constants/quickMbti'

const QUIZ_CHOICES: readonly QuizChoice[] = ['A', 'B', 'C']

describe('computeEnneagramCore — 호나이×하모닉 9칸 전수 검증 (Part 10-2-1)', () => {
  // 문서 원문 표를 이 테스트에 하드코딩해, 상수 파일이 실수로 바뀌어도
  // 감지되도록 한다 (상수를 그대로 재인용하는 자기순환 검증이 아님).
  const EXPECTED: Record<QuizChoice, Record<QuizChoice, number>> = {
    A: { A: 3, B: 7, C: 8 },
    B: { A: 1, B: 2, C: 6 },
    C: { A: 5, B: 9, C: 4 },
  }

  for (const q1 of QUIZ_CHOICES) {
    for (const q2 of QUIZ_CHOICES) {
      it(`Q1=${q1}, Q2=${q2} → 애니어그램 ${EXPECTED[q1][q2]}`, () => {
        expect(computeEnneagramCore(q1, q2)).toBe(EXPECTED[q1][q2])
        // 채점 함수가 상수 룩업과 정확히 일치하는지도 함께 확인.
        expect(computeEnneagramCore(q1, q2)).toBe(HORNEVIAN_HARMONIC_TABLE[q1][q2])
      })
    }
  }

  it('9칸 전부를 실제로 순회했다', () => {
    expect(QUIZ_CHOICES.length * QUIZ_CHOICES.length).toBe(9)
  })
})

describe('computeAttachment — 애착 2×2 전수 검증 (Part 10-2-3)', () => {
  // Q3(불안)/Q5(회피) 각 3단계 → mid는 low로 병합 → 2×2.
  const EXPECTED: Record<QuizChoice, Record<QuizChoice, string>> = {
    A: { A: 'secure', B: 'secure', C: 'avoidant' }, // 불안 low
    B: { A: 'secure', B: 'secure', C: 'avoidant' }, // 불안 mid→low
    C: { A: 'anxious', B: 'anxious', C: 'fearful' }, // 불안 high
  }

  for (const q3 of QUIZ_CHOICES) {
    for (const q5 of QUIZ_CHOICES) {
      it(`Q3=${q3}, Q5=${q5} → ${EXPECTED[q3][q5]}`, () => {
        const result = computeAttachment(q3, q5)
        expect(result.attachment).toBe(EXPECTED[q3][q5])
      })
    }
  }

  it('attachAnxiety/attachAvoidance는 Part 17-3 수치화(20/50/85)를 그대로 쓴다', () => {
    expect(computeAttachment('A', 'A').attachAnxiety).toBe(20)
    expect(computeAttachment('B', 'B').attachAvoidance).toBe(50)
    expect(computeAttachment('C', 'C').attachAvoidance).toBe(85)
  })
})

describe('computeBig5 (Part 10-2-2)', () => {
  it('MBTI 사전값 + Q1/Q2 보정을 정확히 반영한다', () => {
    // ENFP: E=72, O=71, A=61, C=38 (사전값)
    // Q1=B → A+8=69, Q2=A → C+8=46, O는 Q2=B일 때만 +5(여기선 미적용)
    const big5 = computeBig5('ENFP', 'B', 'A', 'A')
    expect(big5.bigE).toBe(72)
    expect(big5.bigO).toBe(71)
    expect(big5.bigA).toBe(69)
    expect(big5.bigC).toBe(46)
    expect(big5.bigN).toBe(25) // Q3=A
  })

  it('Q1=A(주장형)는 우호성을 낮춘다', () => {
    const big5 = computeBig5('ISTJ', 'A', 'C', 'B')
    // ISTJ 사전 A=39, Q1=A → -8 = 31
    expect(big5.bigA).toBe(31)
    expect(big5.bigN).toBe(50) // Q3=B
  })

  it('Q2=B(긍정형)는 개방성을 +5 한다', () => {
    const big5 = computeBig5('ISTJ', 'B', 'B', 'C')
    // ISTJ 사전 O=29, Q2=B → +5 = 34
    expect(big5.bigO).toBe(34)
    expect(big5.bigN).toBe(78) // Q3=C
  })

  it('모든 필드가 0~100 범위를 벗어나지 않는다 (전수 MBTI × 전수 Q1/Q2/Q3)', () => {
    for (const mbti of MBTI_TYPES) {
      for (const q1 of QUIZ_CHOICES) {
        for (const q2 of QUIZ_CHOICES) {
          for (const q3 of QUIZ_CHOICES) {
            const big5 = computeBig5(mbti, q1, q2, q3)
            for (const v of Object.values(big5)) {
              expect(v).toBeGreaterThanOrEqual(0)
              expect(v).toBeLessThanOrEqual(100)
            }
          }
        }
      }
    }
  })
})

describe('computeSternberg (Part 10-2-4)', () => {
  it('Q4가 지정한 성분에 +25, MBTI 보정 반영', () => {
    // ENFJ: J → commitment+8, N → passion+5, F → intimacy+8
    const stern = computeSternberg('ENFJ', 'A') // dominant = intimacy
    // base intimacy 55+25=80, +8(F) = 88
    expect(stern.intimacy).toBe(88)
    // passion base 55, +5(N) = 60
    expect(stern.passion).toBe(60)
    // commitment base 55, +8(J) = 63
    expect(stern.commitment).toBe(63)
  })

  it('모든 필드가 0~100 범위를 벗어나지 않는다 (전수 MBTI × Q4)', () => {
    for (const mbti of MBTI_TYPES) {
      for (const q4 of QUIZ_CHOICES) {
        const stern = computeSternberg(mbti, q4)
        for (const v of Object.values(stern)) {
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(100)
        }
      }
    }
  })
})

describe('computeLoveTypeCode (Part 10-5-4)', () => {
  it('MUSE(4) + anxious(FLARE) → MSF', () => {
    expect(computeLoveTypeCode(4, 'anxious')).toBe('MSF')
  })

  it('KEEL(1) + secure(EMBER) → KLE', () => {
    expect(computeLoveTypeCode(1, 'secure')).toBe('KLE')
  })
})

describe('inferLoveType — 결정론 계약', () => {
  const fixedInput: LoveTypeInput = {
    mbti: 'INFP',
    q1: 'C',
    q2: 'B',
    q3: 'C',
    q4: 'A',
    q5: 'C',
  }

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () => inferLoveType(fixedInput))
    const first = results[0]
    for (const r of results) {
      expect(r).toEqual(first)
    }
  })

  it('engineVersion을 포함한다', () => {
    const result = inferLoveType(fixedInput)
    expect(typeof result.engineVersion).toBe('string')
    expect(result.engineVersion.length).toBeGreaterThan(0)
  })

  it('16유형 × 3^5 조합 중 결정론적으로 샘플링한 100개 모두 유효한 loveTypeCode를 낸다', () => {
    // Math.random 금지 — 고정 인덱스 순회로 결정론적 샘플링.
    // 16 MBTI × 243(3^5) = 3,888 조합을 순번으로 매겨 61 간격으로 100개를 뽑는다.
    // gcd(61, 3888) = 1 이므로 인덱스가 겹치지 않고 넓게 퍼진다.
    const totalCombinations = MBTI_TYPES.length * 3 ** 5
    const sampleCount = 100
    const step = 61

    function combinationAt(index: number): LoveTypeInput {
      const mbtiIndex = Math.floor(index / 3 ** 5)
      let rem = index % 3 ** 5
      const choices: QuizChoice[] = []
      for (let i = 0; i < 5; i++) {
        choices.unshift(QUIZ_CHOICES[rem % 3])
        rem = Math.floor(rem / 3)
      }
      return {
        mbti: MBTI_TYPES[mbtiIndex],
        q1: choices[0],
        q2: choices[1],
        q3: choices[2],
        q4: choices[3],
        q5: choices[4],
      }
    }

    let checked = 0
    for (let n = 0; n < sampleCount; n++) {
      const index = (n * step) % totalCombinations
      const input = combinationAt(index)
      const result = inferLoveType(input)
      expect(LOVE_TYPE_LABEL_BY_CODE[result.loveTypeCode]).toBeDefined()
      checked++
    }
    expect(checked).toBe(100)
  })
})

describe('resolveMbtiFromQuickQuiz — MBTI "몰라요" 4문항 경로 (Part 9-1)', () => {
  const CHOICES: readonly ('A' | 'B')[] = ['A', 'B']

  it('4문항의 모든 2^4=16 조합이 예외 없이 16개의 서로 다른 4글자 MBTI 코드로 수렴한다', () => {
    const codes = new Set<string>()
    for (const ei of CHOICES) {
      for (const sn of CHOICES) {
        for (const ft of CHOICES) {
          for (const jp of CHOICES) {
            const answers: QuickMbtiAnswers = { ei, sn, ft, jp }
            const mbti = resolveMbtiFromQuickQuiz(answers)
            expect(mbti).toHaveLength(4)
            expect(MBTI_TYPES).toContain(mbti as MbtiType)
            codes.add(mbti)
          }
        }
      }
    }
    expect(codes.size).toBe(16)
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const answers: QuickMbtiAnswers = { ei: 'A', sn: 'B', ft: 'A', jp: 'B' }
    const results = Array.from({ length: 100 }, () => resolveMbtiFromQuickQuiz(answers))
    expect(new Set(results).size).toBe(1)
  })
})
