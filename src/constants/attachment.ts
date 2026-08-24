/**
 * 애착 유형 산출 — 불안 축(Q3) × 회피 축(Q5) 2×2 교차표.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-2-3
 *
 * ```
 * anxiety   = (Q3 === 'C') ? 'high' : (Q3 === 'B' ? 'mid' : 'low')
 * avoidance = (Q5 === 'C') ? 'high' : (Q5 === 'B' ? 'mid' : 'low')
 *
 * // mid는 low 쪽으로 병합 (4분면 유지)
 * attachment =
 *   anxiety !== 'high' && avoidance !== 'high' ? '안정형'  :
 *   anxiety === 'high' && avoidance !== 'high' ? '불안형'  :
 *   anxiety !== 'high' && avoidance === 'high' ? '회피형'  :
 *                                                '혼란형'
 * ```
 *
 * DB enum(`attachment_type`, src/types/database.ts)에 맞춰 코드값은
 * secure/anxious/avoidant/fearful을 쓴다. Part 10-5-3에 따라 사용자
 * 노출용 표기(불안형·회피형·혼란형)는 재프레이밍되므로 그대로 노출하지
 * 않는다 — 실제 표시 문구는 love_type_labels 룩업(§ loveTypeLabels.ts)을
 * 거친다.
 */

import type { QuizChoice } from './quizTypes'

/** DB attachment_type enum과 동일해야 한다. */
export type AttachmentType = 'secure' | 'anxious' | 'avoidant' | 'fearful'

/** Q3/Q5 원시 3단계 값. mid는 병합 단계에서 low로 합쳐진다. */
export type AxisLevel = 'low' | 'mid' | 'high'

/** 병합 후 4분면 계산에 쓰이는 2단계 값 (mid → low 병합 결과). */
export type MergedAxisLevel = 'low' | 'high'

/** Q3(신경성/불안 축) 선택지 → 3단계 값. Part 10-1-3 Q3 규격 그대로. */
export const Q3_ANXIETY_AXIS: Record<QuizChoice, AxisLevel> = {
  A: 'low',
  B: 'mid',
  C: 'high',
}

/** Q5(애착 회피 축) 선택지 → 3단계 값. Part 10-1-3 Q5 규격 그대로. */
export const Q5_AVOIDANCE_AXIS: Record<QuizChoice, AxisLevel> = {
  A: 'low',
  B: 'mid',
  C: 'high',
}

/** mid → low 병합. 4분면(2×2)을 유지하기 위한 규칙 (Part 10-2-3). */
export const MERGE_MID_TO_LOW: Record<AxisLevel, MergedAxisLevel> = {
  low: 'low',
  mid: 'low',
  high: 'high',
}

/**
 * 애착 축 수치화 (Part 17-3 "애착 축 수치화").
 *
 * ```
 * 애착 불안축 = Q3 응답 → {A: 20, B: 50, C: 85}
 * 애착 회피축 = Q5 응답 → {A: 20, B: 50, C: 85}
 * ```
 *
 * `personality_assessments.attach_anxiety` / `.attach_avoidance`
 * (smallint 0~100, SCHEMA.md §4-1) 컬럼과 leagueStats의 애착 안정성
 * 계산이 공유하는 동일 원시값이다. Q3/Q5의 low/mid/high 3단계
 * (Q3_ANXIETY_AXIS/Q5_AVOIDANCE_AXIS)와 같은 응답에서 나오는 수치
 * 버전일 뿐, 서로 다른 문항이 아니다.
 */
export const ATTACHMENT_AXIS_SCORE: Record<QuizChoice, number> = {
  A: 20,
  B: 50,
  C: 85,
}

/**
 * 애착 2×2 교차표 (Part 10-2-3 원문).
 * 행 = 불안 축(병합 후), 열 = 회피 축(병합 후)
 */
export const ATTACHMENT_TABLE: Record<
  MergedAxisLevel,
  Record<MergedAxisLevel, AttachmentType>
> = {
  low: { low: 'secure', high: 'avoidant' }, // 불안 낮음: 회피 낮음→안정형, 회피 높음→회피형
  high: { low: 'anxious', high: 'fearful' }, // 불안 높음: 회피 낮음→불안형, 회피 높음→혼란형
}

/** 한글 명칭(내부 로직·로그용). Part 10-5-3에 따라 사용자 노출 문구는 아니다. */
export const ATTACHMENT_LABEL_KO: Record<AttachmentType, string> = {
  secure: '안정형',
  anxious: '불안형',
  avoidant: '회피형',
  fearful: '혼란형',
}
