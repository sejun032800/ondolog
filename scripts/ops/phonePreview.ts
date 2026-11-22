/**
 * 51- ③ ③ 두 폰 커플 미리 보기(`--allow-phone-test-couple --dry-run`) - **쓰기 0 · LLM 0**. 위임: .claude/state/prompts/phase-7/51-3-dispatch-phone-couple-live.md
 *
 * 대상 커플(두 겹 잠금의 (가)로 찾은 것)의 기간 후보(달)와 **날짜별 개수만** 낸다 - 메시지 · 데이트 · 사진 수, 날짜는 `YYYY-MM-DD`.
 * 그리고 생성이 먼저 보는 선행 검사를 같은 함수로 미리 돌려 **결과만** 낸다: 별명 "test" · active · AI 동의(P0) · 모델 설정(fail-closed) ·
 * 그 달 호 상태(없음 · 초안 · 발행됨) · 코너별 재료 유무 · 추정 입력 토큰과 정지 상한.
 *
 * 출력에 원문 · 이름 · 커플/계정/메시지 id · 이메일 0. "다툰 날로 볼 만한 표시"는 없다(엔진은 모른다 - 내지 않는다).
 * 읽기만: `OpsStore`의 조회 함수(`getCouple` · `llmProviderConfig` · `findIssue` · 입력 조립 `assemblyClient`)와 `PreviewPort.activityRange`.
 * 입력 조립에 넘기는 호 id는 사진 목적지 경로 모양을 맞추는 자리 값일 뿐이다(DB에 쓰지 않음 · 출력 0).
 */

import { assembleCornerInput, type AssembledInput } from '../../supabase/functions/_shared/inputAssembly.ts'
import { INPUT_TOKEN_STOP_BAND, INPUT_TOKEN_STOP_LIMIT, estimateRequestTokens } from '../../supabase/functions/_shared/tokenEstimate.ts'
import type { CornerContext } from '../../supabase/functions/_shared/cornerPipeline.ts'
import { resolveLlmModel } from '../../src/engine/corners/llmSafety.ts'
import { CORNER_TABLE, inclusiveEndDate } from './generateIssue.ts'
import { hasTestMark } from './opsGuards.ts'
import type { OpsStore } from './opsStore.ts'

/** 기록이 있는 처음 · 마지막 날(KST `YYYY-MM-DD`). 기록이 없으면 둘 다 null. */
export interface ActivityRange {
  readonly first: string | null
  readonly last: string | null
}

export interface PreviewPort {
  /** 메시지(`sent_at`) · 데이트(`date_on`) · 사진(`captured_at`) 중 지워지지 않은 것의 처음 · 마지막 KST 날짜. */
  activityRange(coupleId: string): Promise<ActivityRange>
}

/** 미리 보기가 훑는 달 수 상한(마지막 달부터). */
export const PREVIEW_MAX_MONTHS = 24
/** 입력 조립 자리 값(사진 목적지 경로 모양만 - 쓰기 · 출력 0). */
export const PREVIEW_ISSUE_PLACEHOLDER = '00000000-0000-4000-8000-000000000000'

const CORNER_LABEL: Record<string, string> = { date_archive: '데이트 아카이브', sweet_words: '다정한 말들', this_month: '이달의 우리' }

