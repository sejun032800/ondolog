/// <reference types="jest" />
import { z } from 'zod'
import { runCornerModule, runCornerPipeline, NO_ID_REFERENCES, type CornerContext } from './cornerPipeline.ts'
import type { ScopedRecord } from './cornerPipeline.ts'
import { sweetWordsModule } from './corners/sweetWords.ts'
import type { LlmRequest } from './llmRequest.ts'
import { INPUT_TOKEN_STOP_BAND, INPUT_TOKEN_STOP_LIMIT, estimateRequestTokens } from './tokenEstimate.ts'
import { MONTHLY_CONTEXT, message, scriptedLlmClient } from './testFixtures/cornerFixtures.ts'
import { SKIP_REASON_RETRY_POLICY } from '../../../src/engine/corners/pipelineContracts.ts'

/**
 * 안전 정지 - 코너 하나의 추정 입력 토큰 > 40,000이면 LLM을 부르지 않는다 (MASTER §17-0-9-F-2, r59 / 위임 52r2-).
 * 결과는 실패 사유 4값 밖이다(`outcome: 'halted'`, `reason` 없음).
 */

const CONTEXT: CornerContext = {
  coupleId: 'couple-a',
  period: { start: new Date('2026-10-01T00:00:00.000Z'), end: new Date('2026-11-01T00:00:00.000Z') },
  cadence: 'monthly',
}
const Schema = z.object({ title: z.string() })
const NO_RECORDS = (): readonly ScopedRecord[] => []

/** 한글 음절 `n`자 하나짜리 user 블록 - 중간 구간 가중치가 한글 1.0이라 추정 토큰이 정확히 n이다. */
function requestOfTokens(n: number): LlmRequest {
  return { system: [], user: [{ text: '가'.repeat(n) }] }
}

function run(n: number) {
  const llm = scriptedLlmClient([JSON.stringify({ title: 'x' })])
  const result = runCornerPipeline({
    input: null,
    context: CONTEXT,
    scopedRecords: NO_RECORDS,
    preconditionCheck: () => true,
    buildRequest: () => requestOfTokens(n),
    schema: Schema,
    hooks: {
      isExplicitEmpty: () => false,
      references: NO_ID_REFERENCES,
      derive: (filled) => ({ ok: true, value: filled }),
      storedSchema: Schema,
    },
    llmClient: llm,
  })
  return { result, llm }
}

describe('안전 정지 (§17-0-9-F-2)', () => {
  it('상한은 40,000이고 추정은 TOKEN_WEIGHTS 중간값이다', () => {
    expect(INPUT_TOKEN_STOP_LIMIT).toBe(40_000)
    expect(INPUT_TOKEN_STOP_BAND).toBe('mid')
    expect(estimateRequestTokens(requestOfTokens(123), 'mid')).toBe(123)
  })

  it('40,000 자체는 생성한다', async () => {
    const { result, llm } = run(40_000)
    expect((await result).outcome).toBe('success')
    expect(llm.requests).toHaveLength(1)
  })

  it('40,001은 LLM을 한 번도 부르지 않고 정지한다 - 코너·추정값·상한을 남긴다', async () => {
    const { result, llm } = run(40_001)
    const r = await result
    expect(llm.requests).toHaveLength(0)
    expect(r).toEqual({
      outcome: 'halted',
      haltedFor: 'input_token_limit',
      estimatedInputTokens: 40_001,
      limit: 40_000,
      detail: expect.stringContaining('40001'),
      llmCallAttempts: 0,
    })
  })

  it('정지 결과에는 실패 사유가 없고, 실패 사유 4값에 어느 것도 더해지지 않았다', async () => {
    const r = await run(50_000).result
    expect(r).not.toHaveProperty('reason')
    expect(Object.keys(r)).not.toContain('reason')
    expect(Object.keys(SKIP_REASON_RETRY_POLICY).sort()).toEqual(['forbidden_content', 'generation_failed', 'insufficient_input', 'schema_invalid'])
  })

  it('추정은 system·user 블록 전체를 센다 - system만 커도 정지한다', async () => {
    const llm = scriptedLlmClient(['{}'])
    const r = await runCornerPipeline({
      input: null,
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => true,
      buildRequest: () => ({ system: [{ text: '가'.repeat(30_000) }], user: [{ text: '나'.repeat(10_001) }] }),
      schema: Schema,
      hooks: { isExplicitEmpty: () => false, references: NO_ID_REFERENCES, derive: (f) => ({ ok: true, value: f }), storedSchema: Schema },
      llmClient: llm,
    })
    expect(r.outcome).toBe('halted')
    expect(llm.requests).toHaveLength(0)
  })

  it('재료가 없으면 정지가 아니라 선행 검사의 insufficient_input이다(순서: 선행 검사가 먼저)', async () => {
    const llm = scriptedLlmClient(['{}'])
    const r = await runCornerPipeline({
      input: null,
      context: CONTEXT,
      scopedRecords: NO_RECORDS,
      preconditionCheck: () => false,
      buildRequest: () => requestOfTokens(99_999),
      schema: Schema,
      hooks: { isExplicitEmpty: () => false, references: NO_ID_REFERENCES, derive: (f) => ({ ok: true, value: f }), storedSchema: Schema },
      llmClient: llm,
    })
    expect(r).toMatchObject({ outcome: 'failure', reason: 'insufficient_input' })
  })

  it('실제 코너(다정한 말들) 경로: 입력이 크면 runCornerModule도 호출 0회로 정지, 작으면 그대로 생성', async () => {
    const long = '다정한 말 '.repeat(2_000) // 한글 6자 + 공백... 메시지 하나가 만 자 이상
    const big = Array.from({ length: 5 }, (_, i) => message(`m-${i}`, `2026-08-${10 + i}T09:00:00`, '세준', long))
    const llm = scriptedLlmClient(['{"kind":"none"}'])
    const r = await runCornerModule(sweetWordsModule, {
      input: { warmthIndex: null, messages: big },
      context: MONTHLY_CONTEXT,
      llmClient: llm,
    })
    expect(r).toMatchObject({ outcome: 'halted', cornerName: '다정한 말들', limit: 40_000 })
    expect(llm.requests).toHaveLength(0)

    const small = scriptedLlmClient(['{"kind":"none"}'])
    const ok = await runCornerModule(sweetWordsModule, {
      input: { warmthIndex: null, messages: [message('m-1', '2026-08-10T09:00:00', '세준', '안녕')] },
      context: MONTHLY_CONTEXT,
      llmClient: small,
    })
    expect(ok.outcome).toBe('failure') // 빈 결과(none) -> insufficient_input: 정지가 아니다
    expect(small.requests).toHaveLength(1)
  })
})
