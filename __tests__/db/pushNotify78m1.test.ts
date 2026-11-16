/**
 * @jest-environment node
 *
 * 78-m1 (R100-4 · R101-5 · R109-1 ①) 시험: 기기 토큰 · 알림 설정 · 발송 트리거 · 닉네임 바꾼 사람 칸. supabase/migrations/ 전체를 PGlite 에 적용(원격 0).
 * pg_net · Vault 는 PGlite 에 없다 - 이 시험 안에서만 스텁을 만든다(net.http_post = 호출을 표에 적기만 함, vault.decrypted_secrets = 표).
 * 요청 사용자는 request.jwt.claim.sub 설정값 + `set role authenticated` 로 흉내 낸다(다른 PGlite 시험과 같음).
 */
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
let n = 0
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const rows = async (s: string, p?: unknown[]): Promise<Row[]> => (await db.query<Row>(s, p)).rows

const SECRET = 'test-secret-not-real'

async function user(): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`p${n}@x.test`])).id as string
  await db.query(`insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`, [id, 'P' + n])
  return id
}
async function couple(a: string, b: string | null, status = 'active'): Promise<string> {
  return (await one(`insert into couples(user_a_id,user_b_id,invite_code,status) values ($1,$2,$3,$4::couple_status) returning id`, [a, b, 'P' + String(++n).padStart(7, '0'), status])).id as string
}

