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
 * 사용 (저장소 루트에서):
 *   deno run --no-lock --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com \
 *     --allow-read=. --allow-write=scripts/ops/out \
 *     scripts/ops/m1QualityRun.ts run --model <모델ID> [--corner all|date_archive|sweet_words|this_month] \
 *       [--runs 3] [--max-tokens 4096] [--tag <실행 이름>]
 *   deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out \
 *     scripts/ops/m1QualityRun.ts dry          # 입력 조립만(네트워크·키 불필요)
 *   deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out \
 *     scripts/ops/m1QualityRun.ts review       # out/runs/*.json -> out/review.md, out/summary.md
 */

import { assembleCornerInput, type AssembledInput } from '../../supabase/functions/_shared/inputAssembly.ts'
import { fakeClient } from '../../supabase/functions/_shared/testFixtures/inputAssemblyFake.ts'
import {
  processCornerResponse,
  runCornerModule,
  type CornerContext,
  type CornerModule,
} from '../../supabase/functions/_shared/cornerPipeline.ts'
import { INPUT_TOKEN_STOP_BAND, INPUT_TOKEN_STOP_LIMIT, estimateRequestTokens } from '../../supabase/functions/_shared/tokenEstimate.ts'
import { createLlmClient, type LlmClient } from '../../supabase/functions/_shared/llmClient.ts'
import type { LlmRequest } from '../../supabase/functions/_shared/llmRequest.ts'
import { dateArchiveModule } from '../../supabase/functions/_shared/corners/dateArchive.ts'
import { sweetWordsModule } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import { thisMonthModule } from '../../supabase/functions/_shared/corners/thisMonth.ts'
import { COUPLE_ID, PERIOD, buildTables } from './fixtures/m1-month/dataset.ts'
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
const CORNERS = ['date_archive', 'sweet_words', 'this_month'] as const
type CornerKey = (typeof CORNERS)[number]

const CONTEXT: CornerContext = { coupleId: COUPLE_ID, period: PERIOD, cadence: 'monthly' }

/** 다툰 날 - 지면에 이 날의 원문이 실렸는지 기계적으로 표시한다(판정은 사람이 한다). */
const ARGUMENT_DAYS = ['2026-09-16', '2026-09-17']

/**
 * 공급자 공식 가격표(USD/MTok) - 확인일 2026-10-19, https://platform.claude.com/docs/en/about-claude/pricing
 * 하네스의 비용 추정 전용이다. 제품 설정이 아니다.
 */
const PRICES: Record<string, { input: number; cacheWrite5m: number; cacheRead: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2, cacheWrite5m: 2.5, cacheRead: 0.1, output: 10 },
  'claude-opus-5-5': { input: 4, cacheWrite5m: 5, cacheRead: 0.2, output: 20 },
}

// ---------------------------------------------------------------------------
// 저장 형식
// ---------------------------------------------------------------------------

interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

interface HttpCall {
  readonly status: number
  readonly latencyMs: number
  readonly stopReason: string | null
  readonly usage: Usage | null
  /** 응답 본문의 content 블록 전부(text·thinking 등). 키는 지운 뒤 저장한다. */
  readonly contentBlocks: unknown
  /** 오류 응답이면 본문 텍스트. */
  readonly errorBody: string | null
}

interface AttemptRecord {
  readonly index: number
  readonly text: string
  readonly validation:
    | { ok: true }
    | { ok: false; reason: string; detail: string }
}

interface RunRecord {
  readonly model: string
  readonly corner: CornerKey
  readonly run: number
  readonly tag: string
  readonly startedAt: string
  readonly maxTokens: number
  readonly totalLatencyMs: number
  readonly httpCalls: HttpCall[]
  readonly attempts: AttemptRecord[]
  /** `halted` = 생성 전 안전 정지(추정 입력 토큰 > 40,000, `52r2-`). 실패 사유 4값이 아니다. 이때 LLM 호출은 0회다. */
  readonly outcome: 'success' | 'failure' | 'halted'
  readonly failureReason: string | null
  readonly failureDetail: string | null
  readonly llmCallAttempts: number
  /** 응답이 `stop_reason=max_tokens`로 잘렸는가. 잘린 뒤의 재호출은 하네스가 막는다(ROADMAP R16-4). */
  readonly truncated: boolean
  /** 저장 content(성공 시). */
  readonly content: unknown
  readonly usageTotal: Usage
}

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

