/**
 * @jest-environment node
 *
 * 84-f(ROADMAP r141 R141-2) 시험: 2025년 시험 커플 G 시드. supabase/migrations/ 전체를 PGlite에 적용(원격 0 · LLM 0).
 * 운영 실행(`seedTestData.ts run-2025`)과 같은 본체(`seedCouple2025`)를 PGlite 위의 `SeedPort`로 돌린다(스토리지는 메모리).
 * 확인: 새 커플 하나 · 별명 · 초대 코드 · 계정 2(이메일 꼴) · 메시지 날짜 2025-09 · 다툰 날(09-16 · 09-17) 행 · 데이터셋 행 수 그대로 ·
 *       기존 커플 행 수 변화 0 · 두 번 실행 → 건너뜀(쓰기 0) · 계정만 남은 경우 이어 씀 · 데이터 일부만 있으면 쓰지 않고 멈춤 ·
 *       목록 파일은 성공 때만(실패 → 목록 그대로 + .failed.json).
 */
import { randomUUID } from 'node:crypto'
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../db/pgliteMigrations.ts'
import {
  SEED_2025, SEED_TABLES, SeedStopError, emptySeedLog, expectedSeedCounts, failedListPath, recordSeedOutcome, seedCouple2025,
  type SeedPort, type SeedTable,
} from './seedCouple2025.ts'

let db: PgClient
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const count = async (s: string, p?: unknown[]): Promise<number> => Number((await one(s, p)).n)

/** PGlite 위의 SeedPort - 운영 어댑터(`seedTestData.ts` `supabasePort`)와 같은 일을 SQL로. 쓰기 호출 수를 센다. */
function pglitePort(storage: Map<string, number>, writes: { n: number }): SeedPort {
  const insertRow = async (table: string, row: Row): Promise<Row> => {
    const keys = Object.keys(row)
    const sql = `insert into ${table}(${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning id`
    writes.n++
    return one(sql, keys.map((k) => row[k]))
  }
  return {
    async findAuthUser(email) { return (await one(`select id from auth.users where email = $1`, [email]))?.id ?? null },
    async createAuthUser(email) { writes.n++; return (await one(`insert into auth.users(email) values ($1) returning id`, [email])).id },
    async hasProfile(id) { return (await count(`select count(*) n from profiles where id = $1`, [id])) > 0 },
    async insertProfile(row) { await insertRow('profiles', row) },
    async findCoupleByInviteCode(code) { return (await one(`select id, nickname from couples where invite_code = $1`, [code])) ?? null },
    async insertCouple(row) { return (await insertRow('couples', row)).id },
    async countRows(table: SeedTable, coupleId) { return count(`select count(*) n from ${table} where couple_id = $1`, [coupleId]) },
    async insertRows(table: SeedTable, rows) { for (const r of rows) await insertRow(table, r) },
    async upload(bucket, path, bytes) { writes.n++; storage.set(`${bucket}/${path}`, bytes.length) },
  }
}

const deps = (port: SeedPort) => ({ port, png: async (w: number, h: number) => new Uint8Array([w % 256, h % 256]), uuid: randomUUID, now: '2026-11-20T00:00:00Z' })

