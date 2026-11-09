import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useSessionStore } from '@/store/sessionStore'
import { AuthScreen, CallbackScreen } from '../screens'
import { callbackInbox, resetCallbackStateForTest } from './callback'
import { setSupabaseForTest } from './client'
import { useAuthStore, useNoticeStore } from './stores'
import { fillOnboardingAnswers, makeFakeBridge, makeFakeClient, makeFakeNav } from '../testSupport'
import { EXISTING_ACCOUNT_NOTICE } from './finalize'

beforeEach(() => {
  resetCallbackStateForTest()
  useAuthStore.getState().setUserId(null)
  useNoticeStore.getState().clear()
  useSessionStore.getState().resetSession()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
})

const SECRET = 'SECRETCODE123'

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

function renderCallback(client: ReturnType<typeof makeFakeClient>['client'], code: string | null = SECRET, extra: { failed?: boolean } = {}) {
  setSupabaseForTest(client)
  callbackInbox.put({ code, failed: extra.failed ?? false })
  const nav = makeFakeNav()
  const bridge = makeFakeBridge()
  const view = render(<MemoryRouter><CallbackScreen nav={nav} bridge={bridge} /></MemoryRouter>)
  return { nav, bridge, view }
}

describe('A11 로그인 화면', () => {
  it('카카오 하나뿐이다 - Google · Apple 버튼이 없다', () => {
    const { client } = makeFakeClient()
    setSupabaseForTest(client)
    fillOnboardingAnswers()
    render(<MemoryRouter><AuthScreen nav={makeFakeNav()} bridge={makeFakeBridge()} /></MemoryRouter>)
    expect(screen.getByText('카카오로 시작하기')).toBeTruthy()
    expect(screen.queryByText(/Google/)).toBeNull()
    expect(screen.queryByText(/Apple/)).toBeNull()
    expect(screen.getByText('새로 가입하면 방금 본 결과가 계정에 저장돼요.')).toBeTruthy()
  })

  it('"이미 계정이 있어요" 길의 부제는 다르다', () => {
    const { client } = makeFakeClient()
    setSupabaseForTest(client)
    useSessionStore.getState().setExistingAccountPath(true)
    render(<MemoryRouter><AuthScreen nav={makeFakeNav()} bridge={makeFakeBridge()} /></MemoryRouter>)
    expect(screen.getByText('이미 가입한 계정으로 로그인해요.')).toBeTruthy()
    expect((screen.getByText('카카오로 시작하기') as HTMLButtonElement).disabled).toBe(false)
  })

  it('누르면 "이동 중"으로 바뀌고 다시 눌리지 않는다(B11) - 브라우저는 한 번만 연다', async () => {
    const { client, spies } = makeFakeClient()
    setSupabaseForTest(client)
    fillOnboardingAnswers()
    const bridge = makeFakeBridge()
    render(<MemoryRouter><AuthScreen nav={makeFakeNav()} bridge={bridge} /></MemoryRouter>)
    const button = screen.getByText('카카오로 시작하기')
    fireEvent.click(button)
    fireEvent.click(button)
    await flush()
    const busy = screen.getByText('카카오로 이동 중이에요') as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    expect(spies.signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(bridge.openBrowser).toHaveBeenCalledTimes(1)
    // 브라우저를 닫으면(취소) 다시 누를 수 있다.
    act(() => bridge.emitBrowserFinished())
    expect((screen.getByText('카카오로 시작하기') as HTMLButtonElement).disabled).toBe(false)
  })

  it('시작하지 못하면 "로그인하지 못했어요" 문구만 보이고 다시 누를 수 있다', async () => {
    const { client, spies } = makeFakeClient()
    spies.signInWithOAuth.mockRejectedValueOnce(new Error('network down: https://x.invalid?code=zzz'))
    setSupabaseForTest(client)
    fillOnboardingAnswers()
    render(<MemoryRouter><AuthScreen nav={makeFakeNav()} bridge={makeFakeBridge()} /></MemoryRouter>)
    fireEvent.click(screen.getByText('카카오로 시작하기'))
    await flush()
    expect(screen.getByText('로그인하지 못했어요. 잠시 후 다시 시도해주세요.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('network down')
    expect((screen.getByText('카카오로 시작하기') as HTMLButtonElement).disabled).toBe(false)
  })

  it('동의 없이 온 길이면 버튼이 눌리지 않는다', () => {
    const { client } = makeFakeClient()
    setSupabaseForTest(client)
    render(<MemoryRouter><AuthScreen nav={makeFakeNav()} bridge={makeFakeBridge()} /></MemoryRouter>)
    expect((screen.getByText('카카오로 시작하기') as HTMLButtonElement).disabled).toBe(true)
  })

  it('원격 설정이 비어 있으면(개발) 원격으로 가지 않고 개발용 안내만 보인다', () => {
    setSupabaseForTest(null)
    fillOnboardingAnswers()
    render(<MemoryRouter><AuthScreen nav={makeFakeNav()} bridge={makeFakeBridge()} /></MemoryRouter>)
    expect((screen.getByText('카카오로 시작하기') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/설정이 비어 있어요/)).toBeTruthy()
  })
})

describe('로그인 콜백 화면', () => {
  it('새 계정: 코드 교환 한 번 -> 저장 -> 결과 상세로(알림 0), 화면에 코드가 없다', async () => {
    fillOnboardingAnswers()
    const { client, spies, calls } = makeFakeClient()
    const { nav } = renderCallback(client)
    expect(document.body.textContent).not.toContain(SECRET)
    await flush()
    expect(spies.exchange).toHaveBeenCalledTimes(1)
    expect(spies.exchange).toHaveBeenCalledWith(SECRET)
    expect(calls.filter((c) => c.op === 'insert').map((c) => c.table)).toEqual(['profiles', 'personality_assessments'])
    expect(nav.enterAccount).toHaveBeenCalledWith('detail')
    expect(useNoticeStore.getState().message).toBeNull()
    expect(useSessionStore.getState().result).toBeNull() // 저장 뒤 메모리를 비웠다
    expect(document.body.textContent).not.toContain(SECRET)
  })

  it('기존 계정: 저장 0, 알림 한 번, 서버 진행 단계로', async () => {
    fillOnboardingAnswers()
    const { client, calls } = makeFakeClient({ profile: { id: 'user-1', onboarding_step: 1 }, assessment: { id: 'a' } })
    const { nav } = renderCallback(client)
    await flush()
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0)
    expect(nav.enterAccount).toHaveBeenCalledWith('invite')
    expect(useNoticeStore.getState().message).toBe(EXISTING_ACCOUNT_NOTICE)
    expect(useSessionStore.getState().result).toBeNull() // 방금 본 결과는 저장하지 않고 버렸다
  })

  it('교환이 실패하면 "로그인하지 못했어요" + [다시 시도], 오류 원문 · 코드는 화면에 없다', async () => {
    fillOnboardingAnswers()
    const { client } = makeFakeClient({ exchange: async () => ({ data: { session: null }, error: { message: `invalid code ${SECRET}` } }) })
    const { nav } = renderCallback(client)
    await flush()
    expect(screen.getByText('로그인하지 못했어요')).toBeTruthy()
    expect(screen.getByText('다시 시도')).toBeTruthy()
    expect(document.body.textContent).not.toContain(SECRET)
    expect(document.body.textContent).not.toContain('invalid code')
    expect(nav.enterAccount).not.toHaveBeenCalled()
    expect(useSessionStore.getState().consent.terms).toBe(true) // 동의 상태는 그대로(MASTER 6-5)
  })

  it('서비스가 오류를 돌려준 링크 · 코드 없는 링크도 같은 실패 화면이고 교환하지 않는다', async () => {
    const a = makeFakeClient()
    renderCallback(a.client, null, { failed: true })
    await flush()
    expect(screen.getByText('로그인하지 못했어요')).toBeTruthy()
    expect(a.spies.exchange).not.toHaveBeenCalled()
    cleanup()
    const b = makeFakeClient()
    renderCallback(b.client, null)
    await flush()
    expect(screen.getByText('로그인하지 못했어요')).toBeTruthy()
    expect(b.spies.exchange).not.toHaveBeenCalled()
  })

  it('[다시 시도]는 카카오 로그인을 다시 시작한다', async () => {
    const { client, spies } = makeFakeClient({ exchange: async () => ({ data: { session: null }, error: { message: 'x' } }) })
    const { bridge } = renderCallback(client)
    await flush()
    fireEvent.click(screen.getByText('다시 시도'))
    await flush()
    expect(spies.signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(bridge.openBrowser).toHaveBeenCalledTimes(1)
  })

  it('저장이 실패하면 넘어가지 않고 [다시 시도] - 메모리의 답 · 동의는 그대로, 교환은 다시 하지 않는다', async () => {
    fillOnboardingAnswers()
    const { client, spies } = makeFakeClient({ readErrors: [{ code: '500' }] })
    const { nav } = renderCallback(client)
    await flush()
    expect(screen.getByText('저장하지 못했어요. 다시 시도해주세요.')).toBeTruthy()
    expect(nav.enterAccount).not.toHaveBeenCalled()
    expect(useSessionStore.getState().result).not.toBeNull()
    fireEvent.click(screen.getByText('다시 시도'))
    await flush()
    expect(spies.exchange).toHaveBeenCalledTimes(1)
    expect(nav.enterAccount).toHaveBeenCalledWith('detail')
  })

  it('로그인 직후 첫 조회가 PGRST303이면 한 번 다시 해서 이어진다', async () => {
    fillOnboardingAnswers()
    const { client, calls } = makeFakeClient({ readErrors: [{ code: 'PGRST303' }] })
    const { nav } = renderCallback(client)
    await flush()
    expect(calls.filter((c) => c.table === 'profiles' && c.op === 'read')).toHaveLength(2)
    expect(nav.enterAccount).toHaveBeenCalledWith('detail')
  })

  it('처리하는 동안 뒤로 가기는 받지 않는다', async () => {
    fillOnboardingAnswers()
    let release: (v: { data: { session: { user: { id: string } } | null }; error: null }) => void = () => {}
    const { client } = makeFakeClient({ exchange: () => new Promise((r) => { release = r as typeof release }) })
    const { nav, bridge } = renderCallback(client)
    // 화면 뒤로 가기 핸들러는 Shell이 연결한다 - 여기서는 등록된 핸들러가 비어 있지 않은지(먹어 버리는지)를 본다.
    const { handleHardwareBack } = await import('../platform/backStack')
    handleHardwareBack({ canGoBack: () => true, goBack: nav.back, exitApp: bridge.exitApp })
    expect(nav.back).not.toHaveBeenCalled()
    expect(bridge.exitApp).not.toHaveBeenCalled()
    await act(async () => { release({ data: { session: { user: { id: 'user-1' } } }, error: null }) })
    await flush()
  })
})
