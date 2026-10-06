/// <reference types="jest" />
import { z } from 'zod'
import type { LlmClient, LlmCallResult } from './llmClient.ts'
import { lookupCoeffBundle, type AppConfigQueryClient } from './coeffLookup.ts'
import {
  runCornerPipeline,
  isRecordInPeriod,
  resolveRecordReferences,
  InvalidCornerContextError,
  validateCornerResponse,
  CoupleMembershipError,
  type CornerContext,
  type CornerPipelineResult,
  type CornerResponseSpec,
  type CornerResponseHooks,
  type ScopedRecord,
} from './cornerPipeline.ts'
import { saveCornerSuccess, saveCornerFailure, type CornersTableClient } from './saveCornerResult.ts'

/**
 * `cornerPipeline.ts` — 코너 3종이 공유하는 파이프라인 골격
 * (Part 17-0-4, 17-0-4-B, 17-0-5, 17-0-5-A). 코너별 부분(선행 검사·프롬프트·
 * 스키마·4~6단계 훅)은 전부 이 테스트가 주입하는 합성 값으로 대신한다 —
 * 코너 3종 단계가 실제 값을 넣을 자리를 이 테스트가 검증한다.
 *
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 5부
 * + .claude/state/prompts/phase-7/33-corner-pipeline-skeleton-behavior.md (r38·r40).
 *
 * 이 파일은 대상과 같은 트리에 있고 `.ts` 확장자 정적 import로 대상을 가져온다.
 * 루트 tsc는 `exclude`로 이 파일을 보지 않고, 전용 tsconfig가 타입 검사한다
 * (`__tests__/build/edgeFunctionsTypecheck.test.ts`).
 *
 * ── 이 파일의 증명 ───────────────────────────────────────────────────────
 * - 금지 키는 **파이프라인 전체**로 시험한다(가짜 `llmClient`가 스키마에 없는 금지
 *   키를 담은 응답 문자열을 돌려준다). 금지 키 함수만 따로 시험하면 통과해도
 *   `FORBIDDEN_KEYS`가 Zod가 지운 뒤 객체에 걸리던 결함(r38)이 숨는다.
 * - 다른 커플 레코드가 입력에 섞이면 LLM이 한 번도 불리지 않고, 저장도 없으며,
 *   전용 오류가 위로 전파된다(17-0-4-B).
 * - `validateCornerResponse`는 17-0-4의 순서 전체를 합성 스키마·합성 훅으로 시험한다.
 */

const PayloadSchema = z.object({ title: z.string() })

/** 호출자 맥락 — 커플 식별자·기간은 입력이 아니라 호출자에게서 온다. 기간 `[start, end)`. */
const PERIOD_START = new Date('2026-10-01T00:00:00.000Z')
const PERIOD_END = new Date('2026-11-01T00:00:00.000Z')
const CONTEXT: CornerContext = { coupleId: 'couple-a', period: { start: PERIOD_START, end: PERIOD_END } }
/** 기간 안의 시각. */
const IN_PERIOD = new Date('2026-10-15T03:00:00.000Z')

/**
 * 합성 훅(테스트 전용 — 파이프라인에는 통과형 기본값이 없다, r42). 빈 결과 없음·ID 해석 통과·
 * 채우기 그대로·저장 스키마 = LLM 스키마. 코너가 "없다"고 답하는 함수를 넘기는 형태와 같다.
 */
function passHooks<T>(schema: z.ZodType<T>): CornerResponseHooks<T> {
  return {
    isExplicitEmpty: () => false,
    resolveReferences: () => ({ ok: true }),
    fill: (llm) => ({ ok: true, value: llm }),
    storedSchema: schema,
  }
}
/** 레코드를 싣지 않는 입력용 — 소속 단언의 대상이 없다. */
const NO_RECORDS = (): readonly ScopedRecord[] => []

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

/** 저장 함수가 받는 `corners` 테이블 가짜 — 갱신 내용을 기록한다. */
function recordingCornersClient(): CornersTableClient & { updates: Array<Record<string, unknown>> } {
  const updates: Array<Record<string, unknown>> = []
  return {
    updates,
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(patch)
          return { error: null }
        },
      }),
    }),
  }
}

/**
 * 호출부가 하는 일의 축소판 — 파이프라인 결과를 저장 함수로 넘긴다. 파이프라인이
 * 던지면(`CoupleMembershipError`) 여기서 잡지 않으므로 저장 함수는 불리지 않는다.
 */
