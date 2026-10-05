/**
 * 코너 생성 파이프라인 골격 — 코너 3종(#14)이 공유하는 공통 경로
 * (docs/ONDOLOG_MASTER.md Part 17-0-4, 17-0-4-B, 17-0-5, 17-0-5-A, 17-0-5-C).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 * + .claude/state/prompts/phase-7/21-engine-dev-brand-constructors.md
 * (r25 — 브랜드 생성자를 `brandedTypes.ts`에서 이 파일로 이전)
 * + .claude/state/prompts/phase-7/33-corner-pipeline-skeleton-behavior.md
 * (r38·r40 — 검사 순서, 호출 전 소속 단언, 생성자 비공개).
 *
 * ── 이 파일이 만들지 않는 것 ──────────────────────────────────────────
 * 코너별 선행 검사 조건·프롬프트 생성 함수·Zod 스키마·4~6단계 훅(명시적 빈
 * 결과·ID 해석·원문 채우기)은 전부 호출부가 `CornerPipelineParams`로
 * 주입한다(코너 3종 단계가 채운다). 이 파일은 그것들을 "어떤 순서로, 어떤
 * 실패 사유로" 엮을지만 정한다.
 *
 * ── 순서 (Part 17-0-4, 17-0-4-B, 17-0-5) ──────────────────────────────
 * ⓪ 소속 단언      → 입력 레코드의 커플이 호출자 맥락의 커플과 다르면
 *                     `CoupleMembershipError`로 멈춘다(실패 사유 기록 없음, 삼키지 않음)
 * ① 선행 검사      → 미달이면 insufficient_input, LLM 호출하지 않음
 * ② 계수 조회      → CoeffBundle (코너가 계수를 쓰지 않으면 생략)
 * ③ LLM 호출       → 실패 시 generation_failed
 * ④ `validateCornerResponse` (17-0-4의 순서 전체)
 *      JSON.parse → FORBIDDEN_KEYS(원본 객체, 중첩 재귀) → Zod → 명시적 빈 결과
 *      → ID 해석 → 원문 채우기 → 저장 스키마 → 브랜드
 * ⑤ ValidatedContent 반환 → 저장(호출부가 `saveCornerResult.ts`로)
 *
 * ── r40: `ValidatedContent`는 정식 경로로만 만들어진다 ──────────────────
 * 이 파일이 공개하는 생성 경로는 `validateCornerResponse` 하나뿐이다. 브랜드를
 * 붙이는 함수(`brandValidated`)는 비공개이고, `as ValidatedContent<T>` 캐스트는
 * 그 안 한 곳뿐이다. 정적 규칙 E의 승인 모듈 목록
 * (`cornerPipelineStaticRules.test.ts`의 `APPROVED_BRAND_CONSTRUCTOR_MODULES`)에
 * 이 파일 경로가 있고, 규칙 E는 승인 모듈 안에서 캐스트를 품은 함수가
 * `export`되면 걸린다. 검사를 건너뛰고 브랜드를 붙이는 공개 함수는 없다
 * (옛 `validateCornerContent`는 제거됐다).
 *
 * ── 재시도 책임 분리 (Part 17-0-5-C, 층이 섞이지 않는다) ───────────────
 * `llmClient.call()` 한 번은 "생성 시도 1사이클"이다 — 전송 오류가 나면
 * `llmClient` 자신이 예산 안에서 지수 백오프로 재시도하고, 그래도
 * 실패하면 `generation_failed`를 돌려준다. **이 파이프라인은
 * `generation_failed`를 보고 추가로 `llmClient.call()`을 다시 부르지
 * 않는다** — 그 재시도는 이미 `llmClient` 안에서 예산을 다 쓴 뒤의
 * 결과이기 때문이다. 이 파이프라인이 스스로 재호출을 "결정"하는 사유는
 * `schema_invalid` 하나뿐이다(최대 1회, `SKIP_REASON_RETRY_POLICY`).
 * `forbidden_content`는 재시도하지 않는다 — 같은 프롬프트면 같은
 * 판정이 다시 나온다(Part 17-0-5-A). 호출 후의 `insufficient_input`(LLM이
 * 명시적으로 빈 결과를 낸 경우)도 정책표대로 재시도하지 않는다.
 *
 * ── 계수 조회 실패는 이 4값에 없다 (명시적 한계) ──────────────────────
 * `lookupCoeffBundle`이 던지면 그대로 전파한다(catch하지 않는다). Part
 * 17-0-5의 4값 중 계수 조회 실패를 가리키는 값이 없다 — `coeffLookup.ts`
 * docblock에 같은 이유를 적어 두었다. MVP 3종은 계수를 쓰지 않아
 * (`lookupCoeffBundle`을 주입하지 않으면 ②는 통째로 생략된다) 지금은
 * 이 경로가 실전에서 실행되지 않는다.
 */

