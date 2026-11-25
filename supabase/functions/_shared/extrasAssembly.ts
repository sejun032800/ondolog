/**
 * 2.0-A1 입력 조립 덧붙임 — 두 사람의 결 · 어림짐작 · 부록이 읽는 재료(위임 `m20-a1` ①~⑥).
 *
 * 지금 입력 조립(`inputAssembly.ts` - 3코너 입력)은 **고치지 않는다**. 이 파일이 따로 읽는다(읽기 전용 · 같은 조회 클라이언트):
 * - `couples` — 두 사람 id(a = `user_a_id`, b = `user_b_id`) · 사귄 날짜 · 별명. **`profiles.birth_date`는 읽지 않는다**(R157-6).
 * - `profiles.display_name` — 두 사람 이름.
 * - `personality_profiles` → `personality_assessments`(활성 검사 한 행) → `love_type_labels.label_ko` — 성격 데이터.
 * - `messages`(커플 · 미삭제 · 기간 안) — **채팅 지표 입력**: id · 보낸 사람 · 시각 · 종류(본문 있음 = text, 없음 = media) · 본문.
 *   본문은 채팅 지표 엔진이 이모지 판정에만 쓴다. 이 파일은 본문을 남기거나 기록하지 않는다.
 * - `data_entries`(사진 항목 id 목록) — 위치 값 유무 · 사진에 남긴 글(`text_content`) · 데이트 구간 → `date_stops.place_name`.
 *
 * 모든 조회에 커플 조건을 걸고(`profiles` · `love_type_labels`처럼 커플 열이 없는 표는 id로), 결과에 다른 커플 행이 섞이면 던진다.
 * 동기 순수 계산은 하지 않는다 - 엔진(`src/engine/`)은 호출부(`scripts/ops/generateIssue.ts`)가 부른다(이 파일은 Deno 경로).
 */

import type { AssemblyFilterBuilder, AssemblyRow, InputAssemblyClient } from './inputAssembly.ts'
import type { CornerContext } from './cornerPipeline.ts'

const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 100

/** `src/engine/coupleProfile.ts` `PersonProfile`과 같은 모양(Deno 경로라 옮겨 적음 - 시험이 두 모양을 맞춘다). */
export interface ExtrasPersonProfile {
  readonly userId: string
  readonly name: string
  readonly labelKo: string | null
  readonly enneagramCore: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  readonly mbti: string
  readonly bigFive: { readonly o: number; readonly c: number; readonly e: number; readonly a: number; readonly n: number }
  readonly sternberg: { readonly intimacy: number; readonly passion: number; readonly commitment: number }
  readonly attachAnxiety: number
  readonly attachAvoidance: number
  readonly attachment: 'secure' | 'anxious' | 'avoidant' | 'fearful'
}

/** `src/engine/chatMetrics.ts` `ChatEvent`와 같은 모양. */
export interface ExtrasChatEvent {
  readonly id: string
  readonly senderId: string
  readonly sentAt: string
  readonly kind: 'text' | 'media'
  readonly text: string | null
}

export interface PhotoDetail {
  readonly width: number | null
  readonly height: number | null
  readonly hasLocation: boolean
  readonly note: string | null
  readonly placeName: string | null
}

export interface IssueExtras {
  readonly people: readonly [string, string]
  readonly names: readonly [string, string]
  readonly nickname: string | null
  /** 'YYYY-MM-DD' 또는 null. */
  readonly relationshipStart: string | null
  readonly profiles: { readonly a: ExtrasPersonProfile | null; readonly b: ExtrasPersonProfile | null }
  readonly chatEvents: readonly ExtrasChatEvent[]
  /** 사진 항목 id → 위치 유무 · 글 · 장소. */
  readonly photoDetails: ReadonlyMap<string, PhotoDetail>
}

async function fetchAll(table: string, make: () => AssemblyFilterBuilder, orderBy: readonly string[]): Promise<readonly AssemblyRow[]> {
  const rows: AssemblyRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = make()
    for (const column of orderBy) query = query.order(column, { ascending: true })
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error !== null) throw new Error(`2.0 입력 조립: ${table} 조회 실패: ${error.message}`)
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

