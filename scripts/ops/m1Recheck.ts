/**
 * 84-c 다시 검사(`m1QualityRun.ts recheck`) - 저장된 하네스 실행(`scripts/ops/out/runs/*.json`)의 **모든 시도**를 새 내용 검사
 * (칸별 말투 · 숫자/시각 · 요일, `contentChecks.ts`)로 다시 돌린다. **LLM 호출 0 · 네트워크 0.**
 * 위임: .claude/state/prompts/phase-7/84-c-dispatch-auto-checks.md (ROADMAP r133 R133-5)
 *
 * - 입력은 그 실행이 쓴 합성 데이터셋을 같은 연도로 다시 조립한다(`fixtureYear`, 없으면 84-c 전 실행 = 2026).
 * - 실행 기록의 LLM 출력(시도 원문)을 코너의 LLM 출력 스키마로 읽은 뒤 코너가 만드는 내용 검사를 그대로 부른다 -
 *   검사 코드를 따로 두지 않는다(3차 뒤에도 같은 명령).
 * - 결과는 칸 · 규칙 · 짧은 표기(시각 · 요일 낱말)만이다. 문장은 내지 않는다.
 * 이 파일은 Deno API를 쓰지 않는다(시험이 그대로 부른다). 파일 읽기 · 쓰기는 하네스가 한다.
 */

import { assembleCornerInput, type AssembledInput } from '../../supabase/functions/_shared/inputAssembly.ts'
import { fakeClient } from '../../supabase/functions/_shared/testFixtures/inputAssemblyFake.ts'
import type { CornerContext, CornerModule } from '../../supabase/functions/_shared/cornerPipeline.ts'
import { dateArchiveModule } from '../../supabase/functions/_shared/corners/dateArchive.ts'
import { sweetWordsModule } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import { thisMonthModule } from '../../supabase/functions/_shared/corners/thisMonth.ts'
import { COUPLE_ID, buildTables, periodOf } from './fixtures/m1-month/dataset.ts'
import type { CornerKey, RunRecord } from './m1Review.ts'

/** 84-c 전 실행(`fixtureYear` 없음)의 데이터 연도. */
export const LEGACY_FIXTURE_YEAR = 2026

// deno-lint-ignore no-explicit-any
type AnyCorner = CornerModule<any, any, any>

/** 코너 3종과 조립된 입력에서 코너 입력을 꺼내는 법(하네스 `run`과 같은 표). */
export function cornerTable(): Record<CornerKey, { readonly module: AnyCorner; readonly input: (a: AssembledInput) => unknown }> {
  return {
    date_archive: { module: dateArchiveModule, input: (a) => ({ dates: a.dates }) },
    sweet_words: { module: sweetWordsModule, input: (a) => ({ warmthIndex: null, messages: a.messages }) },
    this_month: { module: thisMonthModule, input: (a) => ({ messages: a.messages, photos: a.photos, dates: a.dates }) },
  }
}

export function contextOf(year: number): CornerContext {
  return { coupleId: COUPLE_ID, period: periodOf(year), cadence: 'monthly' }
}

/** 합성 데이터셋을 그 연도로 조립한다(호 ID는 하네스와 같은 합성 값). */
export async function assembleFixture(year: number): Promise<AssembledInput> {
  return await assembleCornerInput(fakeClient(buildTables(year)), contextOf(year), 'issue-m1')
}

export type RecheckCategory = '말투' | '시각' | '날짜' | '숫자' | '요일'

export interface RecheckRow {
  readonly model: string
  readonly corner: CornerKey
  readonly run: number
  readonly attempt: number
  /** 지면에 실린 시도인가(성공 회차의 마지막 시도). */
  readonly published: boolean
  /** LLM 출력 스키마로 읽혔는가(아니면 내용 검사 대상이 아님). */
  readonly parsed: boolean
  readonly violations: readonly string[]
}

/** 위반 한 줄의 종류. */
export function categoryOf(violation: string): RecheckCategory {
  if (violation.includes('말투')) return '말투'
  if (violation.includes('요일')) return '요일'
  if (violation.includes('시각')) return '시각'
  if (/날짜|연도|달 「/.test(violation)) return '날짜'
  return '숫자'
}

/** 실행 기록들을 다시 검사한다. 연도별로 입력을 한 번씩만 조립한다. */
export async function recheckRecords(records: readonly RunRecord[]): Promise<RecheckRow[]> {
  const table = cornerTable()
  const assembled = new Map<number, AssembledInput>()
  const rows: RecheckRow[] = []
  for (const rec of records) {
    const year = rec.fixtureYear ?? LEGACY_FIXTURE_YEAR
    if (!assembled.has(year)) assembled.set(year, await assembleFixture(year))
    const entry = table[rec.corner]
    const input = entry.input(assembled.get(year)!)
    const spec = entry.module.responseSpec(input, contextOf(year))
    rec.attempts.forEach((a, i) => {
      const published = rec.outcome === 'success' && i === rec.attempts.length - 1
      let parsedValue: unknown
      try {
        parsedValue = JSON.parse(a.text)
      } catch {
        rows.push({ model: rec.model, corner: rec.corner, run: rec.run, attempt: a.index, published, parsed: false, violations: [] })
        return
      }
      const parsed = spec.llmSchema.safeParse(parsedValue)
      if (!parsed.success || spec.contentChecks === undefined) {
        rows.push({ model: rec.model, corner: rec.corner, run: rec.run, attempt: a.index, published, parsed: false, violations: [] })
        return
      }
      rows.push({
        model: rec.model,
        corner: rec.corner,
        run: rec.run,
        attempt: a.index,
        published,
        parsed: true,
        violations: [...spec.contentChecks(parsed.data)],
      })
    })
  }
  rows.sort((x, y) => x.model.localeCompare(y.model) || x.corner.localeCompare(y.corner) || x.run - y.run || x.attempt - y.attempt)
  return rows
}

const CATEGORIES: readonly RecheckCategory[] = ['말투', '시각', '날짜', '숫자', '요일']

/** 다시 검사 표(markdown). 문장 0 - 칸 · 규칙 · 표기 조각만. */
export function renderRecheck(rows: readonly RecheckRow[]): string {
  const out: string[] = ['# 다시 검사 (84-c 내용 검사 · LLM 호출 0)', '']
  out.push('| 모델 | 코너 | 회차 | 시도 | 실림 | ' + CATEGORIES.join(' | ') + ' |', '|---|---|---|---|---|' + CATEGORIES.map(() => '---|').join(''))
  for (const r of rows) {
    const counts = CATEGORIES.map((c) => (r.parsed ? String(r.violations.filter((v) => categoryOf(v) === c).length) : '-'))
    out.push(`| ${r.model} | ${r.corner} | ${r.run} | ${r.attempt} | ${r.published ? '실림' : '안 실림'} | ${counts.join(' | ')} |`)
  }
  out.push('', '## 상세 (칸 · 규칙)', '')
  for (const r of rows) {
    if (!r.parsed) {
      out.push(`- ${r.model} ${r.corner} r${r.run} 시도${r.attempt}: 출력 스키마로 읽히지 않음(내용 검사 대상 아님)`)
      continue
    }
    for (const v of r.violations) out.push(`- ${r.model} ${r.corner} r${r.run} 시도${r.attempt}${r.published ? ' (실림)' : ''}: ${v.replace(/\|/g, '\\|')}`)
  }
  const total = rows.reduce((n, r) => n + r.violations.length, 0)
  out.push('', `합계: 시도 ${rows.length} · 위반 ${total}`)
  return out.join('\n')
}
