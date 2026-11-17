/**
 * @jest-environment node
 *
 * 80-m1 (R114-3 ② · R115-4) 시험: 앱 오류 하루 집계(app_error_daily) · 넣기 RPC(log_app_error). supabase/migrations/ 전체를 PGlite 에 적용(원격 0).
 * 앱 역할(anon · authenticated)은 RPC 로만 넣고 표를 직접 읽거나 쓰지 못한다 · 허용 목록 밖은 'other' · 같은 묶음 +1 · 상한 · 사람 · 기기 칸 0 · 90일 정리 멱등.
 */
import { closeAllServers, createMigratedDb, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const rows = async (s: string, p?: unknown[]): Promise<Row[]> => (await db.query<Row>(s, p)).rows

/** 역할(anon · authenticated)로 한 문장 - 'ok:행수' 또는 SQLSTATE. */
async function as(role: 'anon' | 'authenticated', stmt: string): Promise<string> {
  await db.query(`set role ${role}`)
  try {
    return (await one(`select public.t_try($1) as r`, [stmt])).r as string
  } finally {
    await db.query(`reset role`)
  }
}
const q = (v: string) => `'${v.replace(/'/g, "''")}'`
const log = (role: 'anon' | 'authenticated', screen: string, kind: string, version = '0.1.0', platform = 'android', count: number | null = null) =>
  as(role, `select public.log_app_error(${q(screen)}, ${q(kind)}, ${q(version)}, ${q(platform)}${count === null ? '' : `, ${count}`})`)
const all = () => rows(`select screen, kind, app_version, platform, count from app_error_daily order by screen, kind, app_version, platform`)
const kstToday = async () => (await one(`select ((now() at time zone 'Asia/Seoul')::date)::text as d`)).d as string

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  await db.exec(`
    create or replace function public.t_try(stmt text) returns text language plpgsql as $$
    declare k int; begin execute stmt; get diagnostics k = row_count; return 'ok:' || k; exception when others then return sqlstate; end $$;
    grant execute on function public.t_try(text) to anon, authenticated;
  `)
}, 120_000)

afterAll(async () => {
  await closeAllServers()
})

beforeEach(async () => {
  await db.query(`delete from app_error_daily`)
})

describe('80-m1 표 모양', () => {
  test('칸은 날짜 · 화면 · 종류 · 버전 · 플랫폼 · 건수뿐 - 사람 · 커플 · 기기 · IP · 메시지 · 스택 칸 0', async () => {
    const cols = (await rows(`select column_name from information_schema.columns where table_schema='public' and table_name='app_error_daily' order by ordinal_position`)).map((r) => r.column_name)
    expect(cols).toEqual(['day', 'screen', 'kind', 'app_version', 'platform', 'count'])
    for (const c of cols) expect(c).not.toMatch(/user|couple|device|ip|message|stack|text|detail|email|token/)
  })

  test('RLS 켬 · 앱 역할 표 권한 0 · service_role 은 읽기 · 지우기', async () => {
    expect((await one(`select relrowsecurity from pg_class where oid='public.app_error_daily'::regclass`)).relrowsecurity).toBe(true)
    const grants = await rows(`select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='app_error_daily' order by grantee, privilege_type`)
    expect(grants.filter((g) => g.grantee === 'anon' || g.grantee === 'authenticated' || g.grantee === 'PUBLIC')).toEqual([])
    expect(grants.filter((g) => g.grantee === 'service_role').map((g) => g.privilege_type)).toEqual(['DELETE', 'SELECT'])
  })

  test('RPC 실행 권한: anon · authenticated 예 · PUBLIC 아니오', async () => {
    const r = await one(`select has_function_privilege('anon','public.log_app_error(text,text,text,text,integer)','execute') as anon,
      has_function_privilege('authenticated','public.log_app_error(text,text,text,text,integer)','execute') as auth`)
    expect(r).toEqual({ anon: true, auth: true })
    const pub = await one(`select count(*)::int as n from information_schema.routine_privileges where routine_name='log_app_error' and grantee='PUBLIC'`)
    expect(pub.n).toBe(0)
  })
})

