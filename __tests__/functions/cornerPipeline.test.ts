import { z, type ZodType } from 'zod'
import type { LlmClient, LlmCallResult } from '../../supabase/functions/_shared/llmClient'

/**
 * `cornerPipeline.ts` — 코너 3종이 공유하는 파이프라인 골격
 * (Part 17-0-4, 17-0-5, 17-0-5-A). 코너별 부분(선행 검사·프롬프트·
 * 스키마)은 전부 이 테스트가 주입하는 가짜로 대신한다 — `#14`가 실제
 * 값을 넣을 자리를 이 테스트가 검증한다.
 *
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 5부.
 *
 * ── 왜 `runCornerPipeline`만 `require(경로변수)`로 가져오는가 ───────────
 * `llmClient.ts`는 다른 디렉터리를 import하지 않아(자기 완결) 정적
 * `import type`이 안전하다. 반면 `cornerPipeline.ts`는
 * `src/engine/corners/brandedTypes.ts`·`pipelineContracts.ts`를 `.ts`
 * 확장자로 import한다(Deno 표준, `supabase/functions/tsconfig.json`
 * 전용 설정에서만 허용). 정적으로 가져오면 루트 tsc가 그 파일을
 * 전이적으로 파싱해 `TS5097`을 낸다(`coeffLookup.test.ts`와 같은 이유,
 * 그 파일 docblock 참조). 그래서 `runCornerPipeline`만 경로를 변수에
 * 담아 `require()`하고, 필요한 타입은 이 파일 안에서 구조적으로
 * 다시 선언한다.
 */

interface FakeCoeffBundle {
  readonly version: string
  readonly [key: string]: unknown
}

type SkipReasonShape = 'insufficient_input' | 'generation_failed' | 'schema_invalid' | 'forbidden_content'

interface CornerPipelineParamsShape<TInput, TPayload> {
  input: TInput
  preconditionCheck: (input: TInput) => boolean
  buildPrompt: (input: TInput) => string
  schema: ZodType<TPayload>
  llmClient: LlmClient
  lookupCoeffBundle?: () => Promise<FakeCoeffBundle>
}

type CornerPipelineResultShape<TPayload> =
  | { outcome: 'success'; content: TPayload; coeffBundle: FakeCoeffBundle | undefined; llmCallAttempts: number }
  | { outcome: 'failure'; reason: SkipReasonShape; detail: string; llmCallAttempts: number }

type RunCornerPipelineFn = <TInput, TPayload>(
  params: CornerPipelineParamsShape<TInput, TPayload>,
) => Promise<CornerPipelineResultShape<TPayload>>

const cornerPipelineModulePath = '../../supabase/functions/_shared/cornerPipeline'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runCornerPipeline } = require(cornerPipelineModulePath) as { runCornerPipeline: RunCornerPipelineFn }

const PayloadSchema = z.object({ title: z.string() })

/** 미리 정한 응답을 순서대로 반환하는 가짜 LlmClient. 호출 횟수를 기록한다. */
function scriptedLlmClient(responses: LlmCallResult[]): LlmClient & { callCount: () => number } {
  let index = 0
  return {
    call: async () => {
      const result = responses[Math.min(index, responses.length - 1)]
      index += 1
      return result
    },
    callCount: () => index,
  }
}

const ok = (text: string): LlmCallResult => ({ ok: true, text })
const fail = (detail: string): LlmCallResult => ({ ok: false, reason: 'generation_failed', detail })

describe('① 선행 검사 — 미달이면 LLM을 호출하지 않는다', () => {
  it('insufficient_input을 반환하고 llmClient.call은 한 번도 안 불린다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const result = await runCornerPipeline({
      input: { entries: [] as string[] },
      preconditionCheck: (input) => input.entries.length > 0,
      buildPrompt: () => 'prompt',
      schema: PayloadSchema,
      llmClient,
    })

    expect(result).toEqual({ outcome: 'failure', reason: 'insufficient_input', detail: '선행 검사 미달', llmCallAttempts: 0 })
    expect(llmClient.callCount()).toBe(0)
  })
})

describe('② 계수 조회 — 주입하지 않으면 생략, 주입하면 결과에 포함', () => {
  it('lookupCoeffBundle을 주지 않으면 coeffBundle은 undefined다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const result = await runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      llmClient,
    })
    expect(result.outcome).toBe('success')
    if (result.outcome === 'success') expect(result.coeffBundle).toBeUndefined()
  })

  it('lookupCoeffBundle을 주면 결과의 coeffBundle에 그대로 담긴다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const fakeCoeffBundle: FakeCoeffBundle = { version: '1.0.0' }
    const result = await runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      llmClient,
      lookupCoeffBundle: async () => fakeCoeffBundle,
    })
    expect(result.outcome).toBe('success')
    if (result.outcome === 'success') expect(result.coeffBundle?.version).toBe('1.0.0')
  })
})

