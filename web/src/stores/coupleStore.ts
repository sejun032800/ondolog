/**
 * 커플 연결 상태(RN `coupleStore`의 웹판). 서버(`couples`)가 진실이고 이 스토어는 조회 결과를 반영하는 얇은 캐시다 - 스스로 연결 여부를 판정하지 않는다.
 * 조회는 RN `coupleStore.refresh`(= `coupleApi`)와 같은 질의: 내가 a 또는 b이고 `status = 'active'`인 행 하나.
 *
 * 온도: 미연결은 36.5 고정(`DISCONNECTED_TEMPERATURE`). 연결이면 `daily_temperature`의 최신 저장값을 **읽기만** 한다(계산 0).
 * 저장값이 없으면 `null` - 화면은 숫자를 지어내지 않는다.
 * 조회가 오류로 끝나면 RN과 같이 미연결 필드로 둔다(36.5). 단 이미 연결로 알던 값은 오류 때문에 지우지 않는다.
 */
import { create } from 'zustand'
import { DISCONNECTED_TEMPERATURE } from '@/engine/temperature'
import { getSupabase } from '../auth/client'

export interface CoupleState {
  /** 아직 조회 전(`unknown`)과 "조회했지만 미연결"을 구분한다. */
  status: 'unknown' | 'loading' | 'disconnected' | 'connected'
  coupleId: string | null
  partnerId: string | null
  nickname: string | null
  temperature: number | null
  temperatureDateOn: string | null
  relationshipStartDate: string | null
  referencePhotoPath: string | null
  refresh: (userId: string) => Promise<void>
  reset: () => void
}

const DISCONNECTED = {
  coupleId: null,
  partnerId: null,
  nickname: null,
  temperature: DISCONNECTED_TEMPERATURE as number | null,
  temperatureDateOn: null,
  relationshipStartDate: null,
  referencePhotoPath: null,
}

export const useCoupleStore = create<CoupleState>((set, get) => ({
  status: 'unknown',
  ...DISCONNECTED,

  refresh: async (userId) => {
    const db = getSupabase()
    if (!db) return
    const wasConnected = get().status === 'connected'
    if (!wasConnected) set({ status: 'loading' })
    try {
      const { data, error } = await db
        .from('couples')
        .select('id, relationship_start_date, nickname, user_a_id, user_b_id, reference_photo_path')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .eq('status', 'active')
        .maybeSingle()
      if (error || !data) {
        // 조회 오류에서도 이미 연결로 알고 있던 값은 그대로 둔다(끊긴 연결 때문에 연결된 사람에게 "상대만 있으면 돼요"를 보이지 않는다). 처음이면 RN과 같이 미연결.
        if (!wasConnected || !error) set({ status: 'disconnected', ...DISCONNECTED })
        return
      }
      const partnerId = data.user_a_id === userId ? data.user_b_id : data.user_a_id
      const { data: tempRow } = await db
        .from('daily_temperature')
        .select('temperature, date_on')
        .eq('couple_id', data.id)
        .order('date_on', { ascending: false })
        .limit(1)
        .maybeSingle()
      set({
        status: 'connected',
        coupleId: data.id,
        partnerId,
        nickname: data.nickname,
        relationshipStartDate: data.relationship_start_date,
        temperature: tempRow?.temperature ?? null,
        temperatureDateOn: tempRow?.date_on ?? null,
        referencePhotoPath: data.reference_photo_path,
      })
    } catch {
      if (!wasConnected) set({ status: 'disconnected', ...DISCONNECTED })
    }
  },

  reset: () => set({ status: 'unknown', ...DISCONNECTED }),
}))
