/// <reference types="jest" />
/**
 * 2.0-A1 호 생성 파이프라인 - 두 사람의 결 · 어림짐작(LLM 1회씩, 가짜 응답) · 부록(LLM 0) (위임 `m20-a1` ② ③ ④ ⑤ ⑥ · 검증).
 *
 * 메모리 저장소 + 합성 데이터셋(`fixtures/m1-month`)에 **합성 성격 행**을 더한다(실제 사람 0). 실제 모드는 진짜 `createLlmClient`에
 * 가짜 fetch · 시계 - 네트워크 0 · LLM 호출 0.
 */

import { assembleCornerInput } from '../../supabase/functions/_shared/inputAssembly.ts'
import { REQUEST_BODY_KEYS, createLlmClient } from '../../supabase/functions/_shared/llmClient.ts'
import { ENTRIES_BUCKET, MAGAZINE_BUCKET } from '../../supabase/functions/_shared/mediaPath.ts'
import { estimateRequestTokens } from '../../supabase/functions/_shared/tokenEstimate.ts'
import { ISSUE_BUDGET_USD, usageCostUsd, worstCallCostUsd } from '../../src/engine/corners/llmSafety.ts'
import { AppendixStoredSchema, LoveDnaStoredSchema, RoughGuessStoredSchema } from '../../src/types/corners/storedContent.ts'
import { COUPLE_ID, FIXTURE_YEAR, SEJUN_ID, SEOYOUNG_ID, buildTables, periodOf } from './fixtures/m1-month/dataset.ts'
import { CORNER_TABLE, LOVE_DNA_ENTRY, generateIssue, type GenerateParams, type LiveDeps } from './generateIssue.ts'
import { mediaPathsOf } from './mediaCopy.ts'
import { memoryMedia, memoryStore } from './opsMemoryStore.ts'

const AGREED = '2026-01-01T00:00:00+09:00'
const PARAMS: GenerateParams = { coupleId: COUPLE_ID, periodStart: `${FIXTURE_YEAR}-09-01`, periodEndExclusive: `${FIXTURE_YEAR}-10-01`, cadence: 'monthly' }
const USAGE = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 300, cache_read_input_tokens: 400 }

const couple = {
  id: COUPLE_ID,
  status: 'active',
  nickname: 'test-m20a1',
  members: [
    { id: SEJUN_ID, ai_usage_agreed_at: AGREED },
    { id: SEOYOUNG_ID, ai_usage_agreed_at: AGREED },
  ],
}

/** 합성 성격 행 - 두 사람 모두(`both`) 또는 한 사람만. */
function personalityTables(both: boolean) {
  const assessment = (id: string, userId: string, over: Record<string, unknown>) => ({
    id,
    user_id: userId,
    seq: 1,
    mbti: 'ENFJ',
    big_o: 60, big_c: 70, big_e: 80, big_a: 50, big_n: 40,
    stern_intimacy: 70, stern_passion: 60, stern_commitment: 80,
    attach_anxiety: 40, attach_avoidance: 30,
    attachment: 'secure',
    enneagram_core: 2,
    engine_version: 'synthetic',
    ...over,
  })
  const profiles = [
    { user_id: SEJUN_ID, active_assessment_id: 'pa-sejun', enneagram_effective: 2, love_type_code: 'AAA', attachment: 'secure' },
    { user_id: SEOYOUNG_ID, active_assessment_id: 'pa-seoyoung', enneagram_effective: 5, love_type_code: 'BBB', attachment: 'avoidant' },
  ]
  return {
    personality_assessments: [
      assessment('pa-sejun', SEJUN_ID, {}),
      assessment('pa-seoyoung', SEOYOUNG_ID, { mbti: 'INTP', big_e: 20, big_c: 40, attachment: 'avoidant', attach_avoidance: 75, enneagram_core: 5 }),
    ],
    personality_profiles: both ? profiles : profiles.slice(0, 1),
    love_type_labels: [
      { code: 'AAA', label_ko: '예시 라벨 가' },
      { code: 'BBB', label_ko: '예시 라벨 나' },
    ],
  }
}

function world(both = true) {
  const tables = { ...buildTables(), ...personalityTables(both) }
  const store = memoryStore({ tables, couple, llmProvider: { provider: 'anthropic', model: 'claude-sonnet-5-5' } })
  const media = memoryMedia(tables.data_entries.filter((e) => typeof e.storage_path === 'string').map((e) => `${ENTRIES_BUCKET}/${e.storage_path}`))
  return { tables, store, media }
}

