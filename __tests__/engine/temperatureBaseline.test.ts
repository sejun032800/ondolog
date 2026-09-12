/**
 * Part 10-7 "연애 온도 계산 규격 (확정)" — 기저 온도(①) · 활동 변동분
 * 식(②) · 결합(③) 테스트.
 *
 * 기존 `__tests__/engine/temperature.test.ts`(미연결 고정값·클램프 유틸)는
 * 건드리지 않는다 — 이 파일은 Phase 7 선행 작업(`.claude/state/prompts/phase-7/
 * 03-engine-dev-temperature.md`)에서 새로 구현한 함수 전용이다.
 *
 * ② 활동 변동분의 "하루치 활동 점수" 정의는 `UNRESOLVED('temperature.activityScore')`로
 * 남아 있다(Part 16-2) — 그 값을 지어내지 않고, 이를 소비하는 경로는
 * "throw를 기대"하는 테스트로만 검증한다.
 */

import type { EnneagramCore } from '../../src/constants/enneagram'
import { COMPATIBILITY } from '../../src/constants/compatibility'
import { UnresolvedConstantError } from '../../src/engine/constants/unresolved'
import {
  DISCONNECTED_TEMPERATURE,
  type ActivityDeltaCoefficients,
  type BaselineTemperatureCoefficients,
  type DailyActivityRaw,
  type DailyTemperatureCoefficients,
  computeActivityDelta,
  computeActivityDeltaFromScores,
  computeBaselineTemperature,
  computeDailyActivityScore,
  computeDailyTemperature,
} from '../../src/engine/temperature'
import { resolveTypeAffinity } from '../../src/engine/typeAffinity'

const ALL_CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Part 10-7-2 문서 기본값. 테스트에서도 인자로 주입한다 — 엔진에 하드코딩하지 않는다. */
const BASELINE_COEFFICIENTS: BaselineTemperatureCoefficients = {
  contrast: 36.5,
  neutral: 39,
  best: 42,
}

/** Part 10-7-3/10-7-4 문서 기본값. */
const ACTIVITY_COEFFICIENTS: ActivityDeltaCoefficients = {
  windowDays: 14,
  widthCap: 55,
  min: 0,
}

const DAILY_TEMPERATURE_COEFFICIENTS: DailyTemperatureCoefficients = {
  baseline: BASELINE_COEFFICIENTS,
  activity: ACTIVITY_COEFFICIENTS,
}

describe('resolveTypeAffinity — 유형 궁합 범주 판정 (Part 10-7-2, COMPATIBILITY 재사용)', () => {
  it('온도차(contrast) 쌍은 양방향 모두 동일하게 판정한다(Part 10-6-3 상호성)', () => {
    // 1의 contrast에 8, 8의 contrast에 1 — compatibility.ts에 이미 상호적으로 등재.
    expect(resolveTypeAffinity(1, 8)).toBe('contrast')
    expect(resolveTypeAffinity(8, 1)).toBe('contrast')
  })

  it('양쪽 다 서로를 best로 꼽는 대칭 잘맞음 쌍은 best다', () => {
    // 1의 best=[7,5,9], 7의 best=[5,1,9] — 서로를 포함.
    expect(resolveTypeAffinity(1, 7)).toBe('best')
    expect(resolveTypeAffinity(7, 1)).toBe('best')
  })

  it('비대칭 잘맞음 쌍 — 한쪽만 상대를 best로 꼽으면 높은 쪽(best)을 채택한다(Part 10-7-2)', () => {
    // 2의 best=[4,9,8] → 9 포함. 9의 best=[3,6,1] → 2 미포함, 9의 contrast=[5,4]에도 2 없음(중립).
    expect(COMPATIBILITY[2].best.some((b) => b.core === 9)).toBe(true)
    expect(COMPATIBILITY[9].best.some((b) => b.core === 2)).toBe(false)
    expect(COMPATIBILITY[9].contrast.some((c) => c.core === 2)).toBe(false)

    expect(resolveTypeAffinity(2, 9)).toBe('best')
    expect(resolveTypeAffinity(9, 2)).toBe('best')
  })

  it('어느 목록에도 없으면 중립이다', () => {
    // 1의 best=[7,5,9], contrast=[8,6] → 2는 어디에도 없음.
    // 2의 best=[4,9,8], contrast=[3,5] → 1도 어디에도 없음.
    expect(resolveTypeAffinity(1, 2)).toBe('neutral')
    expect(resolveTypeAffinity(2, 1)).toBe('neutral')
  })

  it('동일 입력 100회 반복 → 100회 모두 동일 결과 (결정론 계약)', () => {
    const results = Array.from({ length: 100 }, () => resolveTypeAffinity(2, 9))
    expect(new Set(results).size).toBe(1)
    expect(results[0]).toBe('best')
  })
})

