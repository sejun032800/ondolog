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
 * ── 대기는 직전 호출이 전송 실패였을 때만 (17-0-8, r46) ───────────────
 * 이 모듈이 아는 것은 재호출의 이유가 아니라 **자기가 한 직전 호출이 전송 수준에서 실패했는가**다. 그건 자기
 * 호출의 결과라 Zod를 몰라도 안다(층은 그대로 분리된다). 직전 호출이 HTTP로 성공했으면 파이프라인이
 * `schema_invalid`로 다시 부르더라도 기다리지 않는다. 전송 수준 실패는 둘이다 - `fetch`가 던졌거나(네트워크
 * 예외, 본문을 읽다 끊긴 경우 포함), HTTP 상태가 성공(2xx)이 아니다. HTTP 2xx인데 응답에 텍스트 블록이 없는
 * 경우는 전송이 성공한 것이므로 전송 실패가 아니다(예산은 쓰고, 기다리지 않고, 빈 텍스트로 돌려줘 파이프라인이
 * `schema_invalid`로 기록한다 - r47). 연속된 전송 실패 횟수가
 * 지수 백오프의 지수가 되고, 전송이 한 번 성공하면 0으로 돌아간다.
 *
 * ── 예산이 인자로 흘러가지 않는다 ─────────────────────────────────────
 * `createLlmClient()`가 반환하는 클라이언트 인스턴스 **안에** 예산
 * 카운터가 있다. 호출부는 코너 1건마다 `createLlmClient()`를 한 번
 * 호출해 그 인스턴스를 재사용해야 한다 — 새 인스턴스를 계속 만들면
 * 예산이 매번 리셋되어 상한이 무의미해진다(이건 이 모듈이 막을 수
 * 없는 오용이므로, 호출부 계약으로 문서화한다).
 *
 * ── 요청 모양과 프롬프트 캐싱 (Part 17-0-5-F, #14 3단계) ───────────────
 * `call()`은 벤더 중립 `LlmRequest`(`llmRequest.ts`)를 받는다. 코너가 블록에
 * 표시한 `cacheBreakpoint`를 전송 형식의 `cache_control`로 옮기는 것은
 * **이 파일 한 곳뿐**이다 - 코너와 파이프라인은 그 이름을 모른다. 표시는
 * 그 블록 끝까지를 캐시하라는 뜻이고, 가변 입력은 표시 뒤에 있어야 한다
 * (그 배치는 코너가 지킨다). 표시 개수 상한은 `MAX_CACHE_BREAKPOINTS`다.
 * 캐시 최소 길이·유효 시간 같은 수치는 여기서 정하지 않는다(API 기본 동작에 맡긴다).
 */

import type { LlmRequest, PromptBlock } from './llmRequest.ts'

/** 이 모듈 안에만 있는 엔드포인트 상수 (정적 규칙 C가 지키는 값). */
const LLM_ENDPOINT_HOST = 'api.anthropic.com'
const LLM_ENDPOINT_URL = `https://${LLM_ENDPOINT_HOST}/v1/messages`

/** 코너 1건당 총 LLM 호출(HTTP 시도) 상한. Part 17-0-5-A "최대 3회". */
export const CORNER_LLM_CALL_BUDGET = 3

/** 요청 하나에 실을 수 있는 캐시 표시 개수 상한(전송 쪽이 허용하는 수). 넘으면 요청을 만들지 않는다. */
export const MAX_CACHE_BREAKPOINTS = 4

/**
 * 요청 자체가 잘못됐다(프로그래밍 오류) - 빈 블록, 사용자 블록 없음, 캐시 표시 초과. 전송 실패가
 * 아니므로 `generation_failed`로 기록하지 않고 던진다. 네트워크 요청과 예산 소모는 일어나지 않는다.
 */
export class InvalidLlmRequestError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'InvalidLlmRequestError'
  }
}

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
   * 요청 1건을 LLM에 보낸다. 파이프라인이 `schema_invalid` 재시도를
   * 결정하면 같은 클라이언트 인스턴스에 다시 호출한다 — 예산은
   * 인스턴스가 기억한다. 요청이 잘못됐으면 `InvalidLlmRequestError`로 거부된다.
   */
  call(request: LlmRequest): Promise<LlmCallResult>
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