describe('③ LLM 호출 실패 — generation_failed는 파이프라인이 추가로 재호출을 결정하지 않는다', () => {
  it('llmClient가 generation_failed를 반환하면 그대로 전파하고 attempts=1이다', async () => {
    const llmClient = scriptedLlmClient([fail('HTTP 500'), ok('{"title":"안 쓰임"}')])
    const result = await runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      llmClient,
    })
    expect(result).toEqual({ outcome: 'failure', reason: 'generation_failed', detail: 'HTTP 500', llmCallAttempts: 1 })
    expect(llmClient.callCount()).toBe(1) // 파이프라인이 다시 부르지 않았다
  })
})

describe('④ Zod 파싱 실패 — schema_invalid는 파이프라인이 최대 1회 재시도한다', () => {
  it('두 번째 시도에서 통과하면 성공하고 attempts=2다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":123}'), ok('{"title":"고쳐짐"}')])
    const result = await runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      llmClient,
    })
    expect(result.outcome).toBe('success')
    if (result.outcome === 'success') {
      expect(result.content).toEqual({ title: '고쳐짐' })
      expect(result.llmCallAttempts).toBe(2)
    }
  })

  it('재시도 후에도 실패하면 schema_invalid로 끝난다(1회 초과 재시도 없음, attempts=2)', () => {
    return runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      llmClient: scriptedLlmClient([ok('{"title":123}'), ok('{"title":456}')]),
    }).then((result) => {
      expect(result.outcome).toBe('failure')
      if (result.outcome === 'failure') {
        expect(result.reason).toBe('schema_invalid')
        expect(result.llmCallAttempts).toBe(2)
      }
    })
  })

  it('LLM 출력이 JSON이 아니어도 schema_invalid로 취급되고 같은 1회 재시도 규칙을 따른다', async () => {
    const llmClient = scriptedLlmClient([ok('이건 JSON이 아님'), ok('{"title":"복구됨"}')])
    const result = await runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      llmClient,
    })
    expect(result.outcome).toBe('success')
    if (result.outcome === 'success') expect(result.llmCallAttempts).toBe(2)
  })
})

describe('⑤ FORBIDDEN_KEYS 위반 — forbidden_content는 재시도하지 않는다', () => {
  it('금지 키가 있으면 즉시 실패하고 attempts=1이다', async () => {
    const SchemaWithScore = z.object({ title: z.string(), score: z.number() })
    const llmClient = scriptedLlmClient([ok('{"title":"x","score":100}'), ok('{"title":"안 씀"}')])
    const result = await runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: SchemaWithScore,
      llmClient,
    })
    expect(result.outcome).toBe('failure')
    if (result.outcome === 'failure') {
      expect(result.reason).toBe('forbidden_content')
      expect(result.llmCallAttempts).toBe(1)
    }
    expect(llmClient.callCount()).toBe(1)
  })
})

describe('⑥ 성공 — ValidatedContent 반환 (저장은 이 함수의 책임이 아니다)', () => {
  it('첫 시도에 통과하면 attempts=1로 성공한다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"한 번에 성공"}')])
    const result = await runCornerPipeline({
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      llmClient,
    })
    expect(result).toEqual({
      outcome: 'success',
      content: { title: '한 번에 성공' },
      coeffBundle: undefined,
      llmCallAttempts: 1,
    })
  })
})

describe('코너별 부분은 전부 주입된다 — 골격 자신은 내용을 모른다', () => {
  it('buildPrompt이 input을 받아 실제로 쓰인다(프롬프트 문자열이 그대로 전달됨을 간접 확인)', async () => {
    let receivedPrompt = ''
    const llmClient: LlmClient = {
      call: async (prompt) => {
        receivedPrompt = prompt
        return ok('{"title":"x"}')
      },
    }
    await runCornerPipeline({
      input: { keyword: '이 문자열' },
      preconditionCheck: () => true,
      buildPrompt: (input) => `프롬프트: ${input.keyword}`,
      schema: PayloadSchema,
      llmClient,
    })
    expect(receivedPrompt).toBe('프롬프트: 이 문자열')
  })
})

describe('결정론 — 동일 입력(고정된 가짜) 100회 반복 → 100회 동일 결과', () => {
  it('같은 스크립트 + 같은 입력으로 100회 실행해도 같은 결과가 나온다', async () => {
    for (let i = 0; i < 100; i++) {
      const result = await runCornerPipeline({
        input: {},
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        llmClient: scriptedLlmClient([ok('{"title":"고정 결과"}')]),
      })
      expect(result).toEqual({
        outcome: 'success',
        content: { title: '고정 결과' },
        coeffBundle: undefined,
        llmCallAttempts: 1,
      })
    }
  })
})
