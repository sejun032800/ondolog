/**
 * 데이트 기록 쓰기 (U2, `56-`) - 메모리 안의 가짜 저장소로 기록 규칙 1·3·4·5·6·7을 확인한다.
 * 진짜 DB·RLS는 원격 개발 DB 실증(`scripts/ops/verifyU2Record.ts`)이 확인한다.
 *
 * 가짜 저장소는 `date_stops (date_id, seq)`와 `dates (couple_id, date_on)` unique를 지킨다 -
 * stop 번호를 다시 매길 때의 임시 번호 경로가 실제로 필요한지 보려는 것이다.
 */
import {
  buildFeedItems,
  findRecordingCouple,
  recordDate,
  refreshDateDerived,
  resequenceStops,
  StopTimeInputError,
  canDeleteEntry,
  deleteOwnEntry,
  syncOwnPlacement,
  updateStop,
  withRetry,
  type Db,
  type EntryRow,
} from '../../src/services/dateRecordApi'
import type { PickedPhoto } from '../../src/utils/dateRecord'

type Row = Record<string, unknown>

const UNIQUE: Record<string, string[]> = {
  dates: ['couple_id', 'date_on'],
  date_stops: ['date_id', 'seq'],
}

class FakeStore {
  tables: Record<string, Row[]> = { couples: [], dates: [], date_stops: [], data_entries: [], profiles: [] }
  /** 모든 insert·update가 쓴 칸 이름(쓰면 안 되는 칸을 확인한다). */
  writtenColumns: Record<string, Set<string>> = {}
  uploads: { path: string; size: number; contentType?: string }[] = []
  failUploadsFor = new Set<string>()
  failUploadsAlways = false
  rpcCalls: { fn: string; args: Record<string, unknown> }[] = []
  private counter = 0

  nextId(prefix: string): string {
    this.counter += 1
    return `${prefix}-${String(this.counter).padStart(4, '0')}`
  }

  noteWrite(table: string, row: Row): void {
    const set = (this.writtenColumns[table] ??= new Set())
    for (const k of Object.keys(row)) set.add(k)
  }

  checkUnique(table: string, row: Row, ignoreIndex = -1): boolean {
    const cols = UNIQUE[table]
    if (!cols) return true
    return !this.tables[table].some((r, i) => i !== ignoreIndex && cols.every((c) => r[c] === row[c]))
  }
}

const DEFAULTS: Record<string, Row> = {
  dates: {
    region: null,
    title: null,
    narrative: null,
    photo_count: 0,
    duration_minutes: null,
    has_user_note: false,
    is_new_region: false,
    deleted_at: null,
  },
  date_stops: { place_provider_id: null, lat: null, lng: null },
  data_entries: { deleted_at: null, thumb_path: null, created_at: '2026-10-24T00:00:00Z' },
}

