/// <reference types="jest" />
/**
 * 84-a2 LLM 요청 고치기 (ROADMAP r131 R131-1~2) - 요청 본문 고정 · 재요청 · 응답 읽기(사고 블록) · 사용량 · 잘림.
 * 위임: .claude/state/prompts/phase-7/84-a2-dispatch-llm-request-fix.md
 * 근거: https://platform.claude.com/docs/en/models/opus-5-5/migration-guide ·
 *       https://platform.claude.com/docs/en/build-with-claude/thinking
 * 실제 네트워크 · 실제 시계 0: fetch · 대기 · 타이머를 모두 주입한다. LLM 호출 0.
 */
import { ALLOWED_LLM_MODELS, LLM_MAX_TOKENS, usageCostUsd } from '../../../src/engine/corners/llmSafety.ts'
import {
  CORNER_LLM_CALL_BUDGET,
  REQUEST_BODY_KEYS,
  createLlmClient,
  extractResponseText,
  isRetryableStatus,
  summarizeErrorBody,
  type LlmResponseInfo,
} from './llmClient.ts'
import type { LlmRequest } from './llmRequest.ts'
import { runCornerModule } from './cornerPipeline.ts'
import { sweetWordsModule, type SweetWordsInput } from './corners/sweetWords.ts'
import { CHAT_MESSAGES, MONTHLY_CONTEXT } from './testFixtures/cornerFixtures.ts'

const noSleep = () => Promise.resolve()
const timers = { setTimerImpl: () => ({}), clearTimerImpl: () => undefined }

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body } as unknown as Response
}

/** 시스템 블록(캐시 표시 포함)과 사용자 블록이 다 있는 요청 - 본문 키가 모두 나오게. */
const FULL_REQUEST: LlmRequest = {
  system: [{ text: '역할과 형식', cacheBreakpoint: true }],
  user: [{ text: '입력 레코드' }],
}

function capture(reply: () => Response = () => response(200, { content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' })) {
  const bodies: Record<string, unknown>[] = []
  const fetchImpl = jest.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    return reply()
  })
  return { bodies, fetchImpl }
}

describe('84-a2 ① 요청 본문 고정 - 두 모델 각각', () => {
  for (const model of ALLOWED_LLM_MODELS) {
    it(`${model}: 허용 키만(model · max_tokens · system · messages) · 샘플링 값 · thinking · effort · prefill 0`, async () => {
      const { bodies, fetchImpl } = capture()
      const client = createLlmClient({ apiKey: 'k', model, fetchImpl, sleepImpl: noSleep, ...timers })
      await client.call(FULL_REQUEST)

      expect(bodies).toHaveLength(1)
      const body = bodies[0]
      expect(Object.keys(body).sort()).toEqual([...REQUEST_BODY_KEYS].sort())
      for (const banned of ['temperature', 'top_p', 'top_k', 'thinking', 'output_config', 'effort', 'budget_tokens', 'stop_sequences']) {
        expect(body).not.toHaveProperty(banned)
      }
      expect(JSON.stringify(body)).not.toMatch(/budget_tokens|"disabled"|temperature|top_p|top_k/)
      expect(body.model).toBe(model)
      expect(body.max_tokens).toBe(LLM_MAX_TOKENS)
      // prefill 0: 메시지는 user 하나뿐 - 끝이 assistant가 아니다.
      expect(body.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: '입력 레코드' }] }])
      expect(body.system).toEqual([{ type: 'text', text: '역할과 형식', cache_control: { type: 'ephemeral' } }])
    })
  }

  it('system 블록이 없으면 system 키도 없다(허용 키의 부분집합)', async () => {
    const { bodies, fetchImpl } = capture()
    const client = createLlmClient({ apiKey: 'k', model: 'claude-sonnet-5-5', fetchImpl, sleepImpl: noSleep, ...timers })
    await client.call({ system: [], user: [{ text: 'x' }] })
    expect(Object.keys(bodies[0]).sort()).toEqual(['max_tokens', 'messages', 'model'])
  })
})

