/**
 * 76-f (b) 남은 파일 정리 (R104-3 · R104-4 · R104-5) - 저장소에 남아 있지만 **가리키는 살아 있는 행이 없는** 파일만 지운다 (Deno 전용, 사람 실행).
 * 앱(`web/` `app/` `src/`)에서는 부르지 않는다. 매주 월요일 `purgeWithdrawn` 다음에 미리 보기 -> 적용(HANDOFF "76-f 월요일 운영").
 *
 * 대상 버킷: `entries` · `messages` · `stories` · `avatars`(015 · 019의 실제 이름).
 * **`magazine` · `magazine-print`는 열거조차 하지 않는다**(발행된 호는 두 사람이 모두 떠날 때까지 남긴다 - 처리방침). 포트도 이 넷 밖 버킷은 거부한다.
 *
 * "가리키는 행" = 아래 경로 칸 중 하나에 그 파일 경로가 있는 **지우지 않은** 행(`deleted_at`이 있는 표는 null인 행만):
 *   data_entries.storage_path · thumb_path · drawing_path (deleted_at is null)   - 스토리가 아카이브되면 stories 버킷 경로가 여기 들어간다(013 expire_stories)
 *   messages.media_path (deleted_at is null)
 *   stories.media_path (모든 행 - 정리된 스토리도 행이 남아 있으면 남긴다, 보수적)
 *   profiles.reference_photo_path · couples.reference_photo_path
 * 버킷을 가리지 않고 **모든 칸의 경로를 한 집합**으로 본다(data_entries가 stories 버킷 경로를 가리킬 수 있어서 - 겹치면 남기는 쪽, 보수적).
 * 소프트 삭제된 행(사용자가 지운 사진 · 하루 · 메시지)의 파일은 "가리키는 행이 없는 파일"이다 - 처리방침 "언제든 지울 수 있습니다"를 이 정리가 채운다(76-f (a) 멈춤 동안).
 *
 * 진행 중인 업로드와 겹치지 않게: 만든 시각이 24시간 안이거나 모르는 파일은 건너뛴다.
 * 기본은 미리 보기(숫자만, 삭제 호출 0). `--apply`일 때만 지운다.
 * 개발 프로젝트 가드: 초기화 스크립트의 허용 목록(`resetAllowlist.ts` - 저장소 밖 `reset-allowlist.txt`의 `project=` 줄)을 그대로 읽어,
 *   접속 URL의 ref가 그 안에 없으면 **접속 전에** 아무것도 하지 않고 끝낸다. 이메일 줄은 보지 않는다.
 * 출력: 버킷별 "검사 n · 남은 파일 n · 건너뜀(24시간) n · 지움 n · 실패 n" - 숫자만. 경로 · id · 키 · 주소 · ref · 이메일 0.
 * 금지: demo_responses · execute_dissolution · apply_retention_policy · run_due_dissolutions · 마이그레이션.
 *
 * 사용 (저장소 맨 위 폴더, 한 줄 - HANDOFF "76-f 월요일 운영"):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME
 *     --allow-net=$h --allow-read=supabase/.temp/linked-project.json,$al scripts/ops/sweepOrphanFiles.ts [--apply]
 */
import { OpsStopError, projectRefFromUrl, redactSecrets } from './opsGuards.ts'
import { parseAllowlist, resolveAllowlistPath } from './resetAllowlist.ts'

/** 정리하는 버킷(이 넷뿐). */
export const SWEEP_BUCKETS = ['entries', 'messages', 'stories', 'avatars'] as const
export type SweepBucket = (typeof SWEEP_BUCKETS)[number]
/** 손대지 않는(열거도 하지 않는) 버킷. */
export const PROTECTED_BUCKETS = ['magazine', 'magazine-print'] as const
/** 이보다 새 파일은 건너뛴다(진행 중인 업로드). */
export const MIN_FILE_AGE_MS = 24 * 60 * 60 * 1000

/** 경로 칸 지도: [표, 칸, deleted_at 칸이 있는가]. 시험 · 실제 포트가 같은 표를 쓴다. */
export const PATH_COLUMNS = [
  ['data_entries', 'storage_path', true],
  ['data_entries', 'thumb_path', true],
  ['data_entries', 'drawing_path', true],
  ['messages', 'media_path', true],
  ['stories', 'media_path', false],
  ['profiles', 'reference_photo_path', false],
  ['couples', 'reference_photo_path', false],
] as const

