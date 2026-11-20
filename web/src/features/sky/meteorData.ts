/**
 * 84-e 유성 데이터(MASTER 9-8-4 r80 · ROADMAP R137-1 · R137-2) - **읽기만**(하늘은 읽기 전용 · 서버 쓰기 0 · 새 RPC 0 · 마이그레이션 0).
 *
 *  - 후보 원천: 발행된 호의 다정한 말 코너 행(`corners`, `corner_type = 'sweet_words'` · `status = 'published'`) - 앱의 기존 읽기 권한
 *    (`012_rls_policies.sql` `corners_select`: 커플 구성원 · published)으로 읽는다. 쓰는 칸은 `payload.sub[]`(한 줄 선택)뿐이다.
 *  - 원문은 **코너 사본을 쓰지 않고** 지금 살아 있는 메시지 행에서 다시 읽는다(`messages_select`: 커플 구성원 · `deleted_at is null`).
 *    84-e부터 저장 내용에 `messageId`가 있으면 그 id로, 그 전에 발행된 호(id 없음)는 **보낸 사람(이름) + 시각(그 초 안)**으로 찾는다.
 *    숨김(`deleted_at`) · 탈퇴(행 삭제)로 행이 없으면 그 말은 건너뛴다.
 *  - 기기 저장: 범주 `meteor`(81- 모양 버전 · 읽을 때 검사, scope = 커플 id) - **잡은 말의 메시지 id와 마지막으로 떨어진 날짜만**(원문 0).
 *    커플 자료라 로그아웃 · 탈퇴 요청 · 계정 전환 · 해제 완료 때 지워진다(`deviceCache.ts` `COUPLE_KINDS`). 후보 원문은 메모리에만 둔다.
 */
import { useEffect, useState } from 'react'
import { getSupabase } from '../../auth/client'
import { readCache, writeCache } from '../../cache/deviceCache'
import { EMPTY_MEMORY, type MeteorCandidate, type MeteorMemory } from './meteorRules'

/** 이 파일이 쓰는 질의 모양 - `select`만(쓰기 0). */
interface Query extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): Query
  is(column: string, value: null): Query
  in(column: string, values: readonly unknown[]): Query
  gte(column: string, value: string): Query
  lt(column: string, value: string): Query
  order(column: string, opts?: { ascending?: boolean }): Query
  limit(n: number): Query
}
export interface MeteorDb {
  from(table: string): { select(columns: string): Query }
}

/** 다정한 말 코너의 한 줄 선택 하나(저장 내용에서 읽은 것 - 원문은 쓰지 않는다). */
export interface SweetSubRef {
  readonly messageId: string | null
  readonly speaker: string
  /** 보낸 시각(`attribution.at`). */
  readonly at: string
}

