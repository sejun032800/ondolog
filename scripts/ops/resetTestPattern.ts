/**
 * 91-b 범위 밖 시험 계정 지우기 - 패턴 모드 · 네 겹 잠금 (ROADMAP r154 R154-7, Deno 전용). 사람이 PC에서 실행한다. 앱 · web은 부르지 않는다.
 *
 * 대상: 이메일이 `test-<영숫자 · - · _ · .>@example.com`(대소문자 무시)이고, `--created-before`(KST 그날 0시)보다 **앞에** 만든 인증 사용자.
 *   시드(`test-m2b-*`)도 모양이 맞으므로 대상이다 - 미리 보기에 따로 건수를 보인다(C3 뒤라 0이어야 한다).
 *
 * 네 겹 잠금:
 *   1. 이메일 모양 - `PATTERN_EMAIL`(이 파일). 카카오 계정은 example.com 일 수 없다.
 *   2. 개발 프로젝트 - 허용 목록 파일의 `project=` 잠금(`resetAllowlist.makeProjectGate`). **접속 전**. 이메일 줄은 쓰지 않는다.
 *   3. 만든 날짜 상한 - `--created-before YYYY-MM-DD` 필수(없거나 모양이 틀리면 접속 전 거부).
 *   4. 미리 보기 기본 · 전체 거부 - `--apply`가 없으면 읽기만. apply는 `--expect-users N`(미리 보기에서 본 대상 수)이 다시 센 수와 같아야 한다.
 *
 * 전체 거부(미리 보기 · apply 둘 다, 아무것도 지우지 않고 한 줄):
 *   - 대상 사용자가 든 커플(상태 무관 - pending 초대 포함)에 대상이 아닌 사용자가 있다.
 *   - 사용자를 가리키는 칸이 대상과 대상 아닌 쪽을 엮는다: 대상이 지우지 않는 커플의 행에 작성자 · 정한 사람으로 들어 있거나,
 *     지울 커플의 행에 대상이 아닌 사람이 작성자로 들어 있다(cascade가 그 사람 것까지 지우게 된다). 칸 목록은 `USER_LINK_COLUMNS`(마이그레이션 005 · 006 · 007 · 008 · m3 · g1 · m1).
 *
 * 지우는 일(새 삭제 로직 0 - `resetTestAccount`와 같은 port · 같은 순서):
 *   커플 단위: Storage(커플 접두 6버킷) -> 호(issues) -> 커플 행(cascade) / 그다음 사용자 단위: avatars 사용자 접두 -> 인증 사용자(profiles 등 cascade).
 *   중간에 끊겨도 같은 명령을 다시 치면 남은 것만 지운다(지운 커플은 목록에서 빠진다). `--expect-users`는 남은 수로 다시 넣는다.
 * 지우지 않는 것: 사용자에 묶이지 않은 커플(두 칸 모두 비었거나 없는 사람을 가리킴 - g1 set null 뒤 남은 것). 건수만 보인다(PM 결정).
 * 출력: 종류별 건수뿐. id · 이메일 · ref · 별명 0. 거부 문구에도 값 0.
 * 금지: execute_dissolution · apply_retention_policy · run_due_dissolutions 호출 0 · demo_responses · push_daily · app_error_daily 읽기 · 쓰기 0.
 *
 * 사용(저장소 루트, PowerShell - HANDOFF "91-b 실행"):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME \
 *     --allow-net=$h --allow-read=supabase/.temp/linked-project.json,$al \
 *     scripts/ops/resetTestPattern.ts --created-before 2026-11-25 [--expect-users N --apply]
 */
import { OpsStopError, redactSecrets } from './opsGuards.ts'
import { makeProjectGate } from './resetAllowlist.ts'
import {
  COUPLE_BUCKETS,
  COUPLE_CASCADE_TABLES,
  envOrUndefined,
  failureLines,
  makePort,
  readAllowlistText,
  USER_BUCKETS,
  USER_CASCADE_TABLES,
  type CoupleLite,
  type ResetPort,
} from './resetTestAccount.ts'

/** 겹 1: 대상 이메일 모양(정확히 · 대소문자 무시). */
export const PATTERN_EMAIL = /^test-[a-z0-9._-]+@example\.com$/i
/** 시드 계정(모양은 맞음 - 따로 센다). */
export const SEED_EMAIL = /^test-m2b-/i

