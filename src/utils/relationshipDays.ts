/**
 * 사귄 일수(D+N) + 마일스톤 계산 — 순수 함수.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-2 "사귄 일수 표시 규격"
 * (2026-08-25 코디네이터 확정, DECISIONS.md 동일 날짜 항목 참조).
 * `couples.relationship_start_date`(Part 9-1 화면 + /
 * `src/services/coupleApi.ts` `setOrConfirmStartDate`) 기준으로
 * 오늘까지의 일수와 마일스톤(100일·연 단위) 임박 여부를 계산한다.
 *
 * 오프셋(시작일 = 1일차)은 국내 커플 앱 업계 관행(마스터 문서가 직접
 * 언급하는 비교 대상 "비트윈" 등)을 코디네이터가 그대로 확정한 값이다
 * — Part 9-2 문서에 표로 명시돼 있으니 더 이상 자리표시자가 아니다.
 */

/** 'YYYY-MM-DD...' 문자열에서 연/월/일만 취해 UTC 자정 기준 Date로 만든다(시간대 영향 제거). */
function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * 시작일부터 `now`까지의 "N일차"를 계산한다(시작일 = 1일차).
 * `now`를 인자로 받아 테스트 가능하게 하되, 생략 시 실제 현재 시각을 쓴다.
 */
export function computeDaysTogether(startDateIso: string, now: Date = new Date()): number {
  const start = parseDateOnly(startDateIso)
  const today = parseDateOnly(now.toISOString())
  const diffDays = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY)
  return Math.max(1, diffDays + 1)
}

/** Part 9-2 "사귄 일수 표시 규격" — 마일스톤 단위(100일 단위 / 연 단위). */
const MILESTONE_DAY_STEP = 100
const MILESTONE_YEAR_DAYS = 365
/** Part 9-2 "임박 강조" — 마일스톤 7일 전부터 강조 표시. */
const MILESTONE_LOOKAHEAD_DAYS = 7

export interface MilestoneStatus {
  /** 오늘이 마일스톤 당일인지 (별도 축하 표시 대상). */
  isToday: boolean
  /** 마일스톤이 7일 이내로 임박했는지 (강조 표시 대상). isToday와는 배타적. */
  isUpcoming: boolean
  /** 마일스톤 라벨(예: "100일", "1주년"). 대상 마일스톤이 없으면 null. */
  label: string | null
  /** 마일스톤까지 남은 일수(0 = 당일). 대상 마일스톤이 없으면 null. */
  daysUntil: number | null
}

const NO_MILESTONE: MilestoneStatus = {
  isToday: false,
  isUpcoming: false,
  label: null,
  daysUntil: null,
}

function nextMultipleOf(day: number, step: number): number {
  return Math.ceil(day / step) * step
}

function milestoneLabel(day: number): string {
  if (day % MILESTONE_YEAR_DAYS === 0) {
    const years = day / MILESTONE_YEAR_DAYS
    return years === 1 ? '1주년' : `${years}주년`
  }
  return `${day}일`
}

/**
 * 사귄 일수(`computeDaysTogether`의 결과)를 받아 마일스톤 임박/당일
 * 여부를 계산한다. Part 9-2 "사귄 일수 표시 규격" 표 그대로:
 * 100일 단위 + 연 단위 마일스톤, 7일 전부터 강조, 당일은 별도 표시.
 */
export function getMilestoneStatus(daysTogether: number): MilestoneStatus {
  if (daysTogether <= 0) return NO_MILESTONE

  const nextHundred = nextMultipleOf(daysTogether, MILESTONE_DAY_STEP)
  const nextYear = nextMultipleOf(daysTogether, MILESTONE_YEAR_DAYS)
  const next = Math.min(nextHundred, nextYear)
  const daysUntil = next - daysTogether

  if (daysUntil === 0) {
    return { isToday: true, isUpcoming: false, label: milestoneLabel(next), daysUntil: 0 }
  }
  if (daysUntil <= MILESTONE_LOOKAHEAD_DAYS) {
    return { isToday: false, isUpcoming: true, label: milestoneLabel(next), daysUntil }
  }
  return NO_MILESTONE
}
