/**
 * M1b 입력 전처리 후보 - 채팅 입력량 상한 후보와 규칙 기반 사전 선별 후보, 그리고 API 없는 토큰 추정.
 * 위임: .claude/state/prompts/phase-7/52-corner-pipeline-m1b-prompt-refinement.md
 *
 * 이 파일은 **하네스 전용**이다. 입력 조립(`inputAssembly.ts`)·코너 코드·운영 경로 어디에서도 부르지 않는다.
 * PM이 M1c 전에 후보를 하나로 정하기 전까지, 후보는 `m1QualityRun.ts dry`의 `--cap`·`--select` 옵션으로만 쓴다.
 * 실제 호출(`run`)에는 연결하지 않았다.
 *
 * 주의 - 후보 규칙은 이 합성 데이터셋(`fixtures/m1-month/`)을 보면서 썼다. 같은 데이터셋으로 잰 수치는
 * "후보가 어떻게 동작하는가"를 보이는 것이지 일반 데이터에서의 정확도가 아니다.
 *
 * 네트워크 없음. 결정론(시간·난수 없음).
 */

import type { ChatMessageRecord } from '../../supabase/functions/_shared/corners/cornerCommon.ts'

// ---------------------------------------------------------------------------
// 토큰 추정 - API를 부르지 않는다.
// ---------------------------------------------------------------------------

/**
 * 글자 종류별 가중치의 합으로 토큰 수를 추정한다. 공급자 토크나이저가 아니므로 **측정값이 아니다.**
 * 하한·중간·상한 세 벌을 같이 낸다 - 한글이 토큰당 몇 글자로 묶이는지를 모르기 때문이다.
 * 실제 토큰 수는 M1c에서 응답의 `usage`로 확인한다.
 */
export interface TokenWeights {
  readonly hangul: number // 완성형 한글 음절
  readonly jamo: number // ㅋ ㅎ ㅠ 같은 자모 단독
  readonly alnum: number // ASCII 영문·숫자
  readonly space: number // 공백·개행
  readonly punct: number // ASCII 구두점·JSON 기호
  readonly other: number // 이모지·한자·기타
}

export const TOKEN_WEIGHTS = {
  low: { hangul: 0.6, jamo: 0.5, alnum: 0.2, space: 0.15, punct: 0.35, other: 1.0 },
  mid: { hangul: 1.0, jamo: 1.0, alnum: 0.25, space: 0.25, punct: 0.5, other: 2.0 },
  high: { hangul: 1.5, jamo: 1.5, alnum: 0.35, space: 0.35, punct: 0.8, other: 3.0 },
} as const satisfies Record<string, TokenWeights>

export type TokenBand = keyof typeof TOKEN_WEIGHTS

export function estimateTokens(text: string, band: TokenBand): number {
  const w = TOKEN_WEIGHTS[band]
  let sum = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c >= 0xac00 && c <= 0xd7a3) sum += w.hangul
    else if ((c >= 0x3131 && c <= 0x318e) || (c >= 0x1100 && c <= 0x11ff)) sum += w.jamo
    else if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) sum += w.alnum
    else if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) sum += w.space
    else if (c < 0x80) sum += w.punct
    else sum += w.other
  }
  return Math.ceil(sum)
}

// ---------------------------------------------------------------------------
// 후보 공통
// ---------------------------------------------------------------------------

export type Messages = readonly ChatMessageRecord[]

export interface Candidate {
  readonly id: string
  /** 한 줄 규칙 설명(보고용). */
  readonly rule: string
  /** 입력 메시지 -> 남기는 메시지(시각 순 유지). 순수 함수. */
  readonly apply: (messages: Messages) => ChatMessageRecord[]
}

/** KST 날짜 키. `source.at`은 `+09:00` 표기 ISO8601이다. */
export function dayOf(m: ChatMessageRecord): string {
  return m.source.at.slice(0, 10)
}

function byTime(messages: Messages): ChatMessageRecord[] {
  return [...messages].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || (a.id < b.id ? -1 : 1))
}

function groupByDay(messages: Messages): Map<string, ChatMessageRecord[]> {
  const days = new Map<string, ChatMessageRecord[]>()
  for (const m of byTime(messages)) {
    const list = days.get(dayOf(m))
    if (list === undefined) days.set(dayOf(m), [m])
    else list.push(m)
  }
  return days
}

/** 같은 날 안에서 앞 메시지와 `gapMinutes` 이상 벌어지면 새 묶음. */
function bursts(dayMessages: readonly ChatMessageRecord[], gapMinutes: number): ChatMessageRecord[][] {
  const out: ChatMessageRecord[][] = []
  for (const m of dayMessages) {
    const last = out.at(-1)
    const prev = last?.at(-1)
    if (last !== undefined && prev !== undefined && m.occurredAt.getTime() - prev.occurredAt.getTime() < gapMinutes * 60_000) last.push(m)
    else out.push([m])
  }
  return out
}

const BURST_GAP_MINUTES = 60

