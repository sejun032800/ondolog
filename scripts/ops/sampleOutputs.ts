/**
 * 샘플 출력 모드(ROADMAP R16-2) - 코너의 LLM 응답 자리에 넣는 **샘플 JSON**과, 그것을 돌려주는 `LlmClient`.
 * 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * ── 방식 (내부 결정) ──────────────────────────────────────────────────────
 * 고정 파일이 아니라 **그 실행의 입력에서 만드는 생성기**다. 그래서 ID 참조가 그 실행의 입력 레코드에서 오고,
 * 검증기(`validateCornerResponse`)는 **고치지 않고 그대로** 통과시킨다(ID 해석·원문 채우기·파생값·저장 스키마 전부).
 * 입력이 바뀌어도(시험 데이터를 다시 만들어도) 샘플이 입력과 어긋나지 않는다.
 *
 * ── 하지 않는 것 ──────────────────────────────────────────────────────────
 * - **실제 API 호출을 하지 않는다.** 이 파일의 `LlmClient`는 네트워크를 모른다(`fetch`·키·모델·엔드포인트 없음).
 *   `llmClient.ts`의 모델 식별자·키 경로는 건드리지 않는다.
 * - 문장의 질을 판정하지 않는다. 샘플은 스키마를 통과하는 **형식 검증용 문장**이다(입력의 사실만 담백하게 나열).
 *   저장 행의 `engine_version`이 `SAMPLE_ENGINE_VERSION`이라 실제 생성물과 구별된다.
 * - 재료가 모자라면 코너의 빈 결과(`{"kind":"none"}`)를 낸다(억지로 채우지 않는다).
 */

import type { LlmClient } from '../../supabase/functions/_shared/llmClient.ts'
import type { LlmRequest } from '../../supabase/functions/_shared/llmRequest.ts'
import type {
  ChatMessageRecord,
  DateRecord,
  PhotoRecord,
} from '../../supabase/functions/_shared/corners/cornerCommon.ts'
import { inChronologicalOrder } from '../../supabase/functions/_shared/corners/cornerCommon.ts'
import type { DateArchiveInput } from '../../supabase/functions/_shared/corners/dateArchive.ts'
import type { SweetWordsInput } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import type { ThisMonthInput } from '../../supabase/functions/_shared/corners/thisMonth.ts'

/** 샘플 출력으로 저장한 코너 행의 `engine_version`. 실제 생성물과 구별하는 표시다. */
export const SAMPLE_ENGINE_VERSION = 'sample-output-v1'

/** 샘플 응답을 돌려주는 클라이언트. 호출 횟수를 센다(시험·보고용). 네트워크를 쓰지 않는다. */
export interface SampleLlmClient extends LlmClient {
  readonly calls: () => number
}

export function createSampleLlmClient(responseText: string): SampleLlmClient {
  let calls = 0
  return {
    async call(_request: LlmRequest) {
      calls += 1
      return { ok: true, text: responseText }
    },
    calls: () => calls,
  }
}

const NONE = { kind: 'none' } as const

