/**
 * 스모크 전용 가짜 Supabase 클라이언트(79-, R114-3 · 안 A). **앱 빌드(`build` · `build:trial`)에는 들어가지 않는다** - `smoke/entry.tsx`만 이것을 부른다.
 * Vitest에 묶이지 않은(vi 0) 메모리 표 하나로 앱이 쓰는 질의 모양(select · eq · in · is · lt · gte · or · not · order · range · single · count …),
 * rpc · Storage 서명 · Realtime 채널 · auth를 흉내 낸다. 네트워크 0 - 서명 주소도 스모크 서버 안의 자리 그림이다.
 * 실제 주소 · 키 · 이메일 · 이름 0(값은 `seed.ts`의 만든 값뿐).
 */
import type { WebSupabase } from '../src/auth/client'

export type Row = Record<string, unknown>

/** 번들 검색 표지(79- ②): 이 글자가 `build` · `build:trial` 결과물에 있으면 실패. */
export const SMOKE_MARK = '__ONDOLOG_SMOKE_ONLY__'

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T/

function cmp(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const sa = String(a)
  const sb = String(b)
  if (ISO_TIME.test(sa) && ISO_TIME.test(sb)) return new Date(sa).getTime() - new Date(sb).getTime()
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

function parseValue(v: string): unknown {
  if (v === 'null') return null
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

/** PostgREST 연산 하나. 모르는 연산은 거르지 않는다(스모크는 화면이 뜨는지를 본다). */
function test(row: Row, col: string, op: string, value: unknown): boolean {
  const v = row[col] ?? null
  switch (op) {
    case 'eq': return v === value || (v !== null && value !== null && String(v) === String(value))
    case 'neq': return !(v === value || String(v) === String(value))
    case 'is': return v === value
    case 'in': return (value as unknown[]).some((x) => String(x) === String(v))
    case 'lt': return v !== null && cmp(v, value) < 0
    case 'lte': return v !== null && cmp(v, value) <= 0
    case 'gt': return v !== null && cmp(v, value) > 0
    case 'gte': return v !== null && cmp(v, value) >= 0
    default: return true
  }
}

export interface FakeWorld {
  /** 로그인한 사용자 id(없으면 로그인 전 = 온보딩). */
  me: string | null
  tables: Record<string, Row[]>
  /** 서명 주소가 가리킬 자리 그림(스모크 서버 안). */
  mediaUrl: (bucket: string, path: string, index: number) => string
  rpc?: Record<string, (args: Row) => unknown>
  /** 80-: RPC 호출을 시험이 볼 수 있게 알린다(이름 · 인자 그대로). */
  onRpc?: (fn: string, args: Row) => void
}

export function makeFakeClient(world: FakeWorld): WebSupabase {
  const tables = world.tables
  let seq = 0
  // 81-b: 기기가 오프라인이라 하면(시험이 navigator.onLine을 false로) 모든 요청이 연결 오류로 끝난다 - supabase-js처럼 던지지 않고 오류 값으로.
  const down = () => typeof navigator !== 'undefined' && navigator.onLine === false
  const NET_ERROR = { message: 'TypeError: Failed to fetch' }

  const from = (table: string) => {
    let mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    let payload: Row | Row[] = {}
    let conflict = 'id'
    let head = false
    let count = false
    let order: Array<{ col: string; asc: boolean }> = []
    let range: [number, number] | null = null
    const filters: Array<(r: Row) => boolean> = []
    const b: Record<string, unknown> = {}
    const self = () => b
    b.select = (_cols?: string, o?: { count?: string; head?: boolean }) => { head = !!o?.head; count = !!o?.count; return b }
    for (const op of ['eq', 'neq', 'is', 'in', 'lt', 'lte', 'gt', 'gte']) {
      b[op] = (col: string, value: unknown) => { filters.push((r) => test(r, col, op, value)); return b }
    }
    b.filter = (col: string, op: string, value: unknown) => { filters.push((r) => test(r, col, op, value)); return b }
    b.not = (col: string, op: string, value: unknown) => { filters.push((r) => !test(r, col, op, value)); return b }
    b.match = (m: Row) => { filters.push((r) => Object.entries(m).every(([c, v]) => test(r, c, 'eq', v))); return b }
    b.or = (expr: string) => {
      const parts = expr.split(',').map((p) => { const [c, op, ...rest] = p.split('.'); return { c, op, v: parseValue(rest.join('.')) } })
      filters.push((r) => parts.some(({ c, op, v }) => test(r, c, op, v)))
      return b
    }
    b.order = (col: string, o?: { ascending?: boolean }) => { order.push({ col, asc: o?.ascending !== false }); return b }
    b.limit = (n: number) => { range = [0, n - 1]; return b }
    b.range = (a: number, z: number) => { range = [a, z]; return b }
    b.returns = self
    b.abortSignal = self
    b.throwOnError = self
    b.overrideTypes = self
    b.insert = (p: Row | Row[]) => { mode = 'insert'; payload = p; return b }
    b.update = (p: Row) => { mode = 'update'; payload = p; return b }
    b.delete = () => { mode = 'delete'; return b }
    b.upsert = (p: Row | Row[], o?: { onConflict?: string }) => { mode = 'upsert'; payload = p; conflict = o?.onConflict ?? 'id'; return b }

    const run = (): { rows: Row[]; count: number } => {
      const rows = (tables[table] ??= [])
      const list = Array.isArray(payload) ? payload : [payload]
      if (mode === 'insert') {
        const now = new Date().toISOString()
        const made = list.map((p) => ({ id: `${table}-new-${++seq}`, created_at: now, deleted_at: null, ...p }))
        rows.push(...made)
        return { rows: made, count: made.length }
      }
      if (mode === 'upsert') {
        const keys = conflict.split(',').map((k) => k.trim())
        const out: Row[] = []
        for (const p of list) {
          const found = rows.find((r) => keys.every((k) => r[k] === p[k]))
          if (found) { Object.assign(found, p); out.push(found) } else { const r = { ...p }; rows.push(r); out.push(r) }
        }
        return { rows: out, count: out.length }
      }
      let matched = rows.filter((r) => filters.every((f) => f(r)))
      if (mode === 'update') { for (const m of matched) Object.assign(m, payload); return { rows: matched, count: matched.length } }
      if (mode === 'delete') { tables[table] = rows.filter((r) => !matched.includes(r)); return { rows: matched, count: matched.length } }
      if (order.length > 0) {
        matched = [...matched].sort((x, y) => {
          for (const { col, asc } of order) {
            const d = cmp(x[col] ?? '', y[col] ?? '')
            if (d !== 0) return asc ? d : -d
          }
          return 0
        })
      }
      const total = matched.length
      if (range) matched = matched.slice(range[0], range[1] + 1)
      return { rows: matched, count: total }
    }
    b.maybeSingle = async () => (down() ? { data: null, error: NET_ERROR } : { data: run().rows[0] ?? null, error: null })
    b.single = async () => {
      if (down()) return { data: null, error: NET_ERROR }
      const r = run().rows[0]
      return r ? { data: r, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    }
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      if (down()) return Promise.resolve({ data: null, count: null, error: NET_ERROR }).then(ok, bad)
      const o = run()
      const out = head ? { data: null, count: o.count, error: null } : { data: o.rows, count: count ? o.count : null, error: null }
      return Promise.resolve(out).then(ok, bad)
    }
    return b
  }

  const storage = {
    from: (bucket: string) => ({
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((path, i) => ({ path, signedUrl: world.mediaUrl(bucket, path, i), error: null })), error: null }),
      createSignedUrl: async (path: string) => ({ data: { signedUrl: world.mediaUrl(bucket, path, 0) }, error: null }),
      upload: async (path: string) => ({ data: { path }, error: null }),
      remove: async (paths: string[]) => ({ data: paths.map((name) => ({ name })), error: null }),
    }),
  }

  const channel = (name: string) => {
    const api = {
      topic: name,
      on: () => api,
      subscribe: (cb?: (s: string) => void) => { if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return api },
      unsubscribe: async () => 'ok',
    }
    return api
  }

  const session = world.me ? { user: { id: world.me, app_metadata: { provider: 'kakao' }, user_metadata: {} }, access_token: 'smoke', refresh_token: 'smoke' } : null

  return {
    from,
    storage,
    channel,
    removeChannel: async () => 'ok',
    removeAllChannels: async () => [],
    rpc: async (fn: string, args: Row = {}) => {
      if (down()) return { data: null, error: NET_ERROR }
      world.onRpc?.(fn, args)
      return { data: world.rpc?.[fn] ? world.rpc[fn](args) : null, error: null }
    },
    functions: { invoke: async () => ({ data: null, error: null }) },
    auth: {
      // 81-b: 저장된 세션 키(앱이 오프라인에서 저장분을 직접 읽는 자리). 오프라인이면 토큰 갱신이 실패한 모양(세션 null + 오류) - 가장 나쁜 경우.
      storageKey: 'sb-smoke-auth-token',
      getSession: async () => (down() && session ? { data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } } : { data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
      refreshSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ data: { session }, error: null }),
      signInWithOAuth: async () => ({ data: { url: 'about:blank' }, error: null }),
    },
  } as unknown as WebSupabase
}
