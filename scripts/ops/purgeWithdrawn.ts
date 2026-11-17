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
 * 76-h (R106-2) 떠난 사람이 남긴 장소(`date_stops`, 76-m3 작성자 칸으로만 가른다):
 *   ① 탈퇴 - 상대가 남은 커플에서 작성자 = 떠난 사람인 장소를 **인증 사용자 삭제 전에** 지운다(지운 뒤에는 작성자 칸이 비어(m1) 가를 수 없다).
 *   ② 해제 - "해제된 커플 정리" 단계: 해제가 실행된(`couples.status = 'dissolved'`) 커플에서 작성자 = 해제 요청자(`couple_dissolutions.initiated_by`,
 *      실행됨 · 취소 안 됨)인 장소를 지운다. 030은 m3 이전 설계라 장소를 사람 단위로 지우지 않는다(030 수정 0). 탈퇴 단계보다 **먼저** 돈다(같은 이유).
 *   ③ 빈 날 - 그 사람 것을 빼고 그날 남은 것(장소 · 지우지 않은 사진 · 메모, 두 사람 모두)이 0이면 그날 `dates` 행도 지운다. 하나라도 남으면 유지.
 *   ④ 작성자가 빈 장소(m3 이전)는 대상 밖이고, 빈 날 판정에서는 "남은 것"으로 센다.
 *   "해제 실행 대기" 규칙은 그대로 - 해제 실행 전 커플의 장소는 건드리지 않는다.
 *
 * 76-i (R110-4) 숨긴 행 정리: 앱에서 지워 숨김 표시(`deleted_at`)만 된 행을 **숨긴 지 24시간이 지나면 행째** 지운다(내용 비우기 아님).
 *   대상 = `HIDDEN_TABLES`(data_entries 사진 · 메모 · 그림, messages, dates 하루). 탈퇴 · 해제 단계(76-g · 76-h) **뒤**에 돌고, 그 단계가 맡은 행(통째로 지울 커플 ·
 *   떠난 사람의 기록)은 세지도 지우지도 않는다. 파일은 다루지 않는다(행이 사라지면 다음 `sweepOrphanFiles`가 남은 파일을 받는다).
 *   대상 밖: `date_stops`(숨김 칸 없음, 이미 행 삭제) · `stories`(숨김 칸 없음 - 지우기는 행 삭제,
 *   만료는 `resolved_at` · `resolution`이라 "지운 것"이 아니다) · 발행된 호(`issues` 등)와 매거진 파일.
 *   지울 때도 "숨김 표시 있음 · 24시간 지남"을 다시 걸어 지운다 - 고른 뒤 앱이 되살린 행(`ensureDate`가 `deleted_at`을 비움)은 그래서 지워지지 않는다.
 *   묶음(100행)이 실패하면 그 수만 실패로 세고 다음 실행 때 다시.
 * 76-j (R112-2) `dates`: 위 규칙에 더해, 그 날짜를 가리키는 **살아 있는** 기록(숨기지 않은 사진 · 메모 · 그림, 장소 - 장소는 숨김 칸이 없어 있으면 살아 있음)이
 *   하나라도 있으면 지우지 않고 "건너뜀"으로 센다(정상이면 0). 고를 때와 지울 때 두 번 본다. 같은 단계에서 `data_entries` · `messages` 다음에 돈다.
 *   앱(`ensureDate`)은 그대로 - 행이 없으면 새로 만든다.
 *
 * 80- (R114-3 ② · 80-m1) 오류 기록 90일 정리: 앱 오류 하루 집계(`app_error_daily` - 사람 · 내용 칸 0)에서 KST 날짜가 90일보다 오래된 행을 지운다.
 *   표가 아직 없으면(80-m1을 올리기 전) "확인 못 함" 한 줄로 넘어가고 다른 단계는 그대로 돈다. 다시 돌려도 같다(멱등).
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
  /** 76-h ②: 해제가 실행된(`couples.status = 'dissolved'`) 커플과 그 요청자(`couple_dissolutions.initiated_by`, 실행됨 · 취소 안 됨 · 칸이 비지 않음). */
  dissolvedInitiators(): Promise<readonly { readonly coupleId: string; readonly initiatorId: string }[]>
  /** 이 커플들에서 작성자 = authorId 인 장소(`date_stops`)의 날짜 id(장소 하나당 하나). */
  stopDateIds(authorId: string, coupleIds: readonly string[]): Promise<readonly string[]>
  /** 이 커플들에서 작성자 = authorId 인 기록(`data_entries`)의 날짜 id. */
  entryDateIds(authorId: string, coupleIds: readonly string[]): Promise<readonly string[]>
  /** 이 커플들에서 작성자 = authorId 인 장소를 지운다. 작성자가 빈 장소는 건드리지 않는다. */
  deleteStops(authorId: string, coupleIds: readonly string[]): Promise<void>
  /** authorId 의 것을 빼고 나면 남은 것(장소 - 작성자 빈 옛 장소 포함 · 지우지 않은 사진 · 메모, 두 사람 모두)이 0인 날짜 id. */
  emptyAfter(dateIds: readonly string[], authorId: string): Promise<readonly string[]>
  /** 76-i: 숨김 표시가 있고 그 시각이 cutoffIso 이전(같음 포함)인 행. */
  hiddenRows(table: HiddenTable, cutoffIso: string): Promise<readonly HiddenRow[]>
  /** 76-i: 이 id 중 숨김 표시가 있고 cutoffIso 이전인 행만 지운다. 지운 수. */
  deleteHidden(table: HiddenTable, ids: readonly string[], cutoffIso: string): Promise<number>
  /** 76-j: 이 날짜 id 중 살아 있는 기록(숨기지 않은 data_entries · date_stops)이 가리키는 것. */
  liveDateIds(dateIds: readonly string[]): Promise<readonly string[]>
  /** 80-: 오류 기록(`app_error_daily`)에서 day < cutoffDay 인 행 수. */
  oldErrorRows(cutoffDay: string): Promise<number>
  /** 80-: 위 행을 지운다. 지운 수. */
  deleteOldErrorRows(cutoffDay: string): Promise<number>
}

