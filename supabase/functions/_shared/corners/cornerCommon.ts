/**
 * 코너 3종이 함께 쓰는 입력 레코드 모양과 프롬프트 공통부
 * (docs/ONDOLOG_MASTER.md §17-0-4-A, §17-0-5-F, §17-0-7).
 *
 * ── 이 디렉터리의 규칙 ───────────────────────────────────────────────────
 * 코너 코드는 **전송 방식을 모른다**(규칙 G, 17-0-5-F). 이 디렉터리의 실행 코드에는 부르고 기다리는 코드가
 * 없다 - 전부 동기 순수 함수와 선언이다. 호출은 골격(`cornerPipeline.ts`의 `runCornerModule`)이 한다.
 * 캐시 지점은 `cacheBreakpoint`로 표시만 하고, 그것을 전송 형식으로 옮기는 것은 `llmClient.ts`뿐이다.
 *
 * ── 입력 레코드 ─────────────────────────────────────────────────────────
 * 아래 레코드 모양은 **입력 조립 계약 원본 (MASTER §17-0-9)**이다. 입력 조립(`../inputAssembly.ts`)이 이 타입을 채워
 * 넘기고, 채우는 규칙(조회·기간·재소환·잠긴 데이터·시각 변환·필드 채우기)은 §17-0-9가 정한다. 이 파일이 모양의
 * 원본이므로 입력 조립은 레코드 모양을 다른 곳에 다시 정의하지 않는다.
 * 문서가 정한 것은 "레코드가 ID·시각·재소환 표시·커플을 싣는다"(17-0-4-B)와 "계산이 필요한 원문 값은 입력 조립이
 * `source`에 미리 싣는다"(17-0-4)이다. `source`의 필드 이름은 이 코너들이 `copy` 선언으로 가리키는 이름이다.
 * 표기 문자열(`attribution.display`)은 입력 조립이 시간대 라벨 함수(`timeOfDayLabel`)로 만들어 싣는다.
 */

import type { ScopedRecord } from '../cornerPipeline.ts'
import type { PromptBlock } from '../llmRequest.ts'
import type { Attribution, PhotoRef, UserNote } from '../../../../src/types/corners/storedContent.ts'

// ---------------------------------------------------------------------------
// 입력 레코드
// ---------------------------------------------------------------------------

/** 채팅 메시지의 원문 필드. 골격이 이 값을 그대로 옮겨 적는다 - LLM이 쓰지 않는다. */
export type ChatMessageSource = {
  /** 화자 이름 복사본(탈퇴 대비, CORNER_CONTENT §0-1). */
  readonly speaker: string
  /** 원문 그대로. 요약·교정·이모지 제거 금지. */
  readonly text: string
  /** 메시지 시각, ISO8601(+09:00 표기). */
  readonly at: string
  /**
   * 입력 조립이 `timeOfDayLabel`로 만든 출처 표기. `Attribution.source`는 레코드 종류와 1:1이다(§17-0-9-F) -
   * 메시지 레코드의 표기는 항상 `'chat'`이다. 사진·데이트 레코드는 `attribution`을 싣지 않는다.
   */
  readonly attribution: Attribution & { readonly source: 'chat' }
}

export interface ChatMessageRecord extends ScopedRecord {
  readonly kind: 'message'
  readonly source: ChatMessageSource
}

/** 사진 근거의 원문 필드(17-5). */
export type PhotoSource = {
  /** 저장 경로. 발행 시 magazine 버킷 경로로 치환된다(Part 8) - 이 코너들이 하지 않는다. */
  readonly path: string
  /** 촬영 시각 ISO8601. */
  readonly at: string
}

export interface PhotoRecord extends ScopedRecord {
  readonly kind: 'photo'
  readonly source: PhotoSource
}

/** 데이트 한 건의 정거장(17-1). 사진·유저 기록은 입력 조립이 채운다. */
export type DateStopSource = {
  readonly seq: number
  /** 표시용 문자열 "14:20". */
  readonly time: string
  readonly placeName: string | null
  readonly lat: number | null
  readonly lng: number | null
  readonly photos: readonly PhotoRef[]
  readonly userNotes: readonly UserNote[]
}

