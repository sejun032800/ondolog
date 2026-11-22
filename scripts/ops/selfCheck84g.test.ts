/// <reference types="jest" />
/**
 * 84-g ④ 자기 점검 시험 데이터 · 하네스 인자 · 집계 3칸 (ROADMAP r143 R143-3 ④).
 * 위임: .claude/state/prompts/phase-7/84-g-dispatch-first-issue-polish.md
 *
 * 가짜 응답으로만 센다 - **LLM 호출 0** · 네트워크 0 · 키 0. 실제 실행은 51- ③ 때 한 번(HANDOFF).
 */
import { processCornerResponse } from '../../supabase/functions/_shared/cornerPipeline.ts'
import { sweetWordsModule } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import { FIXTURE_YEAR, buildTables } from './fixtures/m1-month/dataset.ts'
import {
  CONFLICT_DAYS,
  CONFLICT_FIXTURE,
  buildConflictTables,
  conflictContextIds,
  conflictExtraIds,
} from './fixtures/m1-month-conflict/dataset.ts'
import { assembleFixture, contextOf, recheckRecords, renderRecheck } from './m1Recheck.ts'
import { renderReview, runFileName, type RunRecord } from './m1Review.ts'
import { DEFAULT_FIXTURE, isSelfCheckRecord, resolveRunFixture, tallySelfCheck } from './selfCheckTally.ts'

type Row = Record<string, unknown>
const monthDay = (r: Row) => String(r.sent_at).slice(5, 10)

describe('84-g ④ 시험 데이터 m1-month-conflict', () => {
  const base = buildTables()
  const conflict = buildConflictTables()

  it('바탕 데이터는 그대로 - 바탕 행이 같은 id · 같은 원문으로 모두 들어 있고, 메시지만 더해진다', () => {
    expect(buildTables()).toEqual(base) // 바탕 함수 결과가 이 파일을 불러도 변하지 않는다
    expect(conflict.messages.slice(0, base.messages.length)).toEqual(base.messages)
    for (const k of Object.keys(base)) if (k !== 'messages') expect(conflict[k]).toEqual(base[k])
    expect(conflict.messages.length - base.messages.length).toBe(conflictExtraIds().length)
    expect(new Set(conflict.messages.map((m) => m.id)).size).toBe(conflict.messages.length) // id 겹침 0
  })

  it('더한 줄 = 다툰 날(09-16 · 17)과 화해 직후(09-18 아침)의 다정해 보이는 줄', () => {
    const extra = conflict.messages.slice(base.messages.length)
    const days = new Set(extra.map(monthDay))
    expect([...days].sort()).toEqual(['09-16', '09-17', '09-18'])
    const bodies = extra.map((m) => String(m.body))
    expect(bodies).toContain('고마워 들어줘서')
    expect(bodies).toContain('미안해 그리고 고마워')
    expect(bodies.some((b) => b.includes('[화해]'))).toBe(false) // 표시는 행에 들어가지 않는다
    for (const m of extra) expect(String(m.sent_at).startsWith(`${FIXTURE_YEAR}-`)).toBe(true)
  })

  it('"다툰 날 · 화해 줄" = 다툰 날 메시지 전부 + 화해 직후 표시분 - 다른 날 후보는 충분히 남는다', () => {
    const ids = conflictContextIds()
    const onConflictDays = conflict.messages.filter((m) => (CONFLICT_DAYS as readonly string[]).includes(monthDay(m)))
    for (const m of onConflictDays) expect(ids.has(String(m.id))).toBe(true)
    const reconcile = [...ids].filter((id) => !onConflictDays.some((m) => m.id === id))
    expect(reconcile).toHaveLength(2) // 09-18 아침 두 줄
    const others = conflict.messages.filter((m) => !ids.has(String(m.id)))
    expect(others.length).toBeGreaterThan(200)
    for (const d of ['09-05', '09-12', '09-20', '09-28']) expect(others.some((m) => monthDay(m) === d)).toBe(true)
  })

  it('조립(가짜 클라이언트) - 더한 줄이 다정한 말 입력에 들어간다', async () => {
    const a = await assembleFixture(FIXTURE_YEAR, CONFLICT_FIXTURE)
    const ids = new Set(a.messages.map((m) => m.id))
    for (const id of conflictExtraIds()) expect(ids.has(id)).toBe(true)
    const plain = await assembleFixture(FIXTURE_YEAR)
    expect(a.messages.length - plain.messages.length).toBe(conflictExtraIds().length)
  })
})

describe('84-g ④ 하네스 인자 --fixture', () => {
  it('없음 = 기본 m1-month(84-g 전과 같음)', () => {
    expect(DEFAULT_FIXTURE).toBe('m1-month')
    expect(resolveRunFixture(undefined, 'all')).toEqual({ ok: true, fixture: 'm1-month' })
    expect(resolveRunFixture(undefined, 'this_month')).toEqual({ ok: true, fixture: 'm1-month' })
  })

  it('자기 점검 데이터는 --corner sweet_words와 함께만', () => {
    expect(resolveRunFixture(CONFLICT_FIXTURE, 'sweet_words')).toEqual({ ok: true, fixture: CONFLICT_FIXTURE })
    for (const c of ['all', 'this_month', 'date_archive']) expect(resolveRunFixture(CONFLICT_FIXTURE, c).ok).toBe(false)
    expect(resolveRunFixture('m1-other', 'sweet_words').ok).toBe(false)
  })

  it('기록 파일 이름 - 기본은 84-g 전 그대로 · 자기 점검은 태그 뒤에 데이터 이름(기본 실행을 덮지 않음)', () => {
    const rec = { model: 'claude-sonnet-5-5', corner: 'sweet_words' as const, tag: 'final', run: 1 }
    expect(runFileName(rec)).toBe('claude-sonnet-5-5__sweet_words__final__r1.json')
    expect(runFileName({ ...rec, fixture: CONFLICT_FIXTURE })).toBe('claude-sonnet-5-5__sweet_words__final__m1-month-conflict__r1.json')
  })
})

