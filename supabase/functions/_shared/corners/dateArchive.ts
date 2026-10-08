/**
 * 17-1 데이트 아카이브 (코너 `date_archive`) — 요청 만들기·응답 처리
 * (docs/ONDOLOG_MASTER.md Part 17-1, §17-0-4-A, §17-0-5-D, §17-0-7 / CORNER_CONTENT §2).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md.
 *
 * ── 이 코너가 하는 것 ───────────────────────────────────────────────────
 * 하루의 데이트 하나가 한 편의 기사다. LLM이 쓰는 것은 셋뿐이다 - 기사 **제목**, 유저 기록이 없는 구간의 **한 줄
 * 캡션**, 마지막의 **맞춤 제안 질문**(+ 그 근거 한 문장) - 그리고 메인 화보로 삼을 데이트 하나를 **고른다**.
 * 유저가 남긴 글·그림(`userNotes`)은 입력의 것이 그대로 실리고, 그런 구간에 AI는 캡션을 달지 않는다
 * (달면 `schema_invalid`: 조용히 버리면 "AI가 물러난다"가 지켜진 것처럼 보이는 모델 오류가 숨는다).
 *
 * ── 결정 (17-0-7) ───────────────────────────────────────────────────────
 * - 코너 이름·지면 제목: 고정 상수(`cornerTitles.ts`). LLM이 쓰지 않는다.
 * - 고정 질문 둘(평점형·회상형) 문구: **상수.** LLM이 쓰지 않는다. 문구는 CORNER_CONTENT §2-3 예시를 쓰고,
 *   바꿀 때는 디자인이 정한다. 답변은 저장하지 않는다(응답 필드가 없다).
 * - 지도 `pins`: 파이프라인이 정거장에서 만든다(`derive`, 17-0-8 - 저장 스키마의 `transform`이 아니다). `label` = 장소명, `order` = 방문 순(1부터).
 *   `bounds`: 그 좌표의 최소·최대. **좌표가 없으면 지도 전체가 `null`이다.**
 * - 기사 순서: **이번 기간 데이트 날짜순 -> 재소환 데이트 날짜순.** 결정론. LLM이 정하지 않는다.
 * - 빈 결과: 선행 검사는 **조립된 데이트 0건**. 호출 후 빈 결과는 없다(데이트가 있으면 만든다) - 이 코너의
 *   빈 결과 판정은 항상 거짓이고 LLM 출력 스키마에 `none`이 없다(`{ "kind": "none" }`이 오면 `schema_invalid`).
 * - ID 해석: 재소환 레코드는 기간 **이전**을 요구한다(17-0-4-A) - 판정은 골격이 한다.
 *
 * ── 문서에 정확한 값이 없어 고른 것 (보고 대상) ──────────────────────────
 * - `summary`와 지도는 **이번 기간 데이트(재소환 제외)** 만 센다. 재소환은 그 기간의 기록이 아니기 때문이다.
 * - 장소명이 없는 정거장은 핀을 만들지 않는다(라벨을 지어내지 않는다). 지도의 좌표 범위도 핀 기준이다.
 * - 입력의 모든 데이트가 정확히 한 번씩 기사가 되어야 한다(선별은 입력 조립의 일이고 이 코너는 받은 것을 싣는다).
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
  CORNER_SCHEMA_VERSION,
  DateArchiveStoredSchema,
  DateArticleSchema,
  PhotoRefSchema,
  UserNoteSchema,
  stringMaxCodePoints,
  type DateArchiveStored,
} from '../../../../src/types/corners/storedContent.ts'
import { COMMON_PRINCIPLES_BLOCK, dateLine, inChronologicalOrder, type DateRecord } from './cornerCommon.ts'

export interface DateArchiveInput {
  /**
   * 조립이 끝난 데이트. 이번 기간 데이트와 재소환 데이트(`recalled: true`)가 함께 온다.
   * 선별·재소환은 입력 조립의 일이다(17-0-5-D, 17-0-5-E).
   */
  readonly dates: readonly DateRecord[]
}