/** 데이트 레코드의 원문 필드(17-1·17-5). */
export type DateSource = {
  /** "2026-08-19". */
  readonly dateOn: string
  readonly region: string | null
  /** 17-1 "그때 그 시절" 재소환 사유. 재소환이 아니면 null. */
  readonly recallReason: 'anniversary' | 'sparse_month' | 'never_featured' | null
  readonly stops: readonly DateStopSource[]
  /**
   * 정거장에 속하지 않고 데이트에만 묶인 사진·유저 기록(§17-0-9-F "`date_stop_id` 우선, null이면 `date_id`로 데이트
   * 단위에 붙인다"). 입력 조립은 항상 채운다. 선택 필드인 것은 이 필드가 생기기 전의 코너 코드·시험이 그대로
   * 컴파일되게 하려는 것뿐이다. 코너가 이 값을 지면에 쓸지는 코너 기획의 몫이다.
   */
  readonly dateLevel?: {
    readonly photos: readonly PhotoRef[]
    readonly userNotes: readonly UserNote[]
  }
}

export interface DateRecord extends ScopedRecord {
  readonly kind: 'date'
  readonly source: DateSource
}

// ---------------------------------------------------------------------------
// 프롬프트 공통부
// ---------------------------------------------------------------------------

/**
 * 공통 원칙 - 세 코너가 같은 문구를 쓴다(system 블록 1, 정적). 캐시 표시를 붙인다 - 이 블록까지가 코너와
 * 무관한 접두라 세 코너가 같은 접두를 공유한다. 요청마다 달라지는 내용은 이 안에 두지 않는다.
 */
export const COMMON_PRINCIPLES_BLOCK: PromptBlock = {
  text: [
    '너는 커플의 기록으로 매거진 지면을 만드는 편집자다. 평론가가 아니다.',
    '',
    '원칙',
    '- 고르고, 배치하고, 이어 붙인다. 좋다·나쁘다를 말하지 않는다.',
    '- 점수, 등급, 평가, 판정, 조언, 예측, 원인 지목을 쓰지 않는다. 그런 값을 담을 키도 만들지 않는다.',
    '- 유저의 기록이 주인공이다. 유저가 남긴 글·그림이 있으면 AI는 물러난다.',
    '- 입력의 메시지·데이트·사진은 id로만 가리킨다. 원문 텍스트를 출력에 적지 않는다.',
    '- 입력에 없는 id, 장소, 사실을 만들지 않는다. 재료가 맞지 않으면 억지로 채우지 말고 지시된 빈 결과를 낸다.',
    '- 감상하지 않는다. 상황과 정황만 담백하게 쓴다.',
    '- 출력은 JSON 객체 하나뿐이다. 코드 펜스나 설명 문장을 붙이지 않는다.',
    '- 출력 JSON의 키는 코너 지시에 적힌 것만 쓴다. 다른 키를 만들지 않는다.',
  ].join('\n'),
  cacheBreakpoint: true,
}

/** 입력 레코드 한 건을 한 줄 JSON으로 - 따옴표·개행이 안전하게 이스케이프된다. */
export function jsonLine(value: unknown): string {
  return JSON.stringify(value)
}

/** 채팅 메시지를 프롬프트에 싣는 줄. LLM은 이 `id`로만 메시지를 가리킨다. */
export function messageLine(record: ChatMessageRecord): string {
  return jsonLine({ id: record.id, speaker: record.source.speaker, at: record.source.at, text: record.source.text })
}

/** 레코드를 시각 오름차순으로(같으면 id) - 프롬프트에 싣는 순서를 입력 순서와 무관하게 결정론으로 만든다. */
export function inChronologicalOrder<T extends ScopedRecord>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * 데이트를 프롬프트에 싣는 줄. 유저 기록(`userNotes`)은 있으면 그 구간에 AI가 쓰지 않는다는 신호이고, 내용은
 * 제목·질문을 만드는 맥락으로만 쓴다. `includeRecalled`: 17-1만 재소환 표시를 싣는다.
 */
export function dateLine(record: DateRecord, includeRecalled: boolean): string {
  return jsonLine({
    id: record.id,
    dateOn: record.source.dateOn,
    region: record.source.region,
    ...(includeRecalled ? { recalled: record.recalled === true } : {}),
    stops: record.source.stops.map((s) => ({
      seq: s.seq,
      time: s.time,
      placeName: s.placeName,
      photoCount: s.photos.length,
      userNotes: s.userNotes.map((n) => (n.type === 'memo' ? { type: n.type, text: n.text } : { type: n.type })),
    })),
  })
}
