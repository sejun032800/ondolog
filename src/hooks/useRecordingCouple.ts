/**
 * 기록할 수 있는 커플 행(pending 또는 active)을 읽는 훅 - 규칙 6.
 * **커플 행을 만들지 않는다.** 없으면 `couple: null`이고, 화면은 기록 버튼을 비활성으로 둔다.
 */
import { useCallback, useEffect, useState } from 'react'
import { findRecordingCouple, type RecordingCouple } from '../services/dateRecordApi'
import { supabase } from '../services/supabase'

export interface RecordingCoupleState {
  loading: boolean
  couple: RecordingCouple | null
  error: string | null
  reload: () => Promise<void>
}

export function useRecordingCouple(userId: string | null): RecordingCoupleState {
  const [state, setState] = useState<Omit<RecordingCoupleState, 'reload'>>({
    loading: true,
    couple: null,
    error: null,
  })

  const reload = useCallback(async () => {
    if (!userId) {
      setState({ loading: false, couple: null, error: null })
      return
    }
    try {
      const couple = await findRecordingCouple(supabase, userId)
      setState({ loading: false, couple, error: null })
    } catch (e) {
      setState({ loading: false, couple: null, error: e instanceof Error ? e.message : '커플 조회에 실패했어요' })
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { ...state, reload }
}