/** 17-1 데이트 아카이브 - 입력의 데이트마다 기사 한 편. 대표 화보는 이번 기간 데이트 중 사진이 가장 많은 것. */
export function sampleDateArchive(input: DateArchiveInput): unknown {
  if (input.dates.length === 0) return NONE
  const photosOf = (d: DateRecord) => d.source.stops.reduce((sum, s) => sum + s.photos.length, 0)
  const pool = input.dates.some((d) => d.recalled !== true) ? input.dates.filter((d) => d.recalled !== true) : input.dates
  const featured = [...pool].sort((a, b) => photosOf(b) - photosOf(a) || (a.id < b.id ? -1 : 1))[0]

  return {
    kind: 'articles',
    featuredDateId: featured.id,
    articles: inChronologicalOrder(input.dates).map((d) => {
      const stops = [...d.source.stops].sort((a, b) => a.seq - b.seq)
      const firstNamed = stops.find((s) => s.placeName !== null)
      return {
        dateId: d.id,
        title: `${d.source.region ?? d.source.dateOn} 데이트`,
        // 유저 기록이 없고 장소명이 있는 구간에만 - 장소명과 시각만 쓴다(없는 사실을 지어내지 않는다).
        stopCaptions: stops
          .filter((s) => s.userNotes.length === 0 && s.placeName !== null)
          .map((s) => ({ seq: s.seq, caption: `${s.time} ${s.placeName}` })),
        tailoredQuestion: {
          text: firstNamed === undefined ? '다음 데이트에서 해보고 싶은 것은?' : `다음에 ${firstNamed.placeName}에 다시 간다면 무엇을 해보고 싶은가요?`,
          basis: firstNamed === undefined ? '입력의 데이트 기록에서' : `${d.source.dateOn} 기록에 ${firstNamed.placeName} 구간이 있어서`,
        },
      }
    }),
  }
}

/** 17-4 다정한 말들 - 기간 앞쪽 메시지에서 대화 하나와 한 줄 둘. 메시지가 없으면 빈 결과. */
export function sampleSweetWords(input: SweetWordsInput): unknown {
  const sorted = inChronologicalOrder(input.messages)
  if (sorted.length === 0) return NONE
  const turns = sorted.slice(0, 2)
  const sub = sorted.slice(2, 4)
  return {
    kind: 'excerpts',
    main: [{ context: '기간 중 오간 짧은 대화', turns: turns.map((m: ChatMessageRecord) => ({ messageId: m.id })) }],
    sub: sub.map((m: ChatMessageRecord) => ({ messageId: m.id })),
  }
}

type EvidenceRef =
  | { readonly type: 'message'; readonly messageId: string }
  | { readonly type: 'photo'; readonly photoId: string }
  | { readonly type: 'date'; readonly dateId: string }

/** 17-5 이달의 우리 - 메시지·사진·데이트에서 하나씩 근거를 잡아 소기사를 만든다. 근거가 둘보다 적으면 빈 결과. */
export function sampleThisMonth(input: ThisMonthInput): unknown {
  const message: ChatMessageRecord | undefined = inChronologicalOrder(input.messages)[0]
  const photo: PhotoRecord | undefined = inChronologicalOrder(input.photos)[0]
  const date: DateRecord | undefined = inChronologicalOrder(input.dates.filter((d) => d.recalled !== true))[0]

  const pool: { readonly ref: EvidenceRef; readonly title: string; readonly body: string }[] = []
  if (message !== undefined) {
    pool.push({ ref: { type: 'message', messageId: message.id }, title: '이 기간의 대화', body: '이 기간에 오간 메시지가 남아 있다.' })
  }
  if (photo !== undefined) {
    pool.push({ ref: { type: 'photo', photoId: photo.id }, title: '이 기간의 사진', body: '이 기간에 찍힌 사진이 남아 있다.' })
  }
  if (date !== undefined) {
    pool.push({
      ref: { type: 'date', dateId: date.id },
      title: `${date.source.region ?? date.source.dateOn} 데이트`,
      body: `${date.source.dateOn}에 데이트가 기록되어 있다.`,
    })
  }
  if (pool.length < 2) return NONE

  const signal =
    date !== undefined && date.source.region !== null
      ? { kind: 'place', value: date.source.region, evidence: [{ type: 'date', dateId: date.id }] }
      : { kind: 'activity', value: '기록', evidence: [pool[0].ref] }

  return {
    kind: 'theme',
    theme: {
      headline: '이 기간의 기록',
      lead: '이 기간에 남은 채팅, 사진, 데이트를 모았다.',
      polarity: 'neutral',
      signals: [signal],
    },
    articles: pool.map((p) => ({ title: p.title, body: p.body, evidence: [p.ref] })),
    closing: '이 기간의 기록은 여기까지다.',
  }
}
