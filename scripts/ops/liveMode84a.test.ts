/// <reference types="jest" />
/**
 * 84-a 실제 모드 스위치 · 모델 fail-closed · 시간 · 비용 상한 · 사용량 기록 (ROADMAP r124 R124-2~4, R21-1).
 * 위임: .claude/state/prompts/phase-7/84-a-dispatch-llm-safety.md
 *
 * 메모리 저장소 위에서 `generateIssue`를 그대로 돌린다. 실제 클라이언트는 **진짜 `createLlmClient`**에 가짜 fetch · 시계 ·
 * 타이머를 주입한 것 - 네트워크 0 · 실제 시계 0 · LLM 호출 0. 가짜 응답은 그 실행의 입력에서 만든 샘플 JSON(기존 검증기 통과).
 */

import { assembleCornerInput } from '../../supabase/functions/_shared/inputAssembly.ts'
import { createLlmClient } from '../../supabase/functions/_shared/llmClient.ts'
import { ENTRIES_BUCKET } from '../../supabase/functions/_shared/mediaPath.ts'
import { usageCostUsd } from '../../src/engine/corners/llmSafety.ts'
import { COUPLE_ID, FIXTURE_YEAR, SEJUN_ID, SEOYOUNG_ID, buildTables, periodOf } from './fixtures/m1-month/dataset.ts'
import {
  CORNER_TABLE,
  LIVE_ENGINE_VERSION_PREFIX,
  generateIssue,
  type GenerateParams,
  type LiveDeps,
} from './generateIssue.ts'
import { memoryMedia, memoryStore } from './opsMemoryStore.ts'
import { OpsStopError } from './opsGuards.ts'

const AGREED = '2026-01-01T00:00:00+09:00'
// 84-c: 합성 데이터셋 연도(`FIXTURE_YEAR`, 2026 -> 2025)를 따른다.
const PARAMS: GenerateParams = { coupleId: COUPLE_ID, periodStart: `${FIXTURE_YEAR}-09-01`, periodEndExclusive: `${FIXTURE_YEAR}-10-01`, cadence: 'monthly' }
const LIVE: GenerateParams = { ...PARAMS, mode: 'live' }
const SONNET = { provider: 'anthropic', model: 'claude-sonnet-5-5' }
const USAGE = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 300, cache_read_input_tokens: 400 }

const couple = (nickname: string | null = 'test-84a-couple') => ({
  id: COUPLE_ID,
  status: 'active',
  nickname,
  members: [
    { id: SEJUN_ID, ai_usage_agreed_at: AGREED },
    { id: SEOYOUNG_ID, ai_usage_agreed_at: AGREED },
  ],
})

function world(llmProvider: unknown = SONNET, nickname?: string | null) {
  const tables = buildTables()
  const store = memoryStore({ tables, couple: couple(nickname), llmProvider })
  const media = memoryMedia(tables.data_entries.filter((e) => typeof e.storage_path === 'string').map((e) => `${ENTRIES_BUCKET}/${e.storage_path}`))
  return { tables, store, media }
}

/** 코너 순서대로의 샘플 응답 - 메모리 저장소의 첫 호 id는 `issue-1`이다(아래 시험이 확인). */
async function sampleTexts(tables: ReturnType<typeof buildTables>): Promise<string[]> {
  const context = {
    coupleId: COUPLE_ID,
    cadence: 'monthly' as const,
    period: periodOf(),
  }
  const assembled = await assembleCornerInput(memoryStore({ tables, couple: couple() }).assemblyClient, context, 'issue-1')
  return CORNER_TABLE.map((e) => JSON.stringify(e.sampleOf(e.inputOf(assembled))))
}

interface Script {
  /** 코너 순서(0~2) · 그 코너의 몇 번째 HTTP 시도(0부터) -> 응답 글자. 없으면 샘플 정답. */
  text?: (corner: number, attempt: number) => string | undefined
  usage?: (corner: number) => Record<string, number>
  /** 응답 직전에 시계를 얼마나 움직일지(ms). */
  advance?: (corner: number, attempt: number) => number
  /** 84-a2: HTTP 상태(없으면 200). 200이 아니면 오류 본문(요청 id 포함)을 돌려준다. */
  status?: (corner: number, attempt: number) => number
}

