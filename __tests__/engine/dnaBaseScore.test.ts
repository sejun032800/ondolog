/**
 * Part 17-2 "우리의 연애 DNA — base_score 산출 규격 (확정)" — 기저 점수(①)·
 * 채팅 변동분(②)·결합(③) 테스트.
 *
 * 기존 `__tests__/engine/dnaScore.test.ts`(클램프 유틸 · `computeTotalScore` ·
 * 절대평가 정적 검사)는 건드리지 않는다 — 이 파일은 Phase 7 선행 작업
 * (`.claude/state/prompts/phase-7/09-engine-dev-dna-base-score.md`)에서 새로
 * 구현한 함수 전용이다.
 *
 * ② 채팅 변동분의 "채팅 질 → 점수" 산출식은
 * `UNRESOLVED('dnaScore.chatDelta')`로 남아 있다(Part 16-2) — 범위
 * `[−10, +25]`만 확정. 그 값을 지어내지 않고, 이를 소비하는 경로(②·③)는
 * "throw를 기대"하는 테스트로만 검증한다.
 *
 * 기저 세 값(문서 확정 `61 / 65 / 69`)과 클램프 경계(`50 / 100`)는 Part 17-2에서
 * 그대로 옮긴 값이며, **엔진이 아니라 이 테스트가 인자로 주입한다**
 * (`temperatureBaseline.test.ts`가 `36.5 / 39 / 42`를 주입하는 것과 동일 패턴).
 */

import * as fs from 'fs'
import * as path from 'path'
import type { EnneagramCore } from '../../src/constants/enneagram'
import { COMPATIBILITY } from '../../src/constants/compatibility'
import { UnresolvedConstantError } from '../../src/engine/constants/unresolved'
import {
  type ChatQualitySignals,
  type DnaBaseScoreCoefficients,
  type DnaScoreClampBounds,
  type DnaTotalScoreCoefficients,
  computeChatDelta,
  computeDnaBaseScore,
  computeDnaTotalScore,
} from '../../src/engine/dnaScore'

const ALL_CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Part 17-2 확정값. 엔진에 하드코딩하지 않고 인자로 주입한다. */
const DNA_BASE_COEFFICIENTS: DnaBaseScoreCoefficients = {
  contrast: 61,
  neutral: 65,
  best: 69,
}

/** Part 17-2: `total = clamp(base_score + chat_delta, 50, 100)`. */
const DNA_CLAMP_BOUNDS: DnaScoreClampBounds = { min: 50, max: 100 }

const DNA_TOTAL_COEFFICIENTS: DnaTotalScoreCoefficients = {
  base: DNA_BASE_COEFFICIENTS,
  clamp: DNA_CLAMP_BOUNDS,
}

/** ②·③은 형태를 확정하지 않은 불투명 입력을 받는다 — 빈 객체로 충분하다. */
const CHAT_QUALITY: ChatQualitySignals = {}

