/**
 * 설정 탭(U7, `67-`)의 쓰기 알맹이 - 저장소 클라이언트를 인자로 받는다(`personalityCore.ts` · `chatCore.ts`와 같은 방식).
 * 앱은 `settingsApi.ts`가 전역 `supabase`를 넣어 부르고, 원격 실증 스크립트(Deno)는 시험 계정의 사용자 세션 클라이언트를 넣어 **같은 함수**를 부른다.
 *
 * **쓰는 칸은 아래 표가 전부다**(R42-6). 이 밖의 칸을 쓰는 코드는 여기에 없다 - 시험이 가짜 클라이언트의 호출 기록으로 이 표를 지킨다.
 *
 *   profiles               display_name · gender                                        (`updateProfileBasics`)
 *   couples                relationship_start_date · start_date_set_by · start_date_confirmed_by   (`updateStartDateByMe`)
 *   couples                nickname                                                     (`updateCoupleNickname`)
 *   profiles               marketing_agreed_at                                          (`updateMarketingConsent`, 켜기 = 지금 · 끄기 = null)
 *   재검사(`retestPersonality`)는 테이블을 직접 쓰지 않는다 - 027 `fn_complete_retest` 함수 호출 하나다(`68-`).
 *
 * `deleted_at` · `purge_scheduled_at` · 다른 동의 시각 · `birth_date` · `onboarding_step` · `couple_dissolutions` ·
 * `retest_used` · `active_assessment_id` · `enneagram_inferred` · `attachment`는 이 파일이 쓰지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { LOVE_TYPE_ENGINE_VERSION, computeLoveTypeCode } from '../engine/loveTypeInference'
import type { EnneagramCore } from '../constants/enneagram'
import type { Database } from '../types/database'
import { isStartDateSelectable, isValidNickname, normalizeNickname } from '../utils/coupleStart'
import { canRetest, isValidDisplayName } from '../utils/settingsRules'
import type { CreateProfileAndAssessmentInput } from './personalityCore'

export type SettingsDb = Pick<SupabaseClient<Database>, 'from'>

type Gender = Database['public']['Enums']['gender_type']
type CoupleRow = Database['public']['Tables']['couples']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

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

// ── H11 마케팅 수신 ──

/** 켜기 = `marketing_agreed_at = 지금`, 끄기 = `null`. 이 칸만 쓴다(027이 칸 단위로 연 일곱 칸 중 하나). 반환 = 저장된 값. */
export async function updateMarketingConsent(
  db: SettingsDb,
  userId: string,
  agreed: boolean,
  now: Date = new Date(),
): Promise<string | null> {
  const value = agreed ? now.toISOString() : null
  const { error } = await db.from('profiles').update({ marketing_agreed_at: value }).eq('id', userId)
  if (error) throw error
  return value
}

// ── H05 · H06 재검사 ──

export type RetestErrorKind = 'already-used' | 'failed'

/** 재검사 실패. `message`는 화면이 그대로 보일 수 있는 글이다. */
export class RetestError extends Error {
  readonly kind: RetestErrorKind
  constructor(kind: RetestErrorKind) {
    super(kind === 'already-used' ? '재검사는 계정당 한 번이에요.' : '저장하지 못했어요. 다시 시도해주세요.')
    this.name = 'RetestError'
    this.kind = kind
  }
}

export type RetestInput = Pick<
  CreateProfileAndAssessmentInput,
  'mbti' | 'mbtiSelfReported' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'result'
>

export interface RetestOutcome {
  assessmentId: string
  /**
   * true면 이전에 끊긴 재검사의 기존 행으로 서버가 마저 끝낸 것이다 - 저장된 결과가 방금 답한 것과 다를 수 있다.
   * (결과 값은 서버가 그 행에서 읽는다. 앱은 인자의 결과가 쓰이지 않았다는 사실만 안다.)
   */
  recovered: boolean
}

/** 재검사 함수 호출에 필요한 저장소 모양(`rpc` + 사전 읽기용 `from`). */
export type RetestDb = Pick<SupabaseClient<Database>, 'from' | 'rpc'>

const FN_COMPLETE_RETEST = 'fn_complete_retest'

/**
 * 재검사 한 번(계정당 1회, MASTER 9-6) - **027 `fn_complete_retest` 함수 호출 하나**로 끝낸다(새 행 INSERT + 프로필 갱신 + mbti가 한 트랜잭션).
 * 채점은 결정론 엔진이 이미 했고(절대 규칙 2) 결과를 인자로 넘긴다. 앱은 `personality_assessments` · `personality_profiles`를 직접 쓰지 않는다.
 *
 *   1. 프로필을 읽어 `retest_used`가 true면 **서버로 아무것도 보내지 않고** 거부한다(`canRetest`, 버튼 비활성과 같은 판정).
 *   2. 함수를 부른다. `23505` = 이미 사용(`already-used`). 그 밖의 오류는 `failed`.
 *   3. 함수가 `out_recovered = true`를 돌려주면 끊겼던 상태를 기존 행으로 마저 끝낸 것이다(`recovered`).
 */
export async function retestPersonality(db: RetestDb, userId: string, input: RetestInput): Promise<RetestOutcome> {
  const { data: current, error: readError } = await db
    .from('personality_profiles')
    .select('retest_used')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError || !current) throw new RetestError('failed')
  if (!canRetest(current)) throw new RetestError('already-used')

  const r = input.result
  const { data, error } = await db.rpc(FN_COMPLETE_RETEST, {
    p_mbti: input.mbti,
    p_mbti_self_reported: input.mbtiSelfReported,
    p_q1: input.q1,
    p_q2: input.q2,
    p_q3: input.q3,
    p_q4: input.q4,
    p_q5: input.q5,
    p_enneagram_core: r.enneagramCore,
    p_big_o: r.big5.bigO,
    p_big_c: r.big5.bigC,
    p_big_e: r.big5.bigE,
    p_big_a: r.big5.bigA,
    p_big_n: r.big5.bigN,
    p_stern_intimacy: r.sternberg.intimacy,
    p_stern_passion: r.sternberg.passion,
    p_stern_commitment: r.sternberg.commitment,
    p_attach_anxiety: r.attachAnxiety,
    p_attach_avoidance: r.attachAvoidance,
    p_attachment: r.attachment,
    p_engine_version: LOVE_TYPE_ENGINE_VERSION,
    p_love_type_code: computeLoveTypeCode(r.enneagramCore as EnneagramCore, r.attachment),
  })
  if (error) throw new RetestError(error.code === UNIQUE_VIOLATION ? 'already-used' : 'failed')
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row.out_assessment_id !== 'string') throw new RetestError('failed')
  return { assessmentId: row.out_assessment_id, recovered: row.out_recovered === true }
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
