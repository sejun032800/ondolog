/**
 * 시험 보조(시험 파일이 아니다): 피드 · 데이트 · 기록 시험용 상태 있는 가짜 Supabase 클라이언트.
 * `dates` · `date_stops` · `data_entries` · `couples` · `profiles`를 메모리 행으로 두고 `select / eq / in / is / or / order / limit / insert / update / single / maybeSingle`,
 * Storage(`entries` 버킷 `upload` · `createSignedUrls`), RPC `fn_delete_own_entry`를 흉내 낸다. 쓰기는 모두 `writes` · `uploads` · `rpcCalls`에 남는다.
 * 실제 주소 · 키는 어디에도 없다.
 */
import { vi } from 'vitest'
import type { WebSupabase } from '../../auth/client'

export type Row = Record<string, unknown>
export interface Write { table: string; op: 'insert' | 'update'; payload: Row; match?: Row }

export interface FeedDbOptions {
  me: string
  couples?: Row[]
  profiles?: Row[]
  dates?: Row[]
  stops?: Row[]
  entries?: Row[]
  /** `fn_delete_own_entry`가 오류를 돌려준다. */
  deleteFails?: boolean
  /** 올리기(Storage upload)가 몇 번째까지 실패하는가(앞의 N번). */
  uploadFailures?: number
}

