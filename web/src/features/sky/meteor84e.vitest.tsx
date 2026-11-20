/**
 * 84-e 유성 · 떨어진 말(MASTER 9-8-4 r80 · 보드 17-b · ROADMAP R137-1 · R137-2). 가짜 데이터(원격 0) · 시계 주입(76-j · 85- 방식).
 *  - 규칙: 7일 경계 · 하루 1번 · 놓친 말 다음 날 다시 · 잡은 말 다시 0 · 후보 0 -> 표시 0 · 설정 끔 -> 0 · 줄인 모션 5.2초
 *  - 읽기: 한 줄 선택만 · id로 · 옛 호는 보낸 사람 + 시각 · 숨김/탈퇴로 행이 없으면 건너뜀 · 질의는 select뿐
 *  - 화면: C01 유성 -> C03 · 지난 하늘 0 · 원문이 기기 저장소에 0 · 서버 쓰기 0
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { makeFakeNav } from '../../testSupport'
import type { DayRecord } from '../records/dayRecordRead'
import type { SkyData } from './skyData'
import {
  EMPTY_MEMORY, MIN_AGE_MS, eligibleCandidates, fallenMeta, kstDay, markCaught, markDropped, planMeteor, pressableMs, type MeteorCandidate,
} from './meteorRules'
import { fetchMeteorCandidates, readMeteorMemory, subRefsOf, writeMeteorMemory, type MeteorDb } from './meteorData'
import { clearAllDeviceCache, clearCoupleCache, purgeOtherUsers, readCache, writeCache } from '../../cache/deviceCache'
import { useSkyPrefStore } from './skyPrefs'

// ---------------------------------------------------------------------------
// 가짜 DB - select만 받는다(쓰기 메서드가 없다 - 부르면 시험이 깨진다)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>
interface Call { table: string; ops: string[] }

function fakeDb(tables: Record<string, Row[]>, calls: Call[] = []): MeteorDb {
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          const call: Call = { table, ops: ['select'] }
          calls.push(call)
          let rows = [...(tables[table] ?? [])]
          const q = {
            eq(c: string, v: unknown) { call.ops.push('eq'); rows = rows.filter((r) => r[c] === v); return q },
            is(c: string, v: null) { call.ops.push('is'); rows = rows.filter((r) => (r[c] ?? null) === v); return q },
            in(c: string, vs: readonly unknown[]) { call.ops.push('in'); rows = rows.filter((r) => vs.includes(r[c])); return q },
            gte(c: string, v: string) { call.ops.push('gte'); rows = rows.filter((r) => Date.parse(String(r[c])) >= Date.parse(v)); return q },
            lt(c: string, v: string) { call.ops.push('lt'); rows = rows.filter((r) => Date.parse(String(r[c])) < Date.parse(v)); return q },
            order() { call.ops.push('order'); rows.sort((a, b) => Date.parse(String(a.sent_at)) - Date.parse(String(b.sent_at))); return q },
            limit() { return q },
            then<A>(ok: (v: { data: unknown; error: unknown }) => A) { return Promise.resolve({ data: rows, error: null }).then(ok) },
          }
          return q as never
        },
      }
    },
  }
}

const COUPLE = 'c1'
const ME = 'u1'
const YOU = 'p1'
const NAMES = { [ME]: '세준', [YOU]: '서영' }
const NOW = new Date('2026-10-20T12:00:00+09:00')

const msg = (id: string, sender: string, body: string, sentAt: string, extra: Row = {}): Row => ({ id, couple_id: COUPLE, sender_id: sender, body, sent_at: sentAt, deleted_at: null, ...extra })
const sub = (o: { messageId?: string; speaker: string; at: string; text?: string }) => ({
  ...(o.messageId ? { messageId: o.messageId } : {}), speaker: o.speaker, text: o.text ?? '코너 사본(쓰지 않는다)',
  attribution: { display: 'x', at: o.at, source: 'chat' },
})
const corner = (subs: unknown[], status = 'published', type = 'sweet_words'): Row => ({
  couple_id: COUPLE, corner_type: type, status,
  content: { payload: { warmthIndex: null, main: [{ context: 'c', attribution: {}, turns: [{ messageId: 'turn-1', speaker: '세준', text: '대화 턴', at: '2026-09-01T09:00:00+09:00' }] }], sub: subs } },
})

const cand = (id: string, sentAt: string, body = `말 ${id}`): MeteorCandidate => ({ id, senderId: YOU, body, sentAt })

// ---------------------------------------------------------------------------
// 규칙
// ---------------------------------------------------------------------------

describe('84-e 유성 규칙 - 순수 함수', () => {
  const base = { memory: EMPTY_MEMORY, now: NOW, coupleId: COUPLE, userId: ME, enabled: true }

  it('7일 경계 - 딱 7일 지난 말은 후보, 1ms 모자라면 아니다', () => {
    const edge = new Date(NOW.getTime() - MIN_AGE_MS).toISOString()
    const young = new Date(NOW.getTime() - MIN_AGE_MS + 1).toISOString()
    expect(eligibleCandidates([cand('a', edge), cand('b', young)], EMPTY_MEMORY, NOW).map((c) => c.id)).toEqual(['a'])
  })

  it('하루(KST) 1번 - 오늘 이미 떨어졌으면 없음 · 다음 날 다시', () => {
    const c = [cand('a', '2026-09-01T09:00:00+09:00')]
    const plan = planMeteor({ ...base, candidates: c })
    expect(plan?.candidate.id).toBe('a')
    const dropped = markDropped(EMPTY_MEMORY, kstDay(NOW))
    expect(planMeteor({ ...base, candidates: c, memory: dropped })).toBeNull()
    const tomorrow = new Date(NOW.getTime() + 24 * 3_600_000)
    expect(planMeteor({ ...base, candidates: c, memory: dropped, now: tomorrow })?.candidate.id).toBe('a')   // 놓친 말은 다음 날 다시 후보
    // KST 자정 경계: 23:59와 00:00은 다른 날
    expect(kstDay(new Date('2026-10-20T23:59:00+09:00'))).toBe('2026-10-20')
    expect(kstDay(new Date('2026-10-21T00:00:00+09:00'))).toBe('2026-10-21')
  })

  it('잡은 말은 다시 0 - 후보가 그 말뿐이면 다음 날에도 없다', () => {
    const c = [cand('a', '2026-09-01T09:00:00+09:00'), cand('b', '2026-09-02T09:00:00+09:00')]
    const caught = markCaught(EMPTY_MEMORY, 'a')
    expect(eligibleCandidates(c, caught, NOW).map((x) => x.id)).toEqual(['b'])
    expect(planMeteor({ ...base, candidates: [c[0]], memory: markCaught(EMPTY_MEMORY, 'a') })).toBeNull()
    expect(markCaught(caught, 'a')).toBe(caught)                                  // 같은 말을 두 번 넣지 않는다
  })

  it('후보 0 · 설정 끔 · 빈 원문 -> 없음', () => {
    expect(planMeteor({ ...base, candidates: [] })).toBeNull()
    expect(planMeteor({ ...base, candidates: [cand('a', '2026-09-01T09:00:00+09:00')], enabled: false })).toBeNull()
    expect(planMeteor({ ...base, candidates: [cand('a', '2026-09-01T09:00:00+09:00', '  ')] })).toBeNull()
  })

  it('결정적 - 같은 날 다시 열어도 같은 말 · 4~10초 · 25~35°', () => {
    const c = ['a', 'b', 'c', 'd', 'e'].map((id, i) => cand(id, `2026-09-0${i + 1}T09:00:00+09:00`))
    const p1 = planMeteor({ ...base, candidates: c })
    const p2 = planMeteor({ ...base, candidates: [...c].reverse() })
    expect(p1).toEqual(p2)
    for (let d = 0; d < 30; d++) {
      const p = planMeteor({ ...base, candidates: c, now: new Date(NOW.getTime() + d * 86_400_000) })!
      expect(p.delayMs).toBeGreaterThanOrEqual(4000)
      expect(p.delayMs).toBeLessThanOrEqual(10000)
      expect(p.angleDeg).toBeGreaterThanOrEqual(25)
      expect(p.angleDeg).toBeLessThanOrEqual(35)
    }
  })

  it('누를 수 있는 시간 3초 · 줄인 모션 5.2초 · C03 출처 줄은 24시간 표기', () => {
    expect(pressableMs(false)).toBe(3000)
    expect(pressableMs(true)).toBe(5200)
    expect(fallenMeta('서영', '2026-09-18T23:12:00+09:00')).toBe('서영 · 9월 18일 23:12')
  })
})

// ---------------------------------------------------------------------------
// 읽기
// ---------------------------------------------------------------------------

describe('84-e 유성 후보 읽기 - 지금 살아 있는 메시지 행', () => {
  it('한 줄 선택(sub)만 - 대화 턴은 후보가 아니다', () => {
    const refs = subRefsOf([corner([sub({ messageId: 'm1', speaker: '서영', at: '2026-09-01T09:00:00+09:00' })])])
    expect(refs).toEqual([{ messageId: 'm1', speaker: '서영', at: '2026-09-01T09:00:00+09:00' }])
  })

  it('id로 읽고 · 옛 호(id 없음)는 보낸 사람 + 시각(그 초 안)으로 · 숨김 · 탈퇴로 행이 없으면 건너뜀 · 원문은 행의 것', async () => {
    const calls: Call[] = []
    const db = fakeDb({
      corners: [
        corner([
          sub({ messageId: 'm1', speaker: '서영', at: '2026-09-01T09:00:00+09:00' }),
          sub({ messageId: 'm-hidden', speaker: '서영', at: '2026-09-02T09:00:00+09:00' }),
          sub({ messageId: 'm-gone', speaker: '세준', at: '2026-09-03T09:00:00+09:00' }),
        ]),
        corner([
          sub({ speaker: '서영', at: '2026-08-11T23:40:00+09:00' }),                     // 84-e 전 호 - id 없음
          sub({ speaker: '세준', at: '2026-08-12T08:00:00+09:00' }),                     // 그 시각에 세준의 말이 없다 -> 건너뜀
        ]),
        corner([sub({ messageId: 'm-ready', speaker: '서영', at: '2026-09-05T09:00:00+09:00' })], 'ready'),   // 발행 전 - 후보 아님
      ],
      messages: [
        msg('m1', YOU, '살아 있는 원문', '2026-09-01T09:00:00+09:00'),
        msg('m-hidden', YOU, '숨긴 말', '2026-09-02T09:00:00+09:00', { deleted_at: '2026-10-01T00:00:00Z' }),
        msg('old', YOU, '옛 호의 말', '2026-08-11T14:40:00.250Z'),
        msg('other', ME, '같은 초 다른 사람', '2026-08-11T14:40:00.500Z'),
        msg('m-ready', YOU, '발행 전', '2026-09-05T09:00:00+09:00'),
      ],
    }, calls)
    const out = await fetchMeteorCandidates(db, COUPLE, NAMES)
    expect(out.map((c) => [c.id, c.body])).toEqual([['m1', '살아 있는 원문'], ['old', '옛 호의 말']])
    expect(calls.every((c) => c.ops[0] === 'select')).toBe(true)
    expect(calls.filter((c) => c.table === 'corners').every((c) => c.ops.filter((o) => o === 'eq').length === 3)).toBe(true)
  })
})

describe('84-e 하늘은 읽기 전용 - 정적', () => {
  it('유성 코드에 서버 쓰기 · RPC 호출이 없다', () => {
    for (const f of ['Meteor.tsx', 'meteorData.ts', 'meteorRules.ts']) {
      const src = readFileSync(join(__dirname, f), 'utf8')
      expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/)
    }
  })
})

// ---------------------------------------------------------------------------
// 화면 - C01 유성 -> C03
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({ data: null as unknown, reduced: false, db: null as unknown }))
vi.mock('./skyData', () => ({
  useSky: () => hoisted.data,
  useSkyNames: () => ({ u1: '세준', p1: '서영' }),
  useSkyPhotoUrls: () => ({}),
}))
vi.mock('../../platform/motion', () => ({ prefersReducedMotion: () => hoisted.reduced }))
vi.mock('../../auth/client', async (orig) => ({ ...(await orig<object>()), getSupabase: () => hoisted.db }))

const { SkyScreen } = await import('./SkyScreen')

const rec = (id: string, date: string): DayRecord => {
  const stops = [{ id: `${id}s`, seq: 1, arrivedAt: `${date}T10:00:00+09:00`, placeName: '망원' }]
  return { id, date, stops, photos: [], memos: [], counts: { stops: 1, photos: 0, memos: 0 } }
}
const sky = (): SkyData => ({
  loading: false, error: false, records: [rec('r0', '2026-09-14'), rec('r1', '2026-10-03')], allLoaded: true, temps: {}, tempStatus: {}, moons: [],
  draftPeriodStart: null, ensureTemps: vi.fn(),
})
const LONG = '오늘 하루도 정말 고생 많았어. 집에 도착하면 따뜻한 물로 씻고 일찍 자. 내일 아침에 내가 먼저 연락할게.'
function seedDb(calls: Call[] = []) {
  hoisted.db = fakeDb({
    corners: [corner([sub({ messageId: 'm1', speaker: '서영', at: '2026-09-01T21:30:00+09:00' })])],
    messages: [msg('m1', YOU, LONG, '2026-09-01T21:30:00+09:00')],
  }, calls)
}

async function flush(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
/** 후보 읽기(비동기)가 끝나 오늘의 유성 시각이 잡힐 때까지 - 그 뒤에 시계를 민다. */
async function settle() { await flush(); await flush() }

