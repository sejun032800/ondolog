/**
 * 채팅 지표 엔진 v0 — 순수 함수 · 결정론 · LLM 0 (ROADMAP r157 R157-3 · R157-4, 위임 `m20-a1` ①).
 *
 * 두 사람의 결(DNA `chatDelta`) · 어림짐작 4~7번이 함께 쓰는 **채팅 숫자**를 한 곳에서 계산한다.
 * 연애 온도(`temperature.ts`)의 하루 건수와 달리 이 파일의 지표는 **비율 · 분포**다(R157-4 — MASTER 17-2 "양 금지"는
 * 절대량 금지로 읽는다). 단 하나 "가장 말이 많았던 날"만 양이고, 그 값은 어림짐작 7번에만 쓴다(`chatDelta` 0).
 *
 * ── 입력 ────────────────────────────────────────────────────────────────
 * 그 기간의 메시지 목록: id(정렬 동점 깨기에만) · 보낸 사람 · 보낸 시각(ISO, 오프셋 포함) · 종류 · 본문.
 * **본문은 이모지 판정(`hasEmoji`)에만 읽는다.** 결과에는 집계 숫자만 남는다 — 원문 · 메시지 id 0.
 *
 * ── 무엇을 세는가 (v0 · 메인 세션 결정 · 근거) ─────────────────────────────
 * - **삭제된 메시지**: 세지 않는다. 호출부(입력 조립)가 `deleted_at is null`만 넘긴다(입력 조립 규칙 그대로).
 * - **사진(본문 없는 미디어) 메시지**: 대화 묶음 · 왕복 · 먼저 말 거는 쪽 · 하루 건수에는 **센다**. 사진을 보내는 것도
 *   대화의 한 차례이고, 빼면 "사진으로 답한 차례"가 간격을 부풀린다. 이모지 비율의 분모에서는 **뺀다**(본문이 없어 판정할 글이 없다).
 * - **시스템 메시지**: 지금 스키마(`messages`)에 종류가 없다 — 모든 행은 두 사람 중 한 명이 보낸 것이다. 두 사람이 아닌
 *   보낸 사람 id는 **세지 않는다**(방어).
 * - **본문 앞뒤 공백뿐인 글**: 입력 조립이 이미 빼는 "의미 없는 조각"(§17-0-9-F-2)과 달리 여기서는 대화의 차례로 센다 —
 *   이 엔진은 원문의 의미를 보지 않는다(숫자만).
 *
 * ── 정렬 · 동점 · 시간대 ───────────────────────────────────────────────────
 * - 시각 오름차순, 같으면 id 오름차순(문자열 비교). 입력 순서와 무관하다.
 * - 하루 경계는 KST 0시(`temperature.ts` `kstDayKey`).
 * - "가장 말이 많았던 날"이 동점이면 이른 날.
 *
 * ── 대화 묶음(세션) ─────────────────────────────────────────────────────
 * 앞 메시지와의 간격이 `CHAT_METRICS_V0.sessionGapMs`(6시간) **이상**이면 새 묶음이 시작된다. 첫 메시지는 첫 묶음의 시작.
 * 왕복 리듬 · 주고받기 비율은 **묶음 안에서만** 센다(밤새 잔 뒤의 첫 답을 "늦은 답장"으로 세지 않는다).
 *
 * ── 지표 정의 ───────────────────────────────────────────────────────────
 * ① 왕복 리듬(`replyGap`): 묶음 안에서 보낸 사람이 바뀌는 자리마다, **앞사람의 마지막 메시지 → 바뀐 사람의 첫 메시지** 간격(초).
 *    "상대가 보낸 메시지에 이어진 첫 답장까지의 간격"이다. 분포 = 중앙값 · 1사분위 · 3사분위(선형 보간 R-7, 아래 `quantile`).
 *    두 사람 합친 분포와, 답한 사람별 분포를 함께 낸다.
 * ② 주고받기 비율(`turnTaking`): 묶음마다 (보낸 사람이 바뀐 횟수) ÷ (메시지 수 − 1)을 **합쳐서** 센다 —
 *    Σ바뀐 횟수 ÷ Σ(메시지 수 − 1). 메시지 1개짜리 묶음은 분모 0이라 더하지 않는다. 0~1.
 * ③ 먼저 말 거는 쪽(`initiator`): 묶음의 첫 메시지를 보낸 사람의 비율. 두 사람 비율의 합 = 1.
 * ④ 이모지 비율(`emoji`): 사람별로 (이모지가 든 본문 메시지) ÷ (본문 메시지). 판정 함수는 `hasEmoji` 하나(Unicode
 *    `Extended_Pictographic`). 본문 메시지가 0인 사람은 그 사람 값이 "없음".
 * ⑤ 가장 말이 많았던 날(`busiestDay`): KST 하루 메시지 수가 가장 많은 날(동점이면 이른 날) · 그날 건수.
 *
 * ── 부족하면 "없음" ─────────────────────────────────────────────────────
 * - 묶음이 `minSessions`(2)개 미만이면 **①~④ 전부 `null`**(묶음 하나로는 리듬 · 비율이 우연에 묶인다). ⑤는 메시지가 1개 이상이면 있다.
 * - ①은 바뀐 자리가 0이면(한 사람만 말함) `null`. 사람별 분포는 그 사람이 답한 자리가 0이면 `null`.
 * - 0으로 채우지 않는다. 한 사람만 말한 기간의 ② = 0은 **잰 값**이다(바뀐 적이 없다).
 *
 * 매개변수는 모두 `CHAT_METRICS_V0` 한 곳에 있다.
 */

