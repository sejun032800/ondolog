/**
 * 17-5 이달의 우리 (코너 `this_month`) — 요청 만들기·응답 처리
 * (docs/ONDOLOG_MASTER.md Part 17-5, §17-0-4-A, §17-0-5-D, §17-0-7 / CORNER_CONTENT §7).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md.
 *
 * ── 이 코너가 하는 것 ───────────────────────────────────────────────────
 * LLM이 그 기간의 **테마를 뽑고**(헤드라인·리드·극성·신호), 테마를 여러 각도로 쪼갠 **소기사 2~4편**(제목·본문)과
 * **마무리 한 줄**을 쓴다. 테마를 뽑는 것은 AI의 일이지만 **증명은 유저의 원본**이다 - 소기사마다 근거를
 * 메시지·사진·데이트의 **id로** 가리킨다. 원문(`excerpt`)·출처 표기·사진 경로·근거의 시각은 LLM이 쓰지 않고
 * 골격이 입력 레코드에서 옮겨 적는다(17-0-4-A).
 *
 * ── 결정 (17-0-7) ───────────────────────────────────────────────────────
 * - 코너 이름·지면 제목: 고정 상수. LLM이 쓰지 않는다.
 * - 사진 근거: 사진 id 참조 -> 골격이 경로(`photoPath`)를 채운다. 데이트 근거: `type: 'date'`, 데이트 id 참조.
 * - `metric` 근거: MVP에서 뺀다(입력에 없다).
 * - `theme.signals[].count`: **LLM 출력에 없다.** 파이프라인(`derive`, 17-0-8)이 그 신호가 참조한 **근거 ID 개수**(서로 다른
 *   근거의 수)로 계산한다. LLM이 쓴 수치는 검증할 방법이 없는 지어낸 값이다(17-0-4-A, r39).
 * - 소기사는 2~4편, 편수는 LLM이 정한다. 경계값을 두지 않는다. 2편을 만들 재료가 안 되면 `{ "kind": "none" }` -
 *   `insufficient_input`(17-0-5-D). 선행 검사는 기간 내 채팅·사진·데이트 전부 0건(호출 전).
 * - `polarity`: `neutral` | `positive`. 부정 테마는 스키마가 허용하지 않는다(`schema_invalid`).
 * - 기간: 재료가 적어 넓힌 기간은 호출부가 `context.period`로 넘긴다(17-0-4-A). 호출 전 단언도 같은 기간을 본다.
 *
 * ── 문서에 정확한 값이 없어 고른 것 (보고 대상) ──────────────────────────
 * - `articles[].seq`: 배열 순서대로 0부터(`DateStop.seq`의 선례).
 * - `signals`는 1개 이상이고 신호마다 근거가 1개 이상이다(`count`가 근거 개수이므로). 개수의 상한은 두지 않는다.
 */

import { z } from 'zod'
import type {
  CornerContext,
  CornerModule,
  CornerResponseSpec,
  DerivedValues,
  ReferenceMapping,
} from '../cornerPipeline.ts'
import type { LlmRequest, PromptBlock } from '../llmRequest.ts'
import { periodLabelOf } from '../periodLabel.ts'
import { CORNER_TITLES } from '../../../../src/types/corners/cornerTitles.ts'
import {
  AttributionSchema,
  CORNER_SCHEMA_VERSION,
  ThisMonthStoredSchema,
  ThisMonthPayloadSchema,
  stringMaxCodePoints,
  type ThisMonthStored,
} from '../../../../src/types/corners/storedContent.ts'
import {
  COMMON_PRINCIPLES_BLOCK,
  dateLine,
  inChronologicalOrder,
  jsonLine,
  messageLine,
  type ChatMessageRecord,
  type DateRecord,
  type PhotoRecord,
} from './cornerCommon.ts'

export interface ThisMonthInput {
  readonly messages: readonly ChatMessageRecord[]
  readonly photos: readonly PhotoRecord[]
  readonly dates: readonly DateRecord[]
}