/** 전송 형식의 텍스트 블록. 캐시 표시는 `cache_control`로 옮겨진다 - 이 이름을 아는 곳은 이 파일뿐이다. */
interface WireTextBlock {
  readonly type: 'text'
  readonly text: string
  readonly cache_control?: { readonly type: 'ephemeral' }
}

function toWireBlocks(blocks: readonly PromptBlock[]): WireTextBlock[] {
  return blocks.map((block) =>
    block.cacheBreakpoint === true
      ? { type: 'text', text: block.text, cache_control: { type: 'ephemeral' } }
      : { type: 'text', text: block.text },
  )
}

function assertValidRequest(request: LlmRequest): void {
  if (request.user.length === 0) {
    throw new InvalidLlmRequestError('LLM 요청에 user 블록이 없다')
  }
  for (const block of [...request.system, ...request.user]) {
    if (block.text.trim().length === 0) {
      throw new InvalidLlmRequestError('LLM 요청에 빈 텍스트 블록이 있다')
    }
  }
  const breakpoints = [...request.system, ...request.user].filter((b) => b.cacheBreakpoint === true).length
  if (breakpoints > MAX_CACHE_BREAKPOINTS) {
    throw new InvalidLlmRequestError(`캐시 표시가 ${breakpoints}개다 - 상한은 ${MAX_CACHE_BREAKPOINTS}개`)
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 지수 백오프 지연(ms) - 연속된 전송 실패가 1번이면 500, 2번이면 1000. 전송 실패가 없었으면 0(기다리지 않는다). */
function backoffDelayMs(consecutiveTransportFailures: number): number {
  if (consecutiveTransportFailures <= 0) return 0
  return 500 * 2 ** (consecutiveTransportFailures - 1)
}

/** 시도 하나의 결과. `transport`: 실패가 전송 수준(예외·비성공 HTTP 상태)인가 - 대기 여부를 정한다. */
type AttemptResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly detail: string; readonly transport: boolean }

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
  /** 자기 직전 호출 이후 연속된 전송 수준 실패 횟수. 직전 호출이 전송 실패가 아니면 0이다. */
  let consecutiveTransportFailures = 0

  async function attemptOnce(request: LlmRequest): Promise<AttemptResult> {
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
          ...(request.system.length > 0 ? { system: toWireBlocks(request.system) } : {}),
          messages: [{ role: 'user', content: toWireBlocks(request.user) }],
        }),
      })

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        return { ok: false, detail: `HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}`, transport: true }
      }

      const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> }
      const text = json.content?.find((block) => block.type === 'text')?.text
      // HTTP 2xx인데 텍스트 블록이 없으면 빈 문자열로 돌려준다 - 파싱할 것이 없는 응답이고, 파이프라인의
      // 1단계(`JSON.parse`)가 실패해 `schema_invalid`가 된다(17-0-8, r47). 전송은 성공했으므로 대기는 없고,
      // 이 호출은 예산 한 번을 쓴다. 재호출 여부는 파이프라인의 정책표가 정한다(여기서 안으로 돌지 않는다).
      return { ok: true, text: typeof text === 'string' ? text : '' }
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err), transport: true }
    }
  }

  return {
    async call(request: LlmRequest): Promise<LlmCallResult> {
      // 요청이 잘못됐으면 예산을 쓰지 않고 거부한다(전송 실패가 아니다).
      assertValidRequest(request)
      let lastDetail = '호출 예산 소진'

      while (callsUsed < CORNER_LLM_CALL_BUDGET) {
        callsUsed += 1

        // 직전 호출이 전송 실패였을 때만 기다린다. HTTP로 성공한 뒤의 재호출(파이프라인의
        // `schema_invalid` 재시도)은 기다리지 않는다.
        if (consecutiveTransportFailures > 0) {
          await sleepFn(backoffDelayMs(consecutiveTransportFailures))
        }

        const result = await attemptOnce(request)
        consecutiveTransportFailures = !result.ok && result.transport ? consecutiveTransportFailures + 1 : 0
        if (result.ok) {
          return { ok: true, text: result.text }
        }
        lastDetail = result.detail
      }

      return { ok: false, reason: 'generation_failed', detail: lastDetail }
    },
  }
}
