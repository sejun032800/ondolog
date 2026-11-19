/// <reference types="jest" />
/**
 * 84-a 매거진 AI 안전장치 - 순수 계산 (ROADMAP r124 R124-2 · R124-3 · R124-4, R21-1).
 * 위임: .claude/state/prompts/phase-7/84-a-dispatch-llm-safety.md
 * llmClient · 골격 쪽 시험은 `supabase/functions/_shared/safety84a.test.ts`(Deno 경로 import라 루트 tsc 밖).
 * 실제 시계 · 네트워크 0. LLM 호출 0.
 */
import {
  ALLOWED_LLM_MODELS,
  CORNER_TIME_LIMIT_MS,
  CostMeter,
  DEFAULT_LLM_MODEL,
  HARNESS_BUDGET_USD,
  ISSUE_BUDGET_USD,
  ISSUE_TIME_LIMIT_MS,
  LLM_CALL_TIMEOUT_MS,
  LLM_MAX_TOKENS,
  MODEL_REJECT_CODE,
  SAFETY_STOP,
  callBudgetMs,
  resolveHarnessModel,
  resolveLlmModel,
  usageCostUsd,
  WORST_OUTPUT_TOKENS,
  worstCallCostUsd,
} from '../../../src/engine/corners/llmSafety'
import {
  DATE_ARCHIVE_VALUE_RULES,
  FORBIDDEN_VALUE_EXPRESSIONS,
  SWEET_WORDS_VALUE_RULES,
  THIS_MONTH_VALUE_RULES,
  codePointCount,
  findValueViolations,
  valuesAt,
} from '../../../src/engine/corners/valueChecks'

describe('84-a 모델 fail-closed (R124-2 · R21-1)', () => {
  it('허용 목록 = Sonnet 5.5(기본) · Opus 5.5', () => {
    expect([...ALLOWED_LLM_MODELS]).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5'])
    expect(DEFAULT_LLM_MODEL).toBe('claude-sonnet-5-5')
  })

  it('허용 두 모델만 통과', () => {
    expect(resolveLlmModel({ provider: 'anthropic', model: 'claude-sonnet-5-5' })).toEqual({ ok: true, model: 'claude-sonnet-5-5' })
    expect(resolveLlmModel({ provider: 'anthropic', model: 'claude-opus-5-5' })).toEqual({ ok: true, model: 'claude-opus-5-5' })
  })

  it.each([
    ['값 없음(null)', null, MODEL_REJECT_CODE.missing],
    ['값 없음(undefined)', undefined, MODEL_REJECT_CODE.missing],
    ['tbd(010 초기값)', { provider: 'tbd', model: 'tbd' }, MODEL_REJECT_CODE.tbd],
    ['모델만 tbd', { provider: 'anthropic', model: 'tbd' }, MODEL_REJECT_CODE.tbd],
    ['모르는 id', { provider: 'anthropic', model: 'claude-haiku-5-5' }, MODEL_REJECT_CODE.unknownModel],
    ['빈 모델', { provider: 'anthropic', model: '' }, MODEL_REJECT_CODE.unknownModel],
    ['모르는 공급자', { provider: 'other', model: 'claude-sonnet-5-5' }, MODEL_REJECT_CODE.unknownProvider],
    ['문자열', 'claude-sonnet-5-5', MODEL_REJECT_CODE.malformed],
    ['배열', ['claude-sonnet-5-5'], MODEL_REJECT_CODE.malformed],
    ['model 칸 없음', { provider: 'anthropic' }, MODEL_REJECT_CODE.malformed],
    ['숫자 model', { provider: 'anthropic', model: 5 }, MODEL_REJECT_CODE.malformed],
  ])('%s -> 거부 코드', (_name, value, code) => {
    expect(resolveLlmModel(value)).toEqual({ ok: false, code })
  })

  it('하네스 --model: 허용 목록만 · 없음 1 · tbd 2 · 그 밖 3', () => {
    expect(resolveHarnessModel('claude-opus-5-5')).toEqual({ ok: true, model: 'claude-opus-5-5' })
    expect(resolveHarnessModel(undefined)).toEqual({ ok: false, code: 1 })
    expect(resolveHarnessModel('')).toEqual({ ok: false, code: 1 })
    expect(resolveHarnessModel('tbd')).toEqual({ ok: false, code: 2 })
    expect(resolveHarnessModel('claude-sonnet-5')).toEqual({ ok: false, code: 3 })
  })
})

