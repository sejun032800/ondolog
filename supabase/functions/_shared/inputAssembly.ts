/**
 * 입력 조립 - 한 커플의 한 기간에 대해 채팅·사진·데이트를 조회하고, 17-1 재소환을 거쳐 코너 입력 레코드를
 * 만든다 (docs/ONDOLOG_MASTER.md §17-0-9, r49).
 *
 * 레코드 모양의 원본은 코드 타입(`corners/cornerCommon.ts`)이다. 이 파일은 그 타입을 채울 뿐 모양을 다시
 * 정의하지 않는다. 위치가 `_shared/` 바로 아래인 것은 조회가 비동기이고 규칙 G가 `corners/` 안의 비동기를
 * 막기 때문이다.
 *
 * ── 쓰는 기존 함수 (규칙을 새로 짜지 않는다) ─────────────────────────────────
 * - 기간 판정: `isRecordInPeriod` (`cornerPipeline.ts`). 쿼리의 `gte`/`lt`는 조회 범위를 좁힐 뿐이고 기간보다
 *   좁지 않다(B). 기간 라벨(`periodLabelOf`)은 골격이 봉투 머리에서만 만들어 이 파일은 부르지 않는다.
 * - 시간대 라벨: `timeOfDayLabel`. 시각 형식 변환: `kstTime.ts`(E).
 * - 소속 오류: `CoupleMembershipError`. 새 오류 종류를 만들지 않는다(A). DB 오류·무결성 오류는 일반 `Error`다.
 *
 * ── DB 접근 (A) ───────────────────────────────────────────────────────────
 * service_role 클라이언트가 읽는다(배치라 사용자 세션이 없다). RLS를 우회하므로 RLS가 하던 조건 셋을 쿼리가 다시
 * 건다. (1) `couple_id` = 호출자 맥락의 커플, (2) `deleted_at is null`(컬럼이 있는 테이블), (3) `data_entries`는
 * `is_entry_visible(couple_id, access_locked)`와 같은 결과 - 커플이 유료면 전부 열람 가능, 아니면
 * `access_locked = false`만(`011_rls_helpers.sql`·`012_rls_policies.sql`의 `entries_select`).
 * 반환된 행의 `couple_id`가 맥락의 커플과 다르면 `CoupleMembershipError`를 던진다.
 *
 * 예외 둘(각각 문서가 정한 자리):
 * - `profiles`는 `couple_id` 컬럼이 없어 (1)을 걸 수 없고 `id`로만 읽는다. `deleted_at`은 **걸지 않는다** - 탈퇴
 *   유예 중에도 행이 있으므로 이름을 그대로 쓴다(F "화자 이름").
 * - 잠긴 항목 건수를 세는 보조 쿼리(`access_locked = true`)는 (3)의 보수(complement)다. 입력에 들어가는 행이 아니라
 *   세기만 한다(F "사유별 제외 건수").
 *
 * ── 하지 않는 것 (G, 발행 경로의 일) ──────────────────────────────────────
 * `last_featured_at`·`feature_count`는 읽기만 한다. 채팅 입력량 상한, 17-1 선별 상한(이번 기간 데이트는 전부
 * 넘긴다), 17-5 기간 넓히기(받은 `context.period`만 조회한다)도 하지 않는다.
 */

import {
  CoupleMembershipError,
  InvalidCornerContextError,
  isRecordInPeriod,
  type CornerContext,
} from './cornerPipeline.ts'
import type {
  ChatMessageRecord,
  DateRecord,
  DateStopSource,
  PhotoRecord,
} from './corners/cornerCommon.ts'
import type { PhotoRef, UserNote } from '../../../src/types/corners/storedContent.ts'
import { timeOfDayLabel } from './timeOfDayLabel.ts'
import {
  kstClockHHmm,
  kstDateExclusiveUpperBound,
  kstDateString,
  kstDateToInstant,
  kstDisplayStamp,
  kstIsoString,
  kstShiftMonths,
} from './kstTime.ts'

// ---------------------------------------------------------------------------
// 클라이언트 - 필요한 메서드만 담은 구조 타입 (coeffLookup.ts와 같은 이유)
// ---------------------------------------------------------------------------

export type AssemblyRow = Readonly<Record<string, unknown>>

