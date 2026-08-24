/**
 * 온보딩 화면 3 — "MBTI 몰라요" 간이 4문항 (Part 9-1).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 3 "간이 4문항" 표
 * (문항 워딩은 문서에 "초안 — 워딩 다듬기 예정"으로 명시돼 있어 UI
 * 텍스트는 여기 옮기지 않는다. 이 상수는 채점에 필요한 A/B → MBTI
 * 글자 매핑만 담는다 — 그 매핑 자체는 초안이 아니라 확정 표다).
 *
 * 지표당 1문항, 총 4문항 이지선다(A/B). 4개 축을 모두 고르면
 * 예외 없이 16유형 중 정확히 하나로 수렴한다(2^4 = 16, 전수 매핑).
 */

export type QuickMbtiChoice = 'A' | 'B'

export interface QuickMbtiAnswers {
  /** 여러 사람과 어울리며 에너지(A=E) vs 소수와 깊게 대화(B=I) */
  ei: QuickMbtiChoice
  /** 구체적 사실·경험 우선(A=S) vs 전체 흐름·가능성 우선(B=N) */
  sn: QuickMbtiChoice
  /** 감정·관계 우선(A=F) vs 논리·원칙 우선(B=T) */
  ft: QuickMbtiChoice
  /** 미리 정해두고 진행(A=J) vs 상황에 따라 유연(B=P) */
  jp: QuickMbtiChoice
}

/** Part 9-1 간이 4문항 표의 A/B → MBTI 글자 매핑. */
export const QUICK_MBTI_AXIS_MAP = {
  ei: { A: 'E', B: 'I' },
  sn: { A: 'S', B: 'N' },
  ft: { A: 'F', B: 'T' },
  jp: { A: 'J', B: 'P' },
} as const
