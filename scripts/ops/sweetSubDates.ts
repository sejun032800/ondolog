/**
 * 51- ③ ⑤ 유성 날짜 계산용 출력 - 발행된 호의 다정한 말 **"한 줄 선택"(sub)들의 날짜만**(KST `YYYY-MM-DD`, 보낸 시각 순).
 * 위임: .claude/state/prompts/phase-7/51-3-dispatch-phone-couple-live.md · ROADMAP r143 R143-4 · R140-5
 *
 * 유성 후보 = 발행된 호의 sub만 · 7일 지난 말부터(`web/src/features/sky/meteorRules.ts` `MIN_AGE_MS`) - PE가 이 목록으로 확인 날짜를 센다.
 * **읽기만**(쓰기 0 · LLM 0). 출력에 원문 · 이름 · 호/커플/메시지 id 0 - 날짜와 개수뿐.
 * 확인: 개발 프로젝트(`connectOps`) · 시험 커플(별명 "test" - `assertTestCouple`) · 발행된 호(아니면 멈춤).
 *
 * 사용(저장소 맨 위 · `$iid`는 생성 결과 파일 이름에서 - HANDOFF "51- ③ 실행 명령"):
 *   deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY \
 *     --allow-net=$h --allow-read=supabase/.temp/linked-project.json scripts/ops/sweetSubDates.ts --issue-id $iid
 */

import { OpsStopError, assertTestCouple, redactSecrets } from './opsGuards.ts'
import type { CornerRow, IssueRow, OpsStore } from './opsStore.ts'

/** 저장 내용(`corners.content`)의 sub 날짜들(KST · 보낸 시각 순). 모양이 아닌 항목은 건너뛴다(지어내지 않음). */
export function sweetSubDays(content: unknown): string[] {
  const sub = (content as { payload?: { sub?: unknown } } | null)?.payload?.sub
  if (!Array.isArray(sub)) return []
  const times: number[] = []
  for (const s of sub) {
    const at = (s as { attribution?: { at?: unknown } } | null)?.attribution?.at
    const t = typeof at === 'string' ? Date.parse(at) : Number.NaN
    if (!Number.isNaN(t)) times.push(t)
  }
  return times.sort((a, b) => a - b).map((t) => new Date(t + 9 * 3_600_000).toISOString().slice(0, 10))
}

/** 출력 줄들(날짜 · 개수만). 발행 전 호 · 시험 커플이 아니면 멈춘다. */
export async function sweetSubDateLines(store: Pick<OpsStore, 'getIssue' | 'getCouple' | 'listCorners'>, issueId: string): Promise<string[]> {
  const issue: IssueRow | null = await store.getIssue(issueId)
  if (issue === null) throw new OpsStopError('호를 찾을 수 없다')
  const couple = await store.getCouple(issue.couple_id)
  if (couple === null) throw new OpsStopError('호의 커플을 읽을 수 없다')
  assertTestCouple(couple)
  if (issue.published_at === null) throw new OpsStopError('아직 발행되지 않은 호다 - 유성 후보는 발행된 호의 한 줄 선택뿐이다(발행 뒤에 다시)')
  const sweet: CornerRow | undefined = (await store.listCorners(issueId)).find((c) => c.corner_type === 'sweet_words')
  if (sweet === undefined || sweet.status !== 'published') return ['다정한 말 코너가 발행되지 않았다 - 한 줄 선택 0개 (유성 후보 0)']
  const days = sweetSubDays(sweet.content)
  return [`다정한 말 한 줄 선택 ${days.length}개 - 보낸 날(KST, 시각 순):`, ...days.map((d) => `  ${d}`)]
}

async function main(): Promise<void> {
  let secrets: readonly string[] = []
  try {
    const { parseFlags, requireFlag, CONNECTED_LINE } = await import('./opsCli.ts')
    const issueId = requireFlag(parseFlags(Deno.args, ['issue-id']), 'issue-id')
    const { connectOps } = await import('./supabaseOps.ts')
    const conn = await connectOps()
    secrets = [...conn.secrets, conn.projectRef, issueId]
    const say = (line: string) => console.log(redactSecrets(line, secrets))
    say(CONNECTED_LINE)
    for (const line of await sweetSubDateLines(conn.store, issueId)) say(line)
  } catch (error) {
    console.log(redactSecrets(`멈춤: ${error instanceof Error ? error.message : String(error)}`, secrets))
    Deno.exit(1)
  }
}

if (import.meta.main) void main()
