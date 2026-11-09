/**
 * 내 프로필(`profiles`) 캐시. 서버가 진실이고 이 스토어는 결과를 반영할 뿐이다.
 * RN `profileStore`(생체정보 동의 · 대표사진)는 범위 밖 기능이라 옮기지 않았고, 로그인 뒤 화면이 공통으로 읽는 열만 둔다.
 * 조회는 온보딩이 쓰는 `auth/finalize.fetchProfile`과 같다.
 */
import { create } from 'zustand'
import { getSupabase } from '../auth/client'
import { fetchProfile } from '../auth/finalize'

export interface ProfileSnapshot {
  id: string
  displayName: string
  gender: 'male' | 'female' | 'other'
  birthDate: string
  mbti: string | null
  onboardingStep: number
  /** 탈퇴 유예 시각(있으면 유예 중). 단계 판정(`auth/finalize.resolveWebRoute`)이 읽는 값은 프로필 조회 결과이고, 유예 화면은 `features/settings/WithdrawCancelScreen`(74-7). */
  deletedAt: string | null
}

interface ProfileState {
  status: 'unknown' | 'loading' | 'loaded' | 'failed'
  profile: ProfileSnapshot | null
  refresh: (userId: string) => Promise<void>
  reset: () => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  status: 'unknown',
  profile: null,
  refresh: async (userId) => {
    const db = getSupabase()
    if (!db) return
    set({ status: 'loading' })
    try {
      const row = await fetchProfile(db, userId)
      set({
        status: 'loaded',
        profile: row
          ? {
              id: row.id,
              displayName: row.display_name,
              gender: row.gender,
              birthDate: row.birth_date,
              mbti: row.mbti,
              onboardingStep: row.onboarding_step,
              deletedAt: row.deleted_at,
            }
          : null,
      })
    } catch {
      set({ status: 'failed' })
    }
  },
  reset: () => set({ status: 'unknown', profile: null }),
}))
