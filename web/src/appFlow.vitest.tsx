import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useRef } from 'react'
import App from './App'
import { NAV_COOLDOWN_MS, useAppNav } from './navigation'
import { resetCallbackStateForTest } from './auth/callback'
import { setSupabaseForTest } from './auth/client'
import { useAuthStore, useNoticeStore } from './auth/stores'
import { BOOT_TIMEOUT_MS } from './auth/useBootSession'
import { EXISTING_ACCOUNT_NOTICE } from './auth/finalize'
import { useSessionStore } from '@/store/sessionStore'
import { fillOnboardingAnswers, makeFakeBridge, makeFakeClient } from './testSupport'
import { LoveQuizScreen } from './screens'

beforeEach(() => {
  vi.useFakeTimers()
  resetCallbackStateForTest()
  useAuthStore.getState().setUserId(null)
  useNoticeStore.getState().clear()
  useSessionStore.getState().resetSession()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  vi.useRealTimers()
})

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')

async function startApp(path: string, bridge = makeFakeBridge()) {
  render(<App bridge={bridge} initialPath={path} />)
  await settle(6000) // 하늘 이미지를 기다리는 대체 시간
  return bridge
}

describe('로그인 왕복 (앱 링크 -> 콜백 -> 저장 -> 계정 화면)', () => {
  it('앱 링크가 들어오면 콜백 화면을 거쳐 결과 상세로 가고, 라우터 · 화면에 코드가 남지 않는다', async () => {
    fillOnboardingAnswers()
    const { client, spies } = makeFakeClient()
    setSupabaseForTest(client)
    const bridge = await startApp('/auth')
    expect(screenName()).toBe('auth')

    act(() => bridge.emitUrl('ondolog://auth/callback?code=SECRETCODE123'))
    await settle(10)
    expect(bridge.closeBrowser).toHaveBeenCalled()
    expect(spies.exchange).toHaveBeenCalledTimes(1)
    expect(screenName()).toBe('detail')
    expect(document.body.innerHTML).not.toContain('SECRETCODE123')
    expect(useNoticeStore.getState().message).toBeNull()
  })

  it('같은 앱 링크가 두 번 들어와도 교환은 한 번이다', async () => {
    fillOnboardingAnswers()
    const { client, spies } = makeFakeClient()
    setSupabaseForTest(client)
    const bridge = await startApp('/auth')
    act(() => {
      bridge.emitUrl('ondolog://auth/callback?code=ONCE')
      bridge.emitUrl('ondolog://auth/callback?code=ONCE')
    })
    await settle(10)
    expect(spies.exchange).toHaveBeenCalledTimes(1)
  })

  it('다른 주소의 앱 링크는 무시한다', async () => {
    const { client, spies } = makeFakeClient()
    setSupabaseForTest(client)
    fillOnboardingAnswers()
    const bridge = await startApp('/auth')
    act(() => bridge.emitUrl('ondolog://somewhere/else?code=x'))
    await settle(10)
    expect(screenName()).toBe('auth')
    expect(spies.exchange).not.toHaveBeenCalled()
  })

  it('E5 계정이 생긴 뒤에는 뒤로 가기가 앱 종료이고 온보딩으로 돌아가지 않는다', async () => {
    fillOnboardingAnswers()
    const { client } = makeFakeClient()
    setSupabaseForTest(client)
    const bridge = await startApp('/auth')
    act(() => bridge.emitUrl('ondolog://auth/callback?code=EXIT1'))
    await settle(10)
    expect(screenName()).toBe('detail')
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(bridge.exitApp).toHaveBeenCalledTimes(1)
    expect(screenName()).toBe('detail')
  })

  it('기존 계정은 알림이 한 번 보이고 눌러서 닫을 수 있다', async () => {
    fillOnboardingAnswers()
    const { client } = makeFakeClient({ profile: { id: 'user-1', onboarding_step: 0 }, // 이 가짜 서버는 검사 · 성격 프로필 읽기에 같은 행을 돌려주므로 두 표의 칸을 모두 가진 행을 준다(A14는 서버 값을 그린다).
      assessment: { id: 'a', mbti: 'INFJ', q1: 'A', enneagram_core: 4, enneagram_inferred: 4, attachment: 'secure', big_e: 40, big_o: 70, big_a: 60, big_c: 55, big_n: 35, stern_intimacy: 60, stern_passion: 50, stern_commitment: 55 } })
    setSupabaseForTest(client)
    const bridge = await startApp('/auth')
    act(() => bridge.emitUrl('ondolog://auth/callback?code=EXIST1'))
    await settle(10)
    expect(screenName()).toBe('detail')
    expect(screen.getAllByText(/이미 가입한 계정이에요/)).toHaveLength(1)
    fireEvent.click(screen.getByRole('status'))
    expect(screen.queryByText(/이미 가입한 계정이에요/)).toBeNull()
  })
})