class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: ((r: Row) => boolean)[] = []
  private op: 'select' | 'insert' | 'update' = 'select'
  private payload: Row | Row[] | null = null
  private orderBy: { col: string; asc: boolean } | null = null
  private wantRows = false
  private mode: 'many' | 'single' | 'maybe' = 'many'

  constructor(
    private store: FakeStore,
    private table: string,
  ) {}

  select(_cols?: string): this {
    if (this.op === 'select') this.wantRows = true
    else this.wantRows = true
    return this
  }
  insert(payload: Row | Row[]): this {
    this.op = 'insert'
    this.payload = payload
    return this
  }
  update(payload: Row): this {
    this.op = 'update'
    this.payload = payload
    return this
  }
  eq(col: string, value: unknown): this {
    this.filters.push((r) => r[col] === value)
    return this
  }
  in(col: string, values: unknown[]): this {
    this.filters.push((r) => values.includes(r[col]))
    return this
  }
  is(col: string, value: null): this {
    this.filters.push((r) => (r[col] ?? null) === value)
    return this
  }
  or(expr: string): this {
    const parts = expr.split(',').map((p) => p.split('.'))
    this.filters.push((r) => parts.some(([col, , value]) => r[col] === value))
    return this
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderBy = { col, asc: opts?.ascending !== false }
    return this
  }
  limit(_n: number): this {
    return this
  }
  single(): this {
    this.mode = 'single'
    return this
  }
  maybeSingle(): this {
    this.mode = 'maybe'
    return this
  }

  private matching(): Row[] {
    let rows = this.store.tables[this.table].filter((r) => this.filters.every((f) => f(r)))
    if (this.orderBy) {
      const { col, asc } = this.orderBy
      rows = [...rows].sort((a, b) => ((a[col] as number) < (b[col] as number) ? -1 : (a[col] as number) > (b[col] as number) ? 1 : 0) * (asc ? 1 : -1))
    }
    return rows
  }

  private run(): { data: unknown; error: unknown } {
    const table = this.store.tables[this.table]
    let result: Row[] = []
    if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload as Row]
      const inserted: Row[] = []
      for (const input of rows) {
        const row: Row = { ...(DEFAULTS[this.table] ?? {}), id: this.store.nextId(this.table), ...input }
        this.store.noteWrite(this.table, input)
        if (!this.store.checkUnique(this.table, row)) {
          return { data: null, error: { code: '23505', message: `duplicate key on ${this.table}` } }
        }
        table.push(row)
        inserted.push(row)
      }
      result = inserted
    } else if (this.op === 'update') {
      const patch = this.payload as Row
      this.store.noteWrite(this.table, patch)
      const targets = this.matching()
      for (const t of targets) {
        const next = { ...t, ...patch }
        const idx = table.indexOf(t)
        if (!this.store.checkUnique(this.table, next, idx)) {
          return { data: null, error: { code: '23505', message: `duplicate key on ${this.table}` } }
        }
        Object.assign(t, patch)
      }
      result = targets
    } else {
      result = this.matching()
    }

    if (this.mode === 'single') {
      return result.length === 1 ? { data: result[0], error: null } : { data: null, error: { message: `expected 1 row, got ${result.length}` } }
    }
    if (this.mode === 'maybe') {
      if (result.length > 1) return { data: null, error: { message: 'multiple rows' } }
      return { data: result[0] ?? null, error: null }
    }
    return { data: this.op === 'select' || this.wantRows ? result : null, error: null }
  }

  then<R1 = { data: unknown; error: unknown }, R2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }
}

function makeDb(store: FakeStore): Db {
  const db = {
    from: (table: string) => new Query(store, table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      store.rpcCalls.push({ fn, args })
      return { data: true, error: null }
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, body: ArrayBuffer, opts?: { contentType?: string }) => {
          if (store.failUploadsAlways || store.failUploadsFor.has(path)) return { data: null, error: { message: 'upload failed' } }
          store.uploads.push({ path, size: body.byteLength, contentType: opts?.contentType })
          return { data: { path }, error: null }
        },
      }),
    },
  }
  return db as unknown as Db
}

function bySeq(store: FakeStore): Row[] {
  return [...store.tables.date_stops].sort((a, b) => (a.seq as number) - (b.seq as number))
}

const COUPLE = 'couple-1'
const ME = 'user-a'
const PARTNER = 'user-b'

function photo(n: number, capturedAt: string | null, extra: Partial<PickedPhoto> = {}): PickedPhoto {
  return {
    uri: `file:///p${n}.jpg`,
    width: 4032,
    height: 3024,
    byteSize: 1000 + n,
    mimeType: 'image/jpeg',
    ext: 'jpg',
    capturedAt,
    lat: 37.5,
    lng: 126.9,
    ...extra,
  }
}

function deps(store: FakeStore) {
  let n = 0
  return {
    readBytes: async (uri: string) => new ArrayBuffer(uri.length),
    newId: () => store.nextId(`id${(n += 1)}`),
    retryDelayMs: 0,
  }
}

const FIVE_PHOTOS = [
  photo(1, '2026-10-03T14:20:00+09:00'),
  photo(2, '2026-10-03T15:10:00+09:00'),
  photo(3, '2026-10-03T16:50:00+09:00'),
  photo(4, '2026-10-03T18:30:00+09:00'),
  photo(5, '2026-10-03T20:05:00+09:00'),
]