/** 76-i · 76-j 숨긴 행 정리 대상 [표, 작성자 칸]. dates는 작성자 칸이 없다. date_stops · stories는 대상 밖(머리 주석). 순서 = 지우는 순서. */
export const HIDDEN_TABLES = [
  ['data_entries', 'author_id'],
  ['messages', 'sender_id'],
  ['dates', null],
] as const
export type HiddenTable = (typeof HIDDEN_TABLES)[number][0]
export interface HiddenRow {
  readonly id: string
  readonly coupleId: string
  readonly authorId: string | null
}
/** 숨긴 지 이 시간이 지나야 지운다. */
export const HIDDEN_GRACE_MS = 24 * 60 * 60 * 1000
const HIDDEN_CHUNK = 100
/** 80-: 오류 기록은 이 날수보다 오래된 KST 날짜의 행을 지운다. */
export const ERROR_LOG_KEEP_DAYS = 90

/** 80-: 지울 기준 날짜(이 날짜보다 앞선 행을 지운다) = KST 오늘 - 90일, YYYY-MM-DD. */
export function errorLogCutoffDay(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3_600_000)
  kst.setUTCDate(kst.getUTCDate() - ERROR_LOG_KEEP_DAYS)
  return kst.toISOString().slice(0, 10)
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

const uniq = (xs: readonly string[]): string[] => [...new Set(xs)]

/** 76-h: 한 사람(커플 범위)의 장소 · 빈 날 계획. 미리 보기 · 적용이 같은 숫자를 쓴다. */
interface PlaceTask {
  readonly authorId: string
  readonly coupleIds: readonly string[]
  /** 지울 장소 수. */
  readonly stops: number
  /** 그 사람 것을 빼면 남은 것이 0이 되는 날짜. */
  readonly emptyDates: readonly string[]
}

