/**
 * LLM 호출 — 코너 생성 파이프라인이 LLM을 부르는 **유일한** 경로
 * (docs/ONDOLOG_MASTER.md Part 17-0-3 규칙 C, 17-0-5-C).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 *
 * ── 경로 계약 ─────────────────────────────────────────────────────────
 * 이 파일의 경로(`supabase/functions/_shared/llmClient.ts`)는
 * `__tests__/engine/cornerPipelineStaticRules.test.ts`의 `LLM_CALL_MODULE`
 * 상수와 정확히 같아야 한다(그 상수가 경로 계약의 원본, Part 17-0-3-A
 * r21). 이 경로 밖에서 LLM SDK를 import하거나 이 파일에 있는 엔드포인트
 * 호스트 문자열을 그대로 쓰면 정적 규칙 C에 걸린다.
 *
 * ── 왜 fetch를 직접 쓰는가 (SDK 미사용) ───────────────────────────────
 * Deno 런타임에서 `@anthropic-ai/sdk` 같은 npm 패키지를 쓰려면
 * `npm:` 스펙파이어가 필요하고, `ambient.d.ts`가 그런 import를 `any`로
 * 취급하게 해 두긴 했지만(17-0-3-A r24) — SDK를 아예 안 쓰면 그 감가
 * (외부 모듈 타입 검사 상실)를 피할 수 있고, 규칙 C의 두 판정 기준
 * (SDK import·엔드포인트 호스트 문자열) 중 하나가 자동으로 사라져
 * 검증 표면이 준다. `fetch`는 Deno 전역이라 import가 필요 없다.
 *
 * ── 두 층의 재시도 (Part 17-0-5-C) ────────────────────────────────────
 * 이 모듈이 갖는 것: **코너 1건당 호출 예산(3회)** + **전송 오류
 * 지수 백오프**. Zod도 `FORBIDDEN_KEYS`도 모른다 — HTTP 수준 실패만
 * 안다. 검증 결과(`schema_invalid`·`forbidden_content`)에 따른 재호출
 * 결정은 파이프라인(`cornerPipeline.ts`)의 책임이다.
 *
 * ── 예산이 인자로 흘러가지 않는다 ─────────────────────────────────────
 * `createLlmClient()`가 반환하는 클라이언트 인스턴스 **안에** 예산
 * 카운터가 있다. 호출부는 코너 1건마다 `createLlmClient()`를 한 번
 * 호출해 그 인스턴스를 재사용해야 한다 — 새 인스턴스를 계속 만들면
 * 예산이 매번 리셋되어 상한이 무의미해진다(이건 이 모듈이 막을 수
 * 없는 오용이므로, 호출부 계약으로 문서화한다).
 */

/** 이 모듈 안에만 있는 엔드포인트 상수 (정적 규칙 C가 지키는 값). */
const LLM_ENDPOINT_HOST = 'api.anthropic.com'
const LLM_ENDPOINT_URL = `https://${LLM_ENDPOINT_HOST}/v1/messages`

/** 코너 1건당 총 LLM 호출(HTTP 시도) 상한. Part 17-0-5-A "최대 3회". */
export const CORNER_LLM_CALL_BUDGET = 3

export interface LlmCallSuccess {
  readonly ok: true
  readonly text: string
}

export interface LlmCallFailure {
  readonly ok: false
  readonly reason: 'generation_failed'
  readonly detail: string
}

export type LlmCallResult = LlmCallSuccess | LlmCallFailure

export interface LlmClient {
  /**
   * 프롬프트 1건을 LLM에 보낸다. 파이프라인이 `schema_invalid` 재시도를
   * 결정하면 같은 클라이언트 인스턴스에 다시 호출한다 — 예산은
   * 인스턴스가 기억한다.
   */
  call(prompt: string): Promise<LlmCallResult>
}

export interface LlmClientConfig {
  /** Edge Function 환경변수에서 읽어 전달한다(CLAUDE.md 절대 규칙 7 — 이 모듈은 환경변수를 직접 읽지 않는다). */
  apiKey: string
  /** 실제 API가 받는 모델 식별자. 하드코딩 금지(CLAUDE.md "config화 필수") — 호출부가 app_config 등에서 정해 넘긴다. */
  model: string
  maxTokens?: number
  /** 테스트 주입용. 기본값은 전역 `fetch`(Deno 전역, 이 파일은 import하지 않는다). */
  fetchImpl?: typeof fetch
  /** 테스트 주입용 지연 함수. 기본은 실제 `setTimeout` 기반 대기. */
  sleepImpl?: (ms: number) => Promise<void>
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 지수 백오프 지연(ms). 시도 1회차 실패 후 대기 없이 바로, 이후 배수로 증가. */
function backoffDelayMs(attemptIndexZeroBased: number): number {
  if (attemptIndexZeroBased <= 0) return 0
  return 500 * 2 ** (attemptIndexZeroBased - 1)
}

/**
 * 코너 1건에 묶이는 LLM 클라이언트를 만든다. 반환된 인스턴스가 호출
 * 횟수 예산(`CORNER_LLM_CALL_BUDGET`)을 스스로 들고 있다 — 파이프라인이
 * 몇 번을 다시 부르든, 예산을 소진하면 네트워크 요청 없이 즉시 거부한다.
 */
export function createLlmClient(config: LlmClientConfig): LlmClient {
  const fetchFn = config.fetchImpl ?? fetch
  const sleepFn = config.sleepImpl ?? defaultSleep
  const maxTokens = config.maxTokens ?? 4096

  let callsUsed = 0

  async function attemptOnce(prompt: string): Promise<{ ok: true; text: string } | { ok: false; detail: string }> {
    try {
      const response = await fetchFn(LLM_ENDPOINT_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        return { ok: false, detail: `HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}` }
      }

      const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> }
      const text = json.content?.find((block) => block.type === 'text')?.text
      if (typeof text !== 'string') {
        return { ok: false, detail: 'LLM 응답에 text 블록이 없음' }
      }
      return { ok: true, text }
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) }
    }
  }

  return {
    async call(prompt: string): Promise<LlmCallResult> {
      let lastDetail = '호출 예산 소진'

      while (callsUsed < CORNER_LLM_CALL_BUDGET) {
        const attemptIndexZeroBased = callsUsed
        callsUsed += 1

        if (attemptIndexZeroBased > 0) {
          await sleepFn(backoffDelayMs(attemptIndexZeroBased))
        }

        const result = await attemptOnce(prompt)
        if (result.ok) {
          return { ok: true, text: result.text }
        }
        lastDetail = result.detail
      }

      return { ok: false, reason: 'generation_failed', detail: lastDetail }
    },
  }
}
