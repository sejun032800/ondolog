/**
 * 84-f(ROADMAP r141 R141-2 · R140-4 · R134-6) - **2025년 합성 데이터로 새 시험 커플 G 하나**를 원격 개발 DB에 넣는 일의 본체.
 * 위임: .claude/state/prompts/phase-7/84-f-dispatch-seed-2025-couple.md
 *
 * - 데이터는 `fixtures/m1-month`(50- 합성, `FIXTURE_YEAR = 2025`) 그대로 - 다툰 날 09-16 · 09-17 대화 포함. 실제 사람의 대화 0.
 * - 계정: `test-m2b-g1@example.com` · `test-m2b-g2@example.com`(비밀번호 없음 - 로그인할 수 없다) · 이름 `test-세준` · `test-서영`.
 *   커플: 별명 `test-m2b-G` · 초대 코드 `TESTG001`(기존 A/B/C/F의 `TESTA001` · `TESTB001` · `TESTC001` · `TESTF001`과 겹치지 않음).
 * - **기존 시험 커플(A/B/C/F) · 기존 목록 파일 · 다른 커플은 읽지도 바꾸지도 않는다** - 이 파일이 찾는 것은 위 두 이메일과 초대 코드 `TESTG001`뿐이다.
 * - **다시 쳐도 안전**: 커플 G가 이미 있고 데이터가 다 들어가 있으면 아무것도 쓰지 않고 건너뛴다(`skipped`). 계정만 남아 있으면(앞 실행이 커플 전에 멈춤)
 *   그 계정을 이어 쓴다. 커플은 있는데 데이터가 일부만 있으면(앞 실행이 데이터 중간에 멈춤) **쓰지 않고 멈춘다** - 중복 행을 만들지 않는다.
 * - 원격 접근은 `SeedPort` 하나로만 한다 - 실행은 Supabase(`seedTestData.ts run-2025`), 시험은 PGlite(`scripts/ops/seed2025_84f.test.ts`).
 * - 목록 파일은 **성공했을 때만** 쓴다(`recordSeedOutcome`). 실패하면 목록 파일은 그대로 두고 그때까지 만든 행 · 파일을 별 파일(`.failed.json`)에 남긴다.
 *
 * 이 파일은 Deno API를 쓰지 않는다(jest가 그대로 가져다 쓴다).
 */

import { buildTables, SEJUN_ID, SEOYOUNG_ID } from './fixtures/m1-month/dataset.ts'

type Row = Record<string, unknown>

export const SEED_2025 = {
  label: 'G',
  nickname: 'test-m2b-G',
  inviteCode: 'TESTG001',
  members: [
    { role: 'g1', email: 'test-m2b-g1@example.com', displayName: 'test-세준', gender: 'male' as const, fixtureId: SEJUN_ID },
    { role: 'g2', email: 'test-m2b-g2@example.com', displayName: 'test-서영', gender: 'female' as const, fixtureId: SEOYOUNG_ID },
  ],
  /** 목록 파일(git 추적 안 함 - `scripts/ops/out/`). 기존 `seed-m2b.json`과 다른 파일. */
  listFile: 'scripts/ops/out/seed-m2b-2025.json',
} as const

/** 데이터를 넣는 표(순서대로) - 건너뛰기 · 일부만 있음 판정에 쓴다. */
export const SEED_TABLES = ['dates', 'date_stops', 'data_entries', 'messages'] as const
export type SeedTable = (typeof SEED_TABLES)[number]

/** 원격 접근 - 이 일이 쓰는 모양만. */
export interface SeedPort {
  /** 이메일로 인증 계정을 찾는다(없으면 null). */
  findAuthUser(email: string): Promise<string | null>
  /** 인증 계정을 만든다(비밀번호 없음). */
  createAuthUser(email: string): Promise<string>
  hasProfile(id: string): Promise<boolean>
  insertProfile(row: Row): Promise<void>
  /** 초대 코드로 커플을 찾는다(없으면 null). */
  findCoupleByInviteCode(code: string): Promise<{ id: string; nickname: string | null } | null>
  insertCouple(row: Row): Promise<string>
  /** 그 커플의 행 수. */
  countRows(table: SeedTable, coupleId: string): Promise<number>
  insertRows(table: SeedTable, rows: Row[]): Promise<void>
  upload(bucket: string, path: string, bytes: Uint8Array): Promise<void>
}

