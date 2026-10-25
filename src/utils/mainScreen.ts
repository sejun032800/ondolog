/**
 * 메인 탭(U1, `61-`)의 순수 규칙 - 저장소·화면과 무관한 판단만 둔다.
 *
 * - **앱은 온도를 계산하지 않는다.** 저장된 값(`daily_temperature`)을 읽기만 하고, 값이 없을 때의 표시 상태만 고른다
 *   (MASTER 9-2 "표시 상태" 표 다섯 행 = `temperatureDisplay`).
 * - 상태 우선순위는 하나의 함수(`resolveMainState`)다: 미연결(B05) > 기념일 당일(B04) > 새 호 도착(B06) >
 *   기록 없음·저장값 없음(B03) > 온도 있음(B01). 겹칠 때 히어로·칸 배치는 `layoutMain`이 정한다.
 * - 새 호 도착(B06)은 "열어 본 적 없고 `published_at`부터 7일 이내"다. 열었는지는 기기 저장이 알려 주고(`services/issueSeen`),
 *   이 파일은 그 집합을 인자로 받아 판단만 한다.
 * - 날짜는 KST다.
 */
import { DISCONNECTED_TEMPERATURE } from '../engine/temperature'
import type { MilestoneStatus } from './relationshipDays'

// ---------------------------------------------------------------------------
// 온도 표시 상태 (MASTER 9-2 표시 상태 표 - 다섯 행)
// ---------------------------------------------------------------------------

export type TemperatureDisplay =
  /** 미연결 / 연결 + 성격 프로파일 미완: 36.5 고정(발광 없음). */
  | { kind: 'fixed'; reason: 'disconnected' | 'profileIncomplete'; value: number }
  /** 연결 + 활동 0일: "아직 온도를 잴 기록이 없어요". */
  | { kind: 'noRecords' }
  /** 연결 + 활동 있음 + 저장된 온도 없음(r69): "첫 온도는 기록한 다음 날 나와요". 앱이 계산해 채우지 않는다. */
  | { kind: 'awaitingBatch' }
  /** 연결 + 활동 있음 + 저장된 온도 있음: 저장값 그대로. */
  | { kind: 'value'; value: number }

export interface TemperatureInput {
  connected: boolean
  /** 양측 성격 프로파일이 모두 있는가. */
  profilesComplete: boolean
  /** 활동(대화·기록·데이트)이 하루라도 있는가. */
  hasActivity: boolean
  /** `daily_temperature` 최신 저장값. 없으면 null. */
  storedTemperature: number | null
}

/** 표의 위에서부터 읽는다: 미연결 -> 프로파일 미완 -> 활동 0일 -> 저장값 없음 -> 저장값. */
export function temperatureDisplay(input: TemperatureInput): TemperatureDisplay {
  if (!input.connected) return { kind: 'fixed', reason: 'disconnected', value: DISCONNECTED_TEMPERATURE }
  if (!input.profilesComplete) {
    return { kind: 'fixed', reason: 'profileIncomplete', value: DISCONNECTED_TEMPERATURE }
  }
  if (!input.hasActivity) return { kind: 'noRecords' }
  if (input.storedTemperature === null) return { kind: 'awaitingBatch' }
  return { kind: 'value', value: input.storedTemperature }
}

// ---------------------------------------------------------------------------
// 새 호 도착 (B06)
// ---------------------------------------------------------------------------

/** 발행 뒤 이 기간(일) 안에서만 "꽂혔어요"가 보인다. */
export const NEW_ISSUE_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 보이는 조건: 그 호를 뷰어에서 연 적이 없고, `published_at`부터 7일 이내(7일 0시간 0분까지 포함).
 * `publishedAt`을 못 읽으면 보이지 않는다.
 */
export function isNewIssueArrival(input: { publishedAt: string; now: Date; opened: boolean }): boolean {
  if (input.opened) return false
  const published = Date.parse(input.publishedAt)
  if (!Number.isFinite(published)) return false
  return input.now.getTime() - published <= NEW_ISSUE_WINDOW_DAYS * DAY_MS
}

/** 발행된 호들 중 새 호로 보일 가장 최근 호의 id. 없으면 null. */
export function pickNewIssueId(
  issues: readonly { id: string; publishedAt: string }[],
  openedIds: ReadonlySet<string>,
  now: Date,
): string | null {
  const sorted = [...issues].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  for (const issue of sorted) {
    if (isNewIssueArrival({ publishedAt: issue.publishedAt, now, opened: openedIds.has(issue.id) })) return issue.id
  }
  return null
}

// ---------------------------------------------------------------------------
// 상태 우선순위 · 배치
// ---------------------------------------------------------------------------

export type MainStateId = 'B05' | 'B04' | 'B06' | 'B03' | 'B01'

export interface MainStateInput {
  connected: boolean
  temperature: TemperatureDisplay
  /** 오늘이 마일스톤 당일인가. */
  milestoneToday: boolean
  /** 열어 보지 않은 새 호(7일 이내)가 있는가. */
  hasNewIssue: boolean
}

/**
 * 한 화면에 하나: 미연결(B05) > 기념일 당일(B04) > 새 호 도착(B06) > 기록 없음·저장값 없음(B03) > 온도 있음(B01).
 * 연결 + 프로파일 미완(36.5 고정)은 온도 표시가 B01 틀(히어로 숫자)이므로 B01이다.
 */
