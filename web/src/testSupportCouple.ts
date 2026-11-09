/**
 * 시험 보조(시험 파일이 아니다): 상태를 가진 가짜 Supabase 클라이언트 - couples · profiles를 메모리 행으로 두고
 * `select / eq / in / lt / or / insert / update / single / maybeSingle / rpc`를 흉내 낸다. 쓰기는 `writes`에 모두 남는다.
 * 실제 주소 · 키는 어디에도 없다.
 */
import { vi } from 'vitest'
import type { WebSupabase } from './auth/client'

export type FakeRow = Record<string, unknown>
export interface FakeWrite { table: string; op: 'insert' | 'update'; payload: FakeRow }
type RpcResult = { data: unknown; error: { code?: string; message?: string } | null }

export interface CoupleDbOptions {
  couples?: FakeRow[]
  profiles?: FakeRow[]
  /** 연결 RPC(`fn_connect_couple`)의 결과. 기본은 커플 id 'c1'. */
  rpc?: (fn: string, args: Record<string, unknown>) => RpcResult
  /** `couples` insert가 차례로 돌려줄 오류(없으면 정상). */
  insertErrors?: Array<{ code: string } | undefined>
  /** 모든 `couples` 읽기가 실패한다. */
  failCoupleReads?: boolean
  session?: { user: { id: string; app_metadata?: { provider?: string } } } | null
  /** 그 밖의 표(`personality_profiles` · `personality_assessments` · `couple_dissolutions` 등 - 74-7). */
  extraTables?: Record<string, FakeRow[]>
  /** 이 표들의 `update`는 오류로 끝난다(쓰기 실패 시험). */
  failUpdates?: string[]
  /** 전체 로그아웃(`signOut()`)이 돌려줄 오류 - 이때 `signOut({ scope: 'local' })`가 이어져야 한다. */
  signOutError?: { message: string } | null
}

export function makeCoupleDb(opts: CoupleDbOptions = {}) {
  const tables: Record<string, FakeRow[]> = {
    couples: (opts.couples ?? []).map((r) => ({ ...r })),
    profiles: (opts.profiles ?? []).map((r) => ({ ...r })),
    daily_temperature: [],
    ...Object.fromEntries(Object.entries(opts.extraTables ?? {}).map(([k, v]) => [k, v.map((r) => ({ ...r }))])),
  }
  const writes: FakeWrite[] = []
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const insertErrors = [...(opts.insertErrors ?? [])]
  let seq = 0

  const from = (table: string) => {
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: FakeRow = {}
    const filters: Array<(r: FakeRow) => boolean> = []
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = chain
    b.order = chain
    b.limit = chain
    b.eq = (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return b }
    b.is = (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return b }
    b.neq = (c: string, v: unknown) => { filters.push((r) => r[c] !== v); return b }
    b.lt = (c: string, v: number) => { filters.push((r) => (r[c] as number) < v); return b }
    b.or = (expr: string) => {
      const parts = expr.split(',').map((p) => p.split('.'))
      filters.push((r) => parts.some(([c, , v]) => r[c] === v))
      return b
    }
    b.insert = (p: FakeRow) => { mode = 'insert'; payload = p; return b }
    b.update = (p: FakeRow) => { mode = 'update'; payload = p; return b }
    const run = (): { rows: FakeRow[]; error: { code: string } | null } => {
      const rows = tables[table] ?? []
      if (mode === 'insert') {
        writes.push({ table, op: 'insert', payload })
        const err = insertErrors.shift()
        if (err) return { rows: [], error: err }
        const row: FakeRow = { id: `${table}-${++seq}`, status: 'pending', user_b_id: null, relationship_start_date: null, start_date_set_by: null, start_date_confirmed_by: null, nickname: null, ...payload }
        rows.push(row)
        return { rows: [row], error: null }
      }
      if (table === 'couples' && opts.failCoupleReads && mode === 'select') return { rows: [], error: { code: 'XX000' } }
      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (mode === 'update' && (opts.failUpdates ?? []).includes(table)) return { rows: [], error: { code: 'XX000' } }
      if (mode === 'update') {
        // 바뀐 행이 없으면(`.lt` 조건에 안 맞음 등) 쓰기가 일어난 것이 아니다.
        if (matched.length > 0) writes.push({ table, op: 'update', payload })
        for (const m of matched) Object.assign(m, payload)
      }
      return { rows: matched, error: null }
    }
    b.maybeSingle = async () => {
      const o = run()
      return o.error ? { data: null, error: o.error } : { data: o.rows[0] ?? null, error: null }
    }
    b.single = async () => {
      const o = run()
      if (o.error) return { data: null, error: o.error }
      return o.rows[0] ? { data: o.rows[0], error: null } : { data: null, error: { code: 'PGRST116' } }
    }
    b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const o = run()
      return Promise.resolve({ data: null, error: o.error }).then(resolve, reject)
    }
    return b
  }

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>): Promise<RpcResult> => {
    rpcCalls.push({ fn, args })
    return opts.rpc ? opts.rpc(fn, args) : { data: 'c1', error: null }
  })

  const signOutCalls: Array<{ scope?: string } | undefined> = []
  const client = {
    from,
    rpc,
    auth: {
      signOut: async (arg?: { scope?: string }) => {
        signOutCalls.push(arg)
        return { error: arg?.scope === 'local' ? null : (opts.signOutError ?? null) }
      },
      getSession: async () => ({ data: { session: opts.session ?? null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      exchangeCodeForSession: async () => ({ data: { session: { user: { id: 'me' } } }, error: null }),
      signInWithOAuth: async () => ({ data: { url: 'https://auth.invalid/authorize' }, error: null }),
    },
  } as unknown as WebSupabase

  return { client, tables, writes, rpcCalls, rpc, signOutCalls }
}

/** 쓰기 중 `onboarding_step`을 바꾼 것(진행 단계 저장)만. */
export const stepWrites = (writes: FakeWrite[]) => writes.filter((w) => w.table === 'profiles' && 'onboarding_step' in w.payload)