export interface SeedDeps {
  readonly port: SeedPort
  /** 단색 PNG(사진 · 그림 원본 자리표시). */
  readonly png: (width: number, height: number, n: number) => Promise<Uint8Array>
  readonly uuid: () => string
  readonly now: string
  readonly say?: (line: string) => void
}

export interface SeedLog2025 {
  users: { id: string; email: string; role: string; created: boolean }[]
  couples: { label: string; id: string; nickname: string; status: string }[]
  rowIds: Record<string, string[]>
  storage: { bucket: string; path: string }[]
}

export interface SeedOutcome {
  readonly status: 'created' | 'skipped'
  readonly log: SeedLog2025
}

export class SeedStopError extends Error {}

export function emptySeedLog(): SeedLog2025 {
  return { users: [], couples: [], rowIds: {}, storage: [] }
}

/** 데이터셋 행 수(표마다) - 다 들어갔는지 판정 · 보고에 쓴다. */
export function expectedSeedCounts(): Record<SeedTable, number> {
  const t = buildTables()
  return { dates: t.dates.length, date_stops: t.date_stops.length, data_entries: t.data_entries.length, messages: t.messages.length }
}

/**
 * 시험 커플 G를 넣는다. 이미 다 있으면 건너뛴다(쓰기 0). 실패하면 `SeedStopError`/원격 오류를 그대로 던진다 - 그때까지의 기록은 `log`에 있다.
 * `log`를 밖에서 넘기면 실패해도 호출부가 그때까지 만든 행을 안다(`recordSeedOutcome`).
 */
