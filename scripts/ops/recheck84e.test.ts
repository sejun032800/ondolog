/// <reference types="jest" />
/**
 * 84-e(R137-3 ①) - 다시 검사(`recheck`)가 자기 점검 칸(`conflict`)이 없는 옛 다정한 말 출력을 어떻게 다루는지.
 * 위임: .claude/state/prompts/phase-7/84-e-dispatch-selfcheck-id-meteor.md
 * 결정: 건너뛰지 않고 **표시**한다(`legacyNoFlag`) - 지금 검증기로는 형식 오류이고, 84-c 내용 검사는 빠진 칸만 false로 채워 계속 본다. LLM 0 · 네트워크 0.
 */
import { sweetWordsLlmSchema } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import { renderRecheck, withLegacySelfCheck, type RecheckRow } from './m1Recheck.ts'

const OLD = { kind: 'excerpts', main: [{ context: '점심시간에 오간 대화', turns: [{ messageId: 'm-1' }] }], sub: [{ messageId: 'm-2' }] }

describe('84-e recheck - 자기 점검 칸 없는 옛 결과', () => {
  it('옛 출력은 지금 LLM 출력 스키마로는 형식 오류다', () => {
    expect(sweetWordsLlmSchema('monthly').safeParse(OLD).success).toBe(false)
  })

  it('빠진 칸만 false로 채운다 - 있는 값 · 다른 코너 · none은 그대로', () => {
    const filled = withLegacySelfCheck(OLD) as typeof OLD & { main: Array<{ conflict: boolean }>; sub: Array<{ conflict: boolean }> }
    expect(filled.main[0].conflict).toBe(false)
    expect(filled.sub[0].conflict).toBe(false)
    expect(sweetWordsLlmSchema('monthly').safeParse(filled).success).toBe(true)
    const kept = withLegacySelfCheck({ ...OLD, main: [{ ...OLD.main[0], conflict: true }] }) as { main: Array<{ conflict: boolean }> }
    expect(kept.main[0].conflict).toBe(true)
    expect(withLegacySelfCheck({ kind: 'none' })).toEqual({ kind: 'none' })
    expect(withLegacySelfCheck({ kind: 'theme', x: 1 })).toEqual({ kind: 'theme', x: 1 })
    expect(OLD.main[0]).not.toHaveProperty('conflict')                       // 원본은 건드리지 않는다
  })

  it('표가 옛 시도 수(그중 실림)를 따로 적는다', () => {
    const rows: RecheckRow[] = [
      { model: 'm', corner: 'sweet_words', run: 1, attempt: 1, published: true, parsed: true, violations: [], legacyNoFlag: true },
      { model: 'm', corner: 'this_month', run: 1, attempt: 1, published: true, parsed: true, violations: [] },
    ]
    expect(renderRecheck(rows)).toContain('84-e 자기 점검 칸(conflict) 없는 옛 다정한 말 시도: 1(그중 실림 1)')
    expect(renderRecheck(rows.slice(1))).not.toContain('84-e 자기 점검 칸')
  })
})
