/**
 * 매거진 AI 안전장치 상수와 순수 계산 (ROADMAP r124 R124-2 · R124-3, R21-1, MASTER §17-0-10-H).
 * 위임: .claude/state/prompts/phase-7/84-a-dispatch-llm-safety.md
 *
 * 시계·난수·환경변수를 읽지 않는다(엔진 결정론 규칙). 시간은 호출부가 숫자(ms)로 넘긴다.
 *
 * - 모델 fail-closed: `app_config.llm_provider` 값이 **허용 목록** 안의 모델일 때만 생성한다. 그 밖(값 없음 · `tbd` ·
 *   모르는 모델 · 형식 오류)은 거부 + 숫자 코드.
 * - temperature 0.5 명시(R124-2, 84-b 결과로 조정).
 * - 시간 상한: 호출 1번 120초 · 코너 합계 8분 · 1호 합계 20분(R124-3).
 * - 비용 상한: 응답의 실제 사용량으로 누적하고, **다음 호출 전에** "지금까지 + 이번 호출 최악"이 상한을 넘으면 부르지 않는다.
 *   하네스 1회 $10 · 1호 생성 $2(R124-3). 84- 전체 $30은 PE가 하네스 출력으로 집계한다(코드 0).
 */

/** 허용 모델(R124-2). 첫째가 코너 기본, 둘째는 84-b 비교용. */
export const ALLOWED_LLM_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5'] as const
export type AllowedLlmModel = (typeof ALLOWED_LLM_MODELS)[number]
export const DEFAULT_LLM_MODEL: AllowedLlmModel = 'claude-sonnet-5-5'

/** `app_config.llm_provider.provider`로 받는 값. 엔드포인트는 `llmClient.ts`의 것 하나뿐이다. */
export const ALLOWED_LLM_PROVIDER = 'anthropic'

/** 요청에 실어 보내는 temperature(R124-2). */
export const LLM_TEMPERATURE = 0.5

/** 시간 상한(ms, R124-3). */
export const LLM_CALL_TIMEOUT_MS = 120_000
export const CORNER_TIME_LIMIT_MS = 8 * 60_000
export const ISSUE_TIME_LIMIT_MS = 20 * 60_000

/** 비용 상한(USD, R124-3). */
export const HARNESS_BUDGET_USD = 10
export const ISSUE_BUDGET_USD = 2

/** 출력 토큰 최악값 - `llmClient`의 `max_tokens` 기본값과 같다(MASTER §17-0-10-H "maxTokens 4096"). */
export const WORST_OUTPUT_TOKENS = 4096

/**
 * 모델 거부 사유 숫자 코드. 보고·기록에는 이 숫자만 쓴다.
 * 1 값 없음 · 2 `tbd` · 3 모르는 모델 · 4 형식 오류 · 5 모르는 공급자
 */
export const MODEL_REJECT_CODE = {
  missing: 1,
  tbd: 2,
  unknownModel: 3,
  malformed: 4,
  unknownProvider: 5,
} as const
export type ModelRejectCode = (typeof MODEL_REJECT_CODE)[keyof typeof MODEL_REJECT_CODE]

export type ModelResolution =
  | { readonly ok: true; readonly model: AllowedLlmModel }
  | { readonly ok: false; readonly code: ModelRejectCode }

export function isAllowedModel(value: unknown): value is AllowedLlmModel {
  return typeof value === 'string' && (ALLOWED_LLM_MODELS as readonly string[]).includes(value)
}

/**
 * `app_config.llm_provider` 값(jsonb) -> 허용 모델 또는 거부 코드. 생성 경로는 `ok`일 때만 LLM을 부른다(R21-1 완료 기준).
 * 모양: `{"provider":"anthropic","model":"<허용 목록 안>"}`.
 */
export function resolveLlmModel(value: unknown): ModelResolution {
  if (value === null || value === undefined) return { ok: false, code: MODEL_REJECT_CODE.missing }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, code: MODEL_REJECT_CODE.malformed }
  const v = value as { provider?: unknown; model?: unknown }
  if (typeof v.provider !== 'string' || typeof v.model !== 'string') return { ok: false, code: MODEL_REJECT_CODE.malformed }
  if (v.provider === 'tbd' || v.model === 'tbd') return { ok: false, code: MODEL_REJECT_CODE.tbd }
  if (v.provider !== ALLOWED_LLM_PROVIDER) return { ok: false, code: MODEL_REJECT_CODE.unknownProvider }
  if (!isAllowedModel(v.model)) return { ok: false, code: MODEL_REJECT_CODE.unknownModel }
  return { ok: true, model: v.model }
}

/** 하네스 `--model` 인자 검사 - 허용 목록 밖이면 거부 코드(값 없음 = 1, 그 밖 = 3). */
export function resolveHarnessModel(arg: string | undefined): ModelResolution {
  if (arg === undefined || arg.length === 0) return { ok: false, code: MODEL_REJECT_CODE.missing }
  if (arg === 'tbd') return { ok: false, code: MODEL_REJECT_CODE.tbd }
  return isAllowedModel(arg) ? { ok: true, model: arg } : { ok: false, code: MODEL_REJECT_CODE.unknownModel }
}

