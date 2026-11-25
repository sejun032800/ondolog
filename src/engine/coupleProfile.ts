/**
 * 두 사람의 성격 데이터 — 2.0 코너(두 사람의 결 · 어림짐작)가 함께 받는 입력 모양(순수 타입 · 값 0).
 *
 * 값의 출처(입력 조립이 채운다 — `supabase/functions/_shared/extrasAssembly.ts`):
 * - `personality_profiles`(`004_personality.sql:50`) — 실효 코어 `enneagram_effective` · `love_type_code` · `active_assessment_id`
 * - `personality_assessments`(`:4`) — 빅5 · 스턴버그 · 애착 두 축 · MBTI(활성 검사 한 행)
 * - `love_type_labels`(`:91`) — `label_ko`
 * - `profiles.display_name` — 이름
 * 생년월일은 받지 않는다(R157-6).
 */

import type { EnneagramCore } from '../constants/enneagram'
import type { AttachmentType } from '../constants/attachment'

export interface BigFive {
  /** 0~100. */
  readonly o: number
  readonly c: number
  readonly e: number
  readonly a: number
  readonly n: number
}

export interface SternbergScores {
  /** 0~100. */
  readonly intimacy: number
  readonly passion: number
  readonly commitment: number
}

export interface PersonProfile {
  readonly userId: string
  readonly name: string
  /** `love_type_labels.label_ko`. 표가 비어 있으면 null. */
  readonly labelKo: string | null
  readonly enneagramCore: EnneagramCore
  /** `^[EI][NS][TF][JP]$`. */
  readonly mbti: string
  readonly bigFive: BigFive
  readonly sternberg: SternbergScores
  /** 0~100. */
  readonly attachAnxiety: number
  readonly attachAvoidance: number
  readonly attachment: AttachmentType
}

/** 커플 순서(a = `couples.user_a_id`, b = `user_b_id`). 성격 데이터가 없는 사람은 null. */
export interface CoupleProfiles {
  readonly a: PersonProfile | null
  readonly b: PersonProfile | null
}
