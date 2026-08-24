/**
 * 연애 유형 5문항 채점 — 결정론적 순수 함수.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-2 (추론 로직), Part 17-3 "애착 축
 * 수치화" (attach_anxiety/attach_avoidance 원시값).
 *
 * 계약 (CLAUDE.md 절대 규칙 2, docs/ONDOLOG_ORCHESTRATION.md engine-dev):
 *   동일 입력 → 항상 동일 출력. Math.random / Date.now() / new Date() /
 *   process.env를 이 파일 어디에서도 쓰지 않는다. 모든 함수는 인자로
 *   받은 값만 읽고, 모듈 스코프의 가변 상태나 외부 환경을 참조하지 않는다.
 *
 * 경계: MBTI별 애니어그램 사전분포(src/constants/enneagramPrevalence.ts)는
 * 여기서 import하지 않는다 — Part 10-2-6에 따라 그 상수는 "희귀 조합"
 * 배지 표시와 선택지 노출 순서에만 쓰이고 채점에는 절대 관여하지 않는다.
 * `__tests__/engine/importBoundary.test.ts`가 이 파일 소스에
 * 'enneagramPrevalence' / 'MBTI_ENNEAGRAM_PREVALENCE' 문자열이 없는지
 * 정적으로 검사해 강제한다.
 *
 * 반올림 정책: 모든 산출 필드는 정수(smallint, DB 컬럼 SCHEMA.md §4-1
 * 기준)다. 중간 계산은 전부 정수 가감(+8, +25 등)이라 누적 오차가 생길
 * 수 없지만, 계약을 명시적으로 지키기 위해 각 필드마다 최종 출력
 * 직전 단 한 번만 `clampInt`(반올림 + 0~100 클램프)를 적용한다. 중간
 * 함수(computeBig5, computeSternberg 등) 내부에서 재반올림하지 않는다.
 */

import {
  ATTACHMENT_AXIS_SCORE,
  ATTACHMENT_TABLE,
  MERGE_MID_TO_LOW,
  Q3_ANXIETY_AXIS,
  Q5_AVOIDANCE_AXIS,
  type AttachmentType,
} from '../constants/attachment'
import {
  HORNEVIAN_HARMONIC_TABLE,
  type EnneagramCore,
} from '../constants/enneagram'
import {
  ATTACHMENT_ABBR,
  ENNEAGRAM_CORE_ABBR,
} from '../constants/loveTypeLabels'
import { QUICK_MBTI_AXIS_MAP, type QuickMbtiAnswers } from '../constants/quickMbti'
import type { MbtiType, QuizChoice } from '../constants/quizTypes'

/**
 * 이 모듈 산출 결과의 채점 로직 버전.
 * `personality_assessments.engine_version` / `personality_profiles`가
 * 참조하는 값과 동일해야 한다(text not null, SCHEMA.md §4-1/§4-2).
 * 로직을 바꾸면 이 값을 올리고, 과거 assessment 행은 그대로 둔다
 * (불변 로그 — SCHEMA.md 0-2).
 */
export const LOVE_TYPE_ENGINE_VERSION = '1.0.0'

export interface Big5Scores {
  bigE: number
  bigO: number
  bigA: number
  bigC: number
  bigN: number
}

export interface SternbergScores {
  intimacy: number
  passion: number
  commitment: number
}

export interface LoveTypeInput {
  mbti: MbtiType
  q1: QuizChoice
  q2: QuizChoice
  q3: QuizChoice
  q4: QuizChoice
  q5: QuizChoice
}

export interface LoveTypeInferenceResult {
  engineVersion: string
  enneagramCore: EnneagramCore
  big5: Big5Scores
  sternberg: SternbergScores
  attachAnxiety: number
  attachAvoidance: number
  attachment: AttachmentType
  loveTypeCode: string
}

/** 정수 반올림 + [min,max] 클램프. 전 엔진에서 유일한 반올림 지점으로만 쓴다. */
function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * 애니어그램 코어 산출 (Part 10-2-1).
 * `enneagramCore = HORNEVIAN_HARMONIC_TABLE[Q1][Q2]` — 순수 룩업.
 */
export function computeEnneagramCore(
  q1: QuizChoice,
  q2: QuizChoice,
): EnneagramCore {
  return HORNEVIAN_HARMONIC_TABLE[q1][q2]
}

/**
 * 빅5 산출 (Part 10-2-2).
 * 1단계 MBTI 사전값 → 2단계 Q1/Q2 보정(±8 이내) → 3단계 신경성은 Q3 직접
 * 산출 → 4단계 0~100 클램프(이 함수의 반환 직전 단 한 번).
 */
export function computeBig5(
  mbti: MbtiType,
  q1: QuizChoice,
  q2: QuizChoice,
  q3: QuizChoice,
): Big5Scores {
  const bigEBase = mbti[0] === 'E' ? 72 : 28
  const bigOBase = mbti[1] === 'N' ? 71 : 29
  let bigA = mbti[2] === 'F' ? 61 : 39
  let bigC = mbti[3] === 'J' ? 62 : 38
  let bigO = bigOBase

  if (q1 === 'B') bigA += 8 // 순응형 → 우호성 상승
  if (q1 === 'A') bigA -= 8 // 주장형 → 우호성 하락
  if (q2 === 'A') bigC += 8 // 역량형 → 성실성 상승
  if (q2 === 'B') bigO += 5 // 긍정형 → 개방성 소폭 상승

  const bigN = { A: 25, B: 50, C: 78 }[q3]

  return {
    bigE: clampInt(bigEBase, 0, 100),
    bigO: clampInt(bigO, 0, 100),
    bigA: clampInt(bigA, 0, 100),
    bigC: clampInt(bigC, 0, 100),
    bigN: clampInt(bigN, 0, 100),
  }
}

