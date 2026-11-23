/**
 * @jest-environment node
 *
 * 87-m1 (R148-3) 시험: 알림 하루 집계(push_daily) · 함수 쪽 RPC(push_count) · DB 쪽 pg_net 응답 세기(push_net_pending · push_net_collect) · 예약.
 * supabase/migrations/ 전체를 PGlite 에 적용(원격 0). pg_net · Vault 는 PGlite 에 없다 - 이 시험 안에서만 스텁(net.http_post = 번호를 주고 적기만 ·
 * net._http_response = 표 · vault.decrypted_secrets = 표).
 */
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
let n = 0
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const rows = async (s: string, p?: unknown[]): Promise<Row[]> => (await db.query<Row>(s, p)).rows

/** 역할로 한 문장 - 'ok:행수' 또는 SQLSTATE. */
async function as(role: 'anon' | 'authenticated' | 'service_role', stmt: string): Promise<string> {
  await db.query(`set role ${role}`)
  try {
    return (await one(`select public.t_try($1) as r`, [stmt])).r as string
  } finally {
    await db.query(`reset role`)
  }
}
const all = () => rows(`select kind, status, count from push_daily order by kind, status`)
const kstToday = async () => (await one(`select ((now() at time zone 'Asia/Seoul')::date)::text as d`)).d as string

async function user(): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`q${n}@x.test`])).id as string
  await db.query(`insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`, [id, 'Q' + n])
  return id
}
async function pairWithToken(): Promise<{ c: string; a: string; b: string }> {
  const a = await user()
  const b = await user()
  const c = (await one(`insert into couples(user_a_id,user_b_id,invite_code,status) values ($1,$2,$3,'active'::couple_status) returning id`, [a, b, 'Q' + String(++n).padStart(7, '0')])).id as string
  await db.query(`insert into push_tokens(user_id,device_id,token,platform) values ($1,$2,$3,'android')`, [b, `device-${n}xxxx`, `tok-${n}`])
  return { c, a, b }
}
const message = (c: string, from: string) => db.query(`insert into messages(couple_id,sender_id,body) values ($1,$2,'hi')`, [c, from])
const respond = (id: number, status: number | null, timedOut = false) =>
  db.query(`insert into net._http_response(id, status_code, timed_out) values ($1, $2, $3)`, [id, status, timedOut])

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
  await db.exec(`
    create or replace function public.t_try(stmt text) returns text language plpgsql as $$
    declare k int; begin execute stmt; get diagnostics k = row_count; return 'ok:' || k; exception when others then return sqlstate; end $$;
    grant execute on function public.t_try(text) to anon, authenticated, service_role;
    create schema if not exists net;
    create sequence net.req_seq;
    create table net.calls (id bigint primary key, url text);
    create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
      returns bigint language sql as $f$ insert into net.calls(id, url) values (nextval('net.req_seq'), url) returning id $f$;
    create table net._http_response (id bigint primary key, status_code int, timed_out boolean, error_msg text, content text, created timestamptz default now());
    create schema if not exists vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
    insert into vault.decrypted_secrets values ('ondolog_push_url', 'https://push.invalid/fn'), ('ondolog_push_secret', 'test-secret-not-real');
  `)
}, 120_000)

afterAll(async () => {
  await db?.close()
  await closeAllServers()
})

beforeEach(async () => {
  await db.query(`delete from push_daily`)
  await db.query(`delete from push_net_pending`)
  await db.query(`delete from net._http_response`)
  await db.query(`delete from net.calls`)
})

