/**
 * @jest-environment node
 *
 * 75-m1 (R94-1) 시험: 유예 중 초대 발급 · 연결 서버 거부. supabase/migrations/ 전체를 PGlite 에 적용(원격 접속 0).
 * 고정 SQLSTATE: OG001 = 해제 유예(dissolving 커플 구성원, user_a · user_b 모두) / OG002 = 탈퇴 유예(profiles.deleted_at). 둘 다면 OG002.
 * 요청 사용자는 request.jwt.claim.sub 설정값으로 흉내 낸다(스텁 auth.uid() 와 같은 경로). 설정값이 비면 service_role 과 같다(트리거 면제).
 */
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
let n = 0

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]

async function user(): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`u${n}@x.test`])).id as string
  await db.query(
    `insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`,
    [id, 'u' + n],
  )
  return id
}

/** 사용자 uid 로 SQL 한 문장을 실행하고 'ok' 또는 SQLSTATE 를 돌려준다(오류 때 하위 트랜잭션만 되돌림). */
async function as(uid: string | null, stmt: string): Promise<string> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return (await one(`select public.t_try($1) as r`, [stmt])).r as string
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
const asRows = async (uid: string, sql: string): Promise<Row> => {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  try {
    return await one(sql)
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

const code = (): string => 'C' + String(++n).padStart(7, '0')
const invite = (uid: string, c = code()): string => `insert into couples(user_a_id,invite_code) values ('${uid}','${c}')`
const connect = (c: string): string => `select public.fn_connect_couple('${c}')`

/** active 커플(service_role 방식 삽입) */
async function activeCouple(a: string, b: string): Promise<string> {
  return (await one(`insert into couples(user_a_id,user_b_id,invite_code,status) values ($1,$2,$3,'active') returning id`, [a, b, code()])).id as string
}
/** 대기 초대 행(service_role 방식 삽입) */
async function pending(a: string): Promise<string> {
  const c = code()
  await db.query(`insert into couples(user_a_id,invite_code) values ($1,$2)`, [a, c])
  return c
}
const status = async (id: string): Promise<string> => (await one(`select status::text s from couples where id=$1`, [id])).s as string

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
  await db.exec(`
    create or replace function public.t_try(stmt text) returns text language plpgsql as $$
    begin execute stmt; return 'ok'; exception when others then return sqlstate; end $$;`)
}, 120000)

afterAll(async () => {
  await db?.close()
  await closeAllServers()
})

describe('(1) 해제 유예 OG001', () => {
  let A: string, B: string, d: string
  beforeAll(async () => {
    A = await user()
    B = await user()
    await activeCouple(A, B)
    d = (await asRows(A, `select public.fn_request_dissolution() as id`)).id as string
  })
  it('1-a user_a 의 초대 발급 -> OG001 (고유 인덱스 23505 보다 먼저)', async () => {
    expect(await as(A, invite(A))).toBe('OG001')
  })
  it('1-b user_b 의 초대 발급 -> OG001 (옛 구멍)', async () => {
    expect(await as(B, invite(B))).toBe('OG001')
  })
  it('1-c 연결: 부르는 사람이 해제 유예 구성원 -> OG001 (user_a · user_b 둘 다)', async () => {
    const X = await user()
    const cx = await pending(X)
    expect(await as(B, connect(cx))).toBe('OG001')
    const Y = await user()
    const cy = await pending(Y)
    expect(await as(A, connect(cy))).toBe('OG001')
  })
  it('1-d 연결: 초대한 사람이 해제 유예 구성원 -> OG001', async () => {
    const C1 = await user()
    const D1 = await user()
    const E1 = await user()
    const F1 = await user()
    const cid = await activeCouple(C1, D1)
    await asRows(C1, `select public.fn_request_dissolution() as id`)
    expect(await status(cid)).toBe('dissolving')
    const codeD = await pending(D1) // service_role 방식으로 심은 user_b 의 대기 행(옛 구멍 잔여)
    expect(await as(E1, connect(codeD))).toBe('OG001')
    const codeC = code()
    await db.query(`insert into couples(user_a_id,invite_code,status) values ($1,$2,'pending')`, [F1, codeC])
    expect(await as(E1, connect(codeC))).toBe('ok')
  })
  it('해제 취소 뒤: 커플이 다시 active -> 발급 · 연결은 OG001 이 아니라 기존 23505 (규칙이 풀린 것 = 해제 유예가 끝남)', async () => {
    expect(await as(A, `select public.fn_cancel_dissolution('${d}')`)).toBe('ok')
    expect(await as(A, invite(A))).toBe('23505')
    const X = await user()
    const cx = await pending(X)
    expect(await as(A, connect(cx))).toBe('23505')
  })
})

