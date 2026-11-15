/** "함께한 하루" 판정 (R101-2). */
import { isTogetherDay, togetherDates } from '../../src/engine/togetherDay'
import { computeActivityDeltaV0, ACTIVITY_V0_PROVISIONAL_COEFFICIENTS as V0 } from '../../src/engine/temperature'

const z = { stops: 0, photos: 0, memos: 0 }

describe('isTogetherDay', () => {
  it('장소만 있는 날 = true', () => expect(isTogetherDay({ ...z, stops: 1 })).toBe(true))
  it('사진만 = true', () => expect(isTogetherDay({ ...z, photos: 1 })).toBe(true))
  it('메모만 = true', () => expect(isTogetherDay({ ...z, memos: 1 })).toBe(true))
  it('모두 0(지운 것만 있던 날) = false', () => expect(isTogetherDay(z)).toBe(false))
  it('음수 · NaN · Infinity는 0으로 본다(던지지 않음)', () => {
    expect(isTogetherDay({ stops: -1, photos: NaN, memos: Infinity })).toBe(false)
    expect(isTogetherDay({ stops: -3, photos: NaN, memos: 2 })).toBe(true)
  })
  it('100회 반복 동일', () => {
    const outs = Array.from({ length: 100 }, () => isTogetherDay({ ...z, stops: 2 }))
    expect(new Set(outs).size).toBe(1)
  })
})

describe('togetherDates', () => {
  it('오름차순 · 함께한 날만', () => {
    expect(
      togetherDates([
        { date: '2026-11-10', ...z, photos: 1 },
        { date: '2026-11-02', ...z, stops: 1 },
        { date: '2026-11-05', ...z },
      ]),
    ).toEqual(['2026-11-02', '2026-11-10'])
  })
  it('중복 날짜는 합산 · 한 번만', () => {
    expect(
      togetherDates([
        { date: '2026-11-03', ...z, memos: 1 },
        { date: '2026-11-03', ...z, photos: 2 },
        { date: '2026-11-04', ...z },
        { date: '2026-11-04', ...z },
      ]),
    ).toEqual(['2026-11-03'])
  })
  it('NaN 행이 같은 날의 정상 행을 오염시키지 않는다', () => {
    expect(
      togetherDates([
        { date: '2026-11-03', stops: NaN, photos: NaN, memos: NaN },
        { date: '2026-11-03', ...z, stops: 1 },
      ]),
    ).toEqual(['2026-11-03'])
  })
  it('입력 순서와 무관 · 100회 동일', () => {
    const d = [
      { date: '2026-11-09', ...z, stops: 1 },
      { date: '2026-11-01', ...z, memos: 1 },
    ]
    const base = togetherDates(d)
    expect(togetherDates([...d].reverse())).toEqual(base)
    const outs = Array.from({ length: 100 }, () => togetherDates(d).join())
    expect(new Set(outs).size).toBe(1)
  })
})

describe('온도 v0 recordPart는 같은 판정을 쓴다', () => {
  const base = { userIds: ['a', 'b'] as const, todayKst: '2026-11-15', dailyCounts: [] }
  it('장소만 있는 날도 0.4/14×55 = 1.6', () => {
    expect(
      computeActivityDeltaV0({ ...base, recordDays: [{ date: '2026-11-12', ...z, stops: 1 }] }, V0),
    ).toBe(1.6)
  })
  it('모두 0인 날은 0', () => {
    expect(computeActivityDeltaV0({ ...base, recordDays: [{ date: '2026-11-12', ...z }] }, V0)).toBe(0)
  })
})