/** uid 로 한 문장 - 'ok:행수' 또는 SQLSTATE. */
async function as(uid: string | null, stmt: string): Promise<string> {
  await db.query(`set role authenticated`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return (await one(`select public.t_try($1) as r`, [stmt])).r as string
  } finally {
    await db.query(`reset role`)
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
/** uid 로 읽기(RLS 적용). */
async function readAs(uid: string, sql: string): Promise<Row[]> {
  await db.query(`set role authenticated`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  try {
    return await rows(sql)
  } finally {
    await db.query(`reset role`)
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
/** 요청 사용자 uid 로(역할은 그대로) 한 문장 - 트리거의 auth.uid() 를 흉내 낸다. */
async function withUid(uid: string, sql: string, p?: unknown[]): Promise<void> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  try {
    await db.query(sql, p)
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
const register = (uid: string, device: string, token: string) => as(uid, `select public.push_register('${device}', '${token}', 'android')`)
const calls = async (): Promise<Row[]> => rows(`select url, body, headers from net.calls order by seq`)
const clearCalls = () => db.query(`delete from net.calls`)
const message = (c: string, from: string, body: string | null, media: string | null = null) =>
  db.query(`insert into messages(couple_id,sender_id,body,media_path) values ($1,$2,$3,$4)`, [c, from, body, media])

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
  await db.exec(`
    create or replace function public.t_try(stmt text) returns text language plpgsql as $$
    declare k int; begin execute stmt; get diagnostics k = row_count; return 'ok:' || k; exception when others then return sqlstate; end $$;
    grant execute on function public.t_try(text) to authenticated;
    create schema if not exists net;
    create table net.calls (seq serial primary key, url text, body jsonb, headers jsonb);
    create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
      returns bigint language sql as $f$ insert into net.calls(url, body, headers) values (url, body, headers) returning seq::bigint $f$;
    create schema if not exists vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
    insert into vault.decrypted_secrets values ('ondolog_push_url', 'https://push.invalid/fn'), ('ondolog_push_secret', '${SECRET}');
  `)
}, 120000)
afterAll(async () => {
  await db?.close()
  await closeAllServers()
})
beforeEach(async () => {
  await clearCalls()
})

describe('기기 토큰 - 본인만', () => {
  it('등록은 push_register 로만 · 본인 토큰만 읽기 · 상대 토큰 읽기 거부 · 직접 쓰기 거부 · 상대 행 지우기 0', async () => {
    const A = await user()
    const B = await user()
    await couple(A, B)
    expect(await register(A, 'device-aaaa', 'tok-A1')).toBe('ok:1')
    expect(await register(B, 'device-bbbb', 'tok-B1')).toBe('ok:1')
    expect((await readAs(A, `select token from push_tokens`)).map((r) => r.token)).toEqual(['tok-A1'])
    expect(await readAs(B, `select token from push_tokens where user_id = '${A}'`)).toEqual([])
    expect(await as(A, `insert into push_tokens(user_id,device_id,token,platform) values ('${A}','device-xxxx','tok-x','android')`)).toBe('42501')
    expect(await as(A, `update push_tokens set token = 'tok-z'`)).toBe('42501')
    expect(await as(A, `delete from push_tokens where token = 'tok-B1'`)).toBe('ok:0')
    expect(await as(A, `delete from push_tokens where device_id = 'device-aaaa'`)).toBe('ok:1')
    expect(await as(null, `select public.push_register('device-cccc','tok-c','android')`)).toBe('28000')
    expect(await as(A, `select public.push_register('device-cccc','tok-c','web')`)).toBe('22023')
  })

  it('토큰이 바뀌면 같은 기기 행을 갱신(행 하나)', async () => {
    const A = await user()
    await register(A, 'device-r1r1', 'tok-old')
    await register(A, 'device-r1r1', 'tok-new')
    expect((await rows(`select token from push_tokens where user_id = $1`, [A])).map((r) => r.token)).toEqual(['tok-new'])
  })

  it('계정 전환: 같은 기기 · 같은 토큰이 다른 사람에게 오면 이전 행이 지워지고 새 사람에게 옮겨 간다', async () => {
    const A = await user()
    const C = await user()
    await register(A, 'device-sw01', 'tok-shared')
    await register(C, 'device-sw01', 'tok-shared')
    expect(await rows(`select user_id from push_tokens where token = 'tok-shared'`)).toEqual([{ user_id: C }])
    expect(await rows(`select 1 from push_tokens where user_id = $1`, [A])).toEqual([])
  })

  it('계정 전환(로그아웃 못 한 채 다른 계정): 새 사람이 push_claim_device 를 부르면 이 기기의 이전 사람 행만 지워진다', async () => {
    const A = await user()
    const C = await user()
    await register(A, 'device-cl01', 'tok-cl-A')
    await register(A, 'device-cl02', 'tok-cl-A2')
    expect(await as(C, `select public.push_claim_device('device-cl01')`)).toBe('ok:1')
    expect((await rows(`select device_id from push_tokens where user_id = $1`, [A])).map((r) => r.device_id)).toEqual(['device-cl02'])
    expect(await as(null, `select public.push_claim_device('device-cl02')`)).toBe('28000')
  })

  it('사람이 지워지면 토큰 · 설정도 0(cascade)', async () => {
    const A = await user()
    await register(A, 'device-del1', 'tok-del')
    await db.query(`insert into notification_settings(user_id, messages) values ($1, false)`, [A])
    await db.query(`delete from auth.users where id = $1`, [A])
    expect(await rows(`select 1 from push_tokens where token = 'tok-del'`)).toEqual([])
    expect(await rows(`select 1 from notification_settings where user_id = $1`, [A])).toEqual([])
  })
})

describe('알림 설정(H10) - 본인만', () => {
  it('본인 행만 쓰기 · 읽기 · 상대 설정 읽기 0 · 남의 행 쓰기 거부', async () => {
    const A = await user()
    const B = await user()
    await couple(A, B)
    expect(await as(A, `insert into notification_settings(user_id, messages, changes) values ('${A}', false, true)`)).toBe('ok:1')
    expect(await as(A, `insert into notification_settings(user_id) values ('${B}')`)).toBe('42501')
    expect(await as(A, `update notification_settings set changes = false where user_id = '${A}'`)).toBe('ok:1')
    expect(await readAs(B, `select * from notification_settings where user_id = '${A}'`)).toEqual([])
    expect(await as(B, `update notification_settings set messages = true where user_id = '${A}'`)).toBe('ok:0')
    expect(await one(`select messages, changes from notification_settings where user_id = $1`, [A])).toEqual({ messages: false, changes: false })
  })
})

describe('새 메시지 트리거', () => {
  it('메시지 -> 호출 1(상대 토큰이 있을 때) · 비밀 헤더 · 원문 0 · 사진이면 photo', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(B, 'device-m1m1', 'tok-mB')
    await message(C, A, '퇴근하고 전화할게')
    let c = await calls()
    expect(c).toHaveLength(1)
    expect(c[0].url).toBe('https://push.invalid/fn')
    expect(c[0].headers['x-ondolog-push']).toBe(SECRET)
    expect(c[0].body).toEqual({ kind: 'message', couple_id: C, actor_id: A, photo: false })
    expect(JSON.stringify(c[0].body)).not.toContain('퇴근')
    await clearCalls()
    await message(C, A, null, `${C}/x.jpg`)
    c = await calls()
    expect(c).toHaveLength(1)
    expect(c[0].body.photo).toBe(true)
  })

  it('상대에게 토큰이 없으면 0 · 내가 보낸 것에 내 토큰으로 0', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(A, 'device-m2m2', 'tok-mA')
    await message(C, A, 'hi')
    expect(await calls()).toHaveLength(0)
  })

  it('설정 끔 -> 0 · 다시 켜면 1 · 변경 안내만 꺼도 메시지는 1', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(B, 'device-m3m3', 'tok-m3')
    await db.query(`insert into notification_settings(user_id, messages) values ($1, false)`, [B])
    await message(C, A, 'hi')
    expect(await calls()).toHaveLength(0)
    await db.query(`update notification_settings set messages = true, changes = false where user_id = $1`, [B])
    await message(C, A, 'hi')
    expect(await calls()).toHaveLength(1)
  })

  it('해제 유예 · 해제 · 연결 전 · 받는 사람 탈퇴 유예 -> 0', async () => {
    for (const status of ['dissolving', 'dissolved']) {
      const A = await user()
      const B = await user()
      const C = await couple(A, B, status)
      await register(B, `device-${status.slice(0, 8)}`, `tok-${status}`)
      await message(C, A, 'hi')
    }
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(B, 'device-wd01', 'tok-wd')
    await db.query(`update profiles set deleted_at = now(), purge_scheduled_at = now() + interval '7 days' where id = $1`, [B])
    await message(C, A, 'hi')
    expect(await calls()).toHaveLength(0)
  })

  it('Vault 값이 없으면 0이고 메시지 저장은 그대로', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(B, 'device-nv01', 'tok-nv')
    await db.query(`update vault.decrypted_secrets set decrypted_secret = null where name = 'ondolog_push_url'`)
    try {
      await message(C, A, 'kept')
      expect(await calls()).toHaveLength(0)
      expect(await rows(`select 1 from messages where couple_id = $1`, [C])).toHaveLength(1)
    } finally {
      await db.query(`update vault.decrypted_secrets set decrypted_secret = 'https://push.invalid/fn' where name = 'ondolog_push_url'`)
    }
  })

  it('pg_net 이 실패해도 메시지 저장은 막히지 않는다', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(B, 'device-nf01', 'tok-nf')
    await db.query(`alter table net.calls rename to calls_off`)
    try {
      await message(C, A, 'kept')
      expect(await rows(`select 1 from messages where couple_id = $1`, [C])).toHaveLength(1)
    } finally {
      await db.query(`alter table net.calls_off rename to calls`)
    }
  })
})

