/**
 * M1 품질 실측 하네스 (Deno) - 코너 3종의 실제 모델 출력을 모아 사람이 읽고 판정할 자료를 만든다.
 * 위임: .claude/state/prompts/phase-7/50-corner-pipeline-m1-quality-harness.md
 *
 * 하는 일: 합성 데이터셋 -> 기존 입력 조립 -> 기존 `runCornerModule`(골격 그대로) -> `llmClient` 동기 호출.
 * 하지 않는 일: 코너·프롬프트·골격 수정, app_config 변경, DB 접속. 모델은 실행 인자로 받는다.
 *
 * API 키: 환경변수 `ONDOLOG_LLM_API_KEY`에서만 읽는다(MASTER r58 §17-0-10-H). 파일·로그·산출물 어디에도
 * 쓰지 않는다 - 저장하는 모든 텍스트에서 키 값을 지우고(redact) 저장한다. 요청 헤더는 저장하지 않는다.
 *
 * 84-a 안전장치(ROADMAP r124 R124-2 · R124-3 · R124-6, 위임 `84-a-dispatch-llm-safety.md`):
 * - `--model`은 허용 목록(`llmSafety.ts` `ALLOWED_LLM_MODELS`)만 - 밖이면 **키를 읽기 전에** 멈춘다(호출 0).
 * - 호출 1번 120초 · `max_tokens` 16,000은 `llmClient` 기본값. 코너 1회 실행 8분. 샘플링 값은 보내지 않는다(84-a2 · R131-1).
 *
 * 84-a2(ROADMAP r131 R131-2): 기록하는 호출 수 = **실제로 보낸 HTTP 요청 수**(`httpCalls.length`) - 화면 · runs json ·
 * review · summary 모두 같은 수. 오류 본문은 `error.type` · `error.message`만 저장한다(요청 id 0). review 말투 칸 = "합니다체 밖".
 * - 비용: 실행 전체 **$10** - 다음 호출 전에 "지금까지 + 이번 최악(입력 추정 상한 + 출력 max_tokens)"이 넘으면 부르지 않는다.
 * - review.md: R124-6 판정 칸(반드시 0 · 허용 · 집계) - 하네스는 셀 수 있는 것(코너 빠짐 · R19-2 위반 · 비용)만 채운다.
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-lock --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com \
 *     --allow-read=. --allow-write=scripts/ops/out \
 *     scripts/ops/m1QualityRun.ts run --model <모델ID> [--corner all|date_archive|sweet_words|this_month] \
 *       [--runs 3] [--max-tokens 16000] [--tag <실행 이름>]
 *   deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out \
 *     scripts/ops/m1QualityRun.ts dry          # 입력 조립만(네트워크·키 불필요)
 *   deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out \
 *     scripts/ops/m1QualityRun.ts review       # out/runs/*.json -> out/review.md, out/summary.md
 *   deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out \
 *     scripts/ops/m1QualityRun.ts recheck      # 84-c: out/runs/*.json의 모든 시도를 새 내용 검사로 -> out/recheck.md (네트워크 · 키 0)
 *
 * 84-c(R133-5): 합성 데이터셋 연도는 `FIXTURE_YEAR`(2025). 실행 json에 `fixtureYear`를 남긴다 - `recheck`가 같은 입력을 다시 만든다.
 */

