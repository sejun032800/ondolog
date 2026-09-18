/**
 * 코너 생성 파이프라인 골격 — 코너 3종(#14)이 공유하는 공통 경로
 * (docs/ONDOLOG_MASTER.md Part 17-0-4, 17-0-5, 17-0-5-A, 17-0-5-C).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 *
 * ── 이 파일이 만들지 않는 것 ──────────────────────────────────────────
 * 코너별 선행 검사 조건·프롬프트 생성 함수·Zod 스키마는 전부 호출부가
 * `CornerPipelineParams`로 주입한다(`#14`가 채운다). 이 파일은 그 셋을
 * "어떤 순서로, 어떤 실패 사유로" 엮을지만 정한다.
 *
 * ── 순서 (Part 17-0-5, 5부 원문 그대로) ───────────────────────────────
 * ① 선행 검사      → 미달이면 insufficient_input, LLM 호출하지 않음
 * ② 계수 조회      → CoeffBundle (코너가 계수를 쓰지 않으면 생략)
 * ③ LLM 호출       → 실패 시 generation_failed
 * ④ Zod 파싱       → 실패 시 schema_invalid
 * ⑤ FORBIDDEN_KEYS → 위반 시 forbidden_content
 * ⑥ ValidatedContent 반환 → 저장(호출부가 `saveCornerResult.ts`로)
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
 * 판정이 다시 나온다(Part 17-0-5-A).
 *
 * ── 계수 조회 실패는 이 4값에 없다 (명시적 한계) ──────────────────────
 * `lookupCoeffBundle`이 던지면 그대로 전파한다(catch하지 않는다). Part
 * 17-0-5의 4값 중 계수 조회 실패를 가리키는 값이 없다 — `coeffLookup.ts`
 * docblock에 같은 이유를 적어 두었다. MVP 3종은 계수를 쓰지 않아
 * (`lookupCoeffBundle`을 주입하지 않으면 ②는 통째로 생략된다) 지금은
 * 이 경로가 실전에서 실행되지 않는다.
 */

import type { ZodType } from 'zod'
import { validateCornerContent, type ValidatedContent, type CoeffBundle } from '../../../src/engine/corners/brandedTypes.ts'
import type { SkipReason } from '../../../src/engine/corners/pipelineContracts.ts'
import { SKIP_REASON_RETRY_POLICY } from '../../../src/engine/corners/pipelineContracts.ts'
import type { LlmClient } from './llmClient.ts'

export interface CornerPipelineParams<TInput, TPayload> {
  readonly input: TInput
  /** 코너별 선행 검사 조건. `#14`가 채운다 — 이 작업은 내용을 만들지 않는다. */
  readonly preconditionCheck: (input: TInput) => boolean
  /** 코너별 프롬프트 생성 함수. `#14`가 채운다. */
  readonly buildPrompt: (input: TInput) => string
  /** 코너별 Zod 스키마. `#14`가 채운다. */
  readonly schema: ZodType<TPayload>
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
 */
export async function runCornerPipeline<TInput, TPayload>(
  params: CornerPipelineParams<TInput, TPayload>,
): Promise<CornerPipelineResult<TPayload>> {
  const { input, preconditionCheck, buildPrompt, schema, llmClient, lookupCoeffBundle } = params

  // ① 선행 검사 — 미달이면 LLM을 호출하지 않는다(비용 없음, 사유는 사실).
  if (!preconditionCheck(input)) {
    return { outcome: 'failure', reason: 'insufficient_input', detail: '선행 검사 미달', llmCallAttempts: 0 }
  }

  // ② 계수 조회 — 코너가 계수를 쓰지 않으면 생략(coeffLookup.ts docblock 참조).
  const coeffBundle = lookupCoeffBundle ? await lookupCoeffBundle() : undefined

  const prompt = buildPrompt(input)

  let llmCallAttempts = 0
  let schemaRetryUsed = false
  const schemaRetryPolicy = SKIP_REASON_RETRY_POLICY.schema_invalid

  for (;;) {
    llmCallAttempts += 1

    // ③ LLM 호출 — 전송 재시도는 llmClient 내부 책임(위 docblock).
    const callResult = await llmClient.call(prompt)
    if (!callResult.ok) {
      // generation_failed — 파이프라인은 이 사유로 추가 재호출을 결정하지 않는다.
      return { outcome: 'failure', reason: 'generation_failed', detail: callResult.detail, llmCallAttempts }
    }

    // ④ Zod 파싱 (JSON.parse 실패도 형식 오류이므로 schema_invalid로 묶는다).
    let rawPayload: unknown
    try {
      rawPayload = JSON.parse(callResult.text)
    } catch (err) {
      const detail = `LLM 출력이 JSON이 아님: ${err instanceof Error ? err.message : String(err)}`
      if (schemaRetryPolicy.pipelineRetriesOnFailure && !schemaRetryUsed) {
        schemaRetryUsed = true
        continue
      }
      return { outcome: 'failure', reason: 'schema_invalid', detail, llmCallAttempts }
    }

    // ④+⑤ Zod 파싱 + FORBIDDEN_KEYS 검사 (brandedTypes.ts, 이 모듈 밖에서 캐스트하지 않는다).
    const validation = validateCornerContent(rawPayload, schema)
    if (validation.ok) {
      // ⑥ ValidatedContent 반환 — 저장은 호출부가 saveCornerResult.ts로 한다.
      return { outcome: 'success', content: validation.content, coeffBundle, llmCallAttempts }
    }

    if (validation.reason === 'forbidden_content') {
      // 재시도하지 않는다 — 같은 프롬프트면 같은 판정이 다시 나온다(17-0-5-A).
      return { outcome: 'failure', reason: 'forbidden_content', detail: validation.detail, llmCallAttempts }
    }

    // schema_invalid — 최대 1회만 파이프라인이 재호출을 결정한다.
    if (schemaRetryPolicy.pipelineRetriesOnFailure && !schemaRetryUsed) {
      schemaRetryUsed = true
      continue
    }
    return { outcome: 'failure', reason: 'schema_invalid', detail: validation.detail, llmCallAttempts }
  }
}
