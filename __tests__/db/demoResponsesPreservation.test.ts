/**
 * @jest-environment node
 *
 * demo_responses 보존 시험 (`71c-`, R56-5): 실제 사용자의 웹 체험판 응답 테이블이다.
 * 편입 파일(20261103142031_*)까지 적용 -> 행 넣기 -> 그 뒤 마이그레이션을 전부 적용 -> 행 · 값 · 열 · RLS · 정책 · 권한이 그대로인지 본다.
 * 지금은 편입 파일 뒤 파일이 0개여도 시험은 둔다(다음 마이그레이션부터 효과가 있다). 원격 접속 0.
 */
import {
  MIGRATIONS_DIR,
  applyRemaining,
  closeAllServers,
  createMigratedDb,
  listMigrationFiles,
  type MigratedDb,
  type PgClient,
} from '../../scripts/db/pgliteMigrations'

const INTAKE_PREFIX = '20261103142031_'
const DIR = MIGRATIONS_DIR

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const q = async (db: PgClient, s: string): Promise<Row[]> => (await db.query<Row>(s)).rows

// 모든 check 범위 안, 여러 event, 일부 null
const SEED: Row[] = [
  { created_at: '2026-11-01T01:00:00Z', session_id: '11111111-1111-1111-1111-111111111111', event: 'start', device: 'mobile' },
  {
    created_at: '2026-11-01T01:05:00Z', session_id: '11111111-1111-1111-1111-111111111111', event: 'result', device: 'mobile',
    age_band: '25-29', gender: 'female', mbti: 'INFP', mbti_path: 'known', q1: 'A', q2: 'B', q3: 'C', q4: 'A', q5: 'B',
    enneagram_core: 4, attachment: 'anxious', love_type_code: 'LT-0001', big_o: 80, big_c: 40, big_e: 20, big_a: 70, big_n: 60,
    stern_intimacy: 0, stern_passion: 100, stern_commitment: 55, engine_version: 'v1',
  },
  {
    created_at: '2026-11-02T09:00:00Z', session_id: '22222222-2222-2222-2222-222222222222', event: 'core_override', device: 'desktop',
    age_band: '40+', gender: 'other', mbti_path: 'quick', quick_ei: 'A', quick_sn: 'B', quick_ft: 'A', quick_jp: 'B',
    enneagram_core: 9, enneagram_override: 1,
  },
  { created_at: '2026-11-02T09:10:00Z', session_id: '22222222-2222-2222-2222-222222222222', event: 'finish', age_band: 'under14', gender: 'male', mbti: 'ESTJ' },
  { created_at: '2026-11-03T00:00:00Z', session_id: '33333333-3333-3333-3333-333333333333', event: 'consent_view' },
  { created_at: '2026-11-03T00:01:00Z', session_id: '33333333-3333-3333-3333-333333333333', event: 'login', attachment: 'fearful' },
  { created_at: '2026-11-03T00:02:00Z', session_id: '33333333-3333-3333-3333-333333333333', event: 'invite', attachment: 'secure', age_band: '14-19' },
]

const ts = (v: unknown): number => new Date(v as string).getTime()

async function insertSeed(db: PgClient): Promise<void> {
  for (const r of SEED) {
    const cols = Object.keys(r)
    const vals = cols.map((c) => `'${String(r[c]).replace(/'/g, "''")}'`)
    await db.exec(`insert into public.demo_responses (${cols.join(',')}) values (${vals.join(',')})`)
  }
}

async function snapshot(db: PgClient): Promise<Record<string, unknown>> {
  return {
    rows: await q(db, `select * from public.demo_responses order by id`),
    columns: await q(
      db,
      `select ordinal_position, column_name, data_type, is_nullable, column_default, is_identity, identity_generation, character_maximum_length
         from information_schema.columns where table_schema='public' and table_name='demo_responses' order by ordinal_position`,
    ),
    constraints: await q(
      db,
      `select conname, contype, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.demo_responses'::regclass order by conname`,
    ),
    indexes: await q(db, `select indexname, indexdef from pg_indexes where schemaname='public' and tablename='demo_responses' order by indexname`),
    rls: await q(db, `select relrowsecurity, relforcerowsecurity from pg_class where oid='public.demo_responses'::regclass`),
    policies: await q(
      db,
      `select policyname, permissive, cmd, roles::text as roles, qual, with_check from pg_policies where schemaname='public' and tablename='demo_responses' order by policyname`,
    ),
    privileges: await q(
      db,
      `select grantee, privilege_type from information_schema.role_table_grants
         where table_schema='public' and table_name='demo_responses' and grantee in ('anon','authenticated','public') order by grantee, privilege_type`,
    ),
  }
}

let before: Record<string, unknown>
let after: Record<string, unknown>
let m: MigratedDb
let rest: string[]

beforeAll(async () => {
  m = await createMigratedDb({ dir: DIR, throughFile: listMigrationFiles(DIR).find((f) => f.startsWith(INTAKE_PREFIX)) })
  await insertSeed(m.db)
  before = await snapshot(m.db)
  rest = await applyRemaining(m, DIR)
  after = await snapshot(m.db)
}, 120000)

afterAll(async () => {
  await closeAllServers()
})

describe('demo_responses 보존 (R56-5)', () => {
  test('적용 목록 = 저장소 파일 전체이고 편입 파일이 들어 있다(rest 는 그 뒤 파일만)', () => {
    const all = listMigrationFiles(DIR)
    expect(all.some((f) => f.startsWith(INTAKE_PREFIX))).toBe(true)
    expect(m.applied).toEqual(all)
    expect(rest.every((f) => all.indexOf(f) > all.findIndex((x) => x.startsWith(INTAKE_PREFIX)))).toBe(true)
  })

  test('행 수가 그대로다', () => {
    expect((before.rows as Row[]).length).toBe(SEED.length)
    expect((after.rows as Row[]).length).toBe(SEED.length)
  })

  test('각 행의 모든 값이 넣은 값 그대로다', () => {
    const rows = after.rows as Row[]
    rows.forEach((row, i) => {
      for (const [k, v] of Object.entries(SEED[i])) {
        if (k === 'created_at') expect(ts(row[k])).toBe(ts(v))
        else expect(row[k]).toEqual(v)
      }
      // 안 넣은 열은 null (created_at, id 제외)
      for (const k of Object.keys(row)) if (!(k in SEED[i]) && k !== 'id') expect(row[k]).toBeNull()
    })
    expect(after.rows).toEqual(before.rows)
  })

  test('열 정의(이름 · 형 · null 허용 · 기본값)가 그대로다', () => {
    expect(after.columns).toEqual(before.columns)
    expect((after.columns as Row[]).length).toBe(31)
  })

  test('check 제약 · 인덱스가 그대로다', () => {
    expect(after.constraints).toEqual(before.constraints)
    expect(after.indexes).toEqual(before.indexes)
  })

  test('RLS 켜짐이 그대로다', () => {
    expect(after.rls).toEqual(before.rls)
    expect((after.rls as Row[])[0].relrowsecurity).toBe(true)
  })

  test('정책(이름 · 명령 · 역할 · 식)이 그대로다: anon insert 하나뿐', () => {
    expect(after.policies).toEqual(before.policies)
    const p = after.policies as Row[]
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ policyname: 'demo_responses_anon_insert', cmd: 'INSERT', roles: '{anon}', with_check: 'true' })
  })

  test('권한: anon 은 insert 만, authenticated 는 없다', () => {
    expect(after.privileges).toEqual(before.privileges)
    expect(after.privileges).toEqual([{ grantee: 'anon', privilege_type: 'INSERT' }])
  })
})
