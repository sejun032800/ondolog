/**
 * @jest-environment node
 *
 * 해제 배치 시험 (`71b-`, R54-2 · R55-1~5): supabase/migrations/ 001~030 을 파일에서 읽어 PGlite 에 적용하고
 * 실제로 SQL 을 실행해 결과를 본다. 원격 접속 0.
 * `71-` 하네스의 34단언을 옮긴 것: (a) 7 · (b) 3 · (c) 11 · (d) 13.
 * 배치 함수 · 마이그레이션 지시서는 이 틀(scripts/db/pgliteMigrations.ts)에 시험을 더한다.
 */
import fs from 'fs'
import path from 'path'
import { MIGRATIONS_DIR, createMigratedDb, listMigrationFiles, type PgClient } from '../../scripts/db/pgliteMigrations'

let db: PgClient
let n = 0

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const q = async (s: string, p?: unknown[]): Promise<Row[]> => (await db.query<Row>(s, p)).rows
const one = async (s: string, p?: unknown[]): Promise<Row> => (await q(s, p))[0]

async function user(consent: boolean): Promise<string> {
  n++
  const id = (await one(`insert into auth.users(email) values ($1) returning id`, [`u${n}@x.test`])).id as string
  await db.query(
    `insert into profiles(id,display_name,gender,birth_date,terms_agreed_at,privacy_agreed_at) values ($1,$2,'other','2000-01-01',now(),now())`,
    [id, 'u' + n],
  )
  if (consent) {
    await db.query(
      `update profiles set biometric_consent_at=now()-interval '30 days', reference_photo_path='ref/'||id::text||'.jpg' where id=$1`,
      [id],
    )
  } else {
    await db.query(`update profiles set reference_photo_path='ref/'||id::text||'.jpg' where id=$1`, [id])
  }
  return id
}

async function couple(a: string, b: string): Promise<string> {
  n++
  return (
    await one(
      `insert into couples(user_a_id,user_b_id,invite_code,status) values ($1,$2,$3,'active') returning id`,
      [a, b, 'CODE' + String(n).padStart(4, '0')],
    )
  ).id as string
}

async function seed(cid: string, uid: string): Promise<void> {
  await db.query(`insert into data_entries(couple_id,author_id,entry_type,text_content) values ($1,$2,'memo','m')`, [cid, uid])
  await db.query(`insert into messages(couple_id,sender_id,body) values ($1,$2,'hi')`, [cid, uid])
  await db.query(`insert into stories(couple_id,author_id,media_path,expires_at) values ($1,$2,'s/x',now()+interval '1 day')`, [cid, uid])
  await db.query(
    `insert into stat_snapshots(couple_id,user_id,period_type,period_start,period_end,pus,emp,att,def,tac,rea,ovr,engine_version) values ($1,$2,'weekly','2026-10-01','2026-10-07',1,1,1,1,1,1,1,'t')`,
    [cid, uid],
  )
}

const cnt = async (cid: string, uid: string): Promise<string> => {
  const r = await one(
    `select (select count(*) from data_entries where couple_id=$1 and author_id=$2)::int e,(select count(*) from messages where couple_id=$1 and sender_id=$2)::int m,(select count(*) from stories where couple_id=$1 and author_id=$2)::int s,(select count(*) from stat_snapshots where couple_id=$1 and user_id=$2)::int t`,
    [cid, uid],
  )
  return [r.e, r.m, r.s, r.t].join(',')
}

async function dis(cid: string, init: string, hoursAgoPurge = 1, reason = 'unlink'): Promise<string> {
  return (
    await one(
      `insert into couple_dissolutions(couple_id,initiated_by,reason,requested_at,purge_scheduled_at) values ($1,$2,$3,now()-interval '8 days',now()-($4||' hours')::interval) returning id`,
      [cid, init, reason, String(hoursAgoPurge)],
    )
  ).id as string
}

beforeAll(async () => {
  const m = await createMigratedDb()
  db = m.db
  // 저장소 마이그레이션이 전부 적용됐는지(번호 순서 그대로, 030 포함)
  expect(m.applied).toEqual(listMigrationFiles())
  expect(m.applied[m.applied.length - 1]).toMatch(/^030_/)
}, 120000)

afterAll(async () => {
  await db?.close()
})

