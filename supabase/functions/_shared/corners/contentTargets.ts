/**
 * 84-c 내용 검사의 칸 목록 만들기 - 코너 3종이 LLM 출력과 입력 레코드로 `ContentTarget`(칸 · 말투 종류 · 입력값 · 근거 날짜)을
 * 만든다(ROADMAP r133 R133-4 · R133-5). 검사 자체는 `src/engine/corners/contentChecks.ts`(순수)가 한다.
 *
 * 동기 순수 함수와 선언뿐이다(코너 디렉터리 규칙 G - 부르고 기다리는 코드 0).
 *
 * 칸별 말투(R133-4):
 * - 글 칸(text): 이달의 우리 lead · articles[].body · closing
 * - 라벨 칸(label): 이달의 우리 headline · signals[].value · articles[].title / 데이트 title · stopCaptions[].caption ·
 *   tailoredQuestion.basis / 다정한 말들 main[].context
 * - 질문 칸(question): 데이트 tailoredQuestion.text
 */

import {
  createNumberFacts,
  kstParts,
  type ContentTarget,
  type FieldTone,
  type NumberFacts,
} from '../../../../src/engine/corners/contentChecks.ts'
import type { ChatMessageRecord, DateRecord, PhotoRecord } from './cornerCommon.ts'

/** 레코드 하나의 KST 날짜(들). */
export function recordDates(record: ChatMessageRecord | PhotoRecord | DateRecord): string[] {
  if (record.kind === 'date') return [record.source.dateOn.slice(0, 10)]
  const p = kstParts(record.source.at)
  return p === null ? [] : [p.date]
}

/** 데이트 한 건의 입력값(정거장 시각 · 사진 시각 · 사진 장수 · 메모 원문)을 쌓는다. */
function addDate(facts: ReturnType<typeof createNumberFacts>, d: DateRecord): void {
  facts.addDate(d.source.dateOn)
  let total = 0
  for (const s of d.source.stops) {
    facts.addClock(s.time)
    facts.addNumber(s.seq)
    facts.addPhotoCount(s.photos.length)
    total += s.photos.length
    for (const ph of s.photos) if (ph.capturedAt !== undefined) facts.addInstant(ph.capturedAt)
    for (const n of s.userNotes) if (n.text !== undefined) facts.addText(n.text)
  }
  const level = d.source.dateLevel
  if (level !== undefined) {
    facts.addPhotoCount(level.photos.length)
    total += level.photos.length
    for (const ph of level.photos) if (ph.capturedAt !== undefined) facts.addInstant(ph.capturedAt)
    for (const n of level.userNotes) if (n.text !== undefined) facts.addText(n.text)
  }
  facts.addPhotoCount(total)
  facts.addNumber(d.source.stops.length)
}

/** 입력 전체의 입력값(메시지 · 사진 · 데이트). 하루 단위 사진 장수와 전체 장수 · 건수도 넣는다. */
export function factsOf(
  messages: readonly ChatMessageRecord[],
  photos: readonly PhotoRecord[],
  dates: readonly DateRecord[],
): NumberFacts {
  const facts = createNumberFacts()
  for (const m of messages) {
    facts.addInstant(m.source.at)
    facts.addText(m.source.text)
  }
  const photosByDay = new Map<string, number>()
  for (const p of photos) {
    facts.addInstant(p.source.at)
    const day = kstParts(p.source.at)?.date
    if (day !== undefined) photosByDay.set(day, (photosByDay.get(day) ?? 0) + 1)
  }
  for (const n of photosByDay.values()) facts.addPhotoCount(n)
  if (photos.length > 0) facts.addPhotoCount(photos.length)
  for (const d of dates) addDate(facts, d)
  facts.addNumber(messages.length)
  facts.addNumber(photos.length)
  facts.addNumber(dates.length)
  return facts.build()
}

/** 데이트 한 건만의 입력값 - 데이트 아카이브 기사는 그 데이트의 시각만 볼 수 있다(다른 날의 시각으로 반올림을 숨기지 않게). */
export function factsOfDate(d: DateRecord): NumberFacts {
  const facts = createNumberFacts()
  addDate(facts, d)
  return facts.build()
}

/** 칸 하나를 만든다(값이 문자열이 아니면 빼고). */
export function target(
  field: string,
  tone: FieldTone,
  text: unknown,
  facts: NumberFacts,
  contextDates: readonly string[],
  knownDates: readonly string[],
): ContentTarget[] {
  return typeof text === 'string' ? [{ field, tone, text, facts, contextDates, knownDates }] : []
}