describe('규칙 1·3·4·5·7 - 데이트 하나 기록', () => {
  async function recordSample(store = new FakeStore()) {
    const db = makeDb(store)
    const result = await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [
        { name: '홍대 CGV', arrivalClock: '14:20' },
        { name: '연남동 디저트 카페', arrivalClock: '16:40' },
      ],
      photos: FIVE_PHOTOS,
      memo: '스파이더맨 봤다. 서영이는 중간에 졸았음',
    })
    return { store, db, result }
  }

  it('데이트 하나(source = manual, user_confirmed = true) · stop 둘 · 사진 다섯 · 메모 하나를 만든다', async () => {
    const { store, result } = await recordSample()
    expect(store.tables.dates).toHaveLength(1)
    expect(store.tables.dates[0]).toMatchObject({ couple_id: COUPLE, date_on: '2026-10-03', source: 'manual', user_confirmed: true })
    expect(bySeq(store).map((s) => [s.seq, s.place_name])).toEqual([
      [0, '홍대 CGV'],
      [1, '연남동 디저트 카페'],
    ])
    expect(store.tables.data_entries.filter((e) => e.entry_type === 'photo')).toHaveLength(5)
    expect(result.photoEntryIds).toHaveLength(5)
    expect(result.failedPhotos).toBe(0)
  })

  it('규칙 4 - 사진은 촬영 시각으로 stop에 붙는다', async () => {
    const { store } = await recordSample()
    const stopByName = Object.fromEntries(store.tables.date_stops.map((s) => [s.place_name as string, s.id as string]))
    const photos = store.tables.data_entries.filter((e) => e.entry_type === 'photo')
    const placement = photos.map((p) => [p.captured_at, p.date_stop_id === stopByName['홍대 CGV'] ? 'CGV' : 'CAFE'])
    expect(placement).toEqual([
      ['2026-10-03T14:20:00+09:00', 'CGV'],
      ['2026-10-03T15:10:00+09:00', 'CGV'],
      ['2026-10-03T16:50:00+09:00', 'CAFE'],
      ['2026-10-03T18:30:00+09:00', 'CAFE'],
      ['2026-10-03T20:05:00+09:00', 'CAFE'],
    ])
  })

  it('규칙 3 - width·height·captured_at·lat/lng·크기를 채우고 thumb_path는 비워 둔다', async () => {
    const { store } = await recordSample()
    for (const p of store.tables.data_entries.filter((e) => e.entry_type === 'photo')) {
      expect(p.width).toBe(4032)
      expect(p.height).toBe(3024)
      expect(p.captured_at).not.toBeNull()
      expect(p.lat).toBe(37.5)
      expect(p.lng).toBe(126.9)
      expect(p.thumb_path ?? null).toBeNull()
      expect(p.author_id).toBe(ME)
      expect(p.storage_path).toMatch(new RegExp(`^${COUPLE}/[A-Za-z0-9_-]+\\.jpg$`))
    }
  })

  it('원본을 그대로 올린다 - 바이트 수와 content-type을 바꾸지 않는다', async () => {
    const { store } = await recordSample()
    expect(store.uploads).toHaveLength(5)
    expect(store.uploads.every((u) => u.contentType === 'image/jpeg')).toBe(true)
    expect(store.uploads[0].size).toBe('file:///p1.jpg'.length)
  })

  it('규칙 5 - 메모는 데이트 단위(date_stop_id 비움)이고 작성자는 나다', async () => {
    const { store, result } = await recordSample()
    const memo = store.tables.data_entries.find((e) => e.entry_type === 'memo')
    expect(memo).toMatchObject({ id: result.memoEntryId, author_id: ME, date_stop_id: null, text_content: '스파이더맨 봤다. 서영이는 중간에 졸았음' })
    expect(memo?.date_id).toBe(store.tables.dates[0].id)
  })

  it('규칙 7 - 파생 칸이 맞고 title · narrative · is_new_region · region은 쓰지 않는다', async () => {
    const { store } = await recordSample()
    expect(store.tables.dates[0]).toMatchObject({ photo_count: 5, duration_minutes: 345, has_user_note: true })
    const written = store.writtenColumns.dates
    for (const forbidden of ['title', 'narrative', 'is_new_region', 'region']) {
      expect(written.has(forbidden)).toBe(false)
    }
    expect(store.tables.dates[0]).toMatchObject({ title: null, narrative: null, is_new_region: false, region: null })
  })

  it('쓰는 data_entries 칸에 thumb_path가 없고, stop은 place_provider_id·lat·lng를 쓰지 않는다', async () => {
    const { store } = await recordSample()
    expect(store.writtenColumns.data_entries.has('thumb_path')).toBe(false)
    for (const c of ['place_provider_id', 'lat', 'lng', 'location_verified', 'caption']) {
      expect(store.writtenColumns.date_stops.has(c)).toBe(false)
    }
  })

  it('같은 날짜로 다시 쓰면 그 데이트에 더한다(데이트는 하나)', async () => {
    const { store, db } = await recordSample()
    const again = await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: PARTNER,
      dateOn: '2026-10-03',
      places: [],
      photos: [photo(6, '2026-10-03T19:00:00+09:00')],
      memo: '',
    })
    expect(again.createdDate).toBe(false)
    expect(store.tables.dates).toHaveLength(1)
    expect(store.tables.date_stops).toHaveLength(2)
    expect(store.tables.dates[0]).toMatchObject({ photo_count: 6 })
    const added = store.tables.data_entries.find((e) => e.id === again.photoEntryIds[0])
    expect(added?.author_id).toBe(PARTNER)
  })

  it('장소를 하나도 안 넣으면 이름 없는 stop 하나이고 사진은 모두 거기에 붙는다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [],
      photos: [photo(1, '2026-10-03T14:20:00+09:00'), photo(2, null)],
      memo: '',
    })
    expect(store.tables.date_stops).toHaveLength(1)
    // R30-2 - 시각 모름 표시 값이 아니라 가장 이른 촬영 시각(실제 시각)이다.
    expect(store.tables.date_stops[0]).toMatchObject({ seq: 0, place_name: null, arrived_at: '2026-10-03T14:20:00+09:00' })
    const stopId = store.tables.date_stops[0].id
    expect(store.tables.data_entries.every((e) => e.date_stop_id === stopId)).toBe(true)
  })

  it('나중에 장소를 더하면 도착 시각 순으로 번호가 다시 매겨진다(unique를 지킨 채)', async () => {
    const { store, db } = await recordSample()
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [{ name: '저녁 식당', arrivalClock: '15:00' }],
      photos: [],
      memo: '저녁은 늦게',
    })
    expect(bySeq(store).map((s) => [s.seq, s.place_name])).toEqual([
      [0, '홍대 CGV'],
      [1, '저녁 식당'],
      [2, '연남동 디저트 카페'],
    ])
  })

  it('사진 몇 장이 올라가지 않아도 나머지로 기록하고 실패 수를 알린다', async () => {
    const store = new FakeStore()
    store.failUploadsFor = new Set<string>()
    const db = makeDb(store)
    let calls = 0
    const d = deps(store)
    const result = await recordDate(
      db,
      {
        ...d,
        readBytes: async (uri) => {
          if (uri.endsWith('p2.jpg')) throw new Error('read failed')
          calls += 1
          return d.readBytes(uri)
        },
      },
      {
        coupleId: COUPLE,
        userId: ME,
        dateOn: '2026-10-03',
        places: [],
        photos: [photo(1, '2026-10-03T14:20:00+09:00'), photo(2, '2026-10-03T15:00:00+09:00')],
        memo: '',
      },
    )
    expect(result.failedPhotos).toBe(1)
    expect(result.photoEntryIds).toHaveLength(1)
    expect(calls).toBe(1)
    expect(store.tables.dates[0]).toMatchObject({ photo_count: 1 })
  })

  it('업로드가 전부 실패하면 DB에 아무것도 쓰지 않고 던진다(빈 데이트가 남지 않는다)', async () => {
    const store = new FakeStore()
    store.failUploadsAlways = true
    const db = makeDb(store)
    await expect(
      recordDate(db, deps(store), {
        coupleId: COUPLE,
        userId: ME,
        dateOn: '2026-10-03',
        places: [{ name: '카페' }],
        photos: [photo(1, '2026-10-03T14:20:00+09:00')],
        memo: '',
      }),
    ).rejects.toThrow()
    expect(store.tables.dates).toHaveLength(0)
    expect(store.tables.date_stops).toHaveLength(0)
    expect(store.tables.data_entries).toHaveLength(0)
  })

  it('사진도 메모도 없으면 기록하지 않는다', async () => {
    const store = new FakeStore()
    await expect(
      recordDate(makeDb(store), deps(store), { coupleId: COUPLE, userId: ME, dateOn: '2026-10-03', places: [], photos: [], memo: '  ' }),
    ).rejects.toThrow()
  })

  it('업로드는 실패 뒤 다시 시도한다(최대 3번)', async () => {
    let tries = 0
    const result = await withRetry(
      async () => {
        tries += 1
        if (tries < 3) throw new Error('flaky')
        return 'ok'
      },
      3,
      0,
    )
    expect(result).toBe('ok')
    expect(tries).toBe(3)
    await expect(withRetry(async () => Promise.reject(new Error('always')), 2, 0)).rejects.toThrow('always')
  })
})