/** 기존 시험 커플 A(10-22 실행분 흉내) - 그 행 수가 바뀌지 않는지 본다. */
let coupleA: string
async function existingCoupleA(): Promise<void> {
  const a = (await one(`insert into auth.users(email) values ('test-m2b-a1@example.com') returning id`)).id
  const b = (await one(`insert into auth.users(email) values ('test-m2b-a2@example.com') returning id`)).id
  for (const id of [a, b]) await db.query(`insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,'test-a','other','2000-01-01',now(),now())`, [id])
  coupleA = (await one(`insert into couples(user_a_id,user_b_id,invite_code,nickname,status) values ($1,$2,'TESTA001','test-m2b-A','active') returning id`, [a, b])).id
  const d = (await one(`insert into dates(couple_id,date_on) values ($1,'2026-09-13') returning id`, [coupleA])).id
  await db.query(`insert into date_stops(date_id,couple_id,seq,arrived_at) values ($1,$2,1,'2026-09-13T11:00:00+09:00')`, [d, coupleA])
  await db.query(`insert into messages(couple_id,sender_id,body,sent_at) values ($1,$2,'2026년 말','2026-09-16T09:05:00+09:00')`, [coupleA, a])
}
async function countsOf(coupleId: string): Promise<number[]> {
  return Promise.all(SEED_TABLES.map((t) => count(`select count(*) n from ${t} where couple_id = $1`, [coupleId])))
}

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
  await existingCoupleA()
}, 120000)
afterAll(async () => {
  await db.close()
  await closeAllServers()
})

describe('84-f 시험 커플 G 시드 (PGlite)', () => {
  const storage = new Map<string, number>()
  let gId: string
  let aBefore: number[]

  it('새 커플 하나 · 별명 · 초대 코드 · 계정 2(로그인 불가 시험 이메일) · 데이터셋 행 수 그대로 · 기존 커플 A 행 수 변화 0', async () => {
    aBefore = await countsOf(coupleA)
    const couplesBefore = await count(`select count(*) n from couples`)
    const writes = { n: 0 }
    const out = await seedCouple2025(deps(pglitePort(storage, writes)))
    expect(out.status).toBe('created')
    expect(await count(`select count(*) n from couples`)).toBe(couplesBefore + 1)
    const g = await one(`select id, nickname, invite_code, status from couples where invite_code = $1`, [SEED_2025.inviteCode])
    gId = g.id
    expect([g.nickname, g.status]).toEqual(['test-m2b-G', 'active'])
    expect(out.log.users.map((u) => u.email)).toEqual(['test-m2b-g1@example.com', 'test-m2b-g2@example.com'])
    expect((await one(`select count(*) n from profiles where id = any($1::uuid[]) and ai_usage_agreed_at is not null`, [out.log.users.map((u) => u.id)])).n).toBe(2)
    const expected = expectedSeedCounts()
    expect(await countsOf(gId)).toEqual(SEED_TABLES.map((t) => expected[t]))
    expect(await countsOf(coupleA)).toEqual(aBefore)                                   // 기존 커플은 읽지도 바꾸지도 않는다
    expect(storage.size).toBe(out.log.storage.length)
    expect([...storage.keys()].every((k) => k.startsWith(`entries/${gId}/`))).toBe(true)
  })

  it('메시지 날짜는 2025-09(KST) · 다툰 날 2025-09-16 · 09-17 대화가 들어 있다', async () => {
    const range = await one(`select min((sent_at at time zone 'Asia/Seoul')::date)::text lo, max((sent_at at time zone 'Asia/Seoul')::date)::text hi from messages where couple_id = $1`, [gId])
    expect([range.lo, range.hi]).toEqual(['2025-09-01', '2025-09-30'])
    const fight = await count(`select count(*) n from messages where couple_id = $1 and (sent_at at time zone 'Asia/Seoul')::date = '2025-09-16'`, [gId])
    const after = await count(`select count(*) n from messages where couple_id = $1 and (sent_at at time zone 'Asia/Seoul')::date = '2025-09-17'`, [gId])
    expect(fight).toBe(32)
    expect(after).toBeGreaterThan(0)
    expect(await count(`select count(*) n from messages where couple_id = $1 and body like '%미안하다고 하면 끝인 거야%'`, [gId])).toBe(1)
  })

  it('다시 쳐도 안전 - 이미 다 있으면 건너뛰고 쓰기 0 · 행 수 같음', async () => {
    const before = await countsOf(gId)
    const couples = await count(`select count(*) n from couples`)
    const writes = { n: 0 }
    const out = await seedCouple2025(deps(pglitePort(storage, writes)))
    expect(out.status).toBe('skipped')
    expect(writes.n).toBe(0)
    expect(await countsOf(gId)).toEqual(before)
    expect(await count(`select count(*) n from couples`)).toBe(couples)
    expect(await countsOf(coupleA)).toEqual(aBefore)
  })

  it('커플 G가 데이터 일부만 가진 흔적이면 쓰지 않고 멈춘다(중복 행 0)', async () => {
    await db.query(`delete from messages where couple_id = $1 and (sent_at at time zone 'Asia/Seoul')::date = '2025-09-30'`, [gId])
    const before = await countsOf(gId)
    const writes = { n: 0 }
    await expect(seedCouple2025(deps(pglitePort(storage, writes)))).rejects.toBeInstanceOf(SeedStopError)
    expect(writes.n).toBe(0)
    expect(await countsOf(gId)).toEqual(before)
  })

  it('초대 코드가 G가 아닌 커플에 쓰여 있으면 멈춘다(다른 커플에 쓰지 않는다)', async () => {
    const fresh = await createMigratedDb()
    const saved = db
    db = fresh.db
    try {
      const u = (await one(`insert into auth.users(email) values ('x@x.test') returning id`)).id
      await db.query(`insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,'x','other','2000-01-01',now(),now())`, [u])
      await db.query(`insert into couples(user_a_id,invite_code,nickname,status) values ($1,$2,'남의 커플','pending')`, [u, SEED_2025.inviteCode])   // 혼자인 커플(active는 두 사람이 필요)
      const writes = { n: 0 }
      await expect(seedCouple2025(deps(pglitePort(new Map(), writes)))).rejects.toThrow('시험 커플 G가 아닌 커플')
      expect(writes.n).toBe(0)
    } finally {
      await db.close()
      db = saved
    }
  }, 120000)

  it('계정만 남은 경우(앞 실행이 커플 전에 멈춤) 그 계정을 이어 쓴다', async () => {
    const fresh = await createMigratedDb()
    const saved = db
    db = fresh.db
    try {
      const g1 = (await one(`insert into auth.users(email) values ('test-m2b-g1@example.com') returning id`)).id
      const out = await seedCouple2025(deps(pglitePort(new Map(), { n: 0 })))
      expect(out.status).toBe('created')
      expect(out.log.users[0]).toMatchObject({ id: g1, created: false })
      expect(out.log.users[1].created).toBe(true)
    } finally {
      await db.close()
      db = saved
    }
  }, 120000)
})