describe('computeDnaBaseScore — 기저 점수 (Part 17-2), 순수 함수, throw 없음', () => {
  it('온도차(contrast) 범주면 contrast 계수를 그대로 쓴다', () => {
    // 1의 contrast에 8, 8의 contrast에 1 — compatibility.ts에 상호적으로 등재.
    expect(computeDnaBaseScore(1, 8, DNA_BASE_COEFFICIENTS)).toBe(61)
    expect(computeDnaBaseScore(8, 1, DNA_BASE_COEFFICIENTS)).toBe(61)
  })

  it('중립(neutral) 범주 — 어느 목록에도 없으면 neutral 계수를 쓴다', () => {
    // 1의 best=[7,5,9]·contrast=[8,6] → 2는 어디에도 없음.
    // 2의 best=[4,9,8]·contrast=[3,5] → 1도 어디에도 없음.
    expect(COMPATIBILITY[1].best.some((b) => b.core === 2)).toBe(false)
    expect(COMPATIBILITY[1].contrast.some((c) => c.core === 2)).toBe(false)
    expect(COMPATIBILITY[2].best.some((b) => b.core === 1)).toBe(false)
    expect(COMPATIBILITY[2].contrast.some((c) => c.core === 1)).toBe(false)

    expect(computeDnaBaseScore(1, 2, DNA_BASE_COEFFICIENTS)).toBe(65)
    expect(computeDnaBaseScore(2, 1, DNA_BASE_COEFFICIENTS)).toBe(65)
  })

  it('잘 맞음(best) 범주 — 양쪽이 서로를 best로 꼽는 대칭 쌍', () => {
    // 1의 best=[7,5,9], 7의 best=[5,1,9] — 서로 포함.
    expect(computeDnaBaseScore(1, 7, DNA_BASE_COEFFICIENTS)).toBe(69)
    expect(computeDnaBaseScore(7, 1, DNA_BASE_COEFFICIENTS)).toBe(69)
  })

  it('양방향 판정이 어긋나면 높은 쪽(best)을 커플 기저로 삼는다 (Part 17-2, 비대칭 잘 맞음)', () => {
    // 2의 best=[4,9,8] → 9 포함. 9는 2를 best로도 contrast로도 꼽지 않음(중립).
    expect(COMPATIBILITY[2].best.some((b) => b.core === 9)).toBe(true)
    expect(COMPATIBILITY[9].best.some((b) => b.core === 2)).toBe(false)
    expect(COMPATIBILITY[9].contrast.some((c) => c.core === 2)).toBe(false)

    // 한쪽 관점 best(69) + 다른 쪽 관점 neutral(65) → 높은 쪽 69.
    expect(computeDnaBaseScore(2, 9, DNA_BASE_COEFFICIENTS)).toBe(69)
    expect(computeDnaBaseScore(9, 2, DNA_BASE_COEFFICIENTS)).toBe(69)
  })

  it('세 계수 값을 인자로 바꾸면 그대로 반영한다 (엔진에 하드코딩 없음)', () => {
    const alt: DnaBaseScoreCoefficients = { contrast: 55, neutral: 60, best: 70 }
    expect(computeDnaBaseScore(1, 8, alt)).toBe(55) // contrast
    expect(computeDnaBaseScore(1, 2, alt)).toBe(60) // neutral
    expect(computeDnaBaseScore(1, 7, alt)).toBe(70) // best
  })

  it('반올림은 반환 직전 소수 2자리로 한 번만 적용한다', () => {
    const noisy: DnaBaseScoreCoefficients = {
      contrast: 61.126,
      neutral: 65,
      best: 69,
    }
    expect(computeDnaBaseScore(1, 8, noisy)).toBeCloseTo(61.13, 5)
  })

  it('9개 코어 전 쌍(동일 코어 포함)에서 throw 없이 세 계수 중 하나를 반환한다', () => {
    const allowed = new Set([
      DNA_BASE_COEFFICIENTS.contrast,
      DNA_BASE_COEFFICIENTS.neutral,
      DNA_BASE_COEFFICIENTS.best,
    ])
    for (const coreA of ALL_CORES) {
      for (const coreB of ALL_CORES) {
        let result: number | undefined
        expect(() => {
          result = computeDnaBaseScore(coreA, coreB, DNA_BASE_COEFFICIENTS)
        }).not.toThrow()
        expect(allowed.has(result as number)).toBe(true)
      }
    }
  })

  it('동일 입력 100회 반복 → 100회 모두 동일 결과 (결정론 계약)', () => {
    const results = Array.from({ length: 100 }, () =>
      computeDnaBaseScore(2, 9, DNA_BASE_COEFFICIENTS),
    )
    expect(new Set(results).size).toBe(1)
    expect(results[0]).toBe(69)
  })
})

describe('computeChatDelta — 채팅 질 → 점수 산출식은 UNRESOLVED (Part 17-2, Part 16-2)', () => {
  it('범위만 확정이고 산출식은 미확정 — 값을 지어내지 않고 UnresolvedConstantError를 던진다', () => {
    expect(() => computeChatDelta(CHAT_QUALITY)).toThrow(UnresolvedConstantError)
  })

  it('에러가 근거 문서(MASTER Part 17-2)·Phase(7)·키를 싣는다', () => {
    try {
      computeChatDelta(CHAT_QUALITY)
      throw new Error('여기 도달하면 안 된다 — UNRESOLVED는 반드시 throw한다')
    } catch (e) {
      expect(e).toBeInstanceOf(UnresolvedConstantError)
      const err = e as UnresolvedConstantError
      expect(err.key).toBe('dnaScore.chatDelta')
      expect(err.phase).toBe(7)
      expect(err.doc).toBe('MASTER Part 17-2')
    }
  })

  it('동일 입력 100회 반복 → 100회 모두 동일하게 throw하며 메시지가 흔들리지 않는다 (결정론)', () => {
    const messages = Array.from({ length: 100 }, () => {
      try {
        computeChatDelta(CHAT_QUALITY)
        return null
      } catch (e) {
        return (e as Error).message
      }
    })
    expect(messages.every((m) => m !== null)).toBe(true)
    expect(new Set(messages).size).toBe(1)
  })
})

