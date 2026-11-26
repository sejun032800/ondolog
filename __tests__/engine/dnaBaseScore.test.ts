/**
 * Part 17-2 "우리의 연애 DNA — base_score 산출 규격 (확정)" — 기저 점수(①)·
 * 채팅 변동분(②)·결합(③) 테스트.
 *
 * 기존 `__tests__/engine/dnaScore.test.ts`(클램프 유틸 · `computeTotalScore` ·
 * 절대평가 정적 검사)는 건드리지 않는다 — 이 파일은 Phase 7 선행 작업
 * (`.claude/state/prompts/phase-7/09-engine-dev-dna-base-score.md`)에서 새로
 * 구현한 함수 전용이다.
 *
 * ② 채팅 변동분은 ROADMAP r158 R158-2 v0(A′ · `dna_v0`)로 해소됐다 —
 * 과거 throw 기대 시험(②·③)은 v0 동작 시험으로 교체했다(MASTER 16-2 예외 ·
 * `temperatureBaseline.test.ts` 선례).
 *
 * 기저 세 값(문서 확정 `61 / 65 / 69`)과 클램프 경계(`50 / 100`)는 Part 17-2에서
 * 그대로 옮긴 값이며, **엔진이 아니라 이 테스트가 인자로 주입한다**
 * (`temperatureBaseline.test.ts`가 `36.5 / 39 / 42`를 주입하는 것과 동일 패턴).
 */

import * as fs from 'fs'
import * as path from 'path'
import { stripComments } from '../../scripts/lib/stripComments'
import type { EnneagramCore } from '../../src/constants/enneagram'
import { COMPATIBILITY } from '../../src/constants/compatibility'
import {
  type ChatDeltaCoefficients,
  type ChatQualitySignals,
  type DnaBaseScoreCoefficients,
  type DnaScoreClampBounds,
  type DnaTotalScoreCoefficients,
  chatRhythmScore,
  chatTurnScore,
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

/** ROADMAP r158 R158-2 A′ v0 계수(엔진이 아니라 시험이 주입 - 값은 `loveDna.ts` `DNA_CHAT_DELTA_V0`와 같아야 한다). */
const CHAT_V0: ChatDeltaCoefficients = {
  rhythmFastSeconds: 60,
  rhythmSlowSeconds: 10800,
  turnLow: 0.2,
  turnHigh: 0.6,
  rhythmWeight: 0.5,
  min: -10,
  max: 25,
}

const DNA_TOTAL_COEFFICIENTS: DnaTotalScoreCoefficients = {
  base: DNA_BASE_COEFFICIENTS,
  chat: CHAT_V0,
  clamp: DNA_CLAMP_BOUNDS,
}

/** 견본 신호: 답장 중앙값 30분 · 주고받기 0.5 → v0 chatDelta 9.16. */
const CHAT_QUALITY: ChatQualitySignals = { replyGapMedianSeconds: 1800, turnTakingRatio: 0.5 }

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

describe('computeChatDelta — v0(ROADMAP r158 R158-2 A′): r 로그 척도 · t 직선 · −10 + 35 × (0.5r + 0.5t)', () => {
  it('리듬 r: 60초 이하 1 · 3시간(10800초) 이상 0 · 그 사이 1 − (ln m − ln 60)/(ln 10800 − ln 60)', () => {
    expect(chatRhythmScore(0, CHAT_V0)).toBe(1)
    expect(chatRhythmScore(60, CHAT_V0)).toBe(1)
    expect(chatRhythmScore(10800, CHAT_V0)).toBe(0)
    expect(chatRhythmScore(86400, CHAT_V0)).toBe(0)
    expect(chatRhythmScore(1800, CHAT_V0)).toBeCloseTo(1 - Math.log(30) / Math.log(180), 12)
    // 기하 중간(60 × √180 ≈ 805초)에서 0.5
    expect(chatRhythmScore(60 * Math.sqrt(180), CHAT_V0)).toBeCloseTo(0.5, 12)
  })

  it('주고받기 t: 0.2 이하 0 · 0.6 이상 1 · 그 사이 (T − 0.2)/0.4', () => {
    expect(chatTurnScore(0, CHAT_V0)).toBe(0)
    expect(chatTurnScore(0.2, CHAT_V0)).toBe(0)
    expect(chatTurnScore(0.4, CHAT_V0)).toBeCloseTo(0.5, 12)
    expect(chatTurnScore(0.6, CHAT_V0)).toBe(1)
    expect(chatTurnScore(1, CHAT_V0)).toBe(1)
  })

  it('끝값과 견본: (60초, 0.6) +25 · (3시간, 0.2) −10 · (30분, 0.5) 9.16 · (2시간, 0.5) 4.49', () => {
    expect(computeChatDelta({ replyGapMedianSeconds: 60, turnTakingRatio: 0.6 }, CHAT_V0)).toBe(25)
    expect(computeChatDelta({ replyGapMedianSeconds: 10800, turnTakingRatio: 0.2 }, CHAT_V0)).toBe(-10)
    expect(computeChatDelta({ replyGapMedianSeconds: 1800, turnTakingRatio: 0.5 }, CHAT_V0)).toBe(9.16)
    expect(computeChatDelta({ replyGapMedianSeconds: 7200, turnTakingRatio: 0.5 }, CHAT_V0)).toBe(4.49)
  })

  it('범위 [−10, +25]를 넘지 않는다 · 소수 2자리', () => {
    for (const m of [0, 1, 30, 60, 61, 300, 805, 1800, 3600, 7200, 10799, 10800, 1e6]) {
      for (const T of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.9, 1]) {
        const v = computeChatDelta({ replyGapMedianSeconds: m, turnTakingRatio: T }, CHAT_V0)
        expect(v).toBeGreaterThanOrEqual(-10)
        expect(v).toBeLessThanOrEqual(25)
        expect(Math.round(v * 100) / 100).toBe(v)
      }
    }
  })

  it('답장이 빠를수록 · 주고받기가 고를수록 커진다(단조)', () => {
    const ms = [30, 60, 120, 600, 1800, 3600, 7200, 10800, 20000]
    const byM = ms.map((m) => computeChatDelta({ replyGapMedianSeconds: m, turnTakingRatio: 0.4 }, CHAT_V0))
    for (let i = 1; i < byM.length; i++) expect(byM[i]).toBeLessThanOrEqual(byM[i - 1] as number)
    const Ts = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]
    const byT = Ts.map((T) => computeChatDelta({ replyGapMedianSeconds: 600, turnTakingRatio: T }, CHAT_V0))
    for (let i = 1; i < byT.length; i++) expect(byT[i]).toBeGreaterThanOrEqual(byT[i - 1] as number)
  })

  it('동일 입력 100회 반복 → 100회 모두 동일 결과 (결정론)', () => {
    const results = Array.from({ length: 100 }, () => computeChatDelta({ replyGapMedianSeconds: 420, turnTakingRatio: 0.37 }, CHAT_V0))
    expect(new Set(results).size).toBe(1)
  })
})

