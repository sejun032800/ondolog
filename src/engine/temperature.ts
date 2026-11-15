/**
 * 연애 온도 — 결정론적 유틸리티.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-2 "연애 온도" 표(표시 규격),
 * **Part 10-7 "연애 온도 계산 규격 (확정)"**(계산 규격 원본 — Part 9-2는
 * 이 절을 가리키기만 한다), `docs/ONDOLOG_SCHEMA.md` §8-1 `daily_temperature`.
 *
 * Part 10-7이 확정되면서 이전 버전의 "핵심 결합 공식이 문서 어디에도
 * 없다"는 경고는 더 이상 유효하지 않다. 구조는 기저 + 변동(Part 10-7-1):
 *
 *   temperature = clamp(baselineTemperature + activityDelta, 0, 100)
 *
 * 이 파일이 구현하는 세 부분:
 *   ① 기저 온도(`computeBaselineTemperature`) — 완전 구현, 순수 함수,
 *     throw 없음(Part 10-7-2). 유형 궁합 판정은 `./typeAffinity` 공용
 *     모듈(연애 DNA Part 17-2와 공유)에 있고, 그 모듈이
 *     `src/constants/compatibility.ts`의 기존 `COMPATIBILITY` 룩업을 그대로
 *     재사용한다 — 매트릭스를 재작성하지 않는다.
 *   ② 활동 변동분(`computeActivityDeltaV0` 등) — Part 10-7-3 r74 v0
 *     (`activity_v0_provisional`, ROADMAP R100-1)로 하루치 활동 점수를 확정했다.
 *     `UNRESOLVED('temperature.activityScore')`는 해소됐다. 계수는 전부 인자
 *     (기본값 `ACTIVITY_V0_PROVISIONAL_COEFFICIENTS`).
 *   ③ 결합(`computeDailyTemperature`/`computeDailyTemperatureV0`) — ①+②를 합쳐 클램프.
 *
 * 문서에 확정된 것:
 *   - 미연결 커플: 36.5도 고정 (Part 9-2, SCHEMA.md temperature 컬럼 기본값)
 *   - 범위: 0~100 (SCHEMA.md check 제약)
 *   - 갱신: 일 단위 배치가 저장한다. 저장값이 있으면 저장값이 이긴다(앱은 읽기).
 *     저장값이 없을 때만 앱이 이 파일의 순수 함수를 **표시용으로** 호출할 수 있다
 *     (R100-1 · MASTER r74 10-7-3 · 서버 쓰기 0). 배치도 같은 함수를 쓴다.
 *   - DB 정밀도: `numeric(4,1)` — 소수 1자리.
 *
 * 계수 주입 규칙(Part 10-7-5): **모든 임계값·가중치는 인자로만 받는다.**
 * 이 파일 어디에서도 DB·네트워크·환경변수에 접근하지 않는다. 계수 조회와
 * `daily_temperature.factors`에 계수 버전을 기록하는 일은 호출부의
 * 책임이며, 이 파일은 계산만 한다.
 *
 * daily_temperature 테이블에는 `engine_version` 컬럼이 없다
 * (SCHEMA.md §8-1 — stat_snapshots/dna_scores/personality_assessments와
 * 달리 이 테이블만 없음). 그래도 감사 추적을 위해 이 모듈에도 버전
 * 상수를 둔다.
 */

import type { EnneagramCore } from '../constants/enneagram'
import { resolveTypeAffinity, type TypeAffinityCategory } from './typeAffinity'
import { clamp, roundAndClamp, roundTo } from './numeric'

/**
 * 이 유틸 묶음의 버전. daily_temperature 테이블 자체에는 대응 컬럼이 없다(위 설명 참고).
 *
 * 1.1.0: Part 10-7 확정에 따라 기저 온도(①)·활동 변동분 식(②)·결합(③)을
 * 추가했다(이전 1.0.0은 미연결 고정값·클램프 유틸만 보유).
 *
 * 1.2.0: 활동 점수 v0(`activity_v0_provisional`, MASTER r74 10-7-3 · ROADMAP R100-1)로
 * `UNRESOLVED('temperature.activityScore')` 해소. 두 사람 구분 입력(`DailyActivityCounts`)으로 계약 변경.
 */
