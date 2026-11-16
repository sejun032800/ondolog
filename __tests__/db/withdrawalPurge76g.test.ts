/**
 * @jest-environment node
 *
 * 76-g (R105-2 · R105-4) 시험: m1 사람 칸 비움 · m2 저장소 본인 파일 삭제 정책. supabase/migrations/ 전체를 PGlite 에 적용(원격 0).
 * 탈퇴 최종 삭제는 purgeWithdrawn 의 순서를 SQL 로 그대로 흉내 낸다: (저장소) -> 떠난 사람의 기록 행 -> 인증 사용자.
 */
import { closeAllServers, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
let n = 0
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const one = async (s: string, p?: unknown[]): Promise<Row> => (await db.query<Row>(s, p)).rows[0]
const cnt = async (s: string, p?: unknown[]): Promise<number> => Number((await one(`select count(*)::int as n from (${s}) x`, p)).n)

async function user(): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`u${n}@x.test`])).id as string
  await db.query(`insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`, [id, 'u' + n])
  await db.query(`insert into personality_assessments(user_id, seq, mbti) select $1, 1, 'ENFP' where exists (select 1 from information_schema.columns where table_name='personality_assessments' and column_name='mbti')`, [id]).catch(() => undefined)
  return id
}
const code = (): string => 'G' + String(++n).padStart(7, '0')

async function couple(a: string, b: string | null, status: string): Promise<string> {
  return (await one(
    `insert into couples(user_a_id,user_b_id,invite_code,status,relationship_start_date,start_date_set_by,start_date_confirmed_by) values ($1,$2,$3,$4::couple_status,'2026-01-01',$1,$2) returning id`,
    [a, b, code(), status],
  )).id as string
}
async function records(c: string, who: string): Promise<void> {
  const d = (await one(`insert into dates(couple_id,date_on) values ($1, (date '2026-10-01' + ($2::int)) ) on conflict (couple_id,date_on) do update set region = null returning id`, [c, n++ % 300])).id
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [who])
  await db.query(`insert into date_stops(date_id,couple_id,seq,arrived_at) values ($1,$2,$3,now())`, [d, c, n++ % 30000])
  await db.query(`select set_config('request.jwt.claim.sub','',false)`)
  await db.query(`insert into data_entries(couple_id,author_id,date_id,entry_type,storage_path) values ($1,$2,$3,'photo',$4)`, [c, who, d, `${c}/${who}-${n++}.jpg`])
  await db.query(`insert into messages(couple_id,sender_id,body) values ($1,$2,'hi')`, [c, who])
}
async function publishedIssue(c: string): Promise<void> {
  await db.query(`insert into issues(couple_id,issue_type,issue_number,period_start,period_end,published_at) values ($1,(enum_range(null::issue_type))[1],1,'2026-10-01','2026-10-31',now())`, [c])
}
async function withdrawn(id: string): Promise<void> {
  await db.query(`update profiles set deleted_at = now() - interval '8 days', purge_scheduled_at = now() - interval '1 day' where id = $1`, [id])
}
/** purgeWithdrawn 순서(저장소는 PGlite 밖) - 떠난 사람의 기록 행 -> 인증 사용자. */
async function purgeLeaver(id: string): Promise<void> {
  await db.query(`delete from data_entries where author_id = $1`, [id])
  await db.query(`delete from messages where sender_id = $1`, [id])
  await db.query(`delete from stories where author_id = $1`, [id])
  await db.query(`delete from auth.users where id = $1`, [id])
}
async function tryAs(uid: string | null, stmt: string): Promise<string> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return (await one(`select public.t_try($1) as r`, [stmt])).r as string
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  expect(m.applied).toEqual(listMigrationFiles())
  await db.exec(`
    create or replace function public.t_try(stmt text) returns text language plpgsql as $$
    declare k int; begin execute stmt; get diagnostics k = row_count; return 'ok:' || k; exception when others then return sqlstate; end $$;`)
  // PGlite 스텁의 storage 스키마에는 Supabase 기본 권한이 없다 - 정책(RLS)만 보도록 표 권한을 준다(시험 쪽에만).
  await db.exec(`grant usage on schema storage to authenticated; grant select, delete on storage.objects to authenticated;`)
}, 120000)
afterAll(async () => {
  await db?.close()
  await closeAllServers()
})

