/**
 * 84-g ④(ROADMAP r143 R143-3 ④) 자기 점검 집계 - 자기 점검 시험 데이터(`m1-month-conflict`)로 돈 다정한 말 회차에서
 * **고른 줄 중 다툰 날 · 화해 줄 수 / 그중 `conflict` 표시된 수 / 표시 없이 남아 실린 수(= 실패)**를 센다.
 * 순수 함수(파일 · 네트워크 · 시계 0). review · recheck가 같은 함수를 부른다. LLM 호출 0.
 *
 * 세는 단위 = **고른 항목**(대화 하나 = main 한 항목 · 한 줄 = sub 한 항목). 항목의 메시지 id 중 하나라도 "다툰 날 · 화해 줄"
 * (`conflictContextIds`)이면 그 항목은 다툰 날 · 화해 줄이다.
 * - 고른 수 · 표시 수 = 엔진이 받은 **마지막 응답**(회차의 마지막 시도 - 골격이 처리한 출력)에서 센다. 읽히지 않으면 0.
 * - 실린 수(실패) = 저장된 코너 내용(`content.payload` - `dropFlagged` 뒤)에 남은 다툰 날 · 화해 항목. 성공 회차만(아니면 0).
 */

import { CONFLICT_FIXTURE, conflictContextIds } from './fixtures/m1-month-conflict/dataset.ts'

/** 기본 데이터셋 이름(실행 기록에 `fixture`가 없으면 이것 - 84-g 전 기록 포함). */
export const DEFAULT_FIXTURE = 'm1-month'
export const FIXTURES = [DEFAULT_FIXTURE, CONFLICT_FIXTURE] as const
export type FixtureName = (typeof FIXTURES)[number]

/** 실행 기록의 데이터셋 이름(없으면 기본). */
export function fixtureOf(rec: { readonly fixture?: string }): string {
  return rec.fixture ?? DEFAULT_FIXTURE
}

/**
 * 하네스 `run`의 `--fixture` 값 해석(키를 읽기 전에 부른다). 없음 = 기본(84-g 전과 같음). 자기 점검 데이터는
 * `--corner sweet_words`일 때만(다른 코너 · `all`이면 멈춤 - 이 데이터는 다정한 말 시험용).
 */
export function resolveRunFixture(
  flag: string | undefined,
  corner: string,
): { readonly ok: true; readonly fixture: FixtureName } | { readonly ok: false; readonly message: string } {
  const fixture = flag ?? DEFAULT_FIXTURE
  if (!(FIXTURES as readonly string[]).includes(fixture)) return { ok: false, message: `--fixture는 ${FIXTURES.join(' · ')} 중 하나다` }
  if (fixture === CONFLICT_FIXTURE && corner !== 'sweet_words') {
    return { ok: false, message: `--fixture ${CONFLICT_FIXTURE}는 --corner sweet_words와 함께만 돈다` }
  }
  return { ok: true, fixture: fixture as FixtureName }
}

export function isSelfCheckRecord(rec: { readonly fixture?: string; readonly corner: string }): boolean {
  return fixtureOf(rec) === CONFLICT_FIXTURE && rec.corner === 'sweet_words'
}

export interface SelfCheckTally {
  /** 고른 항목 중 다툰 날 · 화해 항목 수(마지막 응답). */
  readonly picked: number
  /** 그중 `conflict: true`로 표시된 수. */
  readonly flagged: number
  /** 표시 없이 남아 실린 수(저장 내용) = 실패. */
  readonly published: number
}

type Item = { readonly ids: readonly string[]; readonly conflict: unknown }

function itemsOfOutput(value: unknown): Item[] {
  if (typeof value !== 'object' || value === null) return []
  const v = value as { kind?: unknown; main?: unknown; sub?: unknown }
  if (v.kind !== 'excerpts') return []
  const out: Item[] = []
  for (const m of Array.isArray(v.main) ? v.main : []) {
    const turns = Array.isArray((m as { turns?: unknown })?.turns) ? ((m as { turns: unknown[] }).turns) : []
    out.push({ ids: turns.map((t) => String((t as { messageId?: unknown })?.messageId ?? '')), conflict: (m as { conflict?: unknown })?.conflict })
  }
  for (const s of Array.isArray(v.sub) ? v.sub : []) {
    out.push({ ids: [String((s as { messageId?: unknown })?.messageId ?? '')], conflict: (s as { conflict?: unknown })?.conflict })
  }
  return out
}

function idsOfStored(content: unknown): string[][] {
  const p = (content as { payload?: { main?: unknown; sub?: unknown } } | null)?.payload
  if (p === undefined || p === null) return []
  const out: string[][] = []
  for (const m of Array.isArray(p.main) ? p.main : []) {
    const turns = Array.isArray((m as { turns?: unknown })?.turns) ? (m as { turns: unknown[] }).turns : []
    out.push(turns.map((t) => String((t as { messageId?: unknown })?.messageId ?? '')))
  }
  for (const s of Array.isArray(p.sub) ? p.sub : []) out.push([String((s as { messageId?: unknown })?.messageId ?? '')])
  return out
}

/** 한 회차의 집계. `contextIds` 기본값 = 자기 점검 시험 데이터의 다툰 날 · 화해 줄. */
export function tallySelfCheck(
  rec: { readonly attempts: readonly { readonly text: string }[]; readonly outcome: string; readonly content: unknown },
  contextIds: ReadonlySet<string> = conflictContextIds(),
): SelfCheckTally {
  const last = rec.attempts.at(-1)
  let parsed: unknown = null
  if (last !== undefined) {
    try {
      parsed = JSON.parse(last.text)
    } catch {
      parsed = null
    }
  }
  const hits = itemsOfOutput(parsed).filter((it) => it.ids.some((id) => contextIds.has(id)))
  const stored = rec.outcome === 'success' ? idsOfStored(rec.content) : []
  return {
    picked: hits.length,
    flagged: hits.filter((it) => it.conflict === true).length,
    published: stored.filter((ids) => ids.some((id) => contextIds.has(id))).length,
  }
}

/** 표 한 묶음(markdown 줄들). 문장 0 - 숫자만. */
export function renderSelfCheckTable(rows: readonly { readonly label: string; readonly outcome: string; readonly tally: SelfCheckTally }[]): string[] {
  const out = [
    '| 회차 | 결과 | 고른 줄 중 다툰 날 · 화해 줄 | 그중 conflict 표시 | 표시 없이 남아 실림(= 실패) |',
    '|---|---|---|---|---|',
  ]
  for (const r of rows) out.push(`| ${r.label} | ${r.outcome} | ${r.tally.picked} | ${r.tally.flagged} | ${r.tally.published} |`)
  const sum = rows.reduce((a, r) => ({ picked: a.picked + r.tally.picked, flagged: a.flagged + r.tally.flagged, published: a.published + r.tally.published }), {
    picked: 0,
    flagged: 0,
    published: 0,
  })
  out.push(`| 합계 | - | ${sum.picked} | ${sum.flagged} | ${sum.published} |`)
  return out
}
