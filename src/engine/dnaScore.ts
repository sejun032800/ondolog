/**
 * 연애 DNA 일치율 — 결정론적 유틸리티.
 *
 * 근거: docs/ONDOLOG_MASTER.md **Part 17-2 "우리의 연애 DNA (월간)"**
 * (base_score 산출 규격 — 이 파일의 주 근거, 2026-09-02 확정),
 * **Part 10-6-5 유형별 매트릭스**(기저의 입력), **Part 10-7-2 / 17-2
 * 비대칭 처리 규칙**, **Part 16-2 `UNRESOLVED` 레지스트리**,
 * `docs/ONDOLOG_SCHEMA.md` §8-4 `dna_scores`.
 *
 * **절대평가 원칙 (CLAUDE.md, Part 17-2 명시)**: 규준집단 백분위·"상위
 * 몇 %" 표기를 절대 쓰지 않는다. 이 파일의 어떤 함수도 population/백분위
 * 인자를 받지 않는다 — 애초에 그런 매개변수가 존재할 수 없게 시그니처를
 * 설계했다(leagueStats.ts의 percentileRank와 정반대 성격).
 *
 * ── 구조 (Part 17-2 "base_score 산출 규격") ──
 *
 *   base_score = <온도차> | <중립> | <잘 맞음>     (세 값은 인자로 주입)
 *   chat_delta ∈ [−10, +25]                        (범위 확정, 산출식 미확정)
 *   total      = clamp(base_score + chat_delta, <하한>, <상한>)
 *
 * 이 파일이 구현하는 세 부분:
 *   ① 기저 점수(`computeDnaBaseScore`) — **완전 구현**, 순수 함수,
 *     throw 없음. `./typeAffinity` 공용 모듈(연애 온도 Part 10-7-2와 공유)로
 *     `typeAffinity` 범주를 얻고, Part 17-2가 정한 세 값 중 하나를 고른다.
 *     규칙 셋 전부 반영: 세 범주 / 어느 목록에도 없으면 중립 / 양방향
 *     판정이 어긋나면 높은 쪽(비대칭 잘 맞음).
 *   ② 채팅 변동분(`computeChatDelta`) — 범위 `[−10, +25]`만 확정이고
 *     **채팅의 질을 점수로 바꾸는 산출식은 미확정**이다. `UNRESOLVED`
 *     레지스트리의 `dnaScore.chatDelta`(Part 16-2)를 소비한다 — 값을
 *     지어내지 않고 호출 즉시 `UnresolvedConstantError`를 던진다.
 *   ③ 결합(`computeDnaTotalScore`) — ①+②를 합쳐 클램프하는 로직은
 *     구현하지만, 내부에서 ②를 거치므로 **호출 시 `UnresolvedConstantError`로
 *     실패한다**. **이것이 규격이 의도한 정상 상태다**(Part 16-2) — 값이
 *     아니라 throw로 미확정을 표현한다.
 *
 * ⚠️ **`chat_delta`는 양이 아니라 질이다.** 다정한 발화 비율, 대화 왕복의
 * 자연스러움, 티키타카 성공률처럼 채팅의 **질**을 재는 값이다. 발화 건수·
 * 메시지 수 같은 **양**이 아니다(Part 17-2 "양이 아니라 질에 가중치",
 * Part 10-7-6 혼동 금지). 연애 온도의 `activityDelta`가 양을 재는 쪽이고,
 * 두 지표를 가르는 것이 정확히 이 차이다. `chat_delta`가 발화량에 반응하기
 * 시작하면 연애 DNA와 연애 온도는 같은 지표가 된다. 산출식이 미확정이므로
 * 이 파일에는 **양 기반 산출을 암시하는 타입·인자·계산이 하나도 없다** —
 * `computeChatDelta`가 받는 `ChatQualitySignals`는 형태를 확정하지 않은
 * 불투명 타입이며, 건수 필드를 갖지 않는다.
 *
 * ── 계수 주입 규칙 (Part 17-2 "계수 출처와 재현성") ──
 * 기저 세 값과 클램프 경계는 **인자로만 받는다.** `src/engine/` 하위에서
 * DB·네트워크·환경변수에 접근하지 않는다. `app_config` 조회와
 * `dna_scores.breakdown.coeffVersion` 기록은 호출부(서비스 계층)의
 * 책임이며, 이 파일은 계산만 한다. 이 파일에는 DB 읽기·쓰기 코드가 없다.
 *
 * 문서/스키마에 확정된 것:
 *   - `base_score`, `total_score` 범위 하한/상한: 50 / 100
 *     (SCHEMA.md `numeric(5,2)` check 제약). Part 17-2: "clampDnaScore의
 *     하한 50은 안전장치로 남는다. 정상 범위(51~94)가 그 위에 있어
 *     실제로는 발동하지 않는다."
 *   - `total_score`는 구조적으로 `base_score + chat_delta`다
 *     (SCHEMA.md 컬럼 주석 "성격 기반 고정 기저 + 채팅 변동분").
 *   - DB 정밀도: `numeric(5,2)` — 소수 2자리.
 *
 * 갱신: 월간 배치 산출값이다. 앱은 저장값을 읽기만 한다(Part 9-2와 동일
 * 원칙). 이 파일이 export하는 함수는 그 배치 잡에서 쓰일 순수 계산
 * 유틸일 뿐이다.
 */