import { kstDayKey } from './temperature'
import { roundTo } from './numeric'

/** v0 매개변수 — 한 곳. 바꾸면 `version`을 올린다. */
export const CHAT_METRICS_V0 = {
  version: 'chat_metrics_v0',
  /** 이 간격 이상 비면 새 대화 묶음(밀리초). 6시간 — 잠 · 근무 시간 한 덩어리를 넘는 공백. */
  sessionGapMs: 6 * 60 * 60 * 1000,
  /** 묶음이 이보다 적으면 ①~④는 "없음". */
  minSessions: 2,
} as const

/** 결과의 소수 자리(비율 0~1). */
const RATIO_DECIMALS = 4
/** 간격(초)의 소수 자리. */
const SECONDS_DECIMALS = 1

export type ChatEventKind = 'text' | 'media'

/** 메시지 한 건. `text`는 이모지 판정에만 쓴다. */
export interface ChatEvent {
  /** 정렬 동점 깨기에만 쓴다(결과에 남지 않는다). */
  readonly id: string
  readonly senderId: string
  /** ISO8601, 오프셋 포함. */
  readonly sentAt: string
  readonly kind: ChatEventKind
  readonly text: string | null
}

export interface Distribution {
  readonly count: number
  /** 초. */
  readonly q1: number
  readonly median: number
  readonly q3: number
}

export interface PairValue<T> {
  /** 커플의 첫 번째 사람(`people[0]`). */
  readonly a: T
  /** 두 번째 사람(`people[1]`). */
  readonly b: T
}

export interface ChatMetrics {
  readonly version: string
  /** 센 메시지 수(두 사람이 보낸 것). 발행 노트 · 어림짐작 30건 문턱에 쓴다. */
  readonly messageCount: number
  /** 대화 묶음 수. 발행 노트 "채팅 지표 계산에 쓴 메시지 묶음 수". */
  readonly sessionCount: number
  /** ① 왕복 리듬. 묶음 부족 또는 바뀐 자리 0이면 null. */
  readonly replyGap: {
    readonly all: Distribution
    /** 답한 사람별. 그 사람이 답한 자리가 0이면 null. */
    readonly byResponder: PairValue<Distribution | null>
  } | null
  /** ② 주고받기 비율 0~1. 묶음 부족이면 null. */
  readonly turnTaking: number | null
  /** ③ 먼저 말 거는 쪽 비율(합 1). 묶음 부족이면 null. */
  readonly initiator: PairValue<number> | null
  /** ④ 이모지 비율(사람별 0~1, 본문 메시지 0이면 그 사람 null). 묶음 부족이면 전체 null. */
  readonly emoji: PairValue<number | null> | null
  /** ⑤ 가장 말이 많았던 날(KST). 메시지 0이면 null. */
  readonly busiestDay: { readonly date: string; readonly count: number } | null
}

/** 이모지 판정 — 하나로 고정(Unicode `Extended_Pictographic`). 숫자 · `#` · `*` 같은 키캡 바탕 글자는 이 속성이 아니다. */
const EMOJI_RE = /\p{Extended_Pictographic}/u
export function hasEmoji(text: string): boolean {
  return EMOJI_RE.test(text)
}

/**
 * 분위수 — 선형 보간(R-7, Hyndman-Fan type 7): 정렬한 값 x[0..n-1]에서 h = (n−1)p, x[⌊h⌋] + (h−⌊h⌋)(x[⌊h⌋+1] − x[⌊h⌋]).
 * 값이 하나면 그 값. 빈 배열은 호출하지 않는다.
 */
