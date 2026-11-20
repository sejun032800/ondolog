/**
 * 운영자 경로 - 생성 (M2-b 샘플 출력 모드 · 84-a 실제 모드). 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 * + .claude/state/prompts/phase-7/84-a-dispatch-llm-safety.md (ROADMAP r124 R124-2~4)
 *
 * ── 84-a 실제 모드 (`mode: 'live'`) ─────────────────────────────────────
 * - **기본은 샘플 모드**다. 실제 모드는 호출부(CLI `--mode live`)가 명시하고 `live` 의존성(클라이언트 만들기 · 시계)을 넘길 때만.
 * - 가드는 그대로 먼저 돈다: 시험 커플(`assertTestCouple`) · P0 대상 조건. 가드 밖이면 LLM 0으로 멈춘다(실제 사용자 0).
 * - 모델 fail-closed(R21-1): `app_config.llm_provider`가 허용 목록 안일 때만(`resolveLlmModel`). 아니면 **호 행을 만들기 전에**
 *   거부(코드 숫자) - LLM 0 · DB 쓰기 0.
 * - 시간: 코너 8분 · 1호 20분(주입 시계) - 호출 1번 120초는 `llmClient`. 1호 비용 $2(실제 사용량 누적 + 다음 호출 최악).
 * - 사용량은 `corners.llm_usage`(숫자 · 코드만).
 *
 * 흐름(MASTER §17-0-10-B): P0 초안 행 -> P1 입력 조립(기존) -> 코너 3종(기존 골격 그대로, 응답 자리만 샘플) ->
 * 검증·원문 채우기(기존) -> 저장(기존 `saveCornerResult.ts`) -> P7 미디어 복제.
 *
 * ── 이 파일이 하지 않는 것 ────────────────────────────────────────────────
 * - **실제 API 호출을 하지 않는다.** 응답 자리에는 `SampleLlmClient`(네트워크 없음)만 들어간다. 실제 호출 경로를 부르는
 *   인수도 없다. 모델 식별자(`app_config`)를 읽지도 채우지도 않는다 - 모델이 `tbd`이면 생성이 돌지 않는 기존 fail-closed
 *   (§17-0-10-H)는 실제 호출 경로의 것이고, 이 파일은 그 경로를 지나지 않는다.
 * - 검증기·골격·코너 코드를 고치지 않는다. 검증된 content를 저장 뒤에 고치지 않는다.
 * - 시험 커플이 아니면 돌지 않는다(`assertTestCouple`).
 *
 * ── 안전 정지 (R20-2, §17-0-9-F-2) ───────────────────────────────────────
 * 골격이 `outcome: 'halted'`를 돌려주면: LLM 호출 0건, 코너는 `pending` 그대로, 운영 경보 `usage_over`를 남긴다 -
 * `detail = { stage: 'input_halt', cornerType, estimatedInputTokens, limit }`(숫자와 종류뿐, 원문 없음). 열린 경보가 있으면
 * 이 호의 발행이 거부된다(`publishIssue.ts`·`fn_publish_issue`).
 */

import {
  CoupleMembershipError,
  InvalidCornerContextError,
  runCornerModule,
  type CornerContext,
  type CornerModule,
} from '../../supabase/functions/_shared/cornerPipeline.ts'
import { assembleCornerInput, type AssembledInput, type InputExclusions } from '../../supabase/functions/_shared/inputAssembly.ts'
import { saveCornerFailure, saveCornerSuccess } from '../../supabase/functions/_shared/saveCornerResult.ts'
import { INPUT_TOKEN_STOP_BAND, estimateRequestTokens } from '../../supabase/functions/_shared/tokenEstimate.ts'
import { dateArchiveModule } from '../../supabase/functions/_shared/corners/dateArchive.ts'
import { sweetWordsModule } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import { thisMonthModule } from '../../supabase/functions/_shared/corners/thisMonth.ts'
import { copyIssueMedia, type MediaCopyReport } from './mediaCopy.ts'
import { OpsStopError, assertLiveTarget, assertTestCouple } from './opsGuards.ts'
import type { CornerLlmUsage, CornerRow, IssueRow, IssueType, MediaStore, OpsStore } from './opsStore.ts'
import type { BeforeAttemptResult, LlmClient, LlmResponseInfo } from '../../supabase/functions/_shared/llmClient.ts'
import type { LlmRequest } from '../../supabase/functions/_shared/llmRequest.ts'
import {
  CORNER_TIME_LIMIT_MS,
  CostMeter,
  ISSUE_BUDGET_USD,
  ISSUE_TIME_LIMIT_MS,
  SAFETY_STOP,
  ZERO_USAGE,
  addUsage,
  callBudgetMs,
  resolveLlmModel,
  usageCostUsd,
  worstCallCostUsd,
  type AllowedLlmModel,
  type Deadline,
  type LlmUsage,
} from '../../src/engine/corners/llmSafety.ts'
import {
  SAMPLE_ENGINE_VERSION,
  createSampleLlmClient,
  sampleDateArchive,
  sampleSweetWords,
  sampleThisMonth,
} from './sampleOutputs.ts'

