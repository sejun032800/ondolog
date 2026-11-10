/**
 * 부팅 · 로그인 뒤 라우팅이 모르는 상태나 조회 오류를 만났을 때 띄우는 안내 화면(빈 화면 0 원칙, 74-h2 ⓪-c)의 상태. 메모리뿐.
 * `retry`는 문제를 만든 쪽이 넘긴 "같은 일을 다시 한다" 함수다.
 */
import { create } from 'zustand'

export interface AccountProblem {
  retry: () => void
}

interface State {
  problem: AccountProblem | null
  show: (p: AccountProblem) => void
  clear: () => void
}

export const useAccountProblemStore = create<State>((set) => ({
  problem: null,
  show: (problem) => set({ problem }),
  clear: () => set({ problem: null }),
}))
