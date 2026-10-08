/**
 * 기간 표기 - 봉투 `header.periodLabel`을 **기간과 주기에서** 만든다
 * (docs/ONDOLOG_MASTER.md §17-0-8, r46).
 *
 * 표기를 입력이나 맥락으로 따로 받지 않는다. 따로 받으면 기간은 9월인데 표기는 10월인, 두 값이 어긋난
 * 입력이 가능해진다. 원본은 기간 하나이고, 이 함수 하나가 거기서 표기를 만든다.
 *
 * | 주기 | 표기 | 출처 |
 * |---|---|---|
 * | 월간 | `2026년 8월` | CORNER_CONTENT §0-3 예시 |
 * | 일간 | `2026년 8월 22일` | **문서에 일간 표기가 없다.** 월간 표기를 날짜 한 단위로 넓힌 것이다(보고 대상) |
 *
 * 기준 시점은 기간 `[start, end)`의 **마지막 순간**(`end - 1ms`)이다. 17-5처럼 재료가 적어 기간을 앞쪽으로
 * 넓힌 경우에도 그 호의 달은 끝 쪽이 정하기 때문이다. 길이가 0인 기간(`start == end`)은 `start`를 쓴다.
 *
 * 한국 시간은 고정 오프셋 +09:00으로 계산한다 - 실행 환경의 시간대를 읽지 않는다(`timeOfDayLabel.ts`와 같은
 * 이유). 순간에 오프셋을 더한 뒤 `getUTC*`만 읽는다.
 */

/** 표기를 만드는 데 필요한 맥락의 부분. `CornerContext`의 `period`·`cadence`와 같은 모양이다. */
export interface PeriodLabelSource {
  readonly period: { readonly start: Date; readonly end: Date }
  readonly cadence: 'daily' | 'monthly'
}

/** 한국 표준시 고정 오프셋. 일광 절약 시간이 없다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 날짜가 아닌 값·뒤집힌 기간은 추측하지 않고 던진다(`RangeError`). */
export function periodLabelOf(source: PeriodLabelSource): string {
  const start = source.period.start.getTime()
  const end = source.period.end.getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new RangeError('periodLabelOf: 날짜가 아닌 값')
  }
  if (start > end) {
    throw new RangeError('periodLabelOf: 기간의 시작이 끝보다 늦음')
  }
  const reference = end > start ? end - 1 : start
  const inKorea = new Date(reference + KST_OFFSET_MS)
  const year = inKorea.getUTCFullYear()
  const month = inKorea.getUTCMonth() + 1
  if (source.cadence === 'monthly') return `${year}년 ${month}월`
  return `${year}년 ${month}월 ${inKorea.getUTCDate()}일`
}