type CornerKind = 'date_archive' | 'sweet_words' | 'this_month'

interface CornerEntry {
  readonly kind: CornerKind
  readonly module: CornerModule<any, any, any>
  readonly inputOf: (a: AssembledInput) => unknown
  readonly sampleOf: (input: any) => unknown
}

/** 코너 3종 - 지면 순서(seq 1~3)는 이 배열 순서다. 입력 모양은 하네스(`m1QualityRun.ts`)와 같다. */
export const CORNER_TABLE: readonly CornerEntry[] = [
  { kind: 'date_archive', module: dateArchiveModule, inputOf: (a) => ({ dates: a.dates }), sampleOf: sampleDateArchive },
  {
    kind: 'sweet_words',
    module: sweetWordsModule,
    inputOf: (a) => ({ warmthIndex: null, messages: a.messages }),
    sampleOf: sampleSweetWords,
  },
  {
    kind: 'this_month',
    module: thisMonthModule,
    inputOf: (a) => ({ messages: a.messages, photos: a.photos, dates: a.dates }),
    sampleOf: sampleThisMonth,
  },
]

export interface GenerateParams {
  readonly coupleId: string
  /** `YYYY-MM-DD`, KST 00:00 시작 포함. */
  readonly periodStart: string
  /** `YYYY-MM-DD`, KST 00:00 끝 **미포함**(`CornerPeriod`의 반열린 구간). */
  readonly periodEndExclusive: string
  readonly cadence: 'monthly' | 'daily'
  /** 84-a: 없으면 샘플. `live`는 `deps.live`가 있어야 한다. */
  readonly mode?: 'sample' | 'live'
}

/** 84-a: 실제 모드 코너 클라이언트에 넘기는 것(키는 호출부가 더한다 - 이 파일은 키를 모른다). */
export interface LiveClientConfig {
  readonly model: AllowedLlmModel
  readonly beforeAttempt: (request: LlmRequest) => BeforeAttemptResult
  readonly onResponse: (info: LlmResponseInfo) => void
}

/** 84-a: 실제 모드 의존성 - CLI는 `createLlmClient`, 시험은 가짜. 시계는 주입(시험은 실제 시계 0). */
export interface LiveDeps {
  readonly createClient: (config: LiveClientConfig) => LlmClient
  readonly now: () => number
  /** 84-f(R141-2): 로컬 시드 목록 파일들의 커플 id - 실제 모드 대상은 이 안이어야 한다(`opsGuards.ts` `assertLiveTarget`). 비어 있으면 실제 모드는 늘 멈춘다. */
  readonly seedCoupleIds: ReadonlySet<string>
}

/** 실제 모드로 저장한 코너 행의 `engine_version` 앞머리(뒤에 모델 id). 샘플(`SAMPLE_ENGINE_VERSION`)과 구별한다. */
export const LIVE_ENGINE_VERSION_PREFIX = 'llm-live-v1:'

export type CornerOutcomeLabel =
  | 'ready'
  | 'kept_ready'
  | 'skipped_insufficient_input'
  | 'failed'
  | 'halted_pending'