describe('84-e 화면 - C01 유성 · C03 떨어진 말', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    hoisted.data = sky()
    hoisted.reduced = false
    useAuthStore.setState({ userId: ME })
    useCoupleStore.setState({ status: 'connected', coupleId: COUPLE, partnerId: YOU, relationshipStartDate: '2026-01-01', grace: false, graceCoupleId: null, gracePartnerId: null })
    useSkyPrefStore.getState().load(ME)
    seedDb()
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); useSkyPrefStore.setState({ userId: null }) })

  it('4~10초 안에 떨어지고 누르면 C03 - 원문 · 이름 · 시각 · 1 / 1 · 다음 말 흐림 · 채팅에서 보기 없음', async () => {
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush()
    expect(screen.queryByTestId('sky-meteor')).toBeNull()
    await flush(3999)
    expect(screen.queryByTestId('sky-meteor')).toBeNull()                       // 4초 전에는 없다
    await flush(6001)
    const m = screen.getByTestId('sky-meteor')
    expect(m.getAttribute('data-mode')).toBe('fall')
    fireEvent.click(m)
    await flush()
    expect(screen.getByTestId('sky-fallen')).toBeTruthy()
    expect(screen.getByTestId('sky-fallen-text').textContent).toBe(LONG)          // 자르지 않는다
    expect(screen.getByTestId('sky-fallen-meta').textContent).toBe('서영 · 9월 1일 21:30')
    expect(screen.getByTestId('sky-fallen-count').textContent).toBe('1 / 1')
    expect((screen.getByTestId('sky-fallen-next') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/채팅에서 보기/)).toBeNull()
    // 기기에는 메시지 id · 날짜만 - 원문 0
    const all = Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('\n')
    expect(all).not.toContain('고생 많았어')
    expect(readMeteorMemory(ME, COUPLE)).toEqual({ caught: ['m1'], lastDay: '2026-10-20' })
    fireEvent.click(screen.getByTestId('sky-fallen-close'))
    expect(screen.queryByTestId('sky-fallen')).toBeNull()
  })

  it('놓치면(3초) 사라지고 그날은 다시 0 · 다음 날 다시 떨어진다 · 잡은 말은 다음 날 0', async () => {
    const { unmount } = render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(10_000)
    expect(screen.getByTestId('sky-meteor')).toBeTruthy()
    await flush(2999)
    expect(screen.getByTestId('sky-meteor')).toBeTruthy()
    await flush(1)
    expect(screen.queryByTestId('sky-meteor')).toBeNull()                       // 누를 수 있는 시간 3초
    unmount()
    render(<SkyScreen nav={makeFakeNav()} />)                                    // 같은 날 다시 열기
    await settle()
    await flush(12_000)
    expect(screen.queryByTestId('sky-meteor')).toBeNull()
    cleanup()
    vi.setSystemTime(new Date(NOW.getTime() + 86_400_000))                       // 다음 날 - 놓친 말 다시
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(10_000)
    fireEvent.click(screen.getByTestId('sky-meteor'))
    await flush()
    cleanup()
    vi.setSystemTime(new Date(NOW.getTime() + 2 * 86_400_000))                   // 그다음 날 - 잡은 말은 다시 0(후보가 그 말뿐)
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(12_000)
    expect(screen.queryByTestId('sky-meteor')).toBeNull()
  })

  it('줄인 모션 - 제자리 빛 5.2초', async () => {
    hoisted.reduced = true
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(10_000)
    const m = screen.getByTestId('sky-meteor')
    expect(m.getAttribute('data-mode')).toBe('still')
    await flush(5199)
    expect(screen.getByTestId('sky-meteor')).toBeTruthy()
    await flush(1)
    expect(screen.queryByTestId('sky-meteor')).toBeNull()
  })

  it('설정 끔 -> 0 · 후보 0 -> 표시 0', async () => {
    useSkyPrefStore.getState().setMeteor(false)
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(12_000)
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
    cleanup()
    useSkyPrefStore.getState().setMeteor(true)
    hoisted.db = fakeDb({ corners: [], messages: [] })                            // 첫 호 전
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(12_000)
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
  })

  it('숨김 · 탈퇴로 행이 없으면 건너뜀(표시 0)', async () => {
    hoisted.db = fakeDb({
      corners: [corner([sub({ messageId: 'm1', speaker: '서영', at: '2026-09-01T21:30:00+09:00' })])],
      messages: [msg('m1', YOU, LONG, '2026-09-01T21:30:00+09:00', { deleted_at: '2026-10-10T00:00:00Z' })],
    })
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(12_000)
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
  })

  it('지난 하늘(C02)에서는 0 - 위로 끌어 지난 달에 머물면 떨어지지 않는다', async () => {
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush()
    const el = screen.getByTestId('sky-scroll')
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 800 })
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 2400 })
    el.scrollTop = 0
    fireEvent.scroll(el)
    await settle()
    await flush(12_000)
    expect(screen.getByTestId('sky-screen').getAttribute('data-view')).toBe('past')
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
  })

  it('네트워크 쓰기 0(런타임) - 유성이 떨어지고 잡히는 동안 질의는 select뿐', async () => {
    const calls: Call[] = []
    seedDb(calls)
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    await flush(10_000)
    fireEvent.click(screen.getByTestId('sky-meteor'))
    await flush()
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => c.ops[0] === 'select')).toBe(true)
  })
  it('C08 둘러보기(끌기)에서도 떨어진다', async () => {
    render(<SkyScreen nav={makeFakeNav()} />)
    await settle()
    fireEvent.click(screen.getByTestId('sky-tour-open'))
    await flush()
    expect(screen.getByTestId('sky-tour')).toBeTruthy()
    await flush(10_000)
    expect(screen.getByTestId('sky-meteor')).toBeTruthy()
  })
})