export const TEMPERATURE_ENGINE_VERSION = '1.2.0'

/** 미연결 커플의 고정 기본 온도 (Part 9-2, SCHEMA.md 컬럼 기본값과 동일). */
export const DISCONNECTED_TEMPERATURE = 36.5

export const TEMPERATURE_MIN = 0
export const TEMPERATURE_MAX = 100
/** DB `numeric(4,1)`과 동일한 소수 자릿수. */
export const TEMPERATURE_DECIMALS = 1

/** 미연결 커플에게 표시할 고정 온도. 인자 없음 — 항상 같은 값. */
export function resolveDisconnectedTemperature(): number {
  return DISCONNECTED_TEMPERATURE
}

/**
 * 이미 계산된 원점수를 DB 저장 규격(0~100, 소수 1자리)으로 정규화한다.
 * 원점수를 만드는 결합 공식 자체는 위 설명대로 문서에 없어 이 파일에
 * 없다 — 이 함수는 "값을 만드는" 함수가 아니라 "값을 규격에 맞추는"
 * 함수다. 반올림은 이 함수 반환 직전 단 한 번만 적용한다.
 */
export function clampTemperature(rawScore: number): number {
  return roundAndClamp(
    rawScore,
    TEMPERATURE_DECIMALS,
    TEMPERATURE_MIN,
    TEMPERATURE_MAX,
  )
}

/* ────────────────────────────────────────────────────────────────────
 * ① 기저 온도 (Part 10-7-2) — 완전 구현, 순수 함수, throw 없음.
 *
 * 유형 궁합 판정(`resolveTypeAffinity` / `TypeAffinityCategory`)은
 * `./typeAffinity` 공용 모듈에 있다(연애 DNA Part 17-2와 공유).
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 기저 온도 세 단계 값(Part 10-7-2: `36.5 (온도차) | 39 (중립) | 42 (잘 맞음)`).
 * 문서 수치를 이 파일에 하드코딩하지 않는다 — 호출부가 `app_config`에서
 * 읽어 인자로 주입한다(Part 10-7-5).
 */
export interface BaselineTemperatureCoefficients {
  /** `typeAffinity === 'contrast'`일 때의 기저값 (문서 기본값 36.5). */
  contrast: number
  /** `typeAffinity === 'neutral'`일 때의 기저값 (문서 기본값 39). */
  neutral: number
  /** `typeAffinity === 'best'`일 때의 기저값 (문서 기본값 42). */
  best: number
}

/**
 * 기저 온도(Part 10-7-2). 순수 함수 — throw하지 않는다.
 *
 * - 양측 애니어그램 코어가 모두 갖춰지지 않으면(`undefined`) **기저를
 *   산출하지 않는다** — 문서 원문 그대로, 값 대신 `undefined`를 반환한다
 *   (에러를 던지지 않는다. 프로파일 미비는 정상적으로 있을 수 있는
 *   상태이지 예외 상황이 아니다).
 * - `typeAffinity` 범주는 `resolveTypeAffinity`(위, 비대칭 시 높은 쪽
 *   채택)로 정하고, `coefficients`에서 대응 값을 가져온다.
 * - **기저는 `DISCONNECTED_TEMPERATURE`(36.5) 아래로 내려가지 않는다**
 *   (Part 10-7-2 하한 규칙). 이 하한은 계수가 아니라 "미연결 기본
 *   체온"이라는 이미 확정된 구조적 상수이므로, 주입된 `coefficients`가
 *   실수로 36.5 미만을 넘겨도 이 함수가 최종 방어선으로 강제한다.
 * - 반올림은 이 함수의 반환 직전 단 한 번만 적용한다(numeric.ts 정책).
 */
