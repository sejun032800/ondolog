/**
 * 2.0-A1 어림짐작 (코너 `rough_guess`) — 7번 한 줄 요청 · 응답 처리 (MASTER 17-9 · 기획서 2절 6. · 계약 `rough_guess.json`).
 * 위임: .claude/state/prompts/phase-7/m20-a1-dispatch-engines.md ③.
 *
 * - 8항목 가운데 1~6 · 8번과 7번의 날짜 · 건수는 엔진(`src/engine/roughGuess.ts`)이 정해 입력으로 들어온다.
 * - LLM은 **1회**, "가장 말이 많았던 날" 하루치 메시지만 보고 한 줄("그날은 OO 얘기가 오갔습니다")을 쓴다. 주제를 뽑을 수
 *   없거나 다툼 · 서운함이 오간 날이면 `line: null`(날짜만 싣는다 - MASTER 17-9 "추출 불가 시").
 * - 검사: 길이 20 · 정책어 · "유저/사용자"(84-a/g) · 말투(합니다체) · 숫자 · 시각 · 요일(84-c, 그날 메시지가 입력값) ·
 *   꼴("그날은 … 얘기가 오갔습니다") · 판정 낱말(다툼 · 싸움 · 서운 …).
 * - 엔진을 부르지 않는다(Deno 경로). 원문 · id 참조 0(`NO_ID_REFERENCES`) - 한 줄은 원문을 옮기지 않는다.
 */

import { z } from 'zod'
import type { CornerContext, CornerModule, CornerResponseSpec, DerivedValues } from '../cornerPipeline.ts'
import { NO_ID_REFERENCES } from '../cornerPipeline.ts'
import type { LlmRequest, PromptBlock } from '../llmRequest.ts'
import { periodLabelOf } from '../periodLabel.ts'
import { NEW_PAGE_TITLES } from '../../../../src/types/corners/cornerTitles.ts'
import {
  CORNER_SCHEMA_VERSION,
  RoughGuessStoredSchema,
  stringMaxCodePoints,
  type RoughGuessPayload,
  type RoughGuessStored,
} from '../../../../src/types/corners/storedContent.ts'
import { COMMON_PRINCIPLES_BLOCK, inChronologicalOrder, messageLine, type ChatMessageRecord } from './cornerCommon.ts'
import { ROUGH_GUESS_JUDGEMENT_WORDS, ROUGH_GUESS_VALUE_RULES, findJudgementWords } from '../../../../src/engine/corners/valueChecks.ts'
import { runContentChecks } from '../../../../src/engine/corners/contentChecks.ts'
import { factsOf } from './contentTargets.ts'

/** 엔진이 정한 칸(7번 한 줄 제외). `busiestDay`는 늘 있다(없으면 엔진이 코너를 뺀다). */
export type RoughGuessFactsInput = Omit<RoughGuessPayload, 'busiestDay'> & {
  readonly busiestDay: Omit<NonNullable<RoughGuessPayload['busiestDay']>, 'line'>
}

export interface RoughGuessInput {
  /** null = 성격 데이터 없음 또는 채팅이 모자람 → 호출 전 빠짐. */
  readonly facts: RoughGuessFactsInput | null
  /** 가장 말이 많았던 날(KST)의 메시지(입력 조립이 실은 본문 있는 메시지). */
  readonly dayMessages: readonly ChatMessageRecord[]
}

export const roughGuessLlmSchema = z.object({ line: stringMaxCodePoints(20).nullable() })
export type RoughGuessLlmOutput = z.infer<typeof roughGuessLlmSchema>

/** MASTER 17-9 형식 "그날은 OO 얘기가 오갔습니다". */
export const BUSIEST_LINE_PATTERN = /^그날은 \S(?:.*\S)? 얘기가 오갔습니다\.?$/

