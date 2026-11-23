/**
 * @jest-environment node
 *
 * 76-m2 (R100-2) 시험: retention-policy 예약만 해제. 전체 마이그레이션을 PGlite 에 적용(원격 접속 0).
 */
import fs from 'fs'
import path from 'path'
import { closeAllServers, createMigratedDb, type PgClient } from '../../scripts/db/pgliteMigrations'

const FILE = path.join(__dirname, '../../supabase/migrations/20261115160000_m2_unschedule_retention.sql')
let db: PgClient

beforeAll(async () => {
  db = (await createMigratedDb()).db
}, 120000)
afterAll(async () => {
  await db.close()
  await closeAllServers()
})

describe('76-m2 retention-policy unschedule', () => {
  it('cron.job 에 retention-policy 가 없다', async () => {
    const r = await db.query<{ jobname: string }>(`select jobname from cron.job where jobname = 'retention-policy'`)
    expect(r.rows).toHaveLength(0)
  })

  it('014 의 다른 예약은 그대로다(87-m1 이 push-net-count 하나를 더한다)', async () => {
    const r = await db.query<{ jobname: string }>(`select jobname from cron.job order by jobname`)
    expect(r.rows.map((x) => x.jobname)).toEqual(['execute-dissolutions', 'expire-stories', 'push-net-count'])
  })

  it('apply_retention_policy 함수는 여전히 존재한다', async () => {
    const r = await db.query(`select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apply_retention_policy'`)
    expect(r.rows).toHaveLength(1)
  })

  it('새 파일의 실행 문장은 정확히 select cron.unschedule(...) 하나다', () => {
    const body = fs
      .readFileSync(FILE, 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    const stmts = body.split(';').map((s) => s.trim()).filter(Boolean)
    expect(stmts).toEqual(["select cron.unschedule('retention-policy')"])
  })
})
