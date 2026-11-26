/**
 * 두 사람의 결(연애 DNA) — 지면의 **숫자 칸** 산출(순수 함수 · 결정론). MASTER 17-2 · 기획서 2절 4. · 위임 `m20-a1` ②.
 *
 * 문장(설명 · 애착 조합 해설 · 강점 · 보완 · 실행 팁)은 코너 생성(LLM 1회, `supabase/functions/_shared/corners/loveDna.ts`)이 쓰고,
 * 이 파일은 그 문장이 대조할 숫자를 정한다.
 *
 * ── 계수 (DNA 계수는 코드 상수 + `coeffVersion` — 위임 "금지 · 멈춤", app_config 키 0) ──────────
 * 기저 61 / 65 / 69 · 클램프 50 / 100은 MASTER 17-2 확정값이다. 엔진 함수(`dnaScore.ts`)는 계수를 인자로만 받는 규칙 그대로이고,
 * 이 파일이 호출부로서 상수를 넘긴다(MASTER 17-2 "계수 출처" 표의 app_config 자리를 코드 상수로 바꾼 것 — 2.0-0 PM 결정 3).
 *
 * ── `chatDelta` v0 (ROADMAP r158 R158-2 "A′") ──────────────────────────
 * 리듬 r = 답장 간격 중앙값 60초 이하 1 · 3시간(10800초) 이상 0 · 그 사이 로그 척도
 *   `r = clamp(1 − (ln m − ln 60)/(ln 10800 − ln 60), 0, 1)`
 * 주고받기 t = 비율 0.2 이하 0 · 0.6 이상 1 · `t = clamp((T − 0.2)/0.4, 0, 1)`
 * `chatDelta = −10 + 35 × (0.5r + 0.5t)` · 계수 버전 `dna_v0`(기저 61/65/69와 한 묶음 - MASTER 17-2 "하나의 coeffVersion").
 * **지표가 하나라도 없으면**(채팅 지표 엔진이 null - 묶음 2개 미만 · 한 사람만 말함) `chatDelta = null` · `chatApplied = false` ·
 * `total = clamp(base)` — 0으로 채우지 않는다. 지면 · 발행 노트는 `chatApplied`로 "채팅 반영 전" 표지를 단다.
 * 이유(R158-2): 몇 시간 단위 답장을 0점 근처로 몰면 "답장이 느리면 덜 맞는다"로 읽혀 판정 금지(3-7)에 걸린다 → 3시간 앵커.
 * v1은 실제 분포의 분위수로 다시 맞춘다.
 *
 * ── 지난 호 대비 ──────────────────────────────────────────────────────
 * 저장된 지난 코너 값(`corners.content.payload.score.total`)과 뺀다. 지난 호 코너가 없으면 `firstIssue = true`("첫 호").
 * 지난 호가 "채팅 반영 전"이고 이번 호가 반영 뒤인 경우도 그대로 뺀다(두 값 모두 지면에 실린 숫자다).
 *
 * ── 빅5 비교 · 스턴버그 겹침 ─────────────────────────────────────────────
 * - 빅5 축마다 두 값 · 차이(절댓값). `relation`: 차이 < 15 → `close`(가까움) · 그 밖 `apart`(다름). 15는 v0(0~100 척도의
 *   여섯째쯤 — PM 승인 대상, 계약 open_questions "aligned/complementary 판정 기준"). 판정어가 아니라 거리의 이름이다.
 * - 스턴버그 세 성분마다 두 값 · 겹침 = 둘 중 작은 값(삼각형이 겹치는 넓이의 성분별 근사 — 지면 그림용 숫자).
 * - 실행 팁(`actionTips`)은 일치율 60 이하에서만 둔다(MASTER 17-2 점수 범위 표).
 */

import {
  DNA_SCORE_DECIMALS,
  DNA_SCORE_MAX,
  DNA_SCORE_MIN,
  computeChatDelta,
  computeDnaBaseScore,
  computeTotalScore,
  type ChatDeltaCoefficients,
  type DnaBaseScoreCoefficients,
} from './dnaScore'
import type { BigFive, CoupleProfiles, PersonProfile } from './coupleProfile'
import type { ChatMetrics } from './chatMetrics'
import type { AttachmentType } from '../constants/attachment'
import { roundTo } from './numeric'