describe('84-a2 ② 재요청 - 상태 코드별 보낸 횟수', () => {
  const cases: Array<[number, number]> = [
    [400, 1],
    [401, 1],
    [403, 1],
    [404, 1],
    [429, CORNER_LLM_CALL_BUDGET],
    [500, CORNER_LLM_CALL_BUDGET],
    [503, CORNER_LLM_CALL_BUDGET],
    [529, CORNER_LLM_CALL_BUDGET],
  ]
  for (const [status, sent] of cases) {
    it(`HTTP ${status}이 계속되면 보낸 수 ${sent} · onResponse ${sent}번 · generation_failed`, async () => {
      const fetchImpl = jest.fn(async () => response(status, { type: 'error', error: { type: 'some_error', message: 'm' }, request_id: 'req_abc123' }))
      const sleeps: number[] = []
      const infos: LlmResponseInfo[] = []
      const client = createLlmClient({
        apiKey: 'k',
        model: 'claude-opus-5-5',
        fetchImpl,
        sleepImpl: async (ms) => {
          sleeps.push(ms)
        },
        onResponse: (i) => infos.push(i),
        ...timers,
      })
      const result = await client.call(FULL_REQUEST)
      expect(result.ok).toBe(false)
      expect(fetchImpl).toHaveBeenCalledTimes(sent)
      expect(infos).toHaveLength(sent)
      expect(sleeps).toHaveLength(sent - 1) // 다시 보낼 때만 기다린다
      if (!result.ok) {
        expect(result.reason).toBe('generation_failed')
        expect(result.detail).toBe(`HTTP ${status}: some_error: m`)
        expect(result.detail).not.toContain('req_')
      }
    })
  }

  it('시간 초과(응답 없음)는 다시 보낸다 - 둘째 시도 성공 · 보낸 수 2', async () => {
    let n = 0
    // 주입 타이머: 첫 시도의 fetch가 걸려 있는 동안 시간 상한 콜백을 바로 부른다(실제 시계 0).
    const pending: Array<() => void> = []
    const fetchImpl = jest.fn((_u: unknown, init?: RequestInit) => {
      n += 1
      if (n === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          pending.forEach((fire) => fire())
        })
      }
      return Promise.resolve(response(200, { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }))
    })
    const client = createLlmClient({
      apiKey: 'k',
      model: 'claude-sonnet-5-5',
      fetchImpl,
      sleepImpl: noSleep,
      setTimerImpl: (fn) => {
        pending.push(fn)
        return {}
      },
      clearTimerImpl: () => undefined,
    })
    const result = await client.call(FULL_REQUEST)
    expect(result).toEqual({ ok: true, text: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('429 다음 400이면 400에서 멈춘다 - 보낸 수 2', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(429, {}))
      .mockResolvedValueOnce(response(400, {}))
      .mockResolvedValue(response(200, { content: [{ type: 'text', text: 'never' }] }))
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noSleep, ...timers })
    const result = await client.call(FULL_REQUEST)
    expect(result.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('isRetryableStatus: 408 · 429 · 5xx만 참', () => {
    expect([400, 401, 403, 404, 409, 413, 422].map(isRetryableStatus)).toEqual([false, false, false, false, false, false, false])
    expect([408, 429, 500, 502, 503, 529].map(isRetryableStatus)).toEqual([true, true, true, true, true, true])
  })

  it('오류 본문 요약: error.type · message만 · 요청 id 버림 · JSON이 아니면 id 모양 지움', () => {
    expect(
      summarizeErrorBody('{"type":"error","error":{"type":"invalid_request_error","message":"`temperature` is deprecated for this model."},"request_id":"req_011Abc"}'),
    ).toBe('invalid_request_error: `temperature` is deprecated for this model.')
    expect(summarizeErrorBody('upstream fail req_011Xyz9 retry')).toBe('upstream fail req_[지움] retry')
  })
})

describe('84-a2 ④-a 응답에서 text 블록만 읽기', () => {
  async function read(content: unknown, stop_reason = 'end_turn') {
    const client = createLlmClient({
      apiKey: 'k',
      model: 'claude-opus-5-5',
      fetchImpl: async () => response(200, { content, stop_reason }),
      sleepImpl: noSleep,
      ...timers,
    })
    return client.call(FULL_REQUEST)
  }

  it('thinking 블록이 앞에 있어도 text만 읽는다', async () => {
    expect(await read([{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text: '{"a":1}' }])).toEqual({ ok: true, text: '{"a":1}' })
  })

  it('thinking만 있으면 빈 텍스트(형식 오류) - 보낸 수 1 · 안에서 다시 보내지 않음', async () => {
    const fetchImpl = jest.fn(async () => response(200, { content: [{ type: 'thinking', thinking: '', signature: 's' }], stop_reason: 'end_turn' }))
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noSleep, ...timers })
    expect(await client.call(FULL_REQUEST)).toEqual({ ok: true, text: '' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('text 블록이 여러 개면 순서대로 이어 붙인다(사이의 thinking은 건너뜀)', async () => {
    expect(
      await read([
        { type: 'thinking', thinking: '' },
        { type: 'text', text: '{"a":' },
        { type: 'thinking', thinking: 'progress' },
        { type: 'text', text: '1}' },
      ]),
    ).toEqual({ ok: true, text: '{"a":1}' })
  })

  it('extractResponseText: 배열 아님 · text 없음 -> null', () => {
    expect(extractResponseText(undefined)).toBeNull()
    expect(extractResponseText([{ type: 'thinking', thinking: 'x' }])).toBeNull()
    expect(extractResponseText([{ type: 'text', text: '' }])).toBe('')
  })

  it('파이프라인까지: thinking만 오는 응답은 형식 오류(schema_invalid) - 성공(지면) 0 · 보낸 수 = 골격 시도 수', async () => {
    const input: SweetWordsInput = { warmthIndex: null, messages: CHAT_MESSAGES }
    let n = 0
    const fetchImpl = jest.fn(async () => {
      n += 1
      return response(200, { content: [{ type: 'thinking', thinking: '' }], stop_reason: 'end_turn' })
    })
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noSleep, ...timers })
    const result = await runCornerModule(sweetWordsModule, { input, context: MONTHLY_CONTEXT, llmClient: client })
    expect(result.outcome).toBe('failure')
    if (result.outcome === 'failure') expect(result.reason).toBe('schema_invalid')
    expect(n).toBe(result.llmCallAttempts) // 형식 오류 재요청은 call() 1번 = 보낸 1번
  })
})

describe('84-a2 ④-b 사용량 - 생각 토큰은 output_tokens 안에(두 번 더하지 않음)', () => {
  it('onResponse 사용량 = usage 네 값 그대로 · 비용 = 출력 단가 × output_tokens', async () => {
    const infos: LlmResponseInfo[] = []
    const client = createLlmClient({
      apiKey: 'k',
      model: 'claude-opus-5-5',
      fetchImpl: async () =>
        response(200, {
          content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{}' }],
          stop_reason: 'end_turn',
          // 생각 + 답 = 3000(청구 출력). 생각을 따로 알려 주는 칸이 와도 더하지 않는다.
          usage: { input_tokens: 1000, output_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, thinking_tokens: 2500 },
        }),
      sleepImpl: noSleep,
      onResponse: (i) => infos.push(i),
      ...timers,
    })
    await client.call(FULL_REQUEST)
    expect(infos[0].usage).toEqual({ input: 1000, output: 3000, cacheWrite: 0, cacheRead: 0 })
    // Opus 5.5: 입력 $4 · 출력 $20 / MTok
    expect(usageCostUsd('claude-opus-5-5', infos[0].usage!)).toBeCloseTo((1000 * 4 + 3000 * 20) / 1e6, 12)
  })
})

describe('84-a2 ④-c max_tokens 잘림 - 형식 오류(지면에 싣지 않음)', () => {
  it('stop_reason=max_tokens면 text가 있어도 빈 텍스트 · stopReason 알림', async () => {
    const infos: LlmResponseInfo[] = []
    const client = createLlmClient({
      apiKey: 'k',
      model: 'claude-sonnet-5-5',
      fetchImpl: async () => response(200, { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"main":[' }], stop_reason: 'max_tokens' }),
      sleepImpl: noSleep,
      onResponse: (i) => infos.push(i),
      ...timers,
    })
    expect(await client.call(FULL_REQUEST)).toEqual({ ok: true, text: '' })
    expect(infos[0].stopReason).toBe('max_tokens')
  })

  it('파이프라인까지: 잘린 응답만 오면 schema_invalid 실패 - 성공(지면) 0', async () => {
    const input: SweetWordsInput = { warmthIndex: null, messages: CHAT_MESSAGES }
    const fetchImpl = jest.fn(async () => response(200, { content: [{ type: 'text', text: '{}' }], stop_reason: 'max_tokens' }))
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noSleep, ...timers })
    const result = await runCornerModule(sweetWordsModule, { input, context: MONTHLY_CONTEXT, llmClient: client })
    expect(result.outcome).toBe('failure')
    if (result.outcome === 'failure') expect(result.reason).toBe('schema_invalid')
  })
})
