/** 76- T(R100-1) 온도 v0 앱 표시 - 저장값 우선 · 없으면 엔진 v0 값 · 못 읽으면 기저 · 1000행 넘는 읽기 · 문구 조건. 읽기만(쓰기 0). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import {
  ACTIVITY_V0_PROVISIONAL_COEFFICIENTS,
  computeBaselineTemperature,
  computeDailyTemperatureV0,
  type ActivityV0MessagesInput,
} from '@/engine/temperature'
import { ACTIVITY_MAX_PAGES, ACTIVITY_PAGE_SIZE, readActivityInput, type ActivityDb } from './activityRead'

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

const A = 'user-a'
const B = 'user-b'
const TODAY = '2025-11-15' // KST 오늘. 창 = 2025-11-01 ~ 2025-11-14
const kst = (day: string, hour = 12, min = 0): string => `${day}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+09:00`

/** 시험용 메모리 질의기: eq / is / gte / lt / lte / order / range / count(head)를 실제로 걸러 준다. 호출 기록을 남긴다. */
function makeDb(tables: Tables, opts: { failTable?: string } = {}) {
  const calls: { table: string; range?: [number, number]; head?: boolean }[] = []
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = []
    let range: [number, number] | undefined
    let head = false
    const orderBy: string[] = []
    const q: Record<string, unknown> = {}
    q.select = (_c: string, o?: { head?: boolean }) => { head = !!o?.head; return q }
    q.eq = (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q }
    q.is = (c: string, v: null) => { filters.push((r) => (r[c] ?? null) === v); return q }
    const cmp = (r: Row, c: string, v: string): number => (/T/.test(v) ? new Date(String(r[c])).getTime() - new Date(v).getTime() : String(r[c]).localeCompare(v))
    q.gte = (c: string, v: string) => { filters.push((r) => cmp(r, c, v) >= 0); return q }
    q.lt = (c: string, v: string) => { filters.push((r) => cmp(r, c, v) < 0); return q }
    q.lte = (c: string, v: string) => { filters.push((r) => cmp(r, c, v) <= 0); return q }
    q.order = (c: string) => { orderBy.push(c); return q }
    q.range = (a: number, b: number) => { range = [a, b]; return q }
    q.then = (resolve: (v: unknown) => unknown) => {
      calls.push({ table, range, head })
      if (opts.failTable === table) return Promise.resolve({ data: null, count: null, error: { message: 'x' } }).then(resolve)
      let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
      rows = [...rows].sort((x, y) => String(x[orderBy[0] ?? 'id']).localeCompare(String(y[orderBy[0] ?? 'id'])))
      if (head) return Promise.resolve({ data: null, count: rows.length, error: null }).then(resolve)
      if (range) rows = rows.slice(range[0], range[1] + 1)
      return Promise.resolve({ data: rows, count: null, error: null }).then(resolve)
    }
    return q
  }
  return { db: { from } as unknown as ActivityDb, calls }
}

/** 엔진을 직접 부른 기대값(메시지 단위 입력). */
function engineExpect(coreA: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, coreB: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, input: ActivityV0MessagesInput): number {
  return computeDailyTemperatureV0(coreA, coreB, input, { baseline: { contrast: 36.5, neutral: 39, best: 42 }, activity: ACTIVITY_V0_PROVISIONAL_COEFFICIENTS })
}

const msg = (id: string, sender: string, iso: string, extra: Row = {}): Row => ({ id, couple_id: 'c1', sender_id: sender, sent_at: iso, deleted_at: null, ...extra })

