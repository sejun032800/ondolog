/**
 * 원격 개발 DB 실증 (M2-e) - 발행 확정 함수와 테마 복사 트리거 (Deno 전용, service_role).
 * 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md 범위 B / SCHEMA §9-D-9의 C를 대체한다.
 *
 * 하위 명령 (출력은 그대로 보고에 붙인다. 키 값은 어디에도 나오지 않는다):
 *   snapshot   --issue-id <uuid>     그 호와 관련 행(코너·그 커플의 데이트·경보)을 읽어 JSON으로 찍는다
 *   exceptions --ids <json>          예외 5종 - 함수를 **직접** 불러(발행 명령의 사전 확인을 거치지 않고) 거부와 "아무것도 바뀌지 않음"을 보인다
 *   concurrent --issue-ids a,b       같은 커플의 두 호를 동시에 발행 -> 번호 1·2
 *   theme      --issue-id <uuid>     발행된 호의 theme를 바꾸면 예외인가
 * `exceptions`의 --ids: {"inactive":"<호>","published":"<호>","openAlert":"<호>","noReady":"<호>"}
 *
 * 쓰기: `fn_publish_issue` 호출(정상·동시)과 `issues.theme` 변경 시도(예외 기대)뿐이다. 시험 커플의 시험 호에만 부른다.
 */

import { OpsStopError } from './opsGuards.ts'
import { parseFlags, printer, requireFlag } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

const [command, ...rest] = Deno.args
const { client, secrets, projectRef } = await connectOps()
const say = printer(secrets)
say(`접속 대상: 개발 프로젝트 ondolog (${projectRef}) - 확인됨`)

// deno-lint-ignore no-explicit-any
type Json = any

async function snapshot(issueId: string): Promise<Json> {
  const issue = await client.from('issues').select('*').eq('id', issueId).maybeSingle()
  if (issue.error) throw new Error(`issues 조회 실패: ${issue.error.message}`)
  if (issue.data === null) return { issue: null }
  const coupleId = issue.data.couple_id
  const corners = await client
    .from('corners')
    .select('id, corner_type, status, source_date_ids, updated_at')
    .eq('issue_id', issueId)
    .order('seq')
  const dates = await client
    .from('dates')
    .select('id, date_on, last_featured_at, feature_count, updated_at')
    .eq('couple_id', coupleId)
    .order('date_on')
  const alerts = await client.from('ops_alerts').select('id, kind, resolved_at').eq('issue_id', issueId).order('id')
  const couple = await client.from('couples').select('id, status, magazine_theme').eq('id', coupleId).maybeSingle()
  for (const r of [corners, dates, alerts, couple]) if (r.error) throw new Error(`조회 실패: ${r.error.message}`)
  return { issue: issue.data, couple: couple.data, corners: corners.data, dates: dates.data, alerts: alerts.data }
}

async function callPublish(issueId: string): Promise<string | null> {
  const { error } = await client.rpc('fn_publish_issue', { p_issue_id: issueId })
  return error ? error.message : null
}

if (command === 'snapshot') {
  const flags = parseFlags(rest, ['issue-id'])
  say(JSON.stringify(await snapshot(requireFlag(flags, 'issue-id')), null, 2))
} else if (command === 'exceptions') {
  const flags = parseFlags(rest, ['ids'])
  const ids = JSON.parse(requireFlag(flags, 'ids')) as Record<string, string>
  const cases: [string, string, string][] = [
    ['1. 없는 호', 'notFound', crypto.randomUUID()],
    ['2. 커플 비활성(dissolving)', 'inactive', ids.inactive],
    ['3. 이미 발행', 'published', ids.published],
    ['4. 열린 경보', 'openAlert', ids.openAlert],
    ['5. ready 코너 없음', 'noReady', ids.noReady],
  ]
  for (const [label, _key, issueId] of cases) {
    const before = await snapshot(issueId)
    const error = await callPublish(issueId)
    const after = await snapshot(issueId)
    say(`=== ${label} (호 ${issueId}) ===`)
    say(`거부 메시지: ${error}`)
    say(`거부됨: ${error !== null}`)
    say(`호출 전후 관련 행 동일: ${JSON.stringify(before) === JSON.stringify(after)}`)
    say(`호출 전 == 호출 후:\n${JSON.stringify(after, null, 2)}`)
  }
} else if (command === 'concurrent') {
  const flags = parseFlags(rest, ['issue-ids'])
  const [a, b] = requireFlag(flags, 'issue-ids').split(',')
  say(`동시 발행 전: ${JSON.stringify([(await snapshot(a)).issue?.published_at, (await snapshot(b)).issue?.published_at])}`)
  const results = await Promise.all([callPublish(a), callPublish(b)])
  say(`두 호출의 오류: ${JSON.stringify(results)}`)
  for (const id of [a, b]) {
    const s = await snapshot(id)
    say(`호 ${id}: issue_number=${s.issue.issue_number} is_trial=${s.issue.is_trial} published_at=${s.issue.published_at} theme=${s.issue.theme}`)
    say(`  코너: ${JSON.stringify(s.corners.map((c: Json) => [c.corner_type, c.status]))}`)
  }
  const s = await snapshot(a)
  say(`데이트: ${JSON.stringify(s.dates)}`)
} else if (command === 'theme') {
  const flags = parseFlags(rest, ['issue-id'])
  const issueId = requireFlag(flags, 'issue-id')
  const before = (await snapshot(issueId)).issue
  const { error } = await client.from('issues').update({ theme: before.theme === 'basic' ? 'night' : 'basic' }).eq('id', issueId)
  const after = (await snapshot(issueId)).issue
  say(`발행된 호 ${issueId}의 theme 변경 시도: 전 ${before.theme}`)
  say(`예외: ${error?.message ?? '(예외 없음 - 변경됨)'}`)
  say(`후 ${after.theme} / 변경 안 됨: ${before.theme === after.theme}`)
} else {
  throw new OpsStopError('사용: snapshot | exceptions | concurrent | theme')
}
