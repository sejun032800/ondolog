/**
 * 시험 보조(시험 파일이 아니다): 채팅 시험용 상태 있는 가짜 Supabase 클라이언트.
 * `messages` · `stories` · `profiles`를 메모리 행으로 두고 `select / eq / neq / is / gte / order / limit / insert / update / single / maybeSingle`,
 * Realtime 채널(`channel(name).on(...).subscribe(cb)` - 시험이 `emit` · `status`로 흉내), Storage(`messages` · `stories` 버킷 `upload` · `createSignedUrls`)를 흉내 낸다.
 * `messages`는 (couple_id, client_msg_id)가 겹치면 23505를 돌려준다(진짜 유니크 제약처럼). 실제 주소 · 키는 어디에도 없다.
 */
import { vi } from 'vitest'
import { attemptQueuedPhoto, type PhotoFs } from '@/services/chatPhotoCore'
import { sendMessage, type ChatDb } from '@/services/chatCore'
import { chatQueueStorageKey, type QueuedMessage } from '@/utils/chatQueue'
import { setSupabaseForTest, type WebSupabase } from '../../auth/client'
import { PhotoQueueHub } from '../../photoQueue/photoQueueHub'
import type { PhotoQueueStore } from '../../photoQueue/photoQueueStore'
import { TextQueueHub, type TextQueueStore } from './textQueueHub'
import type { ChatHubs } from './useChatMessages'

export type Row = Record<string, unknown>

export interface ChatDbOptions {
  me: string
  messages?: Row[]
  stories?: Row[]
  profiles?: Row[]
  /** 메시지 삽입이 앞의 N번은 네트워크 오류로 던진다. */
  insertFailures?: number
  /** `Infinity`로 두면 끊김이 계속된다(시험이 `db.state.offline`을 바꿔도 된다). */
  offline?: boolean
}

export interface FakeChannel {
  name: string
  filter: Row | null
  event: ((payload: { eventType: string; new?: Row }) => void) | null
  status: ((s: string) => void) | null
}