import type { AssembledInput } from '../../supabase/functions/_shared/inputAssembly.ts'
import {
  processCornerResponse,
  runCornerModule,
  type CornerContext,
  type CornerModule,
} from '../../supabase/functions/_shared/cornerPipeline.ts'
import { INPUT_TOKEN_STOP_BAND, INPUT_TOKEN_STOP_LIMIT, estimateRequestTokens } from '../../supabase/functions/_shared/tokenEstimate.ts'
import { createLlmClient, extractResponseText, summarizeErrorBody, type LlmClient } from '../../supabase/functions/_shared/llmClient.ts'
import {
  CORNER_TIME_LIMIT_MS,
  CostMeter,
  HARNESS_BUDGET_USD,
  LLM_MAX_TOKENS,
  SAFETY_STOP,
  callBudgetMs,
  formatUsd,
  resolveHarnessModel,
  usageCostUsd,
  worstCallCostUsd,
  type Deadline,
} from '../../src/engine/corners/llmSafety.ts'
import type { LlmRequest } from '../../supabase/functions/_shared/llmRequest.ts'
import { assembleFixture, recheckRecords, renderRecheck } from './m1Recheck.ts'
import { CORNERS, renderReview, safeName, sentCalls, type AttemptRecord, type CornerKey, type HttpCall, type RunRecord, type Usage } from './m1Review.ts'
import { dateArchiveModule } from '../../supabase/functions/_shared/corners/dateArchive.ts'
import { sweetWordsModule } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import { thisMonthModule } from '../../supabase/functions/_shared/corners/thisMonth.ts'
import { COUPLE_ID, FIXTURE_YEAR, PERIOD } from './fixtures/m1-month/dataset.ts'
import {
  CAP_CANDIDATES,
  SELECT_CANDIDATES,
  estimateTokens,
  findCandidate,
  statsOf,
  type Candidate,
} from './m1InputCandidates.ts'

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const OUT_DIR = 'scripts/ops/out'
const RUNS_DIR = `${OUT_DIR}/runs`

const CONTEXT: CornerContext = { coupleId: COUPLE_ID, period: PERIOD, cadence: 'monthly' }


/** R19-2: 재소환 데이트를 대표 화보로 고른 시도 - `dateArchive.ts` 파생값 단계의 실패 문구(이 문구로 센다). */
const R19_2_MARK = '재소환 데이트가 대표 화보로 선택됐다'

// 저장 형식(`HttpCall` · `RunRecord` 등)과 review 만들기는 `m1Review.ts`(84-a2).

// ---------------------------------------------------------------------------
// 도구
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { cmd: string; flags: Map<string, string> } {
  const [cmd = '', ...rest] = argv
  const flags = new Map<string, string>()
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]
    const value = rest[i + 1]
    if (!key.startsWith('--') || value === undefined) throw new Error(`인자 형식 오류: ${key}`)
    flags.set(key.slice(2), value)
  }
  return { cmd, flags }
}

function readKey(): string {
  const key = Deno.env.get('ONDOLOG_LLM_API_KEY')
  if (key === undefined || key.length === 0) {
    throw new Error('환경변수 ONDOLOG_LLM_API_KEY가 없다')
  }
  return key
}

/** 저장 직전 마지막 방어선 - 키 값이 문자열 어디에 섞여도 지운다. */
function makeRedactor(key: string): (s: string) => string {
  return (s) => (key.length > 0 ? s.split(key).join('[REDACTED]') : s)
}

function corners(): Record<CornerKey, { module: CornerModule<any, any, any>; input: (a: AssembledInput) => unknown }> {
  return {
    date_archive: { module: dateArchiveModule, input: (a) => ({ dates: a.dates }) },
    sweet_words: { module: sweetWordsModule, input: (a) => ({ warmthIndex: null, messages: a.messages }) },
    this_month: {
      module: thisMonthModule,
      input: (a) => ({ messages: a.messages, photos: a.photos, dates: a.dates }),
    },
  }
}

async function assemble(): Promise<AssembledInput> {
  // 호 ID는 합성 값이다 - 사진 경로가 목적지 경로(§17-0-10-D) 모양을 갖게 하려는 것뿐이고 DB에 쓰지 않는다(`54-`).
  // 84-c: 조립은 `m1Recheck.ts`와 같은 함수(데이터 연도 `FIXTURE_YEAR`).
  return await assembleFixture(FIXTURE_YEAR)
}

function requestText(req: LlmRequest): string {
  return [
    '--- system ---',
    ...req.system.map((b) => b.text + (b.cacheBreakpoint ? '\n[cache breakpoint]' : '')),
    '--- user ---',
    ...req.user.map((b) => b.text + (b.cacheBreakpoint ? '\n[cache breakpoint]' : '')),
  ].join('\n\n')
}

