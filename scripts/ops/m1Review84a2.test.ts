/// <reference types="jest" />
/**
 * 84-a2 review.md · summary.md 만들기 (ROADMAP r131 R131-2 ② ③) - 말투 칸 "합니다체 밖" · 호출 수 = 실제로 보낸 수.
 * 위임: .claude/state/prompts/phase-7/84-a2-dispatch-llm-request-fix.md
 * 순수 함수만 부른다 - 파일 · 네트워크 · LLM 호출 0.
 */
import { renderReview, sentCalls, type HttpCall, type RunRecord } from './m1Review.ts'

const fail400: HttpCall = { status: 400, latencyMs: 10, stopReason: null, usage: null, contentBlocks: null, errorBody: 'invalid_request_error: bad' }

/** 84-b 1차와 같은 모양: 골격 `call()` 1번 안에서 HTTP 3번(84-a2 전 기록). */
function record(over: Partial<RunRecord> = {}): RunRecord {
  return {
    model: 'claude-sonnet-5-5',
    corner: 'sweet_words',
    run: 1,
    tag: '84b',
    startedAt: '2026-11-19T00:00:00.000Z',
    maxTokens: 16000,
    totalLatencyMs: 30,
    httpCalls: [fail400, fail400, fail400],
    attempts: [],
    outcome: 'failure',
    failureReason: 'generation_failed',
    failureDetail: 'HTTP 400: invalid_request_error: bad',
    llmCallAttempts: 1,
    truncated: false,
    content: null,
    usageTotal: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    haltedFor: null,
    r19_2Violations: 0,
    costUsd: 0,
    ...over,
  }
}

describe('84-a2 ③ review.md 말투 칸', () => {
  it('회차 칸 · 모델별 집계 기준 문단 모두 "합니다체 밖" · "해요체" 0', () => {
    const { review, summary } = renderReview([record(), record({ model: 'claude-opus-5-5' })])
    expect(review).toContain('| 말투 위반(합니다체 밖) |  |')
    expect(review.split('| 말투 위반(합니다체 밖) |').length - 1).toBe(2) // 회차마다 한 줄
    expect(review).toContain('금지 표현 · 합니다체 밖 말투')
    expect(review).toContain('## 모델별 집계 (R124-6)')
    expect(review).not.toContain('해요체')
    expect(summary).not.toContain('해요체')
  })
})

describe('84-a2 ② 호출 수 = 실제로 보낸 HTTP 수', () => {
  it('골격 call() 1번 · HTTP 3번인 옛 기록도 review · summary는 3', () => {
    const rec = record()
    expect(sentCalls(rec)).toBe(3)
    const { review, summary } = renderReview([rec])
    expect(review).toContain('LLM 호출(보낸 수) 3회')
    expect(review).not.toContain('LLM 호출(보낸 수) 1회')
    const row = summary.split('\n').find((l) => l.startsWith('| claude-sonnet-5-5 | sweet_words | 1 |'))
    expect(row?.split('|').map((c) => c.trim())[5]).toBe('3')
    expect(summary).toContain('| 모델 | 코너 | 회차 | 결과 | 호출(보낸 수) |')
  })

  it('안전 정지(보낸 0)는 0', () => {
    const { review } = renderReview([record({ httpCalls: [], outcome: 'halted', haltedFor: 'cost_limit', failureReason: null, llmCallAttempts: 0 })])
    expect(review).toContain('LLM 호출(보낸 수) 0회')
  })

  it('잘림 표시 줄은 그대로 - max_tokens 값과 함께', () => {
    const { review } = renderReview([record({ truncated: true, httpCalls: [{ ...fail400, status: 200, stopReason: 'max_tokens', errorBody: null }] })])
    expect(review).toContain('출력 잘림: `stop_reason=max_tokens` (max_tokens 16000)')
  })
})
