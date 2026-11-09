import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App'
import { setSupabaseForTest } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { useSessionStore } from '@/store/sessionStore'
import { useSheetStore } from '../stores/sheetStore'
import { useCoupleStore } from '../stores/coupleStore'
import { useToastStore } from '../stores/toastStore'
import { NAV_COOLDOWN_MS } from '../navigation'
import { makeFakeBridge, makeFakeClient } from '../testSupport'
import { TAB_ROUTES } from './routes'

beforeEach(() => {
  vi.useFakeTimers()
  useAuthStore.getState().setUserId(null)
  useSessionStore.getState().resetSession()
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
  useCoupleStore.getState().reset()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  vi.useRealTimers()
})

const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('로그인 뒤 틀: 탭 바 · 탭 이동 · 뒤로 가기', () => {
  it('서버 진행 단계 2 이상이면 메인 탭으로 간다(끝 화면 없음)', async () => {
    const { client } = makeFakeClient({ session: { user: { id: 'user-1' } }, profile: { id: 'user-1', onboarding_step: 2 } })
    setSupabaseForTest(client)
    render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
    await settle(6100)
    expect(screenName()).toBe('main')
    expect(screen.getByTestId('tab-screen-main')).toBeTruthy()
  })

  it('탭 바는 탭 화면에서만 보이고, 5개 탭이 모두 있다(미연결이어도)', async () => {
    const bridge = makeFakeBridge()
    const { unmount } = render(<App bridge={bridge} initialPath="/basic" />)
    await settle(0)
    expect(screen.queryByTestId('tab-bar')).toBeNull()
    unmount()
    render(<App bridge={bridge} initialPath="/main" />)
    await settle(0)
    expect(screen.getByTestId('tab-bar')).toBeTruthy()
    for (const t of TAB_ROUTES) expect(screen.getByTestId(`tab-${t}`)).toBeTruthy()
    expect(screen.getAllByRole('tab').map((e) => e.textContent)).toEqual(['메인', '채팅', '피드', '매거진', '설정'])
  })

  it('활성 탭은 aria-selected 하나이고, 활성 표시에 점이 없다', async () => {
    render(<App bridge={makeFakeBridge()} initialPath="/feed" />)
    await settle(0)
    const selected = screen.getAllByRole('tab').filter((e) => e.getAttribute('aria-selected') === 'true')
    expect(selected.map((e) => e.getAttribute('data-testid'))).toEqual(['tab-feed'])
    expect(document.querySelectorAll('.tabBar .dot, .tabBar .tabDot').length).toBe(0)
  })

  it('탭을 누르면 그 탭으로 옮긴다. 하드웨어 뒤로 가기: 다른 탭 -> 메인 -> 앱 종료', async () => {
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/main" />)
    await settle(0)
    fireEvent.click(screen.getByTestId('tab-settings'))
    expect(screenName()).toBe('settings')
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(screenName()).toBe('main')
    expect(bridge.exitApp).not.toHaveBeenCalled()
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(bridge.exitApp).toHaveBeenCalledTimes(1)
  })

  it('탭을 옮겨도 앞 화면이 쌓이지 않는다(채팅 -> 피드 -> 뒤로 = 메인)', async () => {
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/main" />)
    await settle(0)
    fireEvent.click(screen.getByTestId('tab-chat'))
    fireEvent.click(screen.getByTestId('tab-feed'))
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(screenName()).toBe('main')
  })

  // "나중에 할게요" · "솔로예요"는 서버 진행 단계를 저장한 뒤 메인으로 간다 - `features/couple/couple.vitest.tsx`.

  it('알 수 없는 경로는 첫 화면 안내로 돌린다', async () => {
    render(<App bridge={makeFakeBridge()} initialPath="/end" />)
    await settle(6100)
    expect(screenName()).toBe('intro')
  })
})

describe('시트는 한 번에 하나, 탭을 떠나면 닫힌다(B4)', () => {
  it('시트가 열려 있을 때 뒤로 가기는 시트만 닫고 탭은 그대로다', async () => {
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/chat" />)
    await settle(0)
    act(() => { useSheetStore.getState().open('couple-gate') })
    expect(screen.getByTestId('sheet-couple-gate')).toBeTruthy()
    act(() => bridge.emitBack())
    await settle(300)
    expect(screen.queryByTestId('sheet-couple-gate')).toBeNull()
    expect(screenName()).toBe('chat')
    expect(bridge.exitApp).not.toHaveBeenCalled()
  })

  it('탭을 옮기면 열려 있던 시트도 닫힌다', async () => {
    render(<App bridge={makeFakeBridge()} initialPath="/chat" />)
    await settle(0)
    act(() => { useSheetStore.getState().open('couple-gate') })
    expect(screen.getByTestId('sheet-couple-gate')).toBeTruthy()
    // 시트의 어두운 면이 탭 바를 덮으므로, 탭 이동은 경로 변경으로 흉내 낸다(탭 바 누름).
    fireEvent.click(screen.getByTestId('tab-feed'))
    expect(useSheetStore.getState().current).toBeNull()
    expect(screen.queryByTestId('sheet-couple-gate')).toBeNull()
  })
})

describe('연결 끊김 띠 자리', () => {
  it('끊기면 모든 탭 위에 띠가 하나 뜬다', async () => {
    const { useConnectionStore } = await import('../connection/connectionMonitor')
    render(<App bridge={makeFakeBridge()} initialPath="/feed" />)
    await settle(0)
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    act(() => useConnectionStore.getState().report(false))
    expect(screen.getAllByTestId('connection-banner')).toHaveLength(1)
    act(() => useConnectionStore.getState().report(true))
    expect(screen.queryByTestId('connection-banner')).toBeNull()
  })
})
