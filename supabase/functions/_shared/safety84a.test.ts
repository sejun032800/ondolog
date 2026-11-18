/// <reference types="jest" />
/**
 * 84-a 안전장치 - llmClient(temperature · 호출 120초 · 시도 직전 판정 · 사용량)와 골격(값 검사 재요청 · 안전 정지).
 * 위임: .claude/state/prompts/phase-7/84-a-dispatch-llm-safety.md (ROADMAP r124 R124-2 · R124-3 · R124-4)
 * 실제 네트워크 · 실제 시계 0: fetch · 타이머 · 시계를 모두 주입한다(76-j 교훈). LLM 호출 0.
 */
import { LLM_TEMPERATURE } from '../../../src/engine/corners/llmSafety.ts'
import { createLlmClient, CORNER_LLM_CALL_BUDGET } from './llmClient.ts'
import type { LlmRequest } from './llmRequest.ts'
import { runCornerModule } from './cornerPipeline.ts'
import { sweetWordsModule, type SweetWordsInput } from './corners/sweetWords.ts'
import { CHAT_MESSAGES, MONTHLY_CONTEXT, scriptedLlmClient } from './testFixtures/cornerFixtures.ts'

const req = (text = '입력'): LlmRequest => ({ system: [], user: [{ text }] })
const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }) as unknown as Response
const noSleep = () => Promise.resolve()
/** 타이머를 쓰지 않는 주입(시험이 직접 부른다). */
function manualTimers() {
  const pending: { fn: () => void; ms: number; cleared: boolean }[] = []
  return {
    pending,
    setTimerImpl: (fn: () => void, ms: number) => {
      const h = { fn, ms, cleared: false }
      pending.push(h)
      return h
    },
    clearTimerImpl: (h: unknown) => {
      ;(h as { cleared: boolean }).cleared = true
    },
  }
}

describe('84-a llmClient - temperature · 호출 시간 상한 · 시도 직전 판정 · 사용량', () => {
  it('요청 본문에 temperature 0.5와 모델이 실린다', async () => {
    const bodies: Record<string, unknown>[] = []
    const fetchImpl = jest.fn(async (_u: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return ok({ content: [{ type: 'text', text: '{}' }] })
    })
    const t = manualTimers()
    const client = createLlmClient({ apiKey: 'k', model: 'claude-sonnet-5-5', fetchImpl, sleepImpl: noSleep, ...t })
    await client.call(req())
    expect(LLM_TEMPERATURE).toBe(0.5)
    expect(bodies[0]).toMatchObject({ model: 'claude-sonnet-5-5', temperature: 0.5 })
  })

  it('호출 1번 상한(120초)에 닿으면 중단 신호 -> 전송 실패로 보고 기존 재시도(대기 뒤 다시) -> 둘째 시도 성공', async () => {
    const t = manualTimers()
    let calls = 0
    const fetchImpl = jest.fn((_u: unknown, init?: RequestInit) => {
      calls += 1
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
      }
      return Promise.resolve(ok({ content: [{ type: 'text', text: 'second' }] }))
    })
    const sleeps: number[] = []
    const client = createLlmClient({ apiKey: 'k', model: 'claude-sonnet-5-5', fetchImpl, sleepImpl: async (ms) => { sleeps.push(ms) }, ...t })
    const pending = client.call(req())
    await Promise.resolve()
    expect(t.pending[0].ms).toBe(120_000)
    t.pending[0].fn() // 120초가 지났다고 친다
    const result = await pending
    expect(result).toEqual({ ok: true, text: 'second' })
    expect(calls).toBe(2)
    expect(sleeps).toEqual([500]) // 전송 실패 뒤 기존 백오프
    expect(t.pending.every((h) => h.cleared)).toBe(true)
  })

  it('시도 직전 판정이 준 시간이 더 짧으면 그 시간으로 끊는다', async () => {
    const t = manualTimers()
    const fetchImpl = jest.fn(async () => ok({ content: [{ type: 'text', text: 'x' }] }))
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noSleep, beforeAttempt: () => ({ ok: true, timeoutMs: 7 }), ...t })
    await client.call(req())
    expect(t.pending[0].ms).toBe(7)
  })

  it('시도 직전 판정이 막으면 fetch 0 · 예산 그대로 · stop 사유', async () => {
    const fetchImpl = jest.fn(async () => ok({ content: [{ type: 'text', text: 'x' }] }))
    let block = true
    const client = createLlmClient({
      apiKey: 'k',
      model: 'm',
      fetchImpl,
      sleepImpl: noSleep,
      beforeAttempt: () => (block ? { ok: false, stop: 'cost_limit' } : { ok: true }),
      ...manualTimers(),
    })
    const r = await client.call(req())
    expect(r).toEqual({ ok: false, reason: 'generation_failed', detail: '안전 정지: cost_limit', stop: 'cost_limit' })
    expect(fetchImpl).not.toHaveBeenCalled()
    // 예산을 쓰지 않았다 - 풀리면 3번까지 그대로 쓸 수 있다.
    block = false
    for (let i = 0; i < CORNER_LLM_CALL_BUDGET; i += 1) expect((await client.call(req())).ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET)
  })

  it('응답마다 사용량 · stop_reason · 지연(주입 시계)을 알린다 - 문장은 넘기지 않는다', async () => {
    let clock = 1000
    const fetchImpl = jest.fn(async () => {
      clock += 250
      return ok({
        content: [{ type: 'text', text: '문장' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 },
      })
    })
    const infos: unknown[] = []
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noSleep, nowImpl: () => clock, onResponse: (i) => infos.push(i), ...manualTimers() })
    await client.call(req())
    expect(infos).toEqual([{ status: 200, latencyMs: 250, usage: { input: 10, output: 20, cacheWrite: 30, cacheRead: 40 }, stopReason: 'end_turn' }])
  })
})

