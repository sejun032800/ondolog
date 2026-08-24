/**
 * 전역 커플 연결 상태 스토어.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 8 "미연결 유저 처리 원칙(전역)"
 *   "구현: 전역 상태 `coupleStore.isConnected` + 공통 래퍼 컴포넌트
 *   `<CoupleGate>`로 재사용" — 원문에 명시된 스토어/컴포넌트 이름 그대로.
 * Part 11-2 "탭 바 정책": 미연결 유저에게도 5개 탭 전부 표시하고,
 * 커플 전용 기능을 탭할 때만 게이팅한다(진입 자체를 막지 않는다).
 *
 * 로그인 이후 구간은 서버가 진실 소스다. 이 스토어는 로그인 세션 기준
 * `couples` 테이블 조회 결과를 반영하는 얇은 캐시일 뿐, 스스로 연결
 * 여부를 판정하지 않는다.
 *
 * 온도: 미연결 시 36.5도 고정(Part 9-2, `src/engine/temperature.ts`
 * `DISCONNECTED_TEMPERATURE`). temperature.ts의 함수는 "일 배치 전용,
 * 앱 클라이언트에서 호출 금지" 계약이 있어(같은 파일 상단 docblock),
 * 여기서는 함수를 호출하지 않고 상수값만 그대로 재노출한다 — 36.5를
 * 이 파일에 다시 하드코딩하지 않기 위함이다.
 */

import { create } from 'zustand'
import { DISCONNECTED_TEMPERATURE } from '../engine/temperature'
import { supabase } from '../services/supabase'

interface CoupleState {
  /** 서버 조회를 아직 하지 않은 초기 상태와 "조회했지만 미연결"을 구분한다. */
  status: 'unknown' | 'loading' | 'disconnected' | 'connected'
  coupleId: string | null
  /** 미연결이면 36.5 고정. 연결 시 daily_temperature 최신값(향후 탭 작업에서 채움). */
  temperature: number
  relationshipStartDate: string | null

  /** 로그인한 유저 기준으로 couples 테이블을 조회해 상태를 갱신한다. */
  refresh: (userId: string) => Promise<void>
  reset: () => void
}

export const useCoupleStore = create<CoupleState>((set) => ({
  status: 'unknown',
  coupleId: null,
  temperature: DISCONNECTED_TEMPERATURE,
  relationshipStartDate: null,

  refresh: async (userId: string) => {
    set({ status: 'loading' })

    const { data, error } = await supabase
      .from('couples')
      .select('id, status, relationship_start_date')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !data) {
      set({
        status: 'disconnected',
        coupleId: null,
        temperature: DISCONNECTED_TEMPERATURE,
        relationshipStartDate: null,
      })
      return
    }

    set({
      status: 'connected',
      coupleId: data.id,
      relationshipStartDate: data.relationship_start_date,
      // 실제 daily_temperature 조회는 메인 탭 작업(Phase 4) 범위 —
      // 연결 직후에는 아직 배치가 돌기 전일 수 있어 기본값을 유지한다.
      temperature: DISCONNECTED_TEMPERATURE,
    })
  },

  reset: () =>
    set({
      status: 'unknown',
      coupleId: null,
      temperature: DISCONNECTED_TEMPERATURE,
      relationshipStartDate: null,
    }),
}))