async function runAndPersist<TInput, TPayload extends object>(
  params: Parameters<typeof runCornerPipeline<TInput, TPayload>>[0],
  client: CornersTableClient,
): Promise<CornerPipelineResult<TPayload>> {
  const result = await runCornerPipeline(params)
  if (result.outcome === 'success') {
    await saveCornerSuccess(client, {
      cornerId: 'corner-1',
      engineVersion: 'pipeline-v1',
      content: result.content,
      coeffBundle: result.coeffBundle,
      generationAttempts: result.llmCallAttempts,
    })
  } else {
    await saveCornerFailure(client, {
      cornerId: 'corner-1',
      engineVersion: 'pipeline-v1',
      reason: result.reason,
      detail: result.detail,
      generationAttempts: result.llmCallAttempts,
    })
  }
  return result
}

describe('① 선행 검사 — 미달이면 LLM을 호출하지 않는다', () => {
  it('insufficient_input을 반환하고 llmClient.call은 한 번도 안 불린다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const result = await runCornerPipeline({
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: { entries: [] as string[] },
      preconditionCheck: (input) => input.entries.length > 0,
      buildPrompt: () => 'prompt',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
      llmClient,
    })
    expect(result.outcome).toBe('success')
    if (result.outcome === 'success') expect(result.coeffBundle).toBeUndefined()
  })

  it('lookupCoeffBundle을 주면 결과의 coeffBundle에 그대로 담긴다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const coeffClient: AppConfigQueryClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { key: 'corner_coeffs', value: { version: '1.0.0' } }, error: null }),
          }),
        }),
      }),
    }
    const fakeCoeffBundle = await lookupCoeffBundle(coeffClient, 'corner_coeffs')
    const result = await runCornerPipeline({
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: SchemaWithScore,
      hooks: passHooks(SchemaWithScore),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: {},
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
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
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      input: { keyword: '이 문자열' },
      preconditionCheck: () => true,
      buildPrompt: (input) => `프롬프트: ${input.keyword}`,
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
      llmClient,
    })
    expect(receivedPrompt).toBe('프롬프트: 이 문자열')
  })
})