/** 시각 -> KST 날짜. */
export function kstDayOf(at: Date): string {
  return new Date(at.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` 둘 사이의 달(`YYYY-MM`) - 끝 달 포함, 마지막 `max`개만. */
export function monthsBetween(first: string, last: string, max: number = PREVIEW_MAX_MONTHS): string[] {
  const out: string[] = []
  let y = Number(first.slice(0, 4))
  let m = Number(first.slice(5, 7))
  const ly = Number(last.slice(0, 4))
  const lm = Number(last.slice(5, 7))
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m === 13) {
      m = 1
      y += 1
    }
  }
  return out.slice(-max)
}

function nextMonthStart(month: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

/** 날짜별 개수(이번 기간 기록만 - 재소환 데이트는 따로 수만). */
export function dayCounts(a: AssembledInput): { day: string; messages: number; dates: number; photos: number }[] {
  const by = new Map<string, { messages: number; dates: number; photos: number }>()
  const bump = (day: string, k: 'messages' | 'dates' | 'photos') => {
    const row = by.get(day) ?? { messages: 0, dates: 0, photos: 0 }
    row[k] += 1
    by.set(day, row)
  }
  for (const m of a.messages) bump(kstDayOf(m.occurredAt), 'messages')
  for (const p of a.photos) bump(kstDayOf(p.occurredAt), 'photos')
  for (const d of a.dates) if (d.recalled !== true) bump(d.source.dateOn, 'dates')
  return [...by.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([day, c]) => ({ day, ...c }))
}

/** 미리 보기 줄들. 쓰기 0 · LLM 0. 줄에 원문 · id · 이메일 0. */
export async function previewPhoneCouple(store: OpsStore, port: PreviewPort, coupleId: string): Promise<string[]> {
  const out: string[] = ['미리 보기 - 쓰기 0 · LLM 0 · 대상 = 허용 목록 계정 두 명의 커플 1개(id는 출력하지 않는다)', '']

  // ── 선행 검사: 생성(`generateIssue.ts`)이 호 행을 만들기 전에 보는 것과 같은 조건 ─────────
  const couple = await store.getCouple(coupleId)
  if (couple === null) return [...out, '선행 검사: 커플을 읽을 수 없다 - 생성은 멈춘다']
  const agreed = couple.members.filter((m) => m.ai_usage_agreed_at !== null).length
  const p0: string[] = []
  if (!hasTestMark(couple.nickname)) p0.push("별명에 'test' 없음")
  if (couple.status !== 'active') p0.push(`상태 ${couple.status}`)
  if (couple.members.length !== 2 || agreed !== 2) p0.push(`AI 동의 ${agreed}/${couple.members.length}`)
  out.push(
    `선행 검사(P0): 별명 test 표시 ${hasTestMark(couple.nickname) ? '있음' : '없음'} · 상태 ${couple.status} · AI 동의 ${agreed}/${couple.members.length} -> ${p0.length === 0 ? '통과' : '생성은 멈춘다(' + p0.join(' · ') + ')'}`,
  )
  const model = resolveLlmModel(await store.llmProviderConfig())
  out.push(`모델 설정(app_config.llm_provider): ${model.ok ? '허용 - ' + model.model : '거부 코드 ' + model.code + ' - 생성은 호 행을 만들기 전에 멈춘다'}`)

  const range = await port.activityRange(coupleId)
  if (range.first === null || range.last === null) {
    out.push('기록 범위: 기록 0 - 기간 후보 없음')
    return out
  }
  out.push(`기록 범위: ${range.first} ~ ${range.last} (KST)`, '')

  // ── 달마다: 입력 조립(읽기) -> 날짜별 개수 · 코너 재료 · 추정 토큰 · 그 달 호 상태 ─────────
  for (const month of monthsBetween(range.first, range.last)) {
    const start = `${month}-01`
    const endExclusive = nextMonthStart(month)
    const context: CornerContext = {
      coupleId,
      cadence: 'monthly',
      period: { start: new Date(`${start}T00:00:00+09:00`), end: new Date(`${endExclusive}T00:00:00+09:00`) },
    }
    const assembled = await assembleCornerInput(store.assemblyClient, context, PREVIEW_ISSUE_PLACEHOLDER)
    const days = dayCounts(assembled)
    const sum = days.reduce((a, d) => ({ messages: a.messages + d.messages, dates: a.dates + d.dates, photos: a.photos + d.photos }), { messages: 0, dates: 0, photos: 0 })
    const recalled = assembled.dates.filter((d) => d.recalled === true).length
    const issue = await store.findIssue({ coupleId, issueType: 'monthly', periodStart: start })
    const issueState = issue === null ? '없음(새로 만든다)' : issue.published_at !== null ? '발행됨 - 다시 생성하지 않는다(멈춤)' : '초안 있음(이어 쓴다 · ready 코너는 다시 만들지 않는다)'
    out.push(`## ${month} - 기간 ${start} ~ ${inclusiveEndDate(endExclusive)} (--period-start ${start} --period-end ${endExclusive})`)
    out.push(`- 합계: 메시지 ${sum.messages} · 데이트 ${sum.dates} · 사진 ${sum.photos} · 재소환 데이트 ${recalled} · 뺀 메시지(본문 없음 ${assembled.exclusions.messagesWithoutBody} · 짧은 조각 ${assembled.exclusions.trivialMessages})`)
    out.push(`- 그 달 호: ${issueState}`)
    for (const entry of CORNER_TABLE) {
      const input = entry.inputOf(assembled)
      if (!entry.module.hasMaterial(input)) {
        out.push(`- ${CORNER_LABEL[entry.kind]}: 재료 없음 -> 빠짐(insufficient_input) · LLM 0`)
        continue
      }
      const tokens = estimateRequestTokens(entry.module.buildRequest(input, context), INPUT_TOKEN_STOP_BAND)
      out.push(`- ${CORNER_LABEL[entry.kind]}: 재료 있음 · 추정 입력 토큰 ${tokens} (${tokens > INPUT_TOKEN_STOP_LIMIT ? '상한 ' + INPUT_TOKEN_STOP_LIMIT + ' 넘음 -> 안전 정지 · LLM 0' : '상한 ' + INPUT_TOKEN_STOP_LIMIT + ' 이내'})`)
    }
    if (days.length === 0) out.push('- 날짜별: 없음')
    else for (const d of days) out.push(`  ${d.day}  메시지 ${d.messages} · 데이트 ${d.dates} · 사진 ${d.photos}`)
    out.push('')
  }
  return out
}