describe('E15 - 장소 고치기', () => {
  it('도착 시각을 고치면 번호와 내 사진 배치가 규칙 4로 다시 맞춰진다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [
        { name: '홍대 CGV', arrivalClock: '14:20' },
        { name: '연남동 디저트 카페', arrivalClock: '16:40' },
      ],
      photos: FIVE_PHOTOS,
      memo: '',
    })
    const cafe = store.tables.date_stops.find((s) => s.place_name === '연남동 디저트 카페') as Row
    const cgv = store.tables.date_stops.find((s) => s.place_name === '홍대 CGV') as Row

    // 카페 도착을 14:00으로 앞당기면 카페가 첫 stop이 되고 14:20 이후 사진은 모두 카페로 붙는다
    await updateStop(db, {
      stopId: cafe.id as string,
      dateId: cafe.date_id as string,
      dateOn: '2026-10-03',
      userId: ME,
      placeName: '연남동 디저트 카페',
      arrivalClock: '14:00',
    })
    expect(bySeq(store).map((s) => [s.seq, s.place_name])).toEqual([
      [0, '연남동 디저트 카페'],
      [1, '홍대 CGV'],
    ])
    // CGV 14:20 이후 사진은 CGV(가장 늦은 도착 <= 촬영)에 붙는다
    const photos = store.tables.data_entries.filter((e) => e.entry_type === 'photo')
    expect(photos.every((p) => p.date_stop_id === cgv.id)).toBe(true)
    // 장소 검색·지도 칸은 쓰지 않았다
    expect(store.writtenColumns.date_stops.has('place_provider_id')).toBe(false)
  })

  async function recordOne(store: FakeStore, extra: { clock?: string; photos?: PickedPhoto[] } = {}) {
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [{ name: '카페', arrivalClock: extra.clock ?? '16:40' }],
      photos: extra.photos ?? [photo(1, '2026-10-03T17:00:00+09:00')],
      memo: '',
    })
    return { db, stop: store.tables.date_stops[0] }
  }

  it('R30-2 - 첫 stop의 시각을 비우면 그 데이트 사진의 가장 이른 촬영 시각으로 저장한다(00:00 표시 값은 없다)', async () => {
    const store = new FakeStore()
    const { db, stop } = await recordOne(store)
    await updateStop(db, {
      stopId: stop.id as string,
      dateId: stop.date_id as string,
      dateOn: '2026-10-03',
      userId: ME,
      placeName: '  ',
      arrivalClock: null,
    })
    expect(store.tables.date_stops[0]).toMatchObject({ place_name: null, arrived_at: '2026-10-03T17:00:00+09:00' })
  })

  it('R30-2 - 둘째 stop의 시각을 비우면 저장하지 않는다', async () => {
    const store = new FakeStore()
    const { db } = await recordOne(store, { clock: '10:00', photos: [photo(1, '2026-10-03T11:00:00+09:00')] })
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [{ name: '식당', arrivalClock: '18:00' }],
      photos: [],
      memo: 'x',
    })
    const second = bySeq(store)[1]
    const before = JSON.stringify(store.tables.date_stops)
    await expect(
      updateStop(db, {
        stopId: second.id as string,
        dateId: second.date_id as string,
        dateOn: '2026-10-03',
        userId: ME,
        placeName: '식당',
        arrivalClock: null,
      }),
    ).rejects.toBeInstanceOf(StopTimeInputError)
    expect(JSON.stringify(store.tables.date_stops)).toBe(before)
  })

  it('R30-2 - 사진의 시각이 없고 시각도 비우면 저장하지 않는다', async () => {
    const store = new FakeStore()
    const { db, stop } = await recordOne(store, { photos: [photo(1, null)] })
    await expect(
      updateStop(db, {
        stopId: stop.id as string,
        dateId: stop.date_id as string,
        dateOn: '2026-10-03',
        userId: ME,
        placeName: '카페',
        arrivalClock: null,
      }),
    ).rejects.toThrow('도착 시각')
    expect(store.tables.date_stops[0].arrived_at).toBe('2026-10-03T16:40:00+09:00')
  })

  it('R30-2 - 실제 00:00을 입력하면 00:00으로 저장한다', async () => {
    const store = new FakeStore()
    const { db, stop } = await recordOne(store)
    await updateStop(db, {
      stopId: stop.id as string,
      dateId: stop.date_id as string,
      dateOn: '2026-10-03',
      userId: ME,
      placeName: '카페',
      arrivalClock: '00:00',
    })
    expect(store.tables.date_stops[0].arrived_at).toBe('2026-10-03T00:00:00+09:00')
  })

  it('상대가 올린 사진 행은 쓰지 않는다 - 내 행만 맞춘다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: PARTNER,
      dateOn: '2026-10-03',
      places: [
        { name: 'A', arrivalClock: '10:00' },
        { name: 'B', arrivalClock: '15:00' },
      ],
      photos: [photo(1, '2026-10-03T16:00:00+09:00')],
      memo: '',
    })
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [],
      photos: [photo(2, '2026-10-03T16:00:00+09:00')],
      memo: '',
    })
    const [a, b] = store.tables.date_stops
    // B의 도착을 17:00으로 미루면 두 사진 모두 A가 맞다
    await updateStop(db, { stopId: b.id as string, dateId: b.date_id as string, dateOn: '2026-10-03', userId: ME, placeName: 'B', arrivalClock: '17:00' })
    const partnerPhoto = store.tables.data_entries.find((e) => e.author_id === PARTNER) as Row
    const myPhoto = store.tables.data_entries.find((e) => e.author_id === ME) as Row
    expect(myPhoto.date_stop_id).toBe(a.id) // 내 행은 맞췄다
    expect(partnerPhoto.date_stop_id).toBe(b.id) // 상대의 행은 그대로(읽기만)
    // 다시 돌려도 바뀌는 것이 없다(멱등)
    expect(await syncOwnPlacement(db, a.date_id as string, ME)).toBe(0)
  })

  it('resequenceStops는 바뀔 것이 없으면 아무것도 쓰지 않는다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [{ name: 'A', arrivalClock: '10:00' }, { name: 'B', arrivalClock: '11:00' }],
      photos: [],
      memo: 'm',
    })
    store.writtenColumns = {}
    await resequenceStops(db, store.tables.dates[0].id as string)
    expect(store.writtenColumns.date_stops).toBeUndefined()
  })
})