describe('84-a 값 검사 - 골격에서: 걸리면 schema_invalid -> 재요청 1 -> 그래도 걸리면 코너 실패', () => {
  const INPUT: SweetWordsInput = { warmthIndex: null, messages: CHAT_MESSAGES }
  const output = (context: string) =>
    JSON.stringify({ kind: 'excerpts', main: [{ context, turns: [{ messageId: 'm-1' }, { messageId: 'm-2' }] }], sub: [] })

  it('금지 표현 두 번 -> 호출 2회 · schema_invalid 실패', async () => {
    const client = scriptedLlmClient([output('관계를 진단하는 대화'), output('관계를 진단하는 대화')])
    const r = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    expect(r.outcome).toBe('failure')
    if (r.outcome !== 'failure') return
    expect(r.reason).toBe('schema_invalid')
    expect(r.llmCallAttempts).toBe(2)
    expect(r.detail).toContain('금지 표현 「진단」')
    expect(r.detail).not.toContain('관계를') // 문장 전문 0
  })

  it('길이 초과 뒤 재요청이 정상이면 통과', async () => {
    const client = scriptedLlmClient([output('가'.repeat(71)), output('아침 출근길에 오간 대화')])
    const r = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    expect(r.outcome).toBe('success')
    expect(client.requests).toHaveLength(2)
  })

  it('정상 문장은 한 번에 통과(유저 원문은 검사 대상 아님)', async () => {
    const client = scriptedLlmClient([output('아침 출근길에 오간 대화')])
    const r = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    expect(r.outcome).toBe('success')
    expect(client.requests).toHaveLength(1)
  })

  it('시간 · 비용 정지(stop)는 생성 실패가 아니라 안전 정지(halted)다', async () => {
    const client = { call: async () => ({ ok: false as const, reason: 'generation_failed' as const, detail: '안전 정지: cost_limit', stop: 'cost_limit' as const }) }
    const r = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    expect(r).toMatchObject({ outcome: 'halted', haltedFor: 'cost_limit', llmCallAttempts: 0, cornerName: '다정한 말들' })
  })
})
