/**
 * @jest-environment node
 *
 * 76-h (R106-2) 시험: 떠난 사람이 남긴 장소. supabase/migrations/ 전체를 PGlite 에 적용(원격 0).
 * purgeWithdrawn 의 실제 포트가 보내는 질의를 SQL 로 그대로 흉내 낸다(작성자 = 그 사람인 date_stops 삭제 -> 남은 것 0인 dates 삭제 -> 인증 사용자).
 * 확인: 떠난 사람 장소만 · 남은 사람 장소 · 사진 · 메모 0건 영향 · 작성자 빈 장소 0건 · 빈 날만 정리 · 계정 삭제가 장소 때문에 막히지 않음 ·
 *       해제: 요청자 장소만 · 해제 실행 전 0건.
 */
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
let n = 0
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const ids = async (s: string, p?: unknown[]): Promise<string[]> => (await db.query<Row>(s, p)).rows.map((r) => r.id as string)

async function user(): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`h${n}@x.test`])).id as string
  await db.query(`insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`, [id, 'h' + n])
  return id
}
async function couple(a: string, b: string, status: string): Promise<string> {
  return (await one(`insert into couples(user_a_id,user_b_id,invite_code,status) values ($1,$2,$3,$4::couple_status) returning id`, [a, b, 'H' + String(++n).padStart(7, '0'), status])).id as string
}
async function date(c: string): Promise<string> {
  return (await one(`insert into dates(couple_id,date_on) values ($1, date '2026-09-01' + $2::int) returning id`, [c, ++n])).id as string
}
async function stop(c: string, d: string, who: string | null): Promise<string> {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [who ?? ''])
  try {
    return (await one(`insert into date_stops(date_id,couple_id,seq,arrived_at) values ($1,$2,$3,now()) returning id`, [d, c, ++n % 30000])).id as string
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub','',false)`)
  }
}
async function photo(c: string, d: string, who: string): Promise<void> {
  await db.query(`insert into data_entries(couple_id,author_id,date_id,entry_type,storage_path) values ($1,$2,$3,'photo',$4)`, [c, who, d, `${c}/${++n}.jpg`])
}

/** 실제 포트와 같은 질의: 장소 날짜 -> 장소 삭제 -> 남은 것 0인 날 삭제. */
async function removePlaces(author: string, coupleIds: string[], alsoEntries = false): Promise<{ stops: number; emptied: string[] }> {
  const touched = (await db.query<Row>(`select date_id from date_stops where author_id = $1 and couple_id = any($2::uuid[])`, [author, coupleIds])).rows.map((r) => r.date_id as string)
  if (alsoEntries) touched.push(...(await db.query<Row>(`select date_id from data_entries where author_id = $1 and couple_id = any($2::uuid[]) and date_id is not null`, [author, coupleIds])).rows.map((r) => r.date_id as string))
  const stops = (await db.query<Row>(`delete from date_stops where author_id = $1 and couple_id = any($2::uuid[]) returning id`, [author, coupleIds])).rows.length
  if (alsoEntries) await db.query(`delete from data_entries where author_id = $1`, [author])
  const emptied = await ids(
    `select d.id from dates d where d.id = any($1::uuid[])
       and not exists (select 1 from date_stops s where s.date_id = d.id and s.author_id is distinct from $2)
       and not exists (select 1 from data_entries e where e.date_id = d.id and e.deleted_at is null and e.author_id <> $2)`,
    [[...new Set(touched)], author],
  )
  if (emptied.length > 0) await db.query(`delete from dates where id = any($1::uuid[])`, [emptied])
  return { stops, emptied }
}

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
}, 120000)
afterAll(async () => {
  await db?.close()
  await closeAllServers()
})

