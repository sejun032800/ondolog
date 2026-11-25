/**
 * 얼렁뚱땅 어림짐작 — 8항목 산출(순수 함수 · 결정론). MASTER 17-9 · 기획서 2절 6. · ROADMAP R157-5, 위임 `m20-a1` ③.
 *
 * - 1~3 · 8번 = **추정**(성격 데이터만) · 4~7번 = **실측**(`chatMetrics.ts`). 지면에서 `source`로 구분한다.
 * - 7번의 한 줄("그날은 OO 얘기가 오갔습니다")만 LLM이 쓴다 — 이 파일은 날짜 · 건수까지만 정한다.
 * - **비슷함**(기획서 2절 6.): 두 사람의 값 차이가 10%p 미만이면 누구 쪽이라고 말하지 않고 "비슷합니다"로 쓴다.
 *   확률 항목은 두 값이 p · (100 − p)이므로 |2p − 100| < 10. 답장 속도(시간)는 %p가 없어 **상대 차이 10% 미만**으로 같은 뜻을 건다(v0 · 보고).
 * - **50% 미만은 뒤집지 않고 주어를 바꾼다**(MASTER 17-9): "가람님 27%" → "나래님 73%".
 * - 8번 주제는 `fnv1a32(couple_id + period) % 12`(MASTER 17-9 `selectMonthlyTopic`). `period` = 기간 시작의 'YYYY-MM'.
 *
 * ── 추정 항목의 v0 식 (MASTER 17-9는 입력 변수만 정했다 — 메인 세션 v0 · PM 승인 대상) ─────────────
 * 사람마다 성향 점수 s = 입력 성향(0~1로 바꾼 값)의 평균. 두 사람 차이로 "A 쪽일 확률"을 만든다:
 *   P(A) = clamp(50 + 50 · (s_A − s_B), 0, 100) → 정수 반올림.
 * 같은 성향이면 50(비슷합니다), 한 성향이 0과 1로 정반대여도 입력이 여럿이라 극단(0 · 100)은 드물다.
 * 성향 0~1 바꾸기: 빅5 · 스턴버그 · 애착 회피 = 값 ÷ 100 · 애니어그램 주장형(3 · 7 · 8) / 후퇴형(4 · 5 · 9) = 1 또는 0 ·
 * MBTI 판단형(J) = 1 / 인식형(P) = 0.
 *
 * ── 실측 항목 ─────────────────────────────────────────────────────────
 * 4 답장 속도 = 답한 사람별 왕복 간격 중앙값(MASTER는 N · C도 입력으로 적었지만 A1은 **실측만** 쓴다 — 지면 숫자가 대화로만 거슬러 오르게).
 * 5 먼저 말 거는 쪽 = 묶음 첫 메시지 비율 · 6 이모지 = 사람별 이모지 비율 · 7 가장 말이 많았던 날.
 * MASTER "채팅 30건 미만이면 4 · 5 · 6 · 7 제외"를 그대로 건다(`ROUGH_GUESS_V0.minMessages`). 지표가 "없음"이면 그 항목만 빠진다.
 *
 * ── 코너가 빠지는 때 (메인 세션 제안 · 보고) ─────────────────────────────
 * - 두 사람 중 한 명이라도 성격 데이터가 없으면 → `no_personality`(DNA와 같은 문장).
 * - 실측 항목(4~7)이 하나도 없으면 → `little_chat`. 기획서 1절 발행 조건이 "성격 데이터 + 채팅"이라 MASTER의 "1 · 2 · 3 · 8만"
 *   폴백보다 앞선다(R156-2). 7번은 메시지가 30건 이상이면 늘 있으므로, 사실상 "그달 메시지 30건 이상"이 조건이다.
 */

import type { ChatMetrics } from './chatMetrics'
import type { CoupleProfiles, PersonProfile } from './coupleProfile'
import { ROUGH_GUESS_TOPICS, type RoughGuessTopic, type TopicTrait } from '../constants/roughGuessTopics'
import { clamp, roundTo } from './numeric'

export const ROUGH_GUESS_V0 = {
  version: 'rough_guess_v0',
  /** MASTER 17-9 "채팅 30건 미만" 문턱. */
  minMessages: 30,
  /** 비슷함 — %p(확률 · 비율 항목). */
  similarPercentPoints: 10,
  /** 비슷함 — 상대 차이(답장 속도). */
  similarRelative: 0.1,
} as const

export const ROUGH_GUESS_DISCLAIMER = '재미로만 봐주세요. 진짜로 재는 건 아닙니다.'
export const ROUGH_GUESS_FOOTNOTE = '성격 검사와 이번 달 대화 기록으로 계산했습니다'

export type RoughGuessSource = 'estimate' | 'measured'

