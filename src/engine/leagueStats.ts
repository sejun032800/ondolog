/**
 * 연애리그 6각 스탯 (PUS/EMP/ATT/DEF/TAC/REA) + OVR 120점 캘리브레이션.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 17-3 "6각 스탯 — 5문항 시스템 기반"
 * 및 "OVR 캘리브레이션".
 *
 * 결정론 계약: 이 파일 전체가 순수 함수다. Math.random / Date.now() /
 * new Date() / process.env를 쓰지 않고, 인자로 받은 값만 사용한다.
 *
 * ⚠️ 이 모듈은 Part 17-3에 원문이 있는 부분(6각 스탯 가중합, OVR
 * 캘리브레이션 구간표)만 문서 그대로 구현한다. 문서에 수치가 없는
 * 부분은 절대 임의로 채우지 않고 아래처럼 명시적으로 분리해뒀다:
 *
 * 1. **베이지안 수축(shrinkage) 보정** — "설계 원칙"으로만 언급되고
 *    구체적 파라미터(사전평균, 수축 강도 등)가 없다. 구현하지 않음.
 * 2. **연애 포지션별 가중치** — OVR 처리 순서 ②(피파 포지션별 가중
 *    로직 차용)의 가중치 표가 없다. Part 16-1은 "연애 포지션(애니어그램
 *    ×빅5) 정식 네이밍 체계"를 미확정으로 명시한다. `computeOvrRawScore`는
 *    포지션 가중치 없이 6개 스탯의 단순 평균을 쓰는 자리표시자다.
 * 3. **규준집단 정규화 파라미터** — "초기엔 공개 연구 추정치, 유저 누적
 *    시 자사 데이터로 교체"라고만 되어 있고, 그 추정치 수치(평균/표준
 *    편차 등)가 문서 어디에도 없다. 이 파일은 모집단 파라미터를 지어내지
 *    않는 대신, 호출부가 실제 모집단 원점수 배열을 직접 공급하면 그
 *    데이터만으로 백분위를 산출하는 표준 통계 절차(percentileRank)를
 *    제공한다.
 *
 * 위 3가지는 최종 보고서의 질문 목록으로도 보고한다.
 */

import { roundAndClamp, roundTo, clamp } from './numeric'
import type { QuizChoice } from '../constants/quizTypes'

/**
 * stat_snapshots.engine_version (text not null, SCHEMA.md §8-2)과 대응.
 *
 * 1.0.0 → 2.0.0 (2026-09-02, Part 17-3 갱신): EMP 공식에 애니어그램
 * 순응형(1·2·6) 보너스(0.25)를 신설하고, 기존 세 항(우호성 A·애착
 * 안정성·스턴버그 친밀)의 가중치를 0.4/0.3/0.3 → 0.35/0.2/0.2로
 * 낮췄다. 동일 입력이라도 이전 버전과 다른 EMP 수치를 내는 **호환
 * 불가 변경**이므로 메이저 버전을 올린다(부가 함수 추가였던 1.0.0→
 * 1.1.0 사례의 minor 패턴과 다름).
 */
export const LEAGUE_STATS_ENGINE_VERSION = '2.0.0'

export interface LeagueStatsBig5Input {
  bigE: number
  bigO: number
  bigA: number
  bigC: number
  bigN: number
}

export interface LeagueStatsSternbergInput {
  intimacy: number
  passion: number
  commitment: number
}

export interface SixStatsInput {
  big5: LeagueStatsBig5Input
  sternberg: LeagueStatsSternbergInput
  /** 호나이 삼분법 원 응답 (Part 10-1-3 Q1). 애니어그램 코어가 아니라 이 응답에서 보너스를 직접 도출한다(Part 17-3). */
  q1: QuizChoice
  /** 하모닉 삼분법 원 응답 (Part 10-1-3 Q2). */
  q2: QuizChoice
  /** 0~100. src/engine/loveTypeInference.ts의 computeAttachment() 출력과 동일 정의(Part 17-3 "애착 축 수치화"). */
  attachAnxiety: number
  /** 0~100. 위와 동일. */
  attachAvoidance: number
}

export interface SixStats {
  /** 연애 추진력 */
  pus: number
  /** 감정 공감력 */
  emp: number
  /** 질투·집착력 */
  att: number
  /** 멘탈 회복력 */
  def: number
  /** 밀당 지능 */
  tac: number
  /** 현실 타협력 */
  rea: number
}