/** 진짜 `createLlmClient` + 가짜 fetch · 시계 · 타이머. */
function liveDeps(samples: string[], script: Script = {}) {
  let clock = 1_000_000
  const created: string[] = []
  const bodies: Record<string, unknown>[] = []
  const attemptsByCorner = [0, 0, 0]
  const deps: LiveDeps = {
    now: () => clock,
    createClient: (config) => {
      const corner = created.length
      created.push(config.model)
      return createLlmClient({
        apiKey: 'fake-key-for-test-only',
        model: config.model,
        beforeAttempt: config.beforeAttempt,
        onResponse: config.onResponse,
        sleepImpl: () => Promise.resolve(),
        nowImpl: () => clock,
        setTimerImpl: () => ({}),
        clearTimerImpl: () => undefined,
        fetchImpl: (async (_url: unknown, init?: RequestInit) => {
          const attempt = attemptsByCorner[corner]++
          bodies.push(JSON.parse(String(init?.body)))
          clock += script.advance?.(corner, attempt) ?? 1000
          const status = script.status?.(corner, attempt) ?? 200
          if (status !== 200) {
            const err = { type: 'error', error: { type: 'invalid_request_error', message: 'bad' }, request_id: 'req_fake84a2' }
            return { ok: false, status, text: async () => JSON.stringify(err), json: async () => err } as unknown as Response
          }
          const text = script.text?.(corner, attempt) ?? samples[corner]
          const body = { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: script.usage?.(corner) ?? USAGE }
          return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body } as unknown as Response
        }) as typeof fetch,
      })
    },
  }
  return { deps, created, bodies, fetchCount: () => bodies.length }
}

describe('84-a 실제 모드 스위치 - 인수 없으면 샘플', () => {
  it('mode 없음 -> 샘플(실제 클라이언트를 넘겨도 만들지 않음) · 호출 0 · 모델 없음', async () => {
    const { store, media, tables } = world()
    const live = liveDeps(await sampleTexts(tables))
    const report = await generateIssue({ store, media, live: live.deps }, PARAMS)
    expect(report).toMatchObject({ mode: 'sample', realApiCalls: 0, model: null, costUsd: 0 })
    expect(live.created).toEqual([])
    expect(live.fetchCount()).toBe(0)
    expect(store.corners.every((c) => c.llm_usage === undefined)).toBe(true)
  })

  it('live인데 실제 의존성이 없으면 멈춘다', async () => {
    const { store, media } = world()
    await expect(generateIssue({ store, media }, LIVE)).rejects.toBeInstanceOf(OpsStopError)
    expect(store.issues).toHaveLength(0)
  })
})

describe('84-a 가드 밖이면 거부 (실제 사용자 0)', () => {
  it.each([null, 'real-couple'])('시험 표시 없는 커플(%s) -> 거부 · 호출 0 · 호 행 0', async (nickname) => {
    const { store, media, tables } = world(SONNET, nickname)
    const live = liveDeps(await sampleTexts(tables))
    await expect(generateIssue({ store, media, live: live.deps }, LIVE)).rejects.toBeInstanceOf(OpsStopError)
    expect(live.created).toEqual([])
    expect(live.fetchCount()).toBe(0)
    expect(store.issues).toHaveLength(0)
  })
})

describe('84-a 모델 fail-closed (R21-1 완료 기준) - 호 행을 만들기 전에 거부', () => {
  it.each([
    ['tbd(010 초기값)', { provider: 'tbd', model: 'tbd' }, 2],
    ['값 없음', null, 1],
    ['모르는 id', { provider: 'anthropic', model: 'claude-unknown' }, 3],
    ['형식 오류', 'claude-sonnet-5-5', 4],
  ])('%s -> 거부 코드', async (_name, value, code) => {
    const { store, media, tables } = world(value)
    const live = liveDeps(await sampleTexts(tables))
    await expect(generateIssue({ store, media, live: live.deps }, LIVE)).rejects.toThrow(`거부 코드 ${code}`)
    expect(live.fetchCount()).toBe(0)
    expect(store.issues).toHaveLength(0)
    expect(store.corners).toHaveLength(0)
  })

  it('설정 조회 오류 -> 멈춤(호출 0)', async () => {
    const { store, media, tables } = world(() => {
      throw new Error('조회 실패')
    })
    const live = liveDeps(await sampleTexts(tables))
    await expect(generateIssue({ store, media, live: live.deps }, LIVE)).rejects.toThrow('조회 실패')
    expect(live.fetchCount()).toBe(0)
    expect(store.issues).toHaveLength(0)
  })
})

