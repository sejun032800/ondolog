/**
 * 17-4 다정한 말들 (코너 `sweet_words`) — 요청 만들기·응답 처리
 * (docs/ONDOLOG_MASTER.md Part 17-4, §17-0-4-A, §17-0-5-D, §17-0-7 / CORNER_CONTENT §6).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md.
 *
 * ── 이 코너가 하는 것 ───────────────────────────────────────────────────
 * LLM은 입력 메시지 중 **다정한 발화를 고르고**(id로), 대화 단위마다 **정황 한 문장**(`context`)을 쓴다. 그게
 * 전부다. 원문(`turns[].text`·`sub[].text`)·화자·시각·출처 표기는 LLM이 쓰지 않고 골격이 입력 레코드에서 옮겨
 * 적는다(17-0-4-A). 근거 없는 평가·감상은 쓸 자리가 없다.
 *
 * ── 이 코너가 하지 않는 것 ───────────────────────────────────────────────
 * 부르고 기다리는 코드, 판정 규칙(기간·커플·존재는 골격), 입력 조립(기간 내 채팅 조회는 별도 작업).
 *
 * ── 결정 (17-0-7) ───────────────────────────────────────────────────────
 * - `main` 개수: 월간 1~3, 일간 1. `sub`: 0~6. 대화(`turns`)는 1~4턴(CORNER_CONTENT §6-1).
 * - 코너 이름·지면 제목: 고정 상수(`cornerTitles.ts`). LLM이 쓰지 않는다.
 * - `warmthIndex`: 입력이 `number | null`로 싣고 그대로 주입한다. 산출식 미결정이라 지금은 `null`이다.
 * - 빈 결과: 선행 검사는 기간 내 채팅 0건(호출 전), 호출 후는 `{ "kind": "none" }`(다정한 발화를 찾지 못함).
 *   빈 결과는 파싱 실패와 섞이지 않는다(17-0-5-D).
 *
 * ── 파이프라인이 채우는 것 (저장 스키마의 `transform` 안, 순수) ────────────
 * - 대화 안 턴 순서: 시각 오름차순(같으면 LLM이 준 순서). 고르고 **배치**하는 일이다.
 * - 대화의 출처 표기(`attribution`): 그 대화 첫 턴 메시지의 표기. LLM이 정하지 않는다.
 * - 헤더·`warmthIndex`: 상수·입력.
 * 그 결과는 저장 스키마(`sweetWordsStoredSchema`)를 통과해야 한다.
 */

import { z } from 'zod'
import type {
  CornerContext,
  CornerModule,
  CornerResponseSpec,
  ReferenceMapping,
} from '../cornerPipeline.ts'
import type { LlmRequest, PromptBlock } from '../llmRequest.ts'
import { CORNER_TITLES } from '../../../../src/types/corners/cornerTitles.ts'
import {
  AttributionSchema,
  CORNER_SCHEMA_VERSION,
  sweetWordsStoredSchema,
  type SweetWordsStored,
} from '../../../../src/types/corners/storedContent.ts'
import { COMMON_PRINCIPLES_BLOCK, inChronologicalOrder, messageLine, type ChatMessageRecord } from './cornerCommon.ts'

export interface SweetWordsInput {
  /** 지면에 곁들이는 다정 지수(0~100) 또는 null. 산출식이 미결정이라 지금은 null이다(17-0-7). 그대로 주입한다. */
  readonly warmthIndex: number | null
  /** 기간 내 채팅 메시지. 소속·기간은 호출 전 단언이 본다. */
  readonly messages: readonly ChatMessageRecord[]
}

// ---------------------------------------------------------------------------
// LLM 출력 스키마 - 참조(id)와 AI 문장(`context`)만. 원문 필드가 없다.
// ---------------------------------------------------------------------------

const MessageRefSchema = z.object({ messageId: z.string().min(1) })

const MainItemSchema = z.object({
  /** AI가 쓰는 유일한 문장. 상황·정황만. */
  context: z.string().min(1),
  /** 대화 1~4턴. 메시지 id로만 가리킨다. */
  turns: z.array(MessageRefSchema).min(1).max(4),
})

/**
 * LLM 출력 스키마. 비어 있음은 리터럴 `kind: 'none'` 하나로만 표현된다(빈 배열·null·누락은 빈 결과가 아니다).
 * `main` 개수는 주기에 따른다 - 월간 1~3, 일간 1.
 */
export function sweetWordsLlmSchema(cadence: CornerContext['cadence']) {
  return z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({
      kind: z.literal('excerpts'),
      main: cadence === 'daily' ? z.array(MainItemSchema).length(1) : z.array(MainItemSchema).min(1).max(3),
      sub: z.array(MessageRefSchema).max(6),
    }),
  ])
}

export type SweetWordsLlmOutput = z.infer<ReturnType<typeof sweetWordsLlmSchema>>

/**
 * ID 해석 선언(17-0-4 r43·r44) - 판정은 골격이 한다. 이 코너는 "어느 필드가 어떤 종류의 ID인가"만 넘긴다.
 * `findMissingReferencePaths`가 이 `path`들이 LLM 출력 스키마에 있는지 테스트에서 확인한다.
 */
export const SWEET_WORDS_REFERENCES: ReferenceMapping = {
  kind: 'fields',
  fields: [
    {
      path: 'main[].turns[].messageId',
      kind: 'message',
      copy: { speaker: 'speaker', text: 'text', at: 'at', attribution: 'attribution' },
    },
    {
      path: 'sub[].messageId',
      kind: 'message',
      copy: { speaker: 'speaker', text: 'text', attribution: 'attribution' },
    },
  ],
}

