/**
 * 76-f (c) 탈퇴 최종 삭제 (R104-3 · R104-4 · R104-5) - 탈퇴 유예가 끝난 사용자(`profiles.deleted_at` 있음 · `purge_scheduled_at <= now()`, 003 · 027)를 지운다
 * (Deno 전용, 사람 실행). 앱에서는 부르지 않는다. 매주 월요일 `sweepOrphanFiles`보다 **먼저** 미리 보기 -> 적용(HANDOFF "76-f 월요일 운영").
 *
 * 지우는 순서는 초기화 스크립트(`resetTestAccount.ts`)와 같다: 1) 저장소 파일 -> 2) 커플 행(cascade로 하위 표 · 호) -> 3) 인증 사용자(profiles 등 cascade).
 *   접속 부분(목록 · 파일 지우기 · 행 지우기 · 사용자 지우기)은 `resetTestAccount.makePort`를 그대로 쓴다(초기화 동작 변화 0, 그 파일은 고치지 않음).
 *
 * 상대(같은 커플 행의 다른 사람)가 **남아 있으면**(76-g, R105-2 ㄱ안 · 76-g-m1):
 *   - 그 커플 행 · 발행된 호 · 상대의 기록 · 파일은 남긴다(처리방침 "두 사람이 모두 떠났을 때만").
 *   - 떠난 사람의 기록 행(data_entries · messages · stories, 작성자 = 떠난 사람)과 그 파일을 지우고, 인증 사용자를 지운다
 *     -> 프로필 · 성격 결과 · 재검사(cascade)가 따라 지워지고, 커플 · 해제 행에서 떠난 사람을 가리키던 칸은 비워진다(m1 on delete set null).
 *   - 그 커플의 남은 파일(가리키는 살아 있는 행이 없는 파일, 24시간 지남 - 해제 실행(030)이 행만 지운 떠난 사람 파일)도 같은 차례에 지운다
 *     (저장소에 그 사람이 올린 파일이 남아 있으면 인증 사용자 삭제가 거부될 수 있어서).
 *   - **그 커플이 아직 해제 실행 전(status 'dissolved' 아님)이면 이번에는 기다린다**("해제 실행 대기"). 칸을 먼저 비우면 030이 "상대 없음 = 둘 다 떠남"으로 읽어
 *     남은 사람의 기록까지 지울 수 있다(030 본문은 고치지 않는다). 탈퇴 요청이 같은 7일 해제를 만들므로 보통 같은 날 풀린다.
 *   "남아 있음" = 상대 프로필이 있고, 탈퇴 요청이 없거나 그 유예가 아직 안 끝남(유예 중에는 탈퇴를 취소할 수 있으므로 함께 지우지 않는다).
 * 상대가 없거나(혼자 초대 행) 상대도 유예가 끝났으면: 그 커플들의 파일(커플 접두 6개 버킷 - 매거진 포함) + 사용자 avatars 접두 -> 커플 행 -> 인증 사용자.
 *
 * 한 사용자 처리 중 실패하면 그 사용자는 다음 실행 때 다시(파일 · 행 지우기가 멱등) · 다른 사용자는 계속 · 실패 수를 출력.
 * 기본은 미리 보기(대상 사용자 수 · 지울 행 수 · 파일 수). `--apply`일 때만 지운다.
 * 개발 프로젝트 가드: `sweepOrphanFiles.makeProjectGate`(허용 목록의 project= 줄)와 같다 - 맞지 않으면 접속 전에 끝낸다.
 * 출력: 숫자만. 경로 · id · 이메일 · 키 · 주소 · ref 0.
 * 금지: demo_responses · 서버 파괴 함수(R34-3: 해제 실행 · 보관 정책 · 예정 해제 일괄 실행) 호출 · 마이그레이션.
 *
 * 사용 (저장소 맨 위 폴더, 한 줄 - HANDOFF "76-f 월요일 운영"):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME
 *     --allow-net=$h --allow-read=supabase/.temp/linked-project.json,$al scripts/ops/purgeWithdrawn.ts [--apply]
 */
import { OpsStopError, redactSecrets } from './opsGuards.ts'
import {
  COUPLE_BUCKETS,
  COUPLE_CASCADE_TABLES,
  MAGAZINE_BUCKETS,
  USER_BUCKETS,
  USER_CASCADE_TABLES,
  makePort,
  type CoupleLite,
  type ResetPort,
} from './resetTestAccount.ts'
import {
  classifyFiles,
  makeProjectGate,
  makeSweepPort,
  parseSweepArgs,
  readAllowlistText,
  walkBucket,
  type OpsOutcome,
  type ProjectGate,
  type SweepArgs,
} from './sweepOrphanFiles.ts'