describe('규칙 6 - 기록할 커플 행', () => {
  it('pending 행이 있으면 그 커플로 기록한다(만들지 않는다)', async () => {
    const store = new FakeStore()
    store.tables.couples.push({ id: 'cp-1', user_a_id: ME, user_b_id: null, status: 'pending' })
    expect(await findRecordingCouple(makeDb(store), ME)).toEqual({ id: 'cp-1', status: 'pending' })
    expect(store.tables.couples).toHaveLength(1)
  })

  it('active 행이 있으면 그 커플이다(상대 쪽에서도)', async () => {
    const store = new FakeStore()
    store.tables.couples.push({ id: 'cp-2', user_a_id: PARTNER, user_b_id: ME, status: 'active' })
    expect(await findRecordingCouple(makeDb(store), ME)).toEqual({ id: 'cp-2', status: 'active' })
  })

  it('행이 없으면 null이고 커플 행을 만들지 않는다', async () => {
    const store = new FakeStore()
    expect(await findRecordingCouple(makeDb(store), ME)).toBeNull()
    expect(store.tables.couples).toHaveLength(0)
    expect(store.writtenColumns.couples).toBeUndefined()
  })

  it('해제된(dissolved) 행은 기록 대상이 아니다', async () => {
    const store = new FakeStore()
    store.tables.couples.push({ id: 'cp-3', user_a_id: ME, user_b_id: null, status: 'dissolved' })
    expect(await findRecordingCouple(makeDb(store), ME)).toBeNull()
  })
})

