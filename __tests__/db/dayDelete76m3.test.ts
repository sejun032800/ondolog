/**
 * @jest-environment node
 *
 * 76-m3 (R101-4 · R98-8) 시험: 하루 지우기. supabase/migrations/ 전체를 PGlite 에 적용(원격 접속 0).
 * 요청 사용자는 request.jwt.claim.sub 설정값으로 흉내 낸다(스텁 auth.uid() 와 같은 경로).
 * 확인: 내 것만 지움 · 상대 것 남음 · 내 것만 있던 날 -> 그날 0 · 옛 장소 규칙 · 중간 실패 0건 · 남의 커플 · 해제 완료 거부 ·
 *       발행된 호 그대로 · 새 장소 작성자 = 넣은 사람(앱 값 무시) · 넣기 정책 본인만.
 */
import fs from 'fs'
import path from 'path'
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

const FILE = path.join(__dirname, '../../supabase/migrations/20261116120000_m3_day_delete.sql')

let db: PgClient
let n = 0

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const all = async (s: string, p?: unknown[]): Promise<Row[]> => (await db.query<Row>(s, p)).rows

async function user(): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`u${n}@x.test`])).id as string
  await db.query(
    `insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`,
    [id, 'u' + n],
  )
  return id
}

const code = (): string => 'D' + String(++n).padStart(7, '0')
async function couple(a: string, b: string, status = 'active'): Promise<string> {
  return (await one(`insert into couples(user_a_id,user_b_id,invite_code,status) values ($1,$2,$3,$4::couple_status) returning id`, [a, b, code(), status])).id as string
}

/** 사용자 uid 로 한 문장(오류면 SQLSTATE, 하위 트랜잭션만 되돌림). */
async function asTry(uid: string | null, stmt: string): Promise<string> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return (await one(`select public.t_try($1) as r`, [stmt])).r as string
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
async function asOne(uid: string, sql: string, p?: unknown[]): Promise<Row> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  try {
    return await one(sql, p)
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
const deleteDay = (uid: string, dateId: string) => asOne(uid, `select public.fn_delete_my_day($1) as r`, [dateId]).then((x) => x.r as Row)

let day = 0
async function date(coupleId: string): Promise<{ id: string; on: string }> {
  day++
  const on = `2026-10-${String(day).padStart(2, '0')}`
  const id = (await one(`insert into dates(couple_id,date_on,source,user_confirmed) values ($1,$2,'manual',true) returning id`, [coupleId, on])).id as string
  return { id, on }
}
/** 장소 - 사용자로 넣는다(트리거가 작성자를 채움). uid null 이면 76-m3 이전의 옛 장소(작성자 없음). */
async function stop(coupleId: string, dateId: string, seq: number, uid: string | null): Promise<string> {
  const sql = `insert into date_stops(date_id,couple_id,seq,arrived_at,place_name) values ('${dateId}','${coupleId}',${seq},now(),'p${seq}') returning id`
  if (uid) return (await asOne(uid, sql)).id as string
  return (await one(sql)).id as string
}
async function photo(coupleId: string, dateId: string, author: string, at = '2026-10-01T03:00:00Z'): Promise<string> {
  return (await one(
    `insert into data_entries(couple_id,author_id,date_id,entry_type,storage_path,captured_at) values ($1,$2,$3,'photo','x/' || gen_random_uuid(),$4) returning id`,
    [coupleId, author, dateId, at],
  )).id as string
}
async function memo(coupleId: string, dateId: string, author: string): Promise<string> {
  return (await one(`insert into data_entries(couple_id,author_id,date_id,entry_type,text_content) values ($1,$2,$3,'memo','m') returning id`, [coupleId, author, dateId])).id as string
}
const liveEntries = (dateId: string) => all(`select author_id from data_entries where date_id=$1 and deleted_at is null order by author_id`, [dateId])
const stopsOf = (dateId: string) => all(`select id, author_id from date_stops where date_id=$1 order by seq`, [dateId])
const dateRow = (dateId: string) => one(`select deleted_at, photo_count, has_user_note from dates where id=$1`, [dateId])

let A: string, B: string, C: string, D: string, AB: string, CD: string

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
  await db.exec(`
    create or replace function public.t_try(stmt text) returns text language plpgsql as $$
    begin execute stmt; return 'ok'; exception when others then return sqlstate; end $$;`)
  A = await user()
  B = await user()
  C = await user()
  D = await user()
  AB = await couple(A, B)
  CD = await couple(C, D)
}, 120000)

afterAll(async () => {
  await db?.close()
  await closeAllServers()
})

