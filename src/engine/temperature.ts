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
 *   ② 활동 변동분(`computeActivityDelta`) — 식(Part 10-7-3)은 구현하되,
 *     "하루치 활동 점수"의 정의는 미확정이라
 *     `UNRESOLVED('temperature.activityScore')`를 소비한다
 *     (`computeDailyActivityScore`). 값을 지어내지 않는다.
 *   ③ 결합(`computeDailyTemperature`) — ①+②를 합쳐 클램프하는 로직은
 *     구현하지만, 내부에서 ②를 거치므로 실제 활동 데이터가 있는 호출은
 *     `UnresolvedConstantError`로 실패한다. **이것이 규격이 의도한 정상
 *     상태다**(Part 16-2) — 값이 아니라 throw로 미확정을 표현한다.
 *
 * 문서에 확정된 것:
 *   - 미연결 커플: 36.5도 고정 (Part 9-2, SCHEMA.md temperature 컬럼 기본값)
 *   - 범위: 0~100 (SCHEMA.md check 제약)
 *   - 갱신: 일 단위 배치(자정 Edge Function)만. 앱은 저장값을 읽기만
 *     한다 — 실시간 계산 금지(CLAUDE.md 절대 규칙과 동일 원칙, Part 9-2).
 *     이 파일이 export하는 함수들은 그 배치 잡에서 쓰일 순수 계산
 *     유틸일 뿐, 이 함수를 앱 클라이언트에서 호출하는 코드는 절대
 *     작성하지 않는다.
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
import { UNRESOLVED } from './constants/unresolved'
import { clamp, roundAndClamp, roundTo } from './numeric'

/**
 * 이 유틸 묶음의 버전. daily_temperature 테이블 자체에는 대응 컬럼이 없다(위 설명 참고).
 *
 * 1.1.0: Part 10-7 확정에 따라 기저 온도(①)·활동 변동분 식(②)·결합(③)을
 * 추가했다(이전 1.0.0은 미연결 고정값·클램프 유틸만 보유).
 */
export const TEMPERATURE_ENGINE_VERSION = '1.1.0'

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
 * ② 활동 변동분 (Part 10-7-3) — 식은 구현, "하루치 활동 점수"의 정의는
 * UNRESOLVED('temperature.activityScore')를 소비한다.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * "채팅·피드 건수" 같은 하루치 원시 활동 지표.
 *
 * 필드 구성은 Part 10-7-3 원문("채팅·피드 건수")을 그대로 옮긴 것이며,
 * 이 인터페이스 자체는 문서에 없는 계산식을 지어내지 않는다 — 원시
 * 입력의 "모양"만 표현한다. 실제로 이 값을 점수로 환산하는 규칙은
 * `computeDailyActivityScore`가 `UNRESOLVED`로 소비한다.
 */
export interface DailyActivityRaw {
  chatMessageCount: number
  feedPostCount: number
}

/**
 * 활동 변동분 계수(Part 10-7-3/10-7-4). 이동창 일수·활동 폭·하한 전부
 * 인자로만 받는다 — "고정"이라는 문서 표현은 "커플마다 다르지 않다"는
 * 뜻이지 "엔진 코드에 하드코딩한다"는 뜻이 아니다(Part 10-7-5 "모든
 * 임계값·가중치는 매개변수다").
 */
export interface ActivityDeltaCoefficients {
  /** 이동창 일수 (문서 기본값 14, Part 10-7-3 "이동창 14일 고정"). */
  windowDays: number
  /** 활동 폭 상한 (문서 기본값 55, Part 10-7-4). */
  widthCap: number
  /** 활동 변동분 하한 (문서 기본값 0, Part 10-7-3). */
  min: number
}

/**
 * 원시 활동 지표 하루치를 "하루치 활동 점수"로 환산한다.
 *
 * **미확정** (Part 10-7-3, `UNRESOLVED` 레지스트리 `temperature.activityScore`,
 * Part 16-2). 채팅·피드 건수를 몇 점으로 환산하는지는 실사용 데이터
 * 없이 정하면 근거 없는 값이 되므로, 이 함수는 값을 지어내지 않고
 * 호출 즉시 `UnresolvedConstantError`를 던진다.
 *
 * 해소되면(캘리브레이션 데이터 확보 후) 이 함수 본문만 실제 환산식으로
 * 교체한다 — 호출부(`computeActivityDelta`, `computeDailyTemperature`)는
 * 그대로 둔다.
 */
export function computeDailyActivityScore(raw: DailyActivityRaw): number {
  void raw
  return UNRESOLVED({ key: 'temperature.activityScore' })
}

