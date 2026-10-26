/**
 * 설정 탭 서버 API - 앱 전역 `supabase`를 넣어 `settingsCore`(쓰기)를 부르고, 읽기는 여기서 한다.
 * 쓰는 칸의 표는 `settingsCore.ts` 머리 주석이 원본이다. 읽기는 쓰기가 아니다.
 */
import { supabase } from './supabase'
import {
  performLogout as performLogoutCore,
  retestPersonality as retestPersonalityCore,
  updateCoupleNickname as updateCoupleNicknameCore,
  updateMarketingConsent as updateMarketingConsentCore,
  updateProfileBasics as updateProfileBasicsCore,
  updateStartDateByMe as updateStartDateByMeCore,
  type RetestInput,
} from './settingsCore'
import type { Database } from '../types/database'

type Gender = Database['public']['Enums']['gender_type']
type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']
type CoupleRow = Database['public']['Tables']['couples']['Row']

export const updateProfileBasics = (userId: string, input: { displayName: string; gender: Gender }) =>
  updateProfileBasicsCore(supabase, userId, input)

export const updateStartDateByMe = (coupleId: string, userId: string, isoDate: string) =>
  updateStartDateByMeCore(supabase, coupleId, userId, isoDate)

export const updateCoupleNickname = (coupleId: string, nickname: string) =>
  updateCoupleNicknameCore(supabase, coupleId, nickname)

export const retestPersonality = (userId: string, input: RetestInput) => retestPersonalityCore(supabase, userId, input)

export const updateMarketingConsent = (userId: string, agreed: boolean) =>
  updateMarketingConsentCore(supabase, userId, agreed)

export const performLogout = (resetMemory: () => void) =>
  performLogoutCore({ resetMemory, signOut: () => supabase.auth.signOut() })

/** 지금 쓰고 있는 검사(`personality_profiles.active_assessment_id`)의 행. 재검사 뒤에는 새 행이다. */
export async function fetchAssessmentById(assessmentId: string): Promise<AssessmentRow | null> {
  const { data, error } = await supabase.from('personality_assessments').select('*').eq('id', assessmentId).maybeSingle()
  if (error) throw error
  return data
}

/** A20 재표시 판정에 쓰는 내 커플 행(활성). 없으면 null. */
export async function fetchMyActiveCouple(userId: string): Promise<CoupleRow | null> {
  const { data, error } = await supabase
    .from('couples')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}
