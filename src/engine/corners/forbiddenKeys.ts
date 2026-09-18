/**
 * `FORBIDDEN_KEYS` — 코너 생성 파이프라인 런타임 검사 2단계
 * (docs/ONDOLOG_MASTER.md Part 17-0-4, r22 확정).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 *
 * ── 목록의 원본 ───────────────────────────────────────────────────────
 * `docs/ONDOLOG_MASTER.md` Part 17-0-4가 원본이다. `docs/
 * ONDOLOG_CORNER_CONTENT.md` 0-4는 "목록의 원본은 Part 17-0-4"라고만
 * 적고 목록 자체를 복제하지 않는다(산문이 두 곳에 있으면 어긋난다는
 * 이유). 이 파일이 그 유일한 코드 상수다 — 여기 말고 다른 곳에 이
 * 목록을 다시 적지 않는다.
 *
 * ── 왜 키 이름인가 (Part 17-0-4 원문) ─────────────────────────────────
 * 원칙 ①("AI가 판정하지 않는다")은 담을 그릇을 필요로 한다. LLM이
 * 시키지 않은 판정을 하면 그 값을 넣을 키를 스스로 만든다. 값의 내용은
 * 정적으로 검사할 수 없지만 키 이름은 검사할 수 있다.
 *
 * ── 엔진이 계산한 수치는 걸리지 않는다 ────────────────────────────────
 * OVR·일치율·온도는 파이프라인이 주입하며 LLM 출력 스키마에 없다. 이
 * 검사는 **LLM이 반환한 payload**에만 적용한다 — 파이프라인이 나중에
 * 붙이는 엔진 산출 필드는 이 함수의 검사 대상이 아니다(호출 시점의
 * 책임).
 *
 * ── 목록은 늘어난다 ───────────────────────────────────────────────────
 * `forbidden_content` 발생 사례에서 새 키가 관측되면 마스터 PM이 Part
 * 17-0-4에 추가한다. 에이전트가 임의로 늘리지 않는다.
 */

/**
 * Part 17-0-4 표를 갈래별로 그대로 옮긴 것. 순서·구성은 문서와 동일하게
 * 유지한다(대조하기 쉽도록).
 */
const FORBIDDEN_KEYS_BY_CATEGORY = {
  '점수·등급': ['score', 'rating', 'grade', 'rank', 'tier', 'level', 'percentile', '점수', '등급', '순위'],
  '판정·진단': ['verdict', 'judgment', 'evaluation', 'assessment', 'diagnosis', '판정', '진단', '평가'],
  훈수: ['advice', 'recommendation', 'suggestion', 'should', 'tip', '조언', '충고', '제안'],
  결함지목: ['problem', 'issue', 'flaw', 'weakness', 'risk', 'warning', '문제', '약점', '위험'],
  귀책: ['blame', 'fault', 'responsible', 'cause', '탓', '원인', '책임'],
  예언: ['prediction', 'forecast', 'outlook', '예측', '전망'],
  우열: ['winner', 'loser', 'better', 'worse', 'best', 'worst', '승자', '우위'],
} as const

/** 갈래 구분 없이 펼친 목록 — 검사 함수가 실제로 쓰는 형태. */
export const FORBIDDEN_KEYS: readonly string[] = Object.values(FORBIDDEN_KEYS_BY_CATEGORY).flat()

/**
 * 키 이름 비교용 정규화 — "대소문자와 표기법(스네이크·캐멀)을 무시하고
 * 비교한다"(Part 17-0-4)를 구현한다. 소문자화 + 구분자(`_`, `-`) 제거.
 * 캐멀케이스는 애초에 구분자가 없어 소문자화만으로 충분하지만, 스네이크
 * 케이스가 금지어를 다른 단어 사이에 끼워 넣는 경우까지 방어하기 위해
 * 구분자를 함께 제거한다.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '')
}

const NORMALIZED_FORBIDDEN_KEYS: readonly string[] = FORBIDDEN_KEYS.map(normalizeKey)

/** 정규화된 키 이름이 금지 키 중 하나를 부분 문자열로 포함하는지 검사. */
function isForbiddenKeyName(key: string): boolean {
  const normalized = normalizeKey(key)
  return NORMALIZED_FORBIDDEN_KEYS.some((forbidden) => normalized.includes(forbidden))
}

/**
 * LLM이 반환한 객체 트리 전체(중첩 객체·배열 원소 포함)를 순회해 금지
 * 키를 찾는다. 순수 함수 — 입력을 변형하지 않는다.
 *
 * 반환값은 발견된 원본 키 이름의 목록이다(정규화 전 표기 그대로 —
 * `forbidden_content` 사유 기록에 원문이 남아야 원인 추적이 된다).
 * 위반이 없으면 빈 배열을 반환한다(결과가 "위반 없음"을 뜻하려면 그
 * 자체로 판별 가능해야 하므로 `null`을 쓰지 않는다).
 */
export function findForbiddenKeys(value: unknown): string[] {
  const found: string[] = []
  walk(value, found)
  return found
}

function walk(value: unknown, found: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, found)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenKeyName(key)) found.push(key)
      walk(child, found)
    }
  }
}