/** 가짜 응답: 다툰 날 대화 1(표시) · 다른 날 대화 1 · 다툰 날 한 줄 1(표시 없음 = 실패) · 다른 날 한 줄 1. */
function fakeResponse(): string {
  return JSON.stringify({
    kind: 'excerpts',
    main: [
      { context: '9월 16일 밤에 오간 대화', turns: [{ messageId: 'msg-c002' }, { messageId: 'msg-c003' }], conflict: true },
      { context: '9월 12일 점심시간에 오간 대화', turns: [{ messageId: 'msg-0109' }, { messageId: 'msg-0110' }], conflict: false },
    ],
    sub: [
      { messageId: 'msg-c005', conflict: false },
      { messageId: 'msg-0063', conflict: false },
    ],
  })
}

async function fakeRecord(text: string): Promise<RunRecord> {
  const a = await assembleFixture(FIXTURE_YEAR, CONFLICT_FIXTURE)
  const input = { warmthIndex: null, messages: a.messages }
  const r = processCornerResponse(sweetWordsModule, text, input, contextOf(FIXTURE_YEAR))
  return {
    model: 'claude-sonnet-5-5',
    corner: 'sweet_words',
    run: 1,
    tag: 'selfcheck',
    startedAt: '2026-11-22T00:00:00.000Z',
    maxTokens: 4096,
    totalLatencyMs: 0,
    httpCalls: [],
    attempts: [{ index: 1, text, validation: r.ok ? { ok: true } : { ok: false, reason: r.reason, detail: r.detail } }],
    outcome: r.ok ? 'success' : 'failure',
    failureReason: r.ok ? null : r.reason,
    failureDetail: r.ok ? null : r.detail,
    llmCallAttempts: 0,
    truncated: false,
    content: r.ok ? r.content : null,
    usageTotal: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    fixtureYear: FIXTURE_YEAR,
    fixture: CONFLICT_FIXTURE,
  }
}

describe('84-g ④ 집계 3칸 (가짜 응답 · LLM 0)', () => {
  it('고른 줄 중 다툰 날 · 화해 2 / 그중 conflict 표시 1 / 표시 없이 남아 실림 1(= 실패)', async () => {
    const rec = await fakeRecord(fakeResponse())
    expect(rec.outcome).toBe('success')
    expect(tallySelfCheck(rec)).toEqual({ picked: 2, flagged: 1, published: 1 })
    // 표시된 대화는 저장 전에 빠진다(84-e dropFlagged) - 남은 다툰 날 줄은 표시 없는 그 한 줄뿐
    const stored = JSON.stringify(rec.content)
    expect(stored).not.toContain('msg-c002')
    expect(stored).toContain('msg-c005')
  })

  it('다툰 날 줄을 고르지 않으면 0 · 0 · 0 / 실패 회차는 실린 수 0', async () => {
    const clean = await fakeRecord(
      JSON.stringify({
        kind: 'excerpts',
        main: [{ context: '9월 12일 점심시간에 오간 대화', turns: [{ messageId: 'msg-0109' }, { messageId: 'msg-0110' }], conflict: false }],
        sub: [{ messageId: 'msg-0063', conflict: false }],
      }),
    )
    expect(tallySelfCheck(clean)).toEqual({ picked: 0, flagged: 0, published: 0 })
    const failed = { ...(await fakeRecord(fakeResponse())), outcome: 'failure' as const, content: null }
    expect(tallySelfCheck(failed)).toEqual({ picked: 2, flagged: 1, published: 0 })
    expect(tallySelfCheck({ ...failed, attempts: [{ index: 1, text: '{', validation: { ok: false, reason: 'parse', detail: '' } }] })).toEqual({
      picked: 0,
      flagged: 0,
      published: 0,
    })
  })

  it('review · recheck가 따로 묶는다 - 기본 실행 표 · 합계에는 넣지 않는다', async () => {
    const self = await fakeRecord(fakeResponse())
    const plain: RunRecord = { ...self, fixture: undefined, tag: 'final' }
    expect(isSelfCheckRecord(self)).toBe(true)
    expect(isSelfCheckRecord(plain)).toBe(false)

    const { review, summary } = renderReview([plain, self])
    expect(review).toContain('## 자기 점검 시험 (84-g ④')
    expect(review).toContain('| claude-sonnet-5-5 / selfcheck / 회차 1 | 성공 | 2 | 1 | 1 |')
    expect(review).toContain('| 합계 | - | 2 | 1 | 1 |')
    expect(summary).toContain('sweet_words (자기 점검 데이터)')
    expect(renderReview([plain]).review).not.toContain('자기 점검 시험 (84-g ④')

    const rows = await recheckRecords([plain, self])
    const text = renderRecheck(rows, [plain, self])
    const [main, selfPart] = text.split('## 자기 점검 시험 (84-g ④')
    expect(selfPart).toBeDefined()
    expect(main).toContain('합계: 시도 1 ·')
    expect(selfPart).toContain('| claude-sonnet-5-5 / selfcheck / 회차 1 | success | 2 | 1 | 1 |')
    expect(renderRecheck(await recheckRecords([plain]), [plain])).not.toContain('자기 점검 시험')
  })
})
