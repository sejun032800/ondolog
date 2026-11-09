/**
 * 연결 해제 유예 상태(RN `dissolutionStore`의 웹판). 서버(`couples.status = 'dissolving'` + 진행 중 `couple_dissolutions`)가 진실이고,
 * 이 스토어는 읽은 결과를 담는 얇은 캐시다. 읽기만 한다 - 해제 · 탈퇴 쓰기는 027 함수 호출뿐(각 화면이 `@/services/dissolutionCore`의 함수를 부른다).
 * 읽기 실패는 "없음"으로 삼키지 않고 `error`로 둔다. 이미 읽은 값이 있으면 다시 읽는 동안 비우지 않는다(화면이 깜빡이지 않게).
 */
import { create } from 'zustand'
import { fetchDissolutionState, type DissolutionDb } from '@/services/dissolutionCore'
import type { DissolutionState } from '@/utils/dissolution'
import { getSupabase } from '../auth/client'

interface DissolutionStoreState {
  status: 'unknown' | 'loading' | 'loaded' | 'error'
  dissolution: DissolutionState | null
  refresh: (userId: string) => Promise<void>
  reset: () => void
}

export const useDissolutionStore = create<DissolutionStoreState>((set, get) => ({
  status: 'unknown',
  dissolution: null,
  refresh: async (userId) => {
    const db = getSupabase()
    if (!db) return
    const hadValue = get().status === 'loaded'
    if (!hadValue) set({ status: 'loading' })
    try {
      const dissolution = await fetchDissolutionState(db as unknown as DissolutionDb, userId)
      set({ status: 'loaded', dissolution })
    } catch {
      if (!hadValue) set({ status: 'error' })
    }
  },
  reset: () => set({ status: 'unknown', dissolution: null }),
}))
