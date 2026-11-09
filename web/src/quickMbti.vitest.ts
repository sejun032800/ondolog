import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '@/store/sessionStore'
import { QUICK_MBTI_AXIS_MAP } from '@/constants/quickMbti'
import { QUICK_QUESTIONS } from './quickMbtiQuestions'

beforeEach(() => useSessionStore.getState().resetSession())

/** 문항의 kicker("E · I")에서 읽은 글자: A = 앞, B = 뒤. 정본 표와 따로 얻은 값이다. */
function letterOf(kicker: string, choice: 'A' | 'B'): string {
  const [first, second] = kicker.split(' · ')
  return choice === 'A' ? first : second
}

describe('B8 간이 MBTI 4문항 - 문항 · 선택지 -> 글자', () => {
  it('문항은 네 개이고 축 순서는 E/I, S/N, F/T, J/P다', () => {
    expect(QUICK_QUESTIONS.map((q) => q.axis)).toEqual(['ei', 'sn', 'ft', 'jp'])
    expect(QUICK_QUESTIONS.map((q) => q.kicker)).toEqual(['E · I', 'S · N', 'F · T', 'J · P'])
  })

  it('화면의 선택지 글자 대응이 정본 QUICK_MBTI_AXIS_MAP과 같다', () => {
    for (const q of QUICK_QUESTIONS) {
      expect(QUICK_MBTI_AXIS_MAP[q.axis].A).toBe(letterOf(q.kicker, 'A'))
      expect(QUICK_MBTI_AXIS_MAP[q.axis].B).toBe(letterOf(q.kicker, 'B'))
    }
  })

  it('16조합 전수: 같은 답이면 같은 MBTI이고, 16개가 모두 다르다', () => {
    const seen = new Set<string>()
    for (let bits = 0; bits < 16; bits++) {
      const choices = QUICK_QUESTIONS.map((_, i) => ((bits >> (3 - i)) & 1 ? 'B' : 'A') as 'A' | 'B')
      const expected = QUICK_QUESTIONS.map((q, i) => letterOf(q.kicker, choices[i])).join('')
      useSessionStore.getState().resetSession()
      QUICK_QUESTIONS.forEach((q, i) => useSessionStore.getState().setQuickMbtiAnswer(q.axis, choices[i]))
      expect(useSessionStore.getState().mbti).toBe(expected)
      // 같은 입력을 한 번 더 -> 같은 출력(결정론)
      useSessionStore.getState().resetSession()
      QUICK_QUESTIONS.forEach((q, i) => useSessionStore.getState().setQuickMbtiAnswer(q.axis, choices[i]))
      expect(useSessionStore.getState().mbti).toBe(expected)
      seen.add(expected)
    }
    expect(seen.size).toBe(16)
  })
})
