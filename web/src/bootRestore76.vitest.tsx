/**
 * 76-0-2 카메라 복귀 - 웹뷰가 다시 시작돼도(MemoryRouter는 경로를 기억하지 않는다) 마지막으로 있던 탭으로 돌아온다.
 * 판정: 앱 재시작(웹뷰 다시 불러오기)이고, 경로 복원이 아니다 - `App`의 `initialPath`는 늘 `/intro`이고 경로를 저장하는 곳이 없었다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { ONBOARDING_STEP } from '@/constants/onboardingStep'
import App from './App'
import { resetCallbackStateForTest } from './auth/callback'
import { setSupabaseForTest } from './auth/client'
import { useAuthStore } from './auth/stores'
import { ROUTE_RESTORE_WINDOW_MS, readCache, readLastTab, saveLastTab } from './cache/deviceCache'
import { makeFakeBridge, makeFakeClient } from './testSupport'

beforeEach(() => {
  vi.useFakeTimers()
  try { localStorage.clear() } catch { /* */ }
  resetCallbackStateForTest()
  useAuthStore.getState().setUserId(null)
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  vi.useRealTimers()
})

const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
async function start() {
  render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
}
const completeAccount = () => makeFakeClient({ session: { user: { id: 'user-1' } }, profile: { id: 'user-1', onboarding_step: ONBOARDING_STEP.COMPLETE } })

describe('0-2 마지막 탭 복원', () => {
  it('재시작 직후(10분 안) 마지막 탭이 채팅이면 채팅으로 돌아온다(메인 · 설정이 비치지 않는다)', async () => {
    saveLastTab('user-1', 'chat')
    setSupabaseForTest(completeAccount().client)
    await start()
    expect(screenName()).toBe('chat')
  })

  it('저장이 없으면 평소처럼 메인', async () => {
    setSupabaseForTest(completeAccount().client)
    await start()
    expect(screenName()).toBe('main')
  })

  it('10분이 지났거나 다른 계정의 저장이면 복원하지 않는다', async () => {
    saveLastTab('user-1', 'chat', Date.now() - ROUTE_RESTORE_WINDOW_MS - 1000)
    saveLastTab('user-2', 'feed')
    setSupabaseForTest(completeAccount().client)
    await start()
    expect(screenName()).toBe('main')
  })

  it('탭을 옮기면 그 탭이 기기에 남는다 · 탭이 아닌 값은 복원하지 않는다', async () => {
    setSupabaseForTest(completeAccount().client)
    await start()
    expect(readLastTab('user-1', (r) => r === 'main')).toBe('main')
    saveLastTab('user-1', 'settings-profile')
    expect(readLastTab('user-1', (r) => r === 'chat')).toBeNull()
    expect(readCache('user-2', 'route')).toBeNull()
  })
})
