/** 76-B2(R98-4 a) 초안이 없을 때의 이번 달 경과율 - 초안이 있을 때와 같은 공식 · 같은 값. */
import { describe, expect, it } from 'vitest'
import { periodElapsedPercent } from '@/utils/magazine'
import { issuePercent, monthElapsedPercent, monthPeriodOf } from './monthProgress'

describe('monthPeriodOf (KST 1일~말일)', () => {
  it('달의 첫날 · 마지막 날(윤년 2월 · 12월 포함)', () => {
    expect(monthPeriodOf('2025-11-15')).toEqual({ periodStart: '2025-11-01', periodEnd: '2025-11-30' })
    expect(monthPeriodOf('2024-02-10')).toEqual({ periodStart: '2024-02-01', periodEnd: '2024-02-29' })
    expect(monthPeriodOf('2025-12-31')).toEqual({ periodStart: '2025-12-01', periodEnd: '2025-12-31' })
  })
})

describe('초안 있음 / 없음 같은 값', () => {
  it('이번 달 월간 초안(period 1일~말일)이 있을 때의 percent와 초안이 없을 때의 값이 같다', () => {
    for (const today of ['2025-11-01', '2025-11-02', '2025-11-15', '2025-11-30', '2025-12-31', '2024-02-29']) {
      const { periodStart, periodEnd } = monthPeriodOf(today)
      const draft = { percent: periodElapsedPercent(periodStart, periodEnd, today) }
      expect(issuePercent(null, today)).toBe(draft.percent)
      expect(issuePercent(draft, today)).toBe(monthElapsedPercent(today))
    }
  })
  it('초안이 있으면 초안 값이 이긴다(이번 달이 아닌 초안도 그대로)', () => {
    expect(issuePercent({ percent: 37 }, '2025-11-15')).toBe(37)
  })
  it('같은 입력은 같은 값(결정론) · 15일은 46%', () => {
    expect(monthElapsedPercent('2025-11-15')).toBe(46)
    expect(monthElapsedPercent('2025-11-15')).toBe(monthElapsedPercent('2025-11-15'))
  })
})
