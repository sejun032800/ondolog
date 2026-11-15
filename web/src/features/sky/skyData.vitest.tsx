/** 77- 하늘 데이터 읽기(useSky) · MainTab의 B02 끌기 연결 - 가짜 클라이언트(원격 0). 읽기만 하는지(쓰기 메서드 호출 0), 읽는 테이블, 온도(저장값 · 엔진 v0 · 실패)를 본다. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react'
import { ACTIVITY_V0_PROVISIONAL_COEFFICIENTS, computeDailyTemperatureV0 } from '@/engine/temperature'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { readCache } from '../../cache/deviceCache'
import { useCoupleStore } from '../../stores/coupleStore'
import { useProfileStore } from '../../stores/profileStore'
import { makeFakeNav } from '../../testSupport'
import { MainTab } from '../../tabs/MainTab'
import { START_TEMPERATURE_COEFFICIENTS } from '../main/startTemperature'
import { useSky } from './skyData'

type Row = Record<string, unknown>

function makeDb(tables: Record<string, Row[]>, opts: { failTables?: string[]; issueRows?: Row[] } = {}) {
  const touched: string[] = []
  const rpcs: string[] = []
  const cmp = (a: unknown, v: string): number => (/T/.test(v) ? new Date(String(a)).getTime() - new Date(v).getTime() : String(a).localeCompare(v))
  const from = (table: string) => {
    touched.push(table)
    const filters: Array<(r: Row) => boolean> = []
    const b: Record<string, unknown> = {}
    const same = () => b
    b.select = same; b.order = same; b.limit = same; b.range = same; b.or = same
    b.eq = (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return b }
    b.is = (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return b }
    b.not = (c: string, _o: string, v: unknown) => { filters.push((r) => (r[c] ?? null) !== v); return b }
    b.gte = (c: string, v: string) => { filters.push((r) => cmp(r[c], v) >= 0); return b }
    b.lt = (c: string, v: string) => { filters.push((r) => cmp(r[c], v) < 0); return b }
    b.lte = (c: string, v: string) => { filters.push((r) => cmp(r[c], v) <= 0); return b }
    const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
    b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null })
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(opts.failTables?.includes(table) ? { data: null, error: { message: 'x' } } : { data: rows(), error: null }).then(res, rej)
    return b
  }
  const client = {
    from,
    rpc: async (fn: string) => { rpcs.push(fn); return { data: [], error: null } },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
    auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  }
  return { client: client as never, touched, rpcs }
}

const ME = 'me'
const PARTNER = 'u2'
const NOW = new Date('2026-10-20T12:00:00+09:00')

const dateRow = (id: string, date: string): Row => ({ id, couple_id: 'c1', date_on: date, deleted_at: null })
const stopRow = (id: string, dateId: string): Row => ({ id, date_id: dateId, seq: 1, arrived_at: '2026-10-03T10:00:00+09:00', place_name: '망원' })

const baseTables = (): Record<string, Row[]> => ({
  dates: [dateRow('d1', '2026-10-03'), dateRow('d2', '2026-10-18'), dateRow('d0', '2026-09-30')],
  date_stops: [stopRow('s1', 'd1'), stopRow('s2', 'd2'), stopRow('s0', 'd0')],
  data_entries: [],
  daily_temperature: [],
  personality_profiles: [{ user_id: ME, enneagram_inferred: 1, enneagram_effective: null }, { user_id: PARTNER, enneagram_inferred: 7, enneagram_effective: null }],
  messages: [
    { id: 'm1', couple_id: 'c1', sender_id: ME, sent_at: '2026-10-02T10:00:00+09:00', deleted_at: null },
    { id: 'm2', couple_id: 'c1', sender_id: PARTNER, sent_at: '2026-10-02T11:00:00+09:00', deleted_at: null },
  ],
  issues_public: [{ id: 'i1', couple_id: 'c1', issue_type: 'monthly', issue_number: 1, title: null, cover_path: null, period_start: '2026-09-01', period_end: '2026-09-30', pdf_digital_path: null, page_count: 10, published_at: '2026-10-01T00:00:00Z', theme: 'basic' }],
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  useAuthStore.setState({ userId: ME })
  localStorage.clear()
})
afterEach(() => { cleanup(); setSupabaseForTest(null as never); vi.useRealTimers(); localStorage.clear() })

const mountSky = (persist = true) => renderHook(() => useSky({ userId: ME, partnerId: PARTNER, coupleId: 'c1', now: NOW, persist }))

describe('useSky - 읽기만', () => {
  it('이번 달 -> 전부 순서로 읽고, 읽는 곳은 dates · date_stops · data_entries · issues_public · fn_issue_progress뿐(issues 직접 · 쓰기 0)', async () => {
    const { client, touched, rpcs } = makeDb(baseTables())
    setSupabaseForTest(client)
    const { result } = mountSky()
    await waitFor(() => expect(result.current.allLoaded).toBe(true))
    expect(result.current.records.map((r) => r.date).sort()).toEqual(['2026-09-30', '2026-10-03', '2026-10-18'])
    expect(new Set(touched)).toEqual(new Set(['dates', 'date_stops', 'data_entries', 'issues_public']))
    expect(touched).not.toContain('issues')
    expect(rpcs).toEqual(['fn_issue_progress'])
    expect(result.current.moons).toEqual([{ periodStart: '2026-09-01', issueNumber: 1 }])
  })

  it('지운 데이트는 읽지 않는다 · 별 판정 입력(수)에 구간만 있는 날도 들어온다', async () => {
    const t = baseTables()
    t.dates.push({ id: 'dx', couple_id: 'c1', date_on: '2026-10-10', deleted_at: '2026-10-11T00:00:00Z' })
    const { client } = makeDb(t)
    setSupabaseForTest(client)
    const { result } = mountSky()
    await waitFor(() => expect(result.current.allLoaded).toBe(true))
    expect(result.current.records.find((r) => r.date === '2026-10-10')).toBeUndefined()
    expect(result.current.records.find((r) => r.date === '2026-10-03')?.counts).toEqual({ stops: 1, photos: 0, memos: 0 })
  })
})

describe('useSky - 그날 온도(별 크기)', () => {
  it('저장값(daily_temperature)이 있으면 그 값 그대로', async () => {
    const t = baseTables()
    t.daily_temperature = [{ couple_id: 'c1', date_on: '2026-10-03', temperature: 38.4 }, { couple_id: 'c1', date_on: '2026-10-18', temperature: 36.5 }]
    setSupabaseForTest(makeDb(t).client)
    const { result } = mountSky()
    await waitFor(() => expect(result.current.records.length).toBe(3))
    act(() => result.current.ensureTemps('2026-10'))
    await waitFor(() => expect(result.current.tempStatus['2026-10']).toBe('ok'))
    expect(result.current.temps['2026-10-03']).toBe(38.4)
    expect(result.current.temps['2026-10-18']).toBe(36.5)
  })

  it('저장값이 없으면 엔진 v0를 그날 끝 기준으로(= 엔진을 직접 부른 값)', async () => {
    const t = baseTables()
    setSupabaseForTest(makeDb(t).client)
    const { result } = mountSky()
    await waitFor(() => expect(result.current.allLoaded).toBe(true))
    act(() => result.current.ensureTemps('2026-10'))
    await waitFor(() => expect(result.current.tempStatus['2026-10']).toBe('ok'))
    const recordDays = [
      { date: '2026-09-30', stops: 1, photos: 0, memos: 0 }, { date: '2026-10-03', stops: 1, photos: 0, memos: 0 }, { date: '2026-10-18', stops: 1, photos: 0, memos: 0 },
    ]
    const expected = (day: string, next: string) => computeDailyTemperatureV0(1, 7, {
      userIds: [ME, PARTNER], todayKst: next, recordDays,
      messages: [{ senderId: ME, sentAt: '2026-10-02T10:00:00+09:00' }, { senderId: PARTNER, sentAt: '2026-10-02T11:00:00+09:00' }],
    }, { baseline: START_TEMPERATURE_COEFFICIENTS, activity: ACTIVITY_V0_PROVISIONAL_COEFFICIENTS })
    expect(result.current.temps['2026-10-03']).toBe(expected('2026-10-03', '2026-10-04'))
    expect(result.current.temps['2026-10-18']).toBe(expected('2026-10-18', '2026-10-19'))
    // 그날 끝 기준이라 활동이 있는 3일이 18일보다 따뜻하거나 같다(창에 메시지 · 기록이 더 있다)
    expect(result.current.temps['2026-10-03'] as number).toBeGreaterThanOrEqual(result.current.temps['2026-10-18'] as number)
  })

  it('메시지를 못 읽으면 그 달은 실패 - 모든 별 온도 null(= 화면은 모두 5px)', async () => {
    setSupabaseForTest(makeDb(baseTables(), { failTables: ['messages'] }).client)
    const { result } = mountSky()
    await waitFor(() => expect(result.current.allLoaded).toBe(true))
    act(() => result.current.ensureTemps('2026-10'))
    await waitFor(() => expect(result.current.tempStatus['2026-10']).toBe('failed'))
    expect(result.current.temps['2026-10-03']).toBeNull()
    expect(result.current.temps['2026-10-18']).toBeNull()
  })

  it('보이는 달만: ensureTemps를 부르지 않은 달은 읽지 않는다', async () => {
    const { client, touched } = makeDb(baseTables())
    setSupabaseForTest(client)
    const { result } = mountSky()
    await waitFor(() => expect(result.current.allLoaded).toBe(true))
    expect(touched).not.toContain('messages')
    expect(touched).not.toContain('daily_temperature')
    expect(result.current.tempStatus).toEqual({})
  })
})

describe("useSky - 기기 저장('sky')", () => {
  it('연결일 때 마지막 값을 남기고, 오프라인(읽기 실패)이어도 남긴 하늘이 먼저 보인다 · 사진 URL은 없다', async () => {
    setSupabaseForTest(makeDb(baseTables()).client)
    const first = mountSky(true)
    await waitFor(() => expect(first.result.current.allLoaded).toBe(true))
    await waitFor(() => expect(readCache(ME, 'sky', 'c1')).not.toBeNull())
    expect(JSON.stringify(readCache(ME, 'sky', 'c1'))).not.toContain('http')
    first.unmount()
    setSupabaseForTest(makeDb(baseTables(), { failTables: ['dates', 'date_stops', 'data_entries'] }).client)
    const second = mountSky(true)
    expect(second.result.current.records.length).toBe(3) // 첫 그림부터 남긴 값
    expect(second.result.current.loading).toBe(false)
    await act(async () => {})
    expect(second.result.current.records.length).toBe(3) // 읽기 실패가 지우지 않는다
    expect(second.result.current.error).toBe(false)
  })

  it('해제 유예 중(persist false)에는 남기지 않는다', async () => {
    setSupabaseForTest(makeDb(baseTables()).client)
    const r = mountSky(false)
    await waitFor(() => expect(r.result.current.allLoaded).toBe(true))
    await act(async () => {})
    expect(readCache(ME, 'sky', 'c1')).toBeNull()
  })
})

describe('MainTab B02 연결', () => {
  const touch = (el: Element, type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) => fireEvent[type](el, { touches: y === undefined ? [] : [{ clientY: y }] })
  beforeEach(() => {
    useProfileStore.setState({ status: 'loaded', profile: { id: ME, displayName: '세준', gender: 'male', birthDate: '1999-01-01', mbti: null, onboardingStep: 3, deletedAt: null } })
  })

  async function drag(state: Partial<ReturnType<typeof useCoupleStore.getState>>, tables: Record<string, Row[]> = {}) {
    setSupabaseForTest(makeDb(tables).client)
    useCoupleStore.setState({ coupleId: null, partnerId: null, relationshipStartDate: null, temperature: 36.5, grace: false, graceCoupleId: null, ...state })
    const nav = makeFakeNav()
    const { container } = render(<MainTab nav={nav} />)
    await act(async () => {})
    const el = container.querySelector('.mainScroll') as HTMLElement
    Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true, writable: true })
    touch(el, 'touchStart', 100)
    touch(el, 'touchMove', 260)
    const peek = container.querySelector('[data-testid="sky-peek"]')
    touch(el, 'touchEnd')
    return { nav, peek }
  }

  it('연결: 끌어내리는 동안 "놓으면 하늘이 열려요" -> 놓으면 하늘로 이동', async () => {
    const couples = [{ id: 'c1', status: 'active', relationship_start_date: '2026-01-01', nickname: null, user_a_id: ME, user_b_id: PARTNER, reference_photo_path: null }]
    const { nav, peek } = await drag({ status: 'connected', coupleId: 'c1', partnerId: PARTNER }, { couples })
    expect(peek?.textContent).toBe('놓으면 하늘이 열려요')
    expect(vi.mocked(nav.push)).toHaveBeenCalledWith('sky')
  })

  it('연결 전(혼자): 끌어내려도 하늘이 열리지 않고 안내도 없다', async () => {
    const { nav, peek } = await drag({ status: 'disconnected' })
    expect(peek).toBeNull()
    expect(vi.mocked(nav.push)).not.toHaveBeenCalled()
  })

  it('해제 유예 중: 열린다', async () => {
    const { nav } = await drag({ status: 'disconnected', grace: true, graceCoupleId: 'c-d' }, { couples: [{ id: 'c-d', status: 'dissolving', nickname: null, user_a_id: ME, user_b_id: PARTNER }] })
    expect(vi.mocked(nav.push)).toHaveBeenCalledWith('sky')
  })
})
