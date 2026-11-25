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
 * ── `chatDelta` ──────────────────────────────────────────────────────
 * PM이 v0 숫자를 승인하기 전(⑨)에는 `UNRESOLVED('dnaScore.chatDelta')` 그대로다. 이 파일은 `computeChatDelta`를 부르지 않고,
 * **기저 점수만으로** 일치율을 낸다: `total = clamp(base + 0)` · `chatDelta = null` · `chatApplied = false`.
 * 지면 · 발행 노트는 `chatApplied`로 "채팅 반영 전" 표지를 단다. 계수 버전도 기저만 쓴 것을 따로 적는다(`dna_base_only`).
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
  computeDnaBaseScore,
  computeTotalScore,
  type DnaBaseScoreCoefficients,
} from './dnaScore'
import type { BigFive, CoupleProfiles, PersonProfile } from './coupleProfile'
import type { AttachmentType } from '../constants/attachment'
import { roundTo } from './numeric'

/** MASTER 17-2 확정 기저 세 값. */
export const DNA_BASE_COEFFICIENTS: DnaBaseScoreCoefficients = { contrast: 61, neutral: 65, best: 69 }
/** `chatDelta`가 없는(⑨ 승인 전) 산출의 계수 버전. 승인 뒤 `dna_v0`. */
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
    /** ⑨ 승인 전에는 null(채팅 반영 전). */
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
  readonly attachment: { readonly a: AttachmentType; readonly b: AttachmentType }
  readonly actionTipsAllowed: boolean
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

/**
 * 지면 숫자 칸. `previousTotal`은 지난 호에 저장된 일치율(없으면 null = 첫 호).
 * 두 사람 중 한 명이라도 성격 데이터가 없으면 빠진다(기획서 2절 4.).
 */
export function computeLoveDnaFacts(profiles: CoupleProfiles, previousTotal: number | null): LoveDnaResult {
  const { a, b } = profiles
  if (a === null || b === null) return { ok: false, skip: 'no_personality' }
  const base = computeDnaBaseScore(a.enneagramCore, b.enneagramCore, DNA_BASE_COEFFICIENTS)
  // ⑨ 승인 전: chatDelta 없이 기저만(computeChatDelta는 부르지 않는다 - UNRESOLVED).
  const total = computeTotalScore(base, 0)
  const delta = previousTotal === null ? null : roundTo(total - previousTotal, DNA_SCORE_DECIMALS)
  return {
    ok: true,
    facts: {
      score: {
        base,
        chatDelta: null,
        chatApplied: false,
        total,
        coeffVersion: DNA_COEFF_VERSION_BASE_ONLY,
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
      attachment: { a: a.attachment, b: b.attachment },
      actionTipsAllowed: total <= DNA_ACTION_TIP_MAX_TOTAL,
    },
  }
}

/** 클램프 경계(MASTER 17-2 기본값) - 다른 파일이 다시 적지 않게 여기서 함께 내보낸다. */
export const DNA_CLAMP = { min: DNA_SCORE_MIN, max: DNA_SCORE_MAX } as const