export interface CornerReport {
  readonly cornerType: CornerKind
  readonly cornerId: string
  readonly outcome: CornerOutcomeLabel
  readonly status: string
  readonly skipReason: string | null
  /** 추정 입력 토큰(중간값, 측정값이 아니다). 재료가 없어 요청을 만들지 못한 코너는 null. */
  readonly estimatedInputTokens: number | null
  /** 이번 실행에서 샘플 클라이언트가 응답한 횟수. 실제 LLM 요청 수가 아니다. */
  readonly sampleResponses: number
  /** 84-a: 실제 모드의 HTTP 시도 수(샘플은 0). */
  readonly realApiCalls: number
  readonly detail: string | null
}

export interface GenerateReport {
  readonly mode: 'sample' | 'live'
  /** 실제 LLM HTTP 시도 합(샘플 모드는 항상 0). */
  readonly realApiCalls: number
  /** 84-a: 실제 모드의 모델(샘플은 null) · 누적 비용(USD). */
  readonly model: string | null
  readonly costUsd: number
  readonly coupleId: string
  readonly issueId: string
  readonly issueCreated: boolean
  readonly period: { readonly start: string; readonly endExclusive: string }
  readonly exclusions: InputExclusions
  readonly counts: { readonly messages: number; readonly photos: number; readonly dates: number }
  readonly corners: readonly CornerReport[]
  readonly alertIds: readonly string[]
  readonly media: MediaCopyReport
}

const KST = '+09:00'

function toPeriod(params: GenerateParams): CornerContext {
  return {
    coupleId: params.coupleId,
    cadence: params.cadence,
    period: {
      start: new Date(`${params.periodStart}T00:00:00${KST}`),
      end: new Date(`${params.periodEndExclusive}T00:00:00${KST}`),
    },
  }
}