describe('readActivityInput - 읽는 것', () => {
  it('지운 메시지 · 오늘(KST) 메시지 · 창 밖 메시지는 세지 않고, 사진 메시지(본문 없음)는 센다', async () => {
    const { db } = makeDb({
      messages: [
        msg('1', A, kst('2025-11-14', 9)),
        msg('2', B, kst('2025-11-14', 10), { body: null, media_path: 'p/1.jpg' }), // 사진 메시지
        msg('3', B, kst('2025-11-14', 11), { deleted_at: '2025-11-14T05:00:00Z' }), // 지움
        msg('4', A, kst(TODAY, 0, 5)), // 오늘 - 읽지 않는다
        msg('5', A, kst('2025-10-31', 23, 59)), // 창 밖
      ],
      dates: [],
    })
    const input = await readActivityInput(db, 'c1', [A, B], TODAY)
    expect([...input.dailyCounts].sort((x, y) => x.senderId.localeCompare(y.senderId))).toEqual([
      { date: '2025-11-14', senderId: A, count: 1 },
      { date: '2025-11-14', senderId: B, count: 1 },
    ])
  })

  it('데이트 기록 있음 = 지우지 않은 dates 행 중 사진이 있거나 메모가 있는 날(지운 데이트 · 지운 항목만 남은 날 · 창 밖 제외)', async () => {
    const { db } = makeDb({
      messages: [],
      dates: [
        { id: 'd1', couple_id: 'c1', date_on: '2025-11-10', photo_count: 2, has_user_note: false, deleted_at: null },
        { id: 'd2', couple_id: 'c1', date_on: '2025-11-11', photo_count: 0, has_user_note: true, deleted_at: null },
        { id: 'd3', couple_id: 'c1', date_on: '2025-11-12', photo_count: 0, has_user_note: false, deleted_at: null }, // 지운 항목만 남음
        { id: 'd4', couple_id: 'c1', date_on: '2025-11-13', photo_count: 3, has_user_note: false, deleted_at: '2025-11-14T00:00:00Z' }, // 지운 데이트
        { id: 'd5', couple_id: 'c1', date_on: TODAY, photo_count: 3, has_user_note: false, deleted_at: null }, // 오늘
        { id: 'd6', couple_id: 'c1', date_on: '2025-10-31', photo_count: 3, has_user_note: false, deleted_at: null }, // 창 밖
      ],
    })
    const input = await readActivityInput(db, 'c1', [A, B], TODAY)
    expect([...input.recordDates].sort()).toEqual(['2025-11-10', '2025-11-11'])
  })

  it('읽기가 실패하면 throw한다(호출부가 기저만 보인다)', async () => {
    await expect(readActivityInput(makeDb({ messages: [], dates: [] }, { failTable: 'messages' }).db, 'c1', [A, B], TODAY)).rejects.toThrow()
    await expect(readActivityInput(makeDb({ messages: [], dates: [] }, { failTable: 'dates' }).db, 'c1', [A, B], TODAY)).rejects.toThrow()
  })
})