describe('결정론 — 동일 입력(고정된 가짜) 100회 반복 → 100회 동일 결과', () => {
  it('같은 스크립트 + 같은 입력으로 100회 실행해도 같은 결과가 나온다', async () => {
    for (let i = 0; i < 100; i++) {
      const result = await runCornerPipeline({
        context: CONTEXT,
        scopedRecords: NO_RECORDS,
        input: {},
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
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

// ─────────────────────────────────────────────────────────────────────────
// 파이프라인 전체로 보는 금지 키 (r38) — 가짜 llmClient가 응답 문자열을 돌려준다.
// 금지 키 함수를 따로 시험하지 않는다: 이번 결함은 그렇게 숨어 있었다.
// ─────────────────────────────────────────────────────────────────────────

describe('r38 — 금지 키는 Zod가 지우기 전의 원본 객체에 걸린다 (파이프라인 전체)', () => {
  it('스키마에 없는 금지 키가 응답에 있으면 forbidden_content로 기록되고 저장 함수가 불린다', async () => {
    // PayloadSchema에는 `verdict`가 없다 — Zod가 파싱 결과에서 지울 키다.
    const llmClient = scriptedLlmClient([ok('{"title":"한강 산책","verdict":"좋은 데이트였다"}'), ok('{"title":"안 씀"}')])
    const cornersClient = recordingCornersClient()

    const result = await runAndPersist(
      {
        input: {},
        context: CONTEXT,
        scopedRecords: NO_RECORDS,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      },
      cornersClient,
    )

    expect(result).toEqual({
      outcome: 'failure',
      reason: 'forbidden_content',
      detail: expect.stringContaining('verdict'),
      llmCallAttempts: 1,
    })
    expect(llmClient.callCount()).toBe(1) // 재시도 없음
    // 저장 함수가 실제로 불려 사유가 남았다.
    expect(cornersClient.updates).toHaveLength(1)
    expect(cornersClient.updates[0].status).toBe('failed')
    expect(cornersClient.updates[0].skip_reason).toBe('forbidden_content')
  })

  it('깊은 객체·배열 안의 금지 키도 걸린다', async () => {
    const deep = '{"title":"x","meta":{"a":[{"b":{"riskLevel":1}}]}}'
    const result = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
      llmClient: scriptedLlmClient([ok(deep)]),
    })
    expect(result.outcome).toBe('failure')
    if (result.outcome === 'failure') {
      expect(result.reason).toBe('forbidden_content')
      expect(result.detail).toContain('riskLevel')
      expect(result.llmCallAttempts).toBe(1)
    }
  })

  it('금지 목록 밖의 모르는 키는 schema_invalid가 아니다 — Zod가 조용히 지운다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"한강 산책","mood":"잔잔함"}')])
    const result = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
      llmClient,
    })
    expect(result).toEqual({
      outcome: 'success',
      content: { title: '한강 산책' }, // `mood`는 지워졌다
      coeffBundle: undefined,
      llmCallAttempts: 1,
    })
  })

  it('금지 키와 Zod 실패가 함께 있으면 forbidden_content다 — 키 검사가 Zod보다 앞이다', async () => {
    const result = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
      llmClient: scriptedLlmClient([ok('{"title":42,"score":1}')]),
    })
    expect(result.outcome).toBe('failure')
    if (result.outcome === 'failure') {
      expect(result.reason).toBe('forbidden_content')
      expect(result.llmCallAttempts).toBe(1)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 호출 전 소속 단언 (17-0-4-B, r38)
// ─────────────────────────────────────────────────────────────────────────

describe('r38 — 호출 전 소속 단언: 다른 커플 레코드가 섞이면 LLM은 0회 불린다', () => {
  const ownRecord: ScopedRecord = { id: 'm-1', coupleId: 'couple-a', occurredAt: IN_PERIOD }
  const foreignRecord: ScopedRecord = { id: 'm-2', coupleId: 'couple-b', occurredAt: IN_PERIOD }

  it('다른 커플 레코드가 있으면 LLM 0회·저장 0회이고 전용 오류가 전파된다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const cornersClient = recordingCornersClient()

    const promise = runAndPersist(
      {
        input: { records: [ownRecord, foreignRecord] },
        context: CONTEXT,
        scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      },
      cornersClient,
    )

    await expect(promise).rejects.toBeInstanceOf(CoupleMembershipError)
    await expect(promise).rejects.toMatchObject({
      name: 'CoupleMembershipError',
      expectedCoupleId: 'couple-a',
      offendingRecordIds: ['m-2'],
    })
    expect(llmClient.callCount()).toBe(0)
    expect(cornersClient.updates).toHaveLength(0) // 실패 사유도 기록하지 않는다
  })

  it('선행 검사가 미달이어도 소속 단언이 먼저다 — 오염된 입력이 "재료 부족"으로 가려지지 않는다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const cornersClient = recordingCornersClient()

    await expect(
      runAndPersist(
        {
          input: { records: [foreignRecord] },
          context: CONTEXT,
          scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
          preconditionCheck: () => false,
          buildPrompt: () => 'p',
          schema: PayloadSchema,
          hooks: passHooks(PayloadSchema),
          llmClient,
        },
        cornersClient,
      ),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(llmClient.callCount()).toBe(0)
    expect(cornersClient.updates).toHaveLength(0)
  })

  it('입력 안에 어떤 커플 식별자가 적혀 있든 기준은 호출자 맥락이다', async () => {
    // 입력이 "이 입력은 couple-b의 것"이라고 주장해도 맥락(couple-a)과 다르면 멈춘다.
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    await expect(
      runCornerPipeline({
        input: { claimedCoupleId: 'couple-b', records: [foreignRecord] },
        context: CONTEXT,
        scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      }),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(llmClient.callCount()).toBe(0)
  })

  it('맥락의 커플 식별자가 비어 있으면 소속을 확인할 수 없으므로 멈춘다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    await expect(
      runCornerPipeline({
        input: { records: [{ id: 'm-3', coupleId: '', occurredAt: IN_PERIOD }] },
        context: { ...CONTEXT, coupleId: '' },
        scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      }),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(llmClient.callCount()).toBe(0)
  })

  it('대조: 전부 같은 커플이면 통과해 LLM이 불린다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const result = await runCornerPipeline({
      input: { records: [ownRecord, { id: 'm-4', coupleId: 'couple-a', occurredAt: IN_PERIOD }] },
      context: CONTEXT,
      scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
      llmClient,
    })
    expect(result.outcome).toBe('success')
    expect(llmClient.callCount()).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 4~6단계 훅 — 합성 훅으로 받는 자리와 순서를 확인한다 (코너별 내용은 3단계)
// ─────────────────────────────────────────────────────────────────────────

describe('4~6단계 훅 — 파이프라인 경로 (합성 훅)', () => {
  const NullableSchema = z.object({ kind: z.string(), title: z.string().optional() })

  it('4: 명시적 빈 결과 → insufficient_input, 재시도 없이 attempts=1', async () => {
    const llmClient = scriptedLlmClient([ok('{"kind":"none"}'), ok('{"kind":"x","title":"안 씀"}')])
    const result = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: NullableSchema,
      hooks: { ...passHooks(NullableSchema), isExplicitEmpty: (llm) => llm.kind === 'none' },
      llmClient,
    })
    expect(result).toEqual({
      outcome: 'failure',
      reason: 'insufficient_input',
      detail: expect.any(String),
      llmCallAttempts: 1,
    })
    expect(llmClient.callCount()).toBe(1)
  })

  it('4: 파싱 실패(`{}`)는 빈 결과가 아니라 schema_invalid다', async () => {
    const result = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: NullableSchema,
      hooks: { ...passHooks(NullableSchema), isExplicitEmpty: () => true },
      llmClient: scriptedLlmClient([ok('{}'), ok('{}')]),
    })
    expect(result.outcome).toBe('failure')
    if (result.outcome === 'failure') {
      expect(result.reason).toBe('schema_invalid')
      expect(result.llmCallAttempts).toBe(2)
    }
  })

  it('5: ID 해석 실패 → schema_invalid, 재시도 1회 후 성공하면 attempts=2', async () => {
    let call = 0
    const llmClient = scriptedLlmClient([ok('{"kind":"a","title":"지어낸 참조"}'), ok('{"kind":"a","title":"실존 참조"}')])
    const result = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: NullableSchema,
      hooks: {
        ...passHooks(NullableSchema),
        resolveReferences: () => {
          call += 1
          return call === 1 ? { ok: false, detail: '존재하지 않는 ID' } : { ok: true }
        },
      },
      llmClient,
    })
    expect(result.outcome).toBe('success')
    if (result.outcome === 'success') expect(result.llmCallAttempts).toBe(2)
  })

  it('6: 채우기 결과가 저장 내용이 되고, 채우기 실패·저장 스키마 실패는 schema_invalid다', async () => {
    const Stored = z.object({ kind: z.string(), title: z.string() })
    const filledOk = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: NullableSchema,
      hooks: { ...passHooks(NullableSchema), fill: (llm) => ({ ok: true, value: { kind: llm.kind, title: '입력에서 채운 원문' } }), storedSchema: Stored },
      llmClient: scriptedLlmClient([ok('{"kind":"a"}')]),
    })
    expect(filledOk.outcome).toBe('success')
    if (filledOk.outcome === 'success') expect(filledOk.content).toEqual({ kind: 'a', title: '입력에서 채운 원문' })

    const fillFails = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: NullableSchema,
      hooks: { ...passHooks(NullableSchema), fill: () => ({ ok: false, detail: '입력에 없는 ID' }) },
      llmClient: scriptedLlmClient([ok('{"kind":"a"}'), ok('{"kind":"a"}')]),
    })
    expect(fillFails.outcome === 'failure' && fillFails.reason).toBe('schema_invalid')

    const storedFails = await runCornerPipeline({
      input: {},
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: NullableSchema,
      hooks: { ...passHooks(NullableSchema), storedSchema: Stored },
      llmClient: scriptedLlmClient([ok('{"kind":"a"}'), ok('{"kind":"a"}')]), // title이 없어 저장 스키마 실패
    })
    expect(storedFails.outcome === 'failure' && storedFails.reason).toBe('schema_invalid')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// validateCornerResponse — 17-0-4의 순서 전체 (합성 스키마·합성 훅).