const DNA_TEXT = JSON.stringify({
  explain: '이번 일치율은 두 분의 성격 검사 결과만으로 냈습니다.',
  attachmentCombo: { headline: '조용함과 다정함의 조합', body: '한 분은 자기 세계를 아끼고 한 분은 마음을 먼저 건넵니다.' },
  strengths: ['두 분 모두 약속을 오래 지키는 편입니다.', '친밀감의 값이 서로 가깝습니다.'],
  complements: ['모이는 쪽과 쉬는 쪽이 번갈아 갑니다.', '말을 꺼내는 속도가 서로 다릅니다.'],
  tryTogether: [],
})
const GUESS_TEXT = JSON.stringify({ line: '그날은 저녁 메뉴 얘기가 오갔습니다' })

/** 3코너 샘플 + 2.0 두 코너 응답(만들어진 클라이언트 순서). */
async function liveDeps(tables: Record<string, readonly Record<string, unknown>[]>) {
  const assembled = await assembleCornerInput(memoryStore({ tables, couple }).assemblyClient, { coupleId: COUPLE_ID, cadence: 'monthly', period: periodOf() }, 'issue-1')
  const texts = [...CORNER_TABLE.map((e) => JSON.stringify(e.sampleOf(e.inputOf(assembled)))), DNA_TEXT, GUESS_TEXT]
  const bodies: Record<string, unknown>[] = []
  const worst: number[] = []
  let clock = 1_000_000
  let created = 0
  const deps: LiveDeps = {
    now: () => clock,
    seedCoupleIds: new Set([COUPLE_ID]),
    createClient: (config) => {
      const index = created++
      return createLlmClient({
        apiKey: 'fake-key-for-test-only',
        model: config.model,
        beforeAttempt: (request) => {
          worst.push(worstCallCostUsd(config.model, estimateRequestTokens(request, 'high')))
          return config.beforeAttempt(request)
        },
        onResponse: config.onResponse,
        sleepImpl: () => Promise.resolve(),
        nowImpl: () => clock,
        setTimerImpl: () => ({}),
        clearTimerImpl: () => undefined,
        fetchImpl: (async (_url: unknown, init?: RequestInit) => {
          bodies.push(JSON.parse(String(init?.body)))
          clock += 1000
          const body = { content: [{ type: 'text', text: texts[index] }], stop_reason: 'end_turn', usage: USAGE }
          return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body } as unknown as Response
        }) as typeof fetch,
      })
    },
  }
  return { deps, bodies, worst, created: () => created }
}