export interface AssemblyQueryResult {
  readonly data: readonly AssemblyRow[] | null
  readonly error: { readonly message: string } | null
}

/** `await`하면 결과가 나오는 필터 체인. 실제 Supabase 쿼리 빌더는 구조적으로 이 타입을 만족한다. */
export interface AssemblyFilterBuilder extends PromiseLike<AssemblyQueryResult> {
  eq(column: string, value: string | boolean): AssemblyFilterBuilder
  is(column: string, value: null): AssemblyFilterBuilder
  in(column: string, values: readonly string[]): AssemblyFilterBuilder
  gte(column: string, value: string): AssemblyFilterBuilder
  lt(column: string, value: string): AssemblyFilterBuilder
  order(column: string, options: { readonly ascending: boolean }): AssemblyFilterBuilder
  range(from: number, to: number): AssemblyFilterBuilder
}

export interface InputAssemblyClient {
  from(table: string): { select(columns: string): AssemblyFilterBuilder }
}

// ---------------------------------------------------------------------------
// 반환값
// ---------------------------------------------------------------------------

/**
 * 사유별 제외 건수(F). 운영 기록용이다 - 코너 입력에 들어가지 않는다.
 * 시험·운영이 "왜 이 사진이 안 실렸나"를 추적할 수 있게 조용히 빠지는 일을 없앤다.
 */
export interface InputExclusions {
  /** 본문이 없는 미디어 메시지(`body is null`). 이번 기간 조회 범위 안. */
  readonly messagesWithoutBody: number
  /** `captured_at`이 null이고 데이트에 묶이지 않은 사진(E). 시각이 없어 기간을 알 수 없으므로 기간과 무관하게 센다. */
  readonly standalonePhotosWithoutTime: number
  /** `width`·`height` 중 하나라도 null인 사진(F). 이번 기간 입력(이번 기간 데이트·재소환 포함)에서 빠진 것. */
  readonly photosWithoutSize: number
  /**
   * 잠겨서 열람 불가인 `data_entries`(D). **이번 기간 범위**(촬영 시각이 기간 안인 사진, 이번 기간 데이트에
   * 묶인 항목)만 센다. 유료 커플은 열람 가능하므로 0이다.
   */
  readonly lockedEntries: number
}

export interface AssembledInput {
  readonly messages: readonly ChatMessageRecord[]
  readonly photos: readonly PhotoRecord[]
  /** 이번 기간 데이트(`recalled: false`)에 이어 재소환 데이트(`recalled: true`). */
  readonly dates: readonly DateRecord[]
  /** 위 셋을 이은 전체 - 골격의 `scopedRecords`에 넘기는 값. */
  readonly records: readonly (ChatMessageRecord | PhotoRecord | DateRecord)[]
  readonly exclusions: InputExclusions
}

// ---------------------------------------------------------------------------
// 상수 (MASTER §17-0-9-C)
// ---------------------------------------------------------------------------

/** 재소환 건수는 `max(0, RECALL_TARGET_TOTAL - 이번 기간 데이트 수)`. */
const RECALL_TARGET_TOTAL = 3
/** 재소환 간격 - KST 달력 기준 6개월. */
const RECALL_MIN_GAP_MONTHS = 6
/** PostgREST 한 번에 오는 행 상한을 넘는 조회는 쪼개서 읽는다. */
const PAGE_SIZE = 1000
/** `in (...)` 목록이 URL 길이를 넘지 않게 쪼개는 크기. */
const IN_CHUNK_SIZE = 100

const MESSAGE_COLUMNS = 'id, couple_id, sender_id, body, sent_at'
const DATE_COLUMNS = 'id, couple_id, date_on, region, photo_count, last_featured_at'
const STOP_COLUMNS = 'id, couple_id, date_id, seq, arrived_at, place_name, lat, lng'
const ENTRY_COLUMNS =
  'id, couple_id, author_id, date_id, date_stop_id, entry_type, storage_path, thumb_path, width, height, text_content, drawing_path, captured_at, created_at'

// ---------------------------------------------------------------------------
// 행 읽기 - 모양이 틀리면 지어내지 않고 던진다
// ---------------------------------------------------------------------------

