/**
 * 시각 변환 - 입력 조립이 DB 값을 입력 레코드의 시각·표기로 바꾸는 형식 변환 함수 모음
 * (docs/ONDOLOG_MASTER.md §17-0-9-E, r49).
 *
 * 규칙은 `timeOfDayLabel.ts`와 같다 - **고정 오프셋 +09:00, 순간에 9시간을 더한 뒤 `getUTC*`만 읽는다.**
 * 실행 환경의 시간대를 읽는 호출(`getHours()`·`toLocale*`·`Intl` 시간대)은 쓰지 않는다. 이 모듈의 함수는
 * `__tests__/functions/timeOfDayLabelTimezone.test.ts`가 시간대 5곳의 자식 프로세스에서 시험한다.
 * 그 시험이 소스를 단독으로 변환해 실행하므로 **이 파일은 import를 갖지 않는다.**
 *
 * ── 이 모듈이 하지 않는 것 (§17-0-9-E "금지는 그대로다") ───────────────────
 * - 시간대 라벨("아침" 등): `timeOfDayLabel`
 * - 기간 판정: `isRecordInPeriod` (`cornerPipeline.ts`)
 * - 기간 라벨("2026년 8월"): `periodLabelOf`
 * 이 셋의 규칙을 여기 다시 짜지 않는다. 아래 `kstShiftMonths`·`kstDateExclusiveUpperBound`는 기간 판정이
 * 아니라 **날짜 산술**이다(§17-0-9-C의 "6개월 간격"·"N년 앞", §17-0-9-B의 날짜 컬럼 조회 범위).
 */

/** 한국 표준시 고정 오프셋. 일광 절약 시간이 없다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function validMs(at: Date, fn: string): number {
  const ms = at.getTime()
  if (Number.isNaN(ms)) throw new RangeError(`${fn}: 날짜가 아닌 값`)
  return ms
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** 한국 시간 달력 날짜 `"2026-08-22"`. */
export function kstDateString(at: Date): string {
  const k = new Date(validMs(at, 'kstDateString') + KST_OFFSET_MS)
  return `${pad(k.getUTCFullYear(), 4)}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`
}

/** 데이트 `date_on`(`"2026-08-22"`) -> 그 날짜의 KST 00:00 순간. 존재하지 않는 날짜는 던진다. */
export function kstDateToInstant(dateOn: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOn)
  if (m === null) throw new RangeError(`kstDateToInstant: YYYY-MM-DD 형식이 아님: ${dateOn}`)
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new RangeError(`kstDateToInstant: 존재하지 않는 날짜: ${dateOn}`)
  }
  return new Date(utc.getTime() - KST_OFFSET_MS)
}

/** 정거장 `arrived_at` -> `"14:20"`. KST 시·분, 두 자리. */
export function kstClockHHmm(at: Date): string {
  const k = new Date(validMs(at, 'kstClockHHmm') + KST_OFFSET_MS)
  return `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}

/** 순간 -> ISO 문자열, 오프셋 `+09:00`. 밀리초가 0이 아닐 때만 `.SSS`를 붙인다. */
export function kstIsoString(at: Date): string {
  const k = new Date(validMs(at, 'kstIsoString') + KST_OFFSET_MS)
  const ms = k.getUTCMilliseconds()
  const fraction = ms === 0 ? '' : `.${pad(ms, 3)}`
  return (
    `${pad(k.getUTCFullYear(), 4)}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}` +
    `T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}:${pad(k.getUTCSeconds())}${fraction}+09:00`
  )
}

/** 출처 표기의 날짜·시각 부분 `"2026.08.22 09:20"` (KST). 라벨("아침 대화 중")은 붙이지 않는다. */
export function kstDisplayStamp(at: Date): string {
  const k = new Date(validMs(at, 'kstDisplayStamp') + KST_OFFSET_MS)
  return (
    `${pad(k.getUTCFullYear(), 4)}.${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())}` +
    ` ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
  )
}

/**
 * KST 달력 기준으로 `months`개월 옮긴다(음수면 과거). 한국 시각의 시·분·초는 그대로 두고, 옮긴 달에 그
 * 일자가 없으면(예: 8월 31일 - 6개월 = 2월 말일) 그 달의 마지막 날로 맞춘다.
 * (§17-0-9-C "6개월은 KST 달력 기준", "기간을 정확히 N년 옮긴 구간")
 */
export function kstShiftMonths(at: Date, months: number): Date {
  const k = new Date(validMs(at, 'kstShiftMonths') + KST_OFFSET_MS)
  const total = k.getUTCFullYear() * 12 + k.getUTCMonth() + months
  const year = Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(k.getUTCDate(), lastDay)
  const shifted = Date.UTC(year, month, day, k.getUTCHours(), k.getUTCMinutes(), k.getUTCSeconds(), k.getUTCMilliseconds())
  return new Date(shifted - KST_OFFSET_MS)
}

/**
 * 날짜 컬럼(`date_on`)에 `lt`로 걸 상한 - "KST 00:00이 `at`보다 이른 날짜"가 전부 상한 아래에 들도록 한다.
 * `at`이 KST 자정이면 그 날짜 자체이고, 아니면 다음 날짜다. 쿼리 범위가 기간보다 좁아지지 않게 하는 값이다
 * (§17-0-9-B). 레코드가 기간 안인지의 판정은 이 값이 아니라 `isRecordInPeriod`가 한다.
 */
export function kstDateExclusiveUpperBound(at: Date): string {
  return kstDateString(new Date(validMs(at, 'kstDateExclusiveUpperBound') + DAY_MS - 1))
}