// ---------------------------------------------------------------------------
// LLM 출력 스키마 - 테마·소기사 문장과 근거 참조(id)뿐. 원문·경로·수치가 없다.
// ---------------------------------------------------------------------------

/** 근거 참조 - 종류마다 ID 키가 다르다(선언이 종류별로 그 키를 가리킨다). */
const EvidenceRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), messageId: z.string().min(1) }),
  z.object({ type: z.literal('photo'), photoId: z.string().min(1) }),
  z.object({ type: z.literal('date'), dateId: z.string().min(1) }),
])

export const thisMonthLlmSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('theme'),
    theme: z.object({
      /** 16자 이내(§9-7-2, 코드포인트). */
      headline: stringMaxCodePoints(16),
      lead: z.string().min(1),
      /** 'negative'는 허용하지 않는다 - 다른 값이 오면 schema_invalid. */
      polarity: z.enum(['neutral', 'positive']),
      /** 테마를 뽑은 신호와 그 근거. 개수(count)는 쓰지 않는다 - 파이프라인이 센다. */
      signals: z
        .array(
          z.object({
            kind: z.enum(['place', 'keyword', 'activity']),
            value: z.string().min(1),
            evidence: z.array(EvidenceRefSchema).min(1),
          }),
        )
        .min(1),
    }),
    /** 소기사 2~4편. 편수는 재료에 맞게 LLM이 정한다. */
    articles: z
      .array(
        z.object({
          /** 20자 이내(§9-7-2, 코드포인트). */
          title: stringMaxCodePoints(20),
          body: z.string().min(1),
          evidence: z.array(EvidenceRefSchema).min(1),
        }),
      )
      .min(2)
      .max(4),
    closing: z.string().min(1),
  }),
])

export type ThisMonthLlmOutput = z.infer<typeof thisMonthLlmSchema>

/**
 * ID 해석 선언(r43·r44). 근거 종류별 키마다 한 줄이다. 신호의 근거는 존재·소속·기간 판정만 받고(옮길 원문
 * 없음, 개수는 파생값 단계(`derive`)가 센다), 소기사의 근거는 원문·시각·경로를 옮겨 받는다.
 */
export const THIS_MONTH_REFERENCES: ReferenceMapping = {
  kind: 'fields',
  fields: [
    { path: 'theme.signals[].evidence[].messageId', kind: 'message', copy: {} },
    { path: 'theme.signals[].evidence[].photoId', kind: 'photo', copy: {} },
    { path: 'theme.signals[].evidence[].dateId', kind: 'date', copy: {} },
    {
      path: 'articles[].evidence[].messageId',
      kind: 'message',
      copy: { excerpt: 'text', at: 'at', attribution: 'attribution' },
    },
    { path: 'articles[].evidence[].photoId', kind: 'photo', copy: { photoPath: 'path', at: 'at' } },
    { path: 'articles[].evidence[].dateId', kind: 'date', copy: { at: 'dateOn' } },
  ],
}

// ---------------------------------------------------------------------------
// 원문을 채운 뒤의 모양 -> 파생값 채우기(`derive`) -> 저장 모양
// ---------------------------------------------------------------------------

const FilledEvidenceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    messageId: z.string(),
    excerpt: z.string(),
    at: z.string(),
    attribution: AttributionSchema,
  }),
  z.object({ type: z.literal('photo'), photoId: z.string(), photoPath: z.string(), at: z.string() }),
  z.object({ type: z.literal('date'), dateId: z.string(), at: z.string() }),
])

/** 신호의 근거는 옮겨 적을 것이 없다 - 종류와 id만 있다. */
const FilledSignalEvidenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), messageId: z.string() }),
  z.object({ type: z.literal('photo'), photoId: z.string() }),
  z.object({ type: z.literal('date'), dateId: z.string() }),
])

