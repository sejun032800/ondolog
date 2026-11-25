/**
 * 운영자 명령 1 - 생성. 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 * + .claude/state/prompts/phase-7/84-a-dispatch-llm-safety.md (실제 모드 인수, ROADMAP r124 R124-4)
 *
 * P0 초안 행 -> 입력 조립 -> 코너 3종(기존 검증기) -> 저장 -> 미디어 복제. 결과는 로컬 파일로 남긴다.
 * - **기본은 샘플 출력 모드**(실제 API 호출 0). `--mode live`일 때만 실제 LLM을 부른다.
 * - 어느 모드든 시험 커플(couples.nickname에 `test`)에만 돈다 - 가드는 `generateIssue.ts`가 먼저 본다.
 * - 실제 모드: 모델은 `app_config.llm_provider`(허용 목록 안일 때만 - fail-closed), 키는 환경변수 `ONDOLOG_LLM_API_KEY`에서만.
 *   키 값은 화면 · 파일 어디에도 쓰지 않는다(출력은 지울 값 목록을 거친다).
 *
 * 사용 (저장소 루트에서; 호스트는 ONDOLOG_SUPABASE_URL의 것 하나만 허용한다):
 *   샘플:
 *   deno run --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY \
 *     --allow-net=$h \
 *     --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out \
 *     scripts/ops/generateIssueCli.ts --couple-id <uuid> --period-start 2026-09-01 --period-end 2026-10-01 [--cadence monthly]
 *   실제(84-a): 위에 `--allow-env`에 `ONDOLOG_LLM_API_KEY` · `--allow-net`에 `api.anthropic.com`을 더하고 `--mode live`.
 *   84-f(R141-2): 실제 모드는 `--allow-read`에 `scripts/ops/out`도 더한다 - 로컬 시드 목록(`seed-m2b*.json`)의 커플 id만 대상으로 받는다
 *   (못 읽으면 목록이 비어 실제 모드는 멈춘다 - fail-closed).
 *   2.0-A1(m20-a1): `--unstable-sloppy-imports`가 **필요하다** - 생성이 `src/engine/`의 2.0 엔진(채팅 지표 · 두 사람의 결 · 어림짐작 · 부록)을
 *   부르고 그 파일들은 확장자 없는 import를 쓴다(`resetTestAccount.ts` · `purgeWithdrawn.ts`와 같은 실행 꼴). 빠뜨리면 실행 전에 Deno가 멈춘다.
 * 기간은 `[start, end)` KST 반열린 구간이고 운영자가 넘긴다.
 *
 * 51- ③(R141-3 · R143-4) 두 폰 커플 길 - `--allow-phone-test-couple`(값 없는 플래그). `--couple-id`는 주지 않는다(허용 목록으로 찾는다).
 *   `--allow-env`에 `ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME` · `--allow-read`에 저장소 밖 75- 허용 목록 파일(`$al`)을 더한다.
 *   - 미리 보기: `--allow-phone-test-couple --dry-run`(`--mode` · 기간 · LLM 키 없이) - 쓰기 0 · LLM 0 · 날짜별 개수와 선행 검사만
 *   - 생성: `--allow-phone-test-couple --mode live --period-start … --period-end …`
 *   두 겹 잠금(`phoneTestCouple.ts`): 허용 목록 · 개발 프로젝트 확인은 접속 전, 대상 커플 찾기는 접속 뒤 읽기만 - 모두 DB 쓰기 · LLM 전.
 */

import { createLlmClient } from '../../supabase/functions/_shared/llmClient.ts'
import { generateIssue, type LiveDeps } from './generateIssue.ts'
import { OpsStopError, isSeedListFile, seedListCoupleIds } from './opsGuards.ts'
import { CONNECTED_LINE, parseFlags, printer, requireFlag, writeJson } from './opsCli.ts'
import { DRY_RUN_FLAG, PHONE_TEST_COUPLE_FLAG, phoneAllowlistEmails, phoneRunKind, resolvePhoneTestCouple, splitSwitches } from './phoneTestCouple.ts'
import { previewPhoneCouple } from './phonePreview.ts'
import { phoneCouplePort, previewPort } from './phoneOpsAdapter.ts'
import { resolveAllowlistPath } from './resetAllowlist.ts'
import { connectOps } from './supabaseOps.ts'

const switches = splitSwitches(Deno.args, [PHONE_TEST_COUPLE_FLAG, DRY_RUN_FLAG])
const flags = parseFlags(switches.rest, ['couple-id', 'period-start', 'period-end', 'cadence', 'mode'])
const cadence = flags.get('cadence') ?? 'monthly'
if (cadence !== 'monthly' && cadence !== 'daily') throw new OpsStopError(`--cadence는 monthly 또는 daily다 (${cadence})`)
// 51- ③: 플래그 조합 - 접속 전(네트워크 0).
const runKind = phoneRunKind({
  allowPhone: switches.on.has(PHONE_TEST_COUPLE_FLAG),
  dryRun: switches.on.has(DRY_RUN_FLAG),
  mode: flags.get('mode'),
  hasCoupleId: flags.has('couple-id'),
})
const mode = runKind === 'phone_dry_run' ? 'sample' : flags.get('mode') ?? 'sample'
if (mode !== 'sample' && mode !== 'live') throw new OpsStopError(`--mode는 sample 또는 live다 (${mode})`)