/** MASTER 17-2 확정 기저 세 값. */
export const DNA_BASE_COEFFICIENTS: DnaBaseScoreCoefficients = { contrast: 61, neutral: 65, best: 69 }
/** `chatDelta` v0 계수(ROADMAP r158 R158-2 A′). 바꾸면 `DNA_COEFF_VERSION`을 올린다. */
export const DNA_CHAT_DELTA_V0: ChatDeltaCoefficients = {
  rhythmFastSeconds: 60,
  rhythmSlowSeconds: 10800,
  turnLow: 0.2,
  turnHigh: 0.6,
  rhythmWeight: 0.5,
  min: -10,
  max: 25,
}
/** 기저 세 값 + `chatDelta` v0 한 묶음의 계수 버전(MASTER 17-2 "하나의 coeffVersion으로 함께"). */
export const DNA_COEFF_VERSION = 'dna_v0'
/** ⑨ 승인 전(2.0-A1 1차) 산출에 적힌 계수 버전 - 이미 저장된 호를 읽을 때만 만난다. 새 산출은 쓰지 않는다. */
export const DNA_COEFF_VERSION_BASE_ONLY = 'dna_base_only'
/** 실행 팁 문턱(이하에서만). */
export const DNA_ACTION_TIP_MAX_TOTAL = 60
/** 빅5 축 거리 이름 문턱(v0). */
export const DNA_AXIS_CLOSE_GAP = 15

export const BIG_FIVE_AXES: readonly { readonly key: keyof BigFive; readonly label: string }[] = [
  { key: 'o', label: '개방성' },
  { key: 'c', label: '성실성' },
  { key: 'e', label: '외향성' },
  { key: 'a', label: '우호성' },
  { key: 'n', label: '신경성' },
]

export interface DnaAxis {
  readonly key: keyof BigFive
  readonly label: string
  readonly a: number
  readonly b: number
  readonly gap: number
  readonly relation: 'close' | 'apart'
}

export interface DnaSternbergPart {
  readonly a: number
  readonly b: number
  readonly shared: number
}

export interface LoveDnaFacts {
  readonly score: {
    readonly base: number
    /** 채팅 지표(답장 간격 중앙값 · 주고받기 비율)가 하나라도 없으면 null(채팅 반영 전). */
    readonly chatDelta: number | null
    readonly chatApplied: boolean
    readonly total: number
    readonly coeffVersion: string
    readonly previousTotal: number | null
    /** total − previousTotal(소수 2자리). 첫 호면 null. */
    readonly delta: number | null
    readonly firstIssue: boolean
  }
  readonly partners: readonly [DnaPartner, DnaPartner]
  readonly bigFive: readonly DnaAxis[]
  readonly sternberg: { readonly intimacy: DnaSternbergPart; readonly passion: DnaSternbergPart; readonly commitment: DnaSternbergPart }
  /** `pairLabel` = 지면 짝 이름(`ATTACHMENT_PAIR_LABELS`) - 애착 유형 이름 대신. */
  readonly attachment: { readonly a: AttachmentType; readonly b: AttachmentType; readonly pairLabel: string }
  readonly actionTipsAllowed: boolean
}

/**
 * 애착 조합 → 지면 짝 이름(R158-8 ① · 2.0-D 정정 1). 지면 「마음을 기대는 방식」의 표제 자리에 싣는다.
 * **애착 유형 이름(안정형 · 불안형 · 회피형 · 혼란형 등)을 쓰지 않는다** - MASTER 10-5-3 재프레이밍. 명사형 라벨 · 판정 · 결핍 표현 0
 * (좋다/나쁘다 · 부족 · 문제 · 안 맞음 없음). 순서가 없는 조합 10개(키 = 코드값 두 개를 사전순으로 `+`로 이음).
 * 문장은 메인 세션 안 - PM 승인 대상(첫 줄 "서로의 속도를 기다려 주는 짝"만 R158-8 예).
 */
export const ATTACHMENT_PAIR_LABELS: Readonly<Record<string, string>> = {
  'secure+secure': '서로의 속도를 기다려 주는 짝',
  'anxious+secure': '건넨 마음이 든든하게 닿는 짝',
  'avoidant+secure': '각자의 자리를 지켜 주는 짝',
  'fearful+secure': '출렁이는 마음을 함께 건너는 짝',
  'anxious+anxious': '마음을 자주 건네는 짝',
  'anxious+avoidant': '다가가는 마음과 쉬어 가는 마음이 만나는 짝',
  'anxious+fearful': '마음이 크게 오가는 짝',
  'avoidant+avoidant': '혼자의 시간을 서로 아껴 주는 짝',
  'avoidant+fearful': '조용함과 밀물썰물이 만나는 짝',
  'fearful+fearful': '밀물과 썰물을 함께 지나는 짝',
}

