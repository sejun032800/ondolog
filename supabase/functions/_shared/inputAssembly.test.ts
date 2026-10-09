/// <reference types="jest" />
/**
 * 입력 조립 (docs/ONDOLOG_MASTER.md §17-0-9, r49).
 * 위임: .claude/state/prompts/phase-7/44-corner-pipeline-input-assembly-r2.md
 *
 * 골격(`runCornerModule`)의 호출 전 단언을 거치지 않는다 - 입력 조립의 반환값과 던지는 오류만 본다.
 */

import { CoupleMembershipError, isRecordInPeriod, type CornerContext } from './cornerPipeline.ts'
import { assembleCornerInput, type AssemblyRow } from './inputAssembly.ts'
import { fakeClient, type LoggedQuery } from './testFixtures/inputAssemblyFake.ts'
import { AUG_END, AUG_START, COUPLE_A, COUPLE_B, MONTHLY_CONTEXT } from './testFixtures/cornerFixtures.ts'

// ---------------------------------------------------------------------------
// 데이터 도우미
// ---------------------------------------------------------------------------

const PROFILES: AssemblyRow[] = [
  { id: 'u1', display_name: '세준' },
  { id: 'u2', display_name: '서영' },
]

function message(id: string, sentAt: string, body: string | null, over: AssemblyRow = {}): AssemblyRow {
  return { id, couple_id: COUPLE_A, sender_id: 'u1', body, sent_at: sentAt, deleted_at: null, ...over }
}

function dateRow(id: string, dateOn: string, over: AssemblyRow = {}): AssemblyRow {
  return {
    id,
    couple_id: COUPLE_A,
    date_on: dateOn,
    region: '연남동',
    photo_count: 0,
    last_featured_at: null,
    deleted_at: null,
    ...over,
  }
}

function stopRow(id: string, dateId: string, seq: number, arrivedAt: string, over: AssemblyRow = {}): AssemblyRow {
  return { id, couple_id: COUPLE_A, date_id: dateId, seq, arrived_at: arrivedAt, place_name: '카페', lat: null, lng: null, ...over }
}

function entryRow(id: string, over: AssemblyRow = {}): AssemblyRow {
  return {
    id,
    couple_id: COUPLE_A,
    author_id: 'u1',
    date_id: null,
    date_stop_id: null,
    entry_type: 'photo',
    storage_path: `p/${id}.jpg`,
    thumb_path: null,
    width: 100,
    height: 80,
    text_content: null,
    drawing_path: null,
    captured_at: null,
    created_at: '2026-08-01T00:00:00+09:00',
    access_locked: false,
    deleted_at: null,
    ...over,
  }
}

function tables(over: Record<string, AssemblyRow[]> = {}, tier: 'free' | 'paid' = 'free'): Record<string, AssemblyRow[]> {
  return {
    couples: [
      { id: COUPLE_A, subscription_tier: tier },
      { id: COUPLE_B, subscription_tier: 'free' },
    ],
    profiles: PROFILES,
    messages: [],
    dates: [],
    date_stops: [],
    data_entries: [],
    ...over,
  }
}

const AUG_DAY = (d: string) => `2026-08-${d}`

// ---------------------------------------------------------------------------
// 범위 1·2 - 채팅·사진·데이트가 각각 레코드로 나오고 네 필드가 채워진다
// ---------------------------------------------------------------------------