describe('80-m1 넣기는 RPC 로만', () => {
  test('로그인 전(anon) · 로그인(authenticated) 모두 RPC 로 넣는다 · 날짜는 서버의 KST 오늘', async () => {
    expect(await log('anon', 'intro', 'uncaught')).toBe('ok:1')
    expect(await log('authenticated', 'chat', 'upload_fail', '0.1.0', 'ios')).toBe('ok:1')
    expect(await all()).toEqual([
      { screen: 'chat', kind: 'upload_fail', app_version: '0.1.0', platform: 'ios', count: 1 },
      { screen: 'intro', kind: 'uncaught', app_version: '0.1.0', platform: 'android', count: 1 },
    ])
    const days = await rows(`select distinct day::text as d from app_error_daily`)
    expect(days.map((d) => d.d)).toEqual([await kstToday()])
  })

  test('표 직접 쓰기 · 읽기 · 고치기 · 지우기 거부(앱 역할)', async () => {
    await log('anon', 'main', 'uncaught')
    for (const role of ['anon', 'authenticated'] as const) {
      expect(await as(role, `insert into app_error_daily(day,screen,kind,app_version,platform,count) values (current_date,'main','uncaught','0.1.0','web',1)`)).toBe('42501')
      expect(await as(role, `select * from app_error_daily`)).toBe('42501')
      expect(await as(role, `update app_error_daily set count = 0`)).toBe('42501')
      expect(await as(role, `delete from app_error_daily`)).toBe('42501')
    }
    expect((await all())[0].count).toBe(1)
  })

  test('허용 목록 밖 화면 · 종류 -> other · 버전 형식 · 길이 밖 -> other · 플랫폼 밖 -> other', async () => {
    await log('anon', 'not-a-route', 'TypeError: x is undefined at foo.js:1')
    await log('anon', 'main', 'uncaught', '1.2.3-beta', 'windows')
    await log('anon', 'main', 'uncaught', '1'.repeat(30), 'android')
    await log('anon', "main' or '1'='1", 'uncaught')
    expect(await all()).toEqual([
      { screen: 'main', kind: 'uncaught', app_version: 'other', platform: 'android', count: 1 },
      { screen: 'main', kind: 'uncaught', app_version: 'other', platform: 'other', count: 1 },
      { screen: 'other', kind: 'other', app_version: '0.1.0', platform: 'android', count: 1 },
      { screen: 'other', kind: 'uncaught', app_version: '0.1.0', platform: 'android', count: 1 },
    ])
  })

  test('null 값도 받아 other 로(오류 없음)', async () => {
    expect(await as('anon', `select public.log_app_error(null, null, null, null, null)`)).toBe('ok:1')
    expect(await all()).toEqual([{ screen: 'other', kind: 'other', app_version: 'other', platform: 'other', count: 1 }])
  })
})

describe('80-m1 건수', () => {
  test('같은 묶음은 +1(행 하나) · 다른 플랫폼은 다른 행', async () => {
    await log('anon', 'feed', 'cache_fail')
    await log('authenticated', 'feed', 'cache_fail')
    await log('anon', 'feed', 'cache_fail', '0.1.0', 'web')
    expect(await all()).toEqual([
      { screen: 'feed', kind: 'cache_fail', app_version: '0.1.0', platform: 'android', count: 2 },
      { screen: 'feed', kind: 'cache_fail', app_version: '0.1.0', platform: 'web', count: 1 },
    ])
  })

  test('기기가 모아 보낸 건수(p_count)는 1~1000으로 잘린다', async () => {
    await log('anon', 'sky', 'render_crash', '0.1.0', 'android', 7)
    await log('anon', 'sky', 'render_crash', '0.1.0', 'android', 0)
    await log('anon', 'sky', 'render_crash', '0.1.0', 'android', -5)
    await log('anon', 'sky', 'render_crash', '0.1.0', 'android', 999999)
    expect((await all())[0].count).toBe(7 + 1 + 1 + 1000)
  })

  test('묶음 하루 상한 10,000 - 넘으면 더하지 않는다', async () => {
    for (let i = 0; i < 10; i++) await log('anon', 'chat', 'queue_giveup', '0.1.0', 'android', 1000)
    expect((await all())[0].count).toBe(10000)
    expect(await log('anon', 'chat', 'queue_giveup', '0.1.0', 'android', 1000)).toBe('ok:1')
    await log('anon', 'chat', 'queue_giveup')
    expect((await all())[0].count).toBe(10000)
  })
})

describe('80-m1 90일 정리(월요일 purgeWithdrawn 과 같은 문장)', () => {
  test('90일 지난 행만 지운다 · 두 번 돌려도 같다(멱등)', async () => {
    await db.query(`insert into app_error_daily(day,screen,kind,app_version,platform,count) values
      ((now() at time zone 'Asia/Seoul')::date - 91,'main','uncaught','0.1.0','android',3),
      ((now() at time zone 'Asia/Seoul')::date - 90,'main','uncaught','0.1.0','android',2),
      ((now() at time zone 'Asia/Seoul')::date,'main','uncaught','0.1.0','android',1)`)
    const purge = async () => {
      await db.query(`set role service_role`)
      try {
        return (await db.query(`delete from public.app_error_daily where day < ((now() at time zone 'Asia/Seoul')::date - 90) returning 1`)).rows.length
      } finally {
        await db.query(`reset role`)
      }
    }
    expect(await purge()).toBe(1)
    expect(await purge()).toBe(0)
    expect((await all()).map((r) => r.count as number).sort()).toEqual([1, 2])
  })
})