import type { EnneagramCore } from '../constants/enneagram'
import { resolveTypeAffinity, type TypeAffinityCategory } from './typeAffinity'
import { UNRESOLVED } from './constants/unresolved'
import { roundAndClamp, roundTo } from './numeric'

/**
 * dna_scores.engine_version (text not null, SCHEMA.md §8-4)과 대응.
 *
 * 1.1.0: Part 17-2 확정에 따라 기저 점수(①)·채팅 변동분 소비(②)·결합(③)을
 * 추가했다(이전 1.0.0은 클램프 유틸과 이미-계산된 두 값을 합치는
 * `computeTotalScore`만 보유). 기존 두 함수의 동작·시그니처는 그대로이고
 * 부가 함수만 추가된 하위 호환 변경이라 마이너를 올렸다
 * (`TEMPERATURE_ENGINE_VERSION` 1.0.0→1.1.0 선례와 동일 패턴).
 */
export const DNA_SCORE_ENGINE_VERSION = '1.1.0'

/**
 * 절대평가 하한/상한. `base_score`/`total_score` 둘 다 이 범위를 벗어나지
 * 않는다(SCHEMA.md `numeric(5,2)` check 제약). SDK·기기에 종속되지 않는
 * 구조적 상수이며, 신규 진입점 `computeDnaTotalScore`는 이 값을 하드코딩
 * 하지 않고 클램프 경계를 인자로 받는다 — 아래 두 상수는 그 호출부가
 * 넘길 수 있는 기본값/참조값이다.
 */
export const DNA_SCORE_MIN = 50
export const DNA_SCORE_MAX = 100
/** DB `numeric(5,2)`과 동일한 소수 자릿수. */
export const DNA_SCORE_DECIMALS = 2

/**
 * base_score/total_score를 DB 저장 규격(50~100, 소수 2자리)으로
 * 정규화한다. 이미 계산된 원점수를 규격에 맞추는 유틸이며, 값을 만드는
 * 궁합 공식은 이 함수의 책임이 아니다. 반올림은 이 함수 반환 직전 단
 * 한 번만 적용한다(numeric.ts 정책).
 */
export function clampDnaScore(rawScore: number): number {
  return roundAndClamp(rawScore, DNA_SCORE_DECIMALS, DNA_SCORE_MIN, DNA_SCORE_MAX)
}

/**
 * total_score = base_score + chat_delta, 50~100으로 클램프
 * (SCHEMA.md `dna_scores` 컬럼 주석 "성격 기반 고정 기저 + 채팅
 * 변동분"의 구조를 그대로 구현). base_score와 chat_delta 각각을
 * 만드는 공식은 이 함수의 책임이 아니다 — 호출부가 이미 계산된 두
 * 값을 넘긴다. 백분위·상위% 개념은 인자로도 받지 않는다(절대평가).
 *
 * 이 함수는 두 값이 이미 숫자로 주어졌다고 가정하므로 `UNRESOLVED`를
 * 소비하지 않는다 — 그래서 결합 산술(합·클램프) 자체는 임의의 합성
 * 점수로 완전히 단위 테스트할 수 있다. 실제 파이프라인의 진입점은
 * `computeDnaTotalScore`이며, 그쪽은 ②를 거쳐 호출 시 throw한다.
 */
