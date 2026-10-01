/**
 * 소스 코드 문자열에서 주석을 지우는 공용 검사 유틸.
 *
 * 정적 규칙 스위트(`__tests__/`)와 집계 스크립트(`scripts/norm/`)가 소스
 * 코드를 읽어 "실행 코드만" 검사하려고 쓴다. 입력은 항상 소스 코드
 * 문자열이다 — 런타임 데이터에 쓰려고 만든 것이 아니다.
 *
 * `src/`가 아니라 `scripts/lib/`에 둔다: `src/`는 앱 코드 트리이고 정적
 * 규칙의 수집 범위에 들어가, 검사 도구가 자기 자신을 검사하게 된다.
 *
 * ── 줄 주석: URL의 `://`는 줄 주석이 아니다 ───────────────────────────
 * `//` 바로 앞이 `:`이면(URL 스킴 구분자) 줄 주석으로 보지 않는다
 * (부정 후방탐색). 예전 정규식 `/\/\/.*$/gm`은 `'https://...'` 리터럴의
 * 나머지는 물론 같은 줄 뒤쪽 코드까지 주석으로 오인해 지웠고, 그 위반은
 * 검사에 걸리지 않았다(미탐).
 *
 * ── 줄번호 보존 옵션 (기본 꺼짐) ─────────────────────────────────────
 * `preserveLines: true`이면 블록 주석 자리에 개행만 남겨, 결과를 줄 단위로
 * 나눴을 때 원본 파일의 줄번호와 대응한다. 기본값은 꺼짐(블록 주석을
 * 통째로 지움)이다 — 기존 스위트 대부분의 동작이고, 합성 입력의 줄번호를
 * 단언하는 테스트가 있어도 깨지지 않게 한다.
 */

export interface StripCommentsOptions {
  /** true: 블록 주석 자리에 개행만 남긴다(줄번호 보존). 기본 false. */
  readonly preserveLines?: boolean
}

export function stripComments(
  source: string,
  options: StripCommentsOptions = {},
): string {
  const blockStripped = options.preserveLines
    ? source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ''))
    : source.replace(/\/\*[\s\S]*?\*\//g, '')
  return blockStripped.replace(/(?<!:)\/\/.*$/gm, '')
}