import type { ZodType } from 'zod'
import type { ValidatedContent, CoeffBundle } from '../../../src/engine/corners/brandedTypes.ts'
import { findForbiddenKeys } from '../../../src/engine/corners/forbiddenKeys.ts'
import type { SkipReason } from '../../../src/engine/corners/pipelineContracts.ts'
import { SKIP_REASON_RETRY_POLICY } from '../../../src/engine/corners/pipelineContracts.ts'
import type { LlmClient } from './llmClient.ts'

/**
 * 호출자 맥락 — 커플 식별자는 **호출부가 corners/issues 행에서** 넘긴다. 입력
 * 레코드에서 읽지 않는다(입력이 오염됐다면 입력 안의 식별자도 믿을 수 없다,
 * 17-0-4-B). 기간(`period`)은 코너 3종 단계에서 더한다.
 */
export interface CornerContext {
  readonly coupleId: string
}

/** 입력 레코드가 반드시 싣는 최소 필드. 소속은 `coupleId`로 읽는다. */
export interface ScopedRecord {
  readonly id: string
  readonly coupleId: string
}

/**
 * 호출 전 소속 단언 실패 (17-0-4-B). 실패 사유 4값이 아니다 — 결과가 아니라
 * 입력 조립의 버그이기 때문이다. 파이프라인은 이 오류를 잡지 않고 위로 던진다.
 * 그 커플의 그 호 생성 전체를 멈추는 것은 호출자의 일이다.
 */
export class CoupleMembershipError extends Error {
  readonly expectedCoupleId: string
  readonly offendingRecordIds: readonly string[]

  constructor(expectedCoupleId: string, offendingRecordIds: readonly string[]) {
    super(
      `코너 입력에 호출자 맥락의 커플이 아닌 레코드가 있다 (coupleId=${expectedCoupleId}, 레코드 ${offendingRecordIds.length}건: ${offendingRecordIds.join(', ')})`,
    )
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'CoupleMembershipError'
    this.expectedCoupleId = expectedCoupleId
    this.offendingRecordIds = offendingRecordIds
  }
}

function assertRecordsBelongToCouple(records: readonly ScopedRecord[], context: CornerContext): void {
  const expected = context.coupleId
  // 맥락의 커플 식별자가 비어 있으면 소속을 확인할 방법이 없다 — 통과시키지 않는다.
  if (expected.length === 0) {
    throw new CoupleMembershipError(expected, records.map((r) => r.id))
  }
  const offending = records.filter((r) => r.coupleId !== expected).map((r) => r.id)
  if (offending.length > 0) {
    throw new CoupleMembershipError(expected, offending)
  }
}

/**
 * `validateCornerResponse`의 실패 결과. 17-0-4 표의 실패 열과 그대로 대응한다.
 * `generation_failed`는 이 함수가 판정하지 않는다(LLM 호출 실패는 `llmClient`와
 * 이 파이프라인의 책임).
 */
export type CornerResponseFailureReason = 'schema_invalid' | 'forbidden_content' | 'insufficient_input'