export interface ProbabilityItem {
  readonly no: 1 | 2 | 3 | 8
  readonly key: string
  readonly label: string
  readonly source: 'estimate'
  readonly kind: 'probability'
  readonly similar: boolean
  /** 비슷하면 null. */
  readonly subject: string | null
  /** 50~100(비슷하면 null). */
  readonly percent: number | null
  /** 지면 한 줄(결정론). */
  readonly line: string
}

export interface PairItemValue {
  readonly name: string
  /** 계산 값(초 또는 %). */
  readonly value: number
  /** 지면 표기("2분" · "58%"). */
  readonly display: string
}

export interface PairItem {
  readonly no: 4 | 5 | 6
  readonly key: string
  readonly label: string
  readonly source: 'measured'
  readonly kind: 'compare' | 'gauge'
  readonly similar: boolean
  readonly subject: string | null
  readonly a: PairItemValue
  readonly b: PairItemValue
  readonly line: string
}

export interface RoughGuessFacts {
  readonly version: string
  readonly items: readonly (ProbabilityItem | PairItem)[]
  readonly busiestDay: { readonly no: 7; readonly date: string; readonly count: number; readonly source: 'measured' } | null
  readonly monthlyTopic: { readonly id: number; readonly title: string; readonly item: ProbabilityItem }
  readonly disclaimer: string
  readonly footnote: string
}

export type RoughGuessResult =
  | { readonly ok: true; readonly facts: RoughGuessFacts }
  | { readonly ok: false; readonly skip: 'no_personality' | 'little_chat' }

/** FNV-1a 32비트 — 문자열의 UTF-8 바이트(코드포인트로 직접 만든다 · 환경 API 0). */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5
  const add = (byte: number) => {
    h ^= byte
    h = Math.imul(h, 0x01000193) >>> 0
  }
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number
    if (cp < 0x80) add(cp)
    else if (cp < 0x800) {
      add(0xc0 | (cp >> 6))
      add(0x80 | (cp & 0x3f))
    } else if (cp < 0x10000) {
      add(0xe0 | (cp >> 12))
      add(0x80 | ((cp >> 6) & 0x3f))
      add(0x80 | (cp & 0x3f))
    } else {
      add(0xf0 | (cp >> 18))
      add(0x80 | ((cp >> 12) & 0x3f))
      add(0x80 | ((cp >> 6) & 0x3f))
      add(0x80 | (cp & 0x3f))
    }
  }
  return h >>> 0
}

/** MASTER 17-9 `selectMonthlyTopic` — 같은 커플 · 같은 달 → 같은 주제. */
export function selectMonthlyTopic(coupleId: string, period: string): RoughGuessTopic {
  return ROUGH_GUESS_TOPICS[fnv1a32(coupleId + period) % ROUGH_GUESS_TOPICS.length]
}

function traitValue(p: PersonProfile, t: TopicTrait): number {
  let v: number
  switch (t.key) {
    case 'o':
    case 'c':
    case 'e':
    case 'a':
    case 'n':
      v = p.bigFive[t.key] / 100
      break
    case 'passion':
      v = p.sternberg.passion / 100
      break
    case 'commitment':
      v = p.sternberg.commitment / 100
      break
    case 'avoidance':
      v = p.attachAvoidance / 100
      break
    case 'assertive':
      v = p.enneagramCore === 3 || p.enneagramCore === 7 || p.enneagramCore === 8 ? 1 : 0
      break
    case 'withdrawn':
      v = p.enneagramCore === 4 || p.enneagramCore === 5 || p.enneagramCore === 9 ? 1 : 0
      break
    case 'judging':
      v = p.mbti.charAt(3) === 'J' ? 1 : 0
      break
  }
  return t.invert === true ? 1 - v : v
}

function score(p: PersonProfile, traits: readonly TopicTrait[]): number {
  return traits.reduce((sum, t) => sum + traitValue(p, t), 0) / traits.length
}

function sameish(x: number, y: number): boolean {
  return Math.abs(x - y) < ROUGH_GUESS_V0.similarPercentPoints
}

function probabilityItem(
  no: 1 | 2 | 3 | 8,
  key: string,
  label: string,
  phrase: string,
  traits: readonly TopicTrait[],
  a: PersonProfile,
  b: PersonProfile,
): ProbabilityItem {
  const pA = roundTo(clamp(50 + 50 * (score(a, traits) - score(b, traits)), 0, 100), 0)
  const similar = sameish(pA, 100 - pA)
  const [subject, percent] = pA >= 50 ? [a.name, pA] : [b.name, 100 - pA]
  return {
    no,
    key,
    label,
    source: 'estimate',
    kind: 'probability',
    similar,
    subject: similar ? null : subject,
    percent: similar ? null : percent,
    line: similar ? `${a.name}님과 ${b.name}님이 비슷합니다` : `${subject}님이 ${phrase} ${percent}%`,
  }
}