export interface StoredFile {
  /** 버킷 안 경로(출력하지 않는다). */
  readonly path: string
  /** 만든 시각(ISO). 모르면 null -> 건너뜀. */
  readonly createdAt: string | null
}

/** 접속 부분 - 실제는 service_role 클라이언트, 시험은 가짜. */
export interface SweepPort {
  listFiles(bucket: SweepBucket): Promise<readonly StoredFile[]>
  /** 살아 있는 행이 가리키는 경로 전부(PATH_COLUMNS). */
  livePaths(): Promise<ReadonlySet<string>>
  /** 지운 수 · 실패 수. */
  removeFiles(bucket: SweepBucket, paths: readonly string[]): Promise<{ removed: number; failed: number }>
}

export interface SweepArgs {
  readonly apply: boolean
}

export function parseSweepArgs(argv: readonly string[]): SweepArgs {
  let apply = false
  for (const a of argv) {
    if (a === '--apply') apply = true
    else throw new OpsStopError('알 수 없는 인수가 있다(--apply 하나만 쓴다)')
  }
  return { apply }
}

/** 개발 프로젝트 문: 허용 목록의 project= 줄과 접속 URL ref만 본다(이메일 줄은 무시). 접속 전에 부른다. 이유 한 줄 또는 null. */
export type ProjectGate = () => string | null

export function makeProjectGate(input: { readonly allowlistText: string | null; readonly url: string | undefined }): ProjectGate {
  return () => {
    if (input.allowlistText === null) return '허용 목록 파일이 없거나 읽을 수 없다(저장소 밖 로컬 파일이 필요하다)'
    let projects: ReadonlySet<string>
    try {
      projects = parseAllowlist(input.allowlistText).projects
    } catch (error) {
      if (error instanceof OpsStopError) return error.message
      throw error
    }
    if (projects.size === 0) return '허용 목록에 개발 프로젝트 표시(project= 줄)가 없다'
    if (input.url === undefined || input.url.trim().length === 0) return '접속 URL 환경변수가 없다'
    let ref: string
    try {
      ref = projectRefFromUrl(input.url)
    } catch {
      return '접속 URL 모양이 틀렸다'
    }
    return projects.has(ref) ? null : '개발 프로젝트가 아니다(허용 목록의 project와 다르다)'
  }
}

export type OpsOutcome = { readonly kind: 'refused' | 'previewed' | 'applied'; readonly lines: readonly string[] }
const refuse = (reason: string): OpsOutcome => ({ kind: 'refused', lines: [`거부: ${reason}`] })

export interface BucketTally {
  checked: number
  orphan: number
  skippedYoung: number
  removed: number
  failed: number
}

/** 한 버킷 판정(순수): 남은 파일 = 가리키는 행 없음 · 24시간 지남. 만든 시각을 모르면 건너뜀. */
export function classifyFiles(files: readonly StoredFile[], live: ReadonlySet<string>, now: number): { orphans: string[]; skippedYoung: number } {
  const orphans: string[] = []
  let skippedYoung = 0
  for (const f of files) {
    if (live.has(f.path)) continue
    const t = f.createdAt === null ? Number.NaN : Date.parse(f.createdAt)
    if (Number.isNaN(t) || now - t < MIN_FILE_AGE_MS) {
      skippedYoung += 1
      continue
    }
    orphans.push(f.path)
  }
  return { orphans, skippedYoung }
}