/** 이 스크립트가 쓰는 접속 부분 = 초기화 포트의 일부 + 대상 찾기 두 가지. */
export interface CoupleWithStatus extends CoupleLite {
  readonly status: string
}

export interface PurgePort extends Pick<ResetPort, 'count' | 'countFiles' | 'removeFiles' | 'deleteRows' | 'deleteUser'> {
  /** 이 사용자가 든 모든 커플 행과 상태. */
  listCouplesWithStatus(userId: string): Promise<readonly CoupleWithStatus[]>
  /** 떠난 사람의 기록 행이 가리키는 파일 경로 [버킷, 경로](출력하지 않는다). */
  authoredPaths(userId: string): Promise<readonly (readonly [string, string])[]>
  /** 위 파일을 지운다(없는 파일은 0). 지운 수. */
  removeAuthoredFiles(userId: string): Promise<number>
  /** 남길 커플 접두의 남은 파일(가리키는 살아 있는 행 없음 · 24시간 지남, entries · messages · stories)을 지운다. 지운 수. */
  removeCoupleOrphans(coupleId: string, now: number): Promise<number>
  /** 탈퇴 유예가 끝난 사용자 id(`deleted_at is not null and purge_scheduled_at <= now`). */
  dueUserIds(nowIso: string): Promise<readonly string[]>
  /** 상대가 떠났는가: 프로필이 없거나, 탈퇴 요청이 있고 그 유예가 끝남. */
  partnerGone(partnerId: string, nowIso: string): Promise<boolean>
}

export type PurgeArgs = SweepArgs
export const parsePurgeArgs = parseSweepArgs

const partnerOf = (c: CoupleLite, userId: string): string | null => (c.user_a_id === userId ? c.user_b_id : c.user_a_id)

interface Plan {
  readonly userId: string
  /** 상대가 남은 커플이 아직 해제 실행 전 - 이번에는 기다린다. */
  readonly waiting: boolean
  /** 통째로 지울 커플(상대 없음 · 상대도 떠남). */
  readonly goneCoupleIds: readonly string[]
  /** 남길 커플(상대가 남음, 해제 끝남) - 떠난 사람 것만 지운다. */
  readonly keptCoupleIds: readonly string[]
}

async function planFor(port: PurgePort, userId: string, nowIso: string): Promise<Plan> {
  const couples = await port.listCouplesWithStatus(userId)
  const gone: string[] = []
  const kept: string[] = []
  for (const c of couples) {
    const partner = partnerOf(c, userId)
    const remains = partner !== null && partner !== userId && !(await port.partnerGone(partner, nowIso))
    if (!remains) gone.push(c.id)
    else if (c.status !== 'dissolved') return { userId, waiting: true, goneCoupleIds: [], keptCoupleIds: [] }
    else kept.push(c.id)
  }
  return { userId, waiting: false, goneCoupleIds: gone, keptCoupleIds: kept }
}

/** 떠난 사람이 쓴 기록 표 [표, 작성자 칸]. 상대가 남은 커플에서는 이 행만 지운다. */
export const AUTHORED_TABLES = [
  ['data_entries', 'author_id'],
  ['messages', 'sender_id'],
  ['stories', 'author_id'],
] as const

