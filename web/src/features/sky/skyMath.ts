/**
 * 우리의 하늘(MASTER 9-8) 순수 함수 - 별 크기 · 자리 · 반짝임 주기 · 달 · 기념일 · 끌기 판정. 시계 · 랜덤 없음(같은 입력 -> 같은 출력).
 */
import { addDays } from '@/utils/magazine'
import { getMilestoneStatus } from '@/utils/relationshipDays'

// ---------------------------------------------------------------------------
// 별 크기 - 그날 온도가 그 달 안에서 몇 번째인가(3단계 8 · 5 · 4px)
// ---------------------------------------------------------------------------

export type StarSize = 4 | 5 | 8
export const STAR_SIZE_FALLBACK: StarSize = 5

/**
 * 한 달의 별 크기. 온도 내림차순(같은 값이면 날짜가 이른 쪽이 위)으로 순위 r(0부터)을 매기고,
 * 단계 = floor(r * 3 / n) -> 0: 8px(상위 1/3) · 1: 5px · 2: 4px. 별이 하나면 8px.
 * 온도를 하나라도 알 수 없으면(읽기 실패 · 아직 못 읽음) 그 달은 모두 가운데(5px) - 지어내지 않는다.
 */
export function assignStarSizes(days: readonly { date: string; temperature: number | null }[]): Map<string, StarSize> {
  const out = new Map<string, StarSize>()
  if (days.some((d) => d.temperature === null || !Number.isFinite(d.temperature))) {
    for (const d of days) out.set(d.date, STAR_SIZE_FALLBACK)
    return out
  }
  const ordered = [...days].sort((a, b) => (b.temperature as number) - (a.temperature as number) || a.date.localeCompare(b.date))
  const n = ordered.length
  const TIERS: StarSize[] = [8, 5, 4]
  ordered.forEach((d, r) => out.set(d.date, TIERS[Math.floor((r * 3) / n)]))
  return out
}

/** 그 달에서 가장 따뜻한 날(같은 값이면 이른 날). 온도를 모르면 null. */
export function warmestDate(days: readonly { date: string; temperature: number | null }[]): string | null {
  if (days.length === 0 || days.some((d) => d.temperature === null)) return null
  return [...days].sort((a, b) => (b.temperature as number) - (a.temperature as number) || a.date.localeCompare(b.date))[0].date
}

// ---------------------------------------------------------------------------
// 별 자리 · 반짝임 - 기록 id의 결정론 해시
// ---------------------------------------------------------------------------

/** FNV-1a 32비트. */
export function hashId(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 한 달 지면 안의 자리(%). 머리 · 지평선을 피해 x 8~92 · y 18~74. */
export function starPosition(id: string): { x: number; y: number } {
  return { x: 8 + (hashId(`${id}#x`) % 8401) / 100, y: 18 + (hashId(`${id}#y`) % 5601) / 100 }
}

export const TWINKLE_MIN_S = 2.8
export const TWINKLE_MAX_S = 5.2
/** 반짝임 주기(초) 2.8~5.2. */
export function twinklePeriodSeconds(id: string): number {
  return Math.round((TWINKLE_MIN_S + (hashId(`${id}#t`) % 2401) / 1000) * 1000) / 1000
}
/** 별마다 시작 위치를 달리하는 음수 지연(초). */
export function twinkleDelaySeconds(id: string): number {
  return -((hashId(`${id}#d`) % 5000) / 1000)
}

// ---------------------------------------------------------------------------
// 달 · 달력
// ---------------------------------------------------------------------------

export type Moon = { kind: 'published'; volume: number } | { kind: 'draft' }

/** `YYYY-MM-DD` -> `YYYY-MM`. */
export const monthOf = (date: string): string => date.slice(0, 7)
export const monthNumber = (month: string): number => Number(month.slice(5, 7))
export const dayNumberOf = (date: string): number => Number(date.slice(8, 10))

function nextMonthOf(month: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** 두 달(양 끝 포함) 사이의 모든 달, 오름차순. */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = []
  for (let m = first; m <= last && out.length < 1200; m = nextMonthOf(m)) out.push(m)
  return out
}

/** 그 달의 첫날 · 마지막 날(KST 날짜). */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: addDays(`${nextMonthOf(month)}-01`, -1) }
}

