/**
 * 시험 계정 즉시 초기화 (74-0, PM 지시서 §0, R75-3) - 개발 프로젝트에서 카카오 계정 이메일 1명과 그 사용자의 데이터를 지운다 (Deno 전용).
 * 사람이 PC에서 실행한다. 앱(`app/` `src/`)과 `web/`에서는 부르지 않는다.
 *
 * ── 마이그레이션(로컬 파일, supabase/migrations)에서 읽은 지움 지도 ───────────────────────────────────────────
 * auth.users 삭제 시 함께 지워진다(cascade):
 *   profiles(003 id -> auth.users) -> personality_assessments · personality_profiles (user_id -> profiles)
 * auth.users 삭제를 **막는다**(먼저 지워야 한다):
 *   couples.user_a_id · user_b_id -> profiles 는 ON DELETE RESTRICT, start_date_set_by · start_date_confirmed_by 와
 *   couple_dissolutions.initiated_by 는 기본(NO ACTION), data_entries.author_id · messages.sender_id · stories.author_id 는 RESTRICT.
 *   -> 사용자 커플 행을 **먼저** 지워야 사용자를 지울 수 있다. 커플 행을 지우면 아래가 cascade 로 따라 지워진다.
 * couples 삭제 시 함께 지워진다(cascade):
 *   couple_dissolutions · subscriptions · dates -> date_stops · data_entries · messages · stories · daily_temperature ·
 *   stat_snapshots · match_reports · dna_scores · issues -> corners(couple_id 로도 cascade) · ops_alerts
 * 남는 것(FK 없음 / set null): corner_batches(사용자·커플과 무관, 지우지 않음) · demo_responses(금지, 건드리지 않음)
 *   · love_type_labels · app_config(공용 표). corners.batch_id 는 set null 이라 영향 없음.
 * Storage(행을 지워도 파일은 남는다) - 경로 규칙 015 · 019:
 *   entries · messages · stories · magazine · magazine-print : `{couple_id}/...`
 *   avatars : `{user_id}/reference`(개인) · `{couple_id}/reference`(커플)
 *
 * 지우는 순서(--apply): 1) Storage 파일(커플 접두 6개 버킷 + avatars 사용자 접두) -> 2) 사용자 커플 행(cascade 로 하위 표) -> 3) 인증 사용자(profiles 등 cascade).
 *   Storage 를 먼저 지우는 이유: 도중에 멈춰도 다시 돌릴 수 있게 행(찾을 근거)을 마지막까지 남긴다.
 *
 * 거부(아무것도 지우지 않고 이유 한 줄): 개발 프로젝트가 아님 · 이메일에 걸리는 사용자 0명 / 2명 이상 ·
 *   커플로 연결된 계정(user_b_id 가 채워진 커플 행이 하나라도 있음 - 상태 active · dissolving · dissolved 모두. 앱 coupleApi 는 status 'active' 를 connected 로 보지만,
 *   해제된 커플도 상대방 데이터가 같은 행 아래에 있어 지우면 상대 것까지 지워지므로 더 넓게 거부한다. user_b 없는 pending 초대 행은 연결이 아님) ·
 *   발행된 호가 있는 계정(그 사용자 커플의 issues 에 published_at 이 있음).
 *
 * 서비스 키: 기존 운영 스크립트와 같다 - 환경변수 ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY 만(`supabaseOps.connectOps`).
 *   개발 프로젝트 판별: 접속 URL 의 ref 를 supabase/.temp/linked-project.json 의 name(ondolog) · ref 와 대조(`opsGuards.assertDevelopmentProject`).
 * 출력: "표 이름: 행 수" · "Storage: 파일 수" · 거부 이유뿐. 이메일 · id · 키 · 주소 · ref 는 쓰지 않는다.
 * 금지: demo_responses 읽기/쓰기 · execute_dissolution · apply_retention_policy · run_due_dissolutions 호출 · 마이그레이션 · db push.
 *
 * 사용 (저장소 루트에서; 미리 보기가 기본, 실제로 지우려면 --apply):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json \
 *     scripts/ops/resetTestAccount.ts <이메일> [--apply]
 */
import { OpsStopError, redactSecrets } from './opsGuards.ts'

