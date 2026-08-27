/**
 * 생체정보(얼굴 인식) 동의 + 개인 대표사진 상태 스토어.
 *
 * 근거: docs/ONDOLOG_MASTER.md "MASTER 보강 — 생체정보(얼굴 인식) 별도
 * 동의" "데이터 처리(`profiles` 테이블 대응)", "연인 인식용 대표사진"
 * ("등록: 개인 1장 + 커플 1장, 프로필처럼 관리" / "수정: 설정 탭에서
 * 언제든 교체"). `coupleStore.ts`와 같은 패턴 — 서버(`profiles` 테이블)가
 * 진실 소스고, 이 스토어는 그 결과를 반영하는 얇은 캐시일 뿐 스스로
 * 동의 여부를 판정하지 않는다. "현재 동의가 유효한가"의 실제 판정은
 * `src/utils/biometricConsent.ts` `isBiometricConsentActive`(순수 함수)에
 * 위임한다.
 *
 * `agree`/`revoke`가 하는 일은 MASTER.md 원문 그대로:
 *   - 동의: `biometric_consent_at = now()`, `biometric_consent_revoked_at = null`
 *     (재동의 시 철회 기록을 지우는 이유는 `isBiometricConsentActive`
 *     docblock 및 `.claude/state/DECISIONS.md` 2026-08-27 항목 참조 —
 *     이 프로젝트의 해석이며 문서에 명시적 원문은 없다)
 *   - 철회: `biometric_consent_revoked_at = now()`, `reference_photo_path = null`
 *     ("철회 시 반드시 함께 일어나야 하는 일" 1, 2번). 3번(기기 로컬
 *     얼굴 특징 데이터 삭제)은 이 스토어가 할 수 없는 클라이언트 로직
 *     이다 — 얼굴 인식 자체가 아직 연동되지 않았고(이번 작업 범위 밖,
 *     메인 세션이 Phase 6 본작업에서 진행), 온디바이스 저장소에 삭제할
 *     데이터 자체가 없다. 얼굴 인식 SDK 연동 시 이 지점에 로컬 삭제
 *     호출을 추가해야 한다(MASTER.md도 "rule-auditor가 검증할 수 없는
 *     유일한 항목이므로 QA 체크리스트에 수동으로 남겨야 한다"고 명시).
 *
 * 대표사진(`referencePhotoPath`) 실제 업로드는 `src/services/
 * referencePhotoApi.ts`에 위임한다 — 이 스토어는 그 결과 경로를 반영할
 * 뿐 Storage나 Blob을 직접 다루지 않는다.
 */
import { create } from 'zustand'
import { supabase } from '../services/supabase'
import { uploadReferencePhoto } from '../services/referencePhotoApi'

interface ProfileState {
  /** 서버 조회를 아직 하지 않은 초기 상태와 "조회했지만 값이 없음"을 구분한다. */
  status: 'unknown' | 'loading' | 'loaded'
  biometricConsentAt: string | null
  biometricConsentRevokedAt: string | null
  /** 개인 대표사진 Storage 경로(`{user_id}/reference`). 미등록이면 null. */
  referencePhotoPath: string | null

  /** 로그인한 유저 기준으로 profiles의 동의·대표사진 컬럼을 조회해 상태를 갱신한다. */
  refresh: (userId: string) => Promise<void>
  /** 화면 A "[동의하고 계속]" — 설정 탭 재동의 경로도 동일하게 이 함수를 쓴다. */
  agreeBiometricConsent: (userId: string) => Promise<void>
  /** 설정 탭 "[동의 철회]" — 확인 다이얼로그를 거친 뒤에만 호출돼야 한다. */
  revokeBiometricConsent: (userId: string) => Promise<void>
  /** 화면 C(대표사진 등록) "[저장]" — 개인 대표사진을 업로드하고 경로를 반영한다. */
  setPersonalReferencePhoto: (userId: string, localUri: string) => Promise<void>
  reset: () => void
}

const INITIAL_FIELDS = {
  status: 'unknown' as const,
  biometricConsentAt: null,
  biometricConsentRevokedAt: null,
  referencePhotoPath: null,
}

export const useProfileStore = create<ProfileState>((set) => ({
  ...INITIAL_FIELDS,

  refresh: async (userId: string) => {
    set({ status: 'loading' })

    const { data, error } = await supabase
      .from('profiles')
      .select('biometric_consent_at, biometric_consent_revoked_at, reference_photo_path')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      set({
        status: 'loaded',
        biometricConsentAt: null,
        biometricConsentRevokedAt: null,
        referencePhotoPath: null,
      })
      return
    }

    set({
      status: 'loaded',
      biometricConsentAt: data.biometric_consent_at,
      biometricConsentRevokedAt: data.biometric_consent_revoked_at,
      referencePhotoPath: data.reference_photo_path,
    })
  },

  agreeBiometricConsent: async (userId: string) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('profiles')
      .update({ biometric_consent_at: now, biometric_consent_revoked_at: null })
      .eq('id', userId)
    if (error) throw error

    set({ biometricConsentAt: now, biometricConsentRevokedAt: null })
  },

  revokeBiometricConsent: async (userId: string) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('profiles')
      .update({ biometric_consent_revoked_at: now, reference_photo_path: null })
      .eq('id', userId)
    if (error) throw error

    set((state) => ({
      biometricConsentAt: state.biometricConsentAt,
      biometricConsentRevokedAt: now,
      referencePhotoPath: null,
    }))
  },

  setPersonalReferencePhoto: async (userId: string, localUri: string) => {
    const path = await uploadReferencePhoto({ target: 'personal', ownerId: userId, localUri })
    set({ referencePhotoPath: path })
  },

  reset: () => set({ ...INITIAL_FIELDS }),
}))
