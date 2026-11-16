/**
 * 76-f (c) 탈퇴 최종 삭제 (R104-3 · R104-4 · R104-5) - 탈퇴 유예가 끝난 사용자(`profiles.deleted_at` 있음 · `purge_scheduled_at <= now()`, 003 · 027)를 지운다
 * (Deno 전용, 사람 실행). 앱에서는 부르지 않는다. 매주 월요일 `sweepOrphanFiles`보다 **먼저** 미리 보기 -> 적용(HANDOFF "76-f 월요일 운영").
 *
 * 지우는 순서는 초기화 스크립트(`resetTestAccount.ts`)와 같다: 1) 저장소 파일 -> 2) 커플 행(cascade로 하위 표 · 호) -> 3) 인증 사용자(profiles 등 cascade).
 *   접속 부분(목록 · 파일 지우기 · 행 지우기 · 사용자 지우기)은 `resetTestAccount.makePort`를 그대로 쓴다(초기화 동작 변화 0, 그 파일은 고치지 않음).
 *
 * 상대(같은 커플 행의 다른 사람)가 **남아 있으면** 그 사용자는 이번 실행에서 건드리지 않는다(보류):
 *   - 상대의 기록 · 파일 · 발행된 호(행 · magazine 파일)는 0건 영향(처리방침 "두 사람이 모두 떠났을 때만").
 *   - couples.user_a_id · user_b_id 가 profiles 를 ON DELETE RESTRICT 로 가리켜(005), 커플 행을 남긴 채로는 인증 사용자 · 프로필을 지울 수 없다
 *     -> 계정 행 삭제는 스키마 변경(마이그레이션)이 필요하다 - 76-f 보고 "멈춘 것". 그 사용자의 기록 행은 해제 실행(030, 같은 7일)이 지우고 파일은 `sweepOrphanFiles`가 지운다.
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
import { makeProjectGate, parseSweepArgs, readAllowlistText, type OpsOutcome, type ProjectGate, type SweepArgs } from './sweepOrphanFiles.ts'

/** 이 스크립트가 쓰는 접속 부분 = 초기화 포트의 일부 + 대상 찾기 두 가지. */
export interface PurgePort extends Pick<ResetPort, 'listCouples' | 'count' | 'countFiles' | 'removeFiles' | 'deleteRows' | 'deleteUser'> {
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
  readonly blocked: boolean
  readonly coupleIds: readonly string[]
}

async function planFor(port: PurgePort, userId: string, nowIso: string): Promise<Plan> {
  const couples = await port.listCouples(userId)
  for (const c of couples) {
    const partner = partnerOf(c, userId)
    if (partner !== null && partner !== userId && !(await port.partnerGone(partner, nowIso))) return { userId, blocked: true, coupleIds: [] }
  }
  return { userId, blocked: false, coupleIds: couples.map((c) => c.id) }
}

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
  const ready = plans.filter((p) => !p.blocked)
  const held = plans.length - ready.length

  // 집계(미리 보기 · 적용 모두 같은 숫자). 같은 커플을 두 사용자가 함께 가지면 한 번만 센다.
  const coupleIds = [...new Set(ready.flatMap((p) => p.coupleIds))]
  const userIds = ready.map((p) => p.userId)
  const rows: [string, number][] = [['couples', coupleIds.length]]
  for (const table of COUPLE_CASCADE_TABLES) rows.push([table, coupleIds.length === 0 ? 0 : await port.count(table, 'couple_id', coupleIds)])
  for (const [table, column] of USER_CASCADE_TABLES) rows.push([table, userIds.length === 0 ? 0 : await port.count(table, column, userIds)])
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

  const lines = [args.apply ? '실행: 탈퇴 최종 삭제' : '미리 보기(지우지 않음): 탈퇴 최종 삭제']
  lines.push(`유예 끝난 사용자: ${plans.length}`)
  lines.push(`처리 대상: ${ready.length}`)
  lines.push(`보류(상대 남음 · 계정 행은 스키마 변경 필요): ${held}`)
  for (const [table, n] of rows) lines.push(`${table}: ${n}`)
  lines.push(`auth 사용자: ${ready.length}`)
  lines.push(`Storage: ${files}`)
  lines.push(`매거진 파일(magazine · magazine-print): ${magazineFiles}`)
  if (!args.apply) {
    lines.push('실제로 지우려면 --apply')
    return { kind: 'previewed', lines }
  }

  let done = 0
  let failed = 0
  for (const p of ready) {
    try {
      // 1) 저장소 -> 2) 커플 행(cascade) -> 3) 인증 사용자(profiles 등 cascade). 앞 사용자가 같은 커플을 이미 지웠으면 빈 작업(멱등).
      for (const bucket of COUPLE_BUCKETS) for (const id of p.coupleIds) await port.removeFiles(bucket, id)
      for (const bucket of USER_BUCKETS) await port.removeFiles(bucket, p.userId)
      if (p.coupleIds.length > 0) await port.deleteRows('couples', 'id', p.coupleIds)
      await port.deleteUser(p.userId)
      done += 1
    } catch {
      failed += 1 // 다음 실행 때 다시. 다른 사용자는 계속.
    }
  }
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

export function makePurgePort(client: Db): PurgePort {
  const base = makePort(client)
  return {
    listCouples: base.listCouples,
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