/**
 * 하루 `limit`건 안에서 묶음을 시각 순으로 담는다. 묶음을 중간에 자르지 않는다 - 들어가지 않는 묶음은 건너뛰고
 * 다음 묶음을 시도한다. 단, 그날 아무것도 못 담았는데 묶음이 `limit`보다 길면 그 묶음의 앞 `limit`건을 담는다.
 */
function fillByBursts(dayMessages: readonly ChatMessageRecord[], limit: number): ChatMessageRecord[] {
  const kept: ChatMessageRecord[] = []
  for (const burst of bursts(dayMessages, BURST_GAP_MINUTES)) {
    if (kept.length + burst.length <= limit) kept.push(...burst)
    else if (kept.length === 0 && burst.length > limit) kept.push(...burst.slice(0, limit))
  }
  return kept
}

// ---------------------------------------------------------------------------
// 입력량 상한 후보 (--cap)
// ---------------------------------------------------------------------------

export const DAY_LIMIT = 12
export const MONTH_LIMIT = 200

export const CAP_CANDIDATES: readonly Candidate[] = [
  {
    id: 'cap-a',
    rule: `하루 ${DAY_LIMIT}건. 넘으면 그날의 뒤쪽을 자른다(앞 ${DAY_LIMIT}건 유지)`,
    apply: (messages) => [...groupByDay(messages).values()].flatMap((day) => day.slice(0, DAY_LIMIT)),
  },
  {
    id: 'cap-b',
    rule: `하루 ${DAY_LIMIT}건. 대화 묶음(${BURST_GAP_MINUTES}분 이상 비면 새 묶음)을 시각 순으로 담고 묶음을 중간에 자르지 않는다`,
    apply: (messages) => [...groupByDay(messages).values()].flatMap((day) => fillByBursts(day, DAY_LIMIT)),
  },
  {
    id: 'cap-c',
    rule: `월 합계 ${MONTH_LIMIT}건. 날마다 같은 몫(q)을 주되 q는 합이 ${MONTH_LIMIT}을 넘지 않는 가장 큰 정수이고, 몫 안에서는 cap-b처럼 묶음을 자르지 않는다`,
    apply: (messages) => {
      const days = groupByDay(messages)
      const counts = [...days.values()].map((d) => d.length)
      let q = 0
      const longestDay = Math.max(0, ...counts)
      while (q < longestDay && counts.reduce((s, n) => s + Math.min(n, q + 1), 0) <= MONTH_LIMIT) q += 1
      return [...days.values()].flatMap((day) => fillByBursts(day, q))
    },
  },
]

// ---------------------------------------------------------------------------
// 규칙 기반 사전 선별 후보 (--select) - LLM 없이 글자 규칙만
// ---------------------------------------------------------------------------

/** 공백·구두점·기호·이모지를 지운 본문. */
function core(text: string): string {
  return text.replace(/[\s\p{P}\p{S}]/gu, '')
}

function isTrivial(text: string): boolean {
  const c = core(text)
  if (c.length <= 1) return true // 한 글자, 또는 기호·이모지뿐("...", "💛")
  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/u.test(c)) return true // ㅋㅋㅋ, ㅠㅠ 같은 자모뿐
  if (/^https?:\/\/\S+$/u.test(text.trim())) return true // 링크뿐
  return false
}

/** 갈등 어휘 - 고정 목록. 하루에 이 말이 든 메시지가 `FRICTION_MIN_MESSAGES`건 이상이면 그 날을 뺀다. */
export const FRICTION_LEXICON = ['서운', '화났', '화내', '속상', '따지', '짜증', '읽씹', '일부러', '세게', '싸우', '싸웠'] as const
export const FRICTION_MIN_MESSAGES = 2

/** 다정 단서 - 고정 목록. 이 말이 든 메시지의 앞뒤 `WARM_RADIUS`건(같은 날)을 남긴다. */
export const WARM_LEXICON = ['고마', '고맙', '사랑', '보고 싶', '보고싶', '좋았', '행복', '덕분', '웃어', '심장', '완벽', '소중', '수고했', '힘났', '💛', '❤'] as const
export const WARM_RADIUS = 2
export const QUIET_DAY_MAX = 2

export const SELECT_CANDIDATES: readonly Candidate[] = [
  {
    id: 'sel-a',
    rule: '의미 없는 메시지 제거: 기호를 뺀 본문이 한 글자 이하이거나, ㅋ·ㅠ 같은 자모뿐이거나, 링크뿐인 메시지',
    apply: (messages) => byTime(messages).filter((m) => !isTrivial(m.source.text)),
  },
  {
    id: 'sel-b',
    rule: `조용한 날 제거: 하루 메시지가 ${QUIET_DAY_MAX}건 이하인 날의 메시지 전부`,
    apply: (messages) => [...groupByDay(messages).values()].filter((d) => d.length > QUIET_DAY_MAX).flat(),
  },
  {
    id: 'sel-c',
    rule: `갈등 어휘 날 제거: 갈등 어휘(${FRICTION_LEXICON.join('·')})가 든 메시지가 하루 ${FRICTION_MIN_MESSAGES}건 이상인 날의 메시지 전부`,
    apply: (messages) =>
      [...groupByDay(messages).values()]
        .filter((d) => d.filter((m) => FRICTION_LEXICON.some((w) => m.source.text.includes(w))).length < FRICTION_MIN_MESSAGES)
        .flat(),
  },
  {
    id: 'sel-d',
    rule: `다정 단서 주변만 남김: 다정 단서(${WARM_LEXICON.join('·')})가 든 메시지와 같은 날 앞뒤 ${WARM_RADIUS}건`,
    apply: (messages) =>
      [...groupByDay(messages).values()].flatMap((day) => {
        const keep = new Set<number>()
        day.forEach((m, i) => {
          if (WARM_LEXICON.some((w) => m.source.text.includes(w))) {
            for (let j = Math.max(0, i - WARM_RADIUS); j <= Math.min(day.length - 1, i + WARM_RADIUS); j += 1) keep.add(j)
          }
        })
        return day.filter((_, i) => keep.has(i))
      }),
  },
]