export function computeBaselineTemperature(
  coreA: EnneagramCore | undefined,
  coreB: EnneagramCore | undefined,
  coefficients: BaselineTemperatureCoefficients,
): number | undefined {
  if (coreA === undefined || coreB === undefined) {
    return undefined
  }
  const category = resolveTypeAffinity(coreA, coreB)
  const raw = coefficients[category]
  return clamp(roundTo(raw, TEMPERATURE_DECIMALS), DISCONNECTED_TEMPERATURE, Number.POSITIVE_INFINITY)
}

/* ────────────────────────────────────────────────────────────────────
 * ② 활동 변동분 (Part 10-7-3, r74 v0 `activity_v0_provisional`, ROADMAP R100-1)
 *
 * 하루치 활동 점수(dayScore)는 v0 임시 정의로 해소됐다. 베타 실데이터로
 * M3에서 값·비율 모두 다시 정한다. 모든 계수는 인자(10-7-5) — 문서 기본값은
 * `ACTIVITY_V0_PROVISIONAL_COEFFICIENTS` 한 곳에만 있다.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 활동 변동분 계수(Part 10-7-3/10-7-4). 이동창 일수·활동 폭·하한 전부
 * 인자로만 받는다(Part 10-7-5 "모든 임계값·가중치는 매개변수다").
 */
export interface ActivityDeltaCoefficients {
  /** 이동창 일수 (문서 기본값 14). */
  windowDays: number
  /** 활동 폭 상한 (문서 기본값 55). */
  widthCap: number
  /** 활동 변동분 하한 (문서 기본값 0). */
  min: number
}

/** v0 하루치 점수 계수 + 창 계수 묶음. `version`은 `daily_temperature.factors`에 기록할 계수 버전. */
export interface ActivityV0Coefficients extends ActivityDeltaCoefficients {
  version: string
  /** chatPart 가중 (문서 기본값 0.6). */
  chatWeight: number
  /** recordPart 가중 (문서 기본값 0.4). */
  recordWeight: number
  /** 메시지 수 포화점 M (문서 기본값 60). */
  chatSaturation: number
  /** 한 사람만 보낸 날의 배수 (문서 기본값 0.5). */
  singleSenderFactor: number
}

/** MASTER r74 10-7-3 문서 기본값. 호출부가 이 상수나 `app_config` 값을 인자로 주입한다. */
export const ACTIVITY_V0_PROVISIONAL_COEFFICIENTS: Readonly<ActivityV0Coefficients> = {
  version: 'activity_v0_provisional',
  chatWeight: 0.6,
  recordWeight: 0.4,
  chatSaturation: 60,
  singleSenderFactor: 0.5,
  windowDays: 14,
  widthCap: 55,
  min: 0,
}

/** 하루치 원재료. A/B는 커플 두 사람의 그날 보낸 메시지 수(지운 것 제외). */
export interface DailyActivityCounts {
  countA: number
  countB: number
  /** 그날 데이트 기록(구간·사진·메모, 지운 것 제외)이 있는가. */
  hasRecord: boolean
}

/**
 * v0 하루치 활동 점수(0~1).
 * `dayScore = chatWeight × chatPart + recordWeight × recordPart`
 * 0건인 날은 0(건너뛰지 않는다). 반올림 없음 — 합산 후 최종에서 한 번만.
 */
export function computeDailyActivityScore(
  day: DailyActivityCounts | null,
  c: ActivityV0Coefficients,
): number {
  if (day === null) return 0
  const a = Math.max(0, day.countA)
  const b = Math.max(0, day.countB)
  const m = a + b
  let chatPart = 0
  if (m > 0) {
    const both = a > 0 && b > 0
    chatPart = Math.min(1, m / c.chatSaturation) * (both ? 1 : c.singleSenderFactor)
  }
  const recordPart = day.hasRecord ? 1 : 0
  return c.chatWeight * chatPart + c.recordWeight * recordPart
}

