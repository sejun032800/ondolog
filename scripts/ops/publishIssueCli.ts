/**
 * 운영자 명령 2 - 발행. 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * `fn_publish_issue` 한 번. 정상 흐름에서는 조판(`55-`) 뒤에 부른다 - 이번에는 M2-e 실증에만 쓴다.
 * 함수를 부르기 전에 시험 커플·열린 경보·미디어 복제 완료를 확인한다(`publishIssue.ts`).
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-lock --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co \
 *     --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out \
 *     scripts/ops/publishIssueCli.ts --issue-id <uuid>
 */

import { parseFlags, printer, requireFlag, writeJson } from './opsCli.ts'
import { publishIssue } from './publishIssue.ts'
import { connectOps } from './supabaseOps.ts'

const flags = parseFlags(Deno.args, ['issue-id'])
const { store, media, secrets, projectRef } = await connectOps()
const say = printer(secrets)
say(`접속 대상: 개발 프로젝트 ondolog (${projectRef}) - 확인됨`)

const report = await publishIssue({ store, media }, requireFlag(flags, 'issue-id'))
say(`발행됨: 호 ${report.issueId} 번호 ${report.issue.issue_number} is_trial=${report.issue.is_trial} published_at=${report.issue.published_at} theme=${report.issue.theme}`)
say(`미디어: 새로 복제 ${report.media.copied} · 이미 있음 ${report.media.alreadyPresent}`)

const file = `scripts/ops/out/publish-${report.issueId}.json`
await writeJson(file, report, secrets)
say(`결과 파일: ${file}`)