describe('84-a 비용 (R124-3)', () => {
  it('상한 값: 하네스 $10 · 1호 $2', () => {
    expect(HARNESS_BUDGET_USD).toBe(10)
    expect(ISSUE_BUDGET_USD).toBe(2)
  })

  it('캐시 토큰 포함 계산 - Sonnet 5.5: 입력 2.00 · 출력 10.00 · 캐시 쓰기 2.50 · 읽기 0.10 (USD/MTok)', () => {
    const usage = { input: 1_000_000, output: 100_000, cacheWrite: 200_000, cacheRead: 3_000_000 }
    // 2.00 + 1.00 + 0.50 + 0.30
    expect(usageCostUsd('claude-sonnet-5-5', usage)).toBeCloseTo(3.8, 10)
    // Opus 5.5: 4.00 + 2.00 + 1.00 + 0.60
    expect(usageCostUsd('claude-opus-5-5', usage)).toBeCloseTo(7.6, 10)
  })

  it('최악 비용 = 입력 추정 상한 × 캐시 쓰기 단가 + 출력 max_tokens(84-a2: 16,000 - 생각 포함) × 출력 단가', () => {
    expect(WORST_OUTPUT_TOKENS).toBe(LLM_MAX_TOKENS)
    expect(LLM_MAX_TOKENS).toBe(16_000)
    expect(worstCallCostUsd('claude-sonnet-5-5', 10_000)).toBeCloseTo((10_000 * 2.5 + 16_000 * 10) / 1e6, 12)
    // Opus 5.5: 출력만 16,000 × $20/MTok = $0.32
    expect(worstCallCostUsd('claude-opus-5-5', 0)).toBeCloseTo(0.32, 12)
  })

  it('상한 직전 호출은 허용 · 넘을 호출은 거부(같으면 허용)', () => {
    const meter = new CostMeter('claude-sonnet-5-5', 2)
    meter.record({ input: 0, output: 150_000, cacheWrite: 0, cacheRead: 0 }) // $1.50
    expect(meter.spentUsd()).toBeCloseTo(1.5, 10)
    expect(meter.canAfford(0.5)).toBe(true) // 정확히 상한
    expect(meter.canAfford(0.5000001)).toBe(false)
    expect(meter.usage()).toEqual({ input: 0, output: 150_000, cacheWrite: 0, cacheRead: 0 })
  })
})

describe('84-a 시간 상한 (R124-3) - 주입 시계', () => {
  it('상한 값: 호출 120초 · 코너 8분 · 1호 20분', () => {
    expect(LLM_CALL_TIMEOUT_MS).toBe(120_000)
    expect(CORNER_TIME_LIMIT_MS).toBe(480_000)
    expect(ISSUE_TIME_LIMIT_MS).toBe(1_200_000)
  })

  const corner = { startedAtMs: 0, limitMs: CORNER_TIME_LIMIT_MS, stop: SAFETY_STOP.cornerTime }
  const issue = { startedAtMs: -1_000_000, limitMs: ISSUE_TIME_LIMIT_MS, stop: SAFETY_STOP.issueTime }

  it('마감 직전(1ms 남음) -> 시도 허용, 시간은 남은 1ms', () => {
    expect(callBudgetMs([corner], CORNER_TIME_LIMIT_MS - 1)).toEqual({ ok: true, timeoutMs: 1 })
  })
  it('마감 순간 · 직후 -> 시작 0 · 코너 사유', () => {
    expect(callBudgetMs([corner], CORNER_TIME_LIMIT_MS)).toEqual({ ok: false, stop: 'corner_time_limit' })
    expect(callBudgetMs([corner], CORNER_TIME_LIMIT_MS + 1)).toEqual({ ok: false, stop: 'corner_time_limit' })
  })
  it('남은 시간이 넉넉하면 호출 상한 120초 그대로', () => {
    expect(callBudgetMs([corner], 0)).toEqual({ ok: true, timeoutMs: LLM_CALL_TIMEOUT_MS })
  })
  it('1호 마감이 먼저면 1호 사유 · 남은 시간은 더 짧은 쪽', () => {
    expect(callBudgetMs([corner, issue], 199_999)).toEqual({ ok: true, timeoutMs: 1 })
    expect(callBudgetMs([corner, issue], 200_000)).toEqual({ ok: false, stop: 'issue_time_limit' })
  })
})

describe('84-a 값 검사 최소판 (R124-4)', () => {
  it('경로 읽기: 배열 · 중첩 · 없는 칸 건너뜀', () => {
    const v = { articles: [{ title: 'a', stopCaptions: [{ caption: 'c1' }, { caption: 'c2' }] }, { title: 'b' }] }
    expect(valuesAt(v, 'articles[].title')).toEqual(['a', 'b'])
    expect(valuesAt(v, 'articles[].stopCaptions[].caption')).toEqual(['c1', 'c2'])
    expect(valuesAt(v, 'closing')).toEqual([])
  })

  it('길이는 코드포인트로 센다(이모지 1)', () => {
    expect(codePointCount('가😀')).toBe(2)
  })

  it('길이 경계: 상한과 같으면 통과 · 하나 넘으면 걸림(칸 · 길이만 보고, 문장 0)', () => {
    const rules = [{ path: 'main[].context', maxLength: 70 }]
    expect(findValueViolations({ main: [{ context: '가'.repeat(70) }] }, rules)).toEqual([])
    expect(findValueViolations({ main: [{ context: '가'.repeat(71) }] }, rules)).toEqual(['main[].context: 길이 71 > 상한 70'])
  })

  it('금지 표현(문서 정책어)은 AI 칸 값에서 걸린다', () => {
    const rules = [{ path: 'closing', maxLength: 42 }]
    for (const word of FORBIDDEN_VALUE_EXPRESSIONS) {
      expect(findValueViolations({ closing: `이번 달은 ${word} 이야기` }, rules)).toEqual([`closing: 금지 표현 「${word}」`])
    }
    expect(findValueViolations({ closing: '함께 걸은 길이 많았던 달' }, rules)).toEqual([])
  })

  it('코너별 규칙: §9-7-2 확정값(제목 20 · 헤드라인 16)이 들어 있다', () => {
    expect(DATE_ARCHIVE_VALUE_RULES).toContainEqual({ path: 'articles[].title', maxLength: 20 })
    expect(THIS_MONTH_VALUE_RULES).toContainEqual({ path: 'theme.headline', maxLength: 16 })
    expect(THIS_MONTH_VALUE_RULES).toContainEqual({ path: 'articles[].title', maxLength: 20 })
    expect(SWEET_WORDS_VALUE_RULES).toEqual([{ path: 'main[].context', maxLength: 70 }])
  })
})

