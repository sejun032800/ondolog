import { z } from 'zod'

/**
 * 코너 3종의 **저장 스키마** — `corners.content`에 들어가는 형태
 * (원본: docs/ONDOLOG_CORNER_CONTENT.md §0-3, §1, §2, §6, §7).
 *
 * LLM 출력 스키마와 다르다. LLM 출력 스키마는 코너 코드(`supabase/functions/_shared/corners/`)에 있고
 * 참조(ID)와 AI 문장만 담는다. 이 스키마는 파이프라인이 원문·수치·고정 문구를 채운 **뒤의** 모양이다
 * (MASTER 17-0-4-A, 17-0-7). 파이프라인은 이 스키마를 통과한 값에만 `ValidatedContent` 브랜드를 붙인다.
 *
 * 문서에 있는 규칙만 건다 - `aiCaption` 배타·`featured` 유일·질문 3종 고정(§2-2), 개수 범위(§6-1, §7),
 * `polarity`에 `negative` 없음(§7-2), §9-7-2의 길이 상한(`articles[].title` 20자·`theme.headline` 16자·
 * 코너 제목 7자). 문서에 길이 상한이 없는 필드에는 상한을 만들지 않는다.
 * 길이는 **코드포인트**로 센다(MASTER 17-0-7 "문자열 길이" - 한글 음절은 1자).
 *
 * 이 파일은 `zod`만 import하는 leaf다. 앱(루트 tsc, `.ts` 확장자 import 금지)과 Edge Function(전용 tsconfig,
 * 확장자 필요)이 둘 다 읽으므로 다른 파일을 import하지 않는다(MASTER 17-0-3-A, r22 "배타적"). 코너 이름·
 * 지면 제목 상수(`cornerTitles.ts`)의 값은 쓰지 않고 형태만 검사한다(길이·비어 있지 않음).
 */

/** CORNER_CONTENT §0-3 `schemaVersion` - 구조가 바뀌면 올린다. */
export const CORNER_SCHEMA_VERSION = '1.0'

// ---------------------------------------------------------------------------
// 길이: 코드포인트
// ---------------------------------------------------------------------------

/** 문자열 길이를 코드포인트로 센다(한글 음절 1자). 17-0-7 공통 결정. */
export function codePointLength(value: string): number {
  return Array.from(value).length
}

/** 코드포인트 상한이 걸린 비어 있지 않은 문자열. */
export function stringMaxCodePoints(max: number) {
  return z.string().min(1).refine((s) => codePointLength(s) <= max, { message: `${max}자(코드포인트)를 넘는다` })
}

// ---------------------------------------------------------------------------
// §1 공통 값 객체
// ---------------------------------------------------------------------------

const IsoDateTime = z.iso.datetime({ offset: true })
const IsoDate = z.iso.date()

export const PhotoRefSchema = z.object({
  path: z.string().min(1),
  thumbPath: z.string().min(1).optional(),
  width: z.number(),
  height: z.number(),
  capturedAt: IsoDateTime.optional(),
})

export const UserNoteSchema = z.object({
  authorId: z.string(),
  authorName: z.string(),
  type: z.enum(['memo', 'drawing']),
  text: z.string().optional(),
  path: z.string().optional(),
})

export const ChatTurnSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
  at: IsoDateTime,
})

export const AttributionSchema = z.object({
  display: z.string().min(1),
  at: IsoDateTime,
  source: z.enum(['chat', 'feed', 'story']),
})

export type PhotoRef = z.infer<typeof PhotoRefSchema>
export type UserNote = z.infer<typeof UserNoteSchema>
export type ChatTurn = z.infer<typeof ChatTurnSchema>
export type Attribution = z.infer<typeof AttributionSchema>

// ---------------------------------------------------------------------------
// §0-3 공통 봉투
// ---------------------------------------------------------------------------

/**
 * 봉투. `header.title`(지면 제목)은 §9-7-2에 따라 7자(코드포인트) 상한을 스키마에 둔다. 값 자체
 * (한글·공백만)는 상수 `PAGE_TITLE_PATTERN`이 테스트로 지킨다.
 */
export function cornerEnvelopeSchema<P extends z.ZodType>(payload: P) {
  return z.object({
    schemaVersion: z.literal(CORNER_SCHEMA_VERSION),
    header: z.object({
      cornerName: z.string().min(1),
      title: stringMaxCodePoints(7),
      subtitle: z.string().min(1).optional(),
      periodLabel: z.string().min(1),
    }),
    payload,
  })
}

// ---------------------------------------------------------------------------
// §2 date_archive - 데이트 아카이브
// ---------------------------------------------------------------------------

export const DateStopSchema = z
  .object({
    seq: z.number().int().min(0),
    time: z.string().min(1),
    placeName: z.string().min(1).nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    photos: z.array(PhotoRefSchema),
    userNotes: z.array(UserNoteSchema),
    aiCaption: z.string().min(1).nullable(),
  })
  .refine((stop) => stop.userNotes.length === 0 || stop.aiCaption === null, {
    message: 'userNotes가 있는 구간의 aiCaption은 null이어야 한다 (유저 기록이 있으면 AI는 물러난다)',
    path: ['aiCaption'],
  })

export const ClosingQuestionSchema = z.object({
  type: z.enum(['rating', 'recall', 'suggestion']),
  text: z.string().min(1),
  basis: z.string().min(1).optional(),
})