/**
 * 활동 변동분 식(Part 10-7-3) 그 자체 — 이미 환산된 하루치 점수들의
 * 배열을 받아 집계만 한다.
 *
 * ```
 * activityDelta = (dailyScores 합 / windowDays) × widthCap, 상한 widthCap, 하한 min
 * ```
 *
 * 이 함수는 "하루치 활동 점수"가 이미 숫자로 주어졌다고 가정하므로
 * `UNRESOLVED`를 소비하지 않는다 — 그래서 이 식(분모 고정, 폭 상한,
 * 하한 클램프) 자체는 임의의 합성 점수로 완전히 단위 테스트할 수 있다.
 * "점수를 어떻게 만드는가"는 별도로 미확정이며, 그 경계는
 * `computeDailyActivityScore`/`computeActivityDelta`가 맡는다.
 *
 * 분모(`windowDays`)는 창이 아직 안 찼어도 항상 고정값이다 — 호출부가
 * `dailyScores` 길이를 창 크기에 못 미치게 넘기더라도 이 함수는
 * `windowDays`로만 나눈다(Part 10-7-3 "분모는 항상 14").
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
 * 활동 변동분(Part 10-7-3) — 원시 활동 지표 입력을 받는 진입점.
 *
 * - `dailyActivities`는 이동창의 각 날짜 슬롯을 그대로 나타낸다.
 *   `null`은 "그 날짜에 데이터 자체가 없음"(가입 초기, 창이 아직 차기
 *   전)을 뜻하며 문서 규칙대로 점수 0으로 계산한다(Part 10-7-3 "없는
 *   날은 0으로 계산한다") — 이 경우는 점수 환산식이 필요 없는 자명한
 *   0이므로 `UNRESOLVED`를 소비하지 않는다.
 * - `DailyActivityRaw` 값(실제로 그 날짜에 커플이 존재했고 원시 활동
 *   지표가 있는 경우)은 반드시 `computeDailyActivityScore`를 거치므로,
 *   실활동이 하나라도 섞여 있으면 이 함수는 `UnresolvedConstantError`로
 *   실패한다 — 이것이 ②가 "식은 구현, 점수 정의는 미확정"인 상태를
 *   코드로 표현하는 방식이다. 집계 식 자체는 `computeActivityDeltaFromScores`에
 *   위임한다(재작성하지 않는다).
 */
export function computeActivityDelta(
  dailyActivities: readonly (DailyActivityRaw | null)[],
  coefficients: ActivityDeltaCoefficients,
): number {
  const dailyScores = dailyActivities.map((raw) =>
    raw === null ? 0 : computeDailyActivityScore(raw),
  )
  return computeActivityDeltaFromScores(dailyScores, coefficients)
}

/* ────────────────────────────────────────────────────────────────────
 * ③ 결합 (Part 10-7-1) — 구현하되, ②가 미확정이므로 실활동이 있는
 * 호출은 UNRESOLVED로 실패한다. 이것이 규격이 의도한 정상 상태다.
 * ──────────────────────────────────────────────────────────────────── */

/** `computeDailyTemperature`가 받는 계수 묶음 — 전부 인자로만 받는다(Part 10-7-5). */
export interface DailyTemperatureCoefficients {
  baseline: BaselineTemperatureCoefficients
  activity: ActivityDeltaCoefficients
}

/**
 * 일간 최종 온도(Part 10-7-1: `temperature = clamp(baselineTemperature + activityDelta, 0, 100)`).
 *
 * 이 함수는 양측 애니어그램 코어가 모두 갖춰진, 이미 연결된 커플의
 * 일 단위 배치 계산을 표현한다 — 미연결 커플의 고정 온도는
 * `resolveDisconnectedTemperature`가 별도로 처리하며 이 함수의 대상이
 * 아니다.
 *
 * `activityDelta`가 `computeActivityDelta` → `computeDailyActivityScore`를
 * 거치므로, `dailyActivities`에 실제 활동(`DailyActivityRaw`)이 하나라도
 * 있으면 이 함수는 `UnresolvedConstantError`를 던진다. **이것이 이
 * 함수의 정상 상태다** — 하루치 활동 점수의 정의가 해소되기 전까지는
 * 실사용 배치에서 이 함수를 호출해 값을 실사용해서는 안 된다(Part
 * 16-2 "해소 전까지 호출부에서 이 계수를 실사용하지 말 것").
 */
export function computeDailyTemperature(
  coreA: EnneagramCore,
  coreB: EnneagramCore,
  dailyActivities: readonly (DailyActivityRaw | null)[],
  coefficients: DailyTemperatureCoefficients,
): number {
  const baseline = computeBaselineTemperature(coreA, coreB, coefficients.baseline)
  // coreA/coreB가 필수 인자이므로 computeBaselineTemperature는 이 경로에서
  // 절대 undefined를 반환하지 않는다(프로파일 미비 분기는 ①의 시그니처가
  // optional을 받을 때만 발생). 그래도 ①의 반환 타입은 `number | undefined`를
  // 유지해야 하므로(그 함수 자체의 계약, 위 참고), 여기서는 `!` 대신
  // 도달 불가능한 방어적 fallback으로 타입을 좁힌다.
  const baselineValue = baseline ?? DISCONNECTED_TEMPERATURE
  const activityDelta = computeActivityDelta(dailyActivities, coefficients.activity)
  return clampTemperature(baselineValue + activityDelta)
}