export function resolveMainState(input: MainStateInput): MainStateId {
  if (!input.connected) return 'B05'
  if (input.milestoneToday) return 'B04'
  if (input.hasNewIssue) return 'B06'
  if (input.temperature.kind === 'noRecords' || input.temperature.kind === 'awaitingBatch') return 'B03'
  return 'B01'
}

/** 히어로 자리에 무엇이 오는가. */
export type MainHero = 'fixedTemperature' | 'milestone' | 'noRecords' | 'awaitingBatch' | 'temperature'

export type MainBlockKey = 'loveType' | 'firstStep' | 'newIssue' | 'lastIssue' | 'issueProgress'

export interface MainBlock {
  key: MainBlockKey
  /** 번호 칸("02", "03")이면 번호, 번호 없는 카드면 null. 히어로는 늘 "01"이다. */
  number: string | null
}

export interface MainLayoutInput extends MainStateInput {
  /** 마일스톤 7일 전부터 당일 전까지인가(당일은 `milestoneToday`). */
  milestoneUpcoming: boolean
  /** 이 커플의 발행된 호 수. */
  publishedCount: number
  /** 다음 호 초안이 있는가(`fn_issue_progress`가 행을 돌려줌). */
  hasDraft: boolean
  /** "지난 호 다시 읽기" 카드가 가리킬 호가 있는가(= 발행된 호 있음, 그리고 새 호 카드와 같은 호가 아님). */
  hasLastIssueCard: boolean
}

export interface MainLayout {
  state: MainStateId
  hero: MainHero
  blocks: MainBlock[]
  /** 히어로 아래 한 줄에 마일스톤 칩(7일 전부터)을 둔다. */
  showMilestoneChip: boolean
  /** B04의 온도 칩: 저장된 온도가 있을 때만. */
  showTemperatureChip: boolean
  showInvite: boolean
}

/**
 * 히어로·칸 배치. 보드(`N-B-Main`)가 정한 배치를 따른다:
 * - 히어로는 B05가 36.5 고정, B04가 기념일 숫자, 그 밖에는 온도 표시 상태가 정한다. **B06은 히어로를 바꾸지 않고**
 *   카드 자리(지난 호 다시 읽기 카드의 자리)를 차지한다(B06 보드).
 * - 번호 칸은 남는 칸 순서로 다시 매긴다. "이번 주" 원문 인용 칸은 MVP에 없다(MVP 조정표).
 * 보드에 없는 겹침(예: B04 당일 + 새 호)은 위 우선순위로 히어로를 고르고 나머지는 칸으로 둔다.
 */
export function layoutMain(input: MainLayoutInput): MainLayout {
  const state = resolveMainState(input)

  if (!input.connected) {
    return {
      state,
      hero: 'fixedTemperature',
      blocks: [{ key: 'loveType', number: '02' }],
      showMilestoneChip: false,
      showTemperatureChip: false,
      showInvite: true,
    }
  }

  const t = input.temperature
  const hero: MainHero =
    state === 'B04'
      ? 'milestone'
      : t.kind === 'fixed'
        ? 'fixedTemperature'
        : t.kind === 'noRecords'
          ? 'noRecords'
          : t.kind === 'awaitingBatch'
            ? 'awaitingBatch'
            : 'temperature'

  const keys: { key: MainBlockKey; numbered: boolean }[] = []
  // 활동이 이미 있으면 "첫 대화 남기기"를 권하지 않는다.
  if (hero === 'noRecords') keys.push({ key: 'firstStep', numbered: true })
  if (input.hasNewIssue) keys.push({ key: 'newIssue', numbered: false })
  else if (input.hasLastIssueCard) keys.push({ key: 'lastIssue', numbered: false })
  // R32-2: 다음 호 카드는 발행된 호가 1권 이상이고 초안이 있을 때만. 0권이면 첫 호 카드(D14와 같은 정보).
  if (input.publishedCount === 0 || input.hasDraft) keys.push({ key: 'issueProgress', numbered: true })

  let next = 2
  const blocks: MainBlock[] = keys.map(({ key, numbered }) => ({
    key,
    number: numbered ? String(next++).padStart(2, '0') : null,
  }))

  return {
    state,
    hero,
    blocks,
    showMilestoneChip: input.milestoneUpcoming,
    showTemperatureChip: state === 'B04' && t.kind === 'value',
    showInvite: false,
  }
}

// ---------------------------------------------------------------------------
// 표시용 문구
// ---------------------------------------------------------------------------

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** "10월 21일 수요일" (KST). 세로 날짜 장식에 쓴다. */
export function formatKstDateLabel(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${WEEKDAYS_KO[kst.getUTCDay()]}요일`
}

/** 마일스톤 칩 문구: "300일 · 2일 남았어요". 칩이 없으면 null. */
export function milestoneChipLabel(milestone: MilestoneStatus | null): string | null {
  if (!milestone || !milestone.isUpcoming || milestone.label === null || milestone.daysUntil === null) return null
  return `${milestone.label} · ${milestone.daysUntil}일 남았어요`
}

/** 기념일 당일 히어로: "300일" -> { number: "300", unit: "일" }, "1주년" -> { number: "1", unit: "주년" }. */
export function splitMilestoneLabel(label: string): { number: string; unit: string } | null {
  const m = /^(\d+)(일|주년)$/.exec(label)
  return m ? { number: m[1], unit: m[2] } : null
}
