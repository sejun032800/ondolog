/**
 * 날짜별 데이트 기록 읽기 - **메인(온도 v0)과 우리의 하늘이 함께 쓰는 한 곳**(R101-2). 읽기만 한다(서버 쓰기 0 · 새 RPC 0).
 *  - `dates`(지우지 않은 것)의 `id · date_on` -> 그 날의 `date_stops` · `data_entries`(지우지 않은 사진 · 메모).
 *  - 여기서는 **수만 세고** "함께한 하루인가"는 판정하지 않는다. 판정은 루트 엔진 `togetherDates` / `isTogetherDay` 한 곳이다.
 *  - Supabase 기본 최대 1000행이라 `dates` · 항목은 페이지로 나눠 읽고, `in` 목록은 조각으로 나눠 읽는다.
 */
import type { DayRecordCounts } from '@/engine/togetherDay'

// 호출부 · 시험이 같은 모양으로 쓰는 느슨한 질의 형태.
type Q = {
  select: (cols: string) => Q
  eq: (c: string, v: unknown) => Q
  is: (c: string, v: null) => Q
  gte: (c: string, v: string) => Q
  lte: (c: string, v: string) => Q
  in: (c: string, v: readonly unknown[]) => Q
  order: (c: string, o?: { ascending: boolean }) => Q
  range: (a: number, b: number) => Q
} & PromiseLike<{ data: unknown; error: unknown }>
export type DayRecordDb = { from: (table: string) => Q }

export const DAY_RECORD_PAGE = 1000
const IN_CHUNK = 50

export interface DayStop { id: string; seq: number; arrivedAt: string; placeName: string | null }
export interface DayPhoto {
  id: string
  authorId: string
  storagePath: string
  capturedAt: string | null
  createdAt: string
  dateStopId: string | null
  accessLocked: boolean
}
export interface DayMemo { id: string; authorId: string; text: string; createdAt: string; dateStopId: string | null }

export interface DayRecord {
  /** `dates.id` - 별의 자리 · 반짝임의 씨앗. */
  id: string
  /** KST `YYYY-MM-DD` */
  date: string
  stops: DayStop[]
  photos: DayPhoto[]
  memos: DayMemo[]
  counts: DayRecordCounts
}

interface EntryRaw {
  id: string
  date_id: string | null
  date_stop_id: string | null
  author_id: string
  entry_type: string
  storage_path: string | null
  text_content: string | null
  captured_at: string | null
  created_at: string
  access_locked: boolean | null
}
interface StopRaw { id: string; date_id: string; seq: number; arrived_at: string; place_name: string | null }

async function pageAll<T>(run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; page < 100; page += 1) {
    const from = page * DAY_RECORD_PAGE
    const { data, error } = await run(from, from + DAY_RECORD_PAGE - 1)
    if (error) throw new Error(`기록 읽기 실패(${what})`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < DAY_RECORD_PAGE) break
  }
  return out
}

/** 기간(양 끝 포함, KST 날짜)의 데이트 기록. 기간을 주지 않으면 전부. 날짜 오름차순. */
export async function readDayRecords(db: DayRecordDb, coupleId: string, range: { from?: string; to?: string } = {}): Promise<DayRecord[]> {
  const dateRows = await pageAll<{ id: string; date_on: string }>((a, b) => {
    let q = db.from('dates').select('id, date_on').eq('couple_id', coupleId).is('deleted_at', null)
    if (range.from) q = q.gte('date_on', range.from)
    if (range.to) q = q.lte('date_on', range.to)
    return q.order('date_on', { ascending: true }).order('id', { ascending: true }).range(a, b)
  }, '데이트')
  if (dateRows.length === 0) return []
  const byId = new Map<string, DayRecord>(dateRows.map((d) => [d.id, { id: d.id, date: d.date_on, stops: [], photos: [], memos: [], counts: { stops: 0, photos: 0, memos: 0 } }]))
  const ids = dateRows.map((d) => d.id)
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const stops = await pageAll<StopRaw>((a, b) => db.from('date_stops').select('id, date_id, seq, arrived_at, place_name').in('date_id', chunk).order('date_id').order('seq', { ascending: true }).range(a, b), '구간')
    for (const s of stops) byId.get(s.date_id)?.stops.push({ id: s.id, seq: s.seq, arrivedAt: s.arrived_at, placeName: s.place_name })
    const entries = await pageAll<EntryRaw>((a, b) =>
      db.from('data_entries')
        .select('id, date_id, date_stop_id, author_id, entry_type, storage_path, text_content, captured_at, created_at, access_locked')
        .in('date_id', chunk).is('deleted_at', null).order('created_at', { ascending: true }).order('id', { ascending: true }).range(a, b), '항목')
    for (const e of entries) {
      const rec = e.date_id ? byId.get(e.date_id) : undefined
      if (!rec) continue
      if (e.entry_type === 'photo' && e.storage_path) {
        rec.photos.push({ id: e.id, authorId: e.author_id, storagePath: e.storage_path, capturedAt: e.captured_at, createdAt: e.created_at, dateStopId: e.date_stop_id, accessLocked: e.access_locked === true })
      } else if (e.entry_type === 'memo') {
        rec.memos.push({ id: e.id, authorId: e.author_id, text: e.text_content ?? '', createdAt: e.created_at, dateStopId: e.date_stop_id })
      }
    }
  }
  for (const r of byId.values()) r.counts = { stops: r.stops.length, photos: r.photos.length, memos: r.memos.length }
  return [...byId.values()]
}

/** 엔진 `togetherDates` / 온도 v0 `recordDays`가 받는 모양. */
export function toDayCounts(records: readonly DayRecord[]): ({ date: string } & DayRecordCounts)[] {
  return records.map((r) => ({ date: r.date, ...r.counts }))
}