function integrity(table: string, id: string, what: string): Error {
  return new Error(`입력 조립: ${table} 행(${id})의 ${what}`)
}

function reqStr(row: AssemblyRow, column: string, table: string): string {
  const v = row[column]
  if (typeof v !== 'string' || v.length === 0) throw integrity(table, String(row.id), `${column}가 문자열이 아니다`)
  return v
}

function optStr(row: AssemblyRow, column: string, table: string): string | null {
  const v = row[column]
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw integrity(table, String(row.id), `${column}가 문자열이 아니다`)
  return v
}

function optNum(row: AssemblyRow, column: string, table: string): number | null {
  const v = row[column]
  if (v === null || v === undefined) return null
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || Number.isNaN(n)) throw integrity(table, String(row.id), `${column}가 숫자가 아니다`)
  return n
}

function reqNum(row: AssemblyRow, column: string, table: string): number {
  const n = optNum(row, column, table)
  if (n === null) throw integrity(table, String(row.id), `${column}가 비어 있다`)
  return n
}

function reqDate(row: AssemblyRow, column: string, table: string): Date {
  const d = new Date(reqStr(row, column, table))
  if (Number.isNaN(d.getTime())) throw integrity(table, String(row.id), `${column}가 날짜가 아니다`)
  return d
}

function compare(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ---------------------------------------------------------------------------
// 조회 도구
// ---------------------------------------------------------------------------

async function fetchAll(
  table: string,
  make: () => AssemblyFilterBuilder,
  orderBy: readonly string[],
): Promise<readonly AssemblyRow[]> {
  const rows: AssemblyRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = make()
    for (const column of orderBy) query = query.order(column, { ascending: true })
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error !== null) throw new Error(`입력 조립: ${table} 조회 실패: ${error.message}`)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function chunked<T>(values: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += IN_CHUNK_SIZE) out.push(values.slice(i, i + IN_CHUNK_SIZE))
  return out
}

/** 결과 재확인(A) - 다른 커플의 행이 하나라도 있으면 새 오류 종류 없이 `CoupleMembershipError`. */
function assertRowsOfCouple(rows: readonly AssemblyRow[], table: string, coupleId: string): void {
  const offending = rows.filter((r) => r.couple_id !== coupleId).map((r) => String(r.id))
  if (offending.length > 0) {
    throw new CoupleMembershipError(
      coupleId,
      offending,
      `입력 조립: ${table} 조회 결과에 호출자 맥락(coupleId=${coupleId})이 아닌 커플의 행이 있다 (${offending.length}건: ${offending.join(', ')})`,
    )
  }
}

function assertContext(context: CornerContext): void {
  if (context.coupleId.length === 0) throw new InvalidCornerContextError(context.coupleId, '커플 식별자가 빈 문자열')
  const { start, end } = context.period
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new InvalidCornerContextError(context.coupleId, '기간의 시작·끝이 날짜가 아님')
  }
  if (start.getTime() > end.getTime()) {
    throw new InvalidCornerContextError(context.coupleId, '기간의 시작이 끝보다 늦음')
  }
}

// ---------------------------------------------------------------------------
// 내부 모양
// ---------------------------------------------------------------------------

interface DateRow {
  readonly id: string
  readonly dateOn: string
  readonly occurredAt: Date
  readonly region: string | null
  readonly photoCount: number
  readonly lastFeaturedAt: Date | null
}

function parseDate(row: AssemblyRow): DateRow {
  const dateOn = reqStr(row, 'date_on', 'dates')
  const last = optStr(row, 'last_featured_at', 'dates')
  const lastFeaturedAt = last === null ? null : new Date(last)
  if (lastFeaturedAt !== null && Number.isNaN(lastFeaturedAt.getTime())) {
    throw integrity('dates', String(row.id), 'last_featured_at가 날짜가 아니다')
  }
  return {
    id: reqStr(row, 'id', 'dates'),
    dateOn,
    occurredAt: kstDateToInstant(dateOn),
    region: optStr(row, 'region', 'dates'),
    photoCount: optNum(row, 'photo_count', 'dates') ?? 0,
    lastFeaturedAt,
  }
}

interface DateContent {
  readonly stops: readonly AssemblyRow[]
  readonly entries: readonly AssemblyRow[]
}

