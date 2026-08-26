import { computeDaysTogether, getMilestoneStatus } from '../../src/utils/relationshipDays'

describe('computeDaysTogether', () => {
  it('시작일 당일은 1일차다', () => {
    expect(computeDaysTogether('2026-01-01', new Date('2026-01-01T15:00:00Z'))).toBe(1)
  })

  it('다음날은 2일차다', () => {
    expect(computeDaysTogether('2026-01-01', new Date('2026-01-02T00:00:01Z'))).toBe(2)
  })

  it('100일 후는 정확히 100일차다', () => {
    // 2026-01-01 + 99일 = 2026-04-10 → 1(시작일) + 99 = 100일차
    expect(computeDaysTogether('2026-01-01', new Date('2026-04-10T09:00:00Z'))).toBe(100)
  })

  it('시간대(시각) 차이는 결과에 영향을 주지 않는다(날짜만 비교)', () => {
    const a = computeDaysTogether('2026-01-01', new Date('2026-06-15T00:00:00Z'))
    const b = computeDaysTogether('2026-01-01', new Date('2026-06-15T23:59:59Z'))
    expect(a).toBe(b)
  })

  it('동일 입력에 대해 항상 동일한 결과를 반환한다(결정론)', () => {
    const now = new Date('2026-08-25T12:00:00Z')
    const results = Array.from({ length: 20 }, () => computeDaysTogether('2025-01-10', now))
    expect(new Set(results).size).toBe(1)
  })

  it('미래 시작일 등 방어적 입력에도 최소 1을 반환한다', () => {
    expect(computeDaysTogether('2099-01-01', new Date('2026-01-01T00:00:00Z'))).toBe(1)
  })
})

describe('getMilestoneStatus', () => {
  it('100일 당일은 isToday=true, 라벨 "100일"', () => {
    expect(getMilestoneStatus(100)).toEqual({
      isToday: true,
      isUpcoming: false,
      label: '100일',
      daysUntil: 0,
    })
  })

  it('365일 당일은 "1주년"으로 표시된다(100일 단위보다 우선)', () => {
    expect(getMilestoneStatus(365)).toEqual({
      isToday: true,
      isUpcoming: false,
      label: '1주년',
      daysUntil: 0,
    })
  })

  it('730일 당일은 "2주년"으로 표시된다', () => {
    expect(getMilestoneStatus(730).label).toBe('2주년')
  })

  it('마일스톤 7일 전부터 임박 강조가 켜진다(93일차 → 100일까지 7일)', () => {
    expect(getMilestoneStatus(93)).toEqual({
      isToday: false,
      isUpcoming: true,
      label: '100일',
      daysUntil: 7,
    })
  })

  it('마일스톤 8일 전은 강조되지 않는다(92일차 → 100일까지 8일)', () => {
    expect(getMilestoneStatus(92)).toEqual(NO_MILESTONE)
  })

  it('두 마일스톤이 겹치는 구간에서는 더 가까운 쪽을 고른다(358일차 → 1주년까지 7일, 400일까지는 42일)', () => {
    expect(getMilestoneStatus(358)).toEqual({
      isToday: false,
      isUpcoming: true,
      label: '1주년',
      daysUntil: 7,
    })
  })

  it('마일스톤 사이 평범한 날은 아무것도 반환하지 않는다', () => {
    expect(getMilestoneStatus(50)).toEqual(NO_MILESTONE)
  })

  it('동일 입력에 대해 항상 동일한 결과를 반환한다(결정론)', () => {
    const results = Array.from({ length: 20 }, () => getMilestoneStatus(93))
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1)
  })
})

const NO_MILESTONE = { isToday: false, isUpcoming: false, label: null, daysUntil: null }
