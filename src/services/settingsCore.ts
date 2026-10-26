/**
 * 설정 탭(U7, `67-`)의 쓰기 알맹이 - 저장소 클라이언트를 인자로 받는다(`personalityCore.ts` · `chatCore.ts`와 같은 방식).
 * 앱은 `settingsApi.ts`가 전역 `supabase`를 넣어 부르고, 원격 실증 스크립트(Deno)는 시험 계정의 사용자 세션 클라이언트를 넣어 **같은 함수**를 부른다.
 *
 * **쓰는 칸은 아래 표가 전부다**(R42-6). 이 밖의 칸을 쓰는 코드는 여기에 없다 - 시험이 가짜 클라이언트의 호출 기록으로 이 표를 지킨다.
 *
 *   profiles               display_name · gender                                        (`updateProfileBasics`)
 *   couples                relationship_start_date · start_date_set_by · start_date_confirmed_by   (`updateStartDateByMe`)
 *   couples                nickname                                                     (`updateCoupleNickname`)
 *   personality_assessments  재검사 새 행 INSERT(seq 2)                                   (`retestPersonality`)
 *   personality_profiles   active_assessment_id · enneagram_inferred · attachment · enneagram_override · love_type_code · retest_used
 *                                                                                       (`retestPersonality`, 한 번의 UPDATE)
 *
 * `deleted_at` · `purge_scheduled_at` · 동의 시각 · `birth_date` · `onboarding_step` · `couple_dissolutions`는 이 파일이 쓰지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeLoveTypeCode } from '../engine/loveTypeInference'
import type { EnneagramCore } from '../constants/enneagram'
import type { Database } from '../types/database'
import { isStartDateSelectable, isValidNickname, normalizeNickname } from '../utils/coupleStart'
import { canRetest, isValidDisplayName } from '../utils/settingsRules'
import { buildAssessmentInsert, type CreateProfileAndAssessmentInput } from './personalityCore'

export type SettingsDb = Pick<SupabaseClient<Database>, 'from'>

type Gender = Database['public']['Enums']['gender_type']
type CoupleRow = Database['public']['Tables']['couples']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
type PersonalityProfileRow = Database['public']['Tables']['personality_profiles']['Row']

const UNIQUE_VIOLATION = '23505'

// ── H03 프로필 ──

/** 이름(1~20자)과 성별을 고친다. 생년월일 · 동의 시각 · 진행 단계는 건드리지 않는다. */
export async function updateProfileBasics(
  db: SettingsDb,
  userId: string,
  input: { displayName: string; gender: Gender },
): Promise<ProfileRow> {
  if (!isValidDisplayName(input.displayName)) throw new Error('이름은 1자 이상 20자 이하여야 해요.')
  const { data, error } = await db
    .from('profiles')
    .update({ display_name: input.displayName.trim(), gender: input.gender })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── H04 커플 ──

/**
 * 사귄 날짜를 고친다 - **같은 UPDATE에서** 정한 사람을 나로, 확인한 사람을 비운다(상대가 다음에 앱에 들어올 때 A20을 다시 본다).
 * 날짜 규칙은 A19와 같다(실제 있는 날짜 · KST 오늘까지).
 */
export async function updateStartDateByMe(
  db: SettingsDb,
  coupleId: string,
  userId: string,
  isoDate: string,
  now: Date = new Date(),
): Promise<CoupleRow> {
  if (!isStartDateSelectable(isoDate, now)) throw new Error('사귄 날짜는 오늘까지만 고를 수 있어요.')
  const { data, error } = await db
    .from('couples')
    .update({ relationship_start_date: isoDate, start_date_set_by: userId, start_date_confirmed_by: null })
    .eq('id', coupleId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 커플 닉네임(1~20자)을 고친다. 서버 check(`couples.nickname`)가 한 번 더 막는다. */
export async function updateCoupleNickname(db: SettingsDb, coupleId: string, nickname: string): Promise<CoupleRow> {
  if (!isValidNickname(nickname)) throw new Error('커플 닉네임은 1자 이상 20자 이하여야 해요.')
  const { data, error } = await db
    .from('couples')
    .update({ nickname: normalizeNickname(nickname) })
    .eq('id', coupleId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── H05 · H06 재검사 ──

export type RetestErrorKind = 'already-used' | 'duplicate' | 'failed'

/** 재검사 실패. `message`는 화면이 그대로 보일 수 있는 글이다. */
export class RetestError extends Error {
  readonly kind: RetestErrorKind
  constructor(kind: RetestErrorKind) {
    super(
      kind === 'already-used'
        ? '재검사는 계정당 한 번이에요.'
        : kind === 'duplicate'
          ? '이미 재검사 기록이 있어요.'
          : '저장하지 못했어요. 다시 시도해주세요.',
    )
    this.name = 'RetestError'
    this.kind = kind
  }
}

export type RetestInput = Pick<
  CreateProfileAndAssessmentInput,
  'mbti' | 'mbtiSelfReported' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'result'
>

export interface RetestOutcome {
  assessment: AssessmentRow
  profile: PersonalityProfileRow
}

/**
 * 재검사 한 번(계정당 1회, MASTER 9-6).
 *
 *   1. 프로필을 읽어 `retest_used`가 true면 **서버로 아무것도 보내지 않고** 거부한다(`canRetest`가 버튼 비활성과 같은 판정).
 *   2. **새 assessment 행**을 `seq = 2`로 INSERT한다. 이전 행은 지우지도 고치지도 않는다(원본 보존, RLS도 UPDATE · DELETE가 없다).
 *      `unique (user_id, seq)`(004_personality.sql 37행)라 이미 2번째 행이 있으면 `23505`가 난다 - **이 경로에서 23505는 실패다**
 *      (가입 저장의 "이미 저장됨 = 성공"은 `personalityCore.createProfileAndAssessment` 안에만 있다). 실패하면 프로필은 건드리지 않는다.
 *   3. `personality_profiles`를 **한 번의 UPDATE**로 고친다: active_assessment_id = 새 행 · enneagram_inferred · attachment = 새 결과 ·
 *      enneagram_override = null(새 검사가 새 추론값이다) · love_type_code = 새 실효 코어(= 새 추론값) + 애착으로 재계산(엔진 함수) ·
 *      retest_used = true. `retest_used = false` 조건을 함께 걸어, 그 사이 다른 기기가 먼저 썼다면 0행이 되어 실패로 본다.
 *
 * `override_count` · `override_updated_at`은 쓰지 않는다(이전 오버라이드 이력 그대로). `enneagram_effective`는 서버가 계산하는 생성 칸이라 쓰지 않는다.
 */
export async function retestPersonality(db: SettingsDb, userId: string, input: RetestInput): Promise<RetestOutcome> {
  const { data: current, error: readError } = await db
    .from('personality_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw new RetestError('failed')
  if (!current) throw new RetestError('failed')
  if (!canRetest(current)) throw new RetestError('already-used')

  const { data: assessment, error: insertError } = await db
    .from('personality_assessments')
    .insert(buildAssessmentInsert(userId, 2, input))
    .select()
    .single()
  if (insertError || !assessment) {
    throw new RetestError(insertError?.code === UNIQUE_VIOLATION ? 'duplicate' : 'failed')
  }

  const { data: profile, error: updateError } = await db
    .from('personality_profiles')
    .update({
      active_assessment_id: assessment.id,
      enneagram_inferred: input.result.enneagramCore,
      attachment: input.result.attachment,
      enneagram_override: null,
      love_type_code: computeLoveTypeCode(input.result.enneagramCore as EnneagramCore, input.result.attachment),
      retest_used: true,
    })
    .eq('user_id', userId)
    .eq('retest_used', false)
    .select()
    .single()
  if (updateError || !profile) throw new RetestError('failed')

  return { assessment, profile }
}

// ── 로그아웃 ──

export interface LogoutDeps {
  /** `supabase.auth.signOut` */
  signOut: () => Promise<unknown>
  /** 화면 메모리(커플 · 프로필 스토어)를 비운다. */
  resetMemory: () => void
}

/**
 * 로그아웃 - 메모리 스토어를 비우고 세션을 끝낸다. **기기에 저장된 채팅 큐(텍스트 · 사진)는 지우지 않는다**(R39-5 b).
 * 큐 키는 사용자 단위라 다음 로그인에 이어서 나간다. 큐 허브는 세션이 없어지면 루트 `useChatQueueResume`가 멈추기만 한다.
 */
export async function performLogout(deps: LogoutDeps): Promise<void> {
  deps.resetMemory()
  await deps.signOut()
}