/** 고정 질문 문구 - 상수. LLM이 쓰지 않는다(17-0-7). 바꿀 때는 디자인이 정한다. */
export const DATE_ARCHIVE_FIXED_QUESTIONS = {
  rating: '이날의 데이트는 10점 만점에 몇 점?',
  recall: '이날 중 가장 기억에 남는 건?',
} as const

// ---------------------------------------------------------------------------
// LLM 출력 스키마 - 선택(id)과 AI 문장(제목·캡션·제안 질문·근거)뿐.
// 키 이름은 FORBIDDEN_KEYS의 부분 문자열에 걸리지 않게 지었다(맞춤 제안 질문의 키는 `tailoredQuestion`).
// ---------------------------------------------------------------------------

const LlmArticleSchema = z.object({
  dateId: z.string().min(1),
  /** 20자 이내(§9-7-2, 코드포인트). */
  title: stringMaxCodePoints(20),
  /** 유저 기록(`userNotes`)이 없는 구간에만. 정황 한 줄. */
  stopCaptions: z.array(z.object({ seq: z.number().int().min(0), caption: z.string().min(1) })),
  /** 맞춤 제안형 질문 - AI가 그날 데이터에서 만든다. `basis`는 어떤 데이터에서 도출했는지. */
  tailoredQuestion: z.object({ text: z.string().min(1), basis: z.string().min(1) }),
})

export const dateArchiveLlmSchema = z.object({
  kind: z.literal('articles'),
  /** 메인 화보로 삼을 데이트 하나. */
  featuredDateId: z.string().min(1),
  articles: z.array(LlmArticleSchema).min(1),
})

export type DateArchiveLlmOutput = z.infer<typeof dateArchiveLlmSchema>

/**
 * ID 해석 선언(r43·r44). 이 코너가 넘기는 것은 위치와 종류뿐이다. 데이트 원문(`dateOn`·`region`·`stops`)은
 * 골격이 입력 레코드에서 옮겨 적는다. `featuredDateId`는 옮길 것이 없고 존재·소속·기간 판정만 받는다.
 */
export const DATE_ARCHIVE_REFERENCES: ReferenceMapping = {
  kind: 'fields',
  fields: [
    { path: 'featuredDateId', kind: 'date', copy: {} },
    {
      path: 'articles[].dateId',
      kind: 'date',
      copy: { dateOn: 'dateOn', region: 'region', recallReason: 'recallReason', stops: 'stops' },
    },
  ],
}

// ---------------------------------------------------------------------------
// 원문을 채운 뒤의 모양 -> 파생값 채우기(`derive`) -> 저장 모양
// ---------------------------------------------------------------------------

const FilledStopSchema = z.object({
  seq: z.number().int().min(0),
  time: z.string(),
  placeName: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  photos: z.array(PhotoRefSchema),
  userNotes: z.array(UserNoteSchema),
})

const FilledSchema = z.object({
  kind: z.literal('articles'),
  featuredDateId: z.string(),
  articles: z.array(
    LlmArticleSchema.extend({
      dateOn: z.string(),
      region: z.string().nullable(),
      recallReason: z.enum(['anniversary', 'sparse_month', 'never_featured']).nullable(),
      stops: z.array(FilledStopSchema),
    }),
  ),
})

type RecallReason = 'anniversary' | 'sparse_month' | 'never_featured'

function compareDateOn(a: { dateOn: string; dateId: string }, b: { dateOn: string; dateId: string }): number {
  if (a.dateOn !== b.dateOn) return a.dateOn < b.dateOn ? -1 : 1
  return a.dateId < b.dateId ? -1 : a.dateId > b.dateId ? 1 : 0
}

/**
 * 파생값 채우기(17-0-8) - 입력에서 계산하는 값(기사 순서·`featured`·`recalled`·요약·지도·고정 질문·헤더)을
 * 전부 여기서 만든다. 저장 스키마는 이 결과의 모양만 본다.
 */