export function computeTotalScore(
  baseScore: number,
  chatDelta: number,
): number {
  return clampDnaScore(baseScore + chatDelta)
}

/* ────────────────────────────────────────────────────────────────────
 * ① 기저 점수 (Part 17-2 "base_score 산출 규격") — 완전 구현, 순수 함수,
 * throw 없음.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 기저 점수 세 단계 값(Part 17-2: `base_score = <온도차> | <중립> | <잘 맞음>`,
 * 확정값 세 개는 문서에 있으나 **이 파일에 하드코딩하지 않는다**).
 * 호출부가 `app_config`에서 읽어 인자로 주입한다(Part 17-2 "계수 출처와
 * 재현성"). 키는 `TypeAffinityCategory`와 1:1이다 — 온도의
 * `BaselineTemperatureCoefficients`와 같은 형태이지만 값은 서로 다르고,
 * 두 지표의 계수·버전은 분리돼 있다(Part 10-7-6).
 */
export interface DnaBaseScoreCoefficients {
  /** `typeAffinity === 'contrast'`(온도차)일 때의 기저값. */
  contrast: number
  /** `typeAffinity === 'neutral'`(중립)일 때의 기저값. */
  neutral: number
  /** `typeAffinity === 'best'`(잘 맞음)일 때의 기저값. */
  best: number
}

/**
 * 연애 DNA 기저 점수(Part 17-2). 순수 함수 — throw하지 않는다.
 *
 * - `typeAffinity` 범주는 `./typeAffinity`의 `resolveTypeAffinity`로 정한다.
 *   그 함수가 Part 10-6-5 매트릭스를 양방향으로 조회하고, **어느 목록에도
 *   없으면 중립**, **양방향 판정이 어긋나면 높은 쪽**(비대칭 잘 맞음,
 *   Part 10-6-3 / 17-2 "10-7-2와 동일 규칙")을 채택한다. DNA는 이 판정을
 *   그대로 재사용할 뿐 매트릭스를 다시 옮겨 적지 않는다.
 * - 정해진 범주로 `coefficients`에서 대응 세 값 중 하나를 가져온다.
 * - Part 17-2가 "세 값이 모두 60을 넘는다"고 못박은 이유(성격만으로
 *   60 분기에 걸리면 안 된다)는 계수 값 자체의 성질이며, 이 함수는
 *   주입된 값을 그대로 쓴다 — 하한 강제(온도의 36.5 같은)는 없다.
 *   Part 17-2: 정상 범위(51~94)가 `clampDnaScore` 하한 50 위에 있어
 *   기저 단독으로는 클램프가 발동하지 않는다.
 * - 반올림은 이 함수 반환 직전 단 한 번만 적용한다(numeric.ts 정책).
 */
export function computeDnaBaseScore(
  coreA: EnneagramCore,
  coreB: EnneagramCore,
  coefficients: DnaBaseScoreCoefficients,
): number {
  const category: TypeAffinityCategory = resolveTypeAffinity(coreA, coreB)
  return roundTo(coefficients[category], DNA_SCORE_DECIMALS)
}

/* ────────────────────────────────────────────────────────────────────
 * ② 채팅 변동분 (Part 17-2) — 범위 [−10, +25]만 확정, 채팅 질 → 점수
 * 산출식은 UNRESOLVED('dnaScore.chatDelta')를 소비한다.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 채팅의 **질** 신호 묶음. **형태를 확정하지 않은 불투명 타입이다.**
 *
 * Part 17-2가 예시로 든 질 지표(다정한 발화 비율, 대화 왕복의 자연스러움,
 * 티키타카 성공률)를 필드로 고정하는 것조차 `dnaScore.chatDelta` 산출식의
 * 방향을 정하는 일이므로, 해소 전까지는 구조를 비워 둔다.
 *
 * ⚠️ 이 타입은 발화 건수·메시지 수 같은 **양** 필드를 절대 갖지 않는다.
 * 양에 반응하는 순간 연애 DNA가 연애 온도의 `activityDelta`와 같은 지표가
 * 된다(Part 10-7-6). 온도의 `DailyActivityRaw`(`chatMessageCount` 등)와
 * 대비되는 지점이 바로 여기다.
 */