/** 초 → "48초" · "12분" · "1시간 5분"(분은 반올림, 시간 단위는 내림 + 남은 분). */
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${roundTo(seconds, 0)}초`
  const minutes = roundTo(seconds / 60, 0)
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60)
  const m = minutes - h * 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

function percentOf(ratio: number): number {
  return roundTo(ratio * 100, 0)
}

export function computeRoughGuess(params: {
  readonly profiles: CoupleProfiles
  readonly metrics: ChatMetrics
  readonly coupleId: string
  /** 'YYYY-MM'. */
  readonly period: string
}): RoughGuessResult {
  const { a, b } = params.profiles
  if (a === null || b === null) return { ok: false, skip: 'no_personality' }

  const items: (ProbabilityItem | PairItem)[] = [
    probabilityItem(1, 'confess_first', '먼저 고백했을 확률', '먼저 고백했을 확률', [{ key: 'e' }, { key: 'assertive' }, { key: 'passion' }], a, b),
    probabilityItem(2, 'conflict_step_back', '갈등 회피 지수', '먼저 한발 물러설 확률', [{ key: 'a' }, { key: 'avoidance' }, { key: 'withdrawn' }], a, b),
    probabilityItem(3, 'anniversary_care', '기념일 챙기는 정도', '기념일을 먼저 챙길 확률', [{ key: 'c' }, { key: 'commitment' }, { key: 'judging' }], a, b),
  ]

  const m = params.metrics
  const enoughChat = m.messageCount >= ROUGH_GUESS_V0.minMessages
  let measured = 0

  if (enoughChat && m.replyGap !== null && m.replyGap.byResponder.a !== null && m.replyGap.byResponder.b !== null) {
    const va = m.replyGap.byResponder.a.median
    const vb = m.replyGap.byResponder.b.median
    const top = Math.max(va, vb)
    const similar = top === 0 ? true : Math.abs(va - vb) / top < ROUGH_GUESS_V0.similarRelative
    const faster = va <= vb ? a.name : b.name
    items.push({
      no: 4,
      key: 'reply_speed',
      label: '답장 속도',
      source: 'measured',
      kind: 'compare',
      similar,
      subject: similar ? null : faster,
      a: { name: a.name, value: va, display: durationLabel(va) },
      b: { name: b.name, value: vb, display: durationLabel(vb) },
      line: similar ? `${a.name}님과 ${b.name}님이 비슷합니다` : `${a.name}님 ${durationLabel(va)} · ${b.name}님 ${durationLabel(vb)}`,
    })
    measured += 1
  }
  if (enoughChat && m.initiator !== null) {
    const pa = percentOf(m.initiator.a)
    const pb = 100 - pa
    const similar = sameish(pa, pb)
    const subject = pa >= pb ? a.name : b.name
    items.push({
      no: 5,
      key: 'talk_first',
      label: '먼저 말을 거는 쪽',
      source: 'measured',
      kind: 'gauge',
      similar,
      subject: similar ? null : subject,
      a: { name: a.name, value: pa, display: `${pa}%` },
      b: { name: b.name, value: pb, display: `${pb}%` },
      line: similar ? `${a.name}님과 ${b.name}님이 비슷합니다` : `먼저 말을 거는 쪽 — ${subject}님`,
    })
    measured += 1
  }
  if (enoughChat && m.emoji !== null && m.emoji.a !== null && m.emoji.b !== null) {
    const pa = percentOf(m.emoji.a)
    const pb = percentOf(m.emoji.b)
    const similar = sameish(pa, pb)
    const subject = pa >= pb ? a.name : b.name
    items.push({
      no: 6,
      key: 'emoji_more',
      label: '이모지를 더 쓰는 쪽',
      source: 'measured',
      kind: 'gauge',
      similar,
      subject: similar ? null : subject,
      a: { name: a.name, value: pa, display: `${pa}%` },
      b: { name: b.name, value: pb, display: `${pb}%` },
      line: similar ? `${a.name}님과 ${b.name}님이 비슷합니다` : `이모지를 더 쓰는 쪽 — ${subject}님`,
    })
    measured += 1
  }
  const busiestDay = enoughChat && m.busiestDay !== null ? { no: 7 as const, date: m.busiestDay.date, count: m.busiestDay.count, source: 'measured' as const } : null
  if (busiestDay !== null) measured += 1

  if (measured === 0) return { ok: false, skip: 'little_chat' }

  const topic = selectMonthlyTopic(params.coupleId, params.period)
  return {
    ok: true,
    facts: {
      version: ROUGH_GUESS_V0.version,
      items,
      busiestDay,
      monthlyTopic: { id: topic.id, title: topic.title, item: probabilityItem(8, `topic_${topic.id}`, topic.title, topic.phrase, topic.traits, a, b) },
      disclaimer: ROUGH_GUESS_DISCLAIMER,
      footnote: ROUGH_GUESS_FOOTNOTE,
    },
  }
}
