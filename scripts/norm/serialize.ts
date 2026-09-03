/**
 * 규준집단 데이터의 정규 직렬화 — 생성기와 드리프트 감지 테스트가
 * **동일한 함수**로 직렬화해야 "바이트 단위 동일" 비교가 성립한다.
 *
 * `JSON.stringify`는 객체의 삽입 순서대로 키를 쓰고, 숫자는 최단
 * 왕복 표현으로 쓴다. `enumerateNormData()`가 매번 같은 순서로 같은
 * 숫자를 담으므로, 이 함수의 출력도 매번 동일한 바이트열이다.
 */

import type { NormData } from '../../src/engine/normPercentile'

/** 규준 데이터 → 커밋될 JSON 문자열 (2-스페이스 들여쓰기 + 개행 종결). */
export function serializeNormData(data: NormData): string {
  return JSON.stringify(data, null, 2) + '\n'
}