describe('작성자 칸 - 서버가 넣는다', () => {
  it('새 장소의 작성자 = 넣은 사람, 앱이 보낸 값은 버린다', async () => {
    const d = await date(AB)
    const id = (await asOne(A, `insert into date_stops(date_id,couple_id,seq,arrived_at,author_id) values ('${d.id}','${AB}',0,now(),'${B}') returning id`)).id
    expect((await one(`select author_id from date_stops where id=$1`, [id])).author_id).toBe(A)
  })

  it('작성자는 고칠 수 없다(다른 칸은 고쳐진다)', async () => {
    const d = await date(AB)
    const id = await stop(AB, d.id, 0, A)
    await asOne(B, `update date_stops set author_id='${B}', place_name='새 이름' where id='${id}' returning id`)
    expect(await one(`select author_id, place_name from date_stops where id=$1`, [id])).toEqual({ author_id: A, place_name: '새 이름' })
  })

  it('기존 행(옛 장소)은 비어 있다 - 작성자 없이 들어간 행은 null', async () => {
    const d = await date(AB)
    const id = await stop(AB, d.id, 0, null)
    expect((await one(`select author_id from date_stops where id=$1`, [id])).author_id).toBeNull()
  })

  it('넣기 정책: 본인만(authenticated 역할에서 RLS 를 거친다) · 남의 커플에는 못 넣는다', async () => {
    const d = await date(AB)
    const ins = (cid: string) => `insert into date_stops(date_id,couple_id,seq,arrived_at) values ('${d.id}','${cid}',${++n % 30000},now())`
    await db.query(`set role authenticated`)
    try {
      expect(await asTry(A, ins(AB))).toBe('ok')
      expect(await asTry(C, ins(AB))).toBe('42501')
      expect(await asTry(null, ins(AB))).toBe('42501')
    } finally {
      await db.query(`reset role`)
    }
    const pol = await all(`select policyname, cmd from pg_policies where schemaname='public' and tablename='date_stops' order by policyname`)
    expect(pol).toEqual([
      { policyname: 'date_stops_delete', cmd: 'DELETE' },
      { policyname: 'date_stops_insert', cmd: 'INSERT' },
      { policyname: 'date_stops_select', cmd: 'SELECT' },
      { policyname: 'date_stops_update', cmd: 'UPDATE' },
    ])
  })
})

