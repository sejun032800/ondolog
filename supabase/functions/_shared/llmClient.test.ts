/// <reference types="jest" />
import { createLlmClient, CORNER_LLM_CALL_BUDGET, MAX_CACHE_BREAKPOINTS, InvalidLlmRequestError } from './llmClient.ts'
import type { LlmRequest } from './llmRequest.ts'

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

/** 합성 요청 - user 블록 하나. 캐시 표시 없음. */
function req(text: string): LlmRequest {
  return { system: [], user: [{ text }] }
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

    const result = await client.call(req('prompt'))

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
    await client.call(req('p'))
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

    const result = await client.call(req('p'))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.text).toBe('recovered')
    expect(attempt).toBe(2)
    expect(sleepImpl).toHaveBeenCalledTimes(1) // 재시도 1번 = 백오프 대기 1번
  })

  it('예산(3회) 전부 전송 실패하면 generation_failed를 반환한다', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({}, false, 503))
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep })

    const result = await client.call(req('p'))

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

    const result = await client.call(req('p'))

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
    const first = await client.call(req('p'))
    expect(first.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET)

    // 2차: 파이프라인이 "한 번 더" 부르는 상황을 흉내 — 예산이 이미 소진됐으므로
    // 새 네트워크 요청 없이 즉시 거부돼야 한다.
    const second = await client.call(req('p'))
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toBe('generation_failed')
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET) // 추가 호출 없음

    // 3차, 4차... 몇 번을 더 불러도 마찬가지다.
    await client.call(req('p'))
    await client.call(req('p'))
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

    const r1 = await client.call(req('p')) // 1/3
    const r2 = await client.call(req('p')) // 2/3 (schema_invalid 재시도 흉내)
    const r3 = await client.call(req('p')) // 3/3
    expect([r1, r2, r3].every((r) => r.ok)).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(3)

    // 예산 소진 — 4번째는 네트워크 요청 없이 거부.
    const r4 = await client.call(req('p'))
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
      const result = await makeClient().call(req('p'))
      expect(result).toEqual({ ok: true, text: 'stable' })
    }
  })
})