describe('computeDnaTotalScore — 결합 (Part 17-2), ②가 미확정이므로 호출 시 throw', () => {
  it('현실적인 호출은 UnresolvedConstantError로 실패한다 — 규격이 의도한 정상 상태', () => {
    expect(() =>
      computeDnaTotalScore(1, 7, CHAT_QUALITY, DNA_TOTAL_COEFFICIENTS),
    ).toThrow(UnresolvedConstantError)
  })

  it('기저 범주와 무관하게 throw한다 (contrast·neutral·best 쌍 모두)', () => {
    for (const [a, b] of [
      [1, 8], // contrast
      [1, 2], // neutral
      [2, 9], // best(비대칭)
    ] as [EnneagramCore, EnneagramCore][]) {
      expect(() =>
        computeDnaTotalScore(a, b, CHAT_QUALITY, DNA_TOTAL_COEFFICIENTS),
      ).toThrow(UnresolvedConstantError)
    }
  })

  it('클램프 경계를 인자로 넘겨도 throw를 막지 못한다 (②를 먼저 거친다)', () => {
    const wideBounds: DnaTotalScoreCoefficients = {
      base: DNA_BASE_COEFFICIENTS,
      clamp: { min: 0, max: 1000 },
    }
    expect(() =>
      computeDnaTotalScore(1, 7, CHAT_QUALITY, wideBounds),
    ).toThrow(UnresolvedConstantError)
  })

  it('기저 점수 자체는 (같은 입력으로) throw 없이 계산된다 — throw는 오직 ②에서 온다', () => {
    // ③이 throw하는 원인이 ①이 아니라 ②임을 대조로 보인다.
    expect(() => computeDnaBaseScore(1, 7, DNA_BASE_COEFFICIENTS)).not.toThrow()
    expect(computeDnaBaseScore(1, 7, DNA_BASE_COEFFICIENTS)).toBe(69)
  })

  it('동일 입력 100회 반복 → 100회 모두 동일하게 throw한다 (결정론)', () => {
    const messages = Array.from({ length: 100 }, () => {
      try {
        computeDnaTotalScore(1, 7, CHAT_QUALITY, DNA_TOTAL_COEFFICIENTS)
        return null
      } catch (e) {
        return (e as Error).message
      }
    })
    expect(messages.every((m) => m !== null)).toBe(true)
    expect(new Set(messages).size).toBe(1)
  })
})

describe('dnaScore.ts 소스 정적 검사 — chat_delta는 양이 아니라 질 (Part 17-2, Part 10-7-6)', () => {
  const rawSource = fs.readFileSync(
    path.join(__dirname, '../../src/engine/dnaScore.ts'),
    'utf8',
  )
  // docblock은 온도의 DailyActivityRaw(chatMessageCount 등)와 대비하려고 그
  // 이름을 인용하므로, 주석을 제거한 실행 코드만 검사한다.
  const source = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  it('발화 건수/메시지 수 같은 양 기반 식별자가 실행 코드에 없다', () => {
    expect(source).not.toMatch(/messageCount/i)
    expect(source).not.toMatch(/msgCount/i)
    expect(source).not.toMatch(/chatCount/i)
    expect(source).not.toMatch(/utteranceCount/i)
    expect(source).not.toMatch(/messageVolume/i)
    expect(source).not.toMatch(/\bcount\b/i)
  })

  it('자체 검증 — 위 패턴은 실제로 양 기반 코드를 잡아낸다', () => {
    const contaminated =
      'export interface ChatRaw { chatMessageCount: number; count: number }'
    expect(contaminated).toMatch(/messageCount/i)
    expect(contaminated).toMatch(/\bcount\b/i)
  })
})