describe('fn_delete_my_day', () => {
  it('내 것만 지운다 · 상대 것은 남는다 · 카드는 남은 것으로', async () => {
    const d = await date(AB)
    const myStop = await stop(AB, d.id, 0, A)
    const partnerStop = await stop(AB, d.id, 1, B)
    await photo(AB, d.id, A)
    await memo(AB, d.id, A)
    await photo(AB, d.id, B)
    await memo(AB, d.id, B)
    const r = await deleteDay(A, d.id)
    expect(r).toEqual({ entries: 2, stops: 1, old_stops: 0, day_removed: false })
    expect((await liveEntries(d.id)).map((e) => e.author_id)).toEqual([B, B])
    expect((await stopsOf(d.id)).map((s) => s.id)).toEqual([partnerStop])
    expect((await stopsOf(d.id)).some((s) => s.id === myStop)).toBe(false)
    expect(await dateRow(d.id)).toEqual({ deleted_at: null, photo_count: 1, has_user_note: true })
  })

  it('내 것만 있던 날 -> 그날 0(장소 0 · 항목 0 · 날짜 소프트 삭제)', async () => {
    const d = await date(AB)
    await stop(AB, d.id, 0, A)
    await photo(AB, d.id, A)
    await memo(AB, d.id, A)
    const r = await deleteDay(A, d.id)
    expect(r).toEqual({ entries: 2, stops: 1, old_stops: 0, day_removed: true })
    expect(await liveEntries(d.id)).toEqual([])
    expect(await stopsOf(d.id)).toEqual([])
    expect((await dateRow(d.id)).deleted_at).not.toBeNull()
  })

  it('옛 장소: 그날 남은 것이 있으면 남긴다', async () => {
    const d = await date(AB)
    const old = await stop(AB, d.id, 0, null)
    await photo(AB, d.id, A)
    await memo(AB, d.id, B)
    const r = await deleteDay(A, d.id)
    expect(r).toMatchObject({ entries: 1, old_stops: 0, day_removed: false })
    expect((await stopsOf(d.id)).map((s) => s.id)).toEqual([old])
  })

  it('옛 장소: 상대의 장소만 남아도 남긴다', async () => {
    const d = await date(AB)
    const old = await stop(AB, d.id, 0, null)
    const theirs = await stop(AB, d.id, 1, B)
    await photo(AB, d.id, A)
    await deleteDay(A, d.id)
    expect((await stopsOf(d.id)).map((s) => s.id)).toEqual([old, theirs])
  })

  it('옛 장소: 그날 남은 것이 없으면 지운다', async () => {
    const d = await date(AB)
    await stop(AB, d.id, 0, null)
    await photo(AB, d.id, A)
    const r = await deleteDay(A, d.id)
    expect(r).toEqual({ entries: 1, stops: 0, old_stops: 1, day_removed: true })
    expect(await stopsOf(d.id)).toEqual([])
  })

  it('중간 실패 -> 0건(항목 · 장소 · 날짜 모두 그대로)', async () => {
    const d = await date(AB)
    await stop(AB, d.id, 0, A)
    await photo(AB, d.id, A)
    await memo(AB, d.id, A)
    // 장소를 지우는 순간(항목 소프트 삭제 뒤) 실패하게 만든다.
    await db.exec(`
      create function public.t_fail() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger t_fail before delete on public.date_stops for each row execute function public.t_fail();`)
    try {
      expect(await asTry(A, `select public.fn_delete_my_day('${d.id}')`)).toBe('P0001')
    } finally {
      await db.exec(`drop trigger t_fail on public.date_stops; drop function public.t_fail();`)
    }
    expect((await liveEntries(d.id)).length).toBe(2)
    expect((await stopsOf(d.id)).length).toBe(1)
    expect((await dateRow(d.id)).deleted_at).toBeNull()
  })

  it('남의 커플 · 해제 완료 커플 · 비로그인 · 없는 날짜는 거부한다', async () => {
    const d = await date(AB)
    await photo(AB, d.id, A)
    expect(await asTry(C, `select public.fn_delete_my_day('${d.id}')`)).toBe('42501')
    expect(await asTry(null, `select public.fn_delete_my_day('${d.id}')`)).toBe('28000')
    expect(await asTry(A, `select public.fn_delete_my_day(gen_random_uuid())`)).toBe('P0002')
    expect((await liveEntries(d.id)).length).toBe(1)

    const E = await user()
    const F = await user()
    const EF = await couple(E, F, 'dissolved')
    const gone = await date(EF)
    await photo(EF, gone.id, E)
    expect(await asTry(E, `select public.fn_delete_my_day('${gone.id}')`)).toBe('42501')
    expect((await liveEntries(gone.id)).length).toBe(1)
  })

  it('해제 유예 중(dissolving)에는 지울 수 있다', async () => {
    const G = await user()
    const H = await user()
    const GH = await couple(G, H, 'dissolving')
    const d = await date(GH)
    await photo(GH, d.id, G)
    expect((await deleteDay(G, d.id)).day_removed).toBe(true)
  })

  it('이미 지운 날은 아무것도 바꾸지 않는다(멱등)', async () => {
    const d = await date(AB)
    await photo(AB, d.id, A)
    await deleteDay(A, d.id)
    const before = (await dateRow(d.id)).deleted_at
    expect(await deleteDay(A, d.id)).toEqual({ entries: 0, stops: 0, old_stops: 0, day_removed: true })
    expect((await dateRow(d.id)).deleted_at).toEqual(before)
  })

  it('발행된 호는 그대로다', async () => {
    const d = await date(CD)
    await photo(CD, d.id, C)
    await one(
      `insert into issues(couple_id,issue_type,issue_number,period_start,period_end) values ($1,(enum_range(null::issue_type))[1],1,'2026-10-01','2026-10-31') returning id`,
      [CD],
    )
    const snap = async () => all(`select * from issues where couple_id=$1`, [CD])
    const before = await snap()
    await deleteDay(C, d.id)
    expect(await snap()).toEqual(before)
  })

  it('권한: authenticated 만 실행', async () => {
    const r = await one(`select has_function_privilege('anon','public.fn_delete_my_day(uuid)','execute') as anon,
                               has_function_privilege('authenticated','public.fn_delete_my_day(uuid)','execute') as auth`)
    expect(r).toEqual({ anon: false, auth: true })
  })
})

describe('파일 위생', () => {
  const body = fs.readFileSync(FILE, 'utf8')
  it('demo_responses 문장 0 · 배치 함수 호출 0 · issues 를 쓰지 않는다', () => {
    const code = body.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n')
    expect(code).not.toMatch(/demo_responses/i)
    expect(code).not.toMatch(/execute_dissolution|apply_retention_policy|expire_stories/i)
    expect(code).not.toMatch(/(insert into|update|delete from)\s+public\.issues/i)
  })
})