// ---------------------------------------------------------------------------
// dry: 입력 조립만
// ---------------------------------------------------------------------------

async function dry(flags: Map<string, string>): Promise<void> {
  if (flags.has('cap') || flags.has('select')) {
    await dryCandidates(flags)
    return
  }
  const assembled = await assemble()
  const table = corners()
  console.log(`messages=${assembled.messages.length} photos=${assembled.photos.length} dates=${assembled.dates.length}`)
  console.log(
    `dates: ${assembled.dates.map((d) => `${d.source.dateOn}${d.recalled ? '(recalled:' + d.source.recallReason + ')' : ''}`).join(', ')}`,
  )
  console.log(`exclusions: ${JSON.stringify(assembled.exclusions)}`)
  await Deno.mkdir(OUT_DIR, { recursive: true })
  for (const key of CORNERS) {
    const { module, input } = table[key]
    const inp = input(assembled)
    const req = module.buildRequest(inp, CONTEXT)
    const text = requestText(req)
    await Deno.writeTextFile(`${OUT_DIR}/request-${key}.txt`, text)
    // 안전 정지(52r2-): 운영 경로와 같은 추정·상한. `run`은 골격을 거치므로 같은 정지를 받는다.
    const tokens = estimateRequestTokens(req, INPUT_TOKEN_STOP_BAND)
    const band = `${estimateRequestTokens(req, 'low')}~${estimateRequestTokens(req, 'high')}`
    console.log(
      `${key}: hasMaterial=${module.hasMaterial(inp)} requestChars=${text.length} estTokens(${INPUT_TOKEN_STOP_BAND})=${tokens} (${band}) limit=${INPUT_TOKEN_STOP_LIMIT} ${tokens > INPUT_TOKEN_STOP_LIMIT ? 'HALT' : 'ok'}`,
    )
  }
}

// ---------------------------------------------------------------------------
// dry --cap / --select: M1b 입력 전처리 후보 측정 (네트워크 없음, 운영 경로에 넣지 않음)
// ---------------------------------------------------------------------------

/** `--cap`·`--select` 값 -> 후보 목록. 생략/none = 없음, all = 없음 + 전부, 그 밖 = 그 후보 하나. */
function candidateOptions(list: readonly Candidate[], flag: string | undefined): (Candidate | null)[] {
  if (flag === undefined || flag === 'none') return [null]
  if (flag === 'all') return [null, ...list]
  return [findCandidate(list, flag)]
}

