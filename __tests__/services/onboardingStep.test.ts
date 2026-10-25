/**
 * 진행 단계(`onboarding_step`)는 클라이언트가 되돌리지 않는다 (MASTER 6-5 r70, R38-3 e).
 *
 * 앱의 모든 갱신(`personalityApi.updateOnboardingStep` · `coupleApi`의 세 함수)이 `advanceOnboardingStep`을 지나고,
 * 그 갱신은 `onboarding_step < step`일 때만 일어난다. 가짜 저장소가 그 WHERE를 실제로 적용한다.
 */
import { advanceOnboardingStep } from '../../src/services/onboardingStepCore'

class FakeProfiles {
  step: number
  writes: number[] = []
  constructor(initial: number) {
    this.step = initial
  }

  from(table: string) {
    if (table !== 'profiles') throw new Error('profiles만')
    const self = this
    let patch: { onboarding_step: number } | null = null
    const lt: number[] = []
    const api: Record<string, unknown> = {
      update: (p: { onboarding_step: number }) => ((patch = p), api),
      eq: () => api,
      lt: (_col: string, v: number) => (lt.push(v), api),
      then: (resolve: (v: unknown) => unknown) => {
        if (patch && lt.every((v) => self.step < v)) {
          self.step = patch.onboarding_step
          self.writes.push(patch.onboarding_step)
        }
        return Promise.resolve({ error: null }).then(resolve)
      },
    }
    return api
  }
}

type Step = 0 | 1 | 2 | 3

describe('advanceOnboardingStep', () => {
  it('올리기만 한다 - 같은 값 · 더 작은 값은 아무것도 바꾸지 않는다', async () => {
    const db = new FakeProfiles(2)
    await advanceOnboardingStep(db as never, 'u1', 1)
    await advanceOnboardingStep(db as never, 'u1', 2)
    await advanceOnboardingStep(db as never, 'u1', 0)
    expect(db.step).toBe(2)
    expect(db.writes).toEqual([])
    await advanceOnboardingStep(db as never, 'u1', 3)
    expect(db.step).toBe(3)
  })

  it('어떤 호출 순서로도(0~3, 길이 4 이하 모든 순서) 값이 줄어드는 일이 없다', async () => {
    const steps: Step[] = [0, 1, 2, 3]
    const sequences: Step[][] = [[]]
    for (let len = 1; len <= 4; len++) {
      const prev = sequences.filter((s) => s.length === len - 1)
      for (const s of prev) for (const v of steps) sequences.push([...s, v])
    }
    let checked = 0
    for (const initial of steps) {
      for (const seq of sequences) {
        const db = new FakeProfiles(initial)
        let previous = db.step
        for (const step of seq) {
          await advanceOnboardingStep(db as never, 'u1', step)
          expect(db.step).toBeGreaterThanOrEqual(previous)
          previous = db.step
        }
        expect(db.step).toBe(Math.max(initial, ...seq))
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })
})

describe('앱의 갱신 함수들은 모두 같은 길을 지난다', () => {
  let db: FakeProfiles
  beforeEach(() => {
    db = new FakeProfiles(3)
    jest.resetModules()
    jest.doMock('../../src/services/supabase', () => ({ supabase: { from: (t: string) => db.from(t) } }))
  })
  afterEach(() => {
    jest.dontMock('../../src/services/supabase')
  })

  it('완료(3)인 계정에 어떤 함수를 불러도 3이 그대로다', async () => {
    const couple = require('../../src/services/coupleApi')
    const personality = require('../../src/services/personalityApi')
    await couple.markInviteDoneAwaitingStartDate('u1') // 2
    await personality.updateOnboardingStep('u1', 1) // 1
    await couple.completeOnboardingWithoutCouple('u1') // 3
    await couple.markStartDateOnboardingComplete('u1') // 3
    expect(db.step).toBe(3)
    expect(db.writes).toEqual([])
  })

  it('가입 직후(0)에서는 순서대로 올라간다', async () => {
    db.step = 0
    const couple = require('../../src/services/coupleApi')
    const personality = require('../../src/services/personalityApi')
    await personality.updateOnboardingStep('u1', 1)
    await couple.markInviteDoneAwaitingStartDate('u1')
    await couple.markStartDateOnboardingComplete('u1')
    expect(db.writes).toEqual([1, 2, 3])
  })
})