/** 순수 흐름 - 문(접속 전) -> 대상 -> 사용자마다 판정 -> 집계 -> (apply일 때만) 저장소 -> 행 -> 인증. 출력은 숫자만. */
export async function runPurge(connect: () => Promise<PurgePort>, args: PurgeArgs, gate: ProjectGate, now: Date = new Date()): Promise<OpsOutcome> {
  const blocked = gate()
  if (blocked !== null) return { kind: 'refused', lines: [`거부: ${blocked}`] }
  let port: PurgePort
  try {
    port = await connect()
  } catch (error) {
    if (error instanceof OpsStopError) return { kind: 'refused', lines: ['거부: 개발 프로젝트가 아니거나 확인할 수 없다'] }
    throw error
  }
  const nowIso = now.toISOString()
  const due = await port.dueUserIds(nowIso)
  const plans: Plan[] = []
  for (const id of due) plans.push(await planFor(port, id, nowIso))
  const ready = plans.filter((p) => !p.waiting)
  const waiting = plans.length - ready.length

  // 집계(미리 보기 · 적용 모두 같은 숫자). 같은 커플을 두 사용자가 함께 가지면 한 번만 센다.
  const coupleIds = [...new Set(ready.flatMap((p) => p.goneCoupleIds))]
  const keptIds = [...new Set(ready.flatMap((p) => p.keptCoupleIds))]
  const leaversWithKept = ready.filter((p) => p.keptCoupleIds.length > 0).map((p) => p.userId)
  const userIds = ready.map((p) => p.userId)
  const rows: [string, number][] = [['couples', coupleIds.length]]
  for (const table of COUPLE_CASCADE_TABLES) rows.push([table, coupleIds.length === 0 ? 0 : await port.count(table, 'couple_id', coupleIds)])
  for (const [table, column] of USER_CASCADE_TABLES) rows.push([table, userIds.length === 0 ? 0 : await port.count(table, column, userIds)])
  const authored: [string, number][] = []
  for (const [table, column] of AUTHORED_TABLES) authored.push([table, leaversWithKept.length === 0 ? 0 : await port.count(table, column, leaversWithKept)])
  let files = 0
  let magazineFiles = 0
  for (const bucket of COUPLE_BUCKETS) {
    for (const id of coupleIds) {
      const n = await port.countFiles(bucket, id)
      files += n
      if ((MAGAZINE_BUCKETS as readonly string[]).includes(bucket)) magazineFiles += n
    }
  }
  for (const bucket of USER_BUCKETS) for (const u of userIds) files += await port.countFiles(bucket, u)
  for (const u of leaversWithKept) files += (await port.authoredPaths(u)).length

  const lines = [args.apply ? '실행: 탈퇴 최종 삭제' : '미리 보기(지우지 않음): 탈퇴 최종 삭제']
  lines.push(`유예 끝난 사용자: ${plans.length}`)
  lines.push(`처리 대상: ${ready.length}`)
  lines.push(`해제 실행 대기(다음 실행 때): ${waiting}`)
  lines.push(`상대가 남은 커플(커플 · 호 · 상대 기록 남김): ${keptIds.length}`)
  for (const [table, n] of rows) lines.push(`${table}: ${n}`)
  for (const [table, n] of authored) lines.push(`떠난 사람 ${table}(상대가 남은 커플): ${n}`)
  lines.push(`auth 사용자: ${ready.length}`)
  lines.push(`Storage: ${files}`)
  lines.push(`매거진 파일(magazine · magazine-print): ${magazineFiles}`)
  if (!args.apply) {
    lines.push('실제로 지우려면 --apply')
    return { kind: 'previewed', lines }
  }

  let done = 0
  let failed = 0
  let keptOrphans = 0
  for (const p of ready) {
    try {
      // 1) 저장소: 통째로 지울 커플 접두 · 떠난 사람 avatars · 떠난 사람 기록의 파일 · 남길 커플의 남은 파일
      for (const bucket of COUPLE_BUCKETS) for (const id of p.goneCoupleIds) await port.removeFiles(bucket, id)
      for (const bucket of USER_BUCKETS) await port.removeFiles(bucket, p.userId)
      if (p.keptCoupleIds.length > 0) {
        await port.removeAuthoredFiles(p.userId)
        for (const id of p.keptCoupleIds) keptOrphans += await port.removeCoupleOrphans(id, now.getTime())
      }
      // 2) 행: 떠난 사람의 기록(남길 커플) -> 통째로 지울 커플(cascade)
      if (p.keptCoupleIds.length > 0) for (const [table, column] of AUTHORED_TABLES) await port.deleteRows(table, column, [p.userId])
      if (p.goneCoupleIds.length > 0) await port.deleteRows('couples', 'id', p.goneCoupleIds)
      // 3) 인증 사용자(profiles · 성격 결과 cascade, 커플 · 해제 칸은 m1이 비움). 앞 사용자가 같은 커플을 이미 지웠으면 빈 작업(멱등).
      await port.deleteUser(p.userId)
      done += 1
    } catch {
      failed += 1 // 다음 실행 때 다시. 다른 사용자는 계속.
    }
  }
  lines.push(`남길 커플의 남은 파일 지움: ${keptOrphans}`)
  lines.push(`지운 사용자: ${done}`)
  lines.push(`실패: ${failed}`)
  lines.push(failed > 0 ? '완료(실패한 사용자는 다음 실행 때 다시)' : '완료')
  return { kind: 'applied', lines }
}

// ── 실제 접속 (service_role) ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Db = any

