import {
  OVR_CALIBRATION_TABLE,
  computeAttachmentStability,
  computeDefAnxietyStability,
  computeOvrRawScore,
  computeSixStats,
  mapPercentileToOvr,
  percentileRank,
  type SixStatsInput,
} from '../../src/engine/leagueStats'

const fixedInput: SixStatsInput = {
  big5: { bigE: 72, bigO: 71, bigA: 61, bigC: 46, bigN: 50 },
  sternberg: { intimacy: 80, passion: 60, commitment: 63 },
  q1: 'A',
  q2: 'C',
  attachAnxiety: 50,
  attachAvoidance: 20,
}

describe('computeAttachmentStability (EMP 전용 — 불변)', () => {
  it('100 − (불안+회피)/2 (Part 17-3)', () => {
    expect(computeAttachmentStability(20, 20)).toBe(80)
    expect(computeAttachmentStability(85, 85)).toBe(15)
    expect(computeAttachmentStability(50, 50)).toBe(50)
  })
})

describe('computeDefAnxietyStability (DEF 전용 — 2026-09-03 신설)', () => {
  it('75 − 불안축/2 (Part 17-3 "애착 불안 안정성")', () => {
    // 손계산: 75 − 20/2 = 65 / 75 − 50/2 = 50 / 75 − 85/2 = 32.5
    expect(computeDefAnxietyStability(20)).toBe(65)
    expect(computeDefAnxietyStability(50)).toBe(50)
    expect(computeDefAnxietyStability(85)).toBe(32.5)
  })

  it('100 − (불안축 + 50)/2 와 동치다 (회피축 자리에 중립값 50)', () => {
    for (const anx of [0, 20, 33, 50, 85, 100]) {
      expect(computeDefAnxietyStability(anx)).toBe(100 - (anx + 50) / 2)
    }
  })

  it('불안축 계수가 −0.5로 유지된다 (2점 기울기)', () => {
    const slope =
      (computeDefAnxietyStability(85) - computeDefAnxietyStability(20)) /
      (85 - 20)
    expect(slope).toBe(-0.5)
  })

  it('회피축 인자를 받지 않는다 (arity 1)', () => {
    expect(computeDefAnxietyStability).toHaveLength(1)
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () =>
      computeDefAnxietyStability(85),
    )
    expect(new Set(results).size).toBe(1)
  })
})

describe('computeSixStats — 결정론 계약', () => {
  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () => computeSixStats(fixedInput))
    const first = results[0]
    for (const r of results) {
      expect(r).toEqual(first)
    }
  })

  it('6개 스탯 전부 0~100 범위 안에 있다 (다양한 입력 조합)', () => {
    const q1Choices = ['A', 'B', 'C'] as const
    const q2Choices = ['A', 'B', 'C'] as const
    const anxietyLevels = [20, 50, 85]
    const avoidanceLevels = [20, 50, 85]

    for (const q1 of q1Choices) {
      for (const q2 of q2Choices) {
        for (const attachAnxiety of anxietyLevels) {
          for (const attachAvoidance of avoidanceLevels) {
            const stats = computeSixStats({
              big5: { bigE: 72, bigO: 71, bigA: 61, bigC: 46, bigN: 50 },
              sternberg: { intimacy: 80, passion: 60, commitment: 63 },
              q1,
              q2,
              attachAnxiety,
              attachAvoidance,
            })
            for (const v of Object.values(stats)) {
              expect(v).toBeGreaterThanOrEqual(0)
              expect(v).toBeLessThanOrEqual(100)
            }
          }
        }
      }
    }
  })

  it('호나이 주장형(Q1=A)일 때만 PUS에 보너스가 붙어 다른 그룹보다 높다', () => {
    const base = { ...fixedInput, q1: 'A' as const }
    const other = { ...fixedInput, q1: 'B' as const }
    const statsA = computeSixStats(base)
    const statsB = computeSixStats(other)
    expect(statsA.pus).toBeGreaterThan(statsB.pus)
  })
})

