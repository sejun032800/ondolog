/**
 * 데이트 기록 쓰기·읽기(U2, `56-`) - `dates` · `date_stops` · `data_entries`와 `entries` 버킷.
 *
 * 규칙 원본: .claude/state/prompts/phase-7/56-ui-builder-u2-feed-upload.md "기록 규칙" 1~8.
 * 순수 규칙(날짜 기본값·stop 배치·파생 칸 계산)은 `src/utils/dateRecord.ts`에 있고 여기는 저장소 호출만 한다.
 *
 * ── 지키는 것 ────────────────────────────────────────────────────────────────
 * - **앱이 쓰지 않는 값**: `dates.title` · `narrative` · `is_new_region`(생성 단계가 쓴다), `dates.region`(규칙에 없다),
 *   `data_entries.thumb_path`(썸네일 의존성을 들이지 않는다). 이 파일의 어떤 insert·update도 이 칸을 건드리지 않는다.
 * - **상대의 기록은 읽기만**: 쓰는 행은 `author_id = 나`인 `data_entries`뿐이다. 상대의 사진·메모 행은 읽기만 한다.
 *   (`dates`·`date_stops`는 커플 공용 행이라 RLS가 두 사람 모두에게 쓰기를 허용한다 - 파생 칸·stop 배치만 고친다.)
 * - **커플 행을 만들지 않는다.** `findRecordingCouple`은 이미 있는 pending·active 행만 찾는다(규칙 6).
 * - `data_entries.date_stop_id`의 배치는 규칙 4(`assignStop`)가 정한다. 상대의 사진 행은 고치지 않는다 -
 *   E03은 저장된 값이 아니라 같은 규칙으로 배치를 다시 계산해 그린다.
 * - 사진은 원본을 그대로 올린다(리사이즈·재압축 없음). 인쇄용 PDF 경로는 이 파일이 모른다.
 *
 * 저장소 클라이언트와 파일 읽기는 인자로 받는다(`Db`, `RecordDeps`) - 앱은 `supabase`와 `fetch`를, 원격 실증 스크립트는
 * 사용자 세션 클라이언트를 넘긴다. 둘 다 같은 함수를 지난다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assignStop,
  buildStops,
  deriveDateFields,
  entryStoragePath,
  firstLine,
  sequenceStops,
  type PickedPhoto,
  type PlaceInput,
  arrivalIso,
  kstMidnightIso,
} from '../utils/dateRecord'

export type Db = Pick<SupabaseClient, 'from' | 'storage'>

export const ENTRIES_BUCKET = 'entries'
/** 사진 서명 URL 유효 시간 - 화면에 떠 있는 동안만 필요하다. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60
const IN_CHUNK = 100
const SEQ_TEMP_OFFSET = 1000

export interface RecordDeps {
  /** 사진 파일의 바이트. 앱은 `fetch(uri).arrayBuffer()`. */
  readBytes: (uri: string) => Promise<ArrayBuffer>
  newId: () => string
  /** 업로드 재시도 사이 대기(ms). 시험은 0을 넘긴다. */
  retryDelayMs?: number
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? '알 수 없는 오류'}`)
}

async function sleep(ms: number): Promise<void> {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms))
}

/** 같은 일을 최대 `attempts`번. 마지막 오류를 던진다. */
export async function withRetry<T>(run: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run()
    } catch (e) {
      last = e
      if (i < attempts - 1) await sleep(delayMs)
    }
  }
  throw last
}

// ---------------------------------------------------------------------------
// 규칙 6 - 기록할 커플 행
// ---------------------------------------------------------------------------

export interface RecordingCouple {
  id: string
  status: 'pending' | 'active'
}

/**
 * 이 유저가 기록할 수 있는 커플 행(pending 또는 active). **없으면 null이고 만들지 않는다.**
 * 있으면 그 커플로 기록하고, 연결되면(`redeemInviteCode`가 같은 행을 active로 바꾼다) 기록이 그대로 이어진다.
 */
export async function findRecordingCouple(db: Db, userId: string): Promise<RecordingCouple | null> {
  const { data, error } = await db
    .from('couples')
    .select('id, status')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle()
  if (error) fail('커플 조회 실패', error)
  if (!data) return null
  return { id: data.id as string, status: data.status as 'pending' | 'active' }
}

// ---------------------------------------------------------------------------
// 쓰기 - 데이트 하나 기록
// ---------------------------------------------------------------------------

export interface StopRow {
  id: string
  seq: number
  arrived_at: string
  place_name: string | null
}

export interface RecordDateInput {
  coupleId: string
  userId: string
  dateOn: string
  places: readonly PlaceInput[]
  photos: readonly PickedPhoto[]
  memo: string
}

export interface RecordDateResult {
  dateId: string
  createdDate: boolean
  photoEntryIds: string[]
  /** 올리지 못한 사진(재시도 뒤에도 실패). 이 사진의 행은 만들지 않았다. */
  failedPhotos: number
  memoEntryId: string | null
}

async function ensureDate(
  db: Db,
  coupleId: string,
  dateOn: string,
): Promise<{ id: string; created: boolean }> {
  const find = async () => {
    const { data, error } = await db
      .from('dates')
      .select('id, deleted_at')
      .eq('couple_id', coupleId)
      .eq('date_on', dateOn)
      .maybeSingle()
    if (error) fail('데이트 조회 실패', error)
    return data as { id: string; deleted_at: string | null } | null
  }

  const existing = await find()
  if (existing) {
    if (existing.deleted_at !== null) {
      // 지워진 같은 날짜를 다시 기록하면 그 데이트를 되살린다(unique (couple_id, date_on)).
      const { error } = await db.from('dates').update({ deleted_at: null }).eq('id', existing.id)
      if (error) fail('데이트 복구 실패', error)
    }
    return { id: existing.id, created: false }
  }

  // 규칙 1 - source = 'manual', user_confirmed = true. title·narrative·is_new_region·region은 쓰지 않는다.
  const { data, error } = await db
    .from('dates')
    .insert({ couple_id: coupleId, date_on: dateOn, source: 'manual', user_confirmed: true })
    .select('id')
    .single()
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const again = await find() // 동시에 같은 날짜를 만든 경우
      if (again) return { id: again.id, created: false }
    }
    fail('데이트 생성 실패', error)
  }
  return { id: (data as { id: string }).id, created: true }
}

async function loadStops(db: Db, dateId: string): Promise<StopRow[]> {
  const { data, error } = await db
    .from('date_stops')
    .select('id, seq, arrived_at, place_name')
    .eq('date_id', dateId)
    .order('seq', { ascending: true })
  if (error) fail('stop 조회 실패', error)
  return (data ?? []) as StopRow[]
}

/**
 * stop을 도착 시각 순(같으면 기존 seq 순)으로 다시 번호 매긴다. seq는 (date_id, seq) unique라
 * 바꿔야 할 때는 임시 번호(+1000)를 거친 뒤 최종 번호를 쓴다. 바뀔 것이 없으면 쓰지 않는다.
 */
export async function resequenceStops(db: Db, dateId: string): Promise<StopRow[]> {
  const stops = await loadStops(db, dateId)
  const ordered = sequenceStops(stops.map((s) => ({ ...s, arrivedAt: s.arrived_at, inputIndex: s.seq })))
  const changes = ordered.map((s, i) => ({ id: s.id, from: s.seq, to: i })).filter((c) => c.from !== c.to)
  if (changes.length === 0) return stops

  for (const c of changes) {
    const { error } = await db.from('date_stops').update({ seq: c.to + SEQ_TEMP_OFFSET }).eq('id', c.id)
    if (error) fail('stop 번호 임시 변경 실패', error)
  }
  for (const c of changes) {
    const { error } = await db.from('date_stops').update({ seq: c.to }).eq('id', c.id)
    if (error) fail('stop 번호 변경 실패', error)
  }
  return loadStops(db, dateId)
}

/** 새 장소를 stop으로 더한다. 기존 stop이 있고 새 장소가 없으면 아무것도 더하지 않는다(규칙 4). */
async function addStops(
  db: Db,
  coupleId: string,
  dateId: string,
  dateOn: string,
  places: readonly PlaceInput[],
): Promise<StopRow[]> {
  const existing = await loadStops(db, dateId)
  const planned = buildStops(places, dateOn)
  const hasNamed = planned.some((p) => p.placeName !== null)
  if (existing.length > 0 && !hasNamed) return existing

  const toInsert = existing.length === 0 ? planned : planned.filter((p) => p.placeName !== null)
  const base = existing.length === 0 ? 0 : Math.max(...existing.map((s) => s.seq)) + 1
  const rows = toInsert.map((p, k) => ({
    date_id: dateId,
    couple_id: coupleId,
    seq: base + k,
    arrived_at: p.arrivedAt,
    place_name: p.placeName,
  }))
  const { error } = await db.from('date_stops').insert(rows)
  if (error) fail('stop 생성 실패', error)
  return resequenceStops(db, dateId)
}

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
}

/**
 * 규칙 1~7 - 데이트 하나를 기록한다. 같은 (커플, 날짜)면 그 데이트에 더한다.
 *
 * 순서: 사진 업로드(스토리지) -> 데이트 -> stop -> 사진 행(배치 포함) -> 메모 행 -> 파생 칸.
 * 업로드가 전부 실패하면 DB에 아무것도 쓰기 전에 던진다(빈 데이트가 남지 않는다).
 * 사진 몇 장만 실패하면 나머지로 기록하고 `failedPhotos`로 알린다.
 */
export async function recordDate(db: Db, deps: RecordDeps, input: RecordDateInput): Promise<RecordDateResult> {
  const memo = input.memo.trim()
  if (input.photos.length === 0 && memo.length === 0) {
    throw new Error('기록할 사진이나 메모가 없어요')
  }
  const retryDelay = deps.retryDelayMs ?? 400

  // 1. 사진 원본 업로드(리사이즈 없음). 경로: {couple_id}/{entry_id}.{ext}
  const uploaded: { entryId: string; path: string; photo: PickedPhoto }[] = []
  let failedPhotos = 0
  for (const photo of input.photos) {
    const entryId = deps.newId()
    const path = entryStoragePath(input.coupleId, entryId, photo.ext)
    try {
      await withRetry(
        async () => {
          const bytes = await deps.readBytes(photo.uri)
          const { error } = await db.storage.from(ENTRIES_BUCKET).upload(path, bytes, {
            contentType: photo.mimeType ?? CONTENT_TYPE[photo.ext] ?? 'image/jpeg',
            upsert: false,
          })
          if (error) throw new Error(error.message)
        },
        3,
        retryDelay,
      )
      uploaded.push({ entryId, path, photo })
    } catch {
      failedPhotos += 1
    }
  }
  if (input.photos.length > 0 && uploaded.length === 0 && memo.length === 0) {
    throw new Error('사진을 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요')
  }

  // 2. 데이트와 stop
  const date = await ensureDate(db, input.coupleId, input.dateOn)
  const stops = await addStops(db, input.coupleId, date.id, input.dateOn, input.places)

  // 3. 사진 행 - 규칙 4로 stop에 붙인다
  const photoEntryIds: string[] = []
  for (const u of uploaded) {
    const stop = assignStop(
      u.photo.capturedAt,
      stops.map((s) => ({ ...s, arrivedAt: s.arrived_at })),
    )
    const { error } = await db.from('data_entries').insert({
      id: u.entryId,
      couple_id: input.coupleId,
      author_id: input.userId,
      date_id: date.id,
      date_stop_id: stop?.id ?? null,
      entry_type: 'photo',
      storage_path: u.path,
      byte_size: u.photo.byteSize,
      width: u.photo.width,
      height: u.photo.height,
      captured_at: u.photo.capturedAt,
      lat: u.photo.lat,
      lng: u.photo.lng,
    })
    if (error) fail('사진 기록 실패', error)
    photoEntryIds.push(u.entryId)
  }

  // 4. 메모 - 데이트 단위(date_stop_id 비움), 작성자 = 나
  let memoEntryId: string | null = null
  if (memo.length > 0) {
    memoEntryId = deps.newId()
    const { error } = await db.from('data_entries').insert({
      id: memoEntryId,
      couple_id: input.coupleId,
      author_id: input.userId,
      date_id: date.id,
      date_stop_id: null,
      entry_type: 'memo',
      text_content: memo,
    })
    if (error) fail('메모 기록 실패', error)
  }

  // 5. 규칙 7 - 파생 칸
  await refreshDateDerived(db, date.id, input.dateOn)

  return { dateId: date.id, createdDate: date.created, photoEntryIds, failedPhotos, memoEntryId }
}

/**
 * 규칙 7 - 지금 보이는 사진·메모로 `photo_count` · `duration_minutes` · `has_user_note`를 다시 맞춘다.
 * `title` · `narrative` · `is_new_region`은 쓰지 않는다. 잠긴(열람 불가) 항목은 조회되지 않아 세지 않는다(E12는 M4-4).
 */
export async function refreshDateDerived(db: Db, dateId: string, dateOn: string): Promise<void> {
  const { data, error } = await db
    .from('data_entries')
    .select('entry_type, captured_at')
    .eq('date_id', dateId)
    .is('deleted_at', null)
  if (error) fail('파생 칸 조회 실패', error)
  const rows = (data ?? []) as { entry_type: string; captured_at: string | null }[]
  const photos = rows.filter((r) => r.entry_type === 'photo').map((r) => r.captured_at)
  const memos = rows.filter((r) => r.entry_type === 'memo').length
  const fields = deriveDateFields(photos, memos, dateOn)
  const { error: updateError } = await db.from('dates').update(fields).eq('id', dateId)
  if (updateError) fail('파생 칸 갱신 실패', updateError)
}

// ---------------------------------------------------------------------------
// E15 - 장소 고치기
// ---------------------------------------------------------------------------

export interface UpdateStopInput {
  stopId: string
  dateId: string
  dateOn: string
  userId: string
  placeName: string
  /** `HH:MM` 또는 비움(비우면 "시각 모름"). */
  arrivalClock: string | null
}

/**
 * 장소 이름(직접 입력)과 도착 시각을 고친다. `place_provider_id` · `lat` · `lng`는 건드리지 않는다(지도·검색은 출시 후).
 * 고친 뒤 stop 번호를 다시 매기고, **내가 올린** 사진의 배치를 규칙 4로 다시 맞춘다(상대의 사진 행은 쓰지 않는다).
 */
export async function updateStop(db: Db, input: UpdateStopInput): Promise<void> {
  const name = input.placeName.trim()
  const { error } = await db
    .from('date_stops')
    .update({
      place_name: name.length > 0 ? name : null,
      arrived_at: arrivalIso(input.dateOn, input.arrivalClock) ?? kstMidnightIso(input.dateOn),
    })
    .eq('id', input.stopId)
    .eq('date_id', input.dateId)
  if (error) fail('장소 수정 실패', error)
  await resequenceStops(db, input.dateId)
  await syncOwnPlacement(db, input.dateId, input.userId)
}

/**
 * 내가 올린 사진의 `date_stop_id`를 규칙 4의 결과와 맞춘다. 다른 사람의 행은 읽기만 한다.
 * 화면은 저장된 값이 아니라 같은 규칙으로 다시 계산해 그리므로, 이 동기화가 늦어도 보이는 배치는 같다.
 */
export async function syncOwnPlacement(db: Db, dateId: string, userId: string): Promise<number> {
  const stops = await loadStops(db, dateId)
  const { data, error } = await db
    .from('data_entries')
    .select('id, author_id, captured_at, date_stop_id')
    .eq('date_id', dateId)
    .eq('entry_type', 'photo')
    .is('deleted_at', null)
  if (error) fail('사진 조회 실패', error)
  const rows = (data ?? []) as { id: string; author_id: string; captured_at: string | null; date_stop_id: string | null }[]
  const withArrival = stops.map((s) => ({ ...s, arrivedAt: s.arrived_at }))
  let changed = 0
  for (const row of rows) {
    if (row.author_id !== userId) continue
    const target = assignStop(row.captured_at, withArrival)
    if (!target || target.id === row.date_stop_id) continue
    const { error: updateError } = await db
      .from('data_entries')
      .update({ date_stop_id: target.id })
      .eq('id', row.id)
      .eq('author_id', userId)
    if (updateError) fail('사진 배치 수정 실패', updateError)
    changed += 1
  }
  return changed
}

// ---------------------------------------------------------------------------
// 읽기 - 피드·상세
// ---------------------------------------------------------------------------

export interface DateRow {
  id: string
  couple_id: string
  date_on: string
  region: string | null
  title: string | null
  photo_count: number
  duration_minutes: number | null
  has_user_note: boolean
}

export interface EntryRow {
  id: string
  date_id: string | null
  date_stop_id: string | null
  author_id: string
  entry_type: 'photo' | 'memo' | 'drawing'
  storage_path: string | null
  text_content: string | null
  width: number | null
  height: number | null
  captured_at: string | null
  created_at: string
}

const DATE_COLUMNS = 'id, couple_id, date_on, region, title, photo_count, duration_minutes, has_user_note'
const ENTRY_COLUMNS =
  'id, date_id, date_stop_id, author_id, entry_type, storage_path, text_content, width, height, captured_at, created_at'

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 이 유저에게 보이는(RLS 범위) 데이트 목록. 최근 날짜 먼저. */
export async function fetchDates(db: Db): Promise<DateRow[]> {
  const { data, error } = await db
    .from('dates')
    .select(DATE_COLUMNS)
    .is('deleted_at', null)
    .order('date_on', { ascending: false })
    .limit(400)
  if (error) fail('데이트 목록 조회 실패', error)
  return (data ?? []) as DateRow[]
}

export async function fetchDate(db: Db, dateId: string): Promise<DateRow | null> {
  const { data, error } = await db.from('dates').select(DATE_COLUMNS).eq('id', dateId).is('deleted_at', null).maybeSingle()
  if (error) fail('데이트 조회 실패', error)
  return (data as DateRow | null) ?? null
}

/** 데이트들에 속한 사진·메모 행(읽기만). */
export async function fetchEntriesOfDates(db: Db, dateIds: readonly string[]): Promise<EntryRow[]> {
  const rows: EntryRow[] = []
  for (const ids of chunks(dateIds, IN_CHUNK)) {
    const { data, error } = await db
      .from('data_entries')
      .select(ENTRY_COLUMNS)
      .in('date_id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) fail('기록 조회 실패', error)
    rows.push(...((data ?? []) as EntryRow[]))
  }
  return rows
}

export async function fetchStopsOfDate(db: Db, dateId: string): Promise<StopRow[]> {
  return loadStops(db, dateId)
}

/** 이 유저와 상대(RLS가 허용하는 둘)의 표시 이름. */
export async function fetchDisplayNames(db: Db, userIds: readonly string[]): Promise<Record<string, string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return {}
  const { data, error } = await db.from('profiles').select('id, display_name').in('id', unique)
  if (error) fail('이름 조회 실패', error)
  const out: Record<string, string> = {}
  for (const r of (data ?? []) as { id: string; display_name: string }[]) out[r.id] = r.display_name
  return out
}

/** 사진 경로 -> 서명 URL. 못 만든 경로는 빠진다(화면은 빈 면으로 둔다). */
export async function signPhotoPaths(db: Db, paths: readonly string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  const out: Record<string, string> = {}
  for (const batch of chunks(unique, IN_CHUNK)) {
    const { data, error } = await db.storage.from(ENTRIES_BUCKET).createSignedUrls(batch, SIGNED_URL_TTL_SECONDS)
    if (error || !data) continue
    for (const item of data) {
      if (item.path && item.signedUrl) out[item.path] = item.signedUrl
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 읽기 모델 - 순수 변환
// ---------------------------------------------------------------------------

export interface FeedDateItem {
  id: string
  dateOn: string
  region: string | null
  title: string | null
  photoCount: number
  memoCount: number
  coverPath: string | null
  /** 그 데이트의 메모 첫 줄(가장 먼저 쓴 메모). 없으면 null. */
  quote: { text: string; authorId: string } | null
}

/** 사진 정렬: 촬영 시각 먼저(없는 것은 뒤), 같으면 올린 순서. */
export function comparePhotos(a: EntryRow, b: EntryRow): number {
  const ta = a.captured_at ? Date.parse(a.captured_at) : Number.POSITIVE_INFINITY
  const tb = b.captured_at ? Date.parse(b.captured_at) : Number.POSITIVE_INFINITY
  if (ta !== tb) return ta < tb ? -1 : 1
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function buildFeedItems(dates: readonly DateRow[], entries: readonly EntryRow[]): FeedDateItem[] {
  const byDate = new Map<string, EntryRow[]>()
  for (const e of entries) {
    if (!e.date_id) continue
    const list = byDate.get(e.date_id) ?? []
    list.push(e)
    byDate.set(e.date_id, list)
  }
  return dates.map((d) => {
    const own = byDate.get(d.id) ?? []
    const photos = own.filter((e) => e.entry_type === 'photo' && e.storage_path).sort(comparePhotos)
    const memos = own
      .filter((e) => e.entry_type === 'memo')
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1))
    let quote: FeedDateItem['quote'] = null
    for (const m of memos) {
      const line = firstLine(m.text_content)
      if (line) {
        quote = { text: line, authorId: m.author_id }
        break
      }
    }
    return {
      id: d.id,
      dateOn: d.date_on,
      region: d.region,
      title: d.title,
      photoCount: photos.length,
      memoCount: memos.length,
      coverPath: photos[0]?.storage_path ?? null,
      quote,
    }
  })
}