describe('(2) 탈퇴 유예 OG002', () => {
  it('2-a 탈퇴 유예 사용자의 초대 발급 -> OG002', async () => {
    const W = await user()
    await asRows(W, `select public.fn_request_withdrawal() as r`)
    expect(await as(W, invite(W))).toBe('OG002')
  })
  it('2-b 커플이 있는 탈퇴 유예 사용자(커플도 dissolving) -> OG002 가 OG001 보다 먼저', async () => {
    const A = await user()
    const B = await user()
    await activeCouple(A, B)
    await asRows(A, `select public.fn_request_withdrawal() as r`)
    expect(await as(A, invite(A))).toBe('OG002')
    expect(await as(B, invite(B))).toBe('OG001') // 상대는 해제 유예
  })
  it('2-c 연결: 탈퇴 유예 사용자가 부름 -> OG002', async () => {
    const W = await user()
    const I = await user()
    const ci = await pending(I)
    await asRows(W, `select public.fn_request_withdrawal() as r`)
    expect(await as(W, connect(ci))).toBe('OG002')
  })
  it('2-d 연결: 초대한 사람이 탈퇴 유예 -> OG002', async () => {
    const I = await user()
    const ci = await pending(I)
    await asRows(I, `select public.fn_request_withdrawal() as r`)
    const D = await user()
    expect(await as(D, connect(ci))).toBe('OG002')
  })
  it('탈퇴 취소 뒤 다시 허용: 발급 ok -> 다른 사람이 연결 ok', async () => {
    const W = await user()
    await asRows(W, `select public.fn_request_withdrawal() as r`)
    expect(await as(W, invite(W))).toBe('OG002')
    await asRows(W, `select public.fn_cancel_withdrawal() as r`)
    const c = code()
    expect(await as(W, invite(W, c))).toBe('ok')
    const D = await user()
    expect(await as(D, connect(c))).toBe('ok')
  })
  it('커플이 있던 탈퇴 유예 -> 탈퇴 취소 뒤 커플 active 복귀 -> 발급은 기존 23505', async () => {
    const A = await user()
    const B = await user()
    const cid = await activeCouple(A, B)
    await asRows(A, `select public.fn_request_withdrawal() as r`)
    await asRows(A, `select public.fn_cancel_withdrawal() as r`)
    expect(await status(cid)).toBe('active')
    expect(await as(A, invite(A))).toBe('23505')
  })
})