describe('조회와 레코드 - 채팅·사진·데이트', () => {
  const data = tables({
    messages: [
      message('m-1', '2026-08-22T09:20:00+09:00', '오늘 비 온대. 우산 챙겼어?'),
      message('m-2', '2026-08-22T09:21:30.250+09:00', '응  챙겼어\n(원문 그대로)', { sender_id: 'u2' }),
    ],
    dates: [dateRow('d-1', AUG_DAY('19'))],
    date_stops: [stopRow('s-1', 'd-1', 0, '2026-08-19T14:20:00+09:00', { lat: '37.5600000', lng: 126.92 })],
    data_entries: [
      entryRow('e-photo', { date_stop_id: 's-1', captured_at: '2026-08-19T14:25:00+09:00', thumb_path: 't/e.jpg' }),
      entryRow('e-memo', { date_stop_id: 's-1', entry_type: 'memo', text_content: '여기 좋았다', author_id: 'u2', storage_path: null, width: null, height: null }),
      entryRow('e-draw', { date_id: 'd-1', entry_type: 'drawing', drawing_path: 'd/e.png', storage_path: null, width: null, height: null }),
      entryRow('e-standalone', { captured_at: '2026-08-10T10:00:00+09:00' }),
    ],
  })

  it('채팅: 원문 그대로, 화자 이름은 프로필, 시각·표기는 KST, recalled false', async () => {
    const { messages } = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(messages.map((m) => m.id)).toEqual(['m-1', 'm-2'])
    const [m1, m2] = messages
    expect(m1.kind).toBe('message')
    expect(m1.coupleId).toBe(COUPLE_A)
    expect(m1.recalled).toBe(false)
    expect(m1.occurredAt.getTime()).toBe(Date.parse('2026-08-22T09:20:00+09:00'))
    expect(m1.source).toEqual({
      speaker: '세준',
      text: '오늘 비 온대. 우산 챙겼어?',
      at: '2026-08-22T09:20:00+09:00',
      attribution: { display: '2026.08.22 09:20, 아침 대화 중', at: '2026-08-22T09:20:00+09:00', source: 'chat' },
    })
    expect(m2.source.speaker).toBe('서영')
    expect(m2.source.text).toBe('응  챙겼어\n(원문 그대로)')
    expect(m2.source.at).toBe('2026-08-22T09:21:30.250+09:00')
  })

  it('사진: 기간 안 촬영분과 데이트에 묶인 사진이 각각 레코드가 된다(기간 밖 촬영은 레코드가 아니다)', async () => {
    const { photos } = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(photos.map((p) => p.id)).toEqual(['e-standalone', 'e-photo'])
    const standalone = photos[0]
    expect(standalone.kind).toBe('photo')
    expect(standalone.recalled).toBe(false)
    expect(standalone.source).toEqual({ path: 'p/e-standalone.jpg', at: '2026-08-10T10:00:00+09:00' })
  })

  it('데이트: 날짜는 KST 00:00, 정거장 시각 "14:20", 사진·유저 기록은 정거장에, 데이트에만 묶인 것은 dateLevel에', async () => {
    const { dates } = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(dates).toHaveLength(1)
    const d = dates[0]
    expect(d.kind).toBe('date')
    expect(d.recalled).toBe(false)
    expect(d.occurredAt.getTime()).toBe(Date.parse('2026-08-19T00:00:00+09:00'))
    expect(d.source.dateOn).toBe('2026-08-19')
    expect(d.source.recallReason).toBeNull()
    expect(d.source.stops).toEqual([
      {
        seq: 0,
        time: '14:20',
        placeName: '카페',
        lat: 37.56,
        lng: 126.92,
        photos: [
          { path: 'p/e-photo.jpg', thumbPath: 't/e.jpg', width: 100, height: 80, capturedAt: '2026-08-19T14:25:00+09:00' },
        ],
        userNotes: [{ authorId: 'u2', authorName: '서영', type: 'memo', text: '여기 좋았다' }],
      },
    ])
    expect(d.source.dateLevel).toEqual({
      photos: [],
      userNotes: [{ authorId: 'u1', authorName: '세준', type: 'drawing', path: 'd/e.png' }],
    })
  })

  it('records는 messages·photos·dates를 이은 것이고, 모든 레코드의 기간 판정은 isRecordInPeriod와 같다', async () => {
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.records).toHaveLength(r.messages.length + r.photos.length + r.dates.length)
    for (const rec of r.records) expect(isRecordInPeriod(rec, MONTHLY_CONTEXT.period)).toBe(true)
  })

  it('프로필 행이 없는 화자는 무결성 오류로 던진다', async () => {
    const broken = tables({ messages: [message('m-1', '2026-08-22T09:20:00+09:00', '안녕', { sender_id: 'ghost' })] })
    await expect(assembleCornerInput(fakeClient(broken), MONTHLY_CONTEXT)).rejects.toThrow(/profiles/)
  })

  it('삭제된 행(deleted_at)은 빠진다', async () => {
    const d = tables({
      messages: [message('m-x', '2026-08-22T09:20:00+09:00', '삭제됨', { deleted_at: '2026-08-23T00:00:00+09:00' })],
      dates: [dateRow('d-x', AUG_DAY('19'), { deleted_at: '2026-08-23T00:00:00+09:00' })],
    })
    const r = await assembleCornerInput(fakeClient(d), MONTHLY_CONTEXT)
    expect(r.records).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// §17-0-9-F - 제외와 건수
// ---------------------------------------------------------------------------

describe('필드 채우기와 사유별 제외 건수 (F)', () => {
  it('본문 없는 미디어 메시지·크기 없는 사진·시각 없는 독립 사진을 빼고 센다', async () => {
    const d = tables({
      messages: [message('m-1', '2026-08-22T09:20:00+09:00', null), message('m-2', '2026-08-22T09:30:00+09:00', '안녕')],
      dates: [dateRow('d-1', AUG_DAY('19'))],
      date_stops: [stopRow('s-1', 'd-1', 0, '2026-08-19T14:20:00+09:00')],
      data_entries: [
        entryRow('e-nosize', { captured_at: '2026-08-10T10:00:00+09:00', width: null }),
        entryRow('e-nosize-stop', { date_stop_id: 's-1', height: null }),
        entryRow('e-untimed'),
        entryRow('e-ok', { captured_at: '2026-08-11T10:00:00+09:00' }),
      ],
    })
    const r = await assembleCornerInput(fakeClient(d), MONTHLY_CONTEXT)
    expect(r.messages.map((m) => m.id)).toEqual(['m-2'])
    expect(r.photos.map((p) => p.id)).toEqual(['e-ok'])
    expect(r.dates[0].source.stops[0].photos).toEqual([])
    expect(r.exclusions).toEqual({
      messagesWithoutBody: 1,
      standalonePhotosWithoutTime: 1,
      photosWithoutSize: 2,
      lockedEntries: 0,
    })
  })

  it('captured_at이 null인 사진: 데이트에 묶인 것은 데이트를 따르고, 묶이지 않은 것은 빠진다(업로드 시각으로 대체하지 않는다)', async () => {
    const d = tables({
      dates: [dateRow('d-1', AUG_DAY('19'))],
      date_stops: [stopRow('s-1', 'd-1', 0, '2026-08-19T14:20:00+09:00')],
      data_entries: [
        entryRow('e-by-stop', { date_stop_id: 's-1', created_at: '2026-09-30T00:00:00+09:00' }),
        entryRow('e-by-date', { date_id: 'd-1', created_at: '2026-09-30T00:00:00+09:00' }),
        entryRow('e-loose', { created_at: '2026-08-15T00:00:00+09:00' }),
      ],
    })
    const r = await assembleCornerInput(fakeClient(d), MONTHLY_CONTEXT)
    const byId = new Map(r.photos.map((p) => [p.id, p]))
    expect([...byId.keys()].sort()).toEqual(['e-by-date', 'e-by-stop'])
    expect(byId.get('e-by-stop')?.occurredAt.getTime()).toBe(Date.parse('2026-08-19T00:00:00+09:00'))
    expect(byId.get('e-by-stop')?.source.at).toBe('2026-08-19T00:00:00+09:00')
    expect(r.exclusions.standalonePhotosWithoutTime).toBe(1)
  })

  it('정거장·유저 기록 묶기: date_stop_id 우선, 없으면 date_id(데이트 단위), 둘 다 없으면 독립', async () => {
    const d = tables({
      dates: [dateRow('d-1', AUG_DAY('19'))],
      date_stops: [stopRow('s-1', 'd-1', 0, '2026-08-19T14:20:00+09:00')],
      data_entries: [
        // 둘 다 있으면 정거장 단위로만 붙는다
        entryRow('both', { date_id: 'd-1', date_stop_id: 's-1', captured_at: '2026-08-19T14:30:00+09:00' }),
        entryRow('date-only', { date_id: 'd-1', captured_at: '2026-08-19T15:00:00+09:00' }),
      ],
    })
    const [date] = (await assembleCornerInput(fakeClient(d), MONTHLY_CONTEXT)).dates
    expect(date.source.stops[0].photos.map((p) => p.path)).toEqual(['p/both.jpg'])
    expect(date.source.dateLevel?.photos.map((p) => p.path)).toEqual(['p/date-only.jpg'])
  })

  it('정거장은 seq 순, 같은 정거장의 사진은 촬영 시각 순(시각 없는 것은 뒤)', async () => {
    const d = tables({
      dates: [dateRow('d-1', AUG_DAY('19'))],
      date_stops: [
        stopRow('s-2', 'd-1', 1, '2026-08-19T16:00:00+09:00'),
        stopRow('s-1', 'd-1', 0, '2026-08-19T14:20:00+09:00'),
      ],
      data_entries: [
        entryRow('p-null', { date_stop_id: 's-1' }),
        entryRow('p-late', { date_stop_id: 's-1', captured_at: '2026-08-19T14:40:00+09:00' }),
        entryRow('p-early', { date_stop_id: 's-1', captured_at: '2026-08-19T14:30:00+09:00' }),
      ],
    })
    const [date] = (await assembleCornerInput(fakeClient(d), MONTHLY_CONTEXT)).dates
    expect(date.source.stops.map((s) => s.seq)).toEqual([0, 1])
    expect(date.source.stops[0].photos.map((p) => p.path)).toEqual(['p/p-early.jpg', 'p/p-late.jpg', 'p/p-null.jpg'])
  })
})

// ---------------------------------------------------------------------------
// §17-0-9-A - 커플 분리는 조회 단계에서
// ---------------------------------------------------------------------------

describe('커플 분리 (A)', () => {
  const full = tables({
    messages: [message('m-1', '2026-08-22T09:20:00+09:00', '안녕')],
    dates: [dateRow('d-1', AUG_DAY('19'))],
    date_stops: [stopRow('s-1', 'd-1', 0, '2026-08-19T14:20:00+09:00')],
    data_entries: [entryRow('e-1', { captured_at: '2026-08-10T10:00:00+09:00' })],
  })

  function hasFilter(q: LoggedQuery, op: string, column: string, value?: unknown): boolean {
    return q.filters.some((f) => f.op === op && f.column === column && (value === undefined || f.value === value))
  }

  it('모든 쿼리가 couple_id = 맥락 커플을 건다 (profiles는 couple_id 컬럼이 없어 id로만, couples는 id)', async () => {
    const client = fakeClient(full)
    await assembleCornerInput(client, MONTHLY_CONTEXT)
    for (const q of client.log) {
      if (q.table === 'couples') expect(hasFilter(q, 'eq', 'id', COUPLE_A)).toBe(true)
      else if (q.table === 'profiles') expect(hasFilter(q, 'in', 'id')).toBe(true)
      else expect(hasFilter(q, 'eq', 'couple_id', COUPLE_A)).toBe(true)
    }
    expect(new Set(client.log.map((q) => q.table))).toEqual(
      new Set(['couples', 'messages', 'dates', 'date_stops', 'data_entries', 'profiles']),
    )
  })

  it('deleted_at 컬럼이 있는 테이블(messages·dates·data_entries)은 모두 deleted_at is null을 건다', async () => {
    const client = fakeClient(full)
    await assembleCornerInput(client, MONTHLY_CONTEXT)
    for (const q of client.log.filter((l) => ['messages', 'dates', 'data_entries'].includes(l.table))) {
      expect(hasFilter(q, 'is', 'deleted_at', null)).toBe(true)
    }
  })

  it('data_entries: 무료 커플은 access_locked = false를 건다(is_entry_visible과 같은 결과). 잠금 건수 보조 쿼리만 true', async () => {
    const client = fakeClient(full)
    await assembleCornerInput(client, MONTHLY_CONTEXT)
    const entryQueries = client.log.filter((l) => l.table === 'data_entries')
    expect(entryQueries.length).toBeGreaterThan(0)
    const counting = entryQueries.filter((q) => hasFilter(q, 'eq', 'access_locked', true))
    const reading = entryQueries.filter((q) => !hasFilter(q, 'eq', 'access_locked', true))
    expect(counting.length).toBeGreaterThan(0)
    for (const q of reading) expect(hasFilter(q, 'eq', 'access_locked', false)).toBe(true)
    for (const q of counting) expect(q.columns).toBe('id, couple_id')
  })

  it('data_entries: 유료 커플은 열람 가능 판정이 전부 통과이므로 access_locked 필터가 없다', async () => {
    const client = fakeClient({ ...full, couples: [{ id: COUPLE_A, subscription_tier: 'paid' }] })
    await assembleCornerInput(client, MONTHLY_CONTEXT)
    for (const q of client.log.filter((l) => l.table === 'data_entries')) {
      expect(q.filters.some((f) => f.column === 'access_locked')).toBe(false)
    }
  })

  it('다른 커플의 행이 같이 있어도 결과에는 없다 (필터가 걸린 정상 클라이언트)', async () => {
    const mixed = tables({
      messages: [message('m-a', '2026-08-22T09:20:00+09:00', 'A'), message('m-b', '2026-08-22T09:20:00+09:00', 'B', { couple_id: COUPLE_B })],
      dates: [dateRow('d-a', AUG_DAY('19')), dateRow('d-b', AUG_DAY('19'), { couple_id: COUPLE_B })],
      data_entries: [
        entryRow('e-a', { captured_at: '2026-08-10T10:00:00+09:00' }),
        entryRow('e-b', { captured_at: '2026-08-10T10:00:00+09:00', couple_id: COUPLE_B }),
      ],
    })
    const r = await assembleCornerInput(fakeClient(mixed), MONTHLY_CONTEXT)
    expect(r.records.map((x) => x.id).sort()).toEqual(['d-a', 'e-a', 'm-a'])
    expect(r.records.every((x) => x.coupleId === COUPLE_A)).toBe(true)
  })

  describe('결과 재확인 - 오염된 클라이언트(couple_id 필터를 무시)가 두 커플의 행을 섞어 돌려줘도 CoupleMembershipError', () => {
    const cases: ReadonlyArray<[string, Record<string, AssemblyRow[]>, string]> = [
      ['messages', tables({ messages: [message('m-a', '2026-08-22T09:20:00+09:00', 'A'), message('m-b', '2026-08-22T09:20:00+09:00', 'B', { couple_id: COUPLE_B })] }), 'm-b'],
      ['dates', tables({ dates: [dateRow('d-a', AUG_DAY('19')), dateRow('d-b', AUG_DAY('20'), { couple_id: COUPLE_B })] }), 'd-b'],
      [
        'date_stops',
        tables({
          dates: [dateRow('d-a', AUG_DAY('19'))],
          date_stops: [stopRow('s-b', 'd-a', 0, '2026-08-19T14:20:00+09:00', { couple_id: COUPLE_B })],
        }),
        's-b',
      ],
      [
        'data_entries',
        tables({ data_entries: [entryRow('e-b', { captured_at: '2026-08-10T10:00:00+09:00', couple_id: COUPLE_B })] }),
        'e-b',
      ],
    ]
    it.each(cases)('%s', async (_table, data, offendingId) => {
      const client = fakeClient(data, { leakAcrossCouples: true })
      const error = await assembleCornerInput(client, MONTHLY_CONTEXT).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(CoupleMembershipError)
      expect((error as CoupleMembershipError).expectedCoupleId).toBe(COUPLE_A)
      expect((error as CoupleMembershipError).offendingRecordIds).toContain(offendingId)
    })

    it('재소환 후보 조회(과거 데이트)에서도 마찬가지다', async () => {
      const data = tables({ dates: [dateRow('d-old-b', '2025-08-10', { couple_id: COUPLE_B })] })
      const error = await assembleCornerInput(fakeClient(data, { leakAcrossCouples: true }), MONTHLY_CONTEXT).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(CoupleMembershipError)
    })
  })
})

// ---------------------------------------------------------------------------
// §17-0-9-B - 쿼리 범위는 기간보다 좁지 않다
// ---------------------------------------------------------------------------

describe('기간 경계 (B)', () => {
  it('채팅·사진: 시작 정각은 안, 끝 정각은 밖, 끝 1ms 전은 안 - 쿼리 결과와 isRecordInPeriod 판정이 어긋나지 않는다', async () => {
    const endMinus1 = new Date(AUG_END.getTime() - 1).toISOString()
    const d = tables({
      messages: [
        message('m-start', AUG_START.toISOString(), 'start'),
        message('m-before', new Date(AUG_START.getTime() - 1).toISOString(), 'before'),
        message('m-last', endMinus1, 'last'),
        message('m-end', AUG_END.toISOString(), 'end'),
      ],
      data_entries: [
        entryRow('p-start', { captured_at: AUG_START.toISOString() }),
        entryRow('p-last', { captured_at: endMinus1 }),
        entryRow('p-end', { captured_at: AUG_END.toISOString() }),
      ],
    })
    const r = await assembleCornerInput(fakeClient(d), MONTHLY_CONTEXT)
    expect(r.messages.map((m) => m.id)).toEqual(['m-start', 'm-last'])
    expect(r.photos.map((p) => p.id)).toEqual(['p-start', 'p-last'])
    for (const rec of r.records) expect(isRecordInPeriod(rec, MONTHLY_CONTEXT.period)).toBe(true)
  })

  it('데이트: 시작 날짜는 안, 끝 날짜(KST 자정이 끝)는 밖', async () => {
    const d = tables({ dates: [dateRow('d-first', '2026-08-01'), dateRow('d-last', '2026-08-31'), dateRow('d-next', '2026-09-01'), dateRow('d-prev', '2026-07-31')] })
    const r = await assembleCornerInput(fakeClient(d), { ...MONTHLY_CONTEXT, coupleId: COUPLE_A })
    // 이번 기간 2건이면 재소환 1건이 더해지지만, 이 시험은 이번 기간 데이트만 본다.
    expect(r.dates.filter((x) => x.recalled === false).map((x) => x.id)).toEqual(['d-first', 'd-last'])
  })

  it('끝 시각이 자정이 아닐 때: 그 날짜의 KST 자정은 끝보다 이르므로 안이다 - 쿼리 상한이 좁으면 빠진다', async () => {
    const context: CornerContext = {
      ...MONTHLY_CONTEXT,
      period: { start: new Date('2026-08-01T10:00:00+09:00'), end: new Date('2026-09-01T10:00:00+09:00') },
    }
    const d = tables({
      dates: [dateRow('d-1st', '2026-09-01'), dateRow('d-aug1', '2026-08-01'), dateRow('d-aug2', '2026-08-02')],
    })
    const r = await assembleCornerInput(fakeClient(d), context)
    // 2026-08-01 자정은 시작(10:00)보다 이르므로 밖, 2026-09-01 자정은 끝(10:00)보다 이르므로 안.
    expect(r.dates.filter((x) => x.recalled === false).map((x) => x.id)).toEqual(['d-aug2', 'd-1st'])
    for (const rec of r.dates.filter((x) => x.recalled === false)) expect(isRecordInPeriod(rec, context.period)).toBe(true)
  })

  it('쿼리의 gte/lt는 context.period 경계를 그대로 쓴다(채팅·사진: 순간, 데이트: KST 날짜)', async () => {
    const client = fakeClient(tables())
    await assembleCornerInput(client, MONTHLY_CONTEXT)
    const messagesQuery = client.log.find((q) => q.table === 'messages')
    expect(messagesQuery?.filters).toEqual(
      expect.arrayContaining([
        { op: 'gte', column: 'sent_at', value: AUG_START.toISOString() },
        { op: 'lt', column: 'sent_at', value: AUG_END.toISOString() },
      ]),
    )
    const periodDates = client.log.find((q) => q.table === 'dates' && q.filters.some((f) => f.column === 'date_on' && f.op === 'gte'))
    expect(periodDates?.filters).toEqual(
      expect.arrayContaining([
        { op: 'gte', column: 'date_on', value: '2026-08-01' },
        { op: 'lt', column: 'date_on', value: '2026-09-01' },
      ]),
    )
  })
})

// ---------------------------------------------------------------------------
// §17-0-9-C - 17-1 재소환
// ---------------------------------------------------------------------------

describe('재소환 (C)', () => {
  /** 기간(2026-08) 이전 데이트 풀. 각각 사진 1장을 갖는다. */
  const past = {
    dates: [
      dateRow('anniv-1y', '2025-08-10'),
      dateRow('anniv-2y', '2024-08-05'),
      dateRow('never-a', '2026-03-01', { photo_count: 5 }),
      dateRow('never-b', '2026-04-01', { photo_count: 9 }),
      dateRow('sparse', '2025-11-01', { last_featured_at: '2025-12-01T00:00:00+09:00' }),
    ],
  }
  const photoOf = (dateId: string) => entryRow(`ph-${dateId}`, { date_id: dateId, captured_at: '2026-01-01T00:00:00+09:00' })
  const pastEntries = past.dates.map((d) => photoOf(String(d.id)))

  function periodDates(n: number): AssemblyRow[] {
    return Array.from({ length: n }, (_, i) => dateRow(`now-${i + 1}`, `2026-08-0${i + 1}`))
  }

  it.each([
    [0, 3],
    [1, 2],
    [2, 1],
    [3, 0],
    [4, 0],
  ])('이번 기간 데이트가 %i건이면 재소환은 %i건 (max(0, 3-n))', async (n, expected) => {
    const data = tables({ dates: [...periodDates(n), ...past.dates], data_entries: pastEntries })
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.dates.filter((d) => d.recalled === true)).toHaveLength(expected)
    expect(r.dates.filter((d) => d.recalled === false)).toHaveLength(n)
  })

  it('우선순위와 recallReason이 1:1이다 - ① anniversary(N 작은 순) ② never_featured(photo_count 내림) ③ sparse_month', async () => {
    const data = tables({ dates: past.dates, data_entries: pastEntries })
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.dates.map((d) => [d.id, d.source.recallReason])).toEqual([
      ['anniv-1y', 'anniversary'],
      ['anniv-2y', 'anniversary'],
      ['never-b', 'never_featured'],
    ])
    for (const d of r.dates) {
      expect(d.recalled).toBe(true)
      expect(isRecordInPeriod(d, MONTHLY_CONTEXT.period)).toBe(true) // 재소환은 기간 이전
    }
  })

  it('③은 ①②가 모자랄 때 채운다 - last_featured_at 오름차순', async () => {
    const data = tables({
      dates: [
        dateRow('s-new', '2025-10-01', { last_featured_at: '2026-01-10T00:00:00+09:00' }),
        dateRow('s-old', '2025-09-01', { last_featured_at: '2025-12-01T00:00:00+09:00' }),
        dateRow('s-mid', '2025-09-15', { last_featured_at: '2025-12-20T00:00:00+09:00' }),
      ],
      data_entries: ['s-new', 's-old', 's-mid'].map(photoOf),
    })
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.dates.map((d) => [d.id, d.source.recallReason])).toEqual([
      ['s-old', 'sparse_month'],
      ['s-mid', 'sparse_month'],
      ['s-new', 'sparse_month'],
    ])
  })

  it('①이 ②보다 앞선다 - 한 번도 실리지 않았어도 기념일 근접이면 anniversary', async () => {
    const data = tables({
      dates: [dateRow('plain-never', '2026-05-01', { photo_count: 99 }), dateRow('anniv', '2025-08-20')],
      data_entries: ['plain-never', 'anniv'].map(photoOf),
    })
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.dates.map((d) => [d.id, d.source.recallReason])).toEqual([
      ['anniv', 'anniversary'],
      ['plain-never', 'never_featured'],
    ])
  })

  it('같은 순위의 동률은 규칙대로 갈린다 - ② photo_count 같으면 date_on 내림차순 -> id', async () => {
    const data = tables({
      dates: [
        dateRow('n-b', '2026-04-01', { photo_count: 3 }),
        dateRow('n-a', '2026-04-01', { photo_count: 3 }),
        dateRow('n-late', '2026-05-01', { photo_count: 3 }),
      ],
      data_entries: ['n-b', 'n-a', 'n-late'].map(photoOf),
    })
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.dates.map((d) => d.id)).toEqual(['n-late', 'n-a', 'n-b'])
  })

  describe('후보 조건 넷', () => {
    it('1. date_on이 기간 시작 이전: 기간 안·이후 데이트는 재소환이 아니다', async () => {
      const data = tables({
        dates: [dateRow('before', '2026-07-31'), dateRow('after', '2026-09-05')],
        data_entries: ['before', 'after'].map(photoOf),
      })
      const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
      expect(r.dates.map((d) => d.id)).toEqual(['before'])
    })

    it('2. 삭제된 데이트는 후보가 아니다', async () => {
      const data = tables({
        dates: [dateRow('gone', '2026-05-01', { deleted_at: '2026-06-01T00:00:00+09:00' }), dateRow('kept', '2026-05-02')],
        data_entries: ['gone', 'kept'].map(photoOf),
      })
      const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
      expect(r.dates.map((d) => d.id)).toEqual(['kept'])
    })

    it('3. 6개월 간격: last_featured_at < 기간 시작 - 6개월 (경계는 포함하지 않는다). feature_count는 보지 않는다', async () => {
      const limit = Date.parse('2026-02-01T00:00:00+09:00')
      const data = tables({
        dates: [
          dateRow('on-limit', '2025-12-01', { last_featured_at: new Date(limit).toISOString() }),
          dateRow('just-before', '2025-12-02', { last_featured_at: new Date(limit - 1).toISOString(), feature_count: 99 }),
          dateRow('recent', '2025-12-03', { last_featured_at: '2026-05-01T00:00:00+09:00' }),
        ],
        data_entries: ['on-limit', 'just-before', 'recent'].map(photoOf),
      })
      const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
      expect(r.dates.map((d) => d.id)).toEqual(['just-before'])
    })

    it('3. 기준 시각은 실행 시각이 아니라 기간 시작이다 - 기간이 달라지면 같은 데이트의 적격 여부가 달라지고, 같은 기간이면 몇 번을 돌려도 같다', async () => {
      const data = tables({
        dates: [dateRow('feb', '2025-12-01', { last_featured_at: '2026-02-15T00:00:00+09:00' })],
        data_entries: [photoOf('feb')],
      })
      const augRun = () => assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
      expect((await augRun()).dates).toEqual([])
      expect((await augRun()).dates).toEqual([])
      const sep: CornerContext = {
        ...MONTHLY_CONTEXT,
        period: { start: new Date('2026-09-01T00:00:00+09:00'), end: new Date('2026-10-01T00:00:00+09:00') },
      }
      // 기간 시작 2026-09-01 - 6개월 = 2026-03-01. 2월 15일 기록은 그보다 이르므로 적격이다.
      expect((await assembleCornerInput(fakeClient(data), sep)).dates.map((d) => d.id)).toEqual(['feb'])
    })

    it('3. 6개월 계산은 KST 달력 기준이다 - 기간 시작이 8월 31일이면 2월 말일로 맞춘다', async () => {
      const ctx: CornerContext = {
        ...MONTHLY_CONTEXT,
        period: { start: new Date('2026-08-31T00:00:00+09:00'), end: new Date('2026-09-01T00:00:00+09:00') },
      }
      const data = tables({
        dates: [
          dateRow('before-limit', '2025-12-01', { last_featured_at: '2026-02-27T23:59:59+09:00' }),
          dateRow('after-limit', '2025-12-02', { last_featured_at: '2026-02-28T00:00:01+09:00' }),
        ],
        data_entries: ['before-limit', 'after-limit'].map(photoOf),
      })
      const r = await assembleCornerInput(fakeClient(data), ctx)
      expect(r.dates.map((d) => d.id)).toEqual(['before-limit'])
    })

    it('4. 열람 가능한 사진이 1장 이상: 사진 없는 데이트는 후보가 아니다. 정거장에 묶인 사진도 센다', async () => {
      const data = tables({
        dates: [dateRow('no-photo', '2026-05-01'), dateRow('stop-photo', '2026-05-02'), dateRow('memo-only', '2026-05-03')],
        date_stops: [stopRow('s-1', 'stop-photo', 0, '2026-05-02T14:00:00+09:00')],
        data_entries: [
          entryRow('ph-stop', { date_stop_id: 's-1' }),
          entryRow('memo', { date_id: 'memo-only', entry_type: 'memo', text_content: '글만', storage_path: null }),
        ],
      })
      const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
      expect(r.dates.map((d) => d.id)).toEqual(['stop-photo'])
      expect(r.dates[0].source.stops[0].photos.map((p) => p.path)).toEqual(['p/ph-stop.jpg'])
    })
  })

  it('재소환 데이트는 정거장·사진·유저 기록을 이번 기간 데이트와 같은 모양으로 싣는다', async () => {
    const data = tables({
      dates: [dateRow('old', '2025-08-10', { region: '성수동' })],
      date_stops: [stopRow('s-old', 'old', 0, '2025-08-10T13:05:00+09:00')],
      data_entries: [
        entryRow('ph-old', { date_stop_id: 's-old', captured_at: '2025-08-10T13:10:00+09:00' }),
        entryRow('note-old', { date_stop_id: 's-old', entry_type: 'memo', text_content: '그때', author_id: 'u2', storage_path: null }),
      ],
    })
    const [d] = (await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)).dates
    expect(d.recalled).toBe(true)
    expect(d.source.region).toBe('성수동')
    expect(d.source.stops[0].time).toBe('13:05')
    expect(d.source.stops[0].photos).toHaveLength(1)
    expect(d.source.stops[0].userNotes).toEqual([{ authorId: 'u2', authorName: '서영', type: 'memo', text: '그때' }])
  })

  it('재소환 사진은 PhotoRecord로 따로 나오지 않는다 (기간 이전이라 기간 판정에서 어긋나므로)', async () => {
    const data = tables({ dates: past.dates, data_entries: pastEntries })
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.photos).toEqual([])
  })

  it('last_featured_at·feature_count를 쓰지 않는다 - dates에 대한 쓰기 호출이 없다(읽기 체인만 존재)', async () => {
    const client = fakeClient(tables({ dates: past.dates, data_entries: pastEntries }))
    // 가짜 클라이언트 자체가 select 체인만 제공한다 - update/upsert가 필요했다면 호출 자체가 실패했을 것이다.
    await expect(assembleCornerInput(client, MONTHLY_CONTEXT)).resolves.toBeDefined()
    expect(Object.keys(client.from('dates'))).toEqual(['select'])
  })

  it('결정론: 같은 입력이면 행의 도착 순서가 달라도 같은 결과', async () => {
    const rows = tables({ dates: past.dates, data_entries: pastEntries })
    const reversed = { ...rows, dates: [...(rows.dates as AssemblyRow[])].reverse(), data_entries: [...(rows.data_entries as AssemblyRow[])].reverse() }
    const a = await assembleCornerInput(fakeClient(rows), MONTHLY_CONTEXT)
    const b = await assembleCornerInput(fakeClient(reversed), MONTHLY_CONTEXT)
    expect(b).toEqual(a)
    expect(await assembleCornerInput(fakeClient(rows), MONTHLY_CONTEXT)).toEqual(a)
  })

  it('재소환까지 거쳐 후보가 없으면 빈 목록 - 있는 만큼만 싣는다', async () => {
    const r = await assembleCornerInput(fakeClient(tables()), MONTHLY_CONTEXT)
    expect(r.records).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// §17-0-9-D - 잠긴 데이터
// ---------------------------------------------------------------------------

describe('잠긴 데이터 (D)', () => {
  const data = tables({
    dates: [dateRow('now-1', AUG_DAY('19')), dateRow('old-locked', '2026-05-01'), dateRow('old-open', '2026-05-02')],
    date_stops: [stopRow('s-1', 'now-1', 0, '2026-08-19T14:20:00+09:00')],
    data_entries: [
      entryRow('lock-range', { captured_at: '2026-08-10T10:00:00+09:00', access_locked: true }),
      entryRow('lock-stop', { date_stop_id: 's-1', access_locked: true, captured_at: '2026-08-19T14:30:00+09:00' }),
      entryRow('lock-note', { date_stop_id: 's-1', entry_type: 'memo', text_content: '잠긴 글', storage_path: null, access_locked: true }),
      entryRow('open-stop', { date_stop_id: 's-1', captured_at: '2026-08-19T14:40:00+09:00' }),
      entryRow('lock-old', { date_id: 'old-locked', captured_at: '2026-05-01T10:00:00+09:00', access_locked: true }),
      entryRow('open-old', { date_id: 'old-open', captured_at: '2026-05-02T10:00:00+09:00' }),
    ],
  })

  it('무료 커플: 이번 기간에서 잠긴 항목이 빠지고 건수로 센다', async () => {
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    expect(r.photos.map((p) => p.id)).toEqual(['open-stop'])
    const stop = r.dates.find((d) => d.id === 'now-1')?.source.stops[0]
    expect(stop?.photos.map((p) => p.path)).toEqual(['p/open-stop.jpg'])
    expect(stop?.userNotes).toEqual([])
    expect(r.exclusions.lockedEntries).toBe(3)
  })

  it('무료 커플: 재소환에서도 빠진다 - 잠긴 사진만 있는 과거 데이트는 후보에서 빠지고, 열려 있는 것만 남는다', async () => {
    const r = await assembleCornerInput(fakeClient(data), MONTHLY_CONTEXT)
    const recalled = r.dates.filter((d) => d.recalled === true)
    expect(recalled.map((d) => d.id)).toEqual(['old-open'])
    expect(JSON.stringify(recalled)).not.toContain('lock-old')
  })

  it('유료 커플: is_entry_visible이 참이므로 잠금 표시가 있어도 열람 가능 - 잠금 건수 0', async () => {
    const paid = { ...data, couples: [{ id: COUPLE_A, subscription_tier: 'paid' }] }
    const r = await assembleCornerInput(fakeClient(paid), MONTHLY_CONTEXT)
    expect(r.photos.map((p) => p.id).sort()).toEqual(['lock-range', 'lock-stop', 'open-stop'])
    expect(r.exclusions.lockedEntries).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 오류 경로
// ---------------------------------------------------------------------------

describe('오류 경로', () => {
  it('맥락 값이 틀리면 조회 전에 멈춘다 (InvalidCornerContextError, 골격과 같은 오류)', async () => {
    const client = fakeClient(tables())
    await expect(assembleCornerInput(client, { ...MONTHLY_CONTEXT, coupleId: '' })).rejects.toBeInstanceOf(CoupleMembershipError)
    await expect(
      assembleCornerInput(client, { ...MONTHLY_CONTEXT, period: { start: AUG_END, end: AUG_START } }),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(client.log).toEqual([])
  })

  it('커플 행이 없으면 던진다', async () => {
    await expect(assembleCornerInput(fakeClient(tables({ couples: [] })), MONTHLY_CONTEXT)).rejects.toThrow(/couples/)
  })

  it('DB 오류는 일반 Error로 던진다 (새 오류 종류를 만들지 않는다)', async () => {
    const failing = fakeClient(tables())
    const original = failing.from.bind(failing)
    const broken = {
      from: (table: string) => (table === 'messages' ? ({ select: () => ({ then: (f: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'boom' } }).then(f), eq() { return this }, is() { return this }, gte() { return this }, lt() { return this }, in() { return this }, order() { return this }, range() { return this } }) } as never) : original(table)),
    }
    await expect(assembleCornerInput(broken as never, MONTHLY_CONTEXT)).rejects.toThrow(/messages 조회 실패: boom/)
  })
})