/** 커플 id 로 찾는 표 - couples 삭제 시 cascade 로 지워지는 것들(위 지도). */
export const COUPLE_CASCADE_TABLES = [
  'couple_dissolutions',
  'subscriptions',
  'dates',
  'date_stops',
  'data_entries',
  'messages',
  'stories',
  'daily_temperature',
  'stat_snapshots',
  'match_reports',
  'dna_scores',
  'issues',
  'corners',
  'ops_alerts',
] as const

/** 사용자 id 로 찾는 표 - profiles 를 거쳐 auth.users 삭제 시 cascade. [표, 칸] */
export const USER_CASCADE_TABLES = [
  ['profiles', 'id'],
  ['personality_assessments', 'user_id'],
  ['personality_profiles', 'user_id'],
] as const

/** 커플 접두(`{couple_id}/...`)로 파일이 있는 버킷. */
export const COUPLE_BUCKETS = ['entries', 'messages', 'stories', 'magazine', 'magazine-print', 'avatars'] as const
/** 사용자 접두(`{user_id}/...`)로 파일이 있는 버킷. */
export const USER_BUCKETS = ['avatars'] as const

export interface CoupleLite {
  readonly id: string
  readonly user_b_id: string | null
}

/** 접속 부분 - 실제는 service_role 클라이언트, 시험은 가짜. */
export interface ResetPort {
  /** 이메일(대소문자 무시)에 걸리는 인증 사용자 id 들. */
  findUserIds(email: string): Promise<readonly string[]>
  /** 이 사용자가 user_a 또는 user_b 인 모든 커플 행(상태 무관). */
  listCouples(userId: string): Promise<readonly CoupleLite[]>
  /** 이 커플들의 issues 중 published_at 이 있는 호가 있는가. */
  hasPublishedIssue(coupleIds: readonly string[]): Promise<boolean>
  count(table: string, column: string, ids: readonly string[]): Promise<number>
  countFiles(bucket: string, prefix: string): Promise<number>
  removeFiles(bucket: string, prefix: string): Promise<number>
  deleteRows(table: string, column: string, ids: readonly string[]): Promise<void>
  deleteUser(userId: string): Promise<void>
}

export interface ResetArgs {
  readonly email: string
  readonly apply: boolean
}

/** 실행 인자 -> 이메일 · 적용 여부. 모양이 틀리면 던진다(메시지에 인자 값을 넣지 않는다). */
export function parseResetArgs(argv: readonly string[]): ResetArgs {
  let apply = false
  const rest: string[] = []
  for (const a of argv) {
    if (a === '--apply') apply = true
    else if (a.startsWith('--')) throw new OpsStopError('알 수 없는 인수가 있다')
    else rest.push(a)
  }
  if (rest.length !== 1 || !rest[0].includes('@')) throw new OpsStopError('인수는 카카오 계정 이메일 하나(와 선택 --apply)여야 한다')
  return { email: rest[0].trim(), apply }
}

export type ResetOutcome = { readonly kind: 'refused' | 'previewed' | 'applied'; readonly lines: readonly string[] }

const refuse = (reason: string): ResetOutcome => ({ kind: 'refused', lines: [`거부: ${reason}`] })

/** 순수 흐름 - 접속은 port 로만. 판정 -> 집계 -> (apply 일 때만) 정한 순서로 삭제. */
export async function runReset(connect: () => Promise<ResetPort>, args: ResetArgs): Promise<ResetOutcome> {
  let port: ResetPort
  try {
    port = await connect()
  } catch (error) {
    if (error instanceof OpsStopError) return refuse('개발 프로젝트가 아니거나 확인할 수 없다')
    throw error
  }

  const users = await port.findUserIds(args.email)
  if (users.length === 0) return refuse('그 이메일의 사용자가 없다')
  if (users.length >= 2) return refuse('그 이메일에 걸리는 사용자가 2명 이상이다')
  const userId = users[0]

  const couples = await port.listCouples(userId)
  if (couples.some((c) => c.user_b_id !== null)) return refuse('커플로 연결된 계정이다')
  const coupleIds = couples.map((c) => c.id)
  if (coupleIds.length > 0 && (await port.hasPublishedIssue(coupleIds))) return refuse('발행된 호가 있는 계정이다')

  const rows: [string, number][] = [['couples', coupleIds.length]]
  for (const table of COUPLE_CASCADE_TABLES) {
    rows.push([table, coupleIds.length === 0 ? 0 : await port.count(table, 'couple_id', coupleIds)])
  }
  for (const [table, column] of USER_CASCADE_TABLES) rows.push([table, await port.count(table, column, [userId])])

  let files = 0
  for (const bucket of COUPLE_BUCKETS) for (const id of coupleIds) files += await port.countFiles(bucket, id)
  for (const bucket of USER_BUCKETS) files += await port.countFiles(bucket, userId)

  const lines = [args.apply ? '실행: 지운 수' : '미리 보기(지우지 않음): 지울 수']
  for (const [table, n] of rows) lines.push(`${table}: ${n}`)
  lines.push('auth 사용자: 1')
  lines.push(`Storage: ${files}`)
  if (!args.apply) {
    lines.push('실제로 지우려면 --apply')
    return { kind: 'previewed', lines }
  }

  // 1) Storage -> 2) 커플 행(하위 cascade) -> 3) 인증 사용자(profiles 등 cascade)
  for (const bucket of COUPLE_BUCKETS) for (const id of coupleIds) await port.removeFiles(bucket, id)
  for (const bucket of USER_BUCKETS) await port.removeFiles(bucket, userId)
  if (coupleIds.length > 0) await port.deleteRows('couples', 'id', coupleIds)
  await port.deleteUser(userId)
  lines.push('완료')
  return { kind: 'applied', lines }
}