describe('피드 읽기 모델', () => {
  const dates = [
    { id: 'd1', couple_id: COUPLE, date_on: '2026-10-03', region: null, title: null, photo_count: 3, duration_minutes: null, has_user_note: true },
  ]
  function entry(partial: Partial<EntryRow> & { id: string }): EntryRow {
    return {
      date_id: 'd1',
      date_stop_id: null,
      author_id: ME,
      entry_type: 'photo',
      storage_path: `${COUPLE}/${partial.id}.jpg`,
      text_content: null,
      width: 1,
      height: 1,
      captured_at: null,
      created_at: '2026-10-24T00:00:00Z',
      ...partial,
    }
  }

  it('대표 사진은 가장 이른 촬영 시각 사진이고 시각 없는 사진은 뒤로 간다', () => {
    const [item] = buildFeedItems(dates, [
      entry({ id: 'p-none' }),
      entry({ id: 'p-late', captured_at: '2026-10-03T18:00:00+09:00' }),
      entry({ id: 'p-early', captured_at: '2026-10-03T09:00:00+09:00' }),
    ])
    expect(item.coverPath).toBe(`${COUPLE}/p-early.jpg`)
    expect(item.photoCount).toBe(3)
  })

  it('원문 한 줄은 가장 먼저 쓴 메모의 첫 줄이다', () => {
    const [item] = buildFeedItems(dates, [
      entry({ id: 'm2', entry_type: 'memo', storage_path: null, text_content: '나중 메모', created_at: '2026-10-24T02:00:00Z', author_id: PARTNER }),
      entry({ id: 'm1', entry_type: 'memo', storage_path: null, text_content: '\n창밖 보면서 한참 있었다.\n둘째 줄', created_at: '2026-10-24T01:00:00Z' }),
    ])
    expect(item.quote).toEqual({ text: '창밖 보면서 한참 있었다.', authorId: ME })
    expect(item.memoCount).toBe(2)
  })

  it('메모가 없으면 원문 줄이 없다', () => {
    const [item] = buildFeedItems(dates, [entry({ id: 'p1' })])
    expect(item.quote).toBeNull()
    expect(item.memoCount).toBe(0)
  })
})