describe('readActivityInput - 1000행 넘는 경우', () => {
  it('1000행을 넘으면 페이지로 이어 읽고 건수가 정확하다(2500건 -> 3페이지)', async () => {
    const rows: Row[] = []
    for (let i = 0; i < 2500; i += 1) {
      const day = 1 + (i % 14)
      rows.push(msg(`m${String(i).padStart(5, '0')}`, i % 2 === 0 ? A : B, kst(`2025-11-${String(day).padStart(2, '0')}`, 8 + (i % 10), i % 60)))
    }
    const { db, calls } = makeDb({ messages: rows, dates: [] })
    const input = await readActivityInput(db, 'c1', [A, B], TODAY)
    expect(calls.filter((c) => c.table === 'messages').map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(input.dailyCounts.reduce((s, r) => s + r.count, 0)).toBe(2500)
  })

  it('페이지 상한을 넘으면 (날짜 · 사람)별 건수(head 요청)로 바꾼다 - 행을 받지 않고 같은 합계', async () => {
    const rows: Row[] = []
    for (let i = 0; i < 30; i += 1) rows.push(msg(`m${i}`, i % 2 === 0 ? A : B, kst(`2025-11-${String(1 + (i % 14)).padStart(2, '0')}`, 12, i)))
    const { db, calls } = makeDb({ messages: rows, dates: [] })
    // 상한 경로를 시험하려고 한 페이지를 꽉 채워 주는 가짜 질의기(페이지마다 1000행)를 쓴다.
    const full: Row[] = Array.from({ length: ACTIVITY_PAGE_SIZE }, (_, i) => msg(`f${i}`, A, kst('2025-11-02', 12, i % 60)))
    const wrapped: ActivityDb = {
      from: (t: string) => {
        const base = (db as unknown as { from: (x: string) => Record<string, unknown> }).from(t)
        let isHead = false
        const origSelect = base.select as (c: string, o?: { head?: boolean }) => unknown
        base.select = (c: string, o?: { head?: boolean }) => { isHead = !!o?.head; return origSelect(c, o) }
        const origThen = base.then as (r: (v: unknown) => unknown) => unknown
        base.then = (resolve: (v: unknown) => unknown) => (t === 'messages' && !isHead ? Promise.resolve({ data: full, error: null }).then(resolve) : origThen(resolve))
        return base
      },
    } as unknown as ActivityDb
    const input = await readActivityInput(wrapped, 'c1', [A, B], TODAY)
    expect(calls.filter((c) => c.head).length).toBe(14 * 2)
    expect(input.dailyCounts.reduce((s, r) => s + r.count, 0)).toBe(30)
    expect(ACTIVITY_MAX_PAGES).toBeGreaterThan(1)
  })
})

describe('startTemperatureV0 - 엔진 값 그대로', () => {
  it('기대값 = 엔진 computeDailyTemperatureV0를 메시지 입력으로 직접 부른 값(읽은 건수 입력과 같다)', async () => {
    const { startTemperatureV0 } = await import('./startTemperature')
    const messages = [
      { senderId: A, sentAt: kst('2025-11-14', 9) }, { senderId: B, sentAt: kst('2025-11-14', 10) },
      { senderId: A, sentAt: kst('2025-11-10', 9) },
    ]
    const rows = messages.map((m, i) => msg(`m${i}`, m.senderId, m.sentAt))
    const { db } = makeDb({ messages: rows, dates: [{ id: 'd1', couple_id: 'c1', date_on: '2025-11-12', photo_count: 1, has_user_note: false, deleted_at: null }] })
    const input = await readActivityInput(db, 'c1', [A, B], TODAY)
    const got = startTemperatureV0(1, 7, input)
    const expected = engineExpect(1, 7, { userIds: [A, B], todayKst: TODAY, recordDates: ['2025-11-12'], messages })
    expect(got?.value).toBe(expected)
    expect(got?.value).toBeGreaterThan(42)
    expect(got?.hasActivity).toBe(true)
  })

  it('활동 0이면 기저 그대로 + hasActivity false · 읽지 못했으면(null) 기저만 · 코어가 빠지면 null', async () => {
    const { startTemperatureV0 } = await import('./startTemperature')
    const empty = await readActivityInput(makeDb({ messages: [], dates: [] }).db, 'c1', [A, B], TODAY)
    expect(startTemperatureV0(1, 7, empty)).toEqual({ value: 42, hasActivity: false })
    expect(startTemperatureV0(1, 8, null)).toEqual({ value: computeBaselineTemperature(1, 8, { contrast: 36.5, neutral: 39, best: 42 }), hasActivity: false })
    expect(startTemperatureV0(null, 8, empty)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 훅 · 화면
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('../../auth/client', () => ({ getSupabase: () => hoisted.client }))

describe('useStartTemperature (읽기 + 엔진)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(kst(TODAY, 15))) })
  afterEach(() => { vi.useRealTimers(); hoisted.client = null; cleanup() })

  // personality_profiles 조회는 `.in()`을 쓰므로, 표 모양을 그대로 흉내 내는 작은 클라이언트를 직접 둔다.
  function clientWith(opts: { messages?: Row[]; dates?: Row[]; failMessages?: boolean }) {
    const activity = makeDb({ messages: opts.messages ?? [], dates: opts.dates ?? [] }, { failTable: opts.failMessages ? 'messages' : undefined })
    return {
      from: (t: string) => {
        if (t === 'personality_profiles') {
          const res = { data: [{ user_id: A, enneagram_inferred: 1, enneagram_effective: null }, { user_id: B, enneagram_inferred: 7, enneagram_effective: null }], error: null }
          const q = { select: () => q, in: () => Promise.resolve(res) }
          return q
        }
        return (activity.db as unknown as { from: (x: string) => unknown }).from(t)
      },
    }
  }

  it('저장값이 없고 활동이 있으면 엔진 v0 값(기저 42 + 활동분) · 활동분이 있다고 알린다', async () => {
    hoisted.client = clientWith({ messages: [msg('1', A, kst('2025-11-14', 9)), msg('2', B, kst('2025-11-14', 10))] })
    const { useStartTemperature } = await import('./startTemperature')
    const { result } = renderHook(() => useStartTemperature(A, B, true, 'c1'))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.value).toBe(engineExpect(1, 7, { userIds: [A, B], todayKst: TODAY, recordDates: [], messages: [{ senderId: A, sentAt: kst('2025-11-14', 9) }, { senderId: B, sentAt: kst('2025-11-14', 10) }] }))
    expect(result.current?.hasActivity).toBe(true)
  })

  it('메시지 읽기가 실패하면 기저만(42 · 활동 없음)', async () => {
    hoisted.client = clientWith({ failMessages: true })
    const { useStartTemperature } = await import('./startTemperature')
    const { result } = renderHook(() => useStartTemperature(A, B, true, 'c1'))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({ value: 42, hasActivity: false })
  })

  it('enabled가 꺼져 있으면(= 저장값이 있다) 읽지도 않는다', async () => {
    hoisted.client = clientWith({})
    const spy = vi.spyOn(hoisted.client as { from: (t: string) => unknown }, 'from')
    const { useStartTemperature } = await import('./startTemperature')
    const { result } = renderHook(() => useStartTemperature(A, B, false, 'c1'))
    await act(async () => { await Promise.resolve() })
    expect(result.current).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('메인 히어로 문구 조건', () => {
  afterEach(() => cleanup())
  it('활동분이 0일 때만 "시작 온도예요…" 문구가 보인다 · 활동분이 있으면 숨긴다 · 저장값이 있으면 저장값 그대로', async () => {
    const { MainView } = await import('./MainView')
    const { useCoupleStore } = await import('../../stores/coupleStore')
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1' })
    const base = {
      now: new Date('2025-11-15T12:00:00+09:00'), status: 'connected' as const, nickname: null, storedTemperature: null, startDate: '2025-10-01', selfName: '세준', partnerName: '서영',
      facts: { hasActivity: true, profilesComplete: true, openedIssueIds: new Set<string>(), openedFor: '' },
      library: { issues: [], coverUrls: {}, next: null, loading: false, error: false },
      summary: null, onInvite: () => {}, onChat: () => {}, onOpenIssue: () => {},
    }
    const { rerender } = render(<MainView {...base} startTemperature={42} startTemperatureActive={false} />)
    expect(screen.getByTestId('main-start-temperature-caption')).toBeTruthy()
    rerender(<MainView {...base} startTemperature={44.3} startTemperatureActive />)
    expect(screen.getByRole('img', { name: '44.3도' })).toBeTruthy()
    expect(screen.queryByTestId('main-start-temperature-caption')).toBeNull()
    rerender(<MainView {...base} startTemperature={44.3} startTemperatureActive storedTemperature={38.2} />)
    expect(screen.queryByTestId('main-start-temperature')).toBeNull()
    expect(screen.getByRole('img', { name: '38.2도' })).toBeTruthy()
  })
})

