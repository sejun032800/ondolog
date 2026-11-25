/**
 * 값 검사 최소판 (ROADMAP r124 R124-4) - **온도록(AI)이 쓴 문장 칸**의 길이 상한과 금지 표현.
 * 위임: .claude/state/prompts/phase-7/84-a-dispatch-llm-safety.md §6
 *
 * - 대상은 LLM 출력의 AI 문장 칸뿐이다. 유저 원문(메시지 · 메모)은 고치지도 거르지도 않는다(CLAUDE.md "원문 우선").
 * - 걸리면 골격이 `schema_invalid`로 기록한다 → 기존 정책대로 1회 재요청 → 그래도 걸리면 코너 실패(`pipelineContracts.ts`).
 * - 금지 표현은 **이미 문서에 있는 정책어만** 쓴다(새 단어를 지어내지 않는다 - 근거 줄을 항목 옆에 둔다).
 *   키 이름 검사(`forbiddenKeys.ts`)와 따로다 - 그쪽은 키, 이쪽은 값.
 * - 말투(해요체) 검사는 84-c(R124-4). 길이는 코드포인트로 센다(`storedContent.ts` `codePointLength`와 같은 셈).
 * 순수 함수(시계 · 난수 0).
 */

/** 한 칸의 규칙. `path`는 LLM 출력 안의 경로(`articles[].title` 꼴 - `[]`는 배열의 모든 항목). */
export interface ValueRule {
  readonly path: string
  readonly maxLength: number
}

/**
 * 금지 표현 - 문서에 있는 정책어 그대로(부분 문자열로 찾는다).
 * 근거:
 * - `불안형` · `회피형` · `혼란형`: MASTER §10-5-3 2992줄 "애착 유형명(불안형·회피형·혼란형)을 그대로 쓰면 유저가 상처받고 … 이름은 전부 재프레이밍"
 * - `잘잘못` · `편들기` · `진단` · `훈수`: MASTER §3-7 418~420줄 금지 칸("잘잘못 판정" · "한쪽 편들기" · "관계에 대한 진단·훈수")
 * - `판정` · `평가` · `점수` · `등급` · `순위`: MASTER §17-0-4 금지 키 표의 한국어 항목(코드 원본 `forbiddenKeys.ts:35-36` '점수·등급' · '판정·진단' 갈래) - 원칙 ①
 *   "AI가 판정하지 않는다"를 값에도 적용(R124-4 "진단 · 평가 단어")
 */
export const FORBIDDEN_VALUE_EXPRESSIONS: readonly string[] = [
  '불안형',
  '회피형',
  '혼란형',
  '잘잘못',
  '편들기',
  '진단',
  '훈수',
  '판정',
  '평가',
  '점수',
  '등급',
  '순위',
]

/**
 * 84-g(ROADMAP r143 R143-3 ①) 지면에서 두 사람을 가리키는 낱말 - "두 사람" · "두 분"으로 쓴다(프롬프트 공통 원칙과 같은 기준, R134-1).
 * 부분 문자열로 찾는다("사용자 이름"처럼 붙은 말도 걸림). **따옴표 안 원문 인용은 검사 밖**(84-c `stripQuoted`와 같은 규칙) -
 * 원문 칸(메시지 · 메모)은 애초에 값 규칙의 대상 칸이 아니다. 어기면 위와 같이 재요청 1회 → 빠짐.
 * 위 정책어 목록은 84-a 그대로(따옴표 제외를 새로 더하지 않음).
 */
export const FORBIDDEN_PERSON_EXPRESSIONS: readonly string[] = ['유저', '사용자']

/**
 * 따옴표 안의 글(원문 인용)을 지운다 - `contentChecks.ts` `stripQuoted`와 **같은 따옴표 여섯 쌍**(시험
 * `supabase/functions/_shared/corners/personWords84g.test.ts`가 두 함수의 결과가 같은지 본다). 이 폴더 파일은 서로 가져오지 않는다(Deno는 `.ts` 확장자를
 * 요구하고 루트 tsc는 막는다 - 각 파일이 자기 완결).
 */