/**
 * 사용자를 가리키는 칸 [표, 사용자 칸, 커플 칸] - 엮임 검사용. 커플 행 자신은 커플 칸이 `id`.
 * (members user_a_id · user_b_id 는 커플 구성 검사가 따로 본다.)
 */
export const USER_LINK_COLUMNS = [
  ['couples', 'start_date_set_by', 'id'],
  ['couples', 'start_date_confirmed_by', 'id'],
  ['couples', 'nickname_changed_by', 'id'],
  ['couple_dissolutions', 'initiated_by', 'couple_id'],
  ['data_entries', 'author_id', 'couple_id'],
  ['messages', 'sender_id', 'couple_id'],
  ['stories', 'author_id', 'couple_id'],
  ['date_stops', 'author_id', 'couple_id'],
  ['stat_snapshots', 'user_id', 'couple_id'],
] as const

export interface AuthUserLite {
  readonly id: string
  readonly email: string | null
  readonly created_at: string | null
}

/** 패턴 모드가 더 쓰는 읽기(쓰기는 `ResetPort` 그대로). */
export interface PatternPort extends ResetPort {
  /** 모든 인증 사용자(id · 이메일 · 만든 시각). */
  listAuthUsers(): Promise<readonly AuthUserLite[]>
  /** 모든 커플 행(id · 두 칸). 사용자에 묶이지 않은 커플 수를 세는 데만 쓴다. */
  listAllCouples(): Promise<readonly CoupleLite[]>
  /**
   * 엮임 수. `inUsersOutCouples`: 사용자 칸이 userIds 안인데 커플 칸이 coupleIds 밖인 행 수.
   * `inCouplesOutUsers`: 커플 칸이 coupleIds 안인데 사용자 칸이 비지 않았고 userIds 밖인 행 수.
   */
  countLinks(table: string, userColumn: string, coupleColumn: string, userIds: readonly string[], coupleIds: readonly string[], direction: 'inUsersOutCouples' | 'inCouplesOutUsers'): Promise<number>
}

export interface PatternArgs {
  /** KST 그날 0시(UTC 밀리초). 이 시각 **앞에** 만든 계정만 대상. */
  readonly createdBeforeMs: number
  readonly apply: boolean
  readonly expectUsers: number | null
}

/** 겹 3 · 4 인자. 모양이 틀리면 던진다(메시지에 인자 값 0). */
export function parsePatternArgs(argv: readonly string[]): PatternArgs {
  let createdBefore: string | null = null
  let expect: string | null = null
  let apply = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') apply = true
    else if (a === '--created-before') createdBefore = argv[++i] ?? ''
    else if (a === '--expect-users') expect = argv[++i] ?? ''
    else throw new OpsStopError('알 수 없는 인수가 있다')
  }
  if (createdBefore === null) throw new OpsStopError('--created-before YYYY-MM-DD 가 필요하다')
  const createdBeforeMs = kstMidnightMs(createdBefore)
  if (createdBeforeMs === null) throw new OpsStopError('--created-before 모양이 틀렸다(YYYY-MM-DD)')
  let expectUsers: number | null = null
  if (expect !== null) {
    if (!/^\d{1,6}$/.test(expect)) throw new OpsStopError('--expect-users 모양이 틀렸다(0 이상의 정수)')
    expectUsers = Number(expect)
  }
  if (apply && expectUsers === null) throw new OpsStopError('--apply 에는 미리 보기에서 본 대상 수 --expect-users N 이 필요하다')
  return { createdBeforeMs, apply, expectUsers }
}

/** `YYYY-MM-DD` -> 그날 KST 0시의 UTC 밀리초. 없는 날짜면 null. */
export function kstMidnightMs(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = Date.UTC(y, mo - 1, d)
  const back = new Date(utc)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null
  return utc - 9 * 60 * 60 * 1000
}

/** 겹 1 + 3: 대상인가. 만든 시각을 모르면 대상이 아니다. */
export function isPatternTarget(u: AuthUserLite, createdBeforeMs: number): boolean {
  if (!u.email || !PATTERN_EMAIL.test(u.email.trim())) return false
  const t = u.created_at === null ? Number.NaN : Date.parse(u.created_at)
  return Number.isFinite(t) && t < createdBeforeMs
}