describe('llmClient — 요청 모양과 프롬프트 캐싱 (#14 3단계, Part 17-0-5-F)', () => {
  interface WireBlock {
    type: string
    text: string
    cache_control?: { type: string }
  }
  interface WireBody {
    system?: WireBlock[]
    messages: Array<{ role: string; content: WireBlock[] }>
  }

  /** 보낸 본문을 캡처하는 fetch. */
  function capturingClient() {
    const bodies: WireBody[] = []
    const fetchImpl = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(JSON.parse(String(init?.body)) as WireBody)
      return jsonResponse({ content: [{ type: 'text', text: '{}' }] })
    })
    return { bodies, fetchImpl, client: createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep }) }
  }

  it('cacheBreakpoint가 표시된 블록에만 cache_control이 실린다 - system과 user 모두', async () => {
    const { bodies, client } = capturingClient()
    await client.call({
      system: [{ text: '공통 원칙', cacheBreakpoint: true }, { text: '코너 지시' }, { text: '출력 형식', cacheBreakpoint: true }],
      user: [{ text: '기간 안내' }, { text: '입력 레코드', cacheBreakpoint: true }],
    })

    expect(bodies).toHaveLength(1)
    const [body] = bodies
    expect(body.system?.map((b) => b.cache_control)).toEqual([{ type: 'ephemeral' }, undefined, { type: 'ephemeral' }])
    expect(body.system?.map((b) => b.text)).toEqual(['공통 원칙', '코너 지시', '출력 형식'])
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[0].content.map((b) => b.cache_control)).toEqual([undefined, { type: 'ephemeral' }])
    expect(body.messages[0].content.map((b) => b.text)).toEqual(['기간 안내', '입력 레코드'])
  })

  it('표시가 없으면 cache_control이 본문 어디에도 없다', async () => {
    const { bodies, client } = capturingClient()
    await client.call({ system: [{ text: 's' }], user: [{ text: 'u' }] })
    expect(JSON.stringify(bodies[0])).not.toContain('cache_control')
  })

  it('system이 비어 있으면 system 키를 보내지 않는다', async () => {
    const { bodies, client } = capturingClient()
    await client.call({ system: [], user: [{ text: 'u' }] })
    expect('system' in bodies[0]).toBe(false)
  })

  it('블록 순서가 그대로 본문에 실린다(캐시 접두는 순서에 달려 있다)', async () => {
    const { bodies, client } = capturingClient()
    await client.call({ system: [{ text: 'a' }, { text: 'b', cacheBreakpoint: true }], user: [{ text: 'c' }, { text: 'd' }] })
    expect(bodies[0].system?.map((b) => b.text)).toEqual(['a', 'b'])
    expect(bodies[0].messages[0].content.map((b) => b.text)).toEqual(['c', 'd'])
  })

  it(`표시가 ${MAX_CACHE_BREAKPOINTS}개를 넘으면 요청 오류다 - 네트워크 요청도 예산 소모도 없다`, async () => {
    const { fetchImpl, client } = capturingClient()
    const tooMany = {
      system: Array.from({ length: MAX_CACHE_BREAKPOINTS }, (_, i) => ({ text: `s${i}`, cacheBreakpoint: true as const })),
      user: [{ text: 'u', cacheBreakpoint: true as const }],
    }
    await expect(client.call(tooMany)).rejects.toBeInstanceOf(InvalidLlmRequestError)
    expect(fetchImpl).not.toHaveBeenCalled()

    // 예산이 그대로다 - 올바른 요청이 예산 3회를 다 쓸 수 있다.
    for (let i = 0; i < CORNER_LLM_CALL_BUDGET; i++) {
      const r = await client.call({ system: [], user: [{ text: 'ok' }] })
      expect(r.ok).toBe(true)
    }
  })

  it(`표시 ${MAX_CACHE_BREAKPOINTS}개는 허용한다`, async () => {
    const { bodies, client } = capturingClient()
    await client.call({
      system: [{ text: 'a', cacheBreakpoint: true }, { text: 'b', cacheBreakpoint: true }, { text: 'c', cacheBreakpoint: true }],
      user: [{ text: 'd', cacheBreakpoint: true }],
    })
    expect(bodies).toHaveLength(1)
  })

  it('user 블록이 없거나 텍스트가 빈 블록이 있으면 요청 오류다', async () => {
    const { fetchImpl, client } = capturingClient()
    await expect(client.call({ system: [{ text: 's' }], user: [] })).rejects.toBeInstanceOf(InvalidLlmRequestError)
    await expect(client.call({ system: [{ text: '  ' }], user: [{ text: 'u' }] })).rejects.toBeInstanceOf(InvalidLlmRequestError)
    await expect(client.call({ system: [], user: [{ text: '' }] })).rejects.toBeInstanceOf(InvalidLlmRequestError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('전송 재시도(예산 안)에서도 같은 본문을 보낸다 - 캐시 표시가 유지된다', async () => {
    const bodies: WireBody[] = []
    let attempt = 0
    const fetchImpl = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(JSON.parse(String(init?.body)) as WireBody)
      attempt += 1
      return attempt < 2 ? jsonResponse({}, false, 500) : jsonResponse({ content: [{ type: 'text', text: 'ok' }] })
    })
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl: noopSleep })
    await client.call({ system: [{ text: 's', cacheBreakpoint: true }], user: [{ text: 'u' }] })
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toEqual(bodies[0])
    expect(bodies[1].system?.[0].cache_control).toEqual({ type: 'ephemeral' })
  })
})