describe('2.0-A1 파이프라인 - 실제 모드(가짜 fetch)', () => {
  it('3코너 그대로 + 두 사람의 결 · 어림짐작 1회씩 · 부록 LLM 0 · 요청 본문 4키 · CostMeter 최악 계산에 새 호출이 든다', async () => {
    const { store, media, tables } = world()
    const live = await liveDeps(tables)
    const report = await generateIssue({ store, media, live: live.deps }, { ...PARAMS, mode: 'live' })

    expect(report.corners.map((c) => [c.cornerType, c.outcome, c.realApiCalls])).toEqual([
      ['date_archive', 'ready', 1],
      ['sweet_words', 'ready', 1],
      ['this_month', 'ready', 1],
      ['love_dna', 'ready', 1],
      ['rough_guess', 'ready', 1],
      ['appendix', 'ready', 0],
    ])
    expect(report.realApiCalls).toBe(5)
    expect(live.bodies).toHaveLength(5)
    for (const b of live.bodies) expect(Object.keys(b).sort()).toEqual([...REQUEST_BODY_KEYS].sort())
    // CostMeter: 시도 직전마다 최악 비용을 계산한다 - 새 두 호출도 같은 길(5번)
    expect(live.worst).toHaveLength(5)
    expect(report.costUsd).toBeCloseTo(usageCostUsd('claude-sonnet-5-5', { input: 1000, output: 200, cacheWrite: 300, cacheRead: 400 }) * 5, 12)
    expect(report.costUsd).toBeLessThan(ISSUE_BUDGET_USD)

    const dna = store.corners.find((c) => c.corner_type === 'love_dna')
    const dnaContent = LoveDnaStoredSchema.parse(dna?.content)
    expect(dnaContent.header).toMatchObject({ cornerName: '우리의 연애 DNA', title: '두 사람의 결' })
    expect(dnaContent.payload.score).toMatchObject({ chatApplied: false, chatDelta: null, coeffVersion: 'dna_base_only', firstIssue: true })
    expect(dnaContent.payload.partners.map((p) => p.name)).toEqual(['세준', '서영'])

    const guess = RoughGuessStoredSchema.parse(store.corners.find((c) => c.corner_type === 'rough_guess')?.content)
    expect(guess.payload.busiestDay?.line).toBe('그날은 저녁 메뉴 얘기가 오갔습니다')
    // 어림짐작 LLM 입력은 가장 말이 많았던 날 하루치만
    const guessUser = JSON.stringify((live.bodies[4] as { messages: unknown }).messages)
    const day = guess.payload.busiestDay?.date as string
    for (const m of guessUser.matchAll(/\\"at\\":\\"(\d{4}-\d{2}-\d{2})/g)) expect(m[1]).toBe(day)

    const appendix = AppendixStoredSchema.parse(store.corners.find((c) => c.corner_type === 'appendix')?.content)
    expect(appendix.payload.calendar.month).toBe(`${FIXTURE_YEAR}-10`)
    expect(appendix.payload.calendar.marks).toEqual([{ date: `${FIXTURE_YEAR}-10-13`, label: '500일' }])
    expect(appendix.payload.nextMonth?.milestones).toEqual([{ date: `${FIXTURE_YEAR}-10-13`, label: '500일' }])
    expect(appendix.payload.noteMaterials).toMatchObject({ personality: { a: true, b: true }, chatMetricsVersion: 'chat_metrics_v0' })
    expect(appendix.payload.noteMaterials.chatSessions).toBeGreaterThan(1)
    // 부록 사진(엽서 · 사진 한 장)도 목적지로 복제된다
    for (const p of mediaPathsOf('appendix', appendix)) expect(media.objects.has(`${MAGAZINE_BUCKET}/${p}`)).toBe(true)
    expect(appendix.payload.postcards.length).toBeGreaterThan(0)

    // 저장된 2.0 content에 원문 · 메시지 id 0(채팅 지표는 숫자만) - 7번 한 줄은 LLM 문장이다
    const saved = JSON.stringify([appendix, guess.payload.items, dnaContent])
    for (const m of tables.messages) {
      expect(saved).not.toContain(String(m.id))
    }
  })

  it('3코너 결과는 2.0 코너가 있든 없든 같다(회귀 0)', async () => {
    const a = world()
    const b = world(false)
    const ra = await generateIssue({ store: a.store, media: a.media }, PARAMS)
    const rb = await generateIssue({ store: b.store, media: b.media }, PARAMS)
    expect(ra.corners.slice(0, 3)).toEqual(rb.corners.slice(0, 3))
    const three = (s: typeof a.store) => s.corners.slice(0, 3).map((c) => c.content)
    expect(three(a.store)).toEqual(three(b.store))
  })

  it('성격 데이터가 한쪽뿐이면 두 사람의 결 · 어림짐작은 호출 0으로 빠지고 부록은 실린다 · 재실행은 렌더를 무효로 하지 않는다', async () => {
    const { store, media, tables } = world(false)
    const live = await liveDeps(tables)
    const report = await generateIssue({ store, media, live: live.deps }, { ...PARAMS, mode: 'live' })
    expect(report.corners.slice(3).map((c) => [c.cornerType, c.outcome, c.realApiCalls])).toEqual([
      ['love_dna', 'skipped_insufficient_input', 0],
      ['rough_guess', 'skipped_insufficient_input', 0],
      ['appendix', 'ready', 0],
    ])
    expect(live.created()).toBe(3) // 재료 없는 2.0 코너는 클라이언트도 만들지 않는다
    expect(report.magazine20).toMatchObject({ personality: { a: true, b: false }, loveDna: 'no_personality', roughGuess: 'no_personality' })

    store.markRendered(report.issueId)
    await generateIssue({ store, media }, PARAMS)
    expect(store.issues[0].page_count).toBe(1)
  })

  it('지난 달 호의 두 사람의 결 값이 있으면 지난 호 대비를 낸다', async () => {
    const { store, media } = world()
    await generateIssue({ store, media }, { ...PARAMS, periodStart: `${FIXTURE_YEAR}-08-01`, periodEndExclusive: `${FIXTURE_YEAR}-09-01` })
    const aug = store.corners.find((c) => c.corner_type === 'love_dna')
    // 8월 호는 샘플 모드 - 메시지가 적어도 두 사람의 결은 성격만으로 실린다
    expect(aug?.status).toBe('ready')
    await generateIssue({ store, media }, PARAMS)
    const sep = store.corners.filter((c) => c.corner_type === 'love_dna')[1]
    const payload = LoveDnaStoredSchema.parse(sep.content).payload
    expect(payload.score.firstIssue).toBe(false)
    expect(payload.score.previousTotal).toBe(LoveDnaStoredSchema.parse(aug?.content).payload.score.total)
    expect(payload.score.delta).toBe(0)
  })

  it('두 사람의 결 엔트리는 2.0 표에 있다', () => {
    expect(LOVE_DNA_ENTRY.kind).toBe('love_dna')
  })
})
