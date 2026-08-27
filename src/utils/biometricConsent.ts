/**
 * 생체정보(얼굴 인식) 동의 상태 판정 — 순수 함수.
 *
 * 근거: docs/ONDOLOG_MASTER.md "MASTER 보강 — 생체정보(얼굴 인식) 별도
 * 동의" "데이터 처리(`profiles` 테이블 대응)". 스키마(003_profiles.sql)는
 * `biometric_consent_at`/`biometric_consent_revoked_at` 두 컬럼만 두고
 * "현재 동의가 유효한가"를 판정하는 파생 규칙 자체는 문서에 명시돼
 * 있지 않다 — CHECK 제약(`biometric_consent_revoked_at is null or
 * biometric_consent_at is not null`)은 "철회는 동의 이후에만 가능하다"만
 * 강제할 뿐, 재동의 시 `revoked_at`을 어떻게 다뤄야 하는지는 열어둔다.
 *
 * 이 프로젝트가 채택한 해석(`.claude/state/DECISIONS.md` 2026-08-27
 * 항목 참조): 재동의(`agreeBiometricConsent`)는 `biometric_consent_at`을
 * 새 시각으로 갱신하면서 `biometric_consent_revoked_at`을 `null`로
 * 되돌린다 — 그래서 "현재 동의가 유효한가"는 두 컬럼만 보고 이렇게
 * 판정할 수 있다: **동의 시각이 있고, 철회 시각이 없다.**
 */
export function isBiometricConsentActive(
  consentAt: string | null,
  revokedAt: string | null,
): boolean {
  return consentAt !== null && revokedAt === null
}