describe('① 탈퇴 - 상대가 남은 커플', () => {
  it('떠난 사람 장소만 · 남은 사람 장소 · 사진 그대로 · 옛 장소 0건 · 빈 날만 정리 · 그 뒤 계정 삭제가 막히지 않음', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B, 'dissolved')
    const onlyA = await date(C)
    const shared = await date(C)
    const old = await date(C)
    await stop(C, onlyA, A)
    await photo(C, onlyA, A)
    await stop(C, shared, A)
    const bStop = await stop(C, shared, B)
    await photo(C, shared, B)
    await stop(C, old, A)
    const oldStop = await stop(C, old, null)

    const r = await removePlaces(A, [C], true)
    expect(r.stops).toBe(3)
    expect(r.emptied).toEqual([onlyA])
    expect(await ids(`select id from date_stops where couple_id = $1 order by id`, [C])).toEqual([bStop, oldStop].sort())
    expect(await ids(`select id from dates where couple_id = $1 order by id`, [C])).toEqual([shared, old].sort())
    expect(Number((await one(`select count(*)::int c from data_entries where author_id = $1`, [B])).c)).toBe(1)

    await db.query(`delete from auth.users where id = $1`, [A])
    expect(Number((await one(`select count(*)::int c from profiles where id = $1`, [A])).c)).toBe(0)
    expect((await one(`select author_id from date_stops where id = $1`, [bStop])).author_id).toBe(B)
  })

  it('R108-2: 그날을 가리키는 소프트 삭제된 사진 · 메모가 있어도 빈 날 삭제가 외래 키에 막히지 않는다', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B, 'dissolved')
    const d = await date(C)
    const aStop = await stop(C, d, A)
    // 남은 사람(B)이 그날(그 장소) 남겼다가 지운(소프트 삭제) 사진 · 메모 - 빈 날 판정에서는 "남은 것"이 아니다
    const hidden = await ids(
      `insert into data_entries(couple_id,author_id,date_id,date_stop_id,entry_type,storage_path,text_content,deleted_at)
       values ($1,$2,$3,$5,'photo',$4,null,now()), ($1,$2,$3,$5,'memo',null,'m',now()) returning id`,
      [C, B, d, `${C}/${++n}.jpg`, aStop],
    )
    const r = await removePlaces(A, [C])
    expect(r.emptied).toEqual([d])
    expect(await ids(`select id from dates where id = $1`, [d])).toEqual([])
    // 숨겨진 행은 날짜만 비워진 채 남는다(행 · 작성자 그대로)
    const left = (await db.query<Row>(`select id, date_id, date_stop_id, deleted_at is not null as gone from data_entries where id = any($1::uuid[]) order by id`, [hidden])).rows
    expect(left.map((x) => x.id)).toEqual([...hidden].sort())
    expect(left.every((x) => x.date_id === null && x.date_stop_id === null && x.gone === true)).toBe(true)
  })

  it('다시 돌려도 같은 결과(멱등)', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B, 'dissolved')
    const d = await date(C)
    await stop(C, d, A)
    await removePlaces(A, [C])
    expect(await removePlaces(A, [C])).toEqual({ stops: 0, emptied: [] })
  })
})

describe('② 해제 - 해제된 커플 정리', () => {
  it('요청자 장소만 지우고 요청받은 사람 장소는 남김', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B, 'dissolved')
    const d = await date(C)
    await stop(C, d, A)
    const bStop = await stop(C, d, B)
    await db.query(
      `insert into couple_dissolutions(couple_id,initiated_by,reason,requested_at,purge_scheduled_at,executed_at) values ($1,$2,(enum_range(null::dissolution_reason))[1],now()-interval '8 days',now()-interval '1 day',now())`,
      [C, A],
    )
    const targets = (await db.query<Row>(
      `select x.couple_id, x.initiated_by from couple_dissolutions x join couples c on c.id = x.couple_id
        where x.executed_at is not null and x.cancelled_at is null and x.initiated_by is not null and c.status = 'dissolved'`,
    )).rows.filter((r) => r.couple_id === C)
    expect(targets).toEqual([{ couple_id: C, initiated_by: A }])
    await removePlaces(A, [C])
    expect(await ids(`select id from date_stops where couple_id = $1`, [C])).toEqual([bStop])
    expect(await ids(`select id from dates where couple_id = $1`, [C])).toEqual([d])
  })

  it('해제 실행 전(유예 중) 커플은 대상에 들지 않는다', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B, 'dissolving')
    await db.query(
      `insert into couple_dissolutions(couple_id,initiated_by,reason,requested_at,purge_scheduled_at) values ($1,$2,(enum_range(null::dissolution_reason))[1],now(),now()+interval '7 days')`,
      [C, A],
    )
    const targets = (await db.query<Row>(
      `select x.couple_id from couple_dissolutions x join couples c on c.id = x.couple_id
        where x.executed_at is not null and x.cancelled_at is null and x.initiated_by is not null and c.status = 'dissolved' and x.couple_id = $1`,
      [C],
    )).rows
    expect(targets).toEqual([])
  })
})