// ---------------------------------------------------------------------------
// 손으로 붙인 라벨 - 후보가 무엇을 남기고 빼는지 보이기 위한 것(데이터셋 chat.ts 머리 주석과 같다)
// ---------------------------------------------------------------------------

export interface Landmark {
  readonly label: string
  readonly day: string
  /** 'HH:MM' 이상 */
  readonly from: string
  /** 'HH:MM' 이하 */
  readonly to: string
}

/** 다정한 구간 - 다정한 말들이 실려야 할 자리(사람이 읽고 붙인 라벨). */
export const WARM_LANDMARKS: readonly Landmark[] = [
  { label: '09-05 같은 하늘', day: '2026-09-05', from: '19:50', to: '19:56' },
  { label: '09-05 치킨 뒤 인사', day: '2026-09-05', from: '23:15', to: '23:16' },
  { label: '09-12 요즘 많이 웃어', day: '2026-09-12', from: '12:15', to: '12:21' },
  { label: '09-13 생일 저녁', day: '2026-09-13', from: '13:50', to: '18:46' },
  { label: '09-20 파스타 뒤', day: '2026-09-20', from: '20:40', to: '20:48' },
  { label: '09-28 작은 날들', day: '2026-09-28', from: '11:50', to: '12:00' },
]

/** 다툰 날 - 17-4가 싣지 않아야 하는 날. 09-16 본 다툼, 09-17 뒤끝·화해. */
export const ARGUMENT_DAYS = ['2026-09-16', '2026-09-17'] as const

/** 대화가 거의 없는 날. */
export const QUIET_DAYS = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-23', '2026-09-24'] as const

function inLandmark(m: ChatMessageRecord, lm: Landmark): boolean {
  const hhmm = m.source.at.slice(11, 16)
  return dayOf(m) === lm.day && hhmm >= lm.from && hhmm <= lm.to
}

export interface CandidateStats {
  readonly kept: number
  readonly total: number
  readonly warmKept: number
  readonly warmTotal: number
  /** 라벨 구간별 남은 건수/전체 */
  readonly warmByLandmark: readonly { label: string; kept: number; total: number }[]
  readonly argumentKept: number
  readonly argumentTotal: number
  readonly quietKept: number
  readonly quietTotal: number
  /** 메시지가 하나도 안 남은 날(원래 있던 날 중) */
  readonly emptiedDays: readonly string[]
}

export function statsOf(all: Messages, kept: readonly ChatMessageRecord[]): CandidateStats {
  const keptIds = new Set(kept.map((m) => m.id))
  const warmByLandmark = WARM_LANDMARKS.map((lm) => {
    const inLm = all.filter((m) => inLandmark(m, lm))
    return { label: lm.label, kept: inLm.filter((m) => keptIds.has(m.id)).length, total: inLm.length }
  })
  const argAll = all.filter((m) => (ARGUMENT_DAYS as readonly string[]).includes(dayOf(m)))
  const quietAll = all.filter((m) => (QUIET_DAYS as readonly string[]).includes(dayOf(m)))
  const dayKept = new Map<string, number>()
  for (const m of all) dayKept.set(dayOf(m), (dayKept.get(dayOf(m)) ?? 0) + (keptIds.has(m.id) ? 1 : 0))
  return {
    kept: kept.length,
    total: all.length,
    warmKept: warmByLandmark.reduce((s, x) => s + x.kept, 0),
    warmTotal: warmByLandmark.reduce((s, x) => s + x.total, 0),
    warmByLandmark,
    argumentKept: argAll.filter((m) => keptIds.has(m.id)).length,
    argumentTotal: argAll.length,
    quietKept: quietAll.filter((m) => keptIds.has(m.id)).length,
    quietTotal: quietAll.length,
    emptiedDays: [...dayKept.entries()].filter(([, n]) => n === 0).map(([d]) => d.slice(5)),
  }
}

/** 후보 id 하나를 찾는다. */
export function findCandidate(list: readonly Candidate[], id: string): Candidate {
  const c = list.find((x) => x.id === id)
  if (c === undefined) throw new Error(`알 수 없는 후보: ${id} (${list.map((x) => x.id).join(', ')})`)
  return c
}
