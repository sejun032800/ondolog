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
 *   chat_delta ∈ [−10, +25]                        (범위 확정, 산출식 v0 = ROADMAP r158 R158-2 "A′")
 *   total      = clamp(base_score + chat_delta, <하한>, <상한>)
 *
 * 이 파일이 구현하는 세 부분:
 *   ① 기저 점수(`computeDnaBaseScore`) — **완전 구현**, 순수 함수,
 *     throw 없음. `./typeAffinity` 공용 모듈(연애 온도 Part 10-7-2와 공유)로
 *     `typeAffinity` 범주를 얻고, Part 17-2가 정한 세 값 중 하나를 고른다.
 *     규칙 셋 전부 반영: 세 범주 / 어느 목록에도 없으면 중립 / 양방향
 *     판정이 어긋나면 높은 쪽(비대칭 잘 맞음).
 *   ② 채팅 변동분(`computeChatDelta`) — v0(R158-2 A′): 답장 간격 중앙값 리듬 r
 *     (로그 척도) · 주고받기 비율 t(직선)의 평균을 `[−10, +25]`로 옮긴다. 앵커 ·
 *     가중 · 범위는 **인자로만 받는다**(값은 호출부 `loveDna.ts` `DNA_CHAT_DELTA_V0`).
 *     두 지표가 모두 있을 때만 부른다 — 하나라도 없으면 호출부가 "채팅 반영 전"으로
 *     둔다(0으로 채우지 않음). `UNRESOLVED('dnaScore.chatDelta')`는 해소 · 제거됐다.
 *   ③ 결합(`computeDnaTotalScore`) — ①+②를 합쳐 클램프한다.
 *
 * ⚠️ **`chat_delta`는 양이 아니라 질이다.** 다정한 발화 비율, 대화 왕복의
 * 자연스러움, 티키타카 성공률처럼 채팅의 **질**을 재는 값이다. 발화 건수·
 * 메시지 수 같은 **양**이 아니다(Part 17-2 "양이 아니라 질에 가중치",
 * Part 10-7-6 혼동 금지). 연애 온도의 `activityDelta`가 양을 재는 쪽이고,
 * 두 지표를 가르는 것이 정확히 이 차이다. `chat_delta`가 발화량에 반응하기
 * 시작하면 연애 DNA와 연애 온도는 같은 지표가 된다. 이 파일에는 **양 기반
 * 산출을 암시하는 타입·인자·계산이 하나도 없다** — `computeChatDelta`가 받는
 * `ChatQualitySignals`는 답장 간격 중앙값(분포)과 주고받기 비율(비율) 두 칸뿐이며,
 * 건수 필드를 갖지 않는다.
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
import { clamp, roundAndClamp, roundTo } from './numeric'

/**
 * dna_scores.engine_version (text not null, SCHEMA.md §8-4)과 대응.
 *
 * 1.1.0: Part 17-2 확정에 따라 기저 점수(①)·채팅 변동분 소비(②)·결합(③)을
 * 추가했다(이전 1.0.0은 클램프 유틸과 이미-계산된 두 값을 합치는
 * `computeTotalScore`만 보유). 기존 두 함수의 동작·시그니처는 그대로이고
 * 부가 함수만 추가된 하위 호환 변경이라 마이너를 올렸다
 * (`TEMPERATURE_ENGINE_VERSION` 1.0.0→1.1.0 선례와 동일 패턴).
 *
 * 1.2.0: `chat_delta` v0(ROADMAP r158 R158-2 A′) — `computeChatDelta`가 throw 대신
 * 값을 낸다(두 지표 · 계수 인자). `UNRESOLVED('dnaScore.chatDelta')` 해소.
 */
export const DNA_SCORE_ENGINE_VERSION = '1.2.0'

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
 * 이 함수는 두 값이 이미 숫자로 주어졌다고 가정한다 — 그래서 결합
 * 산술(합·클램프) 자체는 임의의 합성 점수로 완전히 단위 테스트할 수 있다.
 * 성격 · 채팅 신호에서 바로 내는 진입점은 `computeDnaTotalScore`다.
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
 * ② 채팅 변동분 (Part 17-2) — 범위 [−10, +25] · v0 산출식 = ROADMAP r158
 * R158-2 "A′". 앵커 · 가중 · 범위는 전부 인자(`ChatDeltaCoefficients`).
 * ──────────────────────────────────────────────────────────────────── */

/**
 * 채팅의 **질** 신호 — v0는 두 지표(R157-3 · R158-2). 둘 다 `chatMetrics.ts`가
 * 계산한 **분포 · 비율**이다(R157-4: "양 금지" = 절대량 금지).
 *
 * ⚠️ 이 타입은 발화 건수·메시지 수 같은 **양** 필드를 절대 갖지 않는다.
 * 양에 반응하는 순간 연애 DNA가 연애 온도의 `activityDelta`와 같은 지표가
 * 된다(Part 10-7-6). 다정한 발화 비율은 채팅 태깅(LLM)이 생긴 뒤 v1에서 더한다.
 */