describe('87-m1 표 모양 · 권한', () => {
  test('칸은 날짜 · 종류 · 갈래 · 건수뿐 / 요청 번호 표는 번호 · 종류 · 시각뿐 - 내용 · 메시지 id · 사람 · 커플 · 토큰 · 주소 칸 0', async () => {
    const cols = async (t: string) => (await rows(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`, [t])).map((r) => r.column_name)
    expect(await cols('push_daily')).toEqual(['day', 'kind', 'status', 'count'])
    expect(await cols('push_net_pending')).toEqual(['id', 'kind', 'created_at'])
    for (const c of [...(await cols('push_daily')), ...(await cols('push_net_pending'))]) {
      expect(c).not.toMatch(/user|couple|actor|token|message|body|content|url|header|email|name|device/)
    }
  })

  test('RLS 켬 · 앱 역할(anon · authenticated) 읽기 · 쓰기 거부 · service_role 은 읽기 · 지우기만', async () => {
    for (const t of ['push_daily', 'push_net_pending']) {
      expect((await one(`select relrowsecurity from pg_class where oid=$1::regclass`, [`public.${t}`])).relrowsecurity).toBe(true)
    }
    await db.query(`insert into push_daily values (current_date, 'message', 'sent', 1)`)
    for (const role of ['anon', 'authenticated'] as const) {
      expect(await as(role, `select * from push_daily`)).toBe('42501')
      expect(await as(role, `insert into push_daily values (current_date, 'message', 'sent', 1)`)).toBe('42501')
      expect(await as(role, `delete from push_daily`)).toBe('42501')
      expect(await as(role, `select * from push_net_pending`)).toBe('42501')
      expect(await as(role, `select public.push_count('message', 'sent', 1)`)).toBe('42501')
      expect(await as(role, `select public.push_net_collect()`)).toBe('42501')
    }
    expect(await as('service_role', `select * from push_daily`)).toBe('ok:1')
    expect(await as('service_role', `insert into push_daily values (current_date, 'date', 'sent', 1)`)).toBe('42501')
    const grants = await rows(`select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='push_daily' order by grantee, privilege_type`)
    expect(grants.filter((g) => ['anon', 'authenticated', 'PUBLIC'].includes(g.grantee))).toEqual([])
    expect(grants.filter((g) => g.grantee === 'service_role').map((g) => g.privilege_type)).toEqual(['DELETE', 'SELECT'])
  })
})

describe('87-m1 (a) 함수 쪽 push_count', () => {
  test('service_role 만 · 같은 날 · 종류 · 갈래는 더함 · 날짜는 서버 KST 오늘 · 목록 밖 갈래 other · 종류 unknown · 건수 1~1000', async () => {
    expect(await as('service_role', `select public.push_count('message', 'sent', 2)`)).toBe('ok:1')
    expect(await as('service_role', `select public.push_count('message', 'sent')`)).toBe('ok:1')
    expect(await as('service_role', `select public.push_count('message', 'fcm_403', 1)`)).toBe('ok:1')
    expect(await as('service_role', `select public.push_count('nope', 'config', 1)`)).toBe('ok:1')
    expect(await as('service_role', `select public.push_count('date', 'Drop Table', 5000)`)).toBe('ok:1')
    const key = (r: Row) => `${r.kind}|${r.status}|${r.count}`
    expect((await all()).map(key).sort()).toEqual(['date|other|1000', 'message|fcm_403|1', 'message|sent|3', 'unknown|config|1'])
    expect((await rows(`select distinct day::text as d from push_daily`)).map((r) => r.d)).toEqual([await kstToday()])
  })
})

describe('87-m1 (b) DB 쪽 pg_net 응답 세기', () => {
  test('알림 요청마다 번호만 적힌다(본문 · 주소 0) · 메시지 저장은 그대로', async () => {
    const { c, a } = await pairWithToken()
    await message(c, a)
    const p = await rows(`select id, kind from push_net_pending`)
    expect(p).toHaveLength(1)
    expect(p[0].kind).toBe('message')
    expect((await rows(`select count(*)::int as k from messages where couple_id = $1`, [c]))[0].k).toBe(1)
  })

  test('응답 200 · 503(함수 비밀 없음) · 401 · 시간 초과 · 연결 실패가 각각 남고 · 다시 세지 않는다', async () => {
    const { c, a } = await pairWithToken()
    for (let i = 0; i < 6; i += 1) await message(c, a)
    const ids = (await rows(`select id from push_net_pending order by id`)).map((r) => Number(r.id))
    expect(ids).toHaveLength(6)
    await respond(ids[0], 200)
    await respond(ids[1], 503)
    await respond(ids[2], 503)
    await respond(ids[3], 401)
    await respond(ids[4], null, true)
    await respond(ids[5], null)
    expect((await one(`select public.push_net_collect() as k`)).k).toBe(6)
    expect(await all()).toEqual([
      { kind: 'message', status: 'http_200', count: 1 },
      { kind: 'message', status: 'http_401', count: 1 },
      { kind: 'message', status: 'http_503', count: 2 },
      { kind: 'message', status: 'net_error', count: 1 },
      { kind: 'message', status: 'timeout', count: 1 },
    ])
    expect(await rows(`select 1 from push_net_pending`)).toEqual([])
    // 응답 표(6시간 보존)에 같은 행이 남아 있어도 두 번 세지 않는다.
    expect((await one(`select public.push_net_collect() as k`)).k).toBe(0)
    expect((await one(`select sum(count)::int as s from push_daily`)).s).toBe(6)
  })

  test('응답이 아직 없으면 기다림 · 6시간 넘게 없으면 lost 로 한 번', async () => {
    const { c, a } = await pairWithToken()
    await message(c, a)
    await message(c, a)
    const ids = (await rows(`select id from push_net_pending order by id`)).map((r) => Number(r.id))
    await db.query(`update push_net_pending set created_at = now() - interval '7 hours' where id = $1`, [ids[0]])
    expect((await one(`select public.push_net_collect() as k`)).k).toBe(1)
    expect(await all()).toEqual([{ kind: 'message', status: 'lost', count: 1 }])
    expect((await rows(`select id from push_net_pending`)).map((r) => Number(r.id))).toEqual([ids[1]])
    expect((await one(`select public.push_net_collect() as k`)).k).toBe(0)
  })

  test('날짜 = 요청 시각의 KST 날짜(15:30 UTC = 다음 날 KST)', async () => {
    const { c, a } = await pairWithToken()
    await message(c, a)
    const id = Number((await one(`select id from push_net_pending`)).id)
    await db.query(`update push_net_pending set created_at = '2026-11-22T15:30:00Z' where id = $1`, [id])
    await respond(id, 503)
    await db.query(`select public.push_net_collect()`)
    expect(await rows(`select day::text as day, status, count from push_daily`)).toEqual([{ day: '2026-11-23', status: 'http_503', count: 1 }])
  })

  test('1시간마다 예약(pg_net 보존 6시간보다 짧게) · 기존 예약 그대로', async () => {
    expect(await rows(`select jobname, schedule, command from cron.job where jobname = 'push-net-count'`)).toEqual([
      { jobname: 'push-net-count', schedule: '7 * * * *', command: ' select public.push_net_collect(); ' },
    ])
    expect((await rows(`select jobname from cron.job order by jobname`)).map((r) => r.jobname)).toEqual(['execute-dissolutions', 'expire-stories', 'push-net-count'])
  })
})