export async function seedCouple2025(deps: SeedDeps, log: SeedLog2025 = emptySeedLog()): Promise<SeedOutcome> {
  const { port } = deps
  const say = deps.say ?? (() => {})
  const remember = (table: string, ids: string[]) => {
    log.rowIds[table] = [...(log.rowIds[table] ?? []), ...ids]
  }

  // ── 커플 G가 이미 있는가 ────────────────────────────────────────────────
  const existing = await port.findCoupleByInviteCode(SEED_2025.inviteCode)
  if (existing !== null) {
    if (existing.nickname !== SEED_2025.nickname) {
      throw new SeedStopError(`초대 코드 ${SEED_2025.inviteCode}가 시험 커플 G가 아닌 커플에 쓰여 있다 - 쓰지 않고 멈춘다`)
    }
    const expected = expectedSeedCounts()
    const counts = await Promise.all(SEED_TABLES.map((t) => port.countRows(t, existing.id)))
    if (SEED_TABLES.every((t, i) => counts[i] === expected[t])) {
      say(`시험 커플 G가 이미 있다 - 건너뜀(쓰기 0)`)
      return { status: 'skipped', log }
    }
    throw new SeedStopError(
      `시험 커플 G가 있지만 데이터가 데이터셋과 다르다(${SEED_TABLES.map((t, i) => `${t} ${counts[i]}/${expected[t]}`).join(' · ')}) - 앞 실행이 중간에 멈춘 흔적이라 쓰지 않고 멈춘다(정리 필요)`,
    )
  }

  // ── 계정 · 프로필(있으면 이어 쓴다) ───────────────────────────────────────
  const ids: Record<string, string> = {}
  for (const m of SEED_2025.members) {
    let id = await port.findAuthUser(m.email)
    const created = id === null
    if (id === null) id = await port.createAuthUser(m.email)
    log.users.push({ id, email: m.email, role: m.role, created })
    if (!(await port.hasProfile(id))) {
      await port.insertProfile({
        id,
        display_name: m.displayName,
        gender: m.gender,
        birth_date: '1999-01-01',
        onboarding_step: 3,
        terms_agreed_at: deps.now,
        privacy_agreed_at: deps.now,
        ai_usage_agreed_at: deps.now, // 생성 P0 조건(두 구성원 모두 동의) - 기존 시드와 같다
      })
      remember('profiles', [id])
    }
    ids[m.fixtureId] = id
  }

  // ── 커플 ───────────────────────────────────────────────────────────────
  const coupleId = await port.insertCouple({
    user_a_id: ids[SEJUN_ID],
    user_b_id: ids[SEOYOUNG_ID],
    invite_code: SEED_2025.inviteCode,
    nickname: SEED_2025.nickname,
    status: 'active',
    connected_at: deps.now,
  })
  log.couples.push({ label: SEED_2025.label, id: coupleId, nickname: SEED_2025.nickname, status: 'active' })
  remember('couples', [coupleId])

  // ── 데이터셋(기존 `seedTestData.ts` `loadDataset`과 같은 변환) ───────────────
  const t = buildTables()
  const uuid = new Map<string, string>()
  const idOf = (key: string): string => {
    const v = uuid.get(key) ?? deps.uuid()
    uuid.set(key, v)
    return v
  }
  const user = (key: unknown) => ids[String(key)] ?? String(key)
  const orNull = (v: unknown) => (typeof v === 'string' ? idOf(v) : null)
  const insert = async (table: SeedTable, rows: Row[]) => {
    await port.insertRows(table, rows)
    remember(table, rows.map((r) => String(r.id)))
  }

  await insert(
    'dates',
    t.dates.map((d) => ({ id: idOf(String(d.id)), couple_id: coupleId, date_on: d.date_on, region: d.region, photo_count: d.photo_count, last_featured_at: null })),
  )
  await insert(
    'date_stops',
    t.date_stops.map((s) => ({
      id: idOf(String(s.id)), date_id: idOf(String(s.date_id)), couple_id: coupleId, seq: s.seq, arrived_at: s.arrived_at,
      place_name: s.place_name, lat: s.lat, lng: s.lng,
    })),
  )
  const entries: Row[] = []
  let n = 0
  for (const e of t.data_entries) {
    const id = idOf(String(e.id))
    n += 1
    const row: Row = {
      id, couple_id: coupleId, author_id: user(e.author_id), date_id: orNull(e.date_id), date_stop_id: orNull(e.date_stop_id),
      entry_type: e.entry_type, storage_path: null, thumb_path: null, width: null, height: null, text_content: e.text_content,
      drawing_path: null, captured_at: e.captured_at, created_at: e.created_at, access_locked: false,
    }
    if (e.entry_type === 'photo') {
      const landscape = Number(e.width) > Number(e.height)
      const [w, h] = landscape ? [400, 300] : [300, 400]
      const path = `${coupleId}/${id}.png`
      await port.upload('entries', path, await deps.png(w, h, n))
      log.storage.push({ bucket: 'entries', path })
      Object.assign(row, { storage_path: path, width: w, height: h })
    } else if (e.entry_type === 'drawing') {
      const path = `${coupleId}/${id}.png`
      await port.upload('entries', path, await deps.png(300, 300, n))
      log.storage.push({ bucket: 'entries', path })
      row.drawing_path = path
    }
    entries.push(row)
  }
  await insert('data_entries', entries)
  await insert(
    'messages',
    t.messages.map((m) => ({ id: deps.uuid(), couple_id: coupleId, sender_id: user(m.sender_id), body: m.body, sent_at: m.sent_at })),
  )
  say(`시험 커플 G를 만들었다 - 계정 ${log.users.length} · ${SEED_TABLES.map((t) => `${t} ${log.rowIds[t]?.length ?? 0}`).join(' · ')} · 스토리지 ${log.storage.length}`)
  return { status: 'created', log }
}

/** 실패 때 그때까지 만든 행 · 파일을 남길 별 파일(목록 파일은 그대로 둔다). */
export function failedListPath(listFile: string): string {
  return listFile.replace(/\.json$/, '.failed.json')
}

/**
 * 84-f ③ - 목록 파일 쓰기 규칙: **성공했을 때만** 목록 파일을 쓴다. 실패하면 목록 파일은 건드리지 않고 그때까지의 기록을 `.failed.json`에 쓴 뒤
 * 원래 오류를 다시 던진다. 건너뜀(`skipped` - 쓰기 0)이면 아무 파일도 쓰지 않는다. 기존 `run`도 같은 규칙을 쓴다(`seedTestData.ts`).
 */
export async function recordSeedOutcome<T>(
  job: () => Promise<{ status: 'created' | 'skipped'; value: T }>,
  write: (path: string, value: T) => Promise<void>,
  listFile: string,
  partial: () => T,
): Promise<'created' | 'skipped'> {
  let result: { status: 'created' | 'skipped'; value: T }
  try {
    result = await job()
  } catch (err) {
    await write(failedListPath(listFile), partial())
    throw err
  }
  if (result.status === 'created') await write(listFile, result.value)
  return result.status
}