function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]/g, '-')
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
  return await assembleCornerInput(fakeClient(buildTables()), CONTEXT)
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
  const model = flags.get('model')
  if (model === undefined) throw new Error('--model 이 필요하다')
  const runs = Number(flags.get('runs') ?? '3')
  const maxTokens = Number(flags.get('max-tokens') ?? '4096')
  const tag = safeName(flags.get('tag') ?? 'default')
  const which = flags.get('corner') ?? 'all'
  const selected: readonly CornerKey[] = which === 'all' ? CORNERS : [which as CornerKey]
  for (const c of selected) if (!CORNERS.includes(c)) throw new Error(`알 수 없는 코너: ${c}`)

  const key = readKey()
  const redact = makeRedactor(key)
  const assembled = await assemble()
  const table = corners()
  await Deno.mkdir(RUNS_DIR, { recursive: true })

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
            errorBody = redact(bodyText)
          }
        } else {
          errorBody = redact(bodyText)
        }
        httpCalls.push({ status: response.status, latencyMs, stopReason, usage, contentBlocks, errorBody })
        return response
      }

      const base: LlmClient = createLlmClient({ apiKey: key, model, maxTokens, fetchImpl: instrumentedFetch })
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
            const v = processCornerResponse(module, result.text, inp, CONTEXT)
            attempts.push({
              index: attempts.length + 1,
              text: redact(result.text),
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
        llmCallAttempts: pipeline.llmCallAttempts,
        truncated,
        content:pipeline.outcome === 'success' ? pipeline.content : null,
        usageTotal,
      }
      const file = `${RUNS_DIR}/${safeName(model)}__${cornerKey}__${tag}__r${r}.json`
      await Deno.writeTextFile(file, redact(JSON.stringify(record, null, 2)))
      console.log(
        `[${model}] ${cornerKey} #${r}: ${record.outcome}${record.failureReason ? ' (' + record.failureReason + ')' : ''}${record.outcome === 'halted' ? ' (' + record.failureDetail + ')' : ''}${truncated ? ' [max_tokens 잘림]' : ''} ` +
          `calls=${httpCalls.length} in=${usageTotal.input} cw=${usageTotal.cacheWrite} cr=${usageTotal.cacheRead} out=${usageTotal.output} ${totalLatencyMs}ms`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// review: 저장된 실행 -> review.md, summary.md
// ---------------------------------------------------------------------------

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function isArgumentDay(at: unknown): boolean {
  return typeof at === 'string' && ARGUMENT_DAYS.some((d) => at.startsWith(d))
}

/** 지면 문장(AI가 쓴 것)과 원문을 나란히 놓을 행들을 만든다. 왼쪽 = 지면, 오른쪽 = 원문(유저 기록). */
function sideBySide(corner: CornerKey, content: any): { left: string; right: string }[] {
  const rows: { left: string; right: string }[] = []
  const p = content?.payload
  if (corner === 'sweet_words') {
    for (const [i, m] of (p?.main ?? []).entries()) {
      const flag = m.turns.some((t: any) => isArgumentDay(t.at)) ? ' **[다툰 날 원문 포함]**' : ''
      rows.push({
        left: `대화 ${i + 1} 정황 문장: ${m.context}${flag}`,
        right: m.turns.map((t: any) => `${t.speaker} (${t.at}): ${t.text}`).join('\n'),
      })
    }
    for (const s of p?.sub ?? []) {
      const flag = isArgumentDay(s.attribution?.at) ? ' **[다툰 날 원문 포함]**' : ''
      rows.push({ left: `한 줄 선택${flag}`, right: `${s.speaker} (${s.attribution?.display}): ${s.text}` })
    }
  } else if (corner === 'date_archive') {
    for (const a of p?.articles ?? []) {
      const sug = (a.closingQuestions ?? []).find((q: any) => q.type === 'suggestion')
      rows.push({
        left: `제목: ${a.title}${a.featured ? ' (메인 화보)' : ''}${a.recalled ? ' (재소환 ' + a.recallReason + ')' : ''}\n맞춤 질문: ${sug?.text}\n근거: ${sug?.basis}`,
        right: `${a.dateOn} ${a.region ?? ''}`,
      })
      for (const s of a.stops ?? []) {
        const notes = (s.userNotes ?? []).map((n: any) => (n.type === 'memo' ? `${n.authorName} 메모: ${n.text}` : `${n.authorName} 그림`)).join('\n')
        rows.push({
          left: s.aiCaption === null ? '(AI 캡션 없음)' : `캡션: ${s.aiCaption}`,
          right: `정거장 ${s.seq} ${s.time} ${s.placeName ?? '(장소명 없음)'} / 사진 ${(s.photos ?? []).length}장${notes ? '\n' + notes : ''}`,
        })
      }
    }
  } else {
    const t = p?.theme
    if (t) {
      rows.push({
        left: `헤드라인: ${t.headline}\n리드: ${t.lead}\n극성: ${t.polarity}`,
        right: (t.signals ?? []).map((s: any) => `신호 ${s.kind}: ${s.value} (근거 ${s.count}건)`).join('\n'),
      })
    }
    for (const a of p?.articles ?? []) {
      const flag = (a.evidence ?? []).some((e: any) => isArgumentDay(e.at)) ? ' **[다툰 날 원문 포함]**' : ''
      rows.push({
        left: `소기사 ${a.seq + 1} 제목: ${a.title}\n본문: ${a.body}${flag}`,
        right: (a.evidence ?? [])
          .map((e: any) => (e.type === 'message' ? `메시지 (${e.attribution?.display}): ${e.excerpt}` : e.type === 'photo' ? `사진 (${e.at})` : `데이트 (${e.at})`))
          .join('\n'),
      })
    }
    if (p?.closing) rows.push({ left: `마무리 한 줄: ${p.closing}`, right: '' })
  }
  return rows
}

function cost(model: string, u: Usage): { sync: number; batch: number } | null {
  const pr = PRICES[model]
  if (pr === undefined) return null
  const sync = (u.input * pr.input + u.cacheWrite * pr.cacheWrite5m + u.cacheRead * pr.cacheRead + u.output * pr.output) / 1e6
  return { sync, batch: sync / 2 }
}

async function review(): Promise<void> {
  const records: RunRecord[] = []
  for await (const e of Deno.readDir(RUNS_DIR)) {
    if (e.isFile && e.name.endsWith('.json')) records.push(JSON.parse(await Deno.readTextFile(`${RUNS_DIR}/${e.name}`)))
  }
  records.sort((a, b) => a.corner.localeCompare(b.corner) || a.model.localeCompare(b.model) || a.tag.localeCompare(b.tag) || a.run - b.run)

  const out: string[] = []
  out.push('# M1 품질 판정 자료', '')
  out.push('코너 3종의 실제 모델 출력. 각 회차마다 **지면에 실릴 문장(왼쪽)** 과 **원문(오른쪽)** 을 나란히 놓았다.')
  out.push('판정 칸은 비워 두었다. 맨 끝 체크리스트는 MASTER 3-7의 판단 기준이다.', '')
  out.push('입력: 합성 데이터셋(`scripts/ops/fixtures/m1-month/`), 가상 커플 세준·서영의 2026년 9월. 다툰 날 = 09-16(본 다툼), 09-17 오전(뒤끝).')
  out.push('`[다툰 날 원문 포함]` 표시는 기계적 표시일 뿐이다 - 그 날의 원문이 지면에 실렸다는 뜻이지 위반이라는 뜻이 아니다.', '')

  for (const corner of CORNERS) {
    out.push(`## 코너: ${corner}`, '')
    for (const rec of records.filter((r) => r.corner === corner)) {
      out.push(`### ${rec.model} / 회차 ${rec.run}${rec.tag === 'default' ? '' : ' / ' + rec.tag}`, '')
      out.push(
        `- 결과: **${rec.outcome === 'success' ? '성공' : rec.outcome === 'halted' ? '안전 정지 (호출 없음)' : '실패 (' + rec.failureReason + ')'}** / LLM 호출 ${rec.llmCallAttempts}회 / ${rec.totalLatencyMs}ms / ` +
          `토큰 입력 ${rec.usageTotal.input} · 출력 ${rec.usageTotal.output} · 캐시읽기 ${rec.usageTotal.cacheRead} · 캐시쓰기 ${rec.usageTotal.cacheWrite}`,
      )
      out.push(`- 원자료: \`scripts/ops/out/runs/${safeName(rec.model)}__${rec.corner}__${rec.tag}__r${rec.run}.json\``)
      if (rec.truncated) out.push(`- **출력 잘림: \`stop_reason=max_tokens\` (max_tokens ${rec.maxTokens}), 재시도하지 않음** - 아래 시도 원문이 잘린 출력이다`)
      if (rec.outcome !== 'success') out.push(`- ${rec.outcome === 'halted' ? '정지 사유' : '실패 상세'}: ${cell(rec.failureDetail ?? '')}`)
      out.push('')
      for (const a of rec.attempts) {
        if (a.validation.ok) continue
        out.push(`시도 ${a.index} 검증 실패 (${a.validation.reason}): ${cell(a.validation.detail).slice(0, 600)}`, '')
        out.push('```json', a.text, '```', '')
      }
      if (rec.outcome === 'success') {
        const rows = sideBySide(corner, rec.content)
        out.push('| 지면에 실릴 문장 | 원문 |', '|---|---|')
        for (const r of rows) out.push(`| ${cell(r.left)} | ${cell(r.right)} |`)
        out.push('')
      }
      out.push('판정: [ ] 통과 [ ] 불통과 / 메모: ', '')
    }
  }

  out.push('---', '', '## 판단 기준 (MASTER 3-7)', '')
  out.push('> 이 문장을 두 사람이 **각자** 읽었을 때, 한쪽이라도 불편해질 여지가 있는가. 있으면 쓰지 않는다.', '')
  out.push('허용: 유저 원본을 주인공으로 배치 / 감정·분위기 짚기 / 긍정적 방향의 목소리 / 변화를 관찰해 서술 / 두 사람 모두에게 해당하는 서술 / 데이터가 없으면 스킵·분량 축소', '')
  out.push('금지: 원본 대체·각색 / **잘잘못 판정** / **한쪽 편들기** / **관계에 대한 진단·훈수** / **특정인의 행동을 문제 삼기** / 데이터가 없는데 억지로 만들어내기', '')
  out.push('| 문장 | 판정 |', '|---|---|')
  for (const [s, v] of [
    ['"이날은 서로 조심스러웠던 것 같습니다"', '두 사람 모두에 해당 (통과)'],
    ['"오늘 두 분 정말 다정하셨네요"', '긍정 방향, 편이 갈리지 않음 (통과)'],
    ['"8월에는 우산 이야기가 네 번 나왔습니다"', '사실 서술 (통과)'],
    ['"이날은 세준이 먼저 사과했어야 했습니다"', '잘잘못 판정 (불통과)'],
    ['"서영의 서운함이 이해되는 상황입니다"', '한쪽 편들기 (불통과)'],
    ['"두 분은 대화가 부족합니다"', '관계 진단 (불통과)'],
    ['"답장에 소홀해졌습니다"', '개인의 태도를 문제 삼음 (불통과)'],
  ]) out.push(`| ${s} | ${v} |`)
  out.push('', '### 체크리스트 (회차마다 확인 - 판정 칸은 비워 둠)', '')
  for (const item of [
    '두 사람이 각자 읽었을 때 한쪽이라도 불편해질 여지가 있는 문장이 없다',
    '잘잘못을 가리는 문장이 없다 (특히 다툰 날 09-16·09-17)',
    '한쪽 편을 드는 문장이 없다',
    '관계에 대한 진단·훈수가 없다 ("대화가 부족" 류)',
    '특정인의 행동·태도를 문제 삼는 문장이 없다 (답장, 약속, 회식 등)',
    '유저 원문을 각색·요약·교정하지 않았다 (원문 칸이 입력 그대로다)',
    '유저 메모·그림이 있는 구간에 AI 캡션이 없다 (17-1)',
    '데이터가 없는 곳을 지어내지 않았다 (없는 장소·사실·감정)',
    '평가·감상·점수·조언·예측이 없다 (담백한 정황 서술)',
    '17-4: 다툰 날과 화해 대화를 싣지 않았다 (다툼의 맥락 소환 금지)',
    '17-5: 부정 소재(다툼)를 테마로 잡지 않았고, 부정을 긍정으로 포장하지도 않았다',
    '한국어가 자연스럽고 톤이 담백하다',
  ]) out.push(`- [ ] ${item}`)
  out.push('')
  await Deno.writeTextFile(`${OUT_DIR}/review.md`, out.join('\n'))

  // 요약: 실행 표·토큰·비용
  const sum: string[] = ['# 실행 요약 (자동 생성)', '']
  sum.push('| 모델 | 코너 | 회차 | 결과 | 호출 | 입력 | 출력 | 캐시읽기 | 캐시쓰기 | 지연(ms) | 비용(동기, $) |', '|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of records) {
    const c = cost(r.model, r.usageTotal)
    sum.push(
      `| ${r.model} | ${r.corner} | ${r.run} | ${r.outcome === 'success' ? '성공' : r.outcome === 'halted' ? '안전 정지' : '실패: ' + r.failureReason}${r.truncated ? ' (max_tokens 잘림)' : ''} | ${r.llmCallAttempts} | ${r.usageTotal.input} | ${r.usageTotal.output} | ${r.usageTotal.cacheRead} | ${r.usageTotal.cacheWrite} | ${r.totalLatencyMs} | ${c ? c.sync.toFixed(4) : '-'} |`,
    )
  }
  await Deno.writeTextFile(`${OUT_DIR}/summary.md`, sum.join('\n'))
  console.log(`review.md, summary.md 작성 (${records.length}건)`)
}

// ---------------------------------------------------------------------------

const { cmd, flags } = parseArgs(Deno.args)
if (cmd === 'dry') await dry(flags)
else if (cmd === 'run') await run(flags)
else if (cmd === 'review') await review()
else throw new Error('사용: dry | run --model <id> | review')
