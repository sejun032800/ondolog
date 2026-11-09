/**
 * 설정 화면이 읽는 서버 데이터(읽기만). 쓰는 일은 `@/services/settingsCore` · `@/services/dissolutionCore`를 화면이 직접 부른다.
 */
import type { PersonalityDb } from '@/services/personalityCore'
import type { Database } from '@/types/database'

export type PersonalityProfileRow = Database['public']['Tables']['personality_profiles']['Row']
export type AssessmentRow = Database['public']['Tables']['personality_assessments']['Row']

/** RN `personalityApi.fetchPersonalityProfile`와 같은 조회. */
export async function fetchPersonalityProfile(db: PersonalityDb, userId: string): Promise<PersonalityProfileRow | null> {
  const { data, error } = await db.from('personality_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

/** RN `settingsApi.fetchAssessmentById`와 같은 조회 - 지금 쓰고 있는 검사(재검사 뒤에는 새 행). */
export async function fetchAssessmentById(db: PersonalityDb, assessmentId: string): Promise<AssessmentRow | null> {
  const { data, error } = await db.from('personality_assessments').select('*').eq('id', assessmentId).maybeSingle()
  if (error) throw error
  return data
}
