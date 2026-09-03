/**
 * 규준집단 분포 요약 — 결정론적 순수 통계 함수.
 *
 * 전수 열거(3,888개)의 산출물이므로 **표본이 아니라 전수**다.
 * 표준편차는 N으로 나눈 모표준편차를 쓴다.
 *
 * 반올림 정책(CLAUDE.md 결정론 계약): 부동소수점 누적 오차가 결과를
 * 바꾸지 않도록, 각 산출값은 마지막에 `roundTo`로 단 한 번만 반올림한다.
 * 중간 계산(합·제곱합)은 반올림하지 않는다. 두 번 실행하면 동일한
 * 부동소수점 연산 순서를 그대로 반복하므로 바이트 단위로 동일한
 * 결과가 나온다.
 */

import { roundTo } from '../../src/engine/numeric'
import {
  NORM_QUANTILE_KEYS,
  type NormDistribution,
} from '../../src/engine/normPercentile'

/** 요약 통계(mean·stdDev)의 반올림 자리수. */
export const SUMMARY_DECIMALS = 6
/** 합성값(6각 스탯 산술평균) 원점수의 반올림 자리수. 스탯 원점수는 정수라 무영향. */
export const RAW_SCORE_DECIMALS = 10

/** nearest-rank 백분위 index (0-based). p0 → 0, p100 → n-1. */
function nearestRankIndex(percentile: number, n: number): number {
  if (percentile <= 0) return 0
  if (percentile >= 100) return n - 1
  const rank = Math.ceil((percentile / 100) * n)
  return Math.min(Math.max(rank - 1, 0), n - 1)
}

/** "p37" → 37. */
function quantileKeyToPercentile(key: string): number {
  return Number(key.slice(1))
}

/**
 * 오름차순 정렬된 원점수 배열에서 분포 요약을 만든다.
 * `sortedValues`는 이미 정렬·반올림된 상태여야 한다(호출부 책임).
 */
export function summarizeDistribution(
  sortedValues: readonly number[],
): NormDistribution {
  const n = sortedValues.length
  if (n === 0) {
    throw new Error('summarizeDistribution: 빈 배열은 요약할 수 없다.')
  }

  let sum = 0
  for (const v of sortedValues) sum += v
  const meanExact = sum / n

  let sqDevSum = 0
  for (const v of sortedValues) {
    const d = v - meanExact
    sqDevSum += d * d
  }
  const stdDevExact = Math.sqrt(sqDevSum / n)

  const quantiles: Record<string, number> = {}
  for (const key of NORM_QUANTILE_KEYS) {
    const p = quantileKeyToPercentile(key)
    quantiles[key] = sortedValues[nearestRankIndex(p, n)]
  }

  return {
    sorted: sortedValues,
    mean: roundTo(meanExact, SUMMARY_DECIMALS),
    stdDev: roundTo(stdDevExact, SUMMARY_DECIMALS),
    quantiles,
  }
}

/** 정렬되지 않은 원점수 목록 → 오름차순 정렬 + 반올림. */
export function toSortedRawScores(
  values: readonly number[],
  decimals: number,
): number[] {
  return values
    .map((v) => roundTo(v, decimals))
    .slice()
    .sort((a, b) => a - b)
}