// ---- (a) 생체 동의 없는 개시자 (7)
describe('(a) no-consent initiator', () => {
  const r: Row = {}
  beforeAll(async () => {
    const A = await user(false)
    const B = await user(true)
    const c = await couple(A, B)
    await seed(c, A)
    await seed(c, B)
    const d = await dis(c, A)
    r.err = null
    try {
      await db.query(`select public.execute_dissolution($1)`, [d])
    } catch (e) {
      r.err = (e as Error).message
    }
    r.cntA = await cnt(c, A)
    r.cntB = await cnt(c, B)
    r.cs = await one(`select status, dissolved_at is not null da from couples where id=$1`, [c])
    r.ex = (await one(`select executed_at is not null x from couple_dissolutions where id=$1`, [d])).x
    r.pa = await one(`select biometric_consent_revoked_at r, reference_photo_path ph from profiles where id=$1`, [A])
    r.pb = await one(`select biometric_consent_revoked_at r, reference_photo_path ph from profiles where id=$1`, [B])
  })
  it('execute succeeds', () => expect(r.err).toBeNull())
  it('initiator derived rows deleted (0,0,0,0)', () => expect(r.cntA).toBe('0,0,0,0'))
  it('partner rows kept (1,1,1,1)', () => expect(r.cntB).toBe('1,1,1,1'))
  it('couple status dissolved', () => {
    expect(r.cs.status).toBe('dissolved')
    expect(r.cs.da).toBe(true)
  })
  it('executed_at filled', () => expect(r.ex).toBe(true))
  it('revoked_at null, reference_photo_path null', () => {
    expect(r.pa.r).toBeNull()
    expect(r.pa.ph).toBeNull()
  })
  it('partner profile untouched', () => {
    expect(r.pb.r).toBeNull()
    expect(r.pb.ph).not.toBeNull()
  })
})

// ---- (b) 생체 동의 있는 개시자 (3)
describe('(b) consenting initiator', () => {
  const r: Row = {}
  beforeAll(async () => {
    const A = await user(true)
    const B = await user(false)
    const c = await couple(A, B)
    await seed(c, A)
    const d = await dis(c, A)
    await db.query(`select public.execute_dissolution($1)`, [d])
    r.p = await one(`select biometric_consent_revoked_at r, reference_photo_path ph from profiles where id=$1`, [A])

    const A2 = await user(true)
    const B2 = await user(false)
    const c2 = await couple(A2, B2)
    await db.query(`update profiles set biometric_consent_revoked_at = now()-interval '3 days' where id=$1`, [A2])
    r.before = (await one(`select biometric_consent_revoked_at r from profiles where id=$1`, [A2])).r
    const d2 = await dis(c2, A2)
    await db.query(`select public.execute_dissolution($1)`, [d2])
    r.after = (await one(`select biometric_consent_revoked_at r from profiles where id=$1`, [A2])).r
  })
  it('revoked_at filled', () => expect(r.p.r).not.toBeNull())
  it('reference_photo_path null', () => expect(r.p.ph).toBeNull())
  it('earlier revoked_at preserved (coalesce)', () => {
    expect(typeof r.before).toBe('string')
    expect(new Date(r.after).getTime()).toBe(new Date(r.before).getTime())
  })
})

