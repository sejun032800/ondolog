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
 * 온도(Phase 4, 메인 탭):
 *   - 미연결: 36.5도 고정(Part 9-2, `src/engine/temperature.ts`
 *     `DISCONNECTED_TEMPERATURE`). temperature.ts의 함수는 "일 배치 전용,
 *     앱 클라이언트에서 호출 금지" 계약이 있어(같은 파일 상단 docblock),
 *     여기서는 함수를 호출하지 않고 상수값만 그대로 재노출한다.
 *   - 연결: Part 9-2 "앱 동작 | 저장된 값을 읽기만 함 — 실시간 계산
 *     금지"에 따라 `daily_temperature`의 최신 저장값을 그대로 읽기만
 *     한다(결합 공식은 이 스토어도, 어떤 클라이언트 코드도 계산하지
 *     않는다). 배치(Edge Function)가 아직 없어 대부분의 커플은 이
 *     테이블에 행이 없다 — 그 경우 `temperature`는 `null`이고, 화면은
 *     숫자를 지어내지 않고 "측정 준비 중" 같은 대기 상태를 보여줘야
 *     한다(작업 지시 "미연결 36.5도 외에는 노출 금지" 원칙 — 실제
 *     저장된 값이 없다면 어떤 연결 상태 숫자도 노출하지 않는다).
 */

import { create } from 'zustand'
import { DISCONNECTED_TEMPERATURE } from '../engine/temperature'
import { supabase } from '../services/supabase'
import { uploadReferencePhoto } from '../services/referencePhotoApi'

interface CoupleState {
  /** 서버 조회를 아직 하지 않은 초기 상태와 "조회했지만 미연결"을 구분한다. */
  status: 'unknown' | 'loading' | 'disconnected' | 'connected'
  coupleId: string | null
  /** 연결 상태에서 상대방 profiles.id. 미연결이면 null. */
  partnerId: string | null
  /** 커플 닉네임(Part 9-2 "상단 | 양측 프로필, 커플 닉네임"). 미설정이면 null. */
  nickname: string | null
  /**
   * 미연결이면 항상 36.5(DISCONNECTED_TEMPERATURE). 연결 상태에서는
   * daily_temperature 최신 저장값을 그대로 읽은 것 — 배치가 아직 한
   * 번도 안 돌았으면 null(화면은 이 경우 숫자를 표시하지 않는다).
   */
  temperature: number | null
  /** temperature가 계산된 날짜(daily_temperature.date_on). null이면 temperature도 null. */
  temperatureDateOn: string | null
  relationshipStartDate: string | null
  /**
   * 커플 대표사진 Storage 경로(`{couple_id}/reference`). 미연결이거나
   * 아직 등록 전이면 null — "혼자서도 개인 대표사진만으로 동작"
   * (MASTER.md "미연결 유저") 원칙상 커플 대표사진은 연결 후에만 의미가 있다.
   */
  referencePhotoPath: string | null

  /** 로그인한 유저 기준으로 couples 테이블을 조회해 상태를 갱신한다. */
  refresh: (userId: string) => Promise<void>
  /** 화면 C(대표사진 등록) "[저장]" — 커플 대표사진을 업로드하고 경로를 반영한다. 연결 상태에서만 호출 가능. */
  setReferencePhoto: (localUri: string) => Promise<void>
  reset: () => void
}

const DISCONNECTED_FIELDS = {
  status: 'disconnected' as const,
  coupleId: null,
  partnerId: null,
  nickname: null,
  temperature: DISCONNECTED_TEMPERATURE,
  temperatureDateOn: null,
  relationshipStartDate: null,
  referencePhotoPath: null,
}

export const useCoupleStore = create<CoupleState>((set, get) => ({
  status: 'unknown',
  coupleId: null,
  partnerId: null,
  nickname: null,
  temperature: DISCONNECTED_TEMPERATURE,
  temperatureDateOn: null,
  relationshipStartDate: null,
  referencePhotoPath: null,

  refresh: async (userId: string) => {
    set({ status: 'loading' })

    const { data, error } = await supabase
      .from('couples')
      .select('id, relationship_start_date, nickname, user_a_id, user_b_id, reference_photo_path')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !data) {
      set(DISCONNECTED_FIELDS)
      return
    }

    const partnerId = data.user_a_id === userId ? data.user_b_id : data.user_a_id

    // 저장값 읽기 전용 — 계산하지 않는다(위 docblock 참조).
    const { data: tempRow } = await supabase
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
  },

  setReferencePhoto: async (localUri: string) => {
    const { coupleId } = get()
    if (!coupleId) throw new Error('커플로 연결된 상태에서만 커플 대표사진을 등록할 수 있습니다.')
    const path = await uploadReferencePhoto({ target: 'couple', ownerId: coupleId, localUri })
    set({ referencePhotoPath: path })
  },

  reset: () =>
    set({
      status: 'unknown',
      coupleId: null,
      partnerId: null,
      nickname: null,
      temperature: DISCONNECTED_TEMPERATURE,
      temperatureDateOn: null,
      relationshipStartDate: null,
      referencePhotoPath: null,
    }),
}))
