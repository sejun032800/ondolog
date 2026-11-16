/**
 * @jest-environment node
 *
 * 76-i (R110-4) 시험: 숨긴 행 정리. supabase/migrations/ 전체를 PGlite 에 적용(원격 0).
 * purgeWithdrawn 의 실제 포트가 보내는 질의를 SQL 로 그대로 흉내 낸다:
 *   조회 = 숨김 표시 있음 · 그 시각 <= 지금 - 24시간 / 삭제 = 그 id 중 같은 조건을 다시 건 행만.
 * 확인: 지난 것만 · 24시간 안 0 · 숨기지 않은 행 · 상대 행 0건 영향 · 외래 키(스토리 편입 칸은 비워지고 스토리는 남음 · 날짜 · 장소 그대로) ·
 *       발행된 호 0건 영향 · 숨긴 날짜(dates) 행은 대상 밖 · 멱등 · 마이그레이션 0(삭제를 막는 외래 키 · 트리거 없음).
 */
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
let n = 0
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const count = async (s: string, p?: unknown[]): Promise<number> => Number((await one(s, p)).n)

/** 실제 포트와 같은 두 질의(표 · 작성자 칸은 HIDDEN_TABLES 와 같다). */
const TABLES = [['data_entries', 'author_id'], ['messages', 'sender_id']] as const
async function purgeHidden(nowIso: string): Promise<Record<string, number>> {
  const cutoff = new Date(Date.parse(nowIso) - 24 * 3600 * 1000).toISOString()
  const out: Record<string, number> = {}
  for (const [table, author] of TABLES) {
    const ids = (await db.query<Row>(`select id, couple_id, ${author} from ${table} where deleted_at is not null and deleted_at <= $1 order by id`, [cutoff])).rows.map((r) => r.id as string)
    out[table] = (await db.query<Row>(`delete from ${table} where id = any($1::uuid[]) and deleted_at is not null and deleted_at <= $2 returning id`, [ids, cutoff])).rows.length
  }
  return out
}

async function user(): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`i${n}@x.test`])).id as string
  await db.query(`insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`, [id, 'i' + n])
  return id
}
async function couple(a: string, b: string): Promise<string> {
  return (await one(`insert into couples(user_a_id,user_b_id,invite_code,status) values ($1,$2,$3,'active') returning id`, [a, b, 'I' + String(++n).padStart(7, '0')])).id as string
}
async function date(c: string, deletedAt: string | null = null): Promise<string> {
  return (await one(`insert into dates(couple_id,date_on,deleted_at) values ($1, date '2026-09-01' + $2::int, $3) returning id`, [c, ++n, deletedAt])).id as string
}
async function memo(c: string, who: string, d: string | null, deletedAt: string | null): Promise<string> {
  return (await one(`insert into data_entries(couple_id,author_id,date_id,entry_type,text_content,deleted_at) values ($1,$2,$3,'memo','글',$4) returning id`, [c, who, d, deletedAt])).id as string
}
async function message(c: string, who: string, deletedAt: string | null): Promise<string> {
  const id = (await one(`insert into messages(couple_id,sender_id,body) values ($1,$2,'말') returning id`, [c, who])).id as string
  if (deletedAt) await db.query(`update messages set deleted_at = $2 where id = $1`, [id, deletedAt])
  return id
}

const NOW = '2026-11-16T00:00:00Z'
const OLD = '2026-11-14T00:00:00Z'
const RECENT = '2026-11-15T12:00:00Z'

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
}, 120000)
afterAll(async () => {
  await db?.close()
  await closeAllServers()
})