/**
 * 애착 유형 산출 (Part 10-2-3) + 애착 축 수치화 (Part 17-3).
 * anxiety/avoidance 3단계(low/mid/high)를 mid→low 병합해 2×2로 확정하고,
 * 동일한 Q3/Q5 응답에서 attach_anxiety/attach_avoidance 원시값(20/50/85)도
 * 함께 산출한다 — 서로 다른 문항이 아니라 같은 응답의 두 표현이다.
 */
export function computeAttachment(
  q3: QuizChoice,
  q5: QuizChoice,
): {
  attachment: AttachmentType
  attachAnxiety: number
  attachAvoidance: number
} {
  const mergedAnxiety = MERGE_MID_TO_LOW[Q3_ANXIETY_AXIS[q3]]
  const mergedAvoidance = MERGE_MID_TO_LOW[Q5_AVOIDANCE_AXIS[q5]]

  return {
    attachment: ATTACHMENT_TABLE[mergedAnxiety][mergedAvoidance],
    attachAnxiety: clampInt(ATTACHMENT_AXIS_SCORE[q3], 0, 100),
    attachAvoidance: clampInt(ATTACHMENT_AXIS_SCORE[q5], 0, 100),
  }
}

/**
 * 스턴버그 우세 성분 프로파일 산출 (Part 10-2-4).
 * Q4가 우세 성분을 지정(+25), 나머지는 MBTI 보정. 0~100 클램프는
 * 반환 직전 단 한 번만 적용한다.
 */
export function computeSternberg(
  mbti: MbtiType,
  q4: QuizChoice,
): SternbergScores {
  const dominant = { A: 'intimacy', B: 'passion', C: 'commitment' }[q4] as
    | 'intimacy'
    | 'passion'
    | 'commitment'

  const base = { intimacy: 55, passion: 55, commitment: 55 }
  base[dominant] += 25

  if (mbti[3] === 'J') base.commitment += 8 // J → 헌신 상승
  if (mbti[1] === 'N') base.passion += 5 // N → 열정 상승
  if (mbti[2] === 'F') base.intimacy += 8 // F → 친밀 상승

  return {
    intimacy: clampInt(base.intimacy, 0, 100),
    passion: clampInt(base.passion, 0, 100),
    commitment: clampInt(base.commitment, 0, 100),
  }
}

/**
 * 3자 코드 산출 (Part 10-5-4).
 * `loveTypeCode = ENNEAGRAM_ABBR[core] + ATTACHMENT_ABBR[attachment]`
 * 예) MUSE(MS) + FLARE(F) → 'MSF'
 */
export function computeLoveTypeCode(
  core: EnneagramCore,
  attachment: AttachmentType,
): string {
  return ENNEAGRAM_CORE_ABBR[core] + ATTACHMENT_ABBR[attachment]
}

/**
 * 5문항 전체 채점 파이프라인. 다른 모든 compute* 함수를 조합한
 * 최상위 진입점이며, 그 자체로도 순수 함수다(인자만 사용).
 */
export function inferLoveType(input: LoveTypeInput): LoveTypeInferenceResult {
  const { mbti, q1, q2, q3, q4, q5 } = input

  const enneagramCore = computeEnneagramCore(q1, q2)
  const big5 = computeBig5(mbti, q1, q2, q3)
  const sternberg = computeSternberg(mbti, q4)
  const { attachment, attachAnxiety, attachAvoidance } = computeAttachment(
    q3,
    q5,
  )
  const loveTypeCode = computeLoveTypeCode(enneagramCore, attachment)

  return {
    engineVersion: LOVE_TYPE_ENGINE_VERSION,
    enneagramCore,
    big5,
    sternberg,
    attachAnxiety,
    attachAvoidance,
    attachment,
    loveTypeCode,
  }
}

/**
 * 온보딩 화면 3 "MBTI 몰라요" 간이 4문항 경로 (Part 9-1).
 * 4개 축(E/I, S/N, F/T, J/P)을 모두 답하면 예외 없이 16유형 중 정확히
 * 하나의 4글자 코드로 수렴한다 — 2^4 = 16, 축별 매핑이 전수 정의돼
 * 있으므로 도달 불가능한 조합이 없다.
 */
export function resolveMbtiFromQuickQuiz(
  answers: QuickMbtiAnswers,
): MbtiType {
  const code =
    QUICK_MBTI_AXIS_MAP.ei[answers.ei] +
    QUICK_MBTI_AXIS_MAP.sn[answers.sn] +
    QUICK_MBTI_AXIS_MAP.ft[answers.ft] +
    QUICK_MBTI_AXIS_MAP.jp[answers.jp]

  return code as MbtiType
}