// 옛 `validateCornerContent` 블록을 대체한다(② 함수 제거).
// ─────────────────────────────────────────────────────────────────────────

function passThroughSpec<T>(schema: z.ZodType<T>): CornerResponseSpec<T, T> {
  return {
    llmSchema: schema,
    isExplicitEmpty: () => false,
    resolveReferences: () => ({ ok: true }),
    fill: (llm) => ({ ok: true, value: llm }),
    storedSchema: schema,
  }
}

const SamplePayloadSchema = z.object({
  title: z.string(),
  note: z.string().optional(),
})

describe('validateCornerResponse — 순서: JSON.parse → FORBIDDEN_KEYS(원본) → Zod → 빈 결과 → ID 해석 → 채우기 → 저장 스키마 (Part 17-0-4)', () => {
  it('전부 통과하면 ValidatedContent를 반환한다', () => {
    const result = validateCornerResponse(
      JSON.stringify({ title: '한강 데이트', note: '자전거' }),
      passThroughSpec(SamplePayloadSchema),
      CONTEXT,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.content).toEqual({ title: '한강 데이트', note: '자전거' })
    }
  })

  it('1: JSON이 아니면 schema_invalid (이후 단계는 실행되지 않는다)', () => {
    const resolveReferences = jest.fn(() => ({ ok: true as const }))
    const result = validateCornerResponse(
      '이건 JSON이 아님',
      { ...passThroughSpec(SamplePayloadSchema), resolveReferences },
      CONTEXT,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('schema_invalid')
    expect(resolveReferences).not.toHaveBeenCalled()
  })

  it('2: 스키마에 선언된 금지 키 → forbidden_content', () => {
    const SchemaWithScore = z.object({ title: z.string(), score: z.number() })
    const result = validateCornerResponse(
      JSON.stringify({ title: 'x', score: 100 }),
      passThroughSpec(SchemaWithScore),
      CONTEXT,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('forbidden_content')
      expect(result.detail).toContain('score')
    }
  })

  it('2: 스키마에 없는 금지 키도 forbidden_content다 (원본 객체에 걸린다 — Zod가 지우기 전)', () => {
    const result = validateCornerResponse(
      JSON.stringify({ title: 'x', verdict: 'good' }),
      passThroughSpec(SamplePayloadSchema),
      CONTEXT,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('forbidden_content')
  })

  it('2: 중첩 필드의 금지 키도 forbidden_content로 잡힌다', () => {
    const NestedSchema = z.object({
      title: z.string(),
      payload: z.object({ verdict: z.string() }),
    })
    const result = validateCornerResponse(
      JSON.stringify({ title: 'x', payload: { verdict: 'good' } }),
      passThroughSpec(NestedSchema),
      CONTEXT,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('forbidden_content')
  })

  it('2: 금지 키가 있으면 Zod·훅은 실행되지 않는다', () => {
    const isExplicitEmpty = jest.fn(() => false)
    const result = validateCornerResponse(
      JSON.stringify({ title: 42, advice: '더 자주 만나세요' }),
      { ...passThroughSpec(SamplePayloadSchema), isExplicitEmpty },
      CONTEXT,
    )
    expect(result.ok === false && result.reason).toBe('forbidden_content')
    expect(isExplicitEmpty).not.toHaveBeenCalled()
  })

  it('2: 금지 목록 밖의 모르는 키는 걸리지 않고 Zod가 지운다 (.strict() 아님)', () => {
    const result = validateCornerResponse(
      JSON.stringify({ title: 'x', mood: '잔잔함' }),
      passThroughSpec(SamplePayloadSchema),
      CONTEXT,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.content).toEqual({ title: 'x' })
  })

  it('3: Zod 파싱 실패 → schema_invalid (훅은 실행되지 않는다)', () => {
    const isExplicitEmpty = jest.fn(() => false)
    const result = validateCornerResponse(
      JSON.stringify({ title: 42 }),
      { ...passThroughSpec(SamplePayloadSchema), isExplicitEmpty },
      CONTEXT,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('schema_invalid')
      expect(typeof result.detail).toBe('string')
    }
    expect(isExplicitEmpty).not.toHaveBeenCalled()
  })

  it('3: JSON은 맞지만 완전히 다른 타입(배열)이어도 schema_invalid로 처리된다(throw하지 않는다)', () => {
    const result = validateCornerResponse('[1,2,3]', passThroughSpec(SamplePayloadSchema), CONTEXT)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('schema_invalid')
  })

  it('4: 명시적 빈 결과 → insufficient_input (ID 해석·채우기는 실행되지 않는다)', () => {
    const resolveReferences = jest.fn(() => ({ ok: true as const }))
    const fill = jest.fn((llm: { title: string }) => ({ ok: true as const, value: llm }))
    const result = validateCornerResponse(
      JSON.stringify({ title: 'none' }),
      { ...passThroughSpec(SamplePayloadSchema), isExplicitEmpty: (llm) => llm.title === 'none', resolveReferences, fill },
      CONTEXT,
    )
    expect(result.ok === false && result.reason).toBe('insufficient_input')
    expect(resolveReferences).not.toHaveBeenCalled()
    expect(fill).not.toHaveBeenCalled()
  })

  it('5: ID 해석 실패 → schema_invalid, detail이 보존되고 채우기는 실행되지 않는다', () => {
    const fill = jest.fn((llm: { title: string }) => ({ ok: true as const, value: llm }))
    const result = validateCornerResponse(
      JSON.stringify({ title: 'x' }),
      { ...passThroughSpec(SamplePayloadSchema), resolveReferences: () => ({ ok: false, detail: '소속: 다른 커플의 레코드' }), fill },
      CONTEXT,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('schema_invalid')
      expect(result.detail).toBe('소속: 다른 커플의 레코드')
    }
    expect(fill).not.toHaveBeenCalled()
  })

  it('훅은 호출자 맥락을 받는다', () => {
    const seen: string[] = []
    validateCornerResponse(
      JSON.stringify({ title: 'x' }),
      {
        ...passThroughSpec(SamplePayloadSchema),
        resolveReferences: (_llm, ctx) => {
          seen.push(ctx.coupleId)
          return { ok: true }
        },
        fill: (llm, ctx) => {
          seen.push(ctx.coupleId)
          return { ok: true, value: llm }
        },
      },
      CONTEXT,
    )
    expect(seen).toEqual(['couple-a', 'couple-a'])
  })

  it('6: 채우기 → 저장 스키마를 거친 값이 저장 내용이 되고, 채운 내용에는 금지 키 검사를 걸지 않는다', () => {
    // 저장 스키마 고유 키(`score` — 엔진 주입값이라고 가정)는 LLM 출력이 아니므로 걸리지 않는다.
    const Stored = z.object({ title: z.string(), score: z.number() })
    const result = validateCornerResponse(
      JSON.stringify({ title: 'ref-1' }),
      {
        llmSchema: z.object({ title: z.string() }),
        isExplicitEmpty: () => false,
        resolveReferences: () => ({ ok: true }),
        fill: (llm) => ({ ok: true, value: { title: `원문(${llm.title})`, score: 7 } }),
        storedSchema: Stored,
      },
      CONTEXT,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.content).toEqual({ title: '원문(ref-1)', score: 7 })
  })

  it('6: 채우기 실패 → schema_invalid, 저장 스키마 실패 → schema_invalid', () => {
    const base = passThroughSpec(SamplePayloadSchema)
    const fillFails = validateCornerResponse(
      JSON.stringify({ title: 'x' }),
      { ...base, fill: () => ({ ok: false, detail: '입력에 없는 ID' }) },
      CONTEXT,
    )
    expect(fillFails.ok === false && fillFails.reason).toBe('schema_invalid')

    const storedFails = validateCornerResponse(
      JSON.stringify({ title: 'x' }),
      { ...base, fill: () => ({ ok: true, value: { title: 123 } }) },
      CONTEXT,
    )
    expect(storedFails.ok === false && storedFails.reason).toBe('schema_invalid')
  })
})

describe('결정론 — 동일 입력 100회 반복 → 100회 동일 결과 (validateCornerResponse)', () => {
  it('validateCornerResponse는 같은 입력에 항상 같은 결과를 낸다', () => {
    const SchemaWithScore = z.object({ title: z.string(), score: z.number() })
    const text = JSON.stringify({ title: 'x', score: 1 })
    const results = Array.from({ length: 100 }, () =>
      validateCornerResponse(text, passThroughSpec(SchemaWithScore), CONTEXT),
    )
    for (const r of results) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('forbidden_content')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// r42 — 훅 필수화, 기간 단언, 기간 판정 함수 하나, 맥락 값 검증
// ─────────────────────────────────────────────────────────────────────────

describe('r42 — 검사 단계는 전부 필수다 (빠지면 컴파일 오류)', () => {
  // 아래 호출은 실행하지 않는다 — 타입 검사만 본다. `@ts-expect-error`가 두 게이트에서
  // 0 에러라면 각 줄이 실제로 오류를 내고 있다는 뜻이다(오류가 없으면 디렉티브가 오류가 된다).
  const base = {
    input: {},
    context: CONTEXT,
    preconditionCheck: () => true,
    buildPrompt: () => 'p',
    schema: PayloadSchema,
    llmClient: scriptedLlmClient([ok('{"title":"x"}')]),
  }
  const hooks = passHooks(PayloadSchema)

  it('빈 결과 판정·ID 해석·원문 채우기·scopedRecords를 하나씩 빼면 각각 컴파일이 안 된다', () => {
    const typeOnly = (): void => {
      // @ts-expect-error — 빈 결과 판정(isExplicitEmpty)이 빠졌다
      void runCornerPipeline({ ...base, scopedRecords: NO_RECORDS, hooks: { resolveReferences: hooks.resolveReferences, fill: hooks.fill, storedSchema: hooks.storedSchema } })
      // @ts-expect-error — ID 해석(resolveReferences)이 빠졌다
      void runCornerPipeline({ ...base, scopedRecords: NO_RECORDS, hooks: { isExplicitEmpty: hooks.isExplicitEmpty, fill: hooks.fill, storedSchema: hooks.storedSchema } })
      // @ts-expect-error — 원문 채우기(fill)가 빠졌다
      void runCornerPipeline({ ...base, scopedRecords: NO_RECORDS, hooks: { isExplicitEmpty: hooks.isExplicitEmpty, resolveReferences: hooks.resolveReferences, storedSchema: hooks.storedSchema } })
      // @ts-expect-error — hooks 통째로 빠졌다
      void runCornerPipeline({ ...base, scopedRecords: NO_RECORDS })
      // @ts-expect-error — scopedRecords가 빠졌다
      void runCornerPipeline({ ...base, hooks })
    }
    expect(typeof typeOnly).toBe('function')
  })
})

describe('r42 — 기간 판정 함수는 하나다 (isRecordInPeriod)', () => {
  const at = (iso: string): Date => new Date(iso)

  it('경계 — 시작 시각과 같으면 통과, 끝 시각과 같으면 막힌다 (끝 배타)', () => {
    expect(isRecordInPeriod({ occurredAt: PERIOD_START }, CONTEXT.period)).toBe(true)
    expect(isRecordInPeriod({ occurredAt: PERIOD_END }, CONTEXT.period)).toBe(false)
    expect(isRecordInPeriod({ occurredAt: at('2026-10-31T23:59:59.999Z') }, CONTEXT.period)).toBe(true)
    expect(isRecordInPeriod({ occurredAt: at('2026-09-30T23:59:59.999Z') }, CONTEXT.period)).toBe(false)
  })

  it('경계 — 단언(입력 쪽)도 같다: 끝 시각 레코드는 LLM 0회로 막히고, 시작 시각 레코드는 통과한다', async () => {
    const run = (occurredAt: Date) => {
      const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
      const promise = runCornerPipeline({
        input: { records: [{ id: 'b-1', coupleId: 'couple-a', occurredAt }] },
        context: CONTEXT,
        scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      })
      return { promise, llmClient }
    }
    const atEnd = run(PERIOD_END)
    await expect(atEnd.promise).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(atEnd.llmClient.callCount()).toBe(0)
    const atStart = run(PERIOD_START)
    expect((await atStart.promise).outcome).toBe('success')
  })

  it('재소환 — 같은 커플: 표시 + 기간 이전은 통과, 표시 없이 기간 이전은 막힌다', async () => {
    const before = at('2026-08-10T00:00:00.000Z')
    const run = (recalled: boolean | undefined) => {
      const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
      const promise = runCornerPipeline({
        input: { records: [{ id: 'r-1', coupleId: 'couple-a', occurredAt: before, recalled }] },
        context: CONTEXT,
        scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      })
      return { promise, llmClient }
    }
    expect((await run(true).promise).outcome).toBe('success')
    const plain = run(undefined)
    await expect(plain.promise).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(plain.llmClient.callCount()).toBe(0)
    await expect(run(false).promise).rejects.toBeInstanceOf(CoupleMembershipError)
  })

  it('재소환인데 기간 안인 레코드는 막힌다 ("기간 안" 대신 "기간 이전"을 요구)', () => {
    expect(isRecordInPeriod({ occurredAt: IN_PERIOD, recalled: true }, CONTEXT.period)).toBe(false)
    expect(isRecordInPeriod({ occurredAt: PERIOD_START, recalled: true }, CONTEXT.period)).toBe(false)
  })

  it('재소환 — 다른 커플: 재소환 표시가 있어도 막힌다 (표시로 커플 조건을 풀 수 없다)', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const cornersClient = recordingCornersClient()
    const promise = runAndPersist(
      {
        input: { records: [{ id: 'x-1', coupleId: 'couple-b', occurredAt: new Date('2026-08-10T00:00:00.000Z'), recalled: true }] },
        context: CONTEXT,
        scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      },
      cornersClient,
    )
    await expect(promise).rejects.toMatchObject({ name: 'CoupleMembershipError', offendingRecordIds: ['x-1'] })
    expect(llmClient.callCount()).toBe(0)
    expect(cornersClient.updates).toHaveLength(0)
  })

  describe('응답 쪽(ID 해석)도 같은 결과', () => {
    const before = at('2026-08-10T00:00:00.000Z')
    const records: ScopedRecord[] = [
      { id: 'in', coupleId: 'couple-a', occurredAt: IN_PERIOD },
      { id: 'start', coupleId: 'couple-a', occurredAt: PERIOD_START },
      { id: 'end', coupleId: 'couple-a', occurredAt: PERIOD_END },
      { id: 'old', coupleId: 'couple-a', occurredAt: before },
      { id: 'old-recalled', coupleId: 'couple-a', occurredAt: before, recalled: true },
      { id: 'foreign-recalled', coupleId: 'couple-b', occurredAt: before, recalled: true },
    ]
    const resolve = (id: string) => resolveRecordReferences([id], records, CONTEXT).ok

    it('경계와 재소환이 단언 쪽과 같다', () => {
      expect(resolve('in')).toBe(true)
      expect(resolve('start')).toBe(true)
      expect(resolve('end')).toBe(false)
      expect(resolve('old')).toBe(false)
      expect(resolve('old-recalled')).toBe(true)
      expect(resolve('foreign-recalled')).toBe(false)
      expect(resolve('없는-ID')).toBe(false)
    })

    it('validateCornerResponse 안에서도 같다 — 통과하면 성공, 막히면 schema_invalid', () => {
      const refSchema = z.object({ ref: z.string() })
      const spec: CornerResponseSpec<{ ref: string }, { ref: string }> = {
        ...passThroughSpec(refSchema),
        resolveReferences: (llm, ctx) => resolveRecordReferences([llm.ref], records, ctx),
      }
      const run = (ref: string) => validateCornerResponse(JSON.stringify({ ref }), spec, CONTEXT)
      expect(run('old-recalled').ok).toBe(true)
      for (const blocked of ['old', 'end', 'foreign-recalled']) {
        const r = run(blocked)
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toBe('schema_invalid')
      }
    })
  })
})

describe('r42 — 맥락 값 검증: 틀리면 LLM 0회·저장 0회·오류 전파', () => {
  const cases: Array<[string, CornerContext]> = [
    ['빈 커플 식별자', { ...CONTEXT, coupleId: '' }],
    ['날짜가 아닌 기간 시작', { ...CONTEXT, period: { start: new Date('not a date'), end: PERIOD_END } }],
    ['날짜가 아닌 기간 끝', { ...CONTEXT, period: { start: PERIOD_START, end: new Date(NaN) } }],
    ['뒤집힌 기간(시작이 끝보다 늦음)', { ...CONTEXT, period: { start: PERIOD_END, end: PERIOD_START } }],
  ]

  it.each(cases)('%s', async (_name, context) => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const cornersClient = recordingCornersClient()
    const promise = runAndPersist(
      {
        // 레코드가 멀쩡해 보여도 맥락 값이 틀리면 멈춘다.
        input: { records: [{ id: 'c-1', coupleId: context.coupleId, occurredAt: IN_PERIOD }] },
        context,
        scopedRecords: (input: { records: ScopedRecord[] }) => input.records,
        preconditionCheck: () => true,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      },
      cornersClient,
    )
    await expect(promise).rejects.toBeInstanceOf(InvalidCornerContextError)
    await expect(promise).rejects.toBeInstanceOf(CoupleMembershipError) // 소속 단언과 같은 곳에서 잡힌다
    expect(llmClient.callCount()).toBe(0)
    expect(cornersClient.updates).toHaveLength(0)
  })

  it('선행 검사가 미달이어도 맥락 값 검증이 먼저다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    await expect(
      runCornerPipeline({
        input: {},
        context: { ...CONTEXT, coupleId: '' },
        scopedRecords: NO_RECORDS,
        preconditionCheck: () => false,
        buildPrompt: () => 'p',
        schema: PayloadSchema,
        hooks: passHooks(PayloadSchema),
        llmClient,
      }),
    ).rejects.toBeInstanceOf(InvalidCornerContextError)
    expect(llmClient.callCount()).toBe(0)
  })

  it('대조: 시작과 끝이 같은 기간은 값으로는 올바르다', async () => {
    const llmClient = scriptedLlmClient([ok('{"title":"x"}')])
    const result = await runCornerPipeline({
      input: {},
      context: { ...CONTEXT, period: { start: PERIOD_START, end: PERIOD_START } },
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildPrompt: () => 'p',
      schema: PayloadSchema,
      hooks: passHooks(PayloadSchema),
      llmClient,
    })
    expect(result.outcome).toBe('success')
  })
})
