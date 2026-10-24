/**
 * 원격 개발 DB 실증 (`57-` B) - 작성자가 지운 사진은 발행 직전 원본 재확인에서 막힌다 (Deno 전용).
 * 위임: .claude/state/prompts/phase-7/57-corner-pipeline-deleted-entries.md 범위 7
 *
 * 렌더가 끝난 시험 호의 사진 하나를 **작성자의 사용자 세션으로 `fn_delete_own_entry` RPC를 불러** 지운다
 * (anon 키 + 로그인. service_role로 `deleted_at`을 직접 쓰지 않는다). 저장소 원본 파일은 남는다.
 * 그 다음 실제 발행 명령(`publishIssue`)을 부른다.
 * 기대: 발행 거부("다시 준비 중") · 그 사진을 실은 코너 `pending` + `last_error = 'source_media_missing'` ·
 * 호의 렌더 세 필드가 빈 값 · 호 미발행.
 *
 * - 지운 표시는 되돌리지 않는다(RPC에는 되돌림이 없고, 되돌리려고 service_role로 쓰지도 않는다). 시험 호의 사진 한 장이 소모된다.
 * - service_role은 계정 세션 발급(매직링크)과 전후 상태 읽기, 발행 명령의 코너·렌더 필드 되돌림(명령이 하는 일)에만 쓴다.
 * - 시험 커플이 아니면 멈춘다. 이미 발행된 호는 멈춘다. `--published-issue-id`를 주면 그 발행된 호의 코너 content 지문을
 *   전후로 찍어 바뀌지 않았음을 보인다(읽기만).
 * - 키 값은 어디에도 나오지 않는다(printer·writeJson이 redact).
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-lock --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co \
 *     --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out \
 *     scripts/ops/verifyDeletedEntryGuard.ts --issue-id <uuid> [--published-issue-id <uuid>]
 */

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { ENTRIES_BUCKET, parseMagazineMediaPath } from '../../supabase/functions/_shared/mediaPath.ts'
import { mediaPathsOf } from './mediaCopy.ts'
import { OpsStopError, assertTestCouple } from './opsGuards.ts'
import { parseFlags, printer, requireFlag } from './opsCli.ts'
import { isRendered, publishIssue } from './publishIssue.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const flags = parseFlags(Deno.args, ['issue-id', 'published-issue-id'])
const issueId = requireFlag(flags, 'issue-id')
const publishedIssueId = flags.get('published-issue-id') ?? null