function must(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what} 실패`)
}

/** 떠난 사람 기록의 파일 칸 [표, 작성자 칸, 경로 칸, 버킷들]. data_entries 경로는 아카이브된 스토리면 stories 버킷이라 두 곳에서 지운다(없는 파일은 0). */
const AUTHORED_FILE_COLUMNS = [
  ['data_entries', 'author_id', 'storage_path', ['entries', 'stories']],
  ['data_entries', 'author_id', 'thumb_path', ['entries']],
  ['data_entries', 'author_id', 'drawing_path', ['entries']],
  ['messages', 'sender_id', 'media_path', ['messages']],
  ['stories', 'author_id', 'media_path', ['stories']],
] as const

/** 남길 커플의 남은 파일을 볼 버킷(커플 접두). */
const KEPT_ORPHAN_BUCKETS = ['entries', 'messages', 'stories'] as const

export function makePurgePort(client: Db): PurgePort {
  const base = makePort(client)
  const sweep = makeSweepPort(client)
  async function authoredPaths(userId: string): Promise<(readonly [string, string])[]> {
    const out: (readonly [string, string])[] = []
    for (const [table, author, column, buckets] of AUTHORED_FILE_COLUMNS) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from(table).select(column).eq(author, userId).not(column, 'is', null)
          .order(column, { ascending: true }).range(from, from + 999)
        must(`${table} 경로 조회`, error)
        const rows: Record<string, string | null>[] = data ?? []
        for (const r of rows) if (r[column]) for (const b of buckets) out.push([b, r[column] as string])
        if (rows.length < 1000) break
      }
    }
    return out
  }
  return {
    async listCouplesWithStatus(userId) {
      const { data, error } = await client.from('couples').select('id, user_a_id, user_b_id, status').or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      must('couples 조회', error)
      return data ?? []
    },
    authoredPaths,
    async removeAuthoredFiles(userId) {
      const byBucket = new Map<string, string[]>()
      for (const [b, path] of await authoredPaths(userId)) byBucket.set(b, [...(byBucket.get(b) ?? []), path])
      let removed = 0
      for (const [b, paths] of byBucket) {
        for (let i = 0; i < paths.length; i += 100) {
          const { data, error } = await client.storage.from(b).remove(paths.slice(i, i + 100))
          must('storage 삭제', error)
          removed += Array.isArray(data) ? data.length : 0
        }
      }
      return removed
    },
    async removeCoupleOrphans(coupleId, now) {
      const live = await sweep.livePaths()
      let removed = 0
      for (const bucket of KEPT_ORPHAN_BUCKETS) {
        const files = await walkBucket(client, bucket, coupleId)
        const { orphans } = classifyFiles(files, live, now)
        if (orphans.length === 0) continue
        const r = await sweep.removeFiles(bucket, orphans)
        if (r.failed > 0) throw new Error('storage 삭제 실패')
        removed += r.removed
      }
      return removed
    },
    count: base.count,
    countFiles: base.countFiles,
    removeFiles: base.removeFiles,
    deleteRows: base.deleteRows,
    deleteUser: base.deleteUser,
    async dueUserIds(nowIso) {
      const ids: string[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client
          .from('profiles')
          .select('id')
          .not('deleted_at', 'is', null)
          .lte('purge_scheduled_at', nowIso)
          .order('id', { ascending: true })
          .range(from, from + 999)
        must('profiles 조회', error)
        const rows: { id: string }[] = data ?? []
        ids.push(...rows.map((r) => r.id))
        if (rows.length < 1000) break
      }
      return ids
    },
    async partnerGone(partnerId, nowIso) {
      const { data, error } = await client.from('profiles').select('deleted_at, purge_scheduled_at').eq('id', partnerId).maybeSingle()
      must('profiles 조회', error)
      if (!data) return true
      if (!data.deleted_at || !data.purge_scheduled_at) return false
      return Date.parse(data.purge_scheduled_at) <= Date.parse(nowIso)
    },
  }
}

function envOrUndefined(name: string): string | undefined {
  try {
    return Deno.env.get(name)
  } catch {
    return undefined
  }
}

async function main(): Promise<void> {
  let secrets: readonly string[] = []
  const out = (line: string) => console.log(redactSecrets(line, secrets))
  try {
    const args = parsePurgeArgs(Deno.args)
    const gate = makeProjectGate({ allowlistText: await readAllowlistText(), url: envOrUndefined('ONDOLOG_SUPABASE_URL') })
    const connect = async () => {
      const { connectOps } = await import('./supabaseOps.ts')
      const conn = await connectOps()
      secrets = conn.secrets
      return makePurgePort(conn.client)
    }
    const outcome = await runPurge(connect, args, gate)
    for (const line of outcome.lines) out(line)
    if (outcome.kind === 'refused') Deno.exit(1)
  } catch (error) {
    out(`중단: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    Deno.exit(1)
  }
}

if (import.meta.main) void main()