export type CornerResponseResult<T> =
  | { readonly ok: true; readonly content: ValidatedContent<T> }
  | { readonly ok: false; readonly reason: CornerResponseFailureReason; readonly detail: string }

export type CornerStepResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly detail: string }

/**
 * 17-0-4의 4~6단계에서 코너마다 달라지는 부분. 코너 3종 단계가 채운다 —
 * 이번에는 받는 자리와 순서만 있다. 전부 동기 순수 함수다.
 */
export interface CornerResponseSpec<TLlm, TStored> {
  /** 3단계의 Zod 스키마(LLM 출력 스키마). `.strict()`를 쓰지 않는다 — 모르는 키는 Zod가 지운다. */
  readonly llmSchema: ZodType<TLlm>
  /** 4단계 — 명시적 빈 결과(`kind: 'none'` 등)인가. true면 `insufficient_input`. */
  readonly isExplicitEmpty: (llm: TLlm) => boolean
  /** 5단계 — ID 해석(존재·그 커플의 것·기간 안). 실패 시 `schema_invalid`. */
  readonly resolveReferences: (
    llm: TLlm,
    context: CornerContext,
  ) => { readonly ok: true } | { readonly ok: false; readonly detail: string }
  /** 6단계 — 원문 채우기. 실패 시 `schema_invalid`. */
  readonly fill: (llm: TLlm, context: CornerContext) => CornerStepResult<unknown>
  /** 6단계 — 저장 스키마. 실패 시 `schema_invalid`. 통과해야 브랜드가 붙는다. */
  readonly storedSchema: ZodType<TStored>
}

/** 브랜드를 붙이는 유일한 곳 — 비공개(r40). 검증을 모두 마친 값만 여기로 온다. */
function brandValidated<T>(value: T): ValidatedContent<T> {
  return value as ValidatedContent<T>
}

/**
 * LLM 응답 문자열을 17-0-4의 순서 전체로 검증해 `ValidatedContent<TStored>`를
 * 만드는 **유일한 공개 경로**(r38·r40).
 *
 *   1. `JSON.parse`                           → 실패 `schema_invalid`
 *   2. `FORBIDDEN_KEYS` — **원본 객체**에, 중첩까지 재귀 → `forbidden_content`
 *   3. Zod 파싱(LLM 출력 스키마)                → `schema_invalid`
 *   4. 명시적 빈 결과                            → `insufficient_input`
 *   5. ID 해석                                  → `schema_invalid`
 *   6. 원문 채우기 → 저장 스키마 → 브랜드
 *
 * 2가 3보다 앞인 이유: Zod는 스키마에 없는 키를 지운다. LLM이 시키지 않은 판정을
 * 담으려고 스스로 만든 키는 Zod를 거치면 사라져 영원히 걸리지 않는다(r38). 그렇다고
 * `.strict()`로 막으면 모르는 키가 `schema_invalid`로 떨어져 `forbidden_content`와
 * 섞인다 — 금지 목록 밖의 모르는 키는 Zod가 조용히 지우게 둔다.
 */
