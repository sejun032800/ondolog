/**
 * "함께한 하루" 판정 — 온도 v0 `recordPart`와 하늘의 별이 같이 쓰는 단일 함수.
 * 근거: MASTER r75 9-8-1(별 = 함께한 하루) · 10-7-3(v0 recordPart), ROADMAP R101-2.
 *
 * 순수 함수. 시계·랜덤·환경 접근 0. 판정이 둘이 되지 않도록 이 파일 밖에서
 * 같은 조건을 다시 쓰지 않는다.
 */

/**
 * 그 날짜(KST `YYYY-MM-DD`)의 데이트 기록 수. **지운 것은 호출부가 뺀다**
 * (지운 `dates` 행의 것은 0, `data_entries.deleted_at` 있는 것은 제외,
 * `date_stops`는 지움 칸이 없으므로 지우지 않은 `dates`에 붙은 행 수).
 */
export interface DayRecordCounts {
  stops: number
  photos: number
  memos: number
}

/**
 * 하나의 수가 "있다(>=1)"인가. 음수·NaN·Infinity가 아닌 비정상 값은 0으로 본다.
 * 이유: 표시용 순수 함수가 던지면 홈 화면이 깨진다. 지운 것을 빼다 생긴
 * 음수(-1) 같은 집계 오차는 "없음"으로 읽는 편이 안전하고, 결정론도 유지된다.
 * (Infinity는 유한이 아니므로 마찬가지로 0.)
 */
function has(n: number): boolean {
  return Number.isFinite(n) && n >= 1
}

/** 구간 · 사진 · 메모 중 하나라도 1 이상이면 함께한 하루. 장소만 있는 날도 true. */
export function isTogetherDay(c: DayRecordCounts): boolean {
  return has(c.stops) || has(c.photos) || has(c.memos)
}

/**
 * 함께한 날짜만 — 같은 날짜가 여럿이면 수를 합산해 판정(중복 합산),
 * 결과는 날짜 문자열 오름차순(`YYYY-MM-DD`는 사전순 = 시간순).
 * 합산 후 판정이므로 입력 순서와 무관하다.
 */
export function togetherDates(days: readonly ({ date: string } & DayRecordCounts)[]): string[] {
  const sums = new Map<string, DayRecordCounts>()
  for (const d of days) {
    const cur = sums.get(d.date) ?? { stops: 0, photos: 0, memos: 0 }
    // 비정상 값은 합산 전에 0으로 정규화(NaN이 합을 오염시키지 않게)
    cur.stops += has(d.stops) ? d.stops : 0
    cur.photos += has(d.photos) ? d.photos : 0
    cur.memos += has(d.memos) ? d.memos : 0
    sums.set(d.date, cur)
  }
  const out: string[] = []
  for (const [date, c] of sums) {
    if (isTogetherDay(c)) out.push(date)
  }
  return out.sort()
}