export const DateArticleSchema = z
  .object({
    dateId: z.string().min(1),
    dateOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    region: z.string().min(1).nullable(),
    title: stringMaxCodePoints(20),
    featured: z.boolean(),
    recalled: z.boolean(),
    recallReason: z.enum(['anniversary', 'sparse_month', 'never_featured']).optional(),
    stops: z.array(DateStopSchema),
    closingQuestions: z.array(ClosingQuestionSchema),
  })
  .refine(
    (a) => {
      const types = a.closingQuestions.map((q) => q.type).sort()
      return types.length === 3 && types[0] === 'rating' && types[1] === 'recall' && types[2] === 'suggestion'
    },
    { message: 'closingQuestions는 rating 1 + recall 1 + suggestion 1이어야 한다', path: ['closingQuestions'] },
  )

export const MapInfographicSchema = z.object({
  bounds: z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() }),
  pins: z.array(
    z.object({
      lat: z.number(),
      lng: z.number(),
      label: z.string().min(1),
      dateOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      order: z.number().int().min(1),
    }),
  ),
})

export const DateArchivePayloadSchema = z
  .object({
    summary: z.object({
      dateCount: z.number().int().min(0),
      regionCount: z.number().int().min(0),
      regions: z.array(z.string().min(1)),
    }),
    articles: z.array(DateArticleSchema).min(1),
    mapInfographic: MapInfographicSchema.nullable(),
  })
  .refine((p) => p.articles.filter((a) => a.featured).length === 1, {
    message: 'featured는 articles 중 정확히 1개여야 한다',
    path: ['articles'],
  })

export const DateArchiveStoredSchema = cornerEnvelopeSchema(DateArchivePayloadSchema)

export type DateArchivePayload = z.infer<typeof DateArchivePayloadSchema>
export type DateArchiveStored = z.infer<typeof DateArchiveStoredSchema>

// ---------------------------------------------------------------------------
// §6 sweet_words - 다정한 말들
// ---------------------------------------------------------------------------

export const SweetExcerptSchema = z.object({
  context: z.string().min(1),
  attribution: AttributionSchema,
  turns: z.array(ChatTurnSchema).min(1).max(4),
})

export const SweetSubSchema = z.object({
  attribution: AttributionSchema,
  speaker: z.string().min(1),
  text: z.string().min(1),
})

/**
 * 다정한 말들 payload. `main` 개수는 주기에 따른다 - 월간 1~3, 일간 1(MASTER 17-0-7). `sub`는 0~6.
 * `warmthIndex`는 입력이 싣는 값이다(0~100 또는 null). 산출식은 미결정이라 지금은 null이다.
 */
export function sweetWordsPayloadSchema(cadence: 'daily' | 'monthly') {
  return z.object({
    warmthIndex: z.number().min(0).max(100).nullable(),
    main: cadence === 'daily' ? z.array(SweetExcerptSchema).length(1) : z.array(SweetExcerptSchema).min(1).max(3),
    sub: z.array(SweetSubSchema).max(6),
  })
}

export function sweetWordsStoredSchema(cadence: 'daily' | 'monthly') {
  return cornerEnvelopeSchema(sweetWordsPayloadSchema(cadence))
}

export type SweetWordsPayload = z.infer<ReturnType<typeof sweetWordsPayloadSchema>>
export type SweetWordsStored = z.infer<ReturnType<typeof sweetWordsStoredSchema>>

// ---------------------------------------------------------------------------
// §7 this_month - 이달의 우리
// ---------------------------------------------------------------------------

/** §7-1 `MonthEvidence`. `type`별로 채워지는 필드가 다르다 - 원문(`message`)·경로(`photo`). */
export const MonthEvidenceSchema = z
  .object({
    type: z.enum(['message', 'photo', 'date']),
    at: z.union([IsoDateTime, IsoDate]),
    excerpt: z.string().min(1).optional(),
    attribution: AttributionSchema.optional(),
    photoPath: z.string().min(1).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.type === 'message' && (e.excerpt === undefined || e.attribution === undefined)) {
      ctx.addIssue({ code: 'custom', message: "type 'message'는 excerpt와 attribution이 필요하다" })
    }
    if (e.type === 'photo' && e.photoPath === undefined) {
      ctx.addIssue({ code: 'custom', message: "type 'photo'는 photoPath가 필요하다" })
    }
  })

export const ThisMonthPayloadSchema = z.object({
  theme: z.object({
    headline: stringMaxCodePoints(16),
    lead: z.string().min(1),
    /** 'negative'는 스키마상 허용하지 않는다(§7-1). */
    polarity: z.enum(['neutral', 'positive']),
    signals: z
      .array(
        z.object({
          kind: z.enum(['place', 'keyword', 'activity']),
          value: z.string().min(1),
          /** 파이프라인이 계산한 값 - 그 신호가 참조한 근거 ID 개수(17-0-7). */
          count: z.number().int().min(1),
        }),
      )
      .min(1),
  }),
  articles: z
    .array(
      z.object({
        seq: z.number().int().min(0),
        title: stringMaxCodePoints(20),
        body: z.string().min(1),
        evidence: z.array(MonthEvidenceSchema).min(1),
      }),
    )
    .min(2)
    .max(4),
  closing: z.string().min(1),
})

export const ThisMonthStoredSchema = cornerEnvelopeSchema(ThisMonthPayloadSchema)

export type MonthEvidence = z.infer<typeof MonthEvidenceSchema>
export type ThisMonthPayload = z.infer<typeof ThisMonthPayloadSchema>
export type ThisMonthStored = z.infer<typeof ThisMonthStoredSchema>