describe('84-f ③ 목록 파일은 성공했을 때만', () => {
  const LIST = 'scripts/ops/out/seed-m2b-2025.json'

  it('중간 실패 → 목록 파일 그대로 · 그때까지의 기록은 .failed.json · 오류는 그대로', async () => {
    const files = new Map<string, unknown>([[LIST, { old: true }]])
    const partial = { couples: ['half'] }
    await expect(
      recordSeedOutcome(async () => { throw new Error('업로드 실패') }, async (p, v) => { files.set(p, v) }, LIST, () => partial),
    ).rejects.toThrow('업로드 실패')
    expect(files.get(LIST)).toEqual({ old: true })
    expect(files.get(failedListPath(LIST))).toEqual(partial)
    expect(failedListPath(LIST)).toBe('scripts/ops/out/seed-m2b-2025.failed.json')
  })

  it('성공 → 목록 파일을 새 값으로 · 건너뜀 → 아무 파일도 쓰지 않음', async () => {
    const files = new Map<string, unknown>()
    expect(await recordSeedOutcome(async () => ({ status: 'created', value: { ok: 1 } }), async (p, v) => { files.set(p, v) }, LIST, () => ({}))).toBe('created')
    expect(files.get(LIST)).toEqual({ ok: 1 })
    files.clear()
    expect(await recordSeedOutcome(async () => ({ status: 'skipped', value: emptySeedLog() }), async (p, v) => { files.set(p, v) }, LIST, () => ({}))).toBe('skipped')
    expect(files.size).toBe(0)
  })
})
