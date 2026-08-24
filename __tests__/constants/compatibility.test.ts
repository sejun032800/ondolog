import {
  COMPATIBILITY,
  COMPATIBILITY_FRAMING_TEXT,
} from '../../src/constants/compatibility'
import type { EnneagramCore } from '../../src/constants/enneagram'

const ALL_CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * Part 10-6-1: "best/worst"류 판정 표현을 절대 쓰지 않는다.
 * `best`/`contrast`는 코드 내부 필드명(타입 식별자)이라 검사 대상에서
 * 제외하고, 화면에 실제로 노출되는 reason/tip 문구만 검사한다.
 */
const FORBIDDEN_WORDS = ['최악', '안 맞음', '피하세요']

function allDisplayedText(): string {
  const parts: string[] = []
  for (const core of ALL_CORES) {
    for (const item of COMPATIBILITY[core].best) parts.push(item.reason)
    for (const item of COMPATIBILITY[core].contrast) {
      parts.push(item.reason, item.tip)
    }
  }
  return parts.join('\n')
}

describe('COMPATIBILITY — 애니어그램 코어 궁합 매트릭스 (Part 10-6)', () => {
  it('9개 코어 전부에 대해 정의돼 있다', () => {
    for (const core of ALL_CORES) {
      expect(COMPATIBILITY[core]).toBeDefined()
    }
  })

  it('각 코어는 온도가 잘 맞는 유형 3개를 갖는다(Part 10-6-5)', () => {
    for (const core of ALL_CORES) {
      expect(COMPATIBILITY[core].best).toHaveLength(3)
    }
  })

  it('각 코어는 온도차가 있는 유형 2개를 갖는다(Part 10-6-5)', () => {
    for (const core of ALL_CORES) {
      expect(COMPATIBILITY[core].contrast).toHaveLength(2)
    }
  })

  it('온도차(contrast) 관계는 상호적이다 — A의 contrast에 B가 있으면 B의 contrast에도 A가 있다(Part 10-6-3)', () => {
    for (const core of ALL_CORES) {
      for (const item of COMPATIBILITY[core].contrast) {
        const partnerContrastCores = COMPATIBILITY[item.core].contrast.map(
          (c) => c.core,
        )
        expect(partnerContrastCores).toContain(core)
      }
    }
  })

  it('온도차 9쌍이 정확히 순환 고리 1-8-7-3-2-5-9-4-6-1을 이룬다(Part 10-6-4)', () => {
    const expectedPairs: Array<[EnneagramCore, EnneagramCore]> = [
      [1, 8],
      [8, 7],
      [7, 3],
      [3, 2],
      [2, 5],
      [5, 9],
      [9, 4],
      [4, 6],
      [6, 1],
    ]

    const actualPairKeys = new Set<string>()
    for (const core of ALL_CORES) {
      for (const item of COMPATIBILITY[core].contrast) {
        const key = [core, item.core].sort((a, b) => a - b).join('-')
        actualPairKeys.add(key)
      }
    }

    const expectedPairKeys = new Set(
      expectedPairs.map(([a, b]) => [a, b].sort((x, y) => x - y).join('-')),
    )

    expect(actualPairKeys).toEqual(expectedPairKeys)
  })

  it('contrast의 모든 항목에 tip이 비어있지 않다(Part 10-6-7 구현 참고)', () => {
    for (const core of ALL_CORES) {
      for (const item of COMPATIBILITY[core].contrast) {
        expect(item.tip.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('contrast의 모든 항목에 reason이 비어있지 않다', () => {
    for (const core of ALL_CORES) {
      for (const item of COMPATIBILITY[core].contrast) {
        expect(item.reason.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('best의 모든 항목에 reason이 비어있지 않다', () => {
    for (const core of ALL_CORES) {
      for (const item of COMPATIBILITY[core].best) {
        expect(item.reason.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('best/worst 판정 표현("최악"/"안 맞음"/"피하세요" 등)을 쓰지 않는다(Part 10-6-1)', () => {
    const haystack = allDisplayedText()
    for (const word of FORBIDDEN_WORDS) {
      expect(haystack).not.toContain(word)
    }
  })

  it('best(잘 맞는 유형)는 자기 자신을 포함하지 않는다', () => {
    for (const core of ALL_CORES) {
      const bestCores = COMPATIBILITY[core].best.map((b) => b.core)
      expect(bestCores).not.toContain(core)
    }
  })

  it('contrast(온도차 유형)는 자기 자신을 포함하지 않는다', () => {
    for (const core of ALL_CORES) {
      const contrastCores = COMPATIBILITY[core].contrast.map((c) => c.core)
      expect(contrastCores).not.toContain(core)
    }
  })
})

describe('COMPATIBILITY_FRAMING_TEXT — 프레이밍 문구(Part 10-6-0)', () => {
  it('원문과 정확히 일치한다', () => {
    expect(COMPATIBILITY_FRAMING_TEXT).toBe(
      '온도차가 있다는 건 안 맞는다는 뜻이 아닙니다.\n조금 더 신경 쓰면 되는 지점이 있다는 뜻입니다.',
    )
  })

  it('best/worst 판정 표현을 포함하지 않는다', () => {
    for (const word of FORBIDDEN_WORDS) {
      expect(COMPATIBILITY_FRAMING_TEXT).not.toContain(word)
    }
  })
})
