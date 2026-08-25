import { calculateAge } from '../../src/utils/age'

describe('calculateAge — 화면 6 만 14세 자동 검증', () => {
  it('생일이 이미 지난 경우 만 나이를 정확히 계산한다', () => {
    expect(calculateAge('2000-01-01', new Date('2026-08-25'))).toBe(26)
  })

  it('생일 당일이면 그 해의 만 나이로 올라간다', () => {
    expect(calculateAge('2012-08-25', new Date('2026-08-25'))).toBe(14)
  })

  it('생일 하루 전이면 아직 만 나이가 오르지 않는다', () => {
    expect(calculateAge('2012-08-26', new Date('2026-08-25'))).toBe(13)
  })

  it('생일 하루 후면 만 나이가 이미 올랐다', () => {
    expect(calculateAge('2012-08-24', new Date('2026-08-25'))).toBe(14)
  })

  it('윤년 2월 29일생 — 평년 기준일에도 정확히 계산한다', () => {
    // 2월 29일생은 평년 기준으로 3/1까지는 생일 전으로 취급된다
    // (monthDiff/dayDiff 비교가 2/28을 "아직 2월"로 보고 dayDiff<0 처리).
    expect(calculateAge('2012-02-29', new Date('2026-02-28'))).toBe(13)
    expect(calculateAge('2012-02-29', new Date('2026-03-01'))).toBe(14)
  })

  it('유효하지 않은 형식이면 던진다', () => {
    expect(() => calculateAge('', new Date('2026-08-25'))).toThrow()
    expect(() => calculateAge('not-a-date', new Date('2026-08-25'))).toThrow()
  })
})
