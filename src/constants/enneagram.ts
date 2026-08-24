/**
 * 애니어그램 코어 산출 — 호나이 삼분법 × 하모닉 삼분법 9칸 교차표.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-2-1
 *
 * ```
 * enneagramCore = HORNEVIAN_HARMONIC_TABLE[Q1][Q2]
 * ```
 *
 * 랜덤 요소 없음. 순수 룩업 테이블이며 DB에서 조회하지 않는다(결정론 보호).
 *
 * Q1(호나이 삼분법 — 사회적 전략):
 *   A = 주장형 (Assertive)  3·7·8
 *   B = 순응형 (Compliant)  1·2·6
 *   C = 후퇴형 (Withdrawn)  4·5·9
 *
 * Q2(하모닉 삼분법 — 좌절 대처):
 *   A = 역량형 (Competency)        1·3·5
 *   B = 긍정형 (Positive Outlook)  2·7·9
 *   C = 감정반응형 (Reactive)      4·6·8
 *
 * 주의: MBTI별 애니어그램 사전분포(Part 10-2-6, 희귀 배지·선택지 노출
 * 순서 전용)는 물리적으로 분리된 `./enneagramPrevalence`에 있다.
 * 채점 로직(src/engine/loveTypeInference.ts)이 실수로도 그 파일을
 * import할 수 없도록 이 파일에서 재수출(re-export)하지 않는다.
 */

import type { QuizChoice } from './quizTypes'

export type EnneagramCore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Part 10-2-1 원문 그대로. */
export const HORNEVIAN_HARMONIC_TABLE: Record<
  QuizChoice,
  Record<QuizChoice, EnneagramCore>
> = {
  A: { A: 3, B: 7, C: 8 }, // 주장형
  B: { A: 1, B: 2, C: 6 }, // 순응형
  C: { A: 5, B: 9, C: 4 }, // 후퇴형
}
