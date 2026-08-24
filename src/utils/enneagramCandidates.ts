/**
 * 화면 7 "애니어그램 코어 설명 + 후보 2개('—일 수도 있어요')" 산출.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-1-2 Q1 산출물 표 —
 *   "Q1 | 호나이 삼분법 | 3 | 애니어그램 후보 3개로 압축 + 빅5 우호성 보정"
 *   "Q2 | 하모닉 삼분법 | 3 | Q1과 교차 → 애니어그램 코어 확정 + 빅5 성실성 보정"
 *
 * 즉 Q1 하나만으로 이미 같은 호나이 그룹(주장형/순응형/후퇴형) 3개
 * 유형으로 좁혀지고, Q2가 그중 하나를 최종 확정한다. "후보 2개"는
 * 지어낸 값이 아니라 이미 채점에 쓰인 같은 호나이 그룹의 나머지 두
 * 유형이다 — `HORNEVIAN_HARMONIC_TABLE`(Part 10-2-1, 결정론 룩업)을
 * 그대로 재사용해 읽기 전용으로 파생시킨다(채점 로직은 건드리지 않는다).
 *
 * 표시 전용 유틸이며 이 파일은 어떤 값도 새로 계산·추측하지 않는다.
 */
import { HORNEVIAN_HARMONIC_TABLE, type EnneagramCore } from '../constants/enneagram'
import type { QuizChoice } from '../constants/quizTypes'

/**
 * 확정된 코어를 제외한, 같은 호나이 그룹(Q1) 나머지 2개 코어를 반환한다.
 * "왜 하필 2개?" — 호나이 그룹은 정확히 3개 유형(예: 주장형 3·7·8)이고
 * 그중 하나가 이미 확정 코어이므로 남는 건 항상 정확히 2개다.
 */
export function getEnneagramCandidates(
  q1: QuizChoice,
  confirmedCore: EnneagramCore,
): EnneagramCore[] {
  const group = Object.values(HORNEVIAN_HARMONIC_TABLE[q1])
  return group.filter((core) => core !== confirmedCore)
}