/**
 * 활동 변동분 식 — 이미 환산된 하루치 점수 배열을 집계만 한다.
 * `(합 / windowDays) × widthCap`, 하한 min · 상한 widthCap. 분모는 항상 windowDays.
 */
export function computeActivityDeltaFromScores(
  dailyScores: readonly number[],
  coefficients: ActivityDeltaCoefficients,
): number {
  const sum = dailyScores.reduce((total, score) => total + score, 0)
  const raw = (sum / coefficients.windowDays) * coefficients.widthCap
  return clamp(roundTo(raw, TEMPERATURE_DECIMALS), coefficients.min, coefficients.widthCap)
}

/**
 * 날짜별 원재료 슬롯 배열(이미 창에 맞춰 잘라 둔 것)에서 활동 변동분을 낸다.
 * `null` = 그날 데이터 없음 = 점수 0.
 */
export function computeActivityDelta(
  dailyActivities: readonly (DailyActivityCounts | null)[],
  coefficients: ActivityV0Coefficients,
): number {
  const scores = dailyActivities.map((d) => computeDailyActivityScore(d, coefficients))
  return computeActivityDeltaFromScores(scores, coefficients)
}

/* ── KST 날짜 유틸 (UTC+9 고정, 서머타임 없음). 시계 접근 0 — 시각은 전부 인자. ── */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 1970-01-01 기준 일수 (Howard Hinnant days_from_civil). */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

function civilFromDays(z0: number): [number, number, number] {
  const z = z0 + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  )
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp + (mp < 10 ? 3 : -9)
  return [m <= 2 ? y + 1 : y, m, d]
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0')
}

function dayNumberFromKey(key: string): number {
  const m = KEY_RE.exec(key)
  if (m === null) throw new RangeError(`KST 날짜 키는 YYYY-MM-DD여야 한다: "${key}"`)
  return daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3]))
}