describe('기존 계정 알림 (F3 - 끝 화면이 없는 흐름)', () => {
  const NOTICE = '이미 가입한 계정이에요. 원래 정보로 이어서 보여 드려요. 방금 본 결과는 저장하지 않았어요.'

  it('문구는 R65-2 원문 그대로다', () => {
    expect(EXISTING_ACCOUNT_NOTICE).toBe(NOTICE)
  })

  it('서버 진행 단계가 끝(2 이상)인 기존 계정은 메인 탭으로 가고, 알림이 그 위에 한 번 보인다', async () => {
    fillOnboardingAnswers()
    const { client } = makeFakeClient({ profile: { id: 'user-1', onboarding_step: 3 }, // 이 가짜 서버는 검사 · 성격 프로필 읽기에 같은 행을 돌려주므로 두 표의 칸을 모두 가진 행을 준다(A14는 서버 값을 그린다).
      assessment: { id: 'a', mbti: 'INFJ', q1: 'A', enneagram_core: 4, enneagram_inferred: 4, attachment: 'secure', big_e: 40, big_o: 70, big_a: 60, big_c: 55, big_n: 35, stern_intimacy: 60, stern_passion: 50, stern_commitment: 55 } })
    setSupabaseForTest(client)
    const bridge = await startApp('/auth')
    act(() => bridge.emitUrl('ondolog://auth/callback?code=EXIST3'))
    await settle(10)
    expect(screenName()).toBe('main')
    expect(screen.getAllByText(NOTICE)).toHaveLength(1)
  })

  it('방금 본 결과가 없었으면(저장하지 않은 것이 없으므로) 알림이 없다', async () => {
    useSessionStore.getState().resetSession()
    const { client } = makeFakeClient({ profile: { id: 'user-1', onboarding_step: 3 }, // 이 가짜 서버는 검사 · 성격 프로필 읽기에 같은 행을 돌려주므로 두 표의 칸을 모두 가진 행을 준다(A14는 서버 값을 그린다).
      assessment: { id: 'a', mbti: 'INFJ', q1: 'A', enneagram_core: 4, enneagram_inferred: 4, attachment: 'secure', big_e: 40, big_o: 70, big_a: 60, big_c: 55, big_n: 35, stern_intimacy: 60, stern_passion: 50, stern_commitment: 55 } })
    setSupabaseForTest(client)
    const bridge = await startApp('/auth')
    act(() => bridge.emitUrl('ondolog://auth/callback?code=EXIST4'))
    await settle(10)
    expect(screen.queryByText(/이미 가입한 계정이에요/)).toBeNull()
  })

  it('끝 화면 경로(/end)는 없다 - 알 수 없는 경로는 첫 화면', async () => {
    await startApp('/end')
    expect(screenName()).toBe('intro')
  })
})