export type ChatQualitySignals = Readonly<Record<string, unknown>>

/**
 * 채팅의 질을 `chat_delta` 점수(`[−10, +25]`)로 환산한다.
 *
 * **미확정** (Part 17-2, `UNRESOLVED` 레지스트리 `dnaScore.chatDelta`,
 * Part 16-2). 범위는 확정이지만 "채팅 질을 몇 점으로 바꾸는가"의 산출식은
 * 실사용 채팅 데이터 없이 정하면 근거 없는 값이 되므로, 이 함수는 값을
 * 지어내지 않고 호출 즉시 `UnresolvedConstantError`를 던진다
 * (`temperature.activityScore`와 같은 시점에 다룬다).
 *
 * 해소되면(캘리브레이션 데이터 확보 후) 이 함수 **본문만** 실제 환산식으로
 * 교체한다 — 호출부(`computeDnaTotalScore`)는 그대로 둔다. 그 교체 시점에
 * `ChatQualitySignals`의 실제 형태도 함께 확정된다. **양(발화 건수)에
 * 반응하는 구현을 넣지 않는다** — Part 17-2 / 10-7-6.
 */
export function computeChatDelta(chatQuality: ChatQualitySignals): number {
  void chatQuality
  return UNRESOLVED({ key: 'dnaScore.chatDelta' })
}

/* ────────────────────────────────────────────────────────────────────
 * ③ 결합 (Part 17-2) — 구현하되, ②가 미확정이므로 호출 시 throw한다.
 * 이것이 규격이 의도한 정상 상태다.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * `total = clamp(base_score + chat_delta, <하한>, <상한>)`의 클램프 경계.
 * Part 17-2 기본값은 50 / 100(`DNA_SCORE_MIN` / `DNA_SCORE_MAX` 참조)이며,
 * 이 값도 인자로 받는다 — `src/engine/` 안에 하드코딩하지 않는다.
 */
export interface DnaScoreClampBounds {
  /** 총점 하한 (문서 기본값 50, SCHEMA check 제약과 동일 — 안전장치). */
  min: number
  /** 총점 상한 (문서 기본값 100). */
  max: number
}

/** `computeDnaTotalScore`가 받는 계수 묶음 — 전부 인자로만 받는다(Part 17-2). */
export interface DnaTotalScoreCoefficients {
  base: DnaBaseScoreCoefficients
  clamp: DnaScoreClampBounds
}

/**
 * 연애 DNA 최종 일치율(Part 17-2: `total = clamp(base_score + chat_delta,
 * 50, 100)`).
 *
 * `chat_delta`가 `computeChatDelta`를 거치므로, 이 함수는 **호출되는 즉시
 * `UnresolvedConstantError`를 던진다**. **이것이 이 함수의 정상 상태다** —
 * "채팅 질 → 점수" 산출식(`dnaScore.chatDelta`)이 해소되기 전까지는
 * 실사용 배치에서 이 함수를 호출해 값을 실사용해서는 안 된다(Part 16-2
 * "해소 전까지 호출부에서 이 계수를 실사용하지 말 것"). 기저 점수만
 * 필요하면 `computeDnaBaseScore`를, 이미 계산된 두 값의 결합만 필요하면
 * `computeTotalScore`를 쓴다 — 둘 다 throw하지 않는다.
 *
 * 반올림·클램프는 `roundAndClamp`로 이 함수 반환 직전 단 한 번만
 * 적용한다(numeric.ts 정책). 백분위·상위% 개념은 인자로도 받지 않는다
 * (절대평가).
 *
 * 해소되면 `computeChatDelta` 본문만 실제 환산식으로 교체하면 되고,
 * 이 함수는 손댈 필요가 없다 — 결합 산술은 이미 최종 식대로 구현돼 있다.
 */
export function computeDnaTotalScore(
  coreA: EnneagramCore,
  coreB: EnneagramCore,
  chatQuality: ChatQualitySignals,
  coefficients: DnaTotalScoreCoefficients,
): number {
  const baseScore = computeDnaBaseScore(coreA, coreB, coefficients.base)
  const chatDelta = computeChatDelta(chatQuality)
  return roundAndClamp(
    baseScore + chatDelta,
    DNA_SCORE_DECIMALS,
    coefficients.clamp.min,
    coefficients.clamp.max,
  )
}