export function quantile(sorted: readonly number[], p: number): number {
  const h = (sorted.length - 1) * p
  const lo = Math.floor(h)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}

function distributionOf(values: readonly number[]): Distribution | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((x, y) => x - y)
  return {
    count: sorted.length,
    q1: roundTo(quantile(sorted, 0.25), SECONDS_DECIMALS),
    median: roundTo(quantile(sorted, 0.5), SECONDS_DECIMALS),
    q3: roundTo(quantile(sorted, 0.75), SECONDS_DECIMALS),
  }
}

interface Timed {
  readonly ev: ChatEvent
  readonly ms: number
}

/**
 * 채팅 지표를 계산한다. `people` = 커플의 두 사람 id(순서가 결과의 a · b). 같은 입력 → 같은 출력.
 * 시각을 해석할 수 없는 메시지는 입력 무결성 오류로 던진다(조용히 빼지 않는다).
 */
export function computeChatMetrics(events: readonly ChatEvent[], people: readonly [string, string]): ChatMetrics {
  const [aId, bId] = people
  if (aId === bId) throw new RangeError('computeChatMetrics: 두 사람 id가 같다')

  const timed: Timed[] = []
  for (const ev of events) {
    if (ev.senderId !== aId && ev.senderId !== bId) continue
    const ms = Date.parse(ev.sentAt)
    if (!Number.isFinite(ms)) throw new RangeError(`computeChatMetrics: 시각을 해석할 수 없다 (${ev.id})`)
    timed.push({ ev, ms })
  }
  timed.sort((x, y) => x.ms - y.ms || (x.ev.id < y.ev.id ? -1 : x.ev.id > y.ev.id ? 1 : 0))

  // ⑤ 가장 말이 많았던 날
  const perDay = new Map<string, number>()
  for (const t of timed) {
    const day = kstDayKey(t.ev.sentAt)
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  let busiestDay: ChatMetrics['busiestDay'] = null
  for (const [date, count] of [...perDay.entries()].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))) {
    if (busiestDay === null || count > busiestDay.count) busiestDay = { date, count }
  }

  // 대화 묶음
  const sessions: Timed[][] = []
  for (const t of timed) {
    const current = sessions[sessions.length - 1]
    if (current === undefined || t.ms - current[current.length - 1].ms >= CHAT_METRICS_V0.sessionGapMs) sessions.push([t])
    else current.push(t)
  }

  const base = { version: CHAT_METRICS_V0.version, messageCount: timed.length, sessionCount: sessions.length, busiestDay }
  if (sessions.length < CHAT_METRICS_V0.minSessions) {
    return { ...base, replyGap: null, turnTaking: null, initiator: null, emoji: null }
  }

  // ① ② ③
  const gapsAll: number[] = []
  const gapsBy: Record<string, number[]> = { [aId]: [], [bId]: [] }
  let switches = 0
  let pairs = 0
  const starts: Record<string, number> = { [aId]: 0, [bId]: 0 }
  for (const s of sessions) {
    starts[s[0].ev.senderId] += 1
    pairs += s.length - 1
    for (let i = 1; i < s.length; i += 1) {
      if (s[i].ev.senderId !== s[i - 1].ev.senderId) {
        switches += 1
        const seconds = (s[i].ms - s[i - 1].ms) / 1000
        gapsAll.push(seconds)
        gapsBy[s[i].ev.senderId].push(seconds)
      }
    }
  }
  const all = distributionOf(gapsAll)
  const replyGap = all === null ? null : { all, byResponder: { a: distributionOf(gapsBy[aId]), b: distributionOf(gapsBy[bId]) } }
  const turnTaking = pairs === 0 ? null : roundTo(switches / pairs, RATIO_DECIMALS)
  const initiatorA = roundTo(starts[aId] / sessions.length, RATIO_DECIMALS)
  const initiator = { a: initiatorA, b: roundTo(1 - initiatorA, RATIO_DECIMALS) }

  // ④
  const emojiOf = (id: string): number | null => {
    const texts = timed.filter((t) => t.ev.senderId === id && t.ev.kind === 'text' && typeof t.ev.text === 'string')
    if (texts.length === 0) return null
    return roundTo(texts.filter((t) => hasEmoji(t.ev.text as string)).length / texts.length, RATIO_DECIMALS)
  }

  return { ...base, replyGap, turnTaking, initiator, emoji: { a: emojiOf(aId), b: emojiOf(bId) } }
}
