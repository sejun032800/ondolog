/// <reference types="jest" />
import { periodLabelOf } from './periodLabel.ts'
import type { CornerContext } from './cornerPipeline.ts'
import { DAILY_CONTEXT, MONTHLY_CONTEXT } from './testFixtures/cornerFixtures.ts'

/**
 * `periodLabelOf` - 기간 표기는 기간과 주기에서 함수 하나로 만든다 (MASTER 17-0-8, r46).
 * 입력으로 따로 받는 자리가 없다는 것도 여기서 컴파일로 증명한다.
 */

const kst = (iso: string) => new Date(`${iso}+09:00`)

describe('periodLabelOf - 기간과 주기에서 만든다', () => {
  it('월간: "2026년 8월" (CORNER_CONTENT §0-3 예시)', () => {
    expect(periodLabelOf(MONTHLY_CONTEXT)).toBe('2026년 8월')
  })

  it('일간: 월간 표기를 날짜 한 단위로 넓힌 "2026년 8월 22일"', () => {
    expect(periodLabelOf(DAILY_CONTEXT)).toBe('2026년 8월 22일')
  })

  it('끝이 배타라 다음 달 0시 0분은 다음 달이 아니다 - 8월 기간은 8월이다', () => {
    expect(periodLabelOf({ cadence: 'monthly', period: { start: kst('2026-08-01T00:00:00'), end: kst('2026-09-01T00:00:00') } })).toBe(
      '2026년 8월',
    )
    expect(periodLabelOf({ cadence: 'daily', period: { start: kst('2026-08-31T00:00:00'), end: kst('2026-09-01T00:00:00') } })).toBe(
      '2026년 8월 31일',
    )
  })

  it('연말·연초 경계를 넘어도 기간의 마지막 순간이 속한 해·달이다', () => {
    expect(periodLabelOf({ cadence: 'monthly', period: { start: kst('2026-12-01T00:00:00'), end: kst('2027-01-01T00:00:00') } })).toBe(
      '2026년 12월',
    )
    expect(periodLabelOf({ cadence: 'daily', period: { start: kst('2026-12-31T00:00:00'), end: kst('2027-01-01T00:00:00') } })).toBe(
      '2026년 12월 31일',
    )
  })

  it('넓힌 기간(17-5)은 끝 쪽이 그 호의 달을 정한다 - 시작이 지난달이어도 표기는 이번 달이다', () => {
    expect(periodLabelOf({ cadence: 'monthly', period: { start: kst('2026-07-15T00:00:00'), end: kst('2026-09-01T00:00:00') } })).toBe(
      '2026년 8월',
    )
  })

  it('기간이 달라지면 표기가 따라 달라진다 - 표기와 기간이 어긋날 수 없다', () => {
    const sep = { cadence: 'monthly' as const, period: { start: kst('2026-09-01T00:00:00'), end: kst('2026-10-01T00:00:00') } }
    expect(periodLabelOf(sep)).toBe('2026년 9월')
    expect(periodLabelOf(sep)).not.toBe(periodLabelOf(MONTHLY_CONTEXT))
  })

  it('한국 시간 기준이다 - UTC로는 전날인 새벽 시각도 한국 날짜로 센다', () => {
    // 2026-08-22T00:00+09:00 = 2026-08-21T15:00Z. 시작이 UTC 날짜 21일이어도 일간 표기는 22일.
    expect(periodLabelOf(DAILY_CONTEXT)).toBe('2026년 8월 22일')
    expect(DAILY_CONTEXT.period.start.getUTCDate()).toBe(21)
  })

  it('길이 0인 기간은 시작 시각으로 센다', () => {
    const t = kst('2026-08-22T10:00:00')
    expect(periodLabelOf({ cadence: 'daily', period: { start: t, end: t } })).toBe('2026년 8월 22일')
  })

  it('날짜가 아닌 값·뒤집힌 기간은 추측하지 않고 던진다', () => {
    const ok = kst('2026-08-01T00:00:00')
    expect(() => periodLabelOf({ cadence: 'monthly', period: { start: new Date(NaN), end: ok } })).toThrow(RangeError)
    expect(() => periodLabelOf({ cadence: 'monthly', period: { start: ok, end: new Date(NaN) } })).toThrow(RangeError)
    expect(() => periodLabelOf({ cadence: 'monthly', period: { start: kst('2026-09-01T00:00:00'), end: ok } })).toThrow(RangeError)
  })

  it('같은 입력이면 같은 표기다 (결정론)', () => {
    const results = new Set(Array.from({ length: 100 }, () => periodLabelOf(MONTHLY_CONTEXT)))
    expect(results.size).toBe(1)
  })
})

describe('맥락에는 기간 표기를 받는 자리가 없다', () => {
  it('periodLabel을 넣으면 컴파일이 안 된다', () => {
    const typeOnly = (): void => {
      const withLabel: CornerContext = {
        coupleId: 'c',
        period: MONTHLY_CONTEXT.period,
        cadence: 'monthly',
        // @ts-expect-error - 기간 표기는 입력이 아니라 기간과 주기에서 만든다(17-0-8)
        periodLabel: '2026년 10월',
      }
      void withLabel
    }
    expect(typeof typeOnly).toBe('function')
  })
})
