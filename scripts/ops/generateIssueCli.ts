/**
 * 운영자 명령 1 - 생성 (샘플 출력 모드). 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * P0 초안 행 -> 입력 조립 -> 코너 3종(샘플 응답, 기존 검증기) -> 저장 -> 미디어 복제. 결과는 로컬 파일로 남긴다.
 * **실제 API 호출 경로가 없다** - 실제 호출 모드를 여는 인수도 없다. 시험 커플(couples.nickname에 `test`)에만 돈다.
 *
 * 사용 (저장소 루트에서; 호스트는 ONDOLOG_SUPABASE_URL의 것 하나만 허용한다):
 *   deno run --no-lock --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co \
 *     --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out \
 *     scripts/ops/generateIssueCli.ts --couple-id <uuid> --period-start 2026-09-01 --period-end 2026-10-01 [--cadence monthly]
 * 기간은 `[start, end)` KST 반열린 구간이고 운영자가 넘긴다.
 */

import { generateSampleIssue } from './generateIssue.ts'
import { OpsStopError } from './opsGuards.ts'
import { parseFlags, printer, requireFlag, writeJson } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

const flags = parseFlags(Deno.args, ['couple-id', 'period-start', 'period-end', 'cadence'])
const cadence = flags.get('cadence') ?? 'monthly'
if (cadence !== 'monthly' && cadence !== 'daily') throw new OpsStopError(`--cadence는 monthly 또는 daily다 (${cadence})`)

const { store, media, secrets, projectRef } = await connectOps()
const say = printer(secrets)
say(`접속 대상: 개발 프로젝트 ondolog (${projectRef}) - 확인됨`)

const report = await generateSampleIssue(
  { store, media },
  {
    coupleId: requireFlag(flags, 'couple-id'),
    periodStart: requireFlag(flags, 'period-start'),
    periodEndExclusive: requireFlag(flags, 'period-end'),
    cadence,
  },
)

say(`호 ${report.issueId} (${report.issueCreated ? '새로 만듦' : '기존 초안 재사용'}) / 샘플 출력 모드 / 실제 API 호출 ${report.realApiCalls}회`)
say(`입력: 메시지 ${report.counts.messages} · 사진 ${report.counts.photos} · 데이트 ${report.counts.dates}`)
say(`제외 건수: ${JSON.stringify(report.exclusions)}`)
for (const c of report.corners) {
  say(`코너 ${c.cornerType}: ${c.outcome} (status=${c.status}${c.skipReason ? ', ' + c.skipReason : ''}) 추정 입력 토큰 ${c.estimatedInputTokens ?? '-'}`)
}
say(`미디어 복제: 새로 ${report.media.copied} · 이미 있음 ${report.media.alreadyPresent} · 원본 없음 ${report.media.missingSources.length}`)
if (report.alertIds.length > 0) say(`운영 경보 ${report.alertIds.length}건: ${report.alertIds.join(', ')}`)

const file = `scripts/ops/out/generate-${report.issueId}.json`
await writeJson(file, report, secrets)
say(`결과 파일: ${file}`)