describe('변경 안내 트리거 + 닉네임 바꾼 사람 칸', () => {
  it('처음 정하기 0 · 날짜 · 닉네임이 바뀌면 바꾼 사람의 상대에게만 · 바꾼 사람 칸은 닉네임 변경 때만', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(A, 'device-cA01', 'tok-cA')
    await register(B, 'device-cB01', 'tok-cB')
    // 처음 정하기(온보딩) - 바꿈이 아니다
    await withUid(A, `update couples set relationship_start_date = '2024-01-01', start_date_set_by = $2, nickname = '늘봄' where id = $1`, [C, A])
    expect(await calls()).toHaveLength(0)
    expect((await one(`select nickname_changed_by from couples where id = $1`, [C])).nickname_changed_by).toBeNull()
    // A가 날짜를 바꿈 -> B에게(actor = A)
    await withUid(A, `update couples set relationship_start_date = '2024-02-02', start_date_set_by = $2, start_date_confirmed_by = null where id = $1`, [C, A])
    let c = await calls()
    expect(c.map((x) => x.body)).toEqual([{ kind: 'date', couple_id: C, actor_id: A, photo: false }])
    const ctx = await one(`select public.push_context($1,'date',$2,$3) as r`, [SECRET, C, A])
    expect(ctx.r.tokens.map((t: Row) => t.token)).toEqual(['tok-cB'])
    expect(ctx.r.sender_name).toBe((await one(`select display_name from profiles where id = $1`, [A])).display_name)
    // B가 닉네임을 바꿈 -> A에게, 바꾼 사람 = B
    await clearCalls()
    await withUid(B, `update couples set nickname = '새벽' where id = $1`, [C])
    c = await calls()
    expect(c.map((x) => x.body.kind)).toEqual(['nickname'])
    expect(c[0].body.actor_id).toBe(B)
    expect(JSON.stringify(c[0].body)).not.toContain('새벽')
    expect((await one(`select nickname_changed_by from couples where id = $1`, [C])).nickname_changed_by).toBe(B)
    // 변경 안내 끔 -> 0
    await clearCalls()
    await db.query(`insert into notification_settings(user_id, changes) values ($1, false)`, [A])
    await withUid(B, `update couples set nickname = '한낮' where id = $1`, [C])
    expect(await calls()).toHaveLength(0)
  })

  it('앱은 바꾼 사람 칸을 직접 쓸 수 없다 · 바꾼 사람이 지워지면 칸이 비워진다(set null)', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    expect(await as(A, `update couples set nickname_changed_by = '${A}' where id = '${C}'`)).toBe('42501')
    await withUid(A, `update couples set nickname = '처음' where id = $1`, [C])
    await withUid(A, `update couples set nickname = '다음' where id = $1`, [C])
    await db.query(`update couples set status = 'dissolved' where id = $1`, [C])
    await db.query(`delete from auth.users where id = $1`, [A])
    expect((await one(`select nickname_changed_by from couples where id = $1`, [C])).nickname_changed_by).toBeNull()
  })
})