// ---- (c) 대상 두 건 중 한 건 실패 -> 나머지 실행 + ops_alerts (11)
// cron 스텁에 기록된 'execute-dissolutions' 의 명령 문자열을 그대로 실행한다.
describe('(c) one of two targets fails, cron command run verbatim', () => {
  const r: Row = {}
  beforeAll(async () => {
    await db.query(`delete from ops_alerts`)
    const A1 = await user(false)
    const B1 = await user(false)
    const c1 = await couple(A1, B1)
    await seed(c1, A1)
    await seed(c1, B1)
    const A2 = await user(false)
    const B2 = await user(false)
    const c2 = await couple(A2, B2)
    await seed(c2, A2)
    await seed(c2, B2)
    const dBad = await dis(c1, A1, 5)
    const dGood = await dis(c2, A2, 2) // 실패할 건이 먼저 처리된다
    // 시험 안에서만 만든 실패 장치: DETAIL 에 가짜 행 값을 담는다
    await db.query(
      `create function pg_temp_fail() returns trigger language plpgsql as $$ begin raise exception 'test-only failure' using errcode='23514', constraint='test_only_boom', detail='Failing row contains (SECRET-ROW-VALUE)'; end $$;`,
    )
    await db.query(
      `create trigger tg_test_only_fail before update on couples for each row when (old.id = '${c1}') execute function pg_temp_fail()`,
    )
    const cmd = (await one(`select command from cron.job where jobname='execute-dissolutions'`)).command as string
    r.cmdFromStub = cmd
    r.err = null
    try {
      await db.exec(cmd)
    } catch (e) {
      r.err = (e as Error).message
    }
    r.good = (await one(`select executed_at is not null x from couple_dissolutions where id=$1`, [dGood])).x
    r.bad = (await one(`select executed_at is not null x from couple_dissolutions where id=$1`, [dBad])).x
    r.goodCnt = await cnt(c2, A2)
    r.goodStatus = (await one(`select status from couples where id=$1`, [c2])).status
    r.badCnt = await cnt(c1, A1)
    r.alerts = await q(`select kind, couple_id, detail, resolved_at from ops_alerts`)
    r.c1 = c1
    r.dBad = dBad
    await db.exec(cmd)
    r.alertsAfterRerun = (await one(`select count(*)::int c from ops_alerts`)).c
    await db.exec(`drop trigger tg_test_only_fail on couples`)
    await db.exec(cmd)
    r.badAfterFix = (await one(`select executed_at is not null x from couple_dissolutions where id=$1`, [dBad])).x
    r.chkErr = null
    try {
      await db.query(`update profiles set biometric_consent_revoked_at=now() where id=$1`, [A1])
    } catch (e) {
      r.chkErr = (e as Error).message
    }
  })
  it('cron stub holds the command and it does not raise', () => {
    expect(r.cmdFromStub).toContain('run_due_dissolutions')
    expect(r.err).toBeNull()
  })
  it('other target executed (rows deleted, dissolved)', () => {
    expect(r.good).toBe(true)
    expect(r.goodCnt).toBe('0,0,0,0')
    expect(r.goodStatus).toBe('dissolved')
  })
  it('failing target: executed_at empty, its deletes rolled back (1,1,1,1)', () => {
    expect(r.bad).toBe(false)
    expect(r.badCnt).toBe('1,1,1,1')
  })
  it('exactly one ops_alerts row', () => expect(r.alerts).toHaveLength(1))
  it('kind dissolution_failed, couple_id set, unresolved', () => {
    const a = r.alerts[0]
    expect(a.kind).toBe('dissolution_failed')
    expect(a.couple_id).toBe(r.c1)
    expect(a.resolved_at).toBeNull()
  })
  it('detail: dissolution_id, sqlstate 23514, constraint', () => {
    const d = r.alerts[0].detail
    expect(d.dissolution_id).toBe(r.dBad)
    expect(d.sqlstate).toBe('23514')
    expect(d.constraint).toBe('test_only_boom')
  })
  it('detail has no row values / DETAIL text', () => {
    const s = JSON.stringify(r.alerts[0].detail)
    expect(s).not.toContain('SECRET')
    expect(s).not.toContain('Failing row')
  })
  it('detail keys limited to 4', () => {
    expect(Object.keys(r.alerts[0].detail).sort().join()).toBe('constraint,dissolution_id,message,sqlstate')
  })
  it('rerun: still-failing target adds one more row, executed one not re-run', () => expect(r.alertsAfterRerun).toBe(2))
  it('after cause removed, next run executes it', () => expect(r.badAfterFix).toBe(true))
  it('chk_biometric_revoke_order still enforced (original failure reproducible)', () => {
    expect(r.chkErr).not.toBeNull()
    expect(r.chkErr).toContain('chk_biometric_revoke_order')
  })
})