export type PatternOutcome = { readonly kind: 'refused' | 'previewed' | 'applied'; readonly lines: readonly string[] }
const refuse = (reason: string): PatternOutcome => ({ kind: 'refused', lines: [`거부: ${reason}`] })

const members = (c: CoupleLite) => [c.user_a_id, c.user_b_id].filter((m): m is string => m !== null)

/** 순수 흐름 - 접속은 port 로만. 문(접속 전) -> 대상 -> 전체 거부 판정 -> 집계 -> (apply) 커플 단위 -> 사용자 단위. */
export async function runPatternReset(connect: () => Promise<PatternPort>, args: PatternArgs, gate: () => string | null): Promise<PatternOutcome> {
  const blocked = gate()
  if (blocked !== null) return refuse(blocked)
  let port: PatternPort
  try {
    port = await connect()
  } catch (error) {
    if (error instanceof OpsStopError) return refuse('개발 프로젝트가 아니거나 확인할 수 없다')
    throw error
  }

  const all = await port.listAuthUsers()
  const targets = all.filter((u) => isPatternTarget(u, args.createdBeforeMs))
  const targetIds = targets.map((u) => u.id)
  const targetSet = new Set(targetIds)
  const outsidersBefore = all.length - targets.length
  const seeds = targets.filter((u) => SEED_EMAIL.test(u.email ?? '')).length

  // 대상 사용자가 든 커플(상태 무관). 대상이 아닌 사람이 하나라도 들어 있으면 전체 거부.
  const byId = new Map<string, CoupleLite>()
  for (const id of targetIds) for (const c of await port.listCouples(id)) byId.set(c.id, c)
  const couples = [...byId.values()]
  if (couples.some((c) => members(c).some((m) => !targetSet.has(m)))) return refuse('시험 계정이 대상 밖 사용자와 같은 커플에 있다')
  const coupleIds = couples.map((c) => c.id)

  // 사용자 칸 엮임 - 두 방향 모두 0이어야 한다.
  if (targetIds.length > 0) {
    for (const [table, userCol, coupleCol] of USER_LINK_COLUMNS) {
      const out = await port.countLinks(table, userCol, coupleCol, targetIds, coupleIds, 'inUsersOutCouples')
      const inn = coupleIds.length === 0 ? 0 : await port.countLinks(table, userCol, coupleCol, targetIds, coupleIds, 'inCouplesOutUsers')
      if (out > 0 || inn > 0) return refuse('시험 계정의 행이 대상 밖 사용자 · 커플과 엮여 있다')
    }
  }

  // 사용자에 묶이지 않은 커플(지우지 않음 - 건수만).
  const allIds = new Set(all.map((u) => u.id))
  const orphanCouples = (await port.listAllCouples()).filter((c) => !members(c).some((m) => allIds.has(m))).length

  if (args.expectUsers !== null && args.expectUsers !== targets.length) return refuse('대상 사용자 수가 --expect-users 와 다르다(미리 보기를 다시 보세요)')

  const rows: [string, number][] = [['couples', coupleIds.length]]
  for (const table of COUPLE_CASCADE_TABLES) rows.push([table, coupleIds.length === 0 ? 0 : await port.count(table, 'couple_id', coupleIds)])
  for (const [table, column] of USER_CASCADE_TABLES) rows.push([table, targetIds.length === 0 ? 0 : await port.count(table, column, targetIds)])
  const storage: [string, number][] = []
  for (const bucket of COUPLE_BUCKETS) {
    let n = 0
    for (const id of coupleIds) n += await port.countFiles(bucket, id)
    if (bucket === 'avatars') for (const id of targetIds) n += await port.countFiles(bucket, id)
    storage.push([bucket, n])
  }
  const files = storage.reduce((s, [, n]) => s + n, 0)
  const loneUsers = targetIds.filter((id) => !couples.some((c) => members(c).includes(id))).length

  const lines = [args.apply ? '실행(패턴 모드): 지운 수' : '미리 보기(패턴 모드, 지우지 않음): 지울 수']
  lines.push(`대상 사용자: ${targets.length}`)
  lines.push(`그중 시드(test-m2b): ${seeds}`)
  lines.push(`그중 커플 없는 사용자: ${loneUsers}`)
  lines.push(`대상 밖 사용자(남김): ${outsidersBefore}`)
  lines.push(`사용자에 묶이지 않은 커플(지우지 않음): ${orphanCouples}`)
  for (const [table, n] of rows) lines.push(`${table}: ${n}`)
  for (const [bucket, n] of storage) lines.push(`Storage ${bucket}: ${n}`)
  lines.push(`Storage 합계: ${files}`)
  if (!args.apply) {
    lines.push(`실제로 지우려면 --created-before (같은 날짜) --expect-users ${targets.length} --apply`)
    return { kind: 'previewed', lines }
  }

  // 커플 단위: Storage -> 호 -> 커플 행(cascade). 그다음 사용자 단위: avatars -> 인증 사용자.
  for (const id of coupleIds) {
    for (const bucket of COUPLE_BUCKETS) await port.removeFiles(bucket, id)
    await port.deleteRows('issues', 'couple_id', [id])
    await port.deleteRows('couples', 'id', [id])
  }
  for (const id of targetIds) {
    for (const bucket of USER_BUCKETS) await port.removeFiles(bucket, id)
    await port.deleteUser(id)
  }
  const after = await port.listAuthUsers()
  const outsidersAfter = after.filter((u) => !targetSet.has(u.id)).length
  lines.push(`대상 밖 사용자 실행 뒤: ${outsidersAfter}${outsidersAfter === outsidersBefore ? '' : ' (경고: 실행 전과 다르다 - 다른 곳에서 가입 · 삭제가 있었는지 보세요)'}`)
  lines.push(`남은 대상 사용자: ${after.filter((u) => targetSet.has(u.id)).length}`)
  lines.push('완료')
  return { kind: 'applied', lines }
}