const QUOTED: readonly RegExp[] = [/"[^"]*"/g, /'[^']*'/g, /“[^”]*”/g, /‘[^’]*’/g, /「[^」]*」/g, /『[^』]*』/g]
export function withoutQuoted(text: string): string {
  let out = text
  for (const p of QUOTED) out = out.replace(p, ' ')
  return out
}

/** 코드포인트 길이(이모지 한 개 = 1). */
export function codePointCount(value: string): number {
  return Array.from(value).length
}

/** 경로의 값들(문자열만). 없는 칸 · 문자열이 아닌 값은 건너뛴다(모양 검사는 Zod가 한다). */
export function valuesAt(root: unknown, path: string): string[] {
  let current: unknown[] = [root]
  for (const raw of path.split('.')) {
    const isArray = raw.endsWith('[]')
    const key = isArray ? raw.slice(0, -2) : raw
    const next: unknown[] = []
    for (const node of current) {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) continue
      const child = (node as Record<string, unknown>)[key]
      if (isArray) {
        if (Array.isArray(child)) next.push(...child)
      } else if (child !== undefined) {
        next.push(child)
      }
    }
    current = next
  }
  return current.filter((v): v is string => typeof v === 'string')
}

/** 위반 목록(빈 배열이면 통과). 문장 전문은 넣지 않는다 - 칸 · 길이 · 표현만. */
export function findValueViolations(llmOutput: unknown, rules: readonly ValueRule[]): string[] {
  const violations: string[] = []
  for (const rule of rules) {
    for (const value of valuesAt(llmOutput, rule.path)) {
      const length = codePointCount(value)
      if (length > rule.maxLength) violations.push(`${rule.path}: 길이 ${length} > 상한 ${rule.maxLength}`)
      for (const word of FORBIDDEN_VALUE_EXPRESSIONS) {
        if (value.includes(word)) violations.push(`${rule.path}: 금지 표현 「${word}」`)
      }
      const unquoted = withoutQuoted(value)
      for (const word of FORBIDDEN_PERSON_EXPRESSIONS) {
        if (unquoted.includes(word)) violations.push(`${rule.path}: 금지 표현 「${word}」(두 사람 · 두 분으로)`)
      }
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// 코너별 AI 문장 칸과 상한 (근거는 HANDOFF `84-a` 결정 기록 표와 같다)
// ---------------------------------------------------------------------------

/**
 * 17-1 데이트 아카이브.
 * - title 20: MASTER §9-7-2(확정) - LLM 스키마에도 이미 있음(`dateArchive.ts:73`)
 * - caption 30: R136-3(84-d) - 디자인 v1.2.3 README §10 ① "캡션 상한이 따로 있다면 30자 이하를 권한다"(이달의 우리 사진 위 한 줄 · 기사 사진 캡션 3줄).
 *   이전 50(84-a)은 v1.2.2의 "메모 50자 기준 높이 표"에서 왔고, 그 표는 v1.2.3에서 실측 표로 바뀌었다
 * - tailoredQuestion.text 60 · basis 100: 문서 근거 없음 - **임시 상한**(da-places 3열 물음 칸, 84-b 실측 뒤 PM 확정)
 */
export const DATE_ARCHIVE_VALUE_RULES: readonly ValueRule[] = [
  { path: 'articles[].title', maxLength: 20 },
  { path: 'articles[].stopCaptions[].caption', maxLength: 30 },
  { path: 'articles[].tailoredQuestion.text', maxLength: 60 },
  { path: 'articles[].tailoredQuestion.basis', maxLength: 100 },
]

/**
 * 17-4 다정한 말들.
 * - context 70: 인용 폭 118mm에서 한 줄 약 35자(README §12 457줄) × 2줄 - "정황 한 문장"(`sweetWords.ts:175`)
 */
export const SWEET_WORDS_VALUE_RULES: readonly ValueRule[] = [{ path: 'main[].context', maxLength: 70 }]

/**
 * 17-5 이달의 우리.
 * - headline 16 · title 20: MASTER §9-7-2(확정) - LLM 스키마에도 이미 있음(`thisMonth.ts:81` · `:101`)
 * - lead 126: 본문 폭 132~140mm = 한 줄 38~42자(CORNER_LAYOUT §0 47줄) × 리드 3줄(CORNER_LAYOUT 161줄 리드 3줄 · 폭 140mm)
 * - closing 42: "마무리 한 줄"(`m1QualityRun.ts` review 표기) = 한 줄 42자(CORNER_LAYOUT 47줄)
 * - signals[].value 20: 숫자 칸 라벨은 렌더가 호의 사실로 다시 만든다(`compose.py:654-667`) - 제목과 같은 20
 * - body 240: 문서 근거 없음 - **임시 상한**(tm-articles 2~4편 그리드, 84-b 실측 뒤 PM 확정)
 */
export const THIS_MONTH_VALUE_RULES: readonly ValueRule[] = [
  { path: 'theme.headline', maxLength: 16 },
  { path: 'theme.lead', maxLength: 126 },
  { path: 'theme.signals[].value', maxLength: 20 },
  { path: 'articles[].title', maxLength: 20 },
  { path: 'articles[].body', maxLength: 240 },
  { path: 'closing', maxLength: 42 },
]

/**
 * 2.0-A1 두 사람의 결(LLM 1회 - 설명 문장). 길이 = 계약 `docs/magazine-2-0/contracts/love_dna.json` `max_chars`.
 */
export const LOVE_DNA_VALUE_RULES: readonly ValueRule[] = [
  { path: 'explain', maxLength: 120 },
  { path: 'attachmentCombo.headline', maxLength: 30 },
  { path: 'attachmentCombo.body', maxLength: 120 },
  { path: 'strengths[]', maxLength: 40 },
  { path: 'complements[]', maxLength: 40 },
  { path: 'tryTogether[]', maxLength: 40 },
]

/** 2.0-A1 어림짐작 7번 한 줄(MASTER 17-9 "한 줄, 20자 내외" · 계약 `rough_guess.json` 20). */
export const ROUGH_GUESS_VALUE_RULES: readonly ValueRule[] = [{ path: 'line', maxLength: 20 }]

/**
 * 판정 금지 낱말 - 코너별 덧붙임(부분 문자열). 근거:
 * - 두 사람의 결: CORNER_CONTENT 3-2 "\"부족\" · \"안 맞음\" 금지"(계약 `love_dna.json` complements extra_rule) · MASTER 17-2
 *   "낮은 점수를 '안 맞는다'는 판정이 아니라"
 * - 어림짐작 7번: MASTER 17-9 "판정 금지 - '다퉜습니다' 같은 서술 금지"
 */
export const LOVE_DNA_JUDGEMENT_WORDS: readonly string[] = ['부족', '안 맞', '맞지 않', '안맞', '궁합이 나쁘', '문제']
export const ROUGH_GUESS_JUDGEMENT_WORDS: readonly string[] = ['다퉜', '다툼', '싸웠', '싸움', '갈등', '서운']

/** 칸 값들에서 코너별 판정 낱말을 찾는다 - "칸: 금지 표현" 꼴(문장 0). 따옴표 안 원문 인용은 검사 밖. */
export function findJudgementWords(llmOutput: unknown, paths: readonly string[], words: readonly string[]): string[] {
  const out: string[] = []
  for (const path of paths) {
    for (const value of valuesAt(llmOutput, path)) {
      const unquoted = withoutQuoted(value)
      for (const w of words) if (unquoted.includes(w)) out.push(`${path}: 판정 표현 「${w}」`)
    }
  }
  return out
}
