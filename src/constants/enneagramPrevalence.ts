/**
 * MBTI별 애니어그램 사전분포 (Part 10-2-6).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-2-6
 *
 * ⚠️ 채점에는 절대 사용하지 않는다 — 오직 결과 화면의 "희귀 조합" 배지
 * 표시와 선택지 노출 순서에만 사용한다 (CLAUDE.md 절대 규칙 2, 마스터
 * 문서 Part 10-2-6 "이 분포는 ... 채점에는 일절 관여하지 않는다" 명시).
 *
 * 물리적 경계: 이 파일은 의도적으로 `src/engine/enneagram.ts`와 분리돼
 * 있고, 어느 쪽도 서로 재수출(re-export)하지 않는다. 채점 로직
 * (src/engine/loveTypeInference.ts)이 이 파일을 import하면 결정론 계약을
 * 위반할 소지가 생기므로 — import 자체가 없어야 한다.
 * `__tests__/engine/importBoundary.test.ts`가 이를 정적으로 검증한다.
 */

import type { EnneagramCore } from './enneagram'

export const MBTI_ENNEAGRAM_PREVALENCE: Record<
  string,
  { top: EnneagramCore[]; rare: EnneagramCore[] }
> = {
  INTJ: { top: [5, 1, 8], rare: [2, 7] },
  INTP: { top: [5, 9, 4], rare: [2, 3] },
  ENTJ: { top: [8, 3, 1], rare: [9, 4] },
  ENTP: { top: [7, 8, 3], rare: [6, 1] },
  INFJ: { top: [4, 1, 9], rare: [7, 8] },
  INFP: { top: [4, 9, 6], rare: [3, 8] },
  ENFJ: { top: [2, 3, 1], rare: [5] },
  ENFP: { top: [7, 4, 2], rare: [6, 1] },
  ISTJ: { top: [1, 6, 5], rare: [7, 4] },
  ISFJ: { top: [6, 2, 9], rare: [7, 8, 3] },
  ESTJ: { top: [8, 3, 1], rare: [9, 4] },
  ESFJ: { top: [2, 6, 3], rare: [5, 8] },
  ISTP: { top: [5, 9, 8], rare: [2, 3] },
  ISFP: { top: [9, 4, 6], rare: [3, 8] },
  ESTP: { top: [7, 8, 3], rare: [1, 5] },
  ESFP: { top: [7, 2, 3], rare: [1, 5] },
}
