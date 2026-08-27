import { isBiometricConsentActive } from '../../src/utils/biometricConsent'

describe('isBiometricConsentActive', () => {
  it('동의 시각도 철회 시각도 없으면(최초 상태) false', () => {
    expect(isBiometricConsentActive(null, null)).toBe(false)
  })

  it('동의 시각이 있고 철회 시각이 없으면 true', () => {
    expect(isBiometricConsentActive('2026-08-27T00:00:00.000Z', null)).toBe(true)
  })

  it('동의 후 철회했으면(둘 다 있음) false', () => {
    expect(
      isBiometricConsentActive('2026-08-27T00:00:00.000Z', '2026-08-28T00:00:00.000Z'),
    ).toBe(false)
  })

  it('철회 시각만 있고 동의 시각이 없으면(DB 제약상 불가능하지만 방어적으로) false', () => {
    expect(isBiometricConsentActive(null, '2026-08-28T00:00:00.000Z')).toBe(false)
  })
})
