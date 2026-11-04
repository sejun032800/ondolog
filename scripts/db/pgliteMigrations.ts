/**
 * 로컬 시험용: supabase/migrations/ 의 파일을 번호 순서대로 읽어 PGlite(메모리 Postgres)에 적용한다 (71b-, R54-2).
 *
 * - 마이그레이션 본문은 파일에서 읽는다. 시험 쪽에 SQL 복사본을 두지 않는다.
 * - PGlite 에 없는 것(Supabase 가 제공하는 역할 · auth / storage / cron 스키마 · pg_cron 확장)은 아래 STUB_SQL 로만 채운다.
 * - 원격 접속 0. 네트워크 · 키 불필요.
 * - 배치 함수 · 마이그레이션 시험은 이 헬퍼 위에 시험을 더한다(R54-2).
 * - PGlite 는 jest 안에서 불러오면 동적 import() 때문에 --experimental-vm-modules 가 필요하다(jest 설정 · 실행 옵션은 바꾸지 않는다).
 *   그래서 scripts/db/pgliteServer.mjs 를 자식 Node 프로세스로 띄우고 문장을 표준 입출력으로 보낸다. 시험 쪽 모양은 PGlite 와 같다
 *   (query -> {rows}, exec, close). 날짜 값은 JSON 을 거치므로 문자열(ISO)로 돌아온다.
 */
import fs from 'fs'
import path from 'path'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'

export const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'supabase', 'migrations')

/**
 * 스텁 (시험 쪽에만 있다):
 *  - 역할 anon / authenticated / service_role : Supabase 가 미리 만들어 두는 역할. grant · revoke · RLS 정책이 이름으로 참조한다.
 *  - schema auth + auth.users + auth.uid() / auth.role() : 외래키 · RLS 정책이 참조한다. uid 는 요청 설정값에서 읽는 Supabase 방식 그대로.
 *  - schema extensions : 확장 설치 위치로 마이그레이션이 이름을 부른다.
 *  - schema storage + buckets / objects / foldername() : Storage 정책 마이그레이션이 참조한다.
 *  - schema cron + cron.job + cron.schedule() : pg_cron 대용. **예약을 기록만 하고 실행하지 않는다.** 같은 jobname 이면 갱신(pg_cron 과 같음).
 *  - publication supabase_realtime : 마이그레이션이 테이블을 여기에 더한다.
 *  - 기본 권한 : Supabase 는 public 스키마의 새 개체에 세 역할 권한을 기본으로 준다(마이그레이션의 revoke 가 의미를 가지려면 필요).
 */
const STUB_SQL = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create schema storage;
create schema cron;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$
  insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning 1::bigint $$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

/** PGlite 에 pg_cron 확장이 없다. 그 확장을 만드는 문장 한 줄만 읽은 본문에서 뺀다(위 cron 스텁이 대신한다). 파일은 고치지 않는다. */
const PG_CRON_EXTENSION = /create extension if not exists pg_cron[^;]*;/gi

export function listMigrationFiles(dir: string = MIGRATIONS_DIR): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()
}

export interface PgClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  exec(sql: string): Promise<void>
  close(): Promise<void>
}

export interface MigratedDb {
  db: PgClient
  applied: string[]
}

interface Reply {
  id: number
  ok: boolean
  rows?: unknown[]
  error?: string
  ready?: boolean
}

// 자식 프로세스 정리 (R56-1): 띄운 서버를 전부 기록해 두고, 정상 종료(close) · 실패(createMigratedDb 의 catch) ·
// 시간 초과(시험의 afterAll 이 closeAllServers 호출) · 부모 종료(process 'exit') 어느 경로에서도 남지 않게 한다.
// 정상 종료는 stdin 을 닫아 서버가 스스로 끝내게 하되, GRACE_MS 안에 안 끝나면 강제로 끝낸다(Windows 도 child.kill() = 강제 종료).
const GRACE_MS = 5000
const READY_MS = 60000
const liveChildren = new Set<ChildProcessWithoutNullStreams>()
process.on('exit', () => {
  for (const c of liveChildren) c.kill()
})

/** 아직 살아 있는 PGlite 서버를 전부 끝낸다. 시험의 afterAll 에서 부른다(beforeAll 이 시간 초과여도 정리되도록). */
export async function closeAllServers(): Promise<void> {
  await Promise.all(
    [...liveChildren].map(
      (c) =>
        new Promise<void>((res) => {
          if (c.exitCode !== null || c.signalCode !== null) return res()
          c.once('exit', () => res())
          c.kill()
        }),
    ),
  )
}

function startServer(): Promise<PgClient> {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [path.join(__dirname, 'pgliteServer.mjs')], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    liveChildren.add(child)
    const readyTimer = setTimeout(() => {
      if (!ready) child.kill()
    }, READY_MS)
    const pending = new Map<number, { res: (r: Reply) => void }>()
    let seq = 0
    let buf = ''
    let stderr = ''
    let ready = false
    let exited = false
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.stdout.on('data', (d: Buffer) => {
      buf += d.toString()
      let k: number
      while ((k = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, k).trim()
        buf = buf.slice(k + 1)
        if (!line.startsWith('@@')) continue
        const r = JSON.parse(line.slice(2)) as Reply
        if (r.ready) {
          ready = true
          resolve(client)
        } else pending.get(r.id)?.res(r)
      }
    })
    child.on('exit', () => {
      exited = true
      clearTimeout(readyTimer)
      liveChildren.delete(child)
      if (!ready) reject(new Error('pglite server exited before ready: ' + stderr.slice(-2000)))
      for (const p of pending.values()) p.res({ id: -1, ok: false, error: 'pglite server exited: ' + stderr.slice(-500) })
    })
    const call = (op: 'exec' | 'query', sql: string, params?: unknown[]): Promise<Reply> =>
      new Promise((res) => {
        if (exited) return res({ id: -1, ok: false, error: 'pglite server exited' })
        const id = ++seq
        pending.set(id, { res })
        child.stdin.write(JSON.stringify({ id, op, sql, params }) + '\n')
      })
    const client: PgClient = {
      async query<T>(sql: string, params?: unknown[]) {
        const r = await call('query', sql, params)
        if (!r.ok) throw new Error(r.error)
        return { rows: (r.rows ?? []) as T[] }
      },
      async exec(sql: string) {
        const r = await call('exec', sql)
        if (!r.ok) throw new Error(r.error)
      },
      async close() {
        if (exited) return
        await new Promise<void>((res) => {
          const force = setTimeout(() => child.kill(), GRACE_MS)
          child.on('exit', () => {
            clearTimeout(force)
            res()
          })
          child.stdin.end()
        })
      },
    }
  })
}

/** 스텁 -> 마이그레이션 001.. 순서대로. upTo 가 있으면 그 번호(포함)까지만. */
export async function createMigratedDb(opts: { upTo?: number; dir?: string } = {}): Promise<MigratedDb> {
  const dir = opts.dir ?? MIGRATIONS_DIR
  const db = await startServer()
  try {
    await db.exec(STUB_SQL)
    const applied: string[] = []
    for (const f of listMigrationFiles(dir)) {
      if (opts.upTo !== undefined && parseInt(f, 10) > opts.upTo) break
      const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(PG_CRON_EXTENSION, '')
      try {
        await db.exec(sql)
      } catch (e) {
        throw new Error(`migration ${f} failed: ${(e as Error).message}`)
      }
      applied.push(f)
    }
    return { db, applied }
  } catch (e) {
    await db.close()
    throw e
  }
}