/** 75- 0-6 허용 목록 본문(읽기만). 경로를 모르거나 · 없거나 · 권한이 없으면 null(-> 멈춤). 경로는 출력하지 않는다. */
async function readAllowlistText(): Promise<string | null> {
  const env = (name: string) => {
    try {
      return Deno.env.get(name)
    } catch {
      return undefined
    }
  }
  const path = resolveAllowlistPath(env)
  if (path === null) return null
  try {
    return await Deno.readTextFile(path)
  } catch {
    return null
  }
}

// 51- ③ 두 겹 잠금 (가) 앞 절반 - 허용 목록 · 개발 프로젝트 표시. 접속 전.
const phoneEmails = runKind === 'seed' ? null : phoneAllowlistEmails(await readAllowlistText(), Deno.env.get('ONDOLOG_SUPABASE_URL'))

// 실제 모드의 키 - 연결 전에 확인한다(없으면 아무것도 하지 않고 멈춤).
let apiKey: string | null = null
if (mode === 'live') {
  apiKey = Deno.env.get('ONDOLOG_LLM_API_KEY') ?? null
  if (apiKey === null || apiKey.length === 0) throw new OpsStopError('실제 모드: 환경변수 ONDOLOG_LLM_API_KEY가 없다')
}

const { client, store, media, secrets, projectRef } = await connectOps()
// A-27: ref는 출력하지 않는다 - 확인 줄에 넣지 않고, 지울 값 목록에도 더한다.
const hidden = [...secrets, projectRef]
if (apiKey !== null) hidden.push(apiKey) // 84-a: 실제 모드 키도 지울 값 목록에
if (phoneEmails !== null) hidden.push(...phoneEmails) // 51- ③: 허용 목록 이메일도 지울 값 목록에
const say = printer(hidden)
say(CONNECTED_LINE)

// 51- ③ 두 겹 잠금 (가) 뒤 절반 - 두 계정이 모두 허용 목록인 커플 정확히 하나(읽기만). 찾은 id는 출력하지 않는다.
const phoneTestCoupleId = phoneEmails === null ? null : await resolvePhoneTestCouple(phoneCouplePort(client), phoneEmails)
// 찾은 커플 id는 어느 화면 줄에도 넣지 않는다(미리 보기 · 결과 줄은 개수 · 호 id만). 로컬 결과 파일(git 밖)은 84-f와 같은 모양.
if (phoneTestCoupleId !== null) {
  say('두 폰 커플 길(51- ③): 허용 목록 계정 두 명의 커플 1개 - 확인됨 (id는 출력하지 않는다)')
}
if (runKind === 'phone_dry_run') {
  for (const line of await previewPhoneCouple(store, previewPort(client), phoneTestCoupleId as string)) say(line)
  Deno.exit(0)
}

/** 84-f: 로컬 시드 목록 파일들(`scripts/ops/out/seed-m2b*.json`)을 읽는다. 읽을 수 없으면 빈 목록(실제 모드 멈춤). */
async function readSeedLists(): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = []
  try {
    for await (const e of Deno.readDir('scripts/ops/out')) {
      if (e.isFile && isSeedListFile(e.name)) out.push({ name: e.name, text: await Deno.readTextFile(`scripts/ops/out/${e.name}`) })
    }
  } catch {
    return []
  }
  return out
}

const live: LiveDeps | undefined =
  apiKey === null
    ? undefined
    : {
        now: () => Date.now(),
        seedCoupleIds: seedListCoupleIds(await readSeedLists()),
        phoneTestCoupleId,
        createClient: (config) =>
          createLlmClient({ apiKey: apiKey as string, model: config.model, beforeAttempt: config.beforeAttempt, onResponse: config.onResponse }),
      }

const report = await generateIssue(
  { store, media, live },
  {
    coupleId: phoneTestCoupleId ?? requireFlag(flags, 'couple-id'),
    periodStart: requireFlag(flags, 'period-start'),
    periodEndExclusive: requireFlag(flags, 'period-end'),
    cadence,
    mode,
  },
)

say(
  `호 ${report.issueId} (${report.issueCreated ? '새로 만듦' : '기존 초안 재사용'}) / ${report.mode === 'live' ? `실제 모드 (${report.model})` : '샘플 출력 모드'} / 실제 API 호출 ${report.realApiCalls}회 / 비용 $${report.costUsd.toFixed(4)}`,
)
say(`입력: 메시지 ${report.counts.messages} · 사진 ${report.counts.photos} · 데이트 ${report.counts.dates}`)
say(`제외 건수: ${JSON.stringify(report.exclusions)}`)
for (const c of report.corners) {
  say(`코너 ${c.cornerType}: ${c.outcome} (status=${c.status}${c.skipReason ? ', ' + c.skipReason : ''}) 추정 입력 토큰 ${c.estimatedInputTokens ?? '-'} · 실제 호출 ${c.realApiCalls}`)
}
say(`미디어 복제: 새로 ${report.media.copied} · 이미 있음 ${report.media.alreadyPresent} · 원본 없음 ${report.media.missingSources.length}`)
if (report.alertIds.length > 0) say(`운영 경보 ${report.alertIds.length}건: ${report.alertIds.join(', ')}`)

const file = `scripts/ops/out/generate-${report.issueId}.json`
await writeJson(file, report, hidden)
say(`결과 파일: ${file}`)