/** 두 사람의 애착 코드값 → 짝 이름(순서 무관 · 결정론). */
export function attachmentPairLabel(x: AttachmentType, y: AttachmentType): string {
  const key = [x, y].sort().join('+')
  const label = ATTACHMENT_PAIR_LABELS[key]
  if (label === undefined) throw new RangeError(`애착 조합 표에 없는 짝 (${key})`)
  return label
}

export interface DnaPartner {
  readonly name: string
  readonly labelKo: string | null
}

export type LoveDnaResult = { readonly ok: true; readonly facts: LoveDnaFacts } | { readonly ok: false; readonly skip: 'no_personality' }

function partnerOf(p: PersonProfile): DnaPartner {
  return { name: p.name, labelKo: p.labelKo }
}

function sternbergPart(x: number, y: number): DnaSternbergPart {
  return { a: x, b: y, shared: Math.min(x, y) }
}

/** `chatDelta`가 읽는 채팅 지표 두 칸(`chatMetrics.ts` 결과의 일부). */
export type DnaChatInput = Pick<ChatMetrics, 'replyGap' | 'turnTaking'>

/** 두 지표가 모두 있을 때만 v0 값, 하나라도 없으면 null(0으로 채우지 않는다 - R158-2). */
export function chatDeltaOf(chat: DnaChatInput): number | null {
  const median = chat.replyGap?.all.median
  if (median === undefined || chat.turnTaking === null) return null
  return computeChatDelta({ replyGapMedianSeconds: median, turnTakingRatio: chat.turnTaking }, DNA_CHAT_DELTA_V0)
}

/**
 * 지면 숫자 칸. `previousTotal`은 지난 호에 저장된 일치율(없으면 null = 첫 호). `chat`은 그 기간의 채팅 지표.
 * 두 사람 중 한 명이라도 성격 데이터가 없으면 빠진다(기획서 2절 4.).
 */
export function computeLoveDnaFacts(profiles: CoupleProfiles, previousTotal: number | null, chat: DnaChatInput): LoveDnaResult {
  const { a, b } = profiles
  if (a === null || b === null) return { ok: false, skip: 'no_personality' }
  const base = computeDnaBaseScore(a.enneagramCore, b.enneagramCore, DNA_BASE_COEFFICIENTS)
  const chatDelta = chatDeltaOf(chat)
  const total = computeTotalScore(base, chatDelta ?? 0)   // null이면 기저만(채팅 반영 전) - chatDelta 칸은 null 그대로
  const delta = previousTotal === null ? null : roundTo(total - previousTotal, DNA_SCORE_DECIMALS)
  return {
    ok: true,
    facts: {
      score: {
        base,
        chatDelta,
        chatApplied: chatDelta !== null,
        total,
        coeffVersion: DNA_COEFF_VERSION,
        previousTotal,
        delta,
        firstIssue: previousTotal === null,
      },
      partners: [partnerOf(a), partnerOf(b)],
      bigFive: BIG_FIVE_AXES.map(({ key, label }) => {
        const gap = Math.abs(a.bigFive[key] - b.bigFive[key])
        return { key, label, a: a.bigFive[key], b: b.bigFive[key], gap, relation: gap < DNA_AXIS_CLOSE_GAP ? 'close' : 'apart' }
      }),
      sternberg: {
        intimacy: sternbergPart(a.sternberg.intimacy, b.sternberg.intimacy),
        passion: sternbergPart(a.sternberg.passion, b.sternberg.passion),
        commitment: sternbergPart(a.sternberg.commitment, b.sternberg.commitment),
      },
      attachment: { a: a.attachment, b: b.attachment, pairLabel: attachmentPairLabel(a.attachment, b.attachment) },
      actionTipsAllowed: total <= DNA_ACTION_TIP_MAX_TOTAL,
    },
  }
}

/** 클램프 경계(MASTER 17-2 기본값) - 다른 파일이 다시 적지 않게 여기서 함께 내보낸다. */
export const DNA_CLAMP = { min: DNA_SCORE_MIN, max: DNA_SCORE_MAX } as const