// ---------------------------------------------------------------------------
// 비용
// ---------------------------------------------------------------------------

/**
 * 공급자 공식 가격(USD / 1M 토큰). 출처: https://platform.claude.com/docs/en/about-claude/pricing
 * (값은 위임서 84-a §3 · R124-3에 적힌 것 그대로 - 확인일 2026-11-18). 캐시 쓰기는 5분 캐시 값이다.
 */
export const LLM_PRICES_USD_PER_MTOK: Readonly<Record<AllowedLlmModel, { readonly input: number; readonly output: number; readonly cacheWrite: number; readonly cacheRead: number }>> = {
  'claude-sonnet-5-5': { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.1 },
  'claude-opus-5-5': { input: 4.0, output: 20.0, cacheWrite: 5.0, cacheRead: 0.2 },
}

/** 응답 한 번의 사용량(공급자 `usage`의 네 값). */
export interface LlmUsage {
  readonly input: number
  readonly output: number
  readonly cacheWrite: number
  readonly cacheRead: number
}

export const ZERO_USAGE: LlmUsage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return { input: a.input + b.input, output: a.output + b.output, cacheWrite: a.cacheWrite + b.cacheWrite, cacheRead: a.cacheRead + b.cacheRead }
}

/** 사용량 -> USD(동기 가격). */
export function usageCostUsd(model: AllowedLlmModel, usage: LlmUsage): number {
  const p = LLM_PRICES_USD_PER_MTOK[model]
  return (usage.input * p.input + usage.output * p.output + usage.cacheWrite * p.cacheWrite + usage.cacheRead * p.cacheRead) / 1_000_000
}

/**
 * 이번 호출의 최악 비용 - 입력 추정 상한 전부를 캐시 없이 **캐시 쓰기 값**(입력보다 비싸다)으로 치고, 출력은 `maxOutputTokens` 전부.
 * 캐시 쓰기가 일어나면 입력 토큰이 그쪽으로 옮겨 가므로 이 값이 위쪽 한계다.
 */
export function worstCallCostUsd(model: AllowedLlmModel, estimatedInputTokensHigh: number, maxOutputTokens: number = WORST_OUTPUT_TOKENS): number {
  const p = LLM_PRICES_USD_PER_MTOK[model]
  return (estimatedInputTokensHigh * Math.max(p.input, p.cacheWrite) + maxOutputTokens * p.output) / 1_000_000
}

/** 소수 넷째 자리 표기(하네스 요약). */
export function formatUsd(value: number): string {
  return value.toFixed(4)
}

/**
 * 누적 비용 계량기 - 실제 사용량을 더하고, 다음 호출 전에 상한을 본다. 순수 상태 객체(시계 0).
 * `canAfford(worst)`: 지금까지 + 이번 최악이 상한 **이하**면 참(상한과 같으면 허용).
 */
export class CostMeter {
  private spent = 0
  private total: LlmUsage = ZERO_USAGE

  constructor(
    readonly model: AllowedLlmModel,
    readonly budgetUsd: number,
  ) {}

  record(usage: LlmUsage): void {
    this.total = addUsage(this.total, usage)
    this.spent += usageCostUsd(this.model, usage)
  }

  spentUsd(): number {
    return this.spent
  }

  usage(): LlmUsage {
    return this.total
  }

  canAfford(worstNextUsd: number): boolean {
    return this.spent + worstNextUsd <= this.budgetUsd
  }
}

// ---------------------------------------------------------------------------
// 시간
// ---------------------------------------------------------------------------

/** 정지 사유 코드(기록용). */
export const SAFETY_STOP = {
  cornerTime: 'corner_time_limit',
  issueTime: 'issue_time_limit',
  cost: 'cost_limit',
} as const
export type SafetyStop = (typeof SAFETY_STOP)[keyof typeof SAFETY_STOP]

/**
 * 시간 예산 - 시작 시각과 상한으로 남은 시간을 계산한다. 시각은 호출부가 넘긴다(주입된 시계).
 * 남은 시간이 0 이하면 새 호출을 시작하지 않는다.
 */
export interface Deadline {
  readonly startedAtMs: number
  readonly limitMs: number
  readonly stop: SafetyStop
}

export function remainingMs(deadline: Deadline, nowMs: number): number {
  return deadline.startedAtMs + deadline.limitMs - nowMs
}

/**
 * 이번 호출에 줄 시간 = min(호출 상한, 각 마감의 남은 시간). 0 이하면 `stop`(가장 먼저 닿은 마감의 사유)으로 시작하지 않는다.
 */
export function callBudgetMs(
  deadlines: readonly Deadline[],
  nowMs: number,
  callTimeoutMs: number = LLM_CALL_TIMEOUT_MS,
): { readonly ok: true; readonly timeoutMs: number } | { readonly ok: false; readonly stop: SafetyStop } {
  let timeoutMs = callTimeoutMs
  for (const d of deadlines) {
    const left = remainingMs(d, nowMs)
    if (left <= 0) return { ok: false, stop: d.stop }
    timeoutMs = Math.min(timeoutMs, left)
  }
  return { ok: true, timeoutMs }
}
