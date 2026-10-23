/**
 * 원격 개발 DB 실증 (55-1) - 발행 직전 원본 재확인(R21-2)과 발행 가드 ② (Deno 전용, service_role).
 * 위임: .claude/state/prompts/phase-7/55-1-corner-pipeline-render-plumbing.md 범위 5·6
 *
 * 렌더가 끝난 시험 호의 **사진 원본 하나를 지운 것으로 만든 채**(`data_entries.deleted_at`) 실제 발행 명령(`publishIssue`)을 부른다.
 * 기대: 발행 거부("다시 준비 중") · 그 사진을 실은 코너 `pending` + `last_error = 'source_media_missing'` ·
 * 호의 렌더 세 필드가 빈 값 · 호 미발행. 부른 뒤 **지운 표시를 반드시 되돌린다**(`finally`) - 원본 파일은 건드리지 않는다.
 *
 * 쓰기: 시험 커플의 사진 항목 한 건의 `deleted_at`(되돌림), 코너 `pending` 되돌림·렌더 필드 비움(발행 명령이 하는 일).
 * 시험 커플이 아니면 멈춘다. 출력은 그대로 보고에 붙인다. 키 값은 어디에도 나오지 않는다.
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-lock --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=<프로젝트 ref>.supabase.co \
 *     --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out \
 *     scripts/ops/verifyRenderGuards.ts --issue-id <uuid>
 */

import { parseMagazineMediaPath } from '../../supabase/functions/_shared/mediaPath.ts'
import { mediaPathsOf } from './mediaCopy.ts'
import { OpsStopError, assertTestCouple } from './opsGuards.ts'
import { parseFlags, printer, requireFlag } from './opsCli.ts'
import { isRendered, publishIssue } from './publishIssue.ts'
import { connectOps } from './supabaseOps.ts'

const flags = parseFlags(Deno.args, ['issue-id'])
const issueId = requireFlag(flags, 'issue-id')
const { client, store, media, secrets, projectRef } = await connectOps()
const say = printer(secrets)
say(`접속 대상: 개발 프로젝트 ondolog (${projectRef}) - 확인됨`)

async function state(label: string): Promise<void> {
  const issue = await store.getIssue(issueId)
  const corners = await store.listCorners(issueId)
  say(`--- ${label} ---`)
  say(`issues: published_at=${issue?.published_at} pdf_digital_path=${issue?.pdf_digital_path} page_count=${issue?.page_count} cover_path=${issue?.cover_path}`)
  for (const c of corners) say(`corners: ${c.corner_type} status=${c.status} last_error=${c.last_error}`)
}

const issue = await store.getIssue(issueId)
if (issue === null) throw new OpsStopError(`없는 호다 (${issueId})`)
const couple = await store.getCouple(issue.couple_id)
if (couple === null) throw new OpsStopError(`호의 커플이 없다 (${issue.couple_id})`)
assertTestCouple(couple)
if (issue.published_at !== null) throw new OpsStopError('이미 발행된 호다')
if (!isRendered(issue)) throw new OpsStopError('렌더된 호에서만 이 실증을 한다 - 먼저 렌더한다')

const corners = await store.listCorners(issueId)
const photoPath = corners.filter((c) => c.status === 'ready').flatMap((c) => mediaPathsOf(c.corner_type, c.content))[0]
const entryId = photoPath === undefined ? null : parseMagazineMediaPath(photoPath)?.entryId
if (entryId === null || entryId === undefined) throw new OpsStopError('content에 실린 사진이 없다')

await state('전: 렌더된 호')
say(`지운 것으로 만들 사진 항목: ${entryId} (목적지 ${photoPath})`)

const mark = await client.from('data_entries').update({ deleted_at: new Date().toISOString() }).eq('id', entryId).eq('couple_id', issue.couple_id)
if (mark.error) throw new Error(`data_entries 표시 실패: ${mark.error.message}`)

try {
  try {
    await publishIssue({ store, media }, issueId)
    say('발행 명령 결과: 거부되지 않았다 (기대와 다름)')
  } catch (error) {
    say(`발행 명령 결과: 거부됨 - ${error instanceof Error ? error.message : String(error)}`)
  }
  await state('후: 원본 하나 삭제 뒤 발행 시도')
} finally {
  const restore = await client.from('data_entries').update({ deleted_at: null }).eq('id', entryId).eq('couple_id', issue.couple_id)
  say(restore.error ? `되돌리기 실패: ${restore.error.message}` : `data_entries ${entryId} deleted_at 되돌림 - 원본 파일은 건드리지 않았다`)
}