describe('(3) 정상 회귀 · 면제', () => {
  it('정상 초대 발급 -> ok, 정상 연결 -> ok(active, user_b 채워짐)', async () => {
    const A = await user()
    const B = await user()
    const c = code()
    expect(await as(A, invite(A, c))).toBe('ok')
    expect(await as(B, connect(c))).toBe('ok')
    const r = await one(`select status::text s, user_b_id b from couples where invite_code=$1`, [c])
    expect(r.s).toBe('active')
    expect(r.b).toBe(B)
  })
  it('이미 active 커플 구성원의 연결 -> 기존 23505, 없는 코드 -> P0002, 자기 코드 -> 22023, 비로그인 -> 28000', async () => {
    const A = await user()
    const B = await user()
    await activeCouple(A, B)
    const X = await user()
    const cx = await pending(X)
    expect(await as(A, connect(cx))).toBe('23505')
    expect(await as(X, connect('NOPE0000'))).toBe('P0002')
    expect(await as(X, connect(cx))).toBe('22023')
    expect(await as(null, connect(cx))).toBe('28000')
  })
  it('service_role 방식(uid 없음) 삽입은 면제: 유예 중 사용자의 행도 들어간다(ops 시드)', async () => {
    const W = await user()
    await asRows(W, `select public.fn_request_withdrawal() as r`)
    expect(await as(null, invite(W))).toBe('ok')
  })
  it('함수 권한: fn_connect_couple 은 authenticated 만 실행 가능, 트리거 함수는 누구도 직접 실행 불가', async () => {
    const r = await one(
      `select has_function_privilege('authenticated','public.fn_connect_couple(text)','execute') a,
              has_function_privilege('anon','public.fn_connect_couple(text)','execute') b,
              has_function_privilege('service_role','public.fn_connect_couple(text)','execute') d,
              has_function_privilege('authenticated','public.tg_couples_block_grace_invite()','execute') e`,
    )
    expect([r.a, r.b, r.d, r.e]).toEqual([true, false, false, false])
  })
  it('RLS 는 couples 에 켜져 있다', async () => {
    expect((await one(`select relrowsecurity r from pg_class where oid='public.couples'::regclass`)).r).toBe(true)
  })
})

describe('(4) 75-t1 (R96-2 · R95-3) 이미 연결된 코드 주인의 코드로는 연결되지 않는다', () => {
  const count = async (): Promise<number> => Number((await one(`select count(*)::int c from couples`)).c)
  const memberOf = async (uid: string): Promise<number> =>
    Number((await one(`select count(*)::int c from couples where status in ('active','dissolving') and (user_a_id=$1 or user_b_id=$1)`, [uid])).c)

  it('active 커플의 user_b가 만든 pending 코드 -> 혼자인 C의 연결은 23505 · 새 커플 0 · A·B 커플 그대로', async () => {
    const A = await user()
    const B = await user()
    const ab = await activeCouple(A, B)
    const cb = code()
    expect(await as(B, invite(B, cb))).toBe('ok') // 지금 서버가 허용하는 행(user_b의 pending 초대) - R95-3 낮음(M3)
    const C = await user()
    const before = await count()
    expect(await as(C, connect(cb))).toBe('23505') // m1 :135~138 코드 주인(v_row.user_a_id) 검사
    expect(await count()).toBe(before)
    expect(await memberOf(C)).toBe(0)
    expect(await status(ab)).toBe('active')
    const pend = await one(`select status::text s, user_b_id from couples where invite_code=$1`, [cb])
    expect([pend.s, pend.user_b_id]).toEqual(['pending', null])
  })

  it('같은 경우에서 B의 커플이 dissolving(해제 유예) -> C의 연결은 OG001(m1 8-1이 9보다 먼저)', async () => {
    const A = await user()
    const B = await user()
    const ab = await activeCouple(A, B)
    const cb = code()
    expect(await as(B, invite(B, cb))).toBe('ok') // active 때 만든 코드
    await asRows(A, `select public.fn_request_dissolution() as id`)
    expect(await status(ab)).toBe('dissolving')
    const C = await user()
    const before = await count()
    expect(await as(C, connect(cb))).toBe('OG001')
    expect(await count()).toBe(before)
    expect(await memberOf(C)).toBe(0)
    expect(await status(ab)).toBe('dissolving')
  })

  it('회귀: 혼자인 사람의 코드로 혼자인 사람이 연결 -> 성공(active)', async () => {
    const X = await user()
    const cx = code()
    expect(await as(X, invite(X, cx))).toBe('ok')
    const Y = await user()
    expect(await as(Y, connect(cx))).toBe('ok')
    const r = await one(`select status::text s, user_b_id from couples where invite_code=$1`, [cx])
    expect([r.s, r.user_b_id]).toEqual(['active', Y])
  })
})