describe('앱을 다시 켰을 때', () => {
  it('저장된 로그인이 있으면 서버 진행 단계 화면으로 바로 간다', async () => {
    const { client } = makeFakeClient({ session: { user: { id: 'user-1' } }, profile: { id: 'user-1', onboarding_step: 1 } })
    setSupabaseForTest(client)
    await startApp('/intro')
    expect(screenName()).toBe('invite')
    expect(useAuthStore.getState().userId).toBe('user-1')
  })

  it('저장된 로그인이 없으면 첫 화면이다', async () => {
    const { client } = makeFakeClient({ session: null })
    setSupabaseForTest(client)
    await startApp('/intro')
    expect(screenName()).toBe('intro')
  })

  it('확인이 멈춰도 일정 시간 뒤에는 첫 화면이 보인다', async () => {
    const { client } = makeFakeClient()
    ;(client.auth as unknown as { getSession: () => Promise<never> }).getSession = () => new Promise(() => {})
    setSupabaseForTest(client)
    render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
    await settle(6100)
    expect(screenName()).toBe('intro')
    fireEvent.click(document.querySelector('.screen') as Element) // 첫 화면 연출 건너뛰기
    expect(screen.queryByText('시작하기')).not.toBeNull()
  })
})

describe('이동 규칙', () => {
  function Harness({ onNav }: { onNav: (n: ReturnType<typeof useAppNav>) => void }) {
    const n = useAppNav()
    const loc = useLocation()
    const ref = useRef(n)
    ref.current = n
    onNav(n)
    return <span data-testid="at">{loc.pathname}</span>
  }
  function setup() {
    let nav!: ReturnType<typeof useAppNav>
    render(<MemoryRouter initialEntries={['/intro']}><Harness onNav={(n) => { nav = n }} /></MemoryRouter>)
    return { get: () => nav, at: () => screen.getByTestId('at').textContent }
  }

  it('연타: 이동 직후의 push · back은 무시하고, 연출이 끝난 뒤에는 받는다', () => {
    const h = setup()
    act(() => { h.get().nav.push('basic') })
    act(() => { h.get().nav.push('mbti') })
    expect(h.at()).toBe('/basic')
    act(() => { vi.advanceTimersByTime(NAV_COOLDOWN_MS) })
    act(() => { h.get().nav.push('mbti') })
    expect(h.at()).toBe('/mbti')
    // 빠른 뒤로 가기 두 번 -> 한 단계만
    act(() => { vi.advanceTimersByTime(NAV_COOLDOWN_MS) })
    act(() => { h.get().nav.back(); h.get().nav.back() })
    expect(h.at()).toBe('/basic')
  })

  it('urgent push · reset · replace는 연타 대기에 막히지 않는다', () => {
    const h = setup()
    act(() => { h.get().nav.push('auth') })
    act(() => { h.get().nav.push('callback', { urgent: true }) })
    expect(h.at()).toBe('/callback')
    act(() => { h.get().nav.replace('callback') })
    expect(h.at()).toBe('/callback')
    act(() => { h.get().nav.reset('consent') })
    expect(h.at()).toBe('/consent')
  })

  it('enterAccount 뒤에는 뒤로 갈 수 없다', () => {
    const h = setup()
    act(() => { h.get().nav.push('basic') })
    act(() => { vi.advanceTimersByTime(NAV_COOLDOWN_MS) })
    act(() => { h.get().nav.enterAccount('detail') })
    expect(h.get().canGoBack()).toBe(false)
    act(() => { vi.advanceTimersByTime(NAV_COOLDOWN_MS) })
    act(() => { h.get().nav.back() })
    expect(h.at()).toBe('/detail')
  })
})

describe('E4 결과 화면이 두 번 열리지 않는다', () => {
  it('마지막 문항의 같은 답을 연달아 두 번 눌러도 결과 화면으로는 한 번만 간다', () => {
    useSessionStore.getState().setMbtiSelfReported('ENFP')
    ;(['A', 'B', 'A', 'B'] as const).forEach((c, i) => useSessionStore.getState().setQuizAnswer((i + 1) as 1 | 2 | 3 | 4, c))
    const push = vi.fn()
    const nav = { push, back: vi.fn(), reset: vi.fn(), replace: vi.fn(), enterAccount: vi.fn() }
    render(<MemoryRouter><LoveQuizScreen nav={nav} /></MemoryRouter>)
    // 5문항까지 넘어간다(문항마다 한 번씩).
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getAllByRole('radio')[0])
      act(() => { vi.advanceTimersByTime(200) })
    }
    const last = screen.getAllByRole('radio')[0]
    fireEvent.click(last)
    fireEvent.click(last)
    act(() => { vi.advanceTimersByTime(400) })
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('brief')
  })
})