async function dryCandidates(flags: Map<string, string>): Promise<void> {
  const assembled = await assemble()
  const table = corners()
  const caps = candidateOptions(CAP_CANDIDATES, flags.get('cap'))
  const selects = candidateOptions(SELECT_CANDIDATES, flags.get('select'))
  const mid = (t: string) => estimateTokens(t, 'mid')
  const range = (t: string) => `${mid(t)} (${estimateTokens(t, 'low')}~${estimateTokens(t, 'high')})`
  const userPart = (req: LlmRequest) => req.user.map((b) => b.text).join('\n\n')

  const out: string[] = ['# M1b 입력 전처리 후보 dry 측정 (자동 생성)', '']
  out.push('글자 수 = 요청 전체(system + user) 문자열 길이. 추정 토큰 = 중간값 (하한~상한), API 호출 없이 글자 종류별 가중치로 계산.', '')
  out.push('| 선별 | 상한 | 남은 메시지 | 코너 | 글자 수 | 추정 토큰 | 그중 user |', '|---|---|---|---|---|---|---|')
  const detail: string[] = []

  // 데이트 아카이브는 채팅을 받지 않는다 - 기준 한 줄만.
  {
    const req = table.date_archive.module.buildRequest(table.date_archive.input(assembled), CONTEXT)
    const text = requestText(req)
    out.push(`| 없음 | 없음 | - | date_archive | ${text.length} | ${range(text)} | ${mid(userPart(req))} |`)
  }

  for (const sel of selects) {
    for (const cap of caps) {
      const afterSelect = sel === null ? [...assembled.messages] : sel.apply(assembled.messages)
      const kept = cap === null ? afterSelect : cap.apply(afterSelect)
      const stats = statsOf(assembled.messages, kept)
      const swapped: AssembledInput = { ...assembled, messages: kept }
      const label = [sel?.id ?? '없음', cap?.id ?? '없음']
      for (const key of ['sweet_words', 'this_month'] as const) {
        const { module, input } = table[key]
        const inp = input(swapped)
        if (!module.hasMaterial(inp)) {
          out.push(`| ${label[0]} | ${label[1]} | ${kept.length}/${stats.total} | ${key} | 재료 없음 | - | - |`)
          continue
        }
        const req = module.buildRequest(inp, CONTEXT)
        const text = requestText(req)
        out.push(`| ${label[0]} | ${label[1]} | ${kept.length}/${stats.total} | ${key} | ${text.length} | ${range(text)} | ${mid(userPart(req))} |`)
      }
      if (sel !== null || cap !== null) {
        detail.push(`### 선별 ${label[0]} + 상한 ${label[1]}`)
        if (sel !== null) detail.push(`- 선별 규칙: ${sel.rule}`)
        if (cap !== null) detail.push(`- 상한 규칙: ${cap.rule}`)
        detail.push(`- 남은 메시지 ${kept.length}/${stats.total}`)
        detail.push(`- 다정한 구간(손 라벨) 남은 메시지 ${stats.warmKept}/${stats.warmTotal}: ` + stats.warmByLandmark.map((w) => `${w.label} ${w.kept}/${w.total}`).join(', '))
        detail.push(`- 다툰 날(09-16·09-17) 남은 메시지 ${stats.argumentKept}/${stats.argumentTotal}`)
        detail.push(`- 대화가 거의 없는 날(09-08·09-09·09-10·09-23·09-24) 남은 메시지 ${stats.quietKept}/${stats.quietTotal}`)
        detail.push(`- 메시지가 하나도 안 남은 날: ${stats.emptiedDays.length === 0 ? '없음' : stats.emptiedDays.join(', ')}`, '')
      }
    }
  }
  out.push('', ...detail)
  await Deno.mkdir(OUT_DIR, { recursive: true })
  await Deno.writeTextFile(`${OUT_DIR}/candidates.md`, out.join('\n'))
  console.log(out.join('\n'))
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run(flags: Map<string, string>): Promise<void> {
  // 84-a(R124-2): 허용 목록 밖이면 키를 읽기 전에 멈춘다(호출 0).
  const resolution = resolveHarnessModel(flags.get('model'))
  if (!resolution.ok) {
    throw new Error(`멈춤: --model이 허용 목록(claude-sonnet-5-5 · claude-opus-5-5) 밖이다 (거부 코드 ${resolution.code}) - 호출 0`)
  }
  const model = resolution.model
  const runs = Number(flags.get('runs') ?? '3')
  const maxTokens = Number(flags.get('max-tokens') ?? String(LLM_MAX_TOKENS))
  const tag = safeName(flags.get('tag') ?? 'default')
  const which = flags.get('corner') ?? 'all'
  const selected: readonly CornerKey[] = which === 'all' ? CORNERS : [which as CornerKey]
  for (const c of selected) if (!CORNERS.includes(c)) throw new Error(`알 수 없는 코너: ${c}`)

  const key = readKey()
  const redact = makeRedactor(key)
  const assembled = await assemble()
  const table = corners()
  await Deno.mkdir(RUNS_DIR, { recursive: true })
  // 84-a(R124-3): 이번 실행 전체 $10.
  const meter = new CostMeter(model, HARNESS_BUDGET_USD)

  for (const cornerKey of selected) {
    const { module, input } = table[cornerKey]
    const inp = input(assembled)
    for (let r = 1; r <= runs; r += 1) {
      const httpCalls: HttpCall[] = []
      const attempts: AttemptRecord[] = []

      // 전송 계측: 기존 llmClient의 fetchImpl 주입점으로 응답을 한 번 더 읽는다(골격은 그대로).
      const instrumentedFetch: typeof fetch = async (url, init) => {
        const t0 = performance.now()
        const response = await fetch(url, init)
        const latencyMs = Math.round(performance.now() - t0)
        const copy = response.clone()
        const bodyText = await copy.text()
        let usage: Usage | null = null
        let stopReason: string | null = null
        let contentBlocks: unknown = null
        let errorBody: string | null = null
        if (response.ok) {
          try {
            const j = JSON.parse(bodyText)
            stopReason = j.stop_reason ?? null
            contentBlocks = j.content ?? null
            const u = j.usage ?? {}
            usage = {
              input: u.input_tokens ?? 0,
              output: u.output_tokens ?? 0,
              cacheRead: u.cache_read_input_tokens ?? 0,
              cacheWrite: u.cache_creation_input_tokens ?? 0,
            }
          } catch {
            errorBody = summarizeErrorBody(redact(bodyText))
          }
        } else {
          errorBody = summarizeErrorBody(redact(bodyText))
        }
        httpCalls.push({ status: response.status, latencyMs, stopReason, usage, contentBlocks, errorBody })
        return response
      }

      // 84-a: 시도 직전마다 비용(실행 전체 $10)과 코너 8분을 본다. 사용량은 응답마다 계량기에 더한다.
      const cornerDeadline: Deadline = { startedAtMs: Date.now(), limitMs: CORNER_TIME_LIMIT_MS, stop: SAFETY_STOP.cornerTime }
      const base: LlmClient = createLlmClient({
        apiKey: key,
        model,
        maxTokens,
        fetchImpl: instrumentedFetch,
        beforeAttempt: (request) => {
          if (!meter.canAfford(worstCallCostUsd(model, estimateRequestTokens(request, 'high'), maxTokens))) return { ok: false, stop: SAFETY_STOP.cost }
          const budget = callBudgetMs([cornerDeadline], Date.now())
          return budget.ok ? { ok: true, timeoutMs: budget.timeoutMs } : { ok: false, stop: budget.stop }
        },
        onResponse: (info) => {
          if (info.usage !== null) meter.record(info.usage)
        },
      })
      // 호출마다 같은 검증 함수(`processCornerResponse`)를 한 번 더 돌려 시도별 검증 결과를 남긴다(순수 함수).
      // 잘린 응답(`stop_reason=max_tokens`)은 재시도하지 않고 판정 자료로 남긴다(R16-4) - 골격의 `schema_invalid`
      // 재호출은 이 주입점에서 네트워크 없이 거부한다(골격은 그대로).
      let truncated = false
      const client: LlmClient = {
        async call(request) {
          if (truncated) {
            return { ok: false, reason: 'generation_failed', detail: 'max_tokens 잘림 - 하네스가 재시도하지 않음' }
          }
          const result = await base.call(request)
          if (result.ok && httpCalls.at(-1)?.stopReason === 'max_tokens') truncated = true
          if (result.ok) {
            // 84-a2: 잘린 응답은 llmClient가 빈 텍스트(형식 오류)로 돌려준다 - 판정 자료로는 잘린 text 블록을 남긴다.
            const shown = truncated ? (extractResponseText(httpCalls.at(-1)?.contentBlocks) ?? '') : result.text
            const v = processCornerResponse(module, result.text, inp, CONTEXT)
            attempts.push({
              index: attempts.length + 1,
              text: redact(shown),
              validation: v.ok ? { ok: true } : { ok: false, reason: v.reason, detail: redact(v.detail) },
            })
          }
          return result
        },
      }

      const startedAt = new Date().toISOString()
      const t0 = performance.now()
      let pipeline
      try {
        pipeline = await runCornerModule(module, { input: inp, context: CONTEXT, llmClient: client })
      } catch (err) {
        console.error(`[${model}] ${cornerKey} #${r}: 예외 ${redact(err instanceof Error ? err.message : String(err))}`)
        throw err
      }
      const totalLatencyMs = Math.round(performance.now() - t0)

      const usageTotal: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
      for (const c of httpCalls) {
        if (c.usage === null) continue
        usageTotal.input += c.usage.input
        usageTotal.output += c.usage.output
        usageTotal.cacheRead += c.usage.cacheRead
        usageTotal.cacheWrite += c.usage.cacheWrite
      }

      const record: RunRecord = {
        model,
        corner: cornerKey,
        run: r,
        tag,
        startedAt,
        maxTokens,
        totalLatencyMs,
        httpCalls,
        attempts,
        outcome: pipeline.outcome,
        failureReason: pipeline.outcome === 'failure' ? pipeline.reason : null,
        failureDetail: pipeline.outcome === 'success' ? null : redact(pipeline.detail),
        // 84-a2: 실제로 보낸 HTTP 수(골격의 `llmClient.call()` 횟수가 아니다 - 그 안의 재시도도 센다).
        llmCallAttempts: sentCalls({ httpCalls }),
        truncated,
        content:pipeline.outcome === 'success' ? pipeline.content : null,
        usageTotal,
        haltedFor: pipeline.outcome === 'halted' ? pipeline.haltedFor : null,
        r19_2Violations: attempts.filter((a) => !a.validation.ok && a.validation.detail.includes(R19_2_MARK)).length,
        costUsd: usageCostUsd(model, usageTotal),
        fixtureYear: FIXTURE_YEAR,
      }
      const file = `${RUNS_DIR}/${safeName(model)}__${cornerKey}__${tag}__r${r}.json`
      await Deno.writeTextFile(file, redact(JSON.stringify(record, null, 2)))
      console.log(
        `[${model}] ${cornerKey} #${r}: ${record.outcome}${record.failureReason ? ' (' + record.failureReason + ')' : ''}${record.outcome === 'halted' ? ' (' + record.failureDetail + ')' : ''}${truncated ? ' [max_tokens 잘림]' : ''} ` +
          `calls=${sentCalls({ httpCalls })} in=${usageTotal.input} cw=${usageTotal.cacheWrite} cr=${usageTotal.cacheRead} out=${usageTotal.output} ${totalLatencyMs}ms ` +
          `$${formatUsd(record.costUsd ?? 0)} (누적 $${formatUsd(meter.spentUsd())} / 상한 $${HARNESS_BUDGET_USD})`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// review: 저장된 실행 -> review.md, summary.md (본문은 `m1Review.ts` `renderReview`)
// ---------------------------------------------------------------------------

async function review(): Promise<void> {
  const records: RunRecord[] = []
  for await (const e of Deno.readDir(RUNS_DIR)) {
    if (e.isFile && e.name.endsWith('.json')) records.push(JSON.parse(await Deno.readTextFile(`${RUNS_DIR}/${e.name}`)))
  }
  const { review: reviewText, summary } = renderReview(records)
  await Deno.writeTextFile(`${OUT_DIR}/review.md`, reviewText)
  await Deno.writeTextFile(`${OUT_DIR}/summary.md`, summary)
  console.log(`review.md, summary.md 작성 (${records.length}건)`)
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// recheck: 저장된 실행 -> 새 내용 검사(84-c) -> recheck.md (LLM 호출 0)
// ---------------------------------------------------------------------------

async function recheck(): Promise<void> {
  const records: RunRecord[] = []
  for await (const e of Deno.readDir(RUNS_DIR)) {
    if (e.isFile && e.name.endsWith('.json')) records.push(JSON.parse(await Deno.readTextFile(`${RUNS_DIR}/${e.name}`)))
  }
  const rows = await recheckRecords(records)
  const text = renderRecheck(rows)
  await Deno.writeTextFile(`${OUT_DIR}/recheck.md`, text)
  console.log(text)
}

const { cmd, flags } = parseArgs(Deno.args)
if (cmd === 'dry') await dry(flags)
else if (cmd === 'run') await run(flags)
else if (cmd === 'review') await review()
else if (cmd === 'recheck') await recheck()
else throw new Error('사용: dry | run --model <id> | review | recheck')
