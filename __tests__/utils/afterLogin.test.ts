/**
 * 로그인 직후 분기(MASTER 6-5 r70)의 순수 규칙 - 모든 조합.
 */
import { decideAfterLogin, hasCompleteAnswers } from '../../src/utils/onboardingRules'
import { resumePathFor } from '../../src/utils/onboardingResume'

describe('decideAfterLogin', () => {
  const bools = [false, true]
  it('프로필이 있으면 저장하지 않는다 - 메모리가 온전하고 검사 행만 없는 경우(저장이 중간에 끊긴 흔적)만 예외', () => {
    for (const hasAssessment of bools)
      for (const answersComplete of bools)
        for (const consentComplete of bools) {
          const action = decideAfterLogin({ hasProfile: true, hasAssessment, answersComplete, consentComplete })
          const partial = answersComplete && consentComplete && !hasAssessment
          expect(action).toBe(partial ? 'save' : 'existing')
        }
  })

  it('프로필이 없으면 메모리를 본다 - 답 없음 -> A03, 동의 없음 -> A10, 둘 다 있음 -> 저장', () => {
    const base = { hasProfile: false, hasAssessment: false }
    expect(decideAfterLogin({ ...base, answersComplete: false, consentComplete: false })).toBe('answers')
    expect(decideAfterLogin({ ...base, answersComplete: false, consentComplete: true })).toBe('answers')
    expect(decideAfterLogin({ ...base, answersComplete: true, consentComplete: false })).toBe('consent')
    expect(decideAfterLogin({ ...base, answersComplete: true, consentComplete: true })).toBe('save')
  })
})

describe('hasCompleteAnswers', () => {
  const full = {
    name: '세준',
    gender: 'male',
    birthDate: '2000-01-01',
    mbti: 'INFJ',
    q1: 'A',
    q2: 'A',
    q3: 'A',
    q4: 'A',
    q5: 'A',
    result: {},
  }
  it('하나라도 비면 false (이름은 공백만 있어도 비었다)', () => {
    expect(hasCompleteAnswers(full)).toBe(true)
    expect(hasCompleteAnswers({ ...full, name: '   ' })).toBe(false)
    for (const key of ['gender', 'birthDate', 'mbti', 'q1', 'q2', 'q3', 'q4', 'q5', 'result'] as const) {
      expect(hasCompleteAnswers({ ...full, [key]: null })).toBe(false)
    }
  })
})

describe('resumePathFor (서버 진행 단계 -> 경로)', () => {
  it('0 -> 결과 상세, 1 -> 초대, 2 -> 연결됐고 날짜 없으면 사귄 날짜 아니면 메인, 3 -> 메인', () => {
    expect(resumePathFor(0, { connectedWithoutStartDate: false })).toBe('/result-detail')
    expect(resumePathFor(1, { connectedWithoutStartDate: false })).toBe('/invite')
    expect(resumePathFor(2, { connectedWithoutStartDate: true })).toBe('/start-date')
    expect(resumePathFor(2, { connectedWithoutStartDate: false })).toBe('/main')
    expect(resumePathFor(3, { connectedWithoutStartDate: true })).toBe('/main')
  })
})