describe('computeDnaTotalScore — 결합 (Part 17-2): clamp(base + chatDelta, 50, 100)', () => {
  it('기저 + v0 chatDelta (contrast·neutral·best 쌍 모두)', () => {
    for (const [a, b, base] of [
      [1, 8, 61], // contrast
      [1, 2, 65], // neutral
      [2, 9, 69], // best(비대칭)
    ] as [EnneagramCore, EnneagramCore, number][]) {
      expect(computeDnaTotalScore(a, b, CHAT_QUALITY, DNA_TOTAL_COEFFICIENTS)).toBe(Math.round((base + 9.16) * 100) / 100)
    }
  })

  it('클램프 경계를 인자로 받는다 — 좁히면 그 경계에서 잘린다', () => {
    const narrow: DnaTotalScoreCoefficients = { ...DNA_TOTAL_COEFFICIENTS, clamp: { min: 50, max: 70 } }
    expect(computeDnaTotalScore(2, 9, { replyGapMedianSeconds: 30, turnTakingRatio: 0.9 }, narrow)).toBe(70)
    expect(computeDnaTotalScore(1, 8, { replyGapMedianSeconds: 30, turnTakingRatio: 0.9 }, DNA_TOTAL_COEFFICIENTS)).toBe(86)
    expect(computeDnaTotalScore(1, 8, { replyGapMedianSeconds: 20000, turnTakingRatio: 0 }, DNA_TOTAL_COEFFICIENTS)).toBe(51)
  })

  it('동일 입력 100회 반복 → 100회 모두 동일 결과 (결정론)', () => {
    const results = Array.from({ length: 100 }, () => computeDnaTotalScore(1, 7, CHAT_QUALITY, DNA_TOTAL_COEFFICIENTS))
    expect(new Set(results).size).toBe(1)
  })
})

describe('dnaScore.ts 소스 정적 검사 — chat_delta는 양이 아니라 질 (Part 17-2, Part 10-7-6)', () => {
  const rawSource = fs.readFileSync(
    path.join(__dirname, '../../src/engine/dnaScore.ts'),
    'utf8',
  )
  // docblock은 온도의 DailyActivityRaw(chatMessageCount 등)와 대비하려고 그
  // 이름을 인용하므로, 주석을 제거한 실행 코드만 검사한다.
  const source = stripComments(rawSource)

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
