/** 연결 해제 · 탈퇴 서버 API - 앱 전역 `supabase`를 넣어 `dissolutionCore`를 부른다. */
import { supabase } from './supabase'
import {
  cancelDissolution as cancelDissolutionCore,
  cancelWithdrawal as cancelWithdrawalCore,
  fetchDissolutionState as fetchDissolutionStateCore,
  requestDissolution as requestDissolutionCore,
  requestWithdrawal as requestWithdrawalCore,
  type DissolutionDb,
} from './dissolutionCore'

const db = supabase as unknown as DissolutionDb

export const requestDissolution = () => requestDissolutionCore(db)
export const cancelDissolution = (dissolutionId: string) => cancelDissolutionCore(db, dissolutionId)
export const requestWithdrawal = () => requestWithdrawalCore(db)
export const cancelWithdrawal = () => cancelWithdrawalCore(db)
export const fetchDissolutionState = (userId: string) => fetchDissolutionStateCore(db, userId)