/** 반열린 끝 날짜 -> `issues.period_end`(포함) = 끝 날짜의 전날. */
export function inclusiveEndDate(endExclusive: string): string {
  const d = new Date(`${endExclusive}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function assertDateString(value: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new OpsStopError(`${name}은 YYYY-MM-DD 날짜여야 한다 (${value})`)
  }
}

/** 샘플 모드(기존 이름 그대로 - 실제 모드는 `generateIssue`에 `mode: 'live'`). */
export function generateSampleIssue(
  deps: { readonly store: OpsStore; readonly media: MediaStore },
  params: GenerateParams,
): Promise<GenerateReport> {
  return generateIssue(deps, { ...params, mode: 'sample' })
}

export async function generateIssue(
  deps: { readonly store: OpsStore; readonly media: MediaStore; readonly live?: LiveDeps },
  params: GenerateParams,
): Promise<GenerateReport> {
  const { store, media } = deps
  const mode = params.mode ?? 'sample'
  if (mode === 'live' && deps.live === undefined) throw new OpsStopError('실제 모드에는 실제 클라이언트 의존성이 필요하다')
  assertDateString(params.periodStart, '기간 시작')
  assertDateString(params.periodEndExclusive, '기간 끝')
  const context = toPeriod(params)
  if (context.period.start.getTime() >= context.period.end.getTime()) {
    throw new OpsStopError('기간의 시작이 끝보다 늦거나 같다')
  }

  // ── 84-f 실제 모드 대상 잠금(R141-2 · R140-4): 로컬 시드 목록의 커플 id + 아래 별명 "test" 둘 다. DB를 읽기 전에 ───────
  if (mode === 'live') assertLiveTarget(params.coupleId, (deps.live as LiveDeps).seedCoupleIds)

  // ── 시험 커플 확인 + P0 대상 조건(17-0-10-B) ───────────────────────────
  const couple = await store.getCouple(params.coupleId)
  if (couple === null) throw new OpsStopError(`커플이 없다 (${params.coupleId})`)
  assertTestCouple(couple)
  if (couple.status !== 'active') {
    throw new OpsStopError(`P0 대상이 아니다 - couples.status가 active가 아니다 (${couple.status})`)
  }
  if (couple.members.length !== 2 || couple.members.some((m) => m.ai_usage_agreed_at === null)) {
    throw new OpsStopError('P0 대상이 아니다 - 두 구성원 모두 ai_usage_agreed_at이 있어야 한다')
  }

  // ── 84-a 모델 fail-closed(R21-1): 호 행을 만들기 전에 - 거부면 LLM 0 · DB 쓰기 0 ─────────
  let model: AllowedLlmModel | null = null
  if (mode === 'live') {
    const resolution = resolveLlmModel(await store.llmProviderConfig())
    if (!resolution.ok) {
      throw new OpsStopError(`모델 설정이 생성을 허용하지 않는다 (거부 코드 ${resolution.code}) - app_config.llm_provider 확인`)
    }
    model = resolution.model
  }
  const live = mode === 'live' ? (deps.live as LiveDeps) : null
  const issueDeadline: Deadline | null = live ? { startedAtMs: live.now(), limitMs: ISSUE_TIME_LIMIT_MS, stop: SAFETY_STOP.issueTime } : null
  const meter = model !== null ? new CostMeter(model, ISSUE_BUDGET_USD) : null
  let realApiCalls = 0

  // ── P0 호 준비: 기간당 한 행(유일 제약). 다시 돌려도 같다 ────────────────
  const issueType: IssueType = params.cadence
  const existing = await store.findIssue({ coupleId: params.coupleId, issueType, periodStart: params.periodStart })
  if (existing !== null && existing.published_at !== null) {
    throw new OpsStopError(`이미 발행된 호다 (${existing.id}) - 다시 생성하지 않는다`)
  }
  let issue: IssueRow
  let issueCreated = false
  if (existing !== null) {
    issue = existing
  } else {
    issue = await store.insertIssue({
      couple_id: params.coupleId,
      issue_type: issueType,
      period_start: params.periodStart,
      period_end: inclusiveEndDate(params.periodEndExclusive),
      publish_mode: 'compressed',
    })
    issueCreated = true
  }

  // 미해결 경보가 있는 호는 건너뛴다(17-0-10-F, 반복 방지).
  const openAlerts = await store.openAlerts(issue.id)
  if (openAlerts.length > 0) {
    throw new OpsStopError(`이 호에 열린 운영 경보가 ${openAlerts.length}건 있다 (${issue.id}) - 처리(resolved_at) 전에는 생성하지 않는다`)
  }

  // 코너 행(없는 것만 만든다). 순서는 `CORNER_TABLE`.
  const rows = new Map<string, CornerRow>((await store.listCorners(issue.id)).map((c) => [c.corner_type, c]))
  for (const [index, entry] of CORNER_TABLE.entries()) {
    if (!rows.has(entry.kind)) {
      rows.set(
        entry.kind,
        await store.insertCorner({
          couple_id: params.coupleId,
          issue_id: issue.id,
          corner_type: entry.kind,
          seq: index + 1,
          period_start: params.periodStart,
          period_end: inclusiveEndDate(params.periodEndExclusive),
        }),
      )
    }
  }

  // ── P1 입력 조립(기존). 소속 위반은 호 전체를 멈추고 경보(r48) ─────────────
  let assembled: AssembledInput
  try {
    assembled = await assembleCornerInput(store.assemblyClient, context, issue.id)
  } catch (error) {
    if (error instanceof CoupleMembershipError && !(error instanceof InvalidCornerContextError)) {
      await store.insertAlert({
        kind: 'couple_membership',
        couple_id: params.coupleId,
        issue_id: issue.id,
        detail: { stage: 'input_assembly', offendingRecordIds: [...error.offendingRecordIds] },
      })
    }
    throw error
  }

  // ── P2~P5: 코너마다 골격을 돌린다(응답 자리만 샘플) ──────────────────────
  const reports: CornerReport[] = []
  const alertIds: string[] = []
  let regenerated = false
  for (const entry of CORNER_TABLE) {
    const row = rows.get(entry.kind) as CornerRow
    const input = entry.inputOf(assembled)
    const estimate = entry.module.hasMaterial(input)
      ? estimateRequestTokens(entry.module.buildRequest(input, context), INPUT_TOKEN_STOP_BAND)
      : null

    // 이미 성공한 코너는 다시 만들지 않는다(17-0-6 멱등).
    if (row.status === 'ready' || row.status === 'published') {
      reports.push({
        cornerType: entry.kind,
        cornerId: row.id,
        outcome: 'kept_ready',
        status: row.status,
        skipReason: row.skip_reason,
        estimatedInputTokens: estimate,
        sampleResponses: 0,
        realApiCalls: 0,
        detail: null,
      })
      continue
    }

    // 84-a: 1호 20분 - 마감이 지났으면 남은 코너를 시작하지 않는다(pending 그대로 · 경보).
    if (live !== null && issueDeadline !== null && live.now() - issueDeadline.startedAtMs >= issueDeadline.limitMs) {
      const alert = await store.insertAlert({
        kind: 'usage_over',
        couple_id: params.coupleId,
        issue_id: issue.id,
        detail: { stage: SAFETY_STOP.issueTime, cornerType: entry.kind },
      })
      alertIds.push(alert.id)
      reports.push({
        cornerType: entry.kind,
        cornerId: row.id,
        outcome: 'halted_pending',
        status: row.status,
        skipReason: null,
        estimatedInputTokens: estimate,
        sampleResponses: 0,
        realApiCalls: 0,
        detail: SAFETY_STOP.issueTime,
      })
      continue
    }

    // 샘플 응답은 이 실행의 입력에서 만든다. 재료가 없으면 골격의 선행 검사(`hasMaterial`)가 호출 전에 멈춘다.
    const sample = live === null ? createSampleLlmClient(JSON.stringify(entry.sampleOf(input))) : null
    // 84-a 실제 모드: 코너 8분 · 1호 20분 · 1호 $2를 시도 직전마다 본다. 사용량은 응답마다 더한다.
    let cornerUsage: LlmUsage = ZERO_USAGE
    let cornerAttempts = 0
    let cornerLatencyMs = 0
    let client: LlmClient
    if (live !== null && model !== null && meter !== null && issueDeadline !== null) {
      const activeModel = model
      const activeMeter = meter
      const activeIssueDeadline = issueDeadline
      const cornerDeadline: Deadline = { startedAtMs: live.now(), limitMs: CORNER_TIME_LIMIT_MS, stop: SAFETY_STOP.cornerTime }
      client = live.createClient({
        model: activeModel,
        beforeAttempt: (request) => {
          const worst = worstCallCostUsd(activeModel, estimateRequestTokens(request, 'high'))
          if (!activeMeter.canAfford(worst)) return { ok: false, stop: SAFETY_STOP.cost }
          const budget = callBudgetMs([cornerDeadline, activeIssueDeadline], live.now())
          if (!budget.ok) return { ok: false, stop: budget.stop }
          cornerAttempts += 1
          realApiCalls += 1
          return { ok: true, timeoutMs: budget.timeoutMs }
        },
        onResponse: (info) => {
          cornerLatencyMs += info.latencyMs
          if (info.usage !== null) {
            activeMeter.record(info.usage)
            cornerUsage = addUsage(cornerUsage, info.usage)
          }
        },
      })
    } else {
      client = sample as LlmClient
    }
    const result = await runCornerModule(entry.module, { input, context, llmClient: client })
    const engineVersion = model !== null ? `${LIVE_ENGINE_VERSION_PREFIX}${model}` : SAMPLE_ENGINE_VERSION
    const usedModel = model
    const usageRecord = (failure: string | null): CornerLlmUsage | null =>
      usedModel === null
        ? null
        : {
            model: usedModel,
            input: cornerUsage.input,
            output: cornerUsage.output,
            cacheWrite: cornerUsage.cacheWrite,
            cacheRead: cornerUsage.cacheRead,
            costUsd: usageCostUsd(usedModel, cornerUsage),
            attempts: cornerAttempts,
            latencyMs: cornerLatencyMs,
            failure,
          }
    const sampleResponses = sample?.calls() ?? 0

    if (result.outcome === 'success') {
      regenerated = true
      await saveCornerSuccess(store.cornersTable, {
        cornerId: row.id,
        content: result.content as never,
        coeffBundle: result.coeffBundle,
        // 샘플 모드는 LLM에 요청을 보내지 않는다 - 요청 수(`generation_attempts`)는 0. 실제 모드는 HTTP 시도 수.
        generationAttempts: cornerAttempts,
        engineVersion,
      })
      const used = usageRecord(null)
      if (used !== null) await store.setCornerUsage(row.id, used)
      if (entry.kind === 'date_archive') {
        await store.setCornerSourceDates(row.id, dateIdsOf(result.content))
      }
      reports.push({
        cornerType: entry.kind,
        cornerId: row.id,
        outcome: 'ready',
        status: 'ready',
        skipReason: null,
        estimatedInputTokens: estimate,
        sampleResponses,
        realApiCalls: cornerAttempts,
        detail: null,
      })
    } else if (result.outcome === 'failure') {
      regenerated = true
      await saveCornerFailure(store.cornersTable, {
        cornerId: row.id,
        reason: result.reason,
        detail: result.detail,
        generationAttempts: cornerAttempts,
        engineVersion,
      })
      const used = usageRecord(result.reason)
      if (used !== null) await store.setCornerUsage(row.id, used)
      reports.push({
        cornerType: entry.kind,
        cornerId: row.id,
        outcome: result.reason === 'insufficient_input' ? 'skipped_insufficient_input' : 'failed',
        status: result.reason === 'insufficient_input' ? 'skipped' : 'failed',
        skipReason: result.reason,
        estimatedInputTokens: estimate,
        sampleResponses,
        realApiCalls: cornerAttempts,
        detail: result.detail,
      })
    } else {
      // 안전 정지(R20-2 · 84-a): 코너는 pending 그대로(content · 사유를 쓰지 않는다), 운영 경보 usage_over. ID·숫자·종류뿐.
      const detail: Record<string, unknown> =
        result.haltedFor === 'input_token_limit'
          ? { stage: 'input_halt', cornerType: entry.kind, estimatedInputTokens: result.estimatedInputTokens, limit: result.limit }
          : { stage: result.haltedFor, cornerType: entry.kind, attempts: cornerAttempts }
      const alert = await store.insertAlert({ kind: 'usage_over', couple_id: params.coupleId, issue_id: issue.id, detail })
      alertIds.push(alert.id)
      const used = usageRecord(result.haltedFor)
      if (used !== null && cornerAttempts > 0) await store.setCornerUsage(row.id, used)
      reports.push({
        cornerType: entry.kind,
        cornerId: row.id,
        outcome: 'halted_pending',
        status: row.status,
        skipReason: null,
        estimatedInputTokens: result.haltedFor === 'input_token_limit' ? result.estimatedInputTokens : estimate,
        sampleResponses,
        realApiCalls: cornerAttempts,
        detail: result.detail,
      })
    }
  }

  // 발행 가드 ②(R23-3): 코너가 (다시) 생성됐으면 그 호의 렌더 세 필드를 비운다 - 다시 렌더해야 발행된다.
  if (regenerated) await store.clearRender(issue.id)

  // ── P7 미디어 복제 - 저장된 ready 코너의 사진을 목적지로 ──────────────────
  const fresh = await store.listCorners(issue.id)
  const mediaReport = await copyIssueMedia({
    store,
    media,
    coupleId: params.coupleId,
    issueId: issue.id,
    corners: fresh.filter((c) => c.status === 'ready'),
  })
  // 원본이 사라져 pending으로 되돌린 코너는 보고에도 그대로 반영한다.
  const finalReports = reports.map((r) =>
    mediaReport.resetCornerIds.includes(r.cornerId)
      ? { ...r, outcome: 'halted_pending' as const, status: 'pending', detail: 'source_media_missing' }
      : r,
  )

  return {
    mode,
    realApiCalls,
    model,
    costUsd: meter?.spentUsd() ?? 0,
    coupleId: params.coupleId,
    issueId: issue.id,
    issueCreated,
    period: { start: params.periodStart, endExclusive: params.periodEndExclusive },
    exclusions: assembled.exclusions,
    counts: { messages: assembled.messages.length, photos: assembled.photos.length, dates: assembled.dates.length },
    corners: finalReports,
    alertIds,
    media: mediaReport,
  }
}

/** 17-1 저장 content의 기사들이 가리키는 데이트 ID(실린 데이트, 17-0-10-E). */
function dateIdsOf(content: unknown): string[] {
  const payload = (content as { payload?: { articles?: { dateId?: unknown }[] } }).payload
  const ids = (payload?.articles ?? []).map((a) => a.dateId)
  return ids.filter((id): id is string => typeof id === 'string')
}
