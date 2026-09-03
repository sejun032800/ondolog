import * as fs from 'fs'
import * as path from 'path'

import {
  NORM_QUANTILE_KEYS,
  SIX_STAT_KEYS,
  lookupCompositePercentile,
  lookupStatPercentile,
  type NormData,
} from '../../src/engine/normPercentile'

/**
 * 백분위 조회 함수 — 규준 데이터를 **인자로 주입**받는 순수 함수.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-8-2 (처리 순서 ③), Part 10-8-3
 * (주입 규칙). 엔진은 어떤 버전 파일도 정적 import하지 않는다 —
 * 이 테스트가 파일을 fs로 읽어 인자로 넘긴다.
 */

const norm = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../src/engine/data/norm-synthetic-v1.json'),
    'utf8',
  ),
) as NormData

describe('lookupCompositePercentile — 규준 데이터 주입', () => {
  it('규준 분포 최솟값보다 낮은 합성값은 0, 최댓값보다 높으면 100', () => {
    const lo = norm.composite.sorted[0]
    const hi = norm.composite.sorted[norm.composite.sorted.length - 1]
    expect(lookupCompositePercentile(lo - 100, norm)).toBe(0)
    expect(lookupCompositePercentile(hi + 100, norm)).toBe(100)
  })

  it('중앙값(p50) 부근 합성값의 백분위는 50 근처다', () => {
    const median = norm.composite.quantiles.p50
    const p = lookupCompositePercentile(median, norm)
    expect(p).toBeGreaterThan(35)
    expect(p).toBeLessThan(65)
  })

  it('합성값이 커질수록 백분위는 단조 증가한다 (감소하지 않는다)', () => {
    let prev = -1
    for (let v = 30; v <= 65; v += 0.5) {
      const p = lookupCompositePercentile(v, norm)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과 (결정론)', () => {
    const results = Array.from({ length: 100 }, () =>
      lookupCompositePercentile(49.1666666667, norm),
    )
    expect(new Set(results).size).toBe(1)
  })

  it('규준 데이터는 인자다 — 다른 분포를 주면 다른 백분위가 나온다', () => {
    const shifted: NormData = {
      ...norm,
      composite: {
        ...norm.composite,
        sorted: norm.composite.sorted.map((v) => v + 40),
      },
    }
    const raw = norm.composite.quantiles.p50
    expect(lookupCompositePercentile(raw, norm)).toBeGreaterThan(
      lookupCompositePercentile(raw, shifted),
    )
  })

  it('빈 분포를 주면 값을 지어내지 않고 에러를 던진다', () => {
    const empty: NormData = {
      ...norm,
      composite: { ...norm.composite, sorted: [] },
    }
    expect(() => lookupCompositePercentile(50, empty)).toThrow()
  })
})

describe('lookupStatPercentile — 기각된 (b) 방식 대조용', () => {
  it('6종 스탯 모두 조회 가능하고 0~100 범위다', () => {
    for (const stat of SIX_STAT_KEYS) {
      const mid = norm.stats[stat].quantiles.p50
      const p = lookupStatPercentile(stat, mid, norm)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    }
  })

  it('동일 입력 100회 반복 → 동일 결과', () => {
    const results = Array.from({ length: 100 }, () =>
      lookupStatPercentile('pus', 49.75, norm),
    )
    expect(new Set(results).size).toBe(1)
  })
})

describe('규준 파일 스키마 자체 점검', () => {
  it('분위수 키가 NORM_QUANTILE_KEYS와 정확히 일치한다', () => {
    expect(Object.keys(norm.composite.quantiles)).toEqual([...NORM_QUANTILE_KEYS])
    for (const stat of SIX_STAT_KEYS) {
      expect(Object.keys(norm.stats[stat].quantiles)).toEqual([
        ...NORM_QUANTILE_KEYS,
      ])
    }
  })

  it('mean/stdDev가 유한한 수다', () => {
    expect(Number.isFinite(norm.composite.mean)).toBe(true)
    expect(Number.isFinite(norm.composite.stdDev)).toBe(true)
    for (const stat of SIX_STAT_KEYS) {
      expect(Number.isFinite(norm.stats[stat].mean)).toBe(true)
      expect(Number.isFinite(norm.stats[stat].stdDev)).toBe(true)
    }
  })
})