export function makeChatDb(opts: ChatDbOptions) {
  const tables: Record<string, Row[]> = {
    messages: (opts.messages ?? []).map((r) => ({ deleted_at: null, read_at: null, media_path: null, body: null, ...r })),
    stories: (opts.stories ?? []).map((r) => ({ ...r })),
    profiles: (opts.profiles ?? []).map((r) => ({ ...r })),
    couples: [],
  }
  const state = { offline: opts.offline ?? false, insertFailures: opts.insertFailures ?? 0 }
  const inserts: Row[] = []
  const updates: { table: string; payload: Row; match: Row; neq: Row }[] = []
  const uploads: { bucket: string; path: string }[] = []
  const channels: FakeChannel[] = []
  const removed: string[] = []
  let seq = 0

  const from = (table: string) => {
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}
    let orderBy: { col: string; asc: boolean } | null = null
    let max: number | null = null
    const filters: Array<(r: Row) => boolean> = []
    const eqMatch: Row = {}
    const neqMatch: Row = {}
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.order = (col: string, o?: { ascending?: boolean }) => { orderBy = { col, asc: o?.ascending !== false }; return b }
    b.limit = (n: number) => { max = n; return b }
    b.eq = (c: string, v: unknown) => { eqMatch[c] = v; filters.push((r) => r[c] === v); return b }
    b.neq = (c: string, v: unknown) => { neqMatch[c] = v; filters.push((r) => r[c] !== v); return b }
    b.is = (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return b }
    b.gte = (c: string, v: string) => { filters.push((r) => String(r[c]) >= v); return b }
    b.or = () => b
    b.insert = (p: Row) => { mode = 'insert'; payload = p; return b }
    b.update = (p: Row) => { mode = 'update'; payload = p; return b }
    const run = (): { rows: Row[]; error: { code?: string; message: string } | null } => {
      const rows = tables[table] ?? []
      if (mode === 'insert') {
        if (state.offline) throw new TypeError('network')
        if (table === 'messages' && state.insertFailures > 0) {
          state.insertFailures -= 1
          throw new TypeError('network')
        }
        if (table === 'messages' && rows.some((r) => r.couple_id === payload.couple_id && r.client_msg_id === payload.client_msg_id)) {
          return { rows: [], error: { code: '23505', message: 'duplicate' } }
        }
        inserts.push({ table, ...payload })
        const row: Row = { id: `${table}-${++seq}`, deleted_at: null, read_at: null, sent_at: new Date().toISOString(), created_at: new Date().toISOString(), ...payload }
        rows.push(row)
        return { rows: [row], error: null }
      }
      let matched = rows.filter((r) => filters.every((f) => f(r)))
      if (mode === 'update') {
        updates.push({ table, payload, match: { ...eqMatch }, neq: { ...neqMatch } })
        for (const m of matched) Object.assign(m, payload)
        return { rows: matched, error: null }
      }
      if (orderBy) {
        const { col, asc } = orderBy
        matched = [...matched].sort((x, y) => {
          const a = String(x[col])
          const c = String(y[col])
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
      return o.rows[0] ? { data: o.rows[0], error: null } : { data: null, error: o.error ?? { code: 'PGRST116', message: 'no rows' } }
    }
    b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      try {
        const o = run()
        return Promise.resolve({ data: o.rows, error: o.error }).then(resolve, reject)
      } catch (e) {
        return Promise.reject(e).then(resolve, reject)
      }
    }
    return b
  }

  const storage = {
    from: (bucket: string) => ({
      upload: async (path: string) => {
        if (state.offline) throw new TypeError('network')
        uploads.push({ bucket, path })
        return { error: null }
      },
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.invalid/${bucket}/${path}` })), error: null }),
    }),
  }

  const channel = (name: string) => {
    const ch: FakeChannel = { name, filter: null, event: null, status: null }
    channels.push(ch)
    const api = {
      on: (_type: string, filter: Row, cb: (p: { eventType: string; new?: Row }) => void) => { ch.filter = filter; ch.event = cb; return api },
      subscribe: (cb: (s: string) => void) => { ch.status = cb; return api },
    }
    return api
  }

  const client = {
    from,
    storage,
    channel,
    removeChannel: vi.fn(async (c: unknown) => { removed.push(String(c)); return 'ok' }),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: opts.me } } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as WebSupabase

  return { client, tables, state, inserts, updates, uploads, channels, removed }
}

/** 서버 행(파트너가 보낸 메시지 등). */
export function messageRow(id: string, sentAt: string, over: Row = {}): Row {
  return {
    id, couple_id: 'c1', sender_id: 'you', body: `body-${id}`, media_path: null, sent_at: sentAt, read_at: null, client_msg_id: `cm-${id}`, deleted_at: null, ...over,
  }
}

export const CHAT_PROFILES: Row[] = [{ id: 'me', display_name: '세준' }, { id: 'you', display_name: '서영' }]

/** 가짜 서버 + 진짜 큐 허브 둘(가짜 서버 · 메모리 저장 · 메모리 파일). `shared`를 넘기면 같은 기기 저장을 이어받는다(앱 재시작 흉내). */
export interface ChatWorld {
  db: ReturnType<typeof makeChatDb>
  hubs: ChatHubs
  textStore: TextQueueStore & { data: Map<string, QueuedMessage[]> }
  files: Map<string, ArrayBuffer>
}

export function memoryTextStore() {
  const data = new Map<string, QueuedMessage[]>()
  return {
    data,
    load: async (coupleId: string) => data.get(chatQueueStorageKey(coupleId)) ?? [],
    save: async (coupleId: string, queue: QueuedMessage[]) => { data.set(chatQueueStorageKey(coupleId), queue) },
  }
}

export function memoryPhotoStore(): PhotoQueueStore {
  const data = new Map<string, unknown[]>()
  return {
    load: async (c, u) => (data.get(`${c}:${u}`) ?? []) as never,
    save: async (c, u, items) => { data.set(`${c}:${u}`, items) },
  }
}

export function makeChatWorld(opts: Partial<ChatDbOptions> = {}, shared?: Pick<ChatWorld, 'textStore' | 'files'>): ChatWorld {
  const db = makeChatDb({ me: 'me', ...opts })
  setSupabaseForTest(db.client)
  const files = shared?.files ?? new Map<string, ArrayBuffer>()
  const fs: PhotoFs = {
    copyIn: async (_src, id, ext) => { const p = `chat-photo-queue/${id}.${ext}`; files.set(p, new ArrayBuffer(8)); return p },
    exists: async (u) => files.has(u),
    readBytes: async (u) => files.get(u) as ArrayBuffer,
    remove: async (u) => { files.delete(u) },
  }
  const textStore = shared?.textStore ?? memoryTextStore()
  const text = new TextQueueHub({ send: (input) => sendMessage(db.client as unknown as ChatDb, input), store: textStore })
  const photo = new PhotoQueueHub({ attempt: (item) => attemptQueuedPhoto(db.client as unknown as ChatDb, item, fs), fs, store: memoryPhotoStore() })
  return { db, hubs: { text, photo }, textStore, files }
}