const FilledSchema = z.object({
  kind: z.literal('theme'),
  theme: z.object({
    headline: z.string(),
    lead: z.string(),
    polarity: z.enum(['neutral', 'positive']),
    signals: z.array(
      z.object({
        kind: z.enum(['place', 'keyword', 'activity']),
        value: z.string(),
        evidence: z.array(FilledSignalEvidenceSchema),
      }),
    ),
  }),
  articles: z.array(z.object({ title: z.string(), body: z.string(), evidence: z.array(FilledEvidenceSchema) })),
  closing: z.string(),
})

type FilledEvidence = z.infer<typeof FilledEvidenceSchema>
type StoredEvidence = z.input<typeof ThisMonthPayloadSchema>['articles'][number]['evidence'][number]

function evidenceKey(e: z.infer<typeof FilledSignalEvidenceSchema>): string {
  switch (e.type) {
    case 'message':
      return `message:${e.messageId}`
    case 'photo':
      return `photo:${e.photoId}`
    case 'date':
      return `date:${e.dateId}`
  }
}

function toStoredEvidence(e: FilledEvidence): StoredEvidence {
  switch (e.type) {
    case 'message':
      return { type: 'message', at: e.at, excerpt: e.excerpt, attribution: e.attribution }
    case 'photo':
      return { type: 'photo', at: e.at, photoPath: e.photoPath }
    case 'date':
      return { type: 'date', at: e.at }
  }
}

/** 파생값 채우기(17-0-8) - 신호별 `count`·`seq`·헤더. 저장 스키마는 모양만 본다. */
function deriveFor(context: CornerContext) {
  const titles = CORNER_TITLES.this_month
  return (value: unknown): DerivedValues => {
    const parsed = FilledSchema.safeParse(value)
    if (!parsed.success) return { ok: false, detail: parsed.error.message }
    const filled = parsed.data
    return {
      ok: true,
      value: {
        schemaVersion: CORNER_SCHEMA_VERSION,
        header: { cornerName: titles.cornerName, title: titles.pageTitle, periodLabel: periodLabelOf(context) },
        payload: {
          theme: {
            headline: filled.theme.headline,
            lead: filled.theme.lead,
            polarity: filled.theme.polarity,
            signals: filled.theme.signals.map((s) => ({
              kind: s.kind,
              value: s.value,
              // count는 파이프라인이 센다 - 그 신호가 참조한 서로 다른 근거의 수(17-0-7).
              count: new Set(s.evidence.map(evidenceKey)).size,
            })),
          },
          articles: filled.articles.map((a, index) => ({
            seq: index,
            title: a.title,
            body: a.body,
            evidence: a.evidence.map(toStoredEvidence),
          })),
          closing: filled.closing,
        },
      },
    }
  }
}

// ---------------------------------------------------------------------------
// 요청 만들기
// ---------------------------------------------------------------------------