type RecallReason = 'anniversary' | 'never_featured' | 'sparse_month'

// ---------------------------------------------------------------------------
// 입력 조립
// ---------------------------------------------------------------------------

/**
 * 한 커플의 한 기간에 속한 채팅·사진·데이트와 17-1 재소환 데이트를 조회해 입력 레코드로 만든다.
 * 순서는 기간 내 조회 -> 재소환이다. 같은 입력(DB 내용·맥락)이면 같은 결과다 - 시각은 `context.period`에서
 * 오며 실행 시각을 읽지 않는다.
 *
 * - 다른 커플의 행이 조회 결과에 섞이면 `CoupleMembershipError` (A).
 * - DB 오류·무결성 오류(프로필 없는 화자 등)는 일반 `Error`.
 * - 맥락 값이 틀리면 `InvalidCornerContextError`(골격이 이미 쓰는 오류).
 */
export async function assembleCornerInput(
  client: InputAssemblyClient,
  context: CornerContext,
): Promise<AssembledInput> {
  assertContext(context)
  const { coupleId, period } = context

  // ── 열람 가능 판정의 입력: 커플의 구독 등급 (is_entry_visible) ──────────────
  const coupleRows = await fetchAll('couples', () =>
    client.from('couples').select('id, subscription_tier').eq('id', coupleId), ['id'])
  if (coupleRows.length === 0) throw new Error(`입력 조립: couples 행(${coupleId})이 없다`)
  if (coupleRows.some((r) => r.id !== coupleId)) {
    throw new CoupleMembershipError(coupleId, coupleRows.map((r) => String(r.id)), '입력 조립: couples 조회 결과의 커플이 맥락과 다르다')
  }
  const isPaid = coupleRows[0].subscription_tier === 'paid'

  const lockedIds = new Set<string>()
  const sizeLessPhotoIds = new Set<string>()

  /** `data_entries` 조회 - 세 조건(커플·미삭제·열람 가능)을 항상 건다. 잠긴 항목은 건수만 센다. */
  async function entryRows(
    narrow: (q: AssemblyFilterBuilder) => AssemblyFilterBuilder,
    countLocked: boolean,
  ): Promise<readonly AssemblyRow[]> {
    const base = () =>
      narrow(client.from('data_entries').select(ENTRY_COLUMNS).eq('couple_id', coupleId).is('deleted_at', null))
    const rows = await fetchAll('data_entries', () => (isPaid ? base() : base().eq('access_locked', false)), ['created_at', 'id'])
    assertRowsOfCouple(rows, 'data_entries', coupleId)
    if (countLocked && !isPaid) {
      const locked = await fetchAll(
        'data_entries',
        () => narrow(client.from('data_entries').select('id, couple_id').eq('couple_id', coupleId).is('deleted_at', null).eq('access_locked', true)),
        ['id'],
      )
      assertRowsOfCouple(locked, 'data_entries', coupleId)
      for (const r of locked) lockedIds.add(String(r.id))
    }
    return rows
  }

  /** 데이트들의 정거장과 묶인 `data_entries`(`date_stop_id` 또는 `date_id`). */
  async function loadDateContent(dateIds: readonly string[], countLocked: boolean): Promise<DateContent> {
    const stops: AssemblyRow[] = []
    for (const chunk of chunked(dateIds)) {
      const rows = await fetchAll(
        'date_stops',
        () => client.from('date_stops').select(STOP_COLUMNS).eq('couple_id', coupleId).in('date_id', chunk),
        ['date_id', 'seq', 'id'],
      )
      assertRowsOfCouple(rows, 'date_stops', coupleId)
      stops.push(...rows)
    }
    const byId = new Map<string, AssemblyRow>()
    for (const chunk of chunked(dateIds)) {
      for (const r of await entryRows((q) => q.in('date_id', chunk), countLocked)) byId.set(String(r.id), r)
    }
    for (const chunk of chunked(stops.map((s) => String(s.id)))) {
      for (const r of await entryRows((q) => q.in('date_stop_id', chunk), countLocked)) byId.set(String(r.id), r)
    }
    return { stops, entries: [...byId.values()] }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 1. 기간 내 조회
  // ═════════════════════════════════════════════════════════════════════════

  // 채팅 - 쿼리 범위는 기간 그대로(반열린 구간). 판정은 isRecordInPeriod.
  const messageRows = await fetchAll(
    'messages',
    () =>
      client
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('couple_id', coupleId)
        .is('deleted_at', null)
        .gte('sent_at', period.start.toISOString())
        .lt('sent_at', period.end.toISOString()),
    ['sent_at', 'id'],
  )
  assertRowsOfCouple(messageRows, 'messages', coupleId)

  // 데이트 - 날짜 컬럼은 시작·끝 시각의 KST 날짜로. 상한은 기간보다 좁아지지 않는 값(B).
  const periodDateRows = await fetchAll(
    'dates',
    () =>
      client
        .from('dates')
        .select(DATE_COLUMNS)
        .eq('couple_id', coupleId)
        .is('deleted_at', null)
        .gte('date_on', kstDateString(period.start))
        .lt('date_on', kstDateExclusiveUpperBound(period.end)),
    ['date_on', 'id'],
  )
  assertRowsOfCouple(periodDateRows, 'dates', coupleId)
  const periodDates = periodDateRows
    .map(parseDate)
    .filter((d) => isRecordInPeriod({ occurredAt: d.occurredAt, recalled: false }, period))

  const periodContent = await loadDateContent(periodDates.map((d) => d.id), true)

  // 사진 - 촬영 시각이 기간 안인 것. 시각 없는 독립 사진은 건수만 센다(E).
  const rangePhotoRows = await entryRows(
    (q) =>
      q
        .eq('entry_type', 'photo')
        .gte('captured_at', period.start.toISOString())
        .lt('captured_at', period.end.toISOString()),
    true,
  )
  const untimedStandalone = await entryRows(
    (q) => q.eq('entry_type', 'photo').is('captured_at', null).is('date_id', null).is('date_stop_id', null),
    false,
  )

  // ═════════════════════════════════════════════════════════════════════════
  // 2. 재소환 (17-1, C)
  // ═════════════════════════════════════════════════════════════════════════

  const recallCount = Math.max(0, RECALL_TARGET_TOTAL - periodDates.length)
  const recalled: { readonly date: DateRow; readonly reason: RecallReason }[] = []
  let recallContent: DateContent = { stops: [], entries: [] }

  if (recallCount > 0) {
    const pastRows = await fetchAll(
      'dates',
      () =>
        client
          .from('dates')
          .select(DATE_COLUMNS)
          .eq('couple_id', coupleId)
          .is('deleted_at', null)
          .lt('date_on', kstDateExclusiveUpperBound(period.start)),
      ['date_on', 'id'],
    )
    assertRowsOfCouple(pastRows, 'dates', coupleId)

    // 기준 시각은 실행 시각이 아니라 기간 시작이다 - 다시 돌려도 같은 결과.
    const gapLimit = kstShiftMonths(period.start, -RECALL_MIN_GAP_MONTHS)
    const gapOk = pastRows
      .map(parseDate)
      .filter((d) => isRecordInPeriod({ occurredAt: d.occurredAt, recalled: true }, period))
      .filter((d) => d.lastFeaturedAt === null || d.lastFeaturedAt.getTime() < gapLimit.getTime())

    // 후보 4: 열람 가능한 사진이 1장 이상. 잠긴 사진은 이미 조회에서 빠져 있다(D).
    const candidateContent = await loadDateContent(gapOk.map((d) => d.id), false)
    const stopDate = new Map(candidateContent.stops.map((s) => [String(s.id), reqStr(s, 'date_id', 'date_stops')]))
    const datesWithPhoto = new Set<string>()
    for (const e of candidateContent.entries) {
      if (e.entry_type !== 'photo') continue
      const owner = ownerDateId(e, stopDate)
      if (owner !== null) datesWithPhoto.add(owner)
    }
    const candidates = gapOk.filter((d) => datesWithPhoto.has(d.id))

    const ranked = rankRecallCandidates(candidates, period.start, period.end).slice(0, recallCount)
    recalled.push(...ranked)

    const chosen = new Set(ranked.map((r) => r.date.id))
    const chosenStops = candidateContent.stops.filter((s) => chosen.has(reqStr(s, 'date_id', 'date_stops')))
    const chosenStopIds = new Set(chosenStops.map((s) => String(s.id)))
    recallContent = {
      stops: chosenStops,
      entries: candidateContent.entries.filter((e) => {
        const owner = ownerDateId(e, stopDate)
        return owner !== null && chosen.has(owner) && (e.date_stop_id === null || chosenStopIds.has(String(e.date_stop_id)))
      }),
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 3. 프로필(화자·기록자 이름)
  // ═════════════════════════════════════════════════════════════════════════

  const nameIds = new Set<string>()
  for (const m of messageRows) {
    if (m.body !== null && m.body !== undefined) nameIds.add(reqStr(m, 'sender_id', 'messages'))
  }
  for (const e of [...periodContent.entries, ...recallContent.entries]) {
    if (e.entry_type === 'memo' || e.entry_type === 'drawing') nameIds.add(reqStr(e, 'author_id', 'data_entries'))
  }
  const names = new Map<string, string>()
  for (const chunk of chunked([...nameIds].sort())) {
    const rows = await fetchAll('profiles', () => client.from('profiles').select('id, display_name').in('id', chunk), ['id'])
    for (const r of rows) names.set(reqStr(r, 'id', 'profiles'), reqStr(r, 'display_name', 'profiles'))
  }
  const nameOf = (id: string): string => {
    const name = names.get(id)
    if (name === undefined) throw new Error(`입력 조립: profiles 행(${id})이 없다 (on delete restrict라 생기면 안 되는 상태)`)
    return name
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 4. 레코드 만들기
  // ═════════════════════════════════════════════════════════════════════════

  // 채팅
  let messagesWithoutBody = 0
  const messages: ChatMessageRecord[] = []
  for (const row of messageRows) {
    if (row.body === null || row.body === undefined) {
      messagesWithoutBody += 1
      continue
    }
    const sentAt = reqDate(row, 'sent_at', 'messages')
    if (!isRecordInPeriod({ occurredAt: sentAt, recalled: false }, period)) continue
    const at = kstIsoString(sentAt)
    messages.push({
      id: reqStr(row, 'id', 'messages'),
      coupleId,
      kind: 'message',
      occurredAt: sentAt,
      recalled: false,
      source: {
        speaker: nameOf(reqStr(row, 'sender_id', 'messages')),
        text: reqStr(row, 'body', 'messages'),
        at,
        attribution: {
          display: `${kstDisplayStamp(sentAt)}, ${timeOfDayLabel(sentAt)} 대화 중`,
          at,
          source: 'chat',
        },
      },
    })
  }

  // 데이트
  const dates: DateRecord[] = [
    ...periodDates.map((d) => buildDateRecord(d, null, false, periodContent, nameOf, sizeLessPhotoIds, coupleId)),
    ...recalled.map((r) => buildDateRecord(r.date, r.reason, true, recallContent, nameOf, sizeLessPhotoIds, coupleId)),
  ]

  // 사진 - 기간 안 촬영분 + 이번 기간 데이트에 묶인 사진. 판정은 isRecordInPeriod.
  const periodDateById = new Map(periodDates.map((d) => [d.id, d]))
  const periodStopDate = new Map(periodContent.stops.map((s) => [String(s.id), reqStr(s, 'date_id', 'date_stops')]))
  const photoEntries = new Map<string, AssemblyRow>()
  for (const e of [...rangePhotoRows, ...periodContent.entries]) {
    if (e.entry_type === 'photo') photoEntries.set(String(e.id), e)
  }
  const photos: PhotoRecord[] = []
  for (const e of [...photoEntries.values()].sort((a, b) => compare(String(a.id), String(b.id)))) {
    const id = reqStr(e, 'id', 'data_entries')
    if (optNum(e, 'width', 'data_entries') === null || optNum(e, 'height', 'data_entries') === null) {
      sizeLessPhotoIds.add(id)
      continue
    }
    const captured = optStr(e, 'captured_at', 'data_entries')
    const ownerId = ownerDateId(e, periodStopDate)
    const owner = ownerId === null ? undefined : periodDateById.get(ownerId)
    // 시각이 없으면 데이트에 묶인 사진만 데이트를 따른다(E). 묶이지 않은 사진은 여기 오지 않는다.
    const occurredAt = captured !== null ? reqDate(e, 'captured_at', 'data_entries') : owner?.occurredAt
    if (occurredAt === undefined) continue
    if (!isRecordInPeriod({ occurredAt, recalled: false }, period)) continue
    photos.push({
      id,
      coupleId,
      kind: 'photo',
      occurredAt,
      recalled: false,
      source: { path: reqStr(e, 'storage_path', 'data_entries'), at: kstIsoString(occurredAt) },
    })
  }
  photos.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || compare(a.id, b.id))

  const exclusions: InputExclusions = {
    messagesWithoutBody,
    standalonePhotosWithoutTime: untimedStandalone.length,
    photosWithoutSize: sizeLessPhotoIds.size,
    lockedEntries: lockedIds.size,
  }

  return { messages, photos, dates, records: [...messages, ...photos, ...dates], exclusions }
}

// ---------------------------------------------------------------------------
// 재소환 순위 (C)
// ---------------------------------------------------------------------------

/**
 * 순위와 `recallReason`은 1:1이다.
 * ① 기념일 근접(`anniversary`) - `date_on`이 기간을 정확히 N년(N>=1) 과거로 옮긴 구간 안. N 작은 것 -> `date_on` 오름 -> `id`
 * ② 한 번도 실리지 않음(`never_featured`) - `photo_count` 내림 -> `date_on` 내림 -> `id`
 * ③ 그 밖(`sparse_month`) - `last_featured_at` 오름 -> `date_on` 내림 -> `id`
 * ①과 ②에 모두 해당하면 ①. 마지막 기준이 `id`라 동률이 없다.
 */
function rankRecallCandidates(
  candidates: readonly DateRow[],
  periodStart: Date,
  periodEnd: Date,
): { readonly date: DateRow; readonly reason: RecallReason }[] {
  const anniversaries: { date: DateRow; years: number }[] = []
  const never: DateRow[] = []
  const sparse: DateRow[] = []
  for (const d of candidates) {
    const years = anniversaryYears(d.occurredAt, periodStart, periodEnd)
    if (years !== null) anniversaries.push({ date: d, years })
    else if (d.lastFeaturedAt === null) never.push(d)
    else sparse.push(d)
  }
  anniversaries.sort((a, b) => a.years - b.years || compare(a.date.dateOn, b.date.dateOn) || compare(a.date.id, b.date.id))
  never.sort((a, b) => b.photoCount - a.photoCount || compare(b.dateOn, a.dateOn) || compare(a.id, b.id))
  sparse.sort(
    (a, b) =>
      (a.lastFeaturedAt as Date).getTime() - (b.lastFeaturedAt as Date).getTime() ||
      compare(b.dateOn, a.dateOn) ||
      compare(a.id, b.id),
  )
  return [
    ...anniversaries.map((a) => ({ date: a.date, reason: 'anniversary' as const })),
    ...never.map((date) => ({ date, reason: 'never_featured' as const })),
    ...sparse.map((date) => ({ date, reason: 'sparse_month' as const })),
  ]
}

/** `at`이 기간을 N년(N>=1) 과거로 옮긴 구간 `[start-N년, end-N년)` 안이면 가장 작은 N, 아니면 null. */
function anniversaryYears(at: Date, periodStart: Date, periodEnd: Date): number | null {
  const t = at.getTime()
  for (let years = 1; ; years += 1) {
    const shiftedEnd = kstShiftMonths(periodEnd, -12 * years).getTime()
    // 구간이 점점 과거로 가므로, 구간 끝이 `at` 이하가 되면 더 먼 N도 맞지 않는다.
    if (shiftedEnd <= t) return null
    const shiftedStart = kstShiftMonths(periodStart, -12 * years).getTime()
    if (t >= shiftedStart) return years
  }
}

// ---------------------------------------------------------------------------
// 데이트 레코드 (F)
// ---------------------------------------------------------------------------

/** 항목이 속한 데이트 - `date_stop_id` 우선, 없으면 `date_id`, 둘 다 없으면 독립 기록(null). */
function ownerDateId(entry: AssemblyRow, stopDate: ReadonlyMap<string, string>): string | null {
  if (typeof entry.date_stop_id === 'string') return stopDate.get(entry.date_stop_id) ?? null
  if (typeof entry.date_id === 'string') return entry.date_id
  return null
}

function buildDateRecord(
  date: DateRow,
  reason: RecallReason | null,
  recalled: boolean,
  content: DateContent,
  nameOf: (id: string) => string,
  sizeLessPhotoIds: Set<string>,
  coupleId: string,
): DateRecord {
  const dateStops = content.stops
    .filter((s) => s.date_id === date.id)
    .sort((a, b) => reqNum(a, 'seq', 'date_stops') - reqNum(b, 'seq', 'date_stops') || compare(String(a.id), String(b.id)))
  const stopIds = new Set(dateStops.map((s) => String(s.id)))

  const entriesOfStop = new Map<string, AssemblyRow[]>()
  const entriesOfDate: AssemblyRow[] = []
  for (const e of content.entries) {
    if (typeof e.date_stop_id === 'string') {
      if (!stopIds.has(e.date_stop_id)) continue
      const list = entriesOfStop.get(e.date_stop_id) ?? []
      list.push(e)
      entriesOfStop.set(e.date_stop_id, list)
    } else if (e.date_id === date.id) {
      entriesOfDate.push(e)
    }
  }

  const photosOf = (entries: readonly AssemblyRow[]): PhotoRef[] => {
    const refs: { ref: PhotoRef; at: number | null; id: string }[] = []
    for (const e of entries) {
      if (e.entry_type !== 'photo') continue
      const id = reqStr(e, 'id', 'data_entries')
      const width = optNum(e, 'width', 'data_entries')
      const height = optNum(e, 'height', 'data_entries')
      if (width === null || height === null) {
        sizeLessPhotoIds.add(id)
        continue
      }
      const captured = optStr(e, 'captured_at', 'data_entries')
      const thumb = optStr(e, 'thumb_path', 'data_entries')
      const capturedAt = captured === null ? null : reqDate(e, 'captured_at', 'data_entries')
      refs.push({
        ref: {
          path: reqStr(e, 'storage_path', 'data_entries'),
          ...(thumb !== null ? { thumbPath: thumb } : {}),
          width,
          height,
          ...(capturedAt !== null ? { capturedAt: kstIsoString(capturedAt) } : {}),
        },
        at: capturedAt === null ? null : capturedAt.getTime(),
        id,
      })
    }
    refs.sort((a, b) => {
      if (a.at !== b.at) {
        if (a.at === null) return 1
        if (b.at === null) return -1
        return a.at - b.at
      }
      return compare(a.id, b.id)
    })
    return refs.map((r) => r.ref)
  }

  const notesOf = (entries: readonly AssemblyRow[]): UserNote[] =>
    entries
      .filter((e) => e.entry_type === 'memo' || e.entry_type === 'drawing')
      .sort((a, b) => compare(reqStr(a, 'created_at', 'data_entries'), reqStr(b, 'created_at', 'data_entries')) || compare(String(a.id), String(b.id)))
      .map((e): UserNote => {
        const authorId = reqStr(e, 'author_id', 'data_entries')
        return e.entry_type === 'memo'
          ? { authorId, authorName: nameOf(authorId), type: 'memo', text: reqStr(e, 'text_content', 'data_entries') }
          : { authorId, authorName: nameOf(authorId), type: 'drawing', path: reqStr(e, 'drawing_path', 'data_entries') }
      })

  const stops: DateStopSource[] = dateStops.map((s) => {
    const mine = entriesOfStop.get(String(s.id)) ?? []
    return {
      seq: reqNum(s, 'seq', 'date_stops'),
      time: kstClockHHmm(reqDate(s, 'arrived_at', 'date_stops')),
      placeName: optStr(s, 'place_name', 'date_stops'),
      lat: optNum(s, 'lat', 'date_stops'),
      lng: optNum(s, 'lng', 'date_stops'),
      photos: photosOf(mine),
      userNotes: notesOf(mine),
    }
  })

  return {
    id: date.id,
    coupleId,
    kind: 'date',
    occurredAt: date.occurredAt,
    recalled,
    source: {
      dateOn: date.dateOn,
      region: date.region,
      recallReason: reason,
      stops,
      dateLevel: { photos: photosOf(entriesOfDate), userNotes: notesOf(entriesOfDate) },
    },
  }
}