function deriveFor(input: DateArchiveInput, context: CornerContext) {
  const titles = CORNER_TITLES.date_archive
  const recalledById = new Map(input.dates.map((d) => [d.id, d.recalled === true] as const))

  return (value: unknown): DerivedValues => {
    const parsed = FilledSchema.safeParse(value)
    if (!parsed.success) return { ok: false, detail: parsed.error.message }
    const filled = parsed.data
    const fail = (detail: string): DerivedValues => ({ ok: false, detail })

    // 입력의 모든 데이트가 정확히 한 번씩 기사가 되어야 한다.
    const seen = new Set<string>()
    for (const a of filled.articles) {
      if (seen.has(a.dateId)) return fail(`같은 데이트가 두 번 기사가 됐다: ${a.dateId}`)
      seen.add(a.dateId)
    }
    for (const d of input.dates) {
      if (!seen.has(d.id)) return fail(`기사가 되지 않은 데이트: ${d.id}`)
    }

    // 기사 순서: 이번 기간 데이트 날짜순 -> 재소환 데이트 날짜순(17-0-7). LLM이 정하지 않는다.
    const ordered = [...filled.articles].sort((a, b) => {
      const ra = recalledById.get(a.dateId) === true ? 1 : 0
      const rb = recalledById.get(b.dateId) === true ? 1 : 0
      return ra - rb || compareDateOn(a, b)
    })

    const articles: Array<z.input<typeof DateArticleSchema>> = []
    for (const a of ordered) {
      const stops = [...a.stops].sort((x, y) => x.seq - y.seq)
      const captionBySeq = new Map<number, string>()
      for (const c of a.stopCaptions) {
        if (captionBySeq.has(c.seq)) return fail(`같은 구간에 캡션이 둘이다: ${a.dateId} seq ${c.seq}`)
        captionBySeq.set(c.seq, c.caption)
      }
      for (const seq of captionBySeq.keys()) {
        if (!stops.some((s) => s.seq === seq)) return fail(`없는 구간에 캡션을 달았다: ${a.dateId} seq ${seq}`)
      }
      const storedStops = []
      for (const s of stops) {
        const caption = captionBySeq.get(s.seq) ?? null
        if (s.userNotes.length > 0 && caption !== null) {
          return fail(`유저 기록이 있는 구간에 캡션을 달았다: ${a.dateId} seq ${s.seq}`)
        }
        storedStops.push({
          seq: s.seq,
          time: s.time,
          placeName: s.placeName,
          lat: s.lat,
          lng: s.lng,
          photos: s.photos,
          userNotes: s.userNotes,
          aiCaption: caption,
        })
      }
      const recallReason: RecallReason | undefined = a.recallReason ?? undefined
      articles.push({
        dateId: a.dateId,
        dateOn: a.dateOn,
        region: a.region,
        title: a.title,
        featured: a.dateId === filled.featuredDateId,
        recalled: recalledById.get(a.dateId) === true,
        ...(recallReason === undefined ? {} : { recallReason }),
        stops: storedStops,
        closingQuestions: [
          { type: 'rating' as const, text: DATE_ARCHIVE_FIXED_QUESTIONS.rating },
          { type: 'recall' as const, text: DATE_ARCHIVE_FIXED_QUESTIONS.recall },
          { type: 'suggestion' as const, text: a.tailoredQuestion.text, basis: a.tailoredQuestion.basis },
        ],
      })
    }

    // 요약·지도: 이번 기간 데이트만(재소환 제외).
    const thisPeriod = articles.filter((a) => !a.recalled)
    const regions: string[] = []
    for (const a of thisPeriod) {
      if (a.region !== null && !regions.includes(a.region)) regions.push(a.region)
    }
    const pins: Array<{ lat: number; lng: number; label: string; dateOn: string; order: number }> = []
    for (const a of thisPeriod) {
      for (const s of a.stops) {
        if (s.lat !== null && s.lng !== null && s.placeName !== null) {
          pins.push({ lat: s.lat, lng: s.lng, label: s.placeName, dateOn: a.dateOn, order: pins.length + 1 })
        }
      }
    }
    const mapInfographic =
      pins.length === 0
        ? null
        : {
            bounds: {
              north: Math.max(...pins.map((p) => p.lat)),
              south: Math.min(...pins.map((p) => p.lat)),
              east: Math.max(...pins.map((p) => p.lng)),
              west: Math.min(...pins.map((p) => p.lng)),
            },
            pins,
          }

    return {
      ok: true,
      value: {
        schemaVersion: CORNER_SCHEMA_VERSION,
        header: { cornerName: titles.cornerName, title: titles.pageTitle, periodLabel: periodLabelOf(context) },
        payload: {
          summary: { dateCount: thisPeriod.length, regionCount: regions.length, regions },
          articles,
          mapInfographic,
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
    '코너: 데이트 아카이브',
    '',
    '하루의 데이트 하나가 한 편의 기사다. 입력의 데이트마다 정확히 한 편씩 쓴다. 빠뜨리거나 겹치지 않는다.',
    '유저가 남긴 글·그림(userNotes)이 있는 구간에는 AI가 아무것도 쓰지 않는다. 그 구간의 캡션을 쓰지 않는다.',
    '',
    '쓰는 것',
    '- title: 그날의 제목. 20자 이내. 평가·감상 없이 그날의 장면이나 동선을 담는다.',
    '- stopCaptions: userNotes가 없는 구간에만, 구간 번호(seq)와 정황 한 줄(caption). 입력의 장소·시각에서 알 수 있는 사실만 쓴다. 쓸 만한 사실이 없으면 그 구간은 생략한다.',
    '- tailoredQuestion: 커플이 함께 이야기할 질문 하나(text)와, 그날 데이터의 무엇에서 도출했는지(basis, 한 문장). 다음에 함께 해볼 일을 가볍게 묻는 형태. 평가하지 않는다.',
    '- featuredDateId: 메인 화보로 삼을 데이트 하나의 id. 사진이 많거나 유저가 기록을 남긴 날처럼 그날이 인상적이었다는 신호가 큰 날을 고른다.',
    '- 날짜, 지역, 장소, 사진, 유저 기록은 쓰지 않는다. 데이트는 id로만 가리킨다.',
    '- 입력의 recalled가 true인 데이트는 "그때 그 시절"로 다시 소환한 지난 데이트다. 같은 방식으로 쓴다.',
    '',
    '출력 형식(JSON 하나)',
    '{"kind":"articles","featuredDateId":"입력의 id","articles":[{"dateId":"입력의 id","title":"제목","stopCaptions":[{"seq":0,"caption":"한 줄"}],"tailoredQuestion":{"text":"질문","basis":"근거 한 문장"}}]}',
  ].join('\n'),
  cacheBreakpoint: true,
}

function buildRequest(input: DateArchiveInput, context: CornerContext): LlmRequest {
  return {
    system: [COMMON_PRINCIPLES_BLOCK, CORNER_INSTRUCTION_BLOCK],
    user: [
      { text: `기간: ${periodLabelOf(context)}` },
      { text: ['데이트(한 줄이 한 건, 날짜 순):', ...inChronologicalOrder(input.dates).map((d) => dateLine(d, true))].join('\n') },
    ],
  }
}

// ---------------------------------------------------------------------------
// 코너 모듈
// ---------------------------------------------------------------------------

function responseSpec(
  input: DateArchiveInput,
  context: CornerContext,
): CornerResponseSpec<DateArchiveLlmOutput, DateArchiveStored> {
  return {
    llmSchema: dateArchiveLlmSchema,
    // 호출 후 빈 결과는 없다 - 데이트가 있으면 만든다(17-0-5-D). "없다"고 답하는 단계를 명시한다.
    isExplicitEmpty: () => false,
    references: DATE_ARCHIVE_REFERENCES,
    derive: deriveFor(input, context),
    storedSchema: DateArchiveStoredSchema,
  }
}

export const dateArchiveModule: CornerModule<DateArchiveInput, DateArchiveLlmOutput, DateArchiveStored> = {
  cornerName: CORNER_TITLES.date_archive.cornerName,
  pageTitle: CORNER_TITLES.date_archive.pageTitle,
  // 17-0-5-D: 조립이 끝난 입력을 본다. 조립된 데이트가 0건일 때만 재료 부족이다.
  hasMaterial: (input) => input.dates.length > 0,
  scopedRecords: (input) => input.dates,
  buildRequest,
  responseSpec,
}