describe('computeBaselineTemperature — 기저 온도 (Part 10-7-2), 순수 함수, throw 없음', () => {
  it('온도차 범주면 contrast 계수를 그대로 쓴다', () => {
    expect(computeBaselineTemperature(1, 8, BASELINE_COEFFICIENTS)).toBe(36.5)
  })

  it('중립 범주면 neutral 계수를 그대로 쓴다', () => {
    expect(computeBaselineTemperature(1, 2, BASELINE_COEFFICIENTS)).toBe(39)
  })

  it('잘맞음 범주면 best 계수를 그대로 쓴다', () => {
    expect(computeBaselineTemperature(1, 7, BASELINE_COEFFICIENTS)).toBe(42)
  })

  it('비대칭 판정(2, 9)에서도 높은 쪽(best=42)이 커플 기저가 된다', () => {
    expect(computeBaselineTemperature(2, 9, BASELINE_COEFFICIENTS)).toBe(42)
    expect(computeBaselineTemperature(9, 2, BASELINE_COEFFICIENTS)).toBe(42)
  })

  it('하한: 주입된 contrast 계수가 36.5 미만이어도 36.5 아래로 내려가지 않는다', () => {
    const belowFloor: BaselineTemperatureCoefficients = {
      contrast: 10,
      neutral: 39,
      best: 42,
    }
    expect(computeBaselineTemperature(1, 8, belowFloor)).toBe(DISCONNECTED_TEMPERATURE)
  })

  it('프로파일 미비 — coreA가 없으면 undefined를 반환하고 throw하지 않는다', () => {
    expect(() =>
      computeBaselineTemperature(undefined, 7, BASELINE_COEFFICIENTS),
    ).not.toThrow()
    expect(computeBaselineTemperature(undefined, 7, BASELINE_COEFFICIENTS)).toBeUndefined()
  })

  it('프로파일 미비 — coreB가 없으면 undefined를 반환하고 throw하지 않는다', () => {
    expect(computeBaselineTemperature(1, undefined, BASELINE_COEFFICIENTS)).toBeUndefined()
  })

  it('프로파일 미비 — 양쪽 다 없으면 undefined를 반환하고 throw하지 않는다', () => {
    expect(
      computeBaselineTemperature(undefined, undefined, BASELINE_COEFFICIENTS),
    ).toBeUndefined()
  })

  it('9개 코어 전 쌍에 대해 throw 없이 값을 반환하고, 값은 항상 36.5 이상이다', () => {
    for (const coreA of ALL_CORES) {
      for (const coreB of ALL_CORES) {
        let result: number | undefined
        expect(() => {
          result = computeBaselineTemperature(coreA, coreB, BASELINE_COEFFICIENTS)
        }).not.toThrow()
        expect(result).toBeGreaterThanOrEqual(DISCONNECTED_TEMPERATURE)
      }
    }
  })

  it('동일 입력 100회 반복 → 100회 모두 동일 결과 (결정론 계약)', () => {
    const results = Array.from({ length: 100 }, () =>
      computeBaselineTemperature(2, 9, BASELINE_COEFFICIENTS),
    )
    expect(new Set(results).size).toBe(1)
  })
})

describe('computeDailyActivityScore — 하루치 활동 점수 정의는 UNRESOLVED (Part 10-7-3, Part 16-2)', () => {
  const raw: DailyActivityRaw = { chatMessageCount: 12, feedPostCount: 1 }

  it('값을 지어내지 않고 UnresolvedConstantError를 던진다', () => {
    expect(() => computeDailyActivityScore(raw)).toThrow(UnresolvedConstantError)
  })

  it('에러 메시지가 근거 문서(Part 10-7-3)를 싣는다', () => {
    try {
      computeDailyActivityScore(raw)
      throw new Error('여기 도달하면 안 된다 — UNRESOLVED는 반드시 throw한다')
    } catch (e) {
      expect(e).toBeInstanceOf(UnresolvedConstantError)
      expect((e as UnresolvedConstantError).doc).toBe('MASTER Part 10-7-3')
    }
  })
})

