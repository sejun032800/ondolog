import { calculateAgeKst } from '../../src/utils/age'
import {
  canAgree,
  canEnterLogin,
  formatBirthInput,
  isAgeEligible,
  isAllConsented,
  parseBirthInput,
  toggleAllConsent,
  type ConsentFlags,
} from '../../src/utils/onboardingRules'

// 2026-10-26 00:30 KST = 2026-10-25 15:30 UTC - UTC 날짜로 계산하면 하루 어긋나는 시각이다.
const NOW = new Date('2026-10-25T15:30:00.000Z')

describe('만 14세 자동 판정 (KST 날짜, 생일 당일이면 만 14세)', () => {
  it('생일 전날은 만 13세 - 가입 불가', () => {
    expect(isAgeEligible('2012-10-27', NOW)).toBe(false)
    expect(calculateAgeKst('2012-10-27', NOW)).toBe(13)
  })
  it('생일 당일은 만 14세 - 가입 가능 (KST 오늘 = 10월 26일)', () => {
    expect(isAgeEligible('2012-10-26', NOW)).toBe(true)
    expect(calculateAgeKst('2012-10-26', NOW)).toBe(14)
  })
  it('생일 다음날은 만 14세 - 가입 가능', () => {
    expect(isAgeEligible('2012-10-25', NOW)).toBe(true)
  })
  it('기기 시간대가 아니라 KST 날짜를 쓴다 - UTC로는 아직 10월 25일인 시각에도 KST 생일이 맞는다', () => {
    // UTC 10-25 15:30 -> 같은 순간 KST는 10-26. 2012-10-26 생은 KST 기준으로 오늘 만 14세가 된다.
    expect(isAgeEligible('2012-10-26', new Date('2026-10-25T14:59:59.000Z'))).toBe(false) // KST 10-25 23:59
    expect(isAgeEligible('2012-10-26', new Date('2026-10-25T15:00:00.000Z'))).toBe(true) // KST 10-26 00:00
  })
  it('생년월일이 없거나 형식이 틀리면 false(던지지 않는다)', () => {
    expect(isAgeEligible(null, NOW)).toBe(false)
    expect(isAgeEligible('not-a-date', NOW)).toBe(false)
  })
  it('윤년 2월 29일생은 평년 2월 28일에는 아직 안 올랐고 3월 1일에 오른다', () => {
    expect(calculateAgeKst('2012-02-29', new Date('2026-02-27T15:00:00.000Z'))).toBe(13) // KST 2/28
    expect(calculateAgeKst('2012-02-29', new Date('2026-02-28T15:00:00.000Z'))).toBe(14) // KST 3/1
  })
})

describe('동의 버튼 활성 조건', () => {
  const all: ConsentFlags = { terms: true, privacy: true, aiUsage: true, marketing: false }
  it('필수 셋 + 만 14세 이상일 때만 켜진다', () => {
    expect(canAgree(all, true)).toBe(true)
    expect(canAgree({ ...all, marketing: true }, true)).toBe(true)
  })
  it('필수 하나라도 빠지면 꺼진다', () => {
    expect(canAgree({ ...all, terms: false }, true)).toBe(false)
    expect(canAgree({ ...all, privacy: false }, true)).toBe(false)
    expect(canAgree({ ...all, aiUsage: false }, true)).toBe(false)
  })
  it('만 14세 미만이면 필수를 다 체크해도 꺼진다', () => {
    expect(canAgree(all, false)).toBe(false)
  })
  it('전체 동의는 전부 켜져 있으면 전부 끄고, 아니면 전부 켠다', () => {
    expect(toggleAllConsent(all)).toEqual({ terms: true, privacy: true, aiUsage: true, marketing: true })
    expect(toggleAllConsent({ ...all, marketing: true })).toEqual({ terms: false, privacy: false, aiUsage: false, marketing: false })
    expect(isAllConsented({ ...all, marketing: true })).toBe(true)
    expect(isAllConsented(all)).toBe(false)
  })
})

describe('로그인 화면 진입 조건 (동의가 로그인 앞)', () => {
  const ok: ConsentFlags = { terms: true, privacy: true, aiUsage: true, marketing: false }
  it('동의가 다 있고 만 14세 이상일 때만 들어간다', () => {
    expect(canEnterLogin('2000-01-01', ok, NOW)).toBe(true)
    expect(canEnterLogin('2000-01-01', { ...ok, aiUsage: false }, NOW)).toBe(false)
    expect(canEnterLogin('2020-01-01', ok, NOW)).toBe(false)
    expect(canEnterLogin(null, ok, NOW)).toBe(false)
  })
})

describe('생년월일 입력', () => {
  it('숫자만 받아 YYYY.MM.DD로 보여준다', () => {
    expect(formatBirthInput('2004')).toBe('2004')
    expect(formatBirthInput('200403')).toBe('2004.03')
    expect(formatBirthInput('20040328')).toBe('2004.03.28')
    expect(formatBirthInput('2004.03.28abc99')).toBe('2004.03.28')
  })
  it('실제 있는 지난 날짜만 ISO가 된다', () => {
    expect(parseBirthInput('2004.03.28', NOW)).toBe('2004-03-28')
    expect(parseBirthInput('2004.02.30', NOW)).toBeNull()
    expect(parseBirthInput('2004.13.01', NOW)).toBeNull()
    expect(parseBirthInput('1929.01.01', NOW)).toBeNull()
    expect(parseBirthInput('2026.10.27', NOW)).toBeNull() // KST 오늘(10-26)보다 뒤
    expect(parseBirthInput('2026.10.26', NOW)).toBe('2026-10-26')
    expect(parseBirthInput('2004.03', NOW)).toBeNull()
  })
})