describe('84-a 실제 모드 - 가드 안 + fail-closed 통과 -> 실제 클라이언트(가짜 fetch)', () => {
  it('코너 3개 ready · 클라이언트는 허용 모델로 3번 · 본문에 샘플링 값 0(84-a2) · llm_usage(숫자 · 코드만) · 비용 합', async () => {
    const { store, media, tables } = world({ provider: 'anthropic', model: 'claude-opus-5-5' })
    const live = liveDeps(await sampleTexts(tables))
    const report = await generateIssue({ store, media, live: live.deps }, LIVE)

    expect(store.issues[0].id).toBe('issue-1') // 샘플 응답의 전제
    expect(report.mode).toBe('live')
    expect(report.model).toBe('claude-opus-5-5')
    expect(report.realApiCalls).toBe(3)
    expect(report.corners.map((c) => [c.cornerType, c.outcome, c.realApiCalls])).toEqual([
      ['date_archive', 'ready', 1],
      ['sweet_words', 'ready', 1],
      ['this_month', 'ready', 1],
    ])
    expect(live.created).toEqual(['claude-opus-5-5', 'claude-opus-5-5', 'claude-opus-5-5'])
    expect(live.bodies.every((b) => !('temperature' in b) && !('top_p' in b) && !('top_k' in b) && b.model === 'claude-opus-5-5')).toBe(true)

    const one = { input: 1000, output: 200, cacheWrite: 300, cacheRead: 400 }
    const each = usageCostUsd('claude-opus-5-5', one)
    for (const c of store.corners) {
      expect(c.engine_version).toBe(`${LIVE_ENGINE_VERSION_PREFIX}claude-opus-5-5`)
      expect(c.generation_attempts).toBe(1)
      expect(c.llm_usage).toEqual({ model: 'claude-opus-5-5', ...one, costUsd: each, attempts: 1, latencyMs: 1000, failure: null })
    }
    expect(report.costUsd).toBeCloseTo(each * 3, 12)
  })

  it('1호 비용 $2: 첫 코너 사용량이 커서 다음 호출의 최악을 더하면 넘침 -> 남은 코너는 호출 0 · 안전 정지 · 경보', async () => {
    const { store, media, tables } = world()
    // Sonnet 출력 10 USD/MTok - 199,000 출력 = $1.99. 다음 호출 최악(출력 16,000만 해도 $0.16)을 더하면 $2를 넘는다.
    const live = liveDeps(await sampleTexts(tables), {
      usage: () => ({ input_tokens: 0, output_tokens: 199_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }),
    })
    const report = await generateIssue({ store, media, live: live.deps }, LIVE)
    expect(live.fetchCount()).toBe(1)
    expect(report.corners.map((c) => c.outcome)).toEqual(['ready', 'halted_pending', 'halted_pending'])
    expect(store.alerts.map((a) => a.detail.stage)).toEqual(['cost_limit', 'cost_limit'])
    expect(store.corners.find((c) => c.corner_type === 'sweet_words')).toMatchObject({ status: 'pending', content: {} })
    expect(report.costUsd).toBeCloseTo(1.99, 10)
  })

  it('코너 8분: 첫 응답이 형식 오류이고 8분이 지났으면 재요청 0 -> 그 코너만 안전 정지 · 나머지는 그대로', async () => {
    const { store, media, tables } = world()
    const live = liveDeps(await sampleTexts(tables), {
      text: (corner, attempt) => (corner === 0 && attempt === 0 ? '{깨진' : undefined),
      advance: (corner, attempt) => (corner === 0 && attempt === 0 ? 8 * 60_000 : 1000),
    })
    const report = await generateIssue({ store, media, live: live.deps }, LIVE)
    expect(report.corners.map((c) => c.outcome)).toEqual(['halted_pending', 'ready', 'ready'])
    expect(live.fetchCount()).toBe(3)
    expect(store.alerts.map((a) => a.detail.stage)).toEqual(['corner_time_limit'])
    expect(store.corners.find((c) => c.corner_type === 'date_archive')?.llm_usage).toMatchObject({ attempts: 1, failure: 'corner_time_limit' })
  })

  it('코너 8분 직전(1ms 남음)이면 재요청이 나간다 -> 정상 응답으로 ready', async () => {
    const { store, media, tables } = world()
    const live = liveDeps(await sampleTexts(tables), {
      text: (corner, attempt) => (corner === 0 && attempt === 0 ? '{깨진' : undefined),
      advance: (corner, attempt) => (corner === 0 && attempt === 0 ? 8 * 60_000 - 1 : 0),
    })
    const report = await generateIssue({ store, media, live: live.deps }, LIVE)
    expect(report.corners.map((c) => c.outcome)).toEqual(['ready', 'ready', 'ready'])
    expect(report.corners[0].realApiCalls).toBe(2)
  })

  it('1호 20분: 첫 코너에서 20분이 지나면 남은 코너는 시작 0 · 사유 issue_time_limit', async () => {
    const { store, media, tables } = world()
    const live = liveDeps(await sampleTexts(tables), { advance: (corner) => (corner === 0 ? 20 * 60_000 : 0) })
    const report = await generateIssue({ store, media, live: live.deps }, LIVE)
    expect(live.fetchCount()).toBe(1)
    expect(live.created).toHaveLength(1) // 남은 코너는 클라이언트도 만들지 않는다
    expect(report.corners.map((c) => [c.outcome, c.detail])).toEqual([
      ['ready', null],
      ['halted_pending', 'issue_time_limit'],
      ['halted_pending', 'issue_time_limit'],
    ])
    expect(store.alerts.map((a) => a.detail.stage)).toEqual(['issue_time_limit', 'issue_time_limit'])
  })
})