// ---------------------------------------------------------------------------
// 원문을 채운 뒤의 모양 -> 저장 모양
// ---------------------------------------------------------------------------

const FilledMessageSchema = z.object({
  messageId: z.string().min(1),
  speaker: z.string(),
  text: z.string(),
  attribution: AttributionSchema,
})

const FilledSchema = z.object({
  kind: z.literal('excerpts'),
  main: z.array(
    z.object({
      context: z.string(),
      turns: z.array(FilledMessageSchema.extend({ at: z.string() })),
    }),
  ),
  sub: z.array(FilledMessageSchema),
})

function storedSchemaFor(input: SweetWordsInput, context: CornerContext) {
  const titles = CORNER_TITLES.sweet_words
  return FilledSchema.transform((filled) => {
    const main = filled.main.map((item) => {
      // 대화는 시각 순서로 배치한다(같은 시각이면 LLM이 준 순서 - 정렬은 안정적이다).
      const turns = [...item.turns].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      return {
        context: item.context,
        attribution: turns[0].attribution,
        turns: turns.map((t) => ({ speaker: t.speaker, text: t.text, at: t.at })),
      }
    })
    const sub = filled.sub.map((m) => ({ attribution: m.attribution, speaker: m.speaker, text: m.text }))
    return {
      schemaVersion: CORNER_SCHEMA_VERSION,
      header: { cornerName: titles.cornerName, title: titles.pageTitle, periodLabel: context.periodLabel },
      payload: { warmthIndex: input.warmthIndex, main, sub },
    }
  }).pipe(sweetWordsStoredSchema(context.cadence))
}

// ---------------------------------------------------------------------------
// 요청 만들기
// ---------------------------------------------------------------------------

/** 코너 지시 - 정적(system 블록 2). 주기·기간처럼 요청마다 달라지는 값은 넣지 않는다(user 블록). */
const CORNER_INSTRUCTION_BLOCK: PromptBlock = {
  text: [
    '코너: 다정한 말들',
    '',
    '채팅 중 다정했던 발화를 골라 지면에 싣는다. 채팅을 그대로 보여주는 것이 아니라, 덮인 것을 다시 꺼내는 일이다.',
    '',
    '고르는 기준',
    '- 포함: 다정함, 배려, 애정, 유머가 담긴 발화.',
    '- 제외: 다툼, 비난, 냉담한 발화. 화해 대화도 싣지 않는다. 다툼의 맥락 자체를 소환하지 않는다.',
    '- 우선순위: 감정의 강도, 상대의 반응이 좋았던 것, 평소와 다른 표현.',
    '',
    '쓰는 것',
    '- 대화(main): 이어진 1~4턴을 메시지 id로 가리키고, 그 대화의 상황·정황을 한 문장(context)으로 쓴다. 평가·해석·감상을 쓰지 않는다.',
    '- 한 줄(sub): 대화로 묶지 않을 다정한 단문의 메시지 id.',
    '- 메시지의 원문, 화자, 시각, 출처 표기는 쓰지 않는다. id만 쓴다.',
    '',
    '출력 형식(JSON 하나)',
    '다정한 발화가 있으면:',
    '{"kind":"excerpts","main":[{"context":"정황 한 문장","turns":[{"messageId":"입력의 id"}]}],"sub":[{"messageId":"입력의 id"}]}',
    '다정한 발화가 하나도 없으면 억지로 만들지 말고:',
    '{"kind":"none"}',
  ].join('\n'),
  cacheBreakpoint: true,
}

function buildRequest(input: SweetWordsInput, context: CornerContext): LlmRequest {
  const mainRule =
    context.cadence === 'daily'
      ? 'main은 정확히 1개다.'
      : 'main은 1~3개다. 다정한 대화가 하나뿐이면 1개를 싣는다.'
  return {
    system: [COMMON_PRINCIPLES_BLOCK, CORNER_INSTRUCTION_BLOCK],
    user: [
      {
        text: [
          `기간: ${context.periodLabel}`,
          `주기: ${context.cadence === 'daily' ? '일간' : '월간'}`,
          `${mainRule} sub는 0~6개다.`,
        ].join('\n'),
      },
      { text: ['메시지(한 줄이 한 건, 시각 순):', ...inChronologicalOrder(input.messages).map(messageLine)].join('\n') },
    ],
  }
}

// ---------------------------------------------------------------------------
// 코너 모듈
// ---------------------------------------------------------------------------

function responseSpec(
  input: SweetWordsInput,
  context: CornerContext,
): CornerResponseSpec<SweetWordsLlmOutput, SweetWordsStored> {
  return {
    llmSchema: sweetWordsLlmSchema(context.cadence),
    isExplicitEmpty: (llm) => llm.kind === 'none',
    references: SWEET_WORDS_REFERENCES,
    storedSchema: storedSchemaFor(input, context),
  }
}

export const sweetWordsModule: CornerModule<SweetWordsInput, SweetWordsLlmOutput, SweetWordsStored> = {
  cornerName: CORNER_TITLES.sweet_words.cornerName,
  pageTitle: CORNER_TITLES.sweet_words.pageTitle,
  // 17-0-5-D: 호출 전에는 재료가 0인가만 본다(기간 내 채팅 0건). 경계값을 두지 않는다.
  hasMaterial: (input) => input.messages.length > 0,
  scopedRecords: (input) => input.messages,
  buildRequest,
  responseSpec,
}