function keyFromDayNumber(n: number): string {
  const [y, m, d] = civilFromDays(n)
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`
}

/** ISO 시각(오프셋 포함) → 한국 시간 날짜 키 `YYYY-MM-DD`. 0시 경계는 KST. */
export function kstDayKey(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new RangeError(`ISO 시각을 해석할 수 없다: "${iso}"`)
  return keyFromDayNumber(Math.floor((ms + KST_OFFSET_MS) / MS_PER_DAY))
}

/* ── v0 진입점: 앱이 읽어 온 집계를 받아 표시용으로 부른다 (서버 쓰기 0). ── */

/** 커플 두 사람의 user id. */
export type CoupleUserIds = readonly [string, string]

/** 메시지 한 건: 보낸 사람 id + 보낸 시각(ISO). 지운 메시지는 호출부가 빼고 넘긴다. */
export interface ActivityMessage {
  senderId: string
  sentAt: string
}

/** (KST 날짜 · 사람)별 건수. */
export interface ActivityDailyCount {
  /** KST `YYYY-MM-DD` */
  date: string
  senderId: string
  count: number
}

interface ActivityV0InputBase {
  userIds: CoupleUserIds
  /** KST 오늘 `YYYY-MM-DD`. 창은 어제까지 windowDays일 — 오늘은 넣지 않는다. 앱은 `kstDayKey(nowIso)`로 만든다. */
  todayKst: string
  /** 데이트 기록(구간·사진·메모, 지운 것 제외)이 있는 KST 날짜들(`dates.date_on`). 중복 허용. */
  recordDates: readonly string[]
}

/** 진입점 ①: 메시지 단위 입력. */
export interface ActivityV0MessagesInput extends ActivityV0InputBase {
  messages: readonly ActivityMessage[]
}

/** 진입점 ②: 이미 (KST 날짜 · 사람)별로 센 입력. 같은 키가 여럿이면 합산. */
export interface ActivityV0CountsInput extends ActivityV0InputBase {
  dailyCounts: readonly ActivityDailyCount[]
}

function addTally(
  tally: Map<string, [number, number]>,
  ids: CoupleUserIds,
  date: string,
  senderId: string,
  n: number,
): void {
  const slot: number = senderId === ids[0] ? 0 : senderId === ids[1] ? 1 : -1
  if (slot < 0) return // 커플 밖 발신자는 무시
  const cur: [number, number] = tally.get(date) ?? [0, 0]
  cur[slot as 0 | 1] += n
  tally.set(date, cur)
}

/** 창(어제까지 windowDays일)의 일별 점수 — 어제부터 거슬러 올라가는 순서. */
export function computeDailyScoresV0(
  input: ActivityV0MessagesInput | ActivityV0CountsInput,
  coefficients: ActivityV0Coefficients,
): number[] {
  if (input.userIds[0] === input.userIds[1]) {
    throw new RangeError('커플 두 사람의 user id는 서로 달라야 한다')
  }
  const tally = new Map<string, [number, number]>()
  if ('messages' in input) {
    for (const m of input.messages) {
      addTally(tally, input.userIds, kstDayKey(m.sentAt), m.senderId, 1)
    }
  } else {
    for (const r of input.dailyCounts) {
      addTally(tally, input.userIds, r.date, r.senderId, r.count)
    }
  }
  const today = dayNumberFromKey(input.todayKst)
  const records = new Set(input.recordDates)
  const scores: number[] = []
  for (let i = 1; i <= coefficients.windowDays; i += 1) {
    const key = keyFromDayNumber(today - i)
    const [countA, countB] = tally.get(key) ?? [0, 0]
    scores.push(
      computeDailyActivityScore({ countA, countB, hasRecord: records.has(key) }, coefficients),
    )
  }
  return scores
}

/** v0 활동 변동분(하한 min ~ 상한 widthCap, 소수 1자리). 입력 순서와 무관하다. */
export function computeActivityDeltaV0(
  input: ActivityV0MessagesInput | ActivityV0CountsInput,
  coefficients: ActivityV0Coefficients,
): number {
  return computeActivityDeltaFromScores(computeDailyScoresV0(input, coefficients), coefficients)
}

/* ────────────────────────────────────────────────────────────────────
 * ③ 결합 (Part 10-7-1)
 * ──────────────────────────────────────────────────────────────────── */

/** `computeDailyTemperature`가 받는 계수 묶음 — 전부 인자로만 받는다(Part 10-7-5). */
export interface DailyTemperatureCoefficients {
  baseline: BaselineTemperatureCoefficients
  activity: ActivityDeltaCoefficients
}

/**
 * 일간 최종 온도(`clamp(baseline + activityDelta, 0, 100)`, 소수 1자리).
 * `dailyScores`는 이미 환산된 하루치 점수들(빈 배열 = 활동 0).
 */
export function computeDailyTemperature(
  coreA: EnneagramCore,
  coreB: EnneagramCore,
  dailyScores: readonly number[],
  coefficients: DailyTemperatureCoefficients,
): number {
  const baseline = computeBaselineTemperature(coreA, coreB, coefficients.baseline)
  const baselineValue = baseline ?? DISCONNECTED_TEMPERATURE
  const activityDelta = computeActivityDeltaFromScores(dailyScores, coefficients.activity)
  return clampTemperature(baselineValue + activityDelta)
}

/** v0 계수 + 앱 집계 입력으로 최종 온도를 낸다(저장값이 없을 때 표시용). */
export function computeDailyTemperatureV0(
  coreA: EnneagramCore,
  coreB: EnneagramCore,
  input: ActivityV0MessagesInput | ActivityV0CountsInput,
  coefficients: { baseline: BaselineTemperatureCoefficients; activity: ActivityV0Coefficients },
): number {
  return computeDailyTemperature(
    coreA,
    coreB,
    computeDailyScoresV0(input, coefficients.activity),
    coefficients,
  )
}