describe('m1 외래 키 표 그대로', () => {
  it('바꾼 다섯 칸은 null 허용 · set null', async () => {
    const r = await db.query<Row>(`
      select c.conrelid::regclass::text as t, a.attname as col, c.confdeltype as act, not a.attnotnull as nullable
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass order by 1, 2`)
    const map = Object.fromEntries(r.rows.map((x) => [`${x.t}.${x.col}`, `${x.act}${x.nullable ? '' : '!'}`]))
    // a=no action r=restrict c=cascade n=set null, ! = not null
    expect(map).toEqual({
      'couple_dissolutions.initiated_by': 'n',
      'couples.start_date_confirmed_by': 'n',
      'couples.start_date_set_by': 'n',
      'couples.user_a_id': 'n',
      'couples.user_b_id': 'n',
      'data_entries.author_id': 'r!',
      'date_stops.author_id': 'n',
      'messages.sender_id': 'r!',
      'personality_assessments.user_id': 'c!',
      'personality_profiles.user_id': 'c!',
      'stat_snapshots.user_id': 'c!',
      'stories.author_id': 'r!',
    })
  })
})

describe('상대가 남은 탈퇴자 최종 삭제(P2)', () => {
  let A: string, B: string, C: string
  beforeAll(async () => {
    A = await user() // 떠나는 사람
    B = await user() // 남는 사람
    C = await couple(A, B, 'dissolved')
    await records(C, A)
    await records(C, B)
    await publishedIssue(C)
    await db.query(`insert into couple_dissolutions(couple_id,initiated_by,reason,requested_at,purge_scheduled_at,executed_at) values ($1,$2,(enum_range(null::dissolution_reason))[1],now() - interval '8 days',now() - interval '1 day', now())`, [C, A])
    await withdrawn(A)
  })

  it('기록 행을 남긴 채로는 계정 삭제가 막힌다(안전망 restrict)', async () => {
    expect(await tryAs(null, `delete from auth.users where id = '${A}'`)).toBe('23001') // restrict_violation
  })

  it('떠난 사람: 인증 · 프로필 · 성격 결과 0 · 기록 · 메시지 0 · 장소는 작성자만 비움', async () => {
    const stopsBefore = await cnt(`select 1 from date_stops where couple_id = $1`, [C])
    await purgeLeaver(A)
    expect(await cnt(`select 1 from auth.users where id = $1`, [A])).toBe(0)
    expect(await cnt(`select 1 from profiles where id = $1`, [A])).toBe(0)
    expect(await cnt(`select 1 from personality_assessments where user_id = $1`, [A])).toBe(0)
    expect(await cnt(`select 1 from personality_profiles where user_id = $1`, [A])).toBe(0)
    expect(await cnt(`select 1 from data_entries where author_id = $1`, [A])).toBe(0)
    expect(await cnt(`select 1 from messages where sender_id = $1`, [A])).toBe(0)
    expect(await cnt(`select 1 from date_stops where couple_id = $1`, [C])).toBe(stopsBefore)
    expect(await cnt(`select 1 from date_stops where couple_id = $1 and author_id is null`, [C])).toBe(1)
  })

  it('남은 사람: 커플 행(떠난 칸만 비움) · 발행된 호 · 자기 기록 · 장소 · 메시지 그대로', async () => {
    const c = await one(`select user_a_id, user_b_id, start_date_set_by, start_date_confirmed_by, status::text s from couples where id = $1`, [C])
    expect(c).toEqual({ user_a_id: null, user_b_id: B, start_date_set_by: null, start_date_confirmed_by: B, s: 'dissolved' })
    expect(await cnt(`select 1 from issues where couple_id = $1 and published_at is not null`, [C])).toBe(1)
    expect(await cnt(`select 1 from data_entries where author_id = $1`, [B])).toBe(1)
    expect(await cnt(`select 1 from messages where sender_id = $1`, [B])).toBe(1)
    expect(await cnt(`select 1 from date_stops where couple_id = $1 and author_id = $2`, [C, B])).toBe(1)
    expect(await cnt(`select 1 from profiles where id = $1`, [B])).toBe(1)
    expect((await one(`select initiated_by from couple_dissolutions where couple_id = $1`, [C])).initiated_by).toBeNull()
  })

  it('남은 사람 화면 상태 = 해제 완료: is_couple_member 거짓 · partner_id 없음', async () => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [B])
    try {
      expect((await one(`select public.is_couple_member($1) as m`, [C])).m).toBe(false)
    } finally {
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
    }
  })

  it('남은 사람이 나중에 떠나면(둘 다 떠남) 커플 · 호까지 지울 수 있다', async () => {
    await withdrawn(B)
    await db.query(`delete from couples where id = $1`, [C])
    await purgeLeaver(B)
    expect(await cnt(`select 1 from couples where id = $1`, [C])).toBe(0)
    expect(await cnt(`select 1 from issues where couple_id = $1`, [C])).toBe(0)
    expect(await cnt(`select 1 from profiles where id = $1`, [B])).toBe(0)
  })
})

