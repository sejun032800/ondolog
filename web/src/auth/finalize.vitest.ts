import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/store/sessionStore'
import { createProfileAndAssessment } from '@/services/personalityCore'
import { fillOnboardingAnswers, makeFakeDb } from '../testSupport'
import { finalizeAfterLogin, webRouteForStep } from './finalize'
import { withJwtRetry } from './retry'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-09T00:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
  useSessionStore.getState().resetSession()
})

const existingProfile = { id: 'user-1', onboarding_step: 1 }

describe('로그인 직후 분기와 저장', () => {
  it('새 계정: profiles insert -> personality_assessments insert 순서, 정본 저장 함수를 직접 부른 것과 호출이 같다 (RN과 같은 테이블 · 순서 · 인자)', async () => {
    fillOnboardingAnswers({ marketing: true })
    const web = makeFakeDb()
    const outcome = await finalizeAfterLogin(web.db, 'user-1', useSessionStore.getState())
    expect(outcome).toEqual({ kind: 'saved' })

    const inserts = web.calls.filter((c) => c.op === 'insert')
    expect(inserts.map((c) => c.table)).toEqual(['profiles', 'personality_assessments'])

    // RN 서비스(personalityApi)가 부르는 정본 함수를 같은 입력으로 직접 부른 기록과 비교한다.
    const s = useSessionStore.getState()
    const rn = makeFakeDb()
    await createProfileAndAssessment(rn.db, {
      userId: 'user-1', name: s.name, gender: s.gender!, birthDate: s.birthDate!, mbti: s.mbti!, mbtiSelfReported: s.mbtiSelfReported,
      q1: s.q1!, q2: s.q2!, q3: s.q3!, q4: s.q4!, q5: s.q5!, result: s.result!, marketingAgreed: s.consent.marketing,
    })
    expect(inserts).toEqual(rn.calls.filter((c) => c.op === 'insert'))
  })

  it('새 계정: 마케팅은 체크했을 때만 동의 시각이 들어간다', async () => {
    fillOnboardingAnswers({ marketing: false })
    const off = makeFakeDb()
    await finalizeAfterLogin(off.db, 'user-1', useSessionStore.getState())
    expect((off.calls.find((c) => c.table === 'profiles' && c.op === 'insert')!.payload as Record<string, unknown>).marketing_agreed_at).toBeNull()
    fillOnboardingAnswers({ marketing: true })
    const on = makeFakeDb()
    await finalizeAfterLogin(on.db, 'user-1', useSessionStore.getState())
    expect((on.calls.find((c) => c.table === 'profiles' && c.op === 'insert')!.payload as Record<string, unknown>).marketing_agreed_at).not.toBeNull()
  })

  it('기존 계정: 저장 호출 0, 서버 진행 단계로 간다 (방금 본 결과가 있었음을 알린다)', async () => {
    fillOnboardingAnswers()
    const { db, calls } = makeFakeDb({ profile: existingProfile, assessment: { id: 'a' } })
    const outcome = await finalizeAfterLogin(db, 'user-1', useSessionStore.getState())
    expect(outcome).toEqual({ kind: 'existing', step: 1, hadResult: true })
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0)
  })

  it('기존 계정 + 메모리 답이 비어 있으면(이미 계정 길) 알릴 결과가 없다', async () => {
    useSessionStore.getState().resetSession()
    const { db } = makeFakeDb({ profile: existingProfile })
    const outcome = await finalizeAfterLogin(db, 'user-1', useSessionStore.getState())
    expect(outcome).toEqual({ kind: 'existing', step: 1, hadResult: false })
  })

  it('프로필이 없는데 답이 비면 A03부터, 동의가 비면 A10부터', async () => {
    useSessionStore.getState().resetSession()
    expect((await finalizeAfterLogin(makeFakeDb().db, 'user-1', useSessionStore.getState())).kind).toBe('answers')
    fillOnboardingAnswers()
    useSessionStore.getState().setConsent({ terms: false, privacy: false, aiUsage: false, marketing: false })
    expect((await finalizeAfterLogin(makeFakeDb().db, 'user-1', useSessionStore.getState())).kind).toBe('consent')
  })

  it('프로필 조회가 PGRST303이면 한 번 다시 한다', async () => {
    fillOnboardingAnswers()
    const { db, calls } = makeFakeDb({ profile: existingProfile, assessment: { id: 'a' }, readErrors: [{ code: 'PGRST303' }] })
    const outcome = await finalizeAfterLogin(db, 'user-1', useSessionStore.getState())
    expect(outcome.kind).toBe('existing')
    expect(calls.filter((c) => c.table === 'profiles' && c.op === 'read')).toHaveLength(2)
  })

  it('PGRST303이 두 번 나오면 던진다(무한 반복 0)', async () => {
    fillOnboardingAnswers()
    const { db, calls } = makeFakeDb({ readErrors: [{ code: 'PGRST303' }, { code: 'PGRST303' }] })
    await expect(finalizeAfterLogin(db, 'user-1', useSessionStore.getState())).rejects.toMatchObject({ code: 'PGRST303' })
    expect(calls.filter((c) => c.table === 'profiles' && c.op === 'read')).toHaveLength(2)
  })

  it('다른 오류는 다시 하지 않는다', async () => {
    const run = vi.fn(async () => { throw { code: '42501' } })
    await expect(withJwtRetry(run)).rejects.toMatchObject({ code: '42501' })
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('서버 진행 단계 -> 웹 화면', () => {
  it('0 -> 결과 상세, 1 -> 초대, 그 위는 끝 화면(메인이 아직 웹에 없다)', () => {
    expect(webRouteForStep(0)).toBe('detail')
    expect(webRouteForStep(1)).toBe('invite')
    expect(webRouteForStep(2)).toBe('end')
    expect(webRouteForStep(3)).toBe('end')
  })
})