export function validateCornerResponse<TLlm, TStored>(
  rawText: string,
  spec: CornerResponseSpec<TLlm, TStored>,
  context: CornerContext,
): CornerResponseResult<TStored> {
  // 1. JSON.parse
  let rawObject: unknown
  try {
    rawObject = JSON.parse(rawText)
  } catch (err) {
    return {
      ok: false,
      reason: 'schema_invalid',
      detail: `LLM 출력이 JSON이 아님: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // 2. FORBIDDEN_KEYS — Zod가 키를 지우기 전의 원본 객체에.
  const violations = findForbiddenKeys(rawObject)
  if (violations.length > 0) {
    return { ok: false, reason: 'forbidden_content', detail: `금지 키 발견: ${violations.join(', ')}` }
  }

  // 3. Zod 파싱
  const parsed = spec.llmSchema.safeParse(rawObject)
  if (!parsed.success) {
    return { ok: false, reason: 'schema_invalid', detail: parsed.error.message }
  }
  const llm = parsed.data

  // 4. 명시적 빈 결과 — Zod 파싱이 성공한 뒤에만 도달한다(파싱 실패와 섞이지 않는다).
  if (spec.isExplicitEmpty(llm)) {
    return { ok: false, reason: 'insufficient_input', detail: 'LLM이 명시적으로 빈 결과를 반환함' }
  }

  // 5. ID 해석
  const resolved = spec.resolveReferences(llm, context)
  if (!resolved.ok) {
    return { ok: false, reason: 'schema_invalid', detail: resolved.detail }
  }

  // 6. 원문 채우기 → 저장 스키마 → 브랜드
  const filled = spec.fill(llm, context)
  if (!filled.ok) {
    return { ok: false, reason: 'schema_invalid', detail: filled.detail }
  }
  const stored = spec.storedSchema.safeParse(filled.value)
  if (!stored.success) {
    return { ok: false, reason: 'schema_invalid', detail: stored.error.message }
  }

  return { ok: true, content: brandValidated(stored.data) }
}

/**
 * `runCornerPipeline`의 4~6단계 훅. 생략하면 통과형 기본값(빈 결과 없음·ID 해석
 * 통과·채우기 없음·저장 스키마 = LLM 스키마)이다. 이 단계의 골격은 LLM 출력
 * 타입과 저장 타입이 같은 경우(`TPayload`)만 다룬다 — 둘이 달라지는 코너 3종의
 * 시그니처는 3단계에서 정한다.
 */
export interface CornerResponseHooks<TPayload> {
  readonly isExplicitEmpty?: CornerResponseSpec<TPayload, TPayload>['isExplicitEmpty']
  readonly resolveReferences?: CornerResponseSpec<TPayload, TPayload>['resolveReferences']
  readonly fill?: CornerResponseSpec<TPayload, TPayload>['fill']
  readonly storedSchema?: ZodType<TPayload>
}

export interface CornerPipelineParams<TInput, TPayload> {
  readonly input: TInput
  /**
   * 호출자 맥락. 커플 식별자는 입력이 아니라 호출자에게서 온다(17-0-4-B).
   * 생략할 수 없다 — 생략 가능하면 소속 단언을 건너뛰는 길이 된다.
   */
  readonly context: CornerContext
  /** 입력이 싣고 있는 레코드 전부(소속 단언 대상). 레코드의 커플은 `coupleId`로 읽는다. */
  readonly scopedRecords: (input: TInput) => readonly ScopedRecord[]
  /** 코너별 선행 검사 조건. `#14`가 채운다 — 이 작업은 내용을 만들지 않는다. */
  readonly preconditionCheck: (input: TInput) => boolean
  /** 코너별 프롬프트 생성 함수. `#14`가 채운다. */
  readonly buildPrompt: (input: TInput) => string
  /** 코너별 Zod 스키마. `#14`가 채운다. */
  readonly schema: ZodType<TPayload>
  /** 17-0-4 4~6단계의 코너별 훅. 생략하면 통과형 기본값이다. */
  readonly hooks?: CornerResponseHooks<TPayload>
  /** 코너 1건에 묶인 LLM 클라이언트 — 호출부가 `createLlmClient()`로 만들어 넘긴다. */
  readonly llmClient: LlmClient
  /**
   * 계수가 필요한 코너만 넘긴다. 넘기지 않으면 ②는 생략되고
   * `coeffBundle`은 결과에 없다(MVP 3종의 실제 상태).
   */
  readonly lookupCoeffBundle?: () => Promise<CoeffBundle>
}

export interface CornerPipelineSuccess<TPayload> {
  readonly outcome: 'success'
  readonly content: ValidatedContent<TPayload>
  readonly coeffBundle: CoeffBundle | undefined
  /** 이번 실행에서 실제로 이뤄진 `llmClient.call()` 횟수(재시도 포함). */
  readonly llmCallAttempts: number
}

export interface CornerPipelineFailure {
  readonly outcome: 'failure'
  readonly reason: SkipReason
  readonly detail: string
  readonly llmCallAttempts: number
}

export type CornerPipelineResult<TPayload> = CornerPipelineSuccess<TPayload> | CornerPipelineFailure

/**
 * 코너 생성 파이프라인 골격을 한 코너 1건에 대해 실행한다. 코너별
 * 부분(선행 검사·프롬프트·스키마)은 전부 `params`로 주입받는다 — 이
 * 함수 자신은 어떤 코너인지 모른다.
 *
 * 입력 레코드가 호출자 맥락의 커플과 다르면 `CoupleMembershipError`를 던진다 —
 * LLM은 한 번도 불리지 않고, 실패 사유도 기록되지 않는다.
 */
export async function runCornerPipeline<TInput, TPayload>(
  params: CornerPipelineParams<TInput, TPayload>,
): Promise<CornerPipelineResult<TPayload>> {
  const { input, context, scopedRecords, preconditionCheck, buildPrompt, schema, hooks, llmClient, lookupCoeffBundle } =
    params

  // ⓪ 소속 단언 — 어떤 LLM 호출보다 앞. 오염된 입력이 "재료 부족"으로 가려지지 않도록
  // 선행 검사보다도 먼저 본다. 던진 오류는 잡지 않는다(호 전체 중단은 호출자의 일).
  assertRecordsBelongToCouple(scopedRecords(input), context)

  // ① 선행 검사 — 미달이면 LLM을 호출하지 않는다(비용 없음, 사유는 사실).
  if (!preconditionCheck(input)) {
    return { outcome: 'failure', reason: 'insufficient_input', detail: '선행 검사 미달', llmCallAttempts: 0 }
  }

  // ② 계수 조회 — 코너가 계수를 쓰지 않으면 생략(coeffLookup.ts docblock 참조).
  const coeffBundle = lookupCoeffBundle ? await lookupCoeffBundle() : undefined

  const prompt = buildPrompt(input)

  const spec: CornerResponseSpec<TPayload, TPayload> = {
    llmSchema: schema,
    isExplicitEmpty: hooks?.isExplicitEmpty ?? (() => false),
    resolveReferences: hooks?.resolveReferences ?? (() => ({ ok: true })),
    fill: hooks?.fill ?? ((llm) => ({ ok: true, value: llm })),
    storedSchema: hooks?.storedSchema ?? schema,
  }

  let llmCallAttempts = 0
  let schemaRetryUsed = false

  for (;;) {
    llmCallAttempts += 1

    // ③ LLM 호출 — 전송 재시도는 llmClient 내부 책임(위 docblock).
    const callResult = await llmClient.call(prompt)
    if (!callResult.ok) {
      // generation_failed — 파이프라인은 이 사유로 추가 재호출을 결정하지 않는다.
      return { outcome: 'failure', reason: 'generation_failed', detail: callResult.detail, llmCallAttempts }
    }

    // ④ JSON.parse → FORBIDDEN_KEYS → Zod → 빈 결과 → ID 해석 → 채우기 → 저장 스키마 → 브랜드.
    const validation = validateCornerResponse(callResult.text, spec, context)
    if (validation.ok) {
      // ⑤ ValidatedContent 반환 — 저장은 호출부가 saveCornerResult.ts로 한다.
      return { outcome: 'success', content: validation.content, coeffBundle, llmCallAttempts }
    }

    // 재시도 여부는 사유별 정책표가 정한다(17-0-5-A) — `schema_invalid`만 최대 1회.
    const retryPolicy = SKIP_REASON_RETRY_POLICY[validation.reason]
    if (retryPolicy.pipelineRetriesOnFailure && !schemaRetryUsed) {
      schemaRetryUsed = true
      continue
    }
    return { outcome: 'failure', reason: validation.reason, detail: validation.detail, llmCallAttempts }
  }
}
