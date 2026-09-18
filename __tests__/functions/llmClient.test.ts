import { createLlmClient, CORNER_LLM_CALL_BUDGET } from '../../supabase/functions/_shared/llmClient'

/**
 * `llmClient.ts` — 코너 1건당 호출 예산(3회) + 전송 오류 지수 백오프
 * (Part 17-0-5-C). 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 4부.
 *
 * 실제 네트워크를 타지 않는다 — `fetchImpl`/`sleepImpl`을 주입해 결정론을
 * 지킨다(백오프 지연을 실제로 기다리면 테스트가 느려지고, 시간 의존이
 * 생긴다).
 */

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response
}

function noopSleep(): Promise<void> {
  return Promise.resolve()
}

describe('llmClient — 성공 경로', () => {
  it('첫 호출이 바로 성공하면 fetch를 1번만 쓰고 텍스트를 반환한다', async () => {
    let calls = 0
    const fetchImpl = jest.fn(async () => {
      calls += 1
      return jsonResponse({ content: [{ type: 'text', text: '{"title":"ok"}' }] })
    })
    const client = createLlmClient({ apiKey: 'k', model: 'test-model', fetchImpl, sleepImpl: noopSleep })

    const result = await client.call('prompt')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.text).toBe('{"title":"ok"}')
    expect(calls).toBe(1)
  })

  it('엔드포인트 상수는 이 모듈 안에서만 쓴다 — 실제 요청 URL이 api.anthropic.com이다', async () => {
    const fetchImpl = jest.fn(async (url: unknown) => {
      expect(String(url)).toContain('api.anthropic.com')
      return jsonResponse({ content: [{ type: 'text', text: '{}' }] })
    })
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep })
    await client.call('p')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('llmClient — 전송 오류 지수 백오프 (예산 안에서)', () => {
  it('HTTP 오류가 나면 예산 안에서 재시도하고, 재시도 후 성공하면 그 결과를 반환한다', async () => {
    let attempt = 0
    const fetchImpl = jest.fn(async () => {
      attempt += 1
      if (attempt < 2) return jsonResponse({}, false, 500)
      return jsonResponse({ content: [{ type: 'text', text: 'recovered' }] })
    })
    const sleepImpl = jest.fn(noopSleep)
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl })

    const result = await client.call('p')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.text).toBe('recovered')
    expect(attempt).toBe(2)
    expect(sleepImpl).toHaveBeenCalledTimes(1) // 재시도 1번 = 백오프 대기 1번
  })

  it('예산(3회) 전부 전송 실패하면 generation_failed를 반환한다', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({}, false, 503))
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep })

    const result = await client.call('p')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('generation_failed')
      expect(result.detail).toContain('503')
    }
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET)
  })

  it('fetch 자체가 throw해도(네트워크 예외) 예산 안에서 재시도 후 generation_failed로 수렴한다', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('network down')
    })
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep })

    const result = await client.call('p')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toContain('network down')
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET)
  })
})

describe('llmClient — 호출 예산 상한 (Part 17-0-5-A "재시도 총량 상한", 완료 기준 필수 테스트)', () => {
  it('파이프라인이 예산을 넘겨 다시 호출해도 llmClient가 거부한다(추가 네트워크 요청 없음)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({}, false, 500))
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep })

    // 1차: 예산(3회)을 전부 소모하며 실패
    const first = await client.call('p')
    expect(first.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET)

    // 2차: 파이프라인이 "한 번 더" 부르는 상황을 흉내 — 예산이 이미 소진됐으므로
    // 새 네트워크 요청 없이 즉시 거부돼야 한다.
    const second = await client.call('p')
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toBe('generation_failed')
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET) // 추가 호출 없음

    // 3차, 4차... 몇 번을 더 불러도 마찬가지다.
    await client.call('p')
    await client.call('p')
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET)
  })

  it('첫 호출이 1번의 전송 성공으로 끝나면, 남은 예산(2)은 이후 call() 호출에 쓰인다', async () => {
    let attempt = 0
    const fetchImpl = jest.fn(async () => {
      attempt += 1
      // 매 attempt마다 성공 응답 — 예산을 다 쓰지 않고 각 call()이 1회씩만 소모.
      return jsonResponse({ content: [{ type: 'text', text: `t${attempt}` }] })
    })
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep })

    const r1 = await client.call('p') // 1/3
    const r2 = await client.call('p') // 2/3 (schema_invalid 재시도 흉내)
    const r3 = await client.call('p') // 3/3
    expect([r1, r2, r3].every((r) => r.ok)).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(3)

    // 예산 소진 — 4번째는 네트워크 요청 없이 거부.
    const r4 = await client.call('p')
    expect(r4.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

describe('결정론 — 동일 입력 100회 반복(각각 새 클라이언트) → 100회 동일 결과', () => {
  it('같은 성공 응답 fetch로 100개의 독립 클라이언트를 돌리면 매번 같은 형태의 성공 결과가 나온다', async () => {
    const makeClient = () =>
      createLlmClient({
        apiKey: 'k',
        model: 'm',
        fetchImpl: async () => jsonResponse({ content: [{ type: 'text', text: 'stable' }] }),
        sleepImpl: noopSleep,
      })

    for (let i = 0; i < 100; i++) {
      const result = await makeClient().call('p')
      expect(result).toEqual({ ok: true, text: 'stable' })
    }
  })
})