export interface ChatQualitySignals {
  /** 왕복 리듬 — 답장 간격 중앙값(초, 0 이상). `chatMetrics` `replyGap.all.median`. */
  readonly replyGapMedianSeconds: number
  /** 주고받기 비율(0~1). `chatMetrics` `turnTaking`. */
  readonly turnTakingRatio: number
}

/** `computeChatDelta`의 계수 — 값은 호출부가 넘긴다(Part 17-2 "계수 출처"). */
export interface ChatDeltaCoefficients {
  /** 리듬 r = 1이 되는 답장 간격(초) 이하 경계. v0 = 60. */
  readonly rhythmFastSeconds: number
  /** 리듬 r = 0이 되는 답장 간격(초) 이상 경계. v0 = 10800(3시간). 그 사이는 로그 척도. */
  readonly rhythmSlowSeconds: number
  /** 주고받기 t = 0이 되는 비율 이하 경계. v0 = 0.2. */
  readonly turnLow: number
  /** 주고받기 t = 1이 되는 비율 이상 경계. v0 = 0.6. 그 사이는 직선. */
  readonly turnHigh: number
  /** 리듬 가중(v0 0.5). 주고받기 가중 = 1 − 이 값. */
  readonly rhythmWeight: number
  /** 두 지표가 모두 0일 때의 값(v0 −10). */
  readonly min: number
  /** 두 지표가 모두 1일 때의 값(v0 +25). */
  readonly max: number
}

/** 리듬 r ∈ [0, 1] — 빠를수록 1. `m ≤ fast` → 1 · `m ≥ slow` → 0 · 그 사이 로그 척도(R158-2). */
export function chatRhythmScore(medianSeconds: number, c: ChatDeltaCoefficients): number {
  if (medianSeconds <= c.rhythmFastSeconds) return 1
  if (medianSeconds >= c.rhythmSlowSeconds) return 0
  const span = Math.log(c.rhythmSlowSeconds) - Math.log(c.rhythmFastSeconds)
  return clamp(1 - (Math.log(medianSeconds) - Math.log(c.rhythmFastSeconds)) / span, 0, 1)
}

/** 주고받기 t ∈ [0, 1] — `T ≤ low` → 0 · `T ≥ high` → 1 · 그 사이 직선(R158-2). */
export function chatTurnScore(ratio: number, c: ChatDeltaCoefficients): number {
  return clamp((ratio - c.turnLow) / (c.turnHigh - c.turnLow), 0, 1)
}

/**
 * 채팅의 질을 `chat_delta`(`[min, max]` = v0 `[−10, +25]`)로 환산한다.
 *
 * `chatDelta = min + (max − min) × (w·r + (1 − w)·t)` — v0: `−10 + 35 × (0.5r + 0.5t)`.
 * 순수 함수 · 결정론. 반올림은 반환 직전 한 번(소수 2자리 - DB `numeric(5,2)`).
 * 두 지표가 모두 있을 때만 부른다 — 없는 지표를 0으로 채우지 않는다(호출부가 "채팅 반영 전"으로 둔다).
 */
export function computeChatDelta(signals: ChatQualitySignals, c: ChatDeltaCoefficients): number {
  const r = chatRhythmScore(signals.replyGapMedianSeconds, c)
  const t = chatTurnScore(signals.turnTakingRatio, c)
  const mix = c.rhythmWeight * r + (1 - c.rhythmWeight) * t
  return roundAndClamp(c.min + (c.max - c.min) * mix, DNA_SCORE_DECIMALS, c.min, c.max)
}

/* ────────────────────────────────────────────────────────────────────
 * ③ 결합 (Part 17-2)
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
  chat: ChatDeltaCoefficients
  clamp: DnaScoreClampBounds
}

/**
 * 연애 DNA 최종 일치율(Part 17-2: `total = clamp(base_score + chat_delta, 50, 100)`).
 *
 * 채팅 두 지표가 다 있을 때의 결합이다. 하나라도 없으면 이 함수를 부르지 않고
 * 기저만 쓴다(`loveDna.ts` — "채팅 반영 전"). 반올림·클램프는 반환 직전 한 번.
 * 백분위·상위% 개념은 인자로도 받지 않는다(절대평가).
 */
export function computeDnaTotalScore(
  coreA: EnneagramCore,
  coreB: EnneagramCore,
  chatQuality: ChatQualitySignals,
  coefficients: DnaTotalScoreCoefficients,
): number {
  const baseScore = computeDnaBaseScore(coreA, coreB, coefficients.base)
  const chatDelta = computeChatDelta(chatQuality, coefficients.chat)
  return roundAndClamp(
    baseScore + chatDelta,
    DNA_SCORE_DECIMALS,
    coefficients.clamp.min,
    coefficients.clamp.max,
  )
}