// ---- (d) 기존 단언 회귀 (13)
describe('(d) regression', () => {
  const r: Row = {}
  const FUNCS: Array<[string, string]> = [
    ['execute_dissolution', 'uuid'],
    ['run_due_dissolutions', ''],
    ['expire_stories', ''],
    ['apply_retention_policy', ''],
  ]
  beforeAll(async () => {
    const A = await user(false)
    const B = await user(false)
    const c = await couple(A, B)
    await db.query(`update profiles set deleted_at=now()-interval '9 days', purge_scheduled_at=now()-interval '2 days' where id=$1`, [B])
    await dis(c, A, 1, 'withdrawal')
    await db.exec(`select public.run_due_dissolutions()`)
    r.bothGone = (await one(`select count(*)::int c from couples where id=$1`, [c])).c

    const A3 = await user(false)
    const B3 = await user(false)
    const c3 = await couple(A3, B3)
    const dFuture = (
      await one(
        `insert into couple_dissolutions(couple_id,initiated_by,reason,purge_scheduled_at) values ($1,$2,'unlink',now()+interval '3 days') returning id`,
        [c3, A3],
      )
    ).id as string
    await db.exec(`select public.run_due_dissolutions()`)
    r.futureUntouched =
      (await one(`select executed_at is null x from couple_dissolutions where id=$1`, [dFuture])).x &&
      (await one(`select status from couples where id=$1`, [c3])).status === 'active'
    await db.query(`delete from couple_dissolutions where id=$1`, [dFuture])
    const dC = await dis(c3, A3, 1)
    await db.query(`update couple_dissolutions set cancelled_at=now() where id=$1`, [dC])
    await db.exec(`select public.run_due_dissolutions()`)
    r.cancelledUntouched = (await one(`select executed_at is null x from couple_dissolutions where id=$1`, [dC])).x

    r.priv = {}
    for (const [fn, args] of FUNCS) {
      const roles = await one(
        `select bool_or(has_function_privilege(r,'public.${fn}(${args})','execute')) any from unnest(array['anon','authenticated','service_role']) r`,
      )
      const pub = await one(`select has_function_privilege('public','public.${fn}(${args})','execute') p`)
      r.priv[fn] = { roles: roles.any, pub: pub.p }
    }
    r.f = await one(`select prosecdef, proconfig from pg_proc where oid='public.execute_dissolution(uuid)'::regprocedure`)
    r.w = await one(`select prosecdef, proconfig from pg_proc where oid='public.run_due_dissolutions()'::regprocedure`)
    await db.query(`insert into ops_alerts(kind) values ('couple_membership'),('usage_over')`)
    r.bogusErr = null
    try {
      await db.query(`insert into ops_alerts(kind) values ('bogus')`)
    } catch (e) {
      r.bogusErr = (e as Error).message
    }
    r.rls = (await one(`select relrowsecurity r from pg_class where oid='public.ops_alerts'::regclass`)).r
    r.policies = (await one(`select count(*)::int p from pg_policies where tablename='ops_alerts'`)).p
    r.jobs = await q(`select jobname, schedule from cron.job where jobname='execute-dissolutions'`)
  })
  it('both-gone: couple deleted (withdrawal reason)', () => expect(r.bothGone).toBe(0))
  it('not-yet-due untouched', () => expect(r.futureUntouched).toBe(true))
  it('cancelled untouched', () => expect(r.cancelledUntouched).toBe(true))
  for (const [fn] of FUNCS) {
    it(`${fn} not executable by anon/authenticated/service_role/public`, () => {
      expect(r.priv[fn].roles).toBe(false)
      expect(r.priv[fn].pub).toBe(false)
    })
  }
  it('execute_dissolution definer + search_path=public', () => {
    expect(r.f.prosecdef).toBe(true)
    expect(r.f.proconfig.join()).toBe('search_path=public')
  })
  it('run_due_dissolutions definer + search_path=public', () => {
    expect(r.w.prosecdef).toBe(true)
    expect(r.w.proconfig.join()).toBe('search_path=public')
  })
  it('ops_alerts old kinds accepted, bogus rejected', () => expect(r.bogusErr).not.toBeNull())
  it('ops_alerts RLS on, 0 policies', () => {
    expect(r.rls).toBe(true)
    expect(r.policies).toBe(0)
  })
  it('one execute-dissolutions job, schedule 0 5 * * *', () => {
    expect(r.jobs).toHaveLength(1)
    expect(r.jobs[0].schedule).toBe('0 5 * * *')
  })
  // 71- 에서 옮긴 마지막 단언: 013 과 030 의 execute_dissolution 본문이 철회 시각 한 줄만 다르다. (파일 본문을 줄 단위로 비교 - 보고에 표시)
  it('execute_dissolution body differs only by that one line (1 old + 1 new, same length)', () => {
    const s13 = fs.readFileSync(path.join(MIGRATIONS_DIR, '013_batch_functions.sql'), 'utf8')
    const s30 = fs.readFileSync(path.join(MIGRATIONS_DIR, '030_dissolution_batch_fix.sql'), 'utf8')
    const body = (s: string, fn: string): string[] => {
      const i = s.indexOf('create or replace function public.' + fn)
      const j = s.indexOf('$$;', s.indexOf('as $$', i))
      return s.slice(i, j).split('\n').map((x) => x.trimEnd())
    }
    const b13 = body(s13, 'execute_dissolution')
    const b30 = body(s30, 'execute_dissolution')
    const diff = b30.filter((l) => !b13.includes(l)).concat(b13.filter((l) => !b30.includes(l)))
    expect(diff).toHaveLength(2)
    expect(b13.length).toBe(b30.length)
  })
})