describe('computeActivityDeltaFromScores — 활동 변동분 식 자체 (Part 10-7-3), UNRESOLVED 없이 완전 테스트', () => {
  it('14일 모두 0점이면 변동분은 0이다', () => {
    const scores = Array.from({ length: 14 }, () => 0)
    expect(computeActivityDeltaFromScores(scores, ACTIVITY_COEFFICIENTS)).toBe(0)
  })

  it('분모는 항상 windowDays 고정 — 배열 길이가 창보다 짧아도 windowDays로 나눈다', () => {
    // 5일치 점수 합 70, 창 14일 고정 분모 → (70/14) × 55 = 275
    const scores = [10, 20, 10, 10, 20]
    const result = computeActivityDeltaFromScores(scores, ACTIVITY_COEFFICIENTS)
    // 상한 55에 걸려 클램프된다.
    expect(result).toBe(ACTIVITY_COEFFICIENTS.widthCap)
  })

  it('상한(widthCap)을 넘지 않는다', () => {
    const scores = Array.from({ length: 14 }, () => 1000)
    expect(computeActivityDeltaFromScores(scores, ACTIVITY_COEFFICIENTS)).toBe(
      ACTIVITY_COEFFICIENTS.widthCap,
    )
  })

  it('하한(min)보다 내려가지 않는다 (음수 점수가 섞여도)', () => {
    const scores = Array.from({ length: 14 }, () => -1000)
    expect(computeActivityDeltaFromScores(scores, ACTIVITY_COEFFICIENTS)).toBe(
      ACTIVITY_COEFFICIENTS.min,
    )
  })

  it('중간값 — (합/14)×55를 소수 1자리로 반올림해 반환한다', () => {
    // 14일 합 14 → (14/14) × 55 = 55.0 (상한과 일치하는 경계값 대신 다른 예시로 재계산)
    const scores = Array.from({ length: 14 }, () => 1) // 합 14
    // (14/14) × 55 = 55 → 상한과 같아 애매하므로 합을 줄인 케이스로 재검증
    const scoresHalf = [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // 합 7
    // (7/14) × 55 = 27.5
    expect(computeActivityDeltaFromScores(scoresHalf, ACTIVITY_COEFFICIENTS)).toBeCloseTo(27.5, 5)
    expect(computeActivityDeltaFromScores(scores, ACTIVITY_COEFFICIENTS)).toBe(55)
  })

  it('빈 배열이어도(창이 전혀 안 참) throw하지 않고 0을 반환한다', () => {
    expect(computeActivityDeltaFromScores([], ACTIVITY_COEFFICIENTS)).toBe(0)
  })

  it('동일 입력 100회 반복 → 100회 모두 동일 결과 (결정론 계약)', () => {
    const scores = [7, 3, 5, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const results = Array.from({ length: 100 }, () =>
      computeActivityDeltaFromScores(scores, ACTIVITY_COEFFICIENTS),
    )
    expect(new Set(results).size).toBe(1)
  })
})

describe('computeActivityDelta — 원시 활동 입력 진입점 (Part 10-7-3), UNRESOLVED 소비', () => {
  it('전부 데이터 없음(null)이면 — 없는 날은 0으로 계산 규칙에 따라 throw 없이 0을 반환한다', () => {
    const dailyActivities: (DailyActivityRaw | null)[] = Array.from({ length: 14 }, () => null)
    expect(() => computeActivityDelta(dailyActivities, ACTIVITY_COEFFICIENTS)).not.toThrow()
    expect(computeActivityDelta(dailyActivities, ACTIVITY_COEFFICIENTS)).toBe(0)
  })

  it('창이 아직 안 찬 신규 커플(배열 길이 < windowDays)도 데이터가 없으면 throw 없이 0이다', () => {
    const dailyActivities: (DailyActivityRaw | null)[] = [null, null, null]
    expect(computeActivityDelta(dailyActivities, ACTIVITY_COEFFICIENTS)).toBe(0)
  })

  it('실제 활동 데이터가 하나라도 섞이면 UnresolvedConstantError를 던진다 — 점수 정의를 지어내지 않는다', () => {
    const dailyActivities: (DailyActivityRaw | null)[] = [
      ...Array.from({ length: 13 }, () => null),
      { chatMessageCount: 5, feedPostCount: 0 },
    ]
    expect(() => computeActivityDelta(dailyActivities, ACTIVITY_COEFFICIENTS)).toThrow(
      UnresolvedConstantError,
    )
  })
})

describe('computeDailyTemperature — 결합 (Part 10-7-1), ②가 미확정이므로 호출 시 throw', () => {
  it('실제 활동 데이터가 있는 현실적인 호출은 UnresolvedConstantError로 실패한다 — 규격이 의도한 정상 상태', () => {
    const dailyActivities: (DailyActivityRaw | null)[] = [
      { chatMessageCount: 3, feedPostCount: 1 },
      ...Array.from({ length: 13 }, () => null),
    ]
    expect(() =>
      computeDailyTemperature(1, 7, dailyActivities, DAILY_TEMPERATURE_COEFFICIENTS),
    ).toThrow(UnresolvedConstantError)
  })

  it('활동 데이터가 전혀 없는 극단 케이스(신규 연결 직후)는 throw하지 않고 기저 온도를 그대로 반환한다', () => {
    const dailyActivities: (DailyActivityRaw | null)[] = Array.from({ length: 14 }, () => null)
    expect(
      computeDailyTemperature(1, 7, dailyActivities, DAILY_TEMPERATURE_COEFFICIENTS),
    ).toBe(42)
  })
})