describe('76-i 숨긴 행 정리', () => {
  it('지난 숨긴 행만 행째 지움 · 24시간 안 · 숨기지 않은 행 · 상대 행 · 호 · 숨긴 날짜 행 0건 영향 · 외래 키는 표대로', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    const D = await date(C)
    const hiddenDay = await date(C, OLD) // 하루 지우기로 숨긴 날짜 - 대상 밖(앱이 되살린다)
    const stopId = (await one(`insert into date_stops(date_id,couple_id,seq,arrived_at) values ($1,$2,0,now()) returning id`, [D, C])).id as string
    const oldMemo = await memo(C, A, D, OLD)
    await db.query(`update data_entries set date_stop_id = $2 where id = $1`, [oldMemo, stopId])
    const recentMemo = await memo(C, A, D, RECENT)
    const liveA = await memo(C, A, D, null)
    const liveB = await memo(C, B, D, null)
    const hiddenOnHiddenDay = await memo(C, A, hiddenDay, OLD)
    const oldMsg = await message(C, B, OLD)
    const recentMsg = await message(C, A, RECENT)
    const liveMsg = await message(C, A, null)
    // 스토리 편입 칸이 숨긴 기록을 가리킨다(on delete set null).
    const story = (await one(
      `insert into stories(couple_id,author_id,media_path,created_at,expires_at,resolved_at,resolution,archived_entry_id) values ($1,$2,'s/x',now()-interval '3 days',now()-interval '2 days',now()-interval '2 days','archived',$3) returning id`,
      [C, A, oldMemo],
    )).id as string
    const issue = (await one(`insert into issues(couple_id,issue_type,issue_number,period_start,period_end,published_at) values ($1,(enum_range(null::issue_type))[1],1,'2026-10-01','2026-10-31',now()) returning id`, [C])).id as string

    expect(await purgeHidden(NOW)).toEqual({ data_entries: 2, messages: 1 })

    const left = (await db.query<Row>(`select id from data_entries where couple_id = $1 order by id`, [C])).rows.map((r) => r.id).sort()
    expect(left).toEqual([recentMemo, liveA, liveB].sort())
    expect(await count(`select count(*) n from data_entries where id = any($1::uuid[])`, [[oldMemo, hiddenOnHiddenDay]])).toBe(0)
    const msgs = (await db.query<Row>(`select id from messages where couple_id = $1`, [C])).rows.map((r) => r.id).sort()
    expect(msgs).toEqual([recentMsg, liveMsg].sort())
    expect(msgs).not.toContain(oldMsg)
    // 외래 키: 스토리 행은 남고 편입 칸만 비워진다 · 날짜 · 장소 · 숨긴 날짜 행 · 발행된 호 그대로
    expect(await one(`select archived_entry_id, resolution from stories where id = $1`, [story])).toEqual({ archived_entry_id: null, resolution: 'archived' })
    expect(await count(`select count(*) n from dates where id = any($1::uuid[])`, [[D, hiddenDay]])).toBe(2)
    expect((await one(`select deleted_at from dates where id = $1`, [hiddenDay])).deleted_at).not.toBeNull()
    expect(await count(`select count(*) n from date_stops where id = $1`, [stopId])).toBe(1)
    expect(await count(`select count(*) n from issues where id = $1`, [issue])).toBe(1)
    expect(await count(`select count(*) n from profiles where id = any($1::uuid[])`, [[A, B]])).toBe(2)

    // 멱등
    expect(await purgeHidden(NOW)).toEqual({ data_entries: 0, messages: 0 })
    // 12시간 뒤에는 24시간 안이던 것도 지난다
    expect(await purgeHidden('2026-11-16T12:00:00Z')).toEqual({ data_entries: 1, messages: 1 })
    expect(await count(`select count(*) n from data_entries where id = any($1::uuid[])`, [[liveA, liveB]])).toBe(2)
  })

  it('다른 커플의 행은 그 커플이 숨긴 것만 - 숨기지 않은 행 0건', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    const keep = await memo(C, B, null, null)
    const keepMsg = await message(C, A, null)
    await purgeHidden(NOW)
    expect(await count(`select count(*) n from data_entries where id = $1`, [keep])).toBe(1)
    expect(await count(`select count(*) n from messages where id = $1`, [keepMsg])).toBe(1)
  })

  it('숨긴 행 삭제를 막는 외래 키 · 삭제 트리거 없음(마이그레이션 0의 근거)', async () => {
    const refs = (await db.query<Row>(
      `select conrelid::regclass::text as tbl, confdeltype from pg_constraint where contype = 'f' and confrelid in ('public.data_entries'::regclass, 'public.messages'::regclass)`,
    )).rows
    expect(refs).toEqual([{ tbl: 'stories', confdeltype: 'n' }]) // n = set null
    const trig = await count(
      `select count(*) n from pg_trigger where not tgisinternal and tgrelid in ('public.data_entries'::regclass, 'public.messages'::regclass) and (tgtype & 8) <> 0`,
    )
    expect(trig).toBe(0) // DELETE 트리거 0
  })
})