describe('percentileRank — 규준집단 백분위 (표준 percentile rank 공식)', () => {
  const population = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

  it('모집단 중앙값 부근은 50%에 가깝다', () => {
    // population에 50이 포함(동점 1개), 50보다 작은 값 4개(10,20,30,40)
    // percentile = (4 + 0.5*1) / 10 * 100 = 45
    expect(percentileRank(50, population)).toBe(45)
  })

  it('모집단 최댓값보다 큰 값은 100%에 가깝다', () => {
    expect(percentileRank(1000, population)).toBe(100)
  })

  it('모집단 최솟값보다 작은 값은 0%다', () => {
    expect(percentileRank(0, population)).toBe(0)
  })

  it('빈 모집단은 값을 지어내지 않고 에러를 던진다', () => {
    expect(() => percentileRank(50, [])).toThrow()
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () => percentileRank(65, population))
    expect(new Set(results).size).toBe(1)
  })
})

describe('mapPercentileToOvr — OVR 캘리브레이션 (Part 17-3)', () => {
  it('구간 경계값이 문서 표와 정확히 일치한다', () => {
    expect(mapPercentileToOvr(0)).toBe(40)
    expect(mapPercentileToOvr(10)).toBe(70)
    expect(mapPercentileToOvr(80)).toBe(90)
    expect(mapPercentileToOvr(95)).toBe(100)
    expect(mapPercentileToOvr(99)).toBe(110)
    expect(mapPercentileToOvr(100)).toBe(120)
  })

  it('0~100 범위를 벗어나는 백분위도 클램프해서 처리한다', () => {
    expect(mapPercentileToOvr(-10)).toBe(40)
    expect(mapPercentileToOvr(150)).toBe(120)
  })

  it('OVR이 0~120 범위(DB 제약)를 벗어나지 않는다 — 0~100% 전 구간', () => {
    for (let p = 0; p <= 100; p++) {
      const ovr = mapPercentileToOvr(p)
      expect(ovr).toBeGreaterThanOrEqual(0)
      expect(ovr).toBeLessThanOrEqual(120)
    }
  })

  it('캘리브레이션 표가 문서 원문과 일치한다', () => {
    expect(OVR_CALIBRATION_TABLE).toEqual([
      { minPercentile: 0, maxPercentile: 10, minOvr: 40, maxOvr: 70 },
      { minPercentile: 10, maxPercentile: 80, minOvr: 70, maxOvr: 90 },
      { minPercentile: 80, maxPercentile: 95, minOvr: 90, maxOvr: 100 },
      { minPercentile: 95, maxPercentile: 99, minOvr: 100, maxOvr: 110 },
      { minPercentile: 99, maxPercentile: 100, minOvr: 110, maxOvr: 120 },
    ])
  })
})

describe('전체 파이프라인 (6각 스탯 → OVR 원점수 → 백분위 → OVR)', () => {
  it('OVR이 0~120 범위를 벗어나지 않는다', () => {
    const stats = computeSixStats(fixedInput)
    const rawScore = computeOvrRawScore(stats)
    // 고정된(결정론적) 모집단 원점수 배열 — Math.random 미사용
    const population = Array.from({ length: 50 }, (_, i) => 40 + i)
    const percentile = percentileRank(rawScore, population)
    const ovr = mapPercentileToOvr(percentile)
    expect(ovr).toBeGreaterThanOrEqual(0)
    expect(ovr).toBeLessThanOrEqual(120)
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const population = Array.from({ length: 50 }, (_, i) => 40 + i)
    const run = () => {
      const stats = computeSixStats(fixedInput)
      const rawScore = computeOvrRawScore(stats)
      const percentile = percentileRank(rawScore, population)
      return mapPercentileToOvr(percentile)
    }
    const results = Array.from({ length: 100 }, run)
    expect(new Set(results).size).toBe(1)
  })
})