/** 삼분법 그룹 소속 0/1 처리 — Part 17-3 "애니어그램 보너스 산출". 소속이면 100, 아니면 0(가중치가 곱해져 0~100 스케일을 유지). */
function groupBonus(belongs: boolean): number {
  return belongs ? 100 : 0
}

/** 애착 안정성 = 100 − (불안축 + 회피축) / 2 (Part 17-3 "애착 축 수치화"). */
export function computeAttachmentStability(
  attachAnxiety: number,
  attachAvoidance: number,
): number {
  return 100 - (attachAnxiety + attachAvoidance) / 2
}

/**
 * 6각 스탯 산출 (Part 17-3 표 그대로, EMP는 2026-09-02 갱신 반영).
 * 6개 항목 전부 가중치 합이 1.0이 되도록 문서에 명시돼 있다
 * (PUS 0.4+0.3+0.3, EMP 0.35+0.2+0.2+0.25, ATT 0.4+0.35+0.25,
 * DEF 0.4+0.3+0.3, TAC 0.35+0.3+0.35, REA 0.5+0.3+0.2).
 *
 * TAC의 세 번째 항 "스턴버그 열정/헌신 비율(0.35)"은 문서에 정확한
 * 변환식이 없다. 나머지 5개 스탯이 전부 "0~100 스케일 항목의 가중평균"
 * 패턴이므로, 같은 패턴을 유지하는 가장 단순한 해석인
 * `passion / (passion + commitment) * 100`(열정이 두 성분 중 차지하는
 * 비중, 0~100)을 썼다. 이 해석은 최종 보고서에 질문 목록으로 별도
 * 보고한다 — 문서에 다른 변환식이 확정되면 이 함수만 교체하면 된다.
 *
 * 반올림은 각 필드마다 반환 직전 단 한 번(`roundAndClamp`)만 적용한다.
 */
export function computeSixStats(input: SixStatsInput): SixStats {
  const { big5, sternberg, q1, q2, attachAnxiety, attachAvoidance } = input

  const assertiveBonus = groupBonus(q1 === 'A') // 주장형(3·7·8) → PUS
  const compliantBonus = groupBonus(q1 === 'B') // 순응형(1·2·6) → EMP (2026-09-02 신설)
  const withdrawnBonus = groupBonus(q1 === 'C') // 후퇴형(4·5·9) → TAC
  const competencyBonus = groupBonus(q2 === 'A') // 역량형(1·3·5) → REA
  const positiveBonus = groupBonus(q2 === 'B') // 긍정형(2·7·9) → DEF
  const reactiveBonus = groupBonus(q2 === 'C') // 반응형(4·6·8) → ATT

  const attachmentStability = computeAttachmentStability(
    attachAnxiety,
    attachAvoidance,
  )

  // 해석: 열정이 열정+헌신 중 차지하는 비중(0~100). 위 문서 참고.
  const passionCommitmentSum = sternberg.passion + sternberg.commitment
  const passionShare =
    passionCommitmentSum === 0
      ? 0
      : (sternberg.passion / passionCommitmentSum) * 100

  const pus = big5.bigE * 0.4 + assertiveBonus * 0.3 + sternberg.passion * 0.3
  const emp =
    big5.bigA * 0.35 +
    attachmentStability * 0.2 +
    sternberg.intimacy * 0.2 +
    compliantBonus * 0.25
  const att = big5.bigN * 0.4 + attachAnxiety * 0.35 + reactiveBonus * 0.25
  const def =
    (100 - big5.bigN) * 0.4 + positiveBonus * 0.3 + attachmentStability * 0.3
  const tac = big5.bigO * 0.35 + withdrawnBonus * 0.3 + passionShare * 0.35
  const rea = big5.bigC * 0.5 + sternberg.commitment * 0.3 + competencyBonus * 0.2

  return {
    pus: roundAndClamp(pus, 0, 0, 100),
    emp: roundAndClamp(emp, 0, 0, 100),
    att: roundAndClamp(att, 0, 0, 100),
    def: roundAndClamp(def, 0, 0, 100),
    tac: roundAndClamp(tac, 0, 0, 100),
    rea: roundAndClamp(rea, 0, 0, 100),
  }
}