const CORNER_INSTRUCTION_BLOCK: PromptBlock = {
  text: [
    '코너: 어림짐작 - 가장 말이 많았던 날',
    '',
    '입력은 두 사람이 이번 달 가장 많이 대화한 하루의 메시지다. 그날 대화에서 되풀이된 이야깃거리 하나를 골라 한 줄을 쓴다.',
    '',
    '쓰는 것',
    '- line(글 칸, 20자 이내): "그날은 OO 얘기가 오갔습니다" 꼴 그대로. OO에는 그날 메시지에 되풀이해 나온 소재 낱말(이사, 여행, 저녁 메뉴 같은 것)을 넣는다.',
    '',
    '쓰지 않는 때',
    '- 되풀이된 소재를 고를 수 없거나, 그날 다툼 · 서운함 · 갈등이 오갔으면 line을 null로 낸다. 좋게 포장하지도, 부정적으로 쓰지도 않는다.',
    '- "다퉜습니다", "싸웠습니다" 같은 서술, 감상, 평가를 쓰지 않는다.',
    '',
    '출력 형식(JSON 하나)',
    '{"line":"그날은 이사 얘기가 오갔습니다"} 또는 {"line":null}',
  ].join('\n'),
  cacheBreakpoint: true,
}

function buildRequest(input: RoughGuessInput, context: CornerContext): LlmRequest {
  if (input.facts === null) throw new Error('roughGuess.buildRequest: 재료 없음 - hasMaterial이 먼저 막는다')
  return {
    system: [COMMON_PRINCIPLES_BLOCK, CORNER_INSTRUCTION_BLOCK],
    user: [
      { text: `기간: ${periodLabelOf(context)} · 그날: ${input.facts.busiestDay.date}` },
      { text: ['그날 메시지(한 줄이 한 건, 시각 순):', ...inChronologicalOrder(input.dayMessages).map(messageLine)].join('\n') },
    ],
  }
}

function contentChecksFor(input: RoughGuessInput): (llm: RoughGuessLlmOutput) => string[] {
  return (llm) => {
    if (llm.line === null || input.facts === null) return []
    const facts = factsOf(input.dayMessages, [], [])
    const day = input.facts.busiestDay.date
    const out = runContentChecks([{ field: 'line', tone: 'text', text: llm.line, facts, contextDates: [day], knownDates: [day] }])
    if (!BUSIEST_LINE_PATTERN.test(llm.line)) out.push('line: 꼴 "그날은 OO 얘기가 오갔습니다"가 아니다')
    out.push(...findJudgementWords(llm, ['line'], ROUGH_GUESS_JUDGEMENT_WORDS))
    return out
  }
}

function deriveFor(input: RoughGuessInput, context: CornerContext) {
  const titles = NEW_PAGE_TITLES.rough_guess
  return (value: unknown): DerivedValues => {
    const parsed = roughGuessLlmSchema.safeParse(value)
    if (!parsed.success) return { ok: false, detail: parsed.error.message }
    if (input.facts === null) return { ok: false, detail: '재료 없음' }
    return {
      ok: true,
      value: {
        schemaVersion: CORNER_SCHEMA_VERSION,
        header: { cornerName: titles.cornerName, title: titles.pageTitle, periodLabel: periodLabelOf(context) },
        payload: { ...input.facts, busiestDay: { ...input.facts.busiestDay, line: parsed.data.line } },
      },
    }
  }
}

function responseSpec(input: RoughGuessInput, context: CornerContext): CornerResponseSpec<RoughGuessLlmOutput, RoughGuessStored> {
  return {
    llmSchema: roughGuessLlmSchema,
    // 한 줄이 null이어도 코너는 실린다(날짜만) - 명시적 빈 결과가 아니다.
    isExplicitEmpty: () => false,
    references: NO_ID_REFERENCES,
    derive: deriveFor(input, context),
    storedSchema: RoughGuessStoredSchema,
    valueRules: ROUGH_GUESS_VALUE_RULES,
    contentChecks: contentChecksFor(input),
  }
}

export const roughGuessModule: CornerModule<RoughGuessInput, RoughGuessLlmOutput, RoughGuessStored> = {
  cornerName: NEW_PAGE_TITLES.rough_guess.cornerName,
  pageTitle: NEW_PAGE_TITLES.rough_guess.pageTitle,
  hasMaterial: (input) => input.facts !== null,
  scopedRecords: (input) => input.dayMessages,
  buildRequest,
  responseSpec,
}