describe('84-e 기기 저장 - 메시지 id만 · 지우는 때', () => {
  afterEach(() => localStorage.clear())
  it('해제 완료(clearCoupleCache)는 유성 기록을 지우고 사람 설정(유성 줄 값)은 남긴다 - 범주 이름 정확 일치', () => {
    writeMeteorMemory(ME, COUPLE, { caught: ['m1'], lastDay: '2026-10-20' })
    writeCache(ME, 'skypref', { on: false }, 'meteor')
    clearCoupleCache(ME)
    expect(readMeteorMemory(ME, COUPLE)).toEqual(EMPTY_MEMORY)
    expect(readCache(ME, 'skypref', 'meteor')).toEqual({ on: false })
  })
  it('계정 전환 · 로그아웃이면 처음부터', () => {
    writeMeteorMemory(ME, COUPLE, { caught: ['m1'], lastDay: null })
    purgeOtherUsers('someone-else')
    expect(readMeteorMemory(ME, COUPLE)).toEqual(EMPTY_MEMORY)
    writeMeteorMemory(ME, COUPLE, { caught: ['m1'], lastDay: null })
    clearAllDeviceCache()
    expect(readMeteorMemory(ME, COUPLE)).toEqual(EMPTY_MEMORY)
  })
  it('원문 칸을 넣어 써도 저장되는 것은 id · 날짜뿐', () => {
    writeMeteorMemory(ME, COUPLE, { caught: ['m1'], lastDay: null, body: '원문' } as never)
    expect(Object.values(localStorage).join('')).not.toContain('원문')
  })
})
