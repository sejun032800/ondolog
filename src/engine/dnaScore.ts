/**
 * 연애 DNA 일치율 — 결정론적 유틸리티 (부분 구현, 아래 "미구현" 항목 참고).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 17-2 "일치율 로직", "절대평가",
 * `docs/ONDOLOG_SCHEMA.md` §8-4 `dna_scores`.
 *
 * **절대평가 원칙 (CLAUDE.md, Part 17-2 명시)**: 규준집단 백분위·"상위
 * 몇 %" 표기를 절대 쓰지 않는다. 이 파일의 어떤 함수도 population/백분위
 * 인자를 받지 않는다 — 애초에 그런 매개변수가 존재할 수 없게 시그니처를
 * 설계했다(leagueStats.ts의 percentileRank와 정반대 성격).
 *
 * ⚠️ **base_score(성격 기반 고정 기저) 산출 공식이 문서에 없다.**
 * Part 17-2는 "5문항 산출값(빅5·애니어그램·스턴버그·애착) 조합"이라고만
 * 적혀 있고, 실제 가중치나 두 사람 프로필을 어떻게 결합하는지의 공식이
 * 없다. Part 16-1의 "best/worst 궁합 매트릭스 정의(애니어그램 9×9
 * 기준)"도 미확정 항목으로 남아 있어 궁합 계산의 근거 자체가 아직
 * 없다. Part 16-4도 "채팅 변동분 가중치 설계"를 별도 미확정 항목으로
 * 명시한다. 따라서 두 사람의 성격 프로필 → base_score, 채팅 데이터 →
 * chat_delta를 계산하는 함수는 **이 파일에 구현하지 않는다** — 지어낸
 * 궁합 가중치를 코드로 굳히지 않기 위함이다. 최종 보고서에 질문
 * 목록으로 보고한다.
 *
 * 문서/스키마에 확정된 것 (구현 대상):
 *   - `base_score`, `total_score` 범위: 50~100 (SCHEMA.md check 제약,
 *     "하한 50" 지시사항과 일치)
 *   - `total_score`는 구조적으로 `base_score + chat_delta`다
 *     (SCHEMA.md 컬럼 주석 "성격 기반 고정 기저 + 채팅 변동분")
 *   - DB 정밀도: `numeric(5,2)` — 소수 2자리
 */

import { roundAndClamp } from './numeric'

/** dna_scores.engine_version (text not null, SCHEMA.md §8-4)과 대응. */
export const DNA_SCORE_ENGINE_VERSION = '1.0.0'

/** 절대평가 하한. base_score/total_score 둘 다 이 아래로 내려가지 않는다(SCHEMA.md check 제약). */
export const DNA_SCORE_MIN = 50
export const DNA_SCORE_MAX = 100
/** DB `numeric(5,2)`과 동일한 소수 자릿수. */
export const DNA_SCORE_DECIMALS = 2

/**
 * base_score/total_score를 DB 저장 규격(50~100, 소수 2자리)으로
 * 정규화한다. 값을 만드는 궁합 공식 자체는 위 설명대로 문서에 없어
 * 이 파일에 없다. 반올림은 이 함수 반환 직전 단 한 번만 적용한다.
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
 */
export function computeTotalScore(
  baseScore: number,
  chatDelta: number,
): number {
  return clampDnaScore(baseScore + chatDelta)
}
