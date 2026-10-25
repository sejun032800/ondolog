/**
 * 만 나이 계산 — 화면 6 동의 항목 ①(만 14세 이상) 자동 검증용.
 *
 * 근거: docs/ONDOLOG_MASTER.md "화면 6 약관 동의 명세" 6-3 ①
 *   "화면 2에서 수집한 birth_date로 자동 검증한다."
 *
 * 순수 함수다 — `referenceDate`를 인자로 받아 호출부가 "오늘"을 넘긴다
 * (기본값 `new Date()`는 이 파일이 아니라 호출부에서 평가된다). 연애유형
 * 채점 엔진(`src/engine/`)의 "결정론 계약"과는 무관한 화면 UI 검증
 * 로직이라 CLAUDE.md 절대 규칙 2(순수 함수·랜덤/시간 금지)의 대상이
 * 아니다 — 나이는 정의상 오늘 날짜에 의존해야 의미가 있다.
 */

import { kstToday } from './magazine'

/** ISO 'YYYY-MM-DD' 문자열에서 만 나이를 계산한다. */
export function calculateAge(birthDateIso: string, referenceDate: Date): number {
  const [year, month, day] = birthDateIso.split('-').map(Number)
  if (!year || !month || !day) {
    throw new Error(`유효하지 않은 생년월일 형식입니다: ${birthDateIso}`)
  }

  let age = referenceDate.getFullYear() - year
  const monthDiff = referenceDate.getMonth() + 1 - month
  const dayDiff = referenceDate.getDate() - day

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }

  return age
}

/**
 * KST 날짜 기준 만 나이(온보딩 A10 ① 만 14세 자동 판정, R37-6). 기기 시간대와 무관하다 -
 * 오늘은 `kstToday(now)`(UTC+9의 달력 날짜), 생일 당일이면 그 해의 만 나이로 오른다.
 * 형식이 틀리면 던진다(`calculateAge`와 같다).
 */
export function calculateAgeKst(birthDateIso: string, now: Date): number {
  const [year, month, day] = birthDateIso.split('-').map(Number)
  if (!year || !month || !day) {
    throw new Error(`유효하지 않은 생년월일 형식입니다: ${birthDateIso}`)
  }
  const [ty, tm, td] = kstToday(now).split('-').map(Number)
  let age = ty - year
  if (tm < month || (tm === month && td < day)) age -= 1
  return age
}