describe('llmClient - 대기는 직전 호출이 전송 실패였을 때만 (MASTER 17-0-8, r46)', () => {
  const okBody = (text: string) => jsonResponse({ content: [{ type: 'text', text }] })

  it('직전 호출이 HTTP로 성공했으면 다시 불러도 기다리지 않는다 (파이프라인의 schema_invalid 재호출)', async () => {
    const fetchImpl = jest.fn(async () => okBody('{}'))
    const sleepImpl = jest.fn(async (_ms: number) => undefined)
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl })

    await client.call(req('p'))
    await client.call(req('p')) // 두 번째 호출 - 예전에는 여기서 500ms를 기다렸다
    await client.call(req('p'))

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleepImpl).not.toHaveBeenCalled()
  })

  it('직전 호출이 전송 실패(HTTP 오류)였을 때만 기다린다 - 500ms, 다음은 1000ms (지수)', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(okBody('recovered'))
    const sleepImpl = jest.fn(async (_ms: number) => undefined)
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl })

    const result = await client.call(req('p'))

    expect(result).toEqual({ ok: true, text: 'recovered' })
    expect(sleepImpl.mock.calls.map((c) => c[0])).toEqual([500, 1000])
  })

  it('fetch가 던진 경우(네트워크 예외)도 전송 실패다 - 다음 시도 전에 기다린다', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, []>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(okBody('ok'))
    const sleepImpl = jest.fn(async (_ms: number) => undefined)
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl })

    expect((await client.call(req('p'))).ok).toBe(true)
    expect(sleepImpl.mock.calls.map((c) => c[0])).toEqual([500])
  })

  it('전송 실패 뒤 성공하면 지수는 처음으로 돌아가고, 그 뒤의 재호출은 기다리지 않는다', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValueOnce(jsonResponse({}, false, 502))
      .mockResolvedValueOnce(okBody('first'))
      .mockResolvedValueOnce(okBody('second'))
    const sleepImpl = jest.fn(async (_ms: number) => undefined)
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl })

    await client.call(req('p')) // 실패 -> 대기 500 -> 성공
    expect(sleepImpl).toHaveBeenCalledTimes(1)
    await client.call(req('p')) // 직전 호출이 성공이었다 - 기다리지 않는다
    expect(sleepImpl).toHaveBeenCalledTimes(1)
  })

  it('HTTP는 성공했으나 응답에 텍스트 블록이 없으면 빈 텍스트로 돌려준다 - 예산 1회, 대기 없음, 안에서 돌지 않는다 (r47)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ content: [] }))
    const sleepImpl = jest.fn(async (_ms: number) => undefined)
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl })

    const result = await client.call(req('p'))

    expect(result).toEqual({ ok: true, text: '' }) // generation_failed가 아니다 - 파이프라인이 schema_invalid로 판정한다
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(sleepImpl).not.toHaveBeenCalled()
  })

  it('텍스트 없는 응답도 호출 예산을 쓴다 - 예산이 소진되면 네트워크 요청 없이 거부한다', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ content: [] }))
    const sleepImpl = jest.fn(async (_ms: number) => undefined)
    const client = createLlmClient({ apiKey: 'k', model: 'm', fetchImpl, sleepImpl })

    for (let i = 0; i < CORNER_LLM_CALL_BUDGET; i += 1) {
      expect(await client.call(req('p'))).toEqual({ ok: true, text: '' })
    }
    const exhausted = await client.call(req('p'))

    expect(exhausted.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(CORNER_LLM_CALL_BUDGET)
    expect(sleepImpl).not.toHaveBeenCalled()
  })

  it('llmClient는 Zod를 모른다 - 대기 여부는 자기 호출의 결과만으로 정해진다 (응답 내용이 무엇이든 같다)', async () => {
    const sleepImpl = jest.fn(async (_ms: number) => undefined)
    const client = createLlmClient({
      apiKey: 'k',
      model: 'm',
      fetchImpl: async () => okBody('이건 JSON이 아니다'),
      sleepImpl,
    })
    await client.call(req('p'))
    await client.call(req('p'))
    expect(sleepImpl).not.toHaveBeenCalled()
  })
})