// ── 실제 접속 (service_role) ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Db = any
const CHUNK = 100

function must(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what} 실패`)
}

export function makePort(client: Db): ResetPort {
  /** prefix 아래 모든 파일 경로(폴더는 id 가 null 이라 들어가 본다). */
  async function walk(bucket: string, prefix: string): Promise<string[]> {
    const out: string[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset })
      must('storage 목록 조회', error)
      const items: { name: string; id: string | null }[] = data ?? []
      for (const item of items) {
        const path = `${prefix}/${item.name}`
        if (item.id === null) out.push(...(await walk(bucket, path)))
        else out.push(path)
      }
      if (items.length < 1000) break
    }
    return out
  }

  return {
    async findUserIds(email) {
      const want = email.toLowerCase()
      const ids: string[] = []
      for (let page = 1; ; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
        must('사용자 조회', error)
        const users: { id: string; email?: string | null }[] = data?.users ?? []
        for (const u of users) if ((u.email ?? '').toLowerCase() === want) ids.push(u.id)
        if (users.length < 1000) break
      }
      return ids
    },
    async listCouples(userId) {
      const { data, error } = await client.from('couples').select('id, user_b_id').or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      must('couples 조회', error)
      return data ?? []
    },
    async hasPublishedIssue(coupleIds) {
      const { count, error } = await client
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .in('couple_id', [...coupleIds])
        .not('published_at', 'is', null)
      must('issues 조회', error)
      return (count ?? 0) > 0
    },
    async count(table, column, ids) {
      const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).in(column, [...ids])
      must(`${table} 집계`, error)
      return count ?? 0
    },
    async countFiles(bucket, prefix) {
      return (await walk(bucket, prefix)).length
    },
    async removeFiles(bucket, prefix) {
      const paths = await walk(bucket, prefix)
      for (let i = 0; i < paths.length; i += CHUNK) {
        const { error } = await client.storage.from(bucket).remove(paths.slice(i, i + CHUNK))
        must('storage 삭제', error)
      }
      return paths.length
    },
    async deleteRows(table, column, ids) {
      const { error } = await client.from(table).delete().in(column, [...ids])
      must(`${table} 삭제`, error)
    },
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId)
      must('인증 사용자 삭제', error)
    },
  }
}

if (import.meta.main) {
  // 접속 도구는 실제 실행 때만 불러온다(시험은 npm 패키지 없이 돈다).
  const { connectOps } = await import('./supabaseOps.ts')
  let secrets: readonly string[] = []
  const out = (line: string) => console.log(redactSecrets(line, secrets))
  try {
    const args = parseResetArgs(Deno.args)
    const outcome = await runReset(async () => {
      const conn = await connectOps()
      secrets = conn.secrets
      return makePort(conn.client)
    }, args)
    for (const line of outcome.lines) out(line)
    if (outcome.kind === 'refused') Deno.exit(1)
  } catch (error) {
    // 오류 문구에는 인자·id 가 들어가지 않는다(위 코드). 출력 직전 방어선도 한 번 더 통과한다.
    out(`중단: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    Deno.exit(1)
  }
}