export function makeFeedDb(opts: FeedDbOptions) {
  const tables: Record<string, Row[]> = {
    couples: (opts.couples ?? []).map((r) => ({ ...r })),
    profiles: (opts.profiles ?? []).map((r) => ({ ...r })),
    dates: (opts.dates ?? []).map((r) => ({ deleted_at: null, region: null, title: null, photo_count: 0, duration_minutes: null, has_user_note: false, ...r })),
    date_stops: (opts.stops ?? []).map((r) => ({ ...r })),
    data_entries: (opts.entries ?? []).map((r) => ({ deleted_at: null, text_content: null, storage_path: null, width: null, height: null, captured_at: null, date_stop_id: null, created_at: '2026-10-01T00:00:00Z', ...r })),
    daily_temperature: [],
  }
  const writes: Write[] = []
  const uploads: { bucket: string; path: string; bytes: number; contentType?: string }[] = []
  const rpcCalls: { fn: string; args: Row }[] = []
  let failUploads = opts.uploadFailures ?? 0
  let seq = 0

  const from = (table: string) => {
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Row | Row[] = {}
    let wantRows = false
    let orderBy: { col: string; asc: boolean } | null = null
    let max: number | null = null
    const filters: Array<(r: Row) => boolean> = []
    const eqMatch: Row = {}
    const b: Record<string, unknown> = {}
    b.select = () => { wantRows = true; return b }
    b.order = (col: string, o?: { ascending?: boolean }) => { orderBy = { col, asc: o?.ascending !== false }; return b }
    b.limit = (n: number) => { max = n; return b }
    b.eq = (c: string, v: unknown) => { eqMatch[c] = v; filters.push((r) => r[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return b }
    b.is = (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return b }
    b.or = (expr: string) => {
      const parts = expr.split(',').map((p) => p.split('.'))
      filters.push((r) => parts.some(([c, , v]) => r[c] === v))
      return b
    }
    b.insert = (p: Row | Row[]) => { mode = 'insert'; payload = p; return b }
    b.update = (p: Row) => { mode = 'update'; payload = p; return b }
    const run = (): { rows: Row[]; error: { code?: string; message: string } | null } => {
      const rows = tables[table] ?? []
      if (mode === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload]
        const made: Row[] = []
        for (const p of list) {
          writes.push({ table, op: 'insert', payload: p })
          const row: Row = { id: (p.id as string | undefined) ?? `${table}-${++seq}`, deleted_at: null, created_at: '2026-10-05T00:00:00Z', ...p }
          rows.push(row)
          made.push(row)
        }
        return { rows: made, error: null }
      }
      let matched = rows.filter((r) => filters.every((f) => f(r)))
      if (mode === 'update') {
        if (matched.length > 0) writes.push({ table, op: 'update', payload: payload as Row, match: { ...eqMatch } })
        for (const m of matched) Object.assign(m, payload)
        return { rows: matched, error: null }
      }
      if (orderBy) {
        const { col, asc } = orderBy
        matched = [...matched].sort((x, y) => {
          const a = x[col] as string | number
          const c = y[col] as string | number
          return a === c ? 0 : (a < c ? -1 : 1) * (asc ? 1 : -1)
        })
      }
      if (max !== null) matched = matched.slice(0, max)
      return { rows: matched, error: null }
    }
    b.maybeSingle = async () => {
      const o = run()
      return o.error ? { data: null, error: o.error } : { data: o.rows[0] ?? null, error: null }
    }
    b.single = async () => {
      const o = run()
      return o.rows[0] ? { data: o.rows[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    }
    b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const o = run()
      return Promise.resolve({ data: wantRows || mode === 'select' ? o.rows : null, error: o.error }).then(resolve, reject)
    }
    return b
  }

  const storage = {
    from: (bucket: string) => ({
      upload: async (path: string, bytes: ArrayBuffer, o?: { contentType?: string }) => {
        if (failUploads > 0) {
          failUploads -= 1
          return { error: { message: 'network' } }
        }
        uploads.push({ bucket, path, bytes: bytes.byteLength, contentType: o?.contentType })
        return { error: null }
      },
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.invalid/${path}` })), error: null }),
    }),
  }

  const rpc = vi.fn(async (fn: string, args: Row) => {
    rpcCalls.push({ fn, args })
    if (fn !== 'fn_delete_own_entry') return { data: null, error: { message: 'unknown rpc' } }
    if (opts.deleteFails) return { data: null, error: { message: 'boom' } }
    const row = tables.data_entries.find((r) => r.id === args.p_entry_id)
    // 작성자 = 호출자만 지운다(서버 함수와 같다). 이미 지웠으면 false(멱등).
    if (!row || row.author_id !== opts.me || row.deleted_at) return { data: false, error: null }
    row.deleted_at = '2026-10-06T00:00:00Z'
    return { data: true, error: null }
  })

  // 채팅 탭으로 옮겨 가는 흐름(Realtime 구독)이 도는 시험을 위한 빈 채널.
  const channel = { on: () => channel, subscribe: () => channel }
  const client = {
    from,
    storage,
    rpc,
    channel: () => channel,
    removeChannel: async () => 'ok',
    auth: {
      getSession: async () => ({ data: { session: { user: { id: opts.me } } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as WebSupabase

  return { client, tables, writes, uploads, rpcCalls, rpc }
}

/** 이 유저가 기록할 수 있는 활성 커플 한 쌍. */
export const COUPLE_ROW: Row = { id: 'c1', status: 'active', user_a_id: 'me', user_b_id: 'you', relationship_start_date: '2025-12-28', nickname: '늘봄', reference_photo_path: null }
export const PROFILES: Row[] = [{ id: 'me', display_name: '세준' }, { id: 'you', display_name: '서영' }]

/** 사진 행(`data_entries`). */
export function photoRow(id: string, over: Row = {}): Row {
  return { id, couple_id: 'c1', date_id: 'd1', author_id: 'me', entry_type: 'photo', storage_path: `c1/${id}.jpg`, ...over }
}
export function memoRow(id: string, text: string, over: Row = {}): Row {
  return { id, couple_id: 'c1', date_id: 'd1', author_id: 'me', entry_type: 'memo', text_content: text, ...over }
}
export function dateRow(id: string, dateOn: string, over: Row = {}): Row {
  return { id, couple_id: 'c1', date_on: dateOn, ...over }
}
export function stopRow(id: string, dateId: string, seq: number, arrivedAt: string, placeName: string | null): Row {
  return { id, date_id: dateId, couple_id: 'c1', seq, arrived_at: arrivedAt, place_name: placeName }
}