interface MessageRow { id: string; sender_id: string; body: string | null; sent_at: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** 코너 행들의 `content.payload.sub[]` -> 참조 목록. 모양이 아니면 그 항목만 건너뛴다(대화 턴 · 정황은 읽지 않는다). */
export function subRefsOf(rows: readonly unknown[]): SweetSubRef[] {
  const out: SweetSubRef[] = []
  for (const row of rows) {
    const payload = isObj(row) && isObj(row.content) && isObj(row.content.payload) ? row.content.payload : null
    const subs = payload && Array.isArray(payload.sub) ? payload.sub : []
    for (const s of subs) {
      if (!isObj(s) || typeof s.speaker !== 'string' || !isObj(s.attribution) || typeof s.attribution.at !== 'string') continue
      out.push({ messageId: typeof s.messageId === 'string' && s.messageId ? s.messageId : null, speaker: s.speaker, at: s.attribution.at })
    }
  }
  return out
}

const COLUMNS = 'id, sender_id, body, sent_at'

function toCandidate(r: MessageRow): MeteorCandidate | null {
  return typeof r.body === 'string' && r.body.trim() !== '' ? { id: r.id, senderId: r.sender_id, body: r.body, sentAt: r.sent_at } : null
}

async function rows(q: Query): Promise<MessageRow[]> {
  const { data, error } = await q
  if (error) throw error
  return Array.isArray(data) ? (data as MessageRow[]) : []
}

/** 살아 있는 메시지 행을 id로(커플 · 숨김 아님). 순서는 `ids` 순서, 없는 id는 빠진다. */
export async function fetchLiveMessages(db: MeteorDb, coupleId: string, ids: readonly string[]): Promise<MeteorCandidate[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const found = await rows(db.from('messages').select(COLUMNS).eq('couple_id', coupleId).is('deleted_at', null).in('id', unique))
  const byId = new Map(found.map((r) => [r.id, r] as const))
  return unique.map((id) => byId.get(id)).filter((r): r is MessageRow => r !== undefined).map(toCandidate).filter((c): c is MeteorCandidate => c !== null)
}

/** 84-e 전에 발행된 호(id 없음) - 보낸 사람(이름) + 시각(그 초 안)으로 찾는다. 못 찾으면 null(건너뜀). */
export async function findLegacyMessage(db: MeteorDb, coupleId: string, ref: SweetSubRef, names: Readonly<Record<string, string>>): Promise<MeteorCandidate | null> {
  const at = Date.parse(ref.at)
  if (Number.isNaN(at)) return null
  const from = new Date(Math.floor(at / 1000) * 1000).toISOString()
  const to = new Date(Math.floor(at / 1000) * 1000 + 1000).toISOString()
  const found = await rows(db.from('messages').select(COLUMNS).eq('couple_id', coupleId).is('deleted_at', null).gte('sent_at', from).lt('sent_at', to).order('sent_at', { ascending: true }))
  const hit = found.find((r) => names[r.sender_id] === ref.speaker)
  return hit ? toCandidate(hit) : null
}

/** 유성 후보 - 발행된 호의 다정한 말 한 줄 선택을 지금 살아 있는 행으로. 같은 메시지는 한 번. */
export async function fetchMeteorCandidates(db: MeteorDb, coupleId: string, names: Readonly<Record<string, string>>): Promise<MeteorCandidate[]> {
  const corners = await rows(
    db.from('corners').select('content').eq('couple_id', coupleId).eq('corner_type', 'sweet_words').eq('status', 'published') as unknown as Query,
  )
  const refs = subRefsOf(corners)
  if (refs.length === 0) return []
  const withId = await fetchLiveMessages(db, coupleId, refs.flatMap((r) => (r.messageId ? [r.messageId] : [])))
  const legacy: MeteorCandidate[] = []
  for (const ref of refs.filter((r) => r.messageId === null)) {
    const hit = await findLegacyMessage(db, coupleId, ref, names)
    if (hit) legacy.push(hit)
  }
  const seen = new Set<string>()
  return [...withId, ...legacy].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
}

// ---------------------------------------------------------------------------
// 기기 저장 - 메시지 id와 날짜만
// ---------------------------------------------------------------------------

export function readMeteorMemory(userId: string | null, coupleId: string | null): MeteorMemory {
  if (!coupleId) return EMPTY_MEMORY
  return readCache<MeteorMemory>(userId, 'meteor', coupleId) ?? EMPTY_MEMORY
}

export function writeMeteorMemory(userId: string | null, coupleId: string | null, memory: MeteorMemory): void {
  if (!coupleId) return
  // 원문이 섞이지 않게 칸을 골라 쓴다(id · 날짜만).
  writeCache(userId, 'meteor', { caught: memory.caught.map(String), lastDay: memory.lastDay }, coupleId)
}

// ---------------------------------------------------------------------------
// 훅
// ---------------------------------------------------------------------------

export interface MeteorSource {
  readonly loaded: boolean
  readonly candidates: readonly MeteorCandidate[]
}

/** 하늘을 열 때 한 번 후보를 읽는다(원문은 메모리에만). 꺼져 있거나 커플이 없으면 읽지 않는다. 실패하면 후보 0(표시 없음). */
export function useMeteorCandidates(input: { enabled: boolean; coupleId: string | null; names: Readonly<Record<string, string>>; namesReady: boolean }): MeteorSource {
  const [state, setState] = useState<MeteorSource>({ loaded: false, candidates: [] })
  const { enabled, coupleId, names, namesReady } = input
  const namesKey = Object.entries(names).sort().map(([k, v]) => `${k}=${v}`).join('|')
  useEffect(() => {
    let cancelled = false
    const db = getSupabase() as unknown as MeteorDb | null
    if (!enabled || !coupleId || !db || !namesReady) {
      setState({ loaded: !enabled || !coupleId || !db, candidates: [] })
      return
    }
    fetchMeteorCandidates(db, coupleId, names)
      .then((candidates) => { if (!cancelled) setState({ loaded: true, candidates }) })
      .catch(() => { if (!cancelled) setState({ loaded: true, candidates: [] }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, coupleId, namesKey, namesReady])
  return state
}

/** C03 - 잡은 말 전체를 지금 살아 있는 행으로(잡은 순서 · 없는 말은 건너뜀). */
export function useFallenWords(input: { open: boolean; coupleId: string | null; caught: readonly string[] }): { loaded: boolean; words: MeteorCandidate[] } {
  const [state, setState] = useState<{ loaded: boolean; words: MeteorCandidate[] }>({ loaded: false, words: [] })
  const key = input.caught.join('|')
  useEffect(() => {
    let cancelled = false
    const db = getSupabase() as unknown as MeteorDb | null
    if (!input.open || !input.coupleId || !db) {
      setState({ loaded: false, words: [] })
      return
    }
    fetchLiveMessages(db, input.coupleId, input.caught)
      .then((words) => { if (!cancelled) setState({ loaded: true, words }) })
      .catch(() => { if (!cancelled) setState({ loaded: true, words: [] }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.open, input.coupleId, key])
  return state
}