describe('84-a2 실제 모드 - 기록되는 호출 수 = 실제로 보낸 수 (R131-2 ②)', () => {
  it('400이면 다시 보내지 않음: 코너마다 fetch 1 · generation_attempts · llm_usage.attempts · realApiCalls 모두 1 · 요청 id 0', async () => {
    const { store, media, tables } = world()
    const live = liveDeps(await sampleTexts(tables), { status: () => 400 })
    const report = await generateIssue({ store, media, live: live.deps }, LIVE)
    expect(live.fetchCount()).toBe(3)
    expect(report.realApiCalls).toBe(3)
    expect(report.corners.map((c) => [c.outcome, c.realApiCalls])).toEqual([
      ['failed', 1],
      ['failed', 1],
      ['failed', 1],
    ])
    for (const c of store.corners) {
      expect(c.generation_attempts).toBe(1)
      expect(c.llm_usage).toMatchObject({ attempts: 1, failure: 'generation_failed' })
    }
    expect(JSON.stringify(report)).not.toContain('req_fake84a2')
    expect(JSON.stringify(store.corners)).not.toContain('req_fake84a2')
  })

  it('429 다음 성공: 보낸 수 2 = realApiCalls 2 = llm_usage.attempts 2', async () => {
    const { store, media, tables } = world()
    const live = liveDeps(await sampleTexts(tables), { status: (corner, attempt) => (corner === 0 && attempt === 0 ? 429 : 200) })
    const report = await generateIssue({ store, media, live: live.deps }, LIVE)
    expect(report.corners.map((c) => [c.outcome, c.realApiCalls])).toEqual([
      ['ready', 2],
      ['ready', 1],
      ['ready', 1],
    ])
    expect(live.fetchCount()).toBe(4)
    expect(store.corners.find((c) => c.corner_type === 'date_archive')?.llm_usage).toMatchObject({ attempts: 2, failure: null })
  })
})