describe('발송 함수용 RPC', () => {
  it('비밀이 다르면 거부 · 맞으면 받는 사람 토큰 · 잘못된 토큰 정리 · 앱 역할은 부를 수 없다', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B)
    await register(B, 'device-x1x1', 'tok-x1')
    expect((await one(`select public.push_context('wrong','message',$1,$2) as r`, [C, A])).r).toEqual({ ok: false })
    expect((await one(`select public.push_context(null,'message',$1,$2) as r`, [C, A])).r).toEqual({ ok: false })
    const ok = (await one(`select public.push_context($3,'message',$1,$2) as r`, [C, A, SECRET])).r
    expect(ok.ok).toBe(true)
    expect(ok.tokens).toHaveLength(1)
    // 끈 사람 -> 빈 목록
    await db.query(`insert into notification_settings(user_id, messages) values ($1, false)`, [B])
    expect((await one(`select public.push_context($3,'message',$1,$2) as r`, [C, A, SECRET])).r.tokens).toEqual([])
    expect((await one(`select public.push_drop_token('wrong', $1) as r`, [ok.tokens[0].id])).r).toBe(false)
    expect((await one(`select public.push_drop_token($2, $1) as r`, [ok.tokens[0].id, SECRET])).r).toBe(true)
    expect(await rows(`select 1 from push_tokens where user_id = $1`, [B])).toEqual([])
    expect(await as(A, `select public.push_context('${SECRET}','message','${C}','${A}')`)).toBe('42501')
    expect(await as(A, `select public.push_drop_token('${SECRET}','${C}')`)).toBe('42501')
    expect(await as(A, `select public.push_enqueue('message','${C}','${A}', false)`)).toBe('42501')
  })
})