/**
 * OVR 원점수 — Part 17-3 처리 순서 ①→②의 자리표시자.
 *
 * 문서 처리 순서: "① 6개 스탯 원점수 → ② 연애 포지션별 가중치 적용해
 * OVR 원점수(피파 포지션별 가중 로직 차용)". ②의 가중치 표가 문서에
 * 없으므로(연애 포지션 네이밍·가중치 자체가 Part 16-1 미확정 항목),
 * 포지션 가중치를 지어내지 않고 6개 스탯의 단순 평균을 원점수로 쓴다.
 * 포지션 가중치가 확정되면 이 함수만 교체하면 된다.
 */
export function computeOvrRawScore(stats: SixStats): number {
  const { pus, emp, att, def, tac, rea } = stats
  return (pus + emp + att + def + tac + rea) / 6
}

/**
 * 규준집단 백분위 산출 — Part 17-3 처리 순서 ③.
 *
 * 문서는 "규준집단 정규화" 원칙만 언급하고 모집단의 평균·표준편차 같은
 * 구체적 파라미터를 주지 않는다. 그 파라미터를 지어내는 대신, 호출부가
 * 실제 모집단 원점수 배열을 공급하면(배치 잡이 SQL로 조회) 표준
 * 백분위수 순위(percentile rank) 공식으로 순수하게 계산한다.
 *
 * `percentile = (모집단 중 rawScore보다 작은 값 개수 + 0.5 × 동점 개수)
 *              / 모집단 크기 × 100`
 *
 * 모집단 배열이 비어 있으면 계산 불가이므로 에러를 던진다(값을 지어내지
 * 않는다). 반올림은 소수 2자리(ovr_percentile numeric(5,2))로 반환
 * 직전 단 한 번만 적용한다.
 */
export function percentileRank(
  rawScore: number,
  populationRawScores: readonly number[],
): number {
  if (populationRawScores.length === 0) {
    throw new Error(
      'percentileRank: populationRawScores must not be empty — no synthetic population is invented.',
    )
  }

  let countLess = 0
  let countEqual = 0
  for (const score of populationRawScores) {
    if (score < rawScore) countLess++
    else if (score === rawScore) countEqual++
  }

  const percentile =
    ((countLess + 0.5 * countEqual) / populationRawScores.length) * 100

  return roundAndClamp(percentile, 2, 0, 100)
}

/**
 * OVR 캘리브레이션 표 (Part 17-3 "OVR 캘리브레이션" 원문 그대로).
 * 만점 120점, 비대칭 우측 꼬리 분포.
 */
export const OVR_CALIBRATION_TABLE = [
  { minPercentile: 0, maxPercentile: 10, minOvr: 40, maxOvr: 70 },
  { minPercentile: 10, maxPercentile: 80, minOvr: 70, maxOvr: 90 },
  { minPercentile: 80, maxPercentile: 95, minOvr: 90, maxOvr: 100 },
  { minPercentile: 95, maxPercentile: 99, minOvr: 100, maxOvr: 110 },
  { minPercentile: 99, maxPercentile: 100, minOvr: 110, maxOvr: 120 },
] as const

/**
 * 백분위 → 최종 OVR 매핑 — Part 17-3 처리 순서 ④.
 *
 * 문서 표는 구간 경계값(백분위 구간 ↔ OVR 구간)만 준다. 구간 안에서
 * 백분위가 연속값으로 들어올 때의 변환식은 명시돼 있지 않으므로,
 * 구간 경계값만 사용하는 선형보간을 썼다(추가 파라미터를 지어내지
 * 않는 최소 가정). 반올림은 정수(smallint, ovr) 기준 반환 직전 단
 * 한 번만 적용한다.
 */
export function mapPercentileToOvr(percentile: number): number {
  const clamped = clamp(percentile, 0, 100)

  const band =
    OVR_CALIBRATION_TABLE.find(
      (b) => clamped >= b.minPercentile && clamped <= b.maxPercentile,
    ) ?? OVR_CALIBRATION_TABLE[OVR_CALIBRATION_TABLE.length - 1]

  const span = band.maxPercentile - band.minPercentile
  const fraction = span === 0 ? 0 : (clamped - band.minPercentile) / span
  const ovr = band.minOvr + fraction * (band.maxOvr - band.minOvr)

  return roundAndClamp(ovr, 0, 0, 120)
}

// roundTo is re-exported for callers that need the same single-rounding-point
// utility this module uses internally (e.g. formatting `delta` fields).
export { roundTo }