/** stopCouples: 장소를 지울 커플 · entryCouples: 기록 행도 지워지는 커플(빈 날 판정에 함께 본다). */
async function placeTask(port: PurgePort, authorId: string, stopCouples: readonly string[], entryCouples: readonly string[]): Promise<PlaceTask> {
  const stopDates = await port.stopDateIds(authorId, stopCouples)
  const entryDates = entryCouples.length > 0 ? await port.entryDateIds(authorId, entryCouples) : []
  const touched = uniq([...stopDates, ...entryDates])
  const emptyDates = touched.length === 0 ? [] : await port.emptyAfter(touched, authorId)
  return { authorId, coupleIds: stopCouples, stops: stopDates.length, emptyDates }
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

  // 76-h ② 해제된 커플 정리: 요청자의 장소(작성자 = 요청자) + 빈 날. 해제 실행 전(dissolving) 커플은 대상이 아니다.
  //   탈퇴 단계보다 먼저 센다/지운다 - 요청자가 같은 실행에서 지워지면 작성자 칸이 비어(m1) 더는 가를 수 없어서.
  const dissolvedTasks: PlaceTask[] = []
  for (const d of await port.dissolvedInitiators()) dissolvedTasks.push(await placeTask(port, d.initiatorId, [d.coupleId], []))
  const covered = new Set(dissolvedTasks.flatMap((t) => t.coupleIds.map((c) => `${t.authorId}|${c}`)))
  // 76-h ① 탈퇴: 상대가 남은 커플에서 떠난 사람의 장소(통째로 지울 커플은 cascade로 함께 지워진다). 해제 정리가 이미 맡은 (사람, 커플)은 두 번 세지 않는다.
  const leaverTasks = new Map<string, PlaceTask>()
  for (const p of ready) {
    if (p.keptCoupleIds.length === 0) continue
    const stopCouples = p.keptCoupleIds.filter((c) => !covered.has(`${p.userId}|${c}`))
    leaverTasks.set(p.userId, await placeTask(port, p.userId, stopCouples, p.keptCoupleIds))
  }
  const allTasks = [...dissolvedTasks, ...leaverTasks.values()]
  const placeCount = allTasks.reduce((n, t) => n + t.stops, 0)
  const emptyCount = uniq(allTasks.flatMap((t) => t.emptyDates)).length

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
  lines.push(`떠난 사람의 장소: ${placeCount}`)
  lines.push(`빈 날 정리: ${emptyCount}`)

  // 76-i 숨긴 행 정리: 위 단계가 맡은 행(통째로 지울 커플 · 떠난 사람의 기록)은 빼고 센다 - 같은 행을 두 번 세지 않는다.
  const cutoffIso = new Date(now.getTime() - HIDDEN_GRACE_MS).toISOString()
  const goneCouples = new Set(coupleIds)
  const leavers = new Set(leaversWithKept)
  const hidden: [HiddenTable, string[]][] = []
  let liveSkipped = 0
  for (const [table] of HIDDEN_TABLES) {
    const rowsOf = await port.hiddenRows(table, cutoffIso)
    let ids = rowsOf.filter((r) => !goneCouples.has(r.coupleId) && !(r.authorId !== null && leavers.has(r.authorId))).map((r) => r.id)
    if (table === 'dates' && ids.length > 0) {
      // 76-j: 살아 있는 기록이 가리키는 날은 지우지 않는다(건너뜀). 앞 표에서 지울 숨긴 기록은 살아 있는 기록이 아니다.
      const live = new Set(await port.liveDateIds(ids))
      liveSkipped += ids.filter((id) => live.has(id)).length
      ids = ids.filter((id) => !live.has(id))
    }
    hidden.push([table, ids])
  }
  lines.push(`숨긴 행 정리: ${hidden.reduce((n, [, ids]) => n + ids.length, 0)}`)
  for (const [table, ids] of hidden) lines.push(`숨긴 행 정리 ${table}: ${ids.length}`)
  lines.push(`건너뜀(살아 있는 기록): ${liveSkipped}`)
  // 80-: 오류 기록 90일 정리 - 표가 없거나 못 읽으면 이 단계만 건너뛴다(다른 단계는 그대로).
  const errorCutoff = errorLogCutoffDay(now)
  let errorRows: number | null = null
  try {
    errorRows = await port.oldErrorRows(errorCutoff)
  } catch {
    errorRows = null
  }
  lines.push(errorRows === null ? '오류 기록 90일 정리: 확인 못 함(80-m1 전이면 정상)' : `오류 기록 90일 정리: ${errorRows}`)
  if (!args.apply) {
    lines.push('실제로 지우려면 --apply')
    return { kind: 'previewed', lines }
  }

  let done = 0
  let failed = 0
  let keptOrphans = 0
  // 76-h ② 해제된 커플 정리 먼저(위 집계와 같은 이유). 실패한 커플은 다음 실행 때 다시(멱등).
  for (const t of dissolvedTasks) {
    try {
      await port.deleteStops(t.authorId, t.coupleIds)
      const empty = await port.emptyAfter(t.emptyDates, t.authorId)
      if (empty.length > 0) await port.deleteRows('dates', 'id', empty)
    } catch {
      failed += 1
    }
  }
  for (const p of ready) {
    try {
      // 1) 저장소: 통째로 지울 커플 접두 · 떠난 사람 avatars · 떠난 사람 기록의 파일 · 남길 커플의 남은 파일
      for (const bucket of COUPLE_BUCKETS) for (const id of p.goneCoupleIds) await port.removeFiles(bucket, id)
      for (const bucket of USER_BUCKETS) await port.removeFiles(bucket, p.userId)
      if (p.keptCoupleIds.length > 0) {
        await port.removeAuthoredFiles(p.userId)
        for (const id of p.keptCoupleIds) keptOrphans += await port.removeCoupleOrphans(id, now.getTime())
      }
      // 2) 행: 떠난 사람의 장소 · 기록(남길 커플) -> 빈 날 -> 통째로 지울 커플(cascade). 장소는 계정보다 먼저(지운 뒤에는 작성자 칸이 비어 가를 수 없음).
      const task = leaverTasks.get(p.userId)
      if (task) await port.deleteStops(p.userId, task.coupleIds)
      if (p.keptCoupleIds.length > 0) for (const [table, column] of AUTHORED_TABLES) await port.deleteRows(table, column, [p.userId])
      if (task && task.emptyDates.length > 0) {
        const empty = await port.emptyAfter(task.emptyDates, p.userId)
        if (empty.length > 0) await port.deleteRows('dates', 'id', empty)
      }
      if (p.goneCoupleIds.length > 0) await port.deleteRows('couples', 'id', p.goneCoupleIds)
      // 3) 인증 사용자(profiles · 성격 결과 cascade, 커플 · 해제 칸은 m1이 비움). 앞 사용자가 같은 커플을 이미 지웠으면 빈 작업(멱등).
      await port.deleteUser(p.userId)
      done += 1
    } catch {
      failed += 1 // 다음 실행 때 다시. 다른 사용자는 계속.
    }
  }
  // 76-i 숨긴 행 정리 - 탈퇴 · 해제 단계 뒤. 묶음이 실패하면 그 행 수만 실패(다음 실행 때 다시).
  let hiddenDeleted = 0
  let hiddenFailed = 0
  let lateSkipped = 0
  for (const [table, ids] of hidden) {
    for (let i = 0; i < ids.length; i += HIDDEN_CHUNK) {
      let part = ids.slice(i, i + HIDDEN_CHUNK)
      try {
        if (table === 'dates') {
          // 76-j: 지우기 직전에 한 번 더 - 고른 뒤 살아 있는 기록이 생긴 날은 건너뜀.
          const live = new Set(await port.liveDateIds(part))
          lateSkipped += part.filter((id) => live.has(id)).length
          part = part.filter((id) => !live.has(id))
        }
        hiddenDeleted += await port.deleteHidden(table, part, cutoffIso)
      } catch {
        hiddenFailed += part.length
      }
    }
  }
  // 80-: 오류 기록 90일 정리 - 숨긴 행 정리 뒤. 실패하면 다음 실행 때 다시(멱등).
  let errorDeleted = 0
  let errorFailed = false
  if (errorRows !== null && errorRows > 0) {
    try {
      errorDeleted = await port.deleteOldErrorRows(errorCutoff)
    } catch {
      errorFailed = true
    }
  }
  lines.push(`남길 커플의 남은 파일 지움: ${keptOrphans}`)
  lines.push(`숨긴 행 지움: ${hiddenDeleted}`)
  lines.push(`숨긴 행 실패(다음 실행 때 다시): ${hiddenFailed}`)
  lines.push(`건너뜀(지울 때 살아 있는 기록): ${lateSkipped}`)
  lines.push(errorFailed ? '오류 기록 지움: 실패(다음 실행 때 다시)' : `오류 기록 지움: ${errorDeleted}`)
  lines.push(`지운 사용자: ${done}`)
  lines.push(`실패: ${failed}`)
  lines.push(failed > 0 || hiddenFailed > 0 || errorFailed ? '완료(실패한 것은 다음 실행 때 다시)' : '완료')
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
    async dissolvedInitiators() {
      const pairs: { couple_id: string; initiated_by: string }[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client
          .from('couple_dissolutions')
          .select('couple_id, initiated_by')
          .not('executed_at', 'is', null)
          .is('cancelled_at', null)
          .not('initiated_by', 'is', null)
          .order('couple_id', { ascending: true })
          .range(from, from + 999)
        must('couple_dissolutions 조회', error)
        const rows: { couple_id: string; initiated_by: string }[] = data ?? []
        pairs.push(...rows)
        if (rows.length < 1000) break
      }
      const coupleIds = uniq(pairs.map((p) => p.couple_id))
      const dissolved = new Set<string>()
      for (let i = 0; i < coupleIds.length; i += 100) {
        const { data, error } = await client.from('couples').select('id').in('id', coupleIds.slice(i, i + 100)).eq('status', 'dissolved')
        must('couples 조회', error)
        for (const r of (data ?? []) as { id: string }[]) dissolved.add(r.id)
      }
      const seen = new Set<string>()
      const out: { coupleId: string; initiatorId: string }[] = []
      for (const p of pairs) {
        const key = `${p.couple_id}|${p.initiated_by}`
        if (!dissolved.has(p.couple_id) || seen.has(key)) continue
        seen.add(key)
        out.push({ coupleId: p.couple_id, initiatorId: p.initiated_by })
      }
      return out
    },
    async stopDateIds(authorId, coupleIds) {
      if (coupleIds.length === 0) return []
      const { data, error } = await client.from('date_stops').select('date_id').eq('author_id', authorId).in('couple_id', [...coupleIds])
      must('date_stops 조회', error)
      return ((data ?? []) as { date_id: string }[]).map((r) => r.date_id)
    },
    async entryDateIds(authorId, coupleIds) {
      if (coupleIds.length === 0) return []
      const { data, error } = await client.from('data_entries').select('date_id').eq('author_id', authorId).in('couple_id', [...coupleIds]).not('date_id', 'is', null)
      must('data_entries 조회', error)
      return uniq(((data ?? []) as { date_id: string }[]).map((r) => r.date_id))
    },
    async deleteStops(authorId, coupleIds) {
      if (coupleIds.length === 0) return
      const { error } = await client.from('date_stops').delete().eq('author_id', authorId).in('couple_id', [...coupleIds])
      must('date_stops 삭제', error)
    },
    async emptyAfter(dateIds, authorId) {
      const ids = uniq(dateIds)
      const remaining = new Map<string, number>(ids.map((id) => [id, 0]))
      for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100)
        const { data: stops, error: e1 } = await client.from('date_stops').select('date_id, author_id').in('date_id', part)
        must('date_stops 조회', e1)
        const { data: entries, error: e2 } = await client.from('data_entries').select('date_id, author_id').in('date_id', part).is('deleted_at', null)
        must('data_entries 조회', e2)
        for (const r of [...(stops ?? []), ...(entries ?? [])] as { date_id: string; author_id: string | null }[]) {
          // 작성자가 빈 옛 장소(m3 이전)도 남은 것으로 센다(76-h ④).
          if (r.author_id !== authorId) remaining.set(r.date_id, (remaining.get(r.date_id) ?? 0) + 1)
        }
      }
      return ids.filter((id) => remaining.get(id) === 0)
    },
    async hiddenRows(table, cutoffIso) {
      const author = HIDDEN_TABLES.find(([t]) => t === table)![1]
      const out: HiddenRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from(table).select(author ? `id, couple_id, ${author}` : 'id, couple_id')
          .not('deleted_at', 'is', null).lte('deleted_at', cutoffIso)
          .order('id', { ascending: true }).range(from, from + 999)
        must(`${table} 숨긴 행 조회`, error)
        const rows: Record<string, string | null>[] = data ?? []
        for (const r of rows) out.push({ id: r.id as string, coupleId: r.couple_id as string, authorId: author ? r[author] ?? null : null })
        if (rows.length < 1000) break
      }
      return out
    },
    async liveDateIds(dateIds) {
      const live = new Set<string>()
      const ids = uniq(dateIds)
      for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100)
        const { data: entries, error: e1 } = await client.from('data_entries').select('date_id').in('date_id', part).is('deleted_at', null)
        must('data_entries 조회', e1)
        const { data: stops, error: e2 } = await client.from('date_stops').select('date_id').in('date_id', part)
        must('date_stops 조회', e2)
        for (const r of [...(entries ?? []), ...(stops ?? [])] as { date_id: string }[]) live.add(r.date_id)
      }
      return [...live]
    },
    async deleteHidden(table, ids, cutoffIso) {
      if (ids.length === 0) return 0
      const { data, error } = await client.from(table).delete().in('id', [...ids])
        .not('deleted_at', 'is', null).lte('deleted_at', cutoffIso).select('id')
      must(`${table} 숨긴 행 삭제`, error)
      return Array.isArray(data) ? data.length : 0
    },
    async oldErrorRows(cutoffDay) {
      const { count, error } = await client.from('app_error_daily').select('day', { count: 'exact', head: true }).lt('day', cutoffDay)
      must('app_error_daily 조회', error)
      return count ?? 0
    },
    async deleteOldErrorRows(cutoffDay) {
      const { data, error } = await client.from('app_error_daily').delete().lt('day', cutoffDay).select('day')
      must('app_error_daily 삭제', error)
      return Array.isArray(data) ? data.length : 0
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