/** 순수 흐름 - 문(접속 전) -> 살아 있는 경로 -> 버킷마다 판정 -> (apply일 때만) 삭제. 출력은 숫자만. */
export async function runSweep(connect: () => Promise<SweepPort>, args: SweepArgs, gate: ProjectGate, now: number = Date.now()): Promise<OpsOutcome> {
  const blocked = gate()
  if (blocked !== null) return refuse(blocked)
  let port: SweepPort
  try {
    port = await connect()
  } catch (error) {
    if (error instanceof OpsStopError) return refuse('개발 프로젝트가 아니거나 확인할 수 없다')
    throw error
  }
  const live = await port.livePaths()
  const lines = [args.apply ? '실행: 남은 파일 정리' : '미리 보기(지우지 않음): 남은 파일']
  let failedTotal = 0
  for (const bucket of SWEEP_BUCKETS) {
    const files = await port.listFiles(bucket)
    const { orphans, skippedYoung } = classifyFiles(files, live, now)
    const t: BucketTally = { checked: files.length, orphan: orphans.length, skippedYoung, removed: 0, failed: 0 }
    if (args.apply && orphans.length > 0) {
      const r = await port.removeFiles(bucket, orphans)
      t.removed = r.removed
      t.failed = r.failed
      failedTotal += r.failed
    }
    lines.push(`${bucket}: 검사 ${t.checked} · 남은 파일 ${t.orphan} · 건너뜀(24시간) ${t.skippedYoung} · 지움 ${t.removed} · 실패 ${t.failed}`)
  }
  if (!args.apply) {
    lines.push('실제로 지우려면 --apply')
    return { kind: 'previewed', lines }
  }
  lines.push(failedTotal > 0 ? `완료(실패 ${failedTotal} - 다음 실행 때 다시)` : '완료')
  return { kind: 'applied', lines }
}

// ── 실제 접속 (service_role) ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Db = any
const PAGE = 1000
const CHUNK = 100

function must(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what} 실패`)
}

function assertSweepBucket(bucket: string): asserts bucket is SweepBucket {
  if (!(SWEEP_BUCKETS as readonly string[]).includes(bucket)) throw new OpsStopError('정리 대상이 아닌 버킷이다')
}

/** 버킷 아래 모든 파일(폴더는 id가 null이라 들어가 본다). */
export async function walkBucket(client: Db, bucket: SweepBucket, prefix = ''): Promise<StoredFile[]> {
  assertSweepBucket(bucket)
  const out: StoredFile[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: PAGE, offset })
    must('storage 목록 조회', error)
    const items: { name: string; id: string | null; created_at?: string | null }[] = data ?? []
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) out.push(...(await walkBucket(client, bucket, path)))
      else out.push({ path, createdAt: item.created_at ?? null })
    }
    if (items.length < PAGE) break
  }
  return out
}

export function makeSweepPort(client: Db): SweepPort {
  return {
    listFiles: (bucket) => walkBucket(client, bucket),
    async livePaths() {
      const set = new Set<string>()
      for (const [table, column, soft] of PATH_COLUMNS) {
        for (let from = 0; ; from += PAGE) {
          let q = client.from(table).select(column).not(column, 'is', null)
          if (soft) q = q.is('deleted_at', null)
          const { data, error } = await q.order(column, { ascending: true }).range(from, from + PAGE - 1)
          must(`${table} 경로 조회`, error)
          const rows: Record<string, string | null>[] = data ?? []
          for (const r of rows) if (r[column]) set.add(r[column] as string)
          if (rows.length < PAGE) break
        }
      }
      return set
    },
    async removeFiles(bucket, paths) {
      assertSweepBucket(bucket)
      let removed = 0
      let failed = 0
      for (let i = 0; i < paths.length; i += CHUNK) {
        const part = paths.slice(i, i + CHUNK)
        const { data, error } = await client.storage.from(bucket).remove(part)
        if (error) failed += part.length
        else {
          const n = Array.isArray(data) ? data.length : part.length
          removed += n
          failed += part.length - n
        }
      }
      return { removed, failed }
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

export async function readAllowlistText(): Promise<string | null> {
  const path = resolveAllowlistPath(envOrUndefined)
  if (path === null) return null
  try {
    return await Deno.readTextFile(path)
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  let secrets: readonly string[] = []
  const out = (line: string) => console.log(redactSecrets(line, secrets))
  try {
    const args = parseSweepArgs(Deno.args)
    const gate = makeProjectGate({ allowlistText: await readAllowlistText(), url: envOrUndefined('ONDOLOG_SUPABASE_URL') })
    const connect = async () => {
      const { connectOps } = await import('./supabaseOps.ts')
      const conn = await connectOps()
      secrets = conn.secrets
      return makeSweepPort(conn.client)
    }
    const outcome = await runSweep(connect, args, gate)
    for (const line of outcome.lines) out(line)
    if (outcome.kind === 'refused') Deno.exit(1)
  } catch (error) {
    out(`중단: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    Deno.exit(1)
  }
}

if (import.meta.main) void main()