describe('m1 검사 chk_start_date_owner', () => {
  it('연결 · 유예 중인 커플에는 그대로 걸리고, 해제 끝난 커플에서만 비어도 된다', async () => {
    const A = await user()
    const B = await user()
    const active = await couple(A, B, 'active')
    expect(await tryAs(null, `update couples set start_date_set_by = null where id = '${active}'`)).toBe('23514')
    const gone = await couple(await user(), await user(), 'dissolved')
    expect(await tryAs(null, `update couples set start_date_set_by = null where id = '${gone}'`)).toBe('ok:1')
  })
})

describe('두 사람 모두 떠난 경우 - 기존 순서 회귀 0', () => {
  it('커플 행 -> 두 인증 사용자 · 호 cascade', async () => {
    const A = await user()
    const B = await user()
    const C = await couple(A, B, 'dissolved')
    await records(C, A)
    await publishedIssue(C)
    await withdrawn(A)
    await withdrawn(B)
    await db.query(`delete from couples where id = $1`, [C])
    await db.query(`delete from auth.users where id in ($1, $2)`, [A, B])
    expect(await cnt(`select 1 from issues where couple_id = $1`, [C])).toBe(0)
    expect(await cnt(`select 1 from data_entries where couple_id = $1`, [C])).toBe(0)
    expect(await cnt(`select 1 from profiles where id in ($1,$2)`, [A, B])).toBe(0)
  })
})

describe('m2 저장소 본인 파일 삭제 정책(P1)', () => {
  let A: string, B: string, C: string
  beforeAll(async () => {
    A = await user()
    B = await user()
    C = await couple(A, B, 'active')
    for (const [bucket, owner, name] of [
      ['entries', A, `${C}/a1.jpg`], ['entries', B, `${C}/b1.jpg`], ['messages', A, `${C}/a2.jpg`],
      ['stories', A, `${C}/a3.jpg`], ['magazine', A, `${C}/cover.jpg`], ['avatars', A, `${A}/reference`],
    ]) await db.query(`insert into storage.objects(bucket_id,name,owner) values ($1,$2,$3)`, [bucket, name, owner])
  })
  const del = (bucket: string, name: string) => `delete from storage.objects where bucket_id = '${bucket}' and name = '${name}'`

  it('본인 파일은 지운다(entries · messages · stories) · 상대 파일 · 매거진 · avatars는 0건', async () => {
    await db.query(`set role authenticated`)
    try {
      expect(await tryAs(A, del('entries', `${C}/a1.jpg`))).toBe('ok:1')
      expect(await tryAs(A, del('messages', `${C}/a2.jpg`))).toBe('ok:1')
      expect(await tryAs(A, del('stories', `${C}/a3.jpg`))).toBe('ok:1')
      expect(await tryAs(A, del('entries', `${C}/b1.jpg`))).toBe('ok:0')
      expect(await tryAs(A, del('magazine', `${C}/cover.jpg`))).toBe('ok:0')
      expect(await tryAs(A, del('avatars', `${A}/reference`))).toBe('ok:0')
      expect(await tryAs(null, del('entries', `${C}/b1.jpg`))).toBe('ok:0')
    } finally {
      await db.query(`reset role`)
    }
    expect(await cnt(`select 1 from storage.objects where name = $1`, [`${C}/b1.jpg`])).toBe(1)
    expect(await cnt(`select 1 from storage.objects where bucket_id = 'magazine'`)).toBe(1)
  })

  it('정책은 delete 하나 · 대상 버킷 셋', async () => {
    const r = await one(`select cmd, qual from pg_policies where schemaname = 'storage' and policyname = 'storage_own_delete'`)
    expect(r.cmd).toBe('DELETE')
    expect(r.qual).toContain('entries')
    expect(r.qual).not.toContain('magazine')
  })
})