// ── 실제 접속 (service_role) ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Db = any

function must(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what} 실패`)
}

export function makePatternPort(client: Db): PatternPort {
  const base = makePort(client)
  const list = (ids: readonly string[]) => `(${ids.join(',')})`
  return {
    ...base,
    async listAuthUsers() {
      const out: AuthUserLite[] = []
      for (let page = 1; ; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
        must('사용자 조회', error)
        const users: { id: string; email?: string | null; created_at?: string | null }[] = data?.users ?? []
        for (const u of users) out.push({ id: u.id, email: u.email ?? null, created_at: u.created_at ?? null })
        if (users.length < 1000) break
      }
      return out
    },
    async listAllCouples() {
      const out: CoupleLite[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('couples').select('id, user_a_id, user_b_id').order('id').range(from, from + 999)
        must('couples 조회', error)
        const rows: CoupleLite[] = data ?? []
        out.push(...rows)
        if (rows.length < 1000) break
      }
      return out
    },
    async countLinks(table, userColumn, coupleColumn, userIds, coupleIds, direction) {
      let q = client.from(table).select('*', { count: 'exact', head: true })
      if (direction === 'inUsersOutCouples') {
        q = q.in(userColumn, [...userIds])
        if (coupleIds.length > 0) q = q.not(coupleColumn, 'in', list(coupleIds))
      } else {
        q = q.in(coupleColumn, [...coupleIds]).not(userColumn, 'is', null).not(userColumn, 'in', list(userIds))
      }
      const { count, error } = await q
      must(`${table} 엮임 조회`, error)
      return count ?? 0
    },
  }
}

async function main(): Promise<void> {
  let secrets: readonly string[] = []
  const out = (line: string) => console.log(redactSecrets(line, secrets))
  try {
    let args: PatternArgs
    try {
      args = parsePatternArgs(Deno.args)
    } catch (error) {
      // 겹 3 · 4 인자 거부 - 접속 전. 문구에 인자 값 0.
      if (error instanceof OpsStopError) { out(`거부: ${error.message}`); Deno.exit(1) }
      throw error
    }
    const gate = makeProjectGate({ allowlistText: await readAllowlistText(), url: envOrUndefined('ONDOLOG_SUPABASE_URL') })
    const connect = async () => {
      const { connectOps } = await import('./supabaseOps.ts')
      const conn = await connectOps()
      secrets = conn.secrets
      return makePatternPort(conn.client)
    }
    const outcome = await runPatternReset(connect, args, gate)
    for (const line of outcome.lines) out(line)
    if (outcome.kind === 'refused') Deno.exit(1)
  } catch (error) {
    for (const line of failureLines(error, envOrUndefined('ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'))) out(line)
    Deno.exit(1)
  }
}

if (import.meta.main) void main()
