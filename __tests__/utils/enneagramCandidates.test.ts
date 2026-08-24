import { getEnneagramCandidates } from '../../src/utils/enneagramCandidates'
import { HORNEVIAN_HARMONIC_TABLE } from '../../src/constants/enneagram'
import type { QuizChoice } from '../../src/constants/quizTypes'

const Q1_CHOICES: QuizChoice[] = ['A', 'B', 'C']

describe('getEnneagramCandidates — 화면 7 "후보 2개" 파생(Part 10-1-2 Q1/Q2)', () => {
  it('항상 정확히 2개를 반환한다(호나이 그룹은 3개, 확정값 1개 제외)', () => {
    for (const q1 of Q1_CHOICES) {
      const group = Object.values(HORNEVIAN_HARMONIC_TABLE[q1])
      for (const confirmed of group) {
        expect(getEnneagramCandidates(q1, confirmed)).toHaveLength(2)
      }
    }
  })

  it('확정된 코어 자신은 후보에 포함하지 않는다', () => {
    for (const q1 of Q1_CHOICES) {
      const group = Object.values(HORNEVIAN_HARMONIC_TABLE[q1])
      for (const confirmed of group) {
        expect(getEnneagramCandidates(q1, confirmed)).not.toContain(confirmed)
      }
    }
  })

  it('후보는 항상 같은 호나이 그룹(Q1) 소속이다', () => {
    for (const q1 of Q1_CHOICES) {
      const group = Object.values(HORNEVIAN_HARMONIC_TABLE[q1])
      const confirmed = group[0]
      const candidates = getEnneagramCandidates(q1, confirmed)
      for (const c of candidates) {
        expect(group).toContain(c)
      }
    }
  })

  it('동일 입력 100회 반복 실행 → 항상 동일 결과(결정론)', () => {
    const results = Array.from({ length: 100 }, () => getEnneagramCandidates('A', 3))
    for (const r of results) {
      expect(r).toEqual(results[0])
    }
  })
})