describe('refreshDateDerived', () => {
  it('지금 남아 있는 사진·메모로 파생 칸을 다시 맞춘다', async () => {
    const store = new FakeStore()
    store.tables.dates.push({ id: 'd1', photo_count: 99, duration_minutes: 99, has_user_note: true })
    store.tables.data_entries.push(
      { id: 'e1', date_id: 'd1', entry_type: 'photo', captured_at: '2026-10-03T14:00:00+09:00', deleted_at: null },
      { id: 'e2', date_id: 'd1', entry_type: 'photo', captured_at: '2026-10-03T15:30:00+09:00', deleted_at: null },
      { id: 'e3', date_id: 'd1', entry_type: 'photo', captured_at: '2026-10-03T23:00:00+09:00', deleted_at: '2026-10-24T00:00:00Z' },
    )
    await refreshDateDerived(makeDb(store), 'd1', '2026-10-03')
    expect(store.tables.dates[0]).toMatchObject({ photo_count: 2, duration_minutes: 90, has_user_note: false })
  })
})

describe('R30-2 - 기록할 때 도착 시각을 정할 수 없으면 아무것도 올리거나 쓰지 않는다', () => {
  it('장소 둘 · 둘째 시각 없음 -> 업로드도 행도 없다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await expect(
      recordDate(db, deps(store), {
        coupleId: COUPLE,
        userId: ME,
        dateOn: '2026-10-03',
        places: [{ name: 'A', arrivalClock: '10:00' }, { name: 'B' }],
        photos: [photo(1, '2026-10-03T11:00:00+09:00')],
        memo: '',
      }),
    ).rejects.toBeInstanceOf(StopTimeInputError)
    expect(store.uploads).toHaveLength(0)
    expect(store.tables.dates).toHaveLength(0)
    expect(store.tables.date_stops).toHaveLength(0)
    expect(store.tables.data_entries).toHaveLength(0)
  })

  it('장소 하나 · 시각 없음 · 사진에도 시각 없음 -> 저장하지 않는다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await expect(
      recordDate(db, deps(store), {
        coupleId: COUPLE,
        userId: ME,
        dateOn: '2026-10-03',
        places: [{ name: 'A' }],
        photos: [photo(1, null)],
        memo: '',
      }),
    ).rejects.toThrow('첫 장소의 도착 시각')
    expect(store.uploads).toHaveLength(0)
    expect(store.tables.date_stops).toHaveLength(0)
  })

  it('장소 하나 · 시각 없음 · 사진 있음 -> 가장 이른 촬영 시각으로 저장한다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [{ name: 'A' }],
      photos: [photo(1, '2026-10-03T15:00:00+09:00'), photo(2, '2026-10-03T13:10:00+09:00')],
      memo: '',
    })
    expect(store.tables.date_stops).toHaveLength(1)
    expect(store.tables.date_stops[0].arrived_at).toBe('2026-10-03T13:10:00+09:00')
  })

  it('메모만 기록하고 장소가 없으면 stop을 만들지 않는다(00:00 stop도 없다)', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), { coupleId: COUPLE, userId: ME, dateOn: '2026-10-03', places: [], photos: [], memo: '오늘 메모' })
    expect(store.tables.date_stops).toHaveLength(0)
    expect(store.tables.data_entries).toHaveLength(1)
  })

  it('이미 stop이 있는 날에 장소 없이 시각 없는 사진을 더해도 된다(새 stop이 필요 없다)', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [{ name: 'A', arrivalClock: '10:00' }],
      photos: [photo(1, '2026-10-03T10:30:00+09:00')],
      memo: '',
    })
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [],
      photos: [photo(2, null)],
      memo: '',
    })
    expect(store.tables.date_stops).toHaveLength(1)
  })

  it('저장된 stop 시각 중 KST 00:00 표시 값을 만드는 경로가 없다 - 어떤 입력에서도 입력·촬영 시각만 쓴다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    await recordDate(db, deps(store), {
      coupleId: COUPLE,
      userId: ME,
      dateOn: '2026-10-03',
      places: [{ name: 'A' }, { name: 'B', arrivalClock: '19:00' }],
      photos: [photo(1, '2026-10-03T12:00:00+09:00')],
      memo: '',
    })
    expect(store.tables.date_stops.map((x) => x.arrived_at).sort()).toEqual([
      '2026-10-03T12:00:00+09:00',
      '2026-10-03T19:00:00+09:00',
    ])
  })
})

describe('R30-1 - 본인 기록 삭제', () => {
  it('fn_delete_own_entry RPC만 부르고 data_entries를 직접 쓰지 않는다', async () => {
    const store = new FakeStore()
    const db = makeDb(store)
    const deleted = await deleteOwnEntry(db, 'entry-1')
    expect(deleted).toBe(true)
    expect(store.rpcCalls).toEqual([{ fn: 'fn_delete_own_entry', args: { p_entry_id: 'entry-1' } }])
    expect(store.writtenColumns.data_entries).toBeUndefined()
    expect(store.writtenColumns.dates).toBeUndefined()
  })

  it('RPC 오류는 던진다', async () => {
    const db = { rpc: async () => ({ data: null, error: { message: 'not the author' } }) } as unknown as Db
    await expect(deleteOwnEntry(db, 'entry-1')).rejects.toThrow('not the author')
  })

  it('지우기는 내가 올린 항목에만 보인다', () => {
    expect(canDeleteEntry({ author_id: ME }, ME)).toBe(true)
    expect(canDeleteEntry({ author_id: PARTNER }, ME)).toBe(false)
    expect(canDeleteEntry({ author_id: ME }, null)).toBe(false)
  })
})
