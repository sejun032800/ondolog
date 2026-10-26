/**
 * 연결 해제 유예 상태 스토어 - 서버(`couples.status = 'dissolving'` + 진행 중 `couple_dissolutions`)가 진실 소스고,
 * 이 스토어는 읽은 결과를 담는 얇은 캐시다(`coupleStore`와 같은 방식). 읽기 실패는 "없음"으로 삼키지 않고 `error`로 둔다.
 */
import { create } from 'zustand'
import { fetchDissolutionState } from '../services/dissolutionApi'
import type { DissolutionState } from '../utils/dissolution'

interface DissolutionStoreState {
  status: 'unknown' | 'loading' | 'loaded' | 'error'
  dissolution: DissolutionState | null
  refresh: (userId: string) => Promise<void>
  reset: () => void
}

export const useDissolutionStore = create<DissolutionStoreState>((set) => ({
  status: 'unknown',
  dissolution: null,
  refresh: async (userId) => {
    set({ status: 'loading' })
    try {
      const dissolution = await fetchDissolutionState(userId)
      set({ status: 'loaded', dissolution })
    } catch {
      set({ status: 'error' })
    }
  },
  reset: () => set({ status: 'unknown', dissolution: null }),
}))