const { client, store, media, secrets, projectRef } = await connectOps()
const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
const anon = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
if (!anon) throw new OpsStopError('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
const out: string[] = []
const printed = printer([...secrets, anon])
const say = (line: string) => {
  out.push(line)
  printed(line)
}
say(`접속 대상: 개발 프로젝트 ondolog (${projectRef}) - 확인됨`)

async function state(label: string): Promise<void> {
  const issue = await store.getIssue(issueId)
  const corners = await store.listCorners(issueId)
  say(`--- ${label} ---`)
  say(`issues: published_at=${issue?.published_at} pdf_digital_path=${issue?.pdf_digital_path} page_count=${issue?.page_count} cover_path=${issue?.cover_path}`)
  for (const c of corners) say(`corners: ${c.corner_type} status=${c.status} last_error=${c.last_error}`)
}

async function fingerprint(id: string): Promise<string> {
  const issue = await store.getIssue(id)
  const corners = await store.listCorners(id)
  const text = JSON.stringify({ issue, corners })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const issue = await store.getIssue(issueId)
if (issue === null) throw new OpsStopError(`없는 호다 (${issueId})`)
const couple = await store.getCouple(issue.couple_id)
if (couple === null) throw new OpsStopError(`호의 커플이 없다 (${issue.couple_id})`)
assertTestCouple(couple)
if (issue.published_at !== null) throw new OpsStopError('이미 발행된 호다 - 발행된 호는 바꾸지 않는다')
if (!isRendered(issue)) throw new OpsStopError('렌더된 호에서만 이 실증을 한다 - 먼저 렌더한다')

const corners = await store.listCorners(issueId)
const photoPath = corners.filter((c) => c.status === 'ready').flatMap((c) => mediaPathsOf(c.corner_type, c.content))[0]
const entryId = photoPath === undefined ? null : parseMagazineMediaPath(photoPath)?.entryId
if (entryId === null || entryId === undefined) throw new OpsStopError('content에 실린 사진이 없다')

const { data: entry, error: entryError } = await client
  .from('data_entries')
  .select('id, author_id, storage_path, deleted_at, couple_id')
  .eq('id', entryId)
  .single()
if (entryError) throw new Error(`data_entries 읽기 실패: ${entryError.message}`)
if (entry.couple_id !== issue.couple_id) throw new OpsStopError('항목이 이 호의 커플 것이 아니다')
if (entry.deleted_at !== null) throw new OpsStopError('이미 지워진 항목이다 - 다른 호를 쓴다')

const publishedBefore = publishedIssueId === null ? null : await fingerprint(publishedIssueId)

await state('전: 렌더된 호')
say(`시험 호: ${issueId} (커플 ${issue.couple_id})`)
say(`지울 사진 항목: ${entryId} (목적지 ${photoPath}) 작성자 ${entry.author_id}`)

// 작성자 세션: 이메일을 읽어 매직링크 토큰을 사용자 세션으로 바꾼다(비밀번호 없음).
const { data: authorUser, error: authorError } = await client.auth.admin.getUserById(entry.author_id)
if (authorError || !authorUser?.user?.email) throw new Error(`작성자 계정을 읽지 못했다: ${authorError?.message ?? '이메일 없음'}`)
const email = authorUser.user.email as string
if (!email.startsWith('test-')) throw new OpsStopError('작성자 계정이 시험 계정(test-)이 아니다')
const link = await client.auth.admin.generateLink({ type: 'magiclink', email })
if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
const authorDb: Db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
const verified = await authorDb.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
say(`작성자 세션: ${email} (사용자 세션, anon 키)`)

const rpc = await authorDb.rpc('fn_delete_own_entry', { p_entry_id: entryId })
say(`RPC fn_delete_own_entry 결과: error=${rpc.error?.message ?? null} data=${JSON.stringify(rpc.data)}`)
if (rpc.error || rpc.data !== true) throw new Error('작성자 삭제 RPC가 성공하지 않았다 - 이후 단계는 의미가 없다')

const { data: after } = await client.from('data_entries').select('id, deleted_at, storage_path').eq('id', entryId).single()
say(`data_entries ${entryId}: deleted_at=${after?.deleted_at}`)
const fileStillThere = await media.exists(ENTRIES_BUCKET, after.storage_path)
say(`저장소 원본 파일(${ENTRIES_BUCKET}/${after.storage_path}) 존재: ${fileStillThere}`)

try {
  await publishIssue({ store, media }, issueId)
  say('발행 명령 결과: 거부되지 않았다 (기대와 다름)')
} catch (error) {
  say(`발행 명령 결과: 거부됨 - ${error instanceof Error ? error.message : String(error)}`)
}
await state('후: 작성자 삭제 뒤 발행 시도')
say(`저장소 원본 파일 존재(발행 시도 뒤): ${await media.exists(ENTRIES_BUCKET, after.storage_path)}`)

if (publishedIssueId !== null && publishedBefore !== null) {
  const publishedAfter = await fingerprint(publishedIssueId)
  say(`발행된 호 ${publishedIssueId} 지문 전: ${publishedBefore}`)
  say(`발행된 호 ${publishedIssueId} 지문 후: ${publishedAfter} (${publishedBefore === publishedAfter ? '같음' : '다름'})`)
}

await Deno.mkdir('scripts/ops/out', { recursive: true })
await Deno.writeTextFile('scripts/ops/out/57-b-deleted-entry-guard.txt', out.join('\n') + '\n')
