/// <reference types="jest" />
import { timeOfDayLabel, TIME_OF_DAY_LABELS, type TimeOfDayLabel } from './timeOfDayLabel.ts'

/**
 * `timeOfDayLabel` — 시간대 라벨(MASTER §17-0-7, r45).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md 범위 4.
 *
 * 이 파일은 경계(§17-0-7 표, 앞쪽 포함·뒤쪽 배타)를 시험한다. **실행 환경의 시간대를 바꿔도 같은 라벨이
 * 나온다**(PM 완료 기준)는 `__tests__/functions/timeOfDayLabelTimezone.test.ts`가 시험한다 - 시간대를 바꾸려면
 * 별도 프로세스가 필요하고(jest 안에서 `process.env.TZ`를 바꿔도 실제 프로세스에 닿지 않는다), 그것은 Node
 * 타입이 있는 루트 범위에서 한다.
 */
/** 한국 시간 `YYYY-MM-DDTHH:mm:ss.SSS`를 +09:00 순간으로 만든다. */
function kst(localIso: string): Date {
  return new Date(`${localIso}+09:00`)
}

/** 표(§17-0-7)를 그대로 옮긴 기대값 - 경계 양쪽. */
const BOUNDARY_CASES: ReadonlyArray<readonly [string, TimeOfDayLabel]> = [
  ['2026-08-22T00:00:00.000', '새벽'],
  ['2026-08-22T04:59:59.999', '새벽'],
  ['2026-08-22T05:00:00.000', '아침'],
  ['2026-08-22T10:59:59.999', '아침'],
  ['2026-08-22T11:00:00.000', '낮'],
  ['2026-08-22T16:59:59.999', '낮'],
  ['2026-08-22T17:00:00.000', '저녁'],
  ['2026-08-22T20:59:59.999', '저녁'],
  ['2026-08-22T21:00:00.000', '밤'],
  ['2026-08-22T23:59:59.999', '밤'],
]

describe('timeOfDayLabel - §17-0-7 표', () => {
  it.each(BOUNDARY_CASES)('한국 시간 %s -> %s (앞쪽 포함, 뒤쪽 배타)', (localIso, expected) => {
    expect(timeOfDayLabel(kst(localIso))).toBe(expected)
  })

  it('문서 예시 - 2026.08.22 09:20은 아침, 23:40은 밤', () => {
    expect(timeOfDayLabel(kst('2026-08-22T09:20:00.000'))).toBe('아침')
    expect(timeOfDayLabel(kst('2026-08-11T23:40:00.000'))).toBe('밤')
  })

  it('라벨 표는 다섯 구간이고 시작 시각이 오름차순이다(문구는 이 한 곳에만 있다)', () => {
    expect(TIME_OF_DAY_LABELS.map((b) => b.label)).toEqual(['새벽', '아침', '낮', '저녁', '밤'])
    expect(TIME_OF_DAY_LABELS.map((b) => b.startHour)).toEqual([0, 5, 11, 17, 21])
  })

  it('UTC 표기로 같은 순간을 줘도 한국 시간 기준이다(UTC 20:00 = 한국 05:00 = 아침)', () => {
    expect(timeOfDayLabel(new Date('2026-08-21T20:00:00.000Z'))).toBe('아침')
    expect(timeOfDayLabel(new Date('2026-08-21T19:59:59.999Z'))).toBe('새벽')
  })

  it('날짜가 아닌 값은 추측하지 않고 던진다', () => {
    expect(() => timeOfDayLabel(new Date('not a date'))).toThrow(RangeError)
  })
})