/**
 * 그 달의 달. 그 달에 발행된 호(`issues_public`, 호 기간 시작 달 기준, 여럿이면 번호가 큰 것) = published,
 * 없고 진행 중 초안이 그 달이면 draft, 아니면 null.
 */
export function moonOfMonth(
  month: string,
  published: readonly { periodStart: string; issueNumber: number }[],
  draftPeriodStart: string | null,
): Moon | null {
  const hit = published.filter((i) => monthOf(i.periodStart) === month).sort((a, b) => b.issueNumber - a.issueNumber)[0]
  if (hit) return { kind: 'published', volume: hit.issueNumber }
  if (draftPeriodStart && monthOf(draftPeriodStart) === month) return { kind: 'draft' }
  return null
}

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const
/** `YYYY-MM-DD` -> "토요일". */
export function weekdayKo(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${WEEKDAYS_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}요일`
}

// ---------------------------------------------------------------------------
// 기념일 고리 - 메인의 마일스톤과 같은 규칙(100일 단위 · 365일 단위, 시작일 = 1일차)
// ---------------------------------------------------------------------------

export interface Anniversary {
  /** D+n */
  days: number
  /** KST 날짜 */
  date: string
  /** "200일" · "1주년" */
  label: string
}

/** 사귄 날(1일차) 기준 `untilDate`까지의 기념일들(D+100 · D+200 … 와 365일 단위). 날짜 오름차순. */
export function anniversariesUntil(startDate: string, untilDate: string): Anniversary[] {
  const limit = Math.round((Date.parse(`${untilDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1
  const days = new Set<number>()
  for (let n = 100; n <= limit; n += 100) days.add(n)
  for (let n = 365; n <= limit; n += 365) days.add(n)
  return [...days]
    .sort((a, b) => a - b)
    .map((n) => ({ days: n, date: addDays(startDate, n - 1), label: getMilestoneStatus(n).label ?? `${n}일` }))
}

// ---------------------------------------------------------------------------
// 하늘 열기 - 연결 전엔 열지 않고, 해제 유예 중엔 연다
// ---------------------------------------------------------------------------

export function skyOpenable(status: string, grace: boolean): boolean {
  return status === 'connected' || (status === 'disconnected' && grace)
}

// ---------------------------------------------------------------------------
// B02 끌어내리기
// ---------------------------------------------------------------------------

/** 문턱(손가락이 내려간 거리, px). 이보다 덜 끌고 놓으면 제자리. */
export const PULL_THRESHOLD_PX = 90
export const PULL_DEADZONE_PX = 8
/** 마지막 스크롤 뒤 이 시간 안이면 "스크롤 중"(관성 포함)이라 끌어내리기로 보지 않는다. */
export const PULL_SCROLL_QUIET_MS = 160

export interface PullInput {
  /** 손가락을 댄 때의 scrollTop. */
  startScrollTop: number
  /** 지금 scrollTop. */
  scrollTop: number
  /** 손가락이 아래로 간 거리(px, 위로 가면 음수). */
  dy: number
  /** 이 터치 동안 스크롤 이벤트가 있었는가. */
  scrolledDuring: boolean
  /** 손을 대기 직전까지 스크롤이 이어지고 있었는가(관성). */
  wasScrolling: boolean
}

export interface PullState { active: boolean; offset: number; armed: boolean }

export const NO_PULL: PullState = { active: false, offset: 0, armed: false }

/** 맨 위(scrollTop 0)에서 시작해 한 번도 스크롤되지 않은 아래 방향 끌기만 받는다. */
export function pullState(i: PullInput): PullState {
  if (i.startScrollTop > 0 || i.scrollTop > 0 || i.scrolledDuring || i.wasScrolling) return NO_PULL
  if (i.dy <= PULL_DEADZONE_PX) return NO_PULL
  return { active: true, offset: Math.min(140, Math.round((i.dy - PULL_DEADZONE_PX) * 0.55)), armed: i.dy >= PULL_THRESHOLD_PX }
}