function str(row: AssemblyRow, key: string, table: string): string {
  const v = row[key]
  if (typeof v !== 'string' || v === '') throw new Error(`2.0 입력 조립: ${table}.${key}가 비었다 (${String(row.id ?? row.user_id ?? row.code)})`)
  return v
}

function optStr(row: AssemblyRow, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' && v !== '' ? v : null
}

function num(row: AssemblyRow, key: string, table: string): number {
  const v = row[key]
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`2.0 입력 조립: ${table}.${key}가 숫자가 아니다`)
  return n
}

function assertCouple(rows: readonly AssemblyRow[], table: string, coupleId: string): void {
  if (rows.some((r) => r.couple_id !== coupleId)) throw new Error(`2.0 입력 조립: ${table} 결과에 다른 커플의 행이 있다`)
}

const ATTACHMENTS = new Set(['secure', 'anxious', 'avoidant', 'fearful'])

export async function assembleIssueExtras(
  client: InputAssemblyClient,
  context: CornerContext,
  /** 3코너 입력 조립이 실은 사진 항목 id(그달 사진 후보). */
  photoEntryIds: readonly string[],
): Promise<IssueExtras> {
  const { coupleId, period } = context

  // ── 커플 · 이름 ───────────────────────────────────────────────────────
  const coupleRows = await fetchAll(
    'couples',
    () => client.from('couples').select('id, user_a_id, user_b_id, relationship_start_date, nickname').eq('id', coupleId),
    ['id'],
  )
  if (coupleRows.length !== 1 || coupleRows[0].id !== coupleId) throw new Error(`2.0 입력 조립: couples 행(${coupleId})이 하나가 아니다`)
  const couple = coupleRows[0]
  const aId = str(couple, 'user_a_id', 'couples')
  const bId = str(couple, 'user_b_id', 'couples')
  const startRaw = optStr(couple, 'relationship_start_date')
  const relationshipStart = startRaw === null ? null : startRaw.slice(0, 10)

  const profileRows = await fetchAll('profiles', () => client.from('profiles').select('id, display_name').in('id', [aId, bId]), ['id'])
  const nameOf = (id: string): string => {
    const row = profileRows.find((r) => r.id === id)
    if (row === undefined) throw new Error(`2.0 입력 조립: profiles 행(${id})이 없다`)
    return str(row, 'display_name', 'profiles')
  }
  const names: [string, string] = [nameOf(aId), nameOf(bId)]

  // ── 성격 데이터 ───────────────────────────────────────────────────────
  const ppRows = await fetchAll(
    'personality_profiles',
    () => client.from('personality_profiles').select('user_id, active_assessment_id, enneagram_effective, love_type_code, attachment').in('user_id', [aId, bId]),
    ['user_id'],
  )
  const activeIds = ppRows.map((r) => str(r, 'active_assessment_id', 'personality_profiles'))
  const paRows =
    activeIds.length === 0
      ? []
      : await fetchAll(
          'personality_assessments',
          () =>
            client
              .from('personality_assessments')
              .select('id, user_id, mbti, big_o, big_c, big_e, big_a, big_n, stern_intimacy, stern_passion, stern_commitment, attach_anxiety, attach_avoidance, attachment')
              .in('id', activeIds),
          ['id'],
        )
  const codes = [...new Set(ppRows.map((r) => str(r, 'love_type_code', 'personality_profiles')))].sort()
  const labelRows =
    codes.length === 0 ? [] : await fetchAll('love_type_labels', () => client.from('love_type_labels').select('code, label_ko').in('code', codes), ['code'])

  const profileOf = (userId: string, name: string): ExtrasPersonProfile | null => {
    const pp = ppRows.find((r) => r.user_id === userId)
    if (pp === undefined) return null
    const pa = paRows.find((r) => r.id === pp.active_assessment_id)
    if (pa === undefined || pa.user_id !== userId) return null
    const core = num(pp, 'enneagram_effective', 'personality_profiles')
    if (!Number.isInteger(core) || core < 1 || core > 9) throw new Error('2.0 입력 조립: enneagram_effective가 1~9가 아니다')
    const attachment = str(pa, 'attachment', 'personality_assessments')
    if (!ATTACHMENTS.has(attachment)) throw new Error('2.0 입력 조립: attachment 값이 아니다')
    const code = str(pp, 'love_type_code', 'personality_profiles')
    const label = labelRows.find((r) => typeof r.code === 'string' && r.code.trim() === code.trim())
    return {
      userId,
      name,
      labelKo: label === undefined ? null : optStr(label, 'label_ko'),
      enneagramCore: core as ExtrasPersonProfile['enneagramCore'],
      mbti: str(pa, 'mbti', 'personality_assessments').trim(),
      bigFive: {
        o: num(pa, 'big_o', 'personality_assessments'),
        c: num(pa, 'big_c', 'personality_assessments'),
        e: num(pa, 'big_e', 'personality_assessments'),
        a: num(pa, 'big_a', 'personality_assessments'),
        n: num(pa, 'big_n', 'personality_assessments'),
      },
      sternberg: {
        intimacy: num(pa, 'stern_intimacy', 'personality_assessments'),
        passion: num(pa, 'stern_passion', 'personality_assessments'),
        commitment: num(pa, 'stern_commitment', 'personality_assessments'),
      },
      attachAnxiety: num(pa, 'attach_anxiety', 'personality_assessments'),
      attachAvoidance: num(pa, 'attach_avoidance', 'personality_assessments'),
      attachment: attachment as ExtrasPersonProfile['attachment'],
    }
  }

  // ── 채팅 지표 입력 ────────────────────────────────────────────────────
  const messageRows = await fetchAll(
    'messages',
    () =>
      client
        .from('messages')
        .select('id, couple_id, sender_id, body, media_path, sent_at')
        .eq('couple_id', coupleId)
        .is('deleted_at', null)
        .gte('sent_at', period.start.toISOString())
        .lt('sent_at', period.end.toISOString()),
    ['sent_at', 'id'],
  )
  assertCouple(messageRows, 'messages', coupleId)
  const chatEvents: ExtrasChatEvent[] = messageRows.map((r) => {
    const body = typeof r.body === 'string' ? r.body : null
    return {
      id: str(r, 'id', 'messages'),
      senderId: str(r, 'sender_id', 'messages'),
      sentAt: str(r, 'sent_at', 'messages'),
      kind: body !== null ? 'text' : 'media',
      text: body,
    }
  })

  // ── 사진 세부(위치 · 글 · 장소) ────────────────────────────────────────
  const photoDetails = new Map<string, PhotoDetail>()
  const entryRows: AssemblyRow[] = []
  for (const chunk of chunked([...photoEntryIds].sort())) {
    entryRows.push(
      ...(await fetchAll(
        'data_entries',
        () =>
          client
            .from('data_entries')
            .select('id, couple_id, width, height, lat, lng, text_content, date_stop_id')
            .eq('couple_id', coupleId)
            .is('deleted_at', null)
            .in('id', chunk),
        ['id'],
      )),
    )
  }
  assertCouple(entryRows, 'data_entries', coupleId)
  const stopIds = [...new Set(entryRows.map((r) => optStr(r, 'date_stop_id')).filter((v): v is string => v !== null))].sort()
  const stopRows: AssemblyRow[] = []
  for (const chunk of chunked(stopIds)) {
    stopRows.push(
      ...(await fetchAll('date_stops', () => client.from('date_stops').select('id, couple_id, place_name').eq('couple_id', coupleId).in('id', chunk), ['id'])),
    )
  }
  assertCouple(stopRows, 'date_stops', coupleId)
  for (const r of entryRows) {
    const stopId = optStr(r, 'date_stop_id')
    const stop = stopId === null ? undefined : stopRows.find((s) => s.id === stopId)
    const size = (k: string): number | null => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? (r[k] as number) : null)
    photoDetails.set(str(r, 'id', 'data_entries'), {
      width: size('width'),
      height: size('height'),
      hasLocation: (r.lat !== null && r.lat !== undefined) || (r.lng !== null && r.lng !== undefined),
      note: optStr(r, 'text_content'),
      placeName: stop === undefined ? null : optStr(stop, 'place_name'),
    })
  }

  return {
    people: [aId, bId],
    names,
    nickname: optStr(couple, 'nickname'),
    relationshipStart,
    profiles: { a: profileOf(aId, names[0]), b: profileOf(bId, names[1]) },
    chatEvents,
    photoDetails,
  }
}