/** 코너 지시 - 정적(system 블록 2). */
const CORNER_INSTRUCTION_BLOCK: PromptBlock = {
  text: [
    '코너: 이달의 우리',
    '',
    '그 기간의 기록 전체(채팅, 사진, 데이트)를 훑어 반복되는 패턴·키워드·흐름을 찾고, 기간을 관통하는 테마 하나를 뽑아 소기사로 구성한다.',
    '테마를 뽑는 것은 너의 일이지만, 그 테마를 증명하는 것은 유저의 원본 기록이다. 모든 소기사는 근거를 가진다.',
    '',
    '테마 톤',
    '- 중립·긍정 소재만 테마 후보다. polarity는 neutral 또는 positive다.',
    '- 관계를 부정적으로 규정하는 테마(멀어진 한 달, 다툼이 많았던 달 등)는 잡지 않는다.',
    '- 부정을 긍정으로 포장하지 않는다. 부정적 소재는 후보에서 제외하고, 다른 소재(그 기간 갔던 장소, 나눈 대화 주제 등)로 테마를 잡는다.',
    '',
    '쓰는 것',
    '- theme.headline: 그 기간을 한 문장으로. 16자 이내.',
    '- theme.lead: 왜 이 테마가 뽑혔는지 담백하게. 평가·감상 없이.',
    '- theme.signals: 테마를 뽑은 신호. kind는 place·keyword·activity 중 하나, value는 그 장소·키워드·활동, evidence는 그 신호가 나온 근거들.',
    '- articles: 테마를 여러 각도로 쪼갠 소기사 2~4편. 편수는 재료에 맞게 네가 정한다. 각 편은 title(20자 이내), body, evidence(근거 1개 이상).',
    '- closing: 다음 기간으로 이어지는 한 줄.',
    '',
    '근거(evidence)',
    '- 메시지는 {"type":"message","messageId":"입력의 id"}, 사진은 {"type":"photo","photoId":"입력의 id"}, 데이트는 {"type":"date","dateId":"입력의 id"}로만 가리킨다.',
    '- 근거의 원문, 시각, 경로, 개수는 쓰지 않는다.',
    '- 관계에 대한 평가("정말 잘 지내시네요" 류), 근거 없는 추측이나 각색을 쓰지 않는다.',
    '',
    '재료가 2편을 만들기에 모자라면 억지로 채우지 말고 {"kind":"none"}을 낸다.',
    '',
    '출력 형식(JSON 하나)',
    '{"kind":"theme","theme":{"headline":"...","lead":"...","polarity":"neutral","signals":[{"kind":"place","value":"...","evidence":[{"type":"message","messageId":"..."}]}]},"articles":[{"title":"...","body":"...","evidence":[{"type":"date","dateId":"..."}]}],"closing":"..."}',
    '재료가 안 되면: {"kind":"none"}',
  ].join('\n'),
  cacheBreakpoint: true,
}

function buildRequest(input: ThisMonthInput, context: CornerContext): LlmRequest {
  return {
    system: [COMMON_PRINCIPLES_BLOCK, CORNER_INSTRUCTION_BLOCK],
    user: [
      { text: `기간: ${periodLabelOf(context)}` },
      { text: ['메시지(한 줄이 한 건, 시각 순):', ...inChronologicalOrder(input.messages).map(messageLine)].join('\n') },
      {
        text: [
          '사진(한 줄이 한 건, 시각 순):',
          ...inChronologicalOrder(input.photos).map((p) => jsonLine({ id: p.id, at: p.source.at })),
        ].join('\n'),
      },
      { text: ['데이트(한 줄이 한 건, 날짜 순):', ...inChronologicalOrder(input.dates).map((d) => dateLine(d, false))].join('\n') },
    ],
  }
}

// ---------------------------------------------------------------------------
// 코너 모듈
// ---------------------------------------------------------------------------

function responseSpec(
  _input: ThisMonthInput,
  context: CornerContext,
): CornerResponseSpec<ThisMonthLlmOutput, ThisMonthStored> {
  return {
    llmSchema: thisMonthLlmSchema,
    isExplicitEmpty: (llm) => llm.kind === 'none',
    references: THIS_MONTH_REFERENCES,
    derive: deriveFor(context),
    storedSchema: ThisMonthStoredSchema,
  }
}

export const thisMonthModule: CornerModule<ThisMonthInput, ThisMonthLlmOutput, ThisMonthStored> = {
  cornerName: CORNER_TITLES.this_month.cornerName,
  pageTitle: CORNER_TITLES.this_month.pageTitle,
  // 17-0-5-D: 호출 전에는 기간 내 채팅·사진·데이트가 전부 0건인가만 본다. 경계값을 두지 않는다.
  hasMaterial: (input) => input.messages.length + input.photos.length + input.dates.length > 0,
  scopedRecords: (input) => [...input.messages, ...input.photos, ...input.dates],
  buildRequest,
  responseSpec,
}
