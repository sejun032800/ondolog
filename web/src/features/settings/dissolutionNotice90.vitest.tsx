/**
 * 90-(R153-2) 해제를 받은 쪽에 H14 유예 화면 한 번 - 앱이 켜진 동안 상태가 바뀌어도.
 * 원인: 해제 알림(`useDissolutionNotice`)은 탭이 처음 열릴 때 · `visibilitychange` 때 스스로 읽을 때만 판단했다. 탭 진입 · 앱 복귀(`useCoupleRefresh`),
 * 연결 회복(81-b) 같은 다른 다시 읽기가 해제 상태를 바꿔도(메인의 "유예" 줄은 바뀜) H14는 뜨지 않았다.
 * 이 시험의 "상태 변경 이벤트" = 가짜 서버 행을 바꾼 뒤 앱의 다른 다시 읽기(`refreshCoupleState` 등)가 스토어를 바꾸는 것. 실시간 구독은 `couples`에 없다(018은 messages · stories뿐).
 * 가짜 서버 + 가짜 다리 - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import App from '../../App'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { Composer } from '../chat/ChatView'
import { NAV_COOLDOWN_MS, useAppNav } from '../../navigation'
import { chatDraftForTest } from '../../platform/useChatComposer'
import { refreshCoupleState } from '../../stores/coupleRefresh'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useToastStore } from '../../stores/toastStore'
import { useSessionStore } from '@/store/sessionStore'
import { makeFakeBridge, makeFakeNav } from '../../testSupport'
import type { FakeRow } from '../../testSupportCouple'
import { DISSOLUTION_BY_ME, DISSOLUTION_BY_PARTNER, DISSOLVING, NOW, settingsDb } from './settingsTestSupport'
import { resetSettingsSummaryCache } from './useSettingsSummary'
import { useDissolutionNotice } from './useDissolutionNotice'

const memory = new Map<string, string>()
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: memory.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { memory.set(key, value) }),
    remove: vi.fn(async ({ key }: { key: string }) => { memory.delete(key) }),
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  memory.clear()
  useAuthStore.getState().setUserId(null)
  useSessionStore.getState().resetSession()
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useDissolutionStore.getState().reset()
  resetSettingsSummaryCache()
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
const visible = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}
/** 가짜 서버에서 상대(또는 나)가 해제를 요청한 것처럼 행을 바꾼다. */
function requestDissolution(db: ReturnType<typeof settingsDb>, row: FakeRow = DISSOLUTION_BY_PARTNER) {
  db.tables.couples[0].status = 'dissolving'
  db.tables.couple_dissolutions.push({ ...row })
}
/** 개시자가 취소한 것처럼 행을 바꾼다. */
function cancelDissolutionOnServer(db: ReturnType<typeof settingsDb>) {
  db.tables.couples[0].status = 'active'
  for (const d of db.tables.couple_dissolutions) d.cancelled_at = '2025-10-21T12:30:00+09:00'
}
/** 앱의 다른 다시 읽기(탭 진입 · 앱 복귀 `useCoupleRefresh`가 부르는 것)를 흉내. */
async function otherReread() {
  await act(async () => { await refreshCoupleState('me') })
}

function Probe({ nav, enabled }: { nav: ReturnType<typeof makeFakeNav>; enabled: boolean }) {
  useDissolutionNotice(nav, enabled)
  return null
}

describe('90- 받은 쪽 H14 한 번(훅)', () => {
  it('#1 탭에 머문 채 상대가 해제 요청(다른 다시 읽기가 상태를 바꿈) -> H14 1번', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    expect(nav.push).not.toHaveBeenCalled()
    requestDissolution(db)
    await otherReread()
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith('settings-couple', { urgent: true })
  })

  it('#1-b 커플 쪽만 먼저 유예로 바뀜(변경 안내 알림의 커플 다시 읽기) -> 해제 상태를 읽고 H14 1번', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    requestDissolution(db)
    await act(async () => { await useCoupleStore.getState().refresh('me') })
    await settle()
    expect(useCoupleStore.getState().grace).toBe(true)
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('#2 바탕에 있다가 돌아옴(visibilitychange) -> H14 1번', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    requestDissolution(db)
    visible()
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('#3 앱을 새로 켬(이미 dissolving) -> 탭이 처음 열릴 때 H14 1번', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_PARTNER] })
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('#4 실시간(다른 다시 읽기) 직후 바로 다시 보임 -> 1번만', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    requestDissolution(db)
    const reread = refreshCoupleState('me')
    visible()
    await act(async () => { await reread })
    await settle()
    visible()
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('#5 내가 개시자 -> 0번(어느 길로 바뀌어도)', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    requestDissolution(db, DISSOLUTION_BY_ME)
    await otherReread()
    visible()
    await settle()
    expect(useDissolutionStore.getState().dissolution?.initiatedByMe).toBe(true)
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('#8 같은 해제 id로 상태 이벤트가 여러 번 옴(새 객체 포함) -> 1번만', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    requestDissolution(db)
    await otherReread()
    await otherReread()
    await act(async () => { await useDissolutionStore.getState().refresh('me') })
    const same = useDissolutionStore.getState().dissolution
    act(() => { useDissolutionStore.setState({ dissolution: same ? { ...same } : null }) })
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('#8-b 취소 뒤 새 해제(다른 id)는 다시 1번', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    requestDissolution(db)
    await otherReread()
    cancelDissolutionOnServer(db)
    await otherReread()
    expect(useDissolutionStore.getState().dissolution).toBeNull()
    requestDissolution(db, { ...DISSOLUTION_BY_PARTNER, id: 'd2', requested_at: '2025-10-21T12:40:00+09:00' })
    await otherReread()
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(2)
  })

  it('#9 데이트 기록 시트 중에 해제가 옴 -> 미룸 -> 시트를 닫은 첫 순간 1번', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    act(() => { useSheetStore.getState().open('record') })
    requestDissolution(db)
    await otherReread()
    visible()
    await settle()
    expect(useDissolutionStore.getState().dissolution).not.toBeNull()
    expect(nav.push).not.toHaveBeenCalled() // 시트(쓰던 것)가 닫히지 않게 미룸
    act(() => { useSheetStore.getState().close('record') })
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
    visible()
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('#10 탭 밖 전체 화면 흐름 중(enabled 거짓)에 해제가 옴 -> 0번, 탭으로 돌아온 첫 순간 1번', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    const view = render(<Probe nav={nav} enabled />)
    await settle()
    view.rerender(<Probe nav={nav} enabled={false} />)
    requestDissolution(db)
    await otherReread()
    visible()
    await settle()
    expect(nav.push).not.toHaveBeenCalled()
    view.rerender(<Probe nav={nav} enabled />)
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })
})

// ───────────── #6 쓰던 채팅 글 보존(경로가 바뀌어 입력칸이 빠졌다 붙어도) ─────────────

describe('90- #6 채팅 입력 중에 해제가 와도 쓰던 글이 남는다', () => {
  /** Shell과 같은 방식: 경로마다 `key={location.key}`로 새로 그리고, 탭(/chat)에서만 알림을 켠다. */
  function Harness() {
    const { nav } = useAppNav()
    const location = useLocation()
    useDissolutionNotice(nav, location.pathname === '/chat')
    return (
      <div key={location.key} data-screen={location.pathname.slice(1)}>
        <Routes>
          <Route path="/chat" element={<Composer onSend={() => {}} onAttach={() => {}} keyboardOpen={false} />} />
          <Route path="/settings-couple" element={<button type="button" data-testid="h14-back" onClick={nav.back}>뒤로</button>} />
        </Routes>
      </div>
    )
  }
  const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
  const input = () => screen.getByTestId('chat-input') as HTMLInputElement
  const type = (text: string) => {
    const el = input()
    el.value = text
    fireEvent.input(el)
  }
  async function startChat() {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    await act(async () => { await useCoupleStore.getState().refresh('me') })
    render(<MemoryRouter initialEntries={['/chat']}><Harness /></MemoryRouter>)
    await settle(NAV_COOLDOWN_MS)
    return db
  }

  it('H14가 위에 뜨고, 뒤로 가면 입력한 글이 그대로(커플이 유예로 바뀌어도 같은 커플이면 남김)', async () => {
    const db = await startChat()
    type('오늘 정말 고마웠어')
    requestDissolution(db)
    await otherReread() // 커플 스토어도 유예(grace, 같은 커플 id)로 바뀐다
    await settle()
    expect(screenName()).toBe('settings-couple')
    expect(screen.queryByTestId('chat-input')).toBeNull()
    expect(chatDraftForTest()).toBe('오늘 정말 고마웠어')
    await settle(NAV_COOLDOWN_MS)
    fireEvent.click(screen.getByTestId('h14-back'))
    await settle()
    expect(screenName()).toBe('chat')
    expect(input().value).toBe('오늘 정말 고마웠어')
  })

  it('남긴 글은 로그아웃 때 버린다(H14로 빠진 뒤 로그아웃)', async () => {
    const db = await startChat()
    const leave = async (text: string) => {
      type(text)
      requestDissolution(db)
      await otherReread()
      await settle()
      expect(chatDraftForTest()).toBe(text)
    }
    await leave('하나')
    act(() => { useAuthStore.getState().setUserId(null) })
    expect(chatDraftForTest()).toBeNull()
  })

  it('남긴 글은 계정 전환 · 다른 커플 · 해제 완료면 버리고, 다른 주인의 글은 채우지 않는다', async () => {
    useAuthStore.getState().setUserId('me')
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', grace: false, graceCoupleId: null })
    const { unmount } = render(<MemoryRouter initialEntries={['/chat']}><Routes><Route path="/chat" element={<Composer onSend={() => {}} onAttach={() => {}} keyboardOpen={false} />} /></Routes></MemoryRouter>)
    const write = (text: string) => { const el = input(); el.value = text; fireEvent.input(el) }

    write('계정 전환')
    unmount()
    expect(chatDraftForTest()).toBe('계정 전환')
    act(() => { useAuthStore.getState().setUserId('someone-else') })
    expect(chatDraftForTest()).toBeNull()

    // 다른 커플
    act(() => { useAuthStore.getState().setUserId('me') })
    const v2 = render(<MemoryRouter initialEntries={['/chat']}><Routes><Route path="/chat" element={<Composer onSend={() => {}} onAttach={() => {}} keyboardOpen={false} />} /></Routes></MemoryRouter>)
    write('다른 커플')
    v2.unmount()
    expect(chatDraftForTest()).toBe('다른 커플')
    act(() => { useCoupleStore.setState({ status: 'connected', coupleId: 'c9' }) })
    expect(chatDraftForTest()).toBeNull()

    // 해제 완료(연결도 유예도 아님)
    act(() => { useCoupleStore.setState({ status: 'connected', coupleId: 'c1' }) })
    const v3 = render(<MemoryRouter initialEntries={['/chat']}><Routes><Route path="/chat" element={<Composer onSend={() => {}} onAttach={() => {}} keyboardOpen={false} />} /></Routes></MemoryRouter>)
    write('해제 완료')
    v3.unmount()
    expect(chatDraftForTest()).toBe('해제 완료')
    act(() => { useCoupleStore.setState({ status: 'disconnected', coupleId: null, grace: false, graceCoupleId: null }) })
    expect(chatDraftForTest()).toBeNull()

    // 다른 주인의 글은 채우지 않는다: 남긴 뒤 계정이 없어지면 다시 붙어도 빈 칸
    act(() => { useCoupleStore.setState({ status: 'connected', coupleId: 'c1' }) })
    const v4 = render(<MemoryRouter initialEntries={['/chat']}><Routes><Route path="/chat" element={<Composer onSend={() => {}} onAttach={() => {}} keyboardOpen={false} />} /></Routes></MemoryRouter>)
    expect(input().value).toBe('')
    v4.unmount()
  })
})

// ───────────── 앱 전체: 탭에 머문 채 받기 · #7 취소 뒤 ─────────────

describe('90- 앱 전체', () => {
  async function startApp() {
    const db = settingsDb()
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/intro" />)
    await settle(6100)
    return { db, bridge }
  }
  const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')

  it('#1 메인 탭에 머문 채 상대가 해제 요청 -> 다른 다시 읽기만으로 H14(상대 쪽)가 1번 뜬다', async () => {
    const { db } = await startApp()
    expect(screenName()).toBe('main')
    requestDissolution(db)
    await otherReread()
    await settle()
    expect(screenName()).toBe('settings-couple')
    expect(screen.getByTestId('grace-days').textContent).toBe('5일')
    expect(screen.getByTestId('grace-cancel-reason')).toBeTruthy()
  })

  it('#7 H14가 떠 있는 동안 개시자가 취소 -> 앱 복귀 때 다시 읽어 유예 표시가 남지 않고 연결 모습으로 바뀐다', async () => {
    const { db } = await startApp()
    requestDissolution(db)
    await otherReread()
    await settle()
    expect(screenName()).toBe('settings-couple')
    expect(screen.getByTestId('grace-card')).toBeTruthy()
    cancelDissolutionOnServer(db)
    visible()
    await settle(500)
    expect(screenName()).toBe('settings-couple')
    expect(screen.queryByTestId('grace-card')).toBeNull()
    expect(screen.getByTestId('couple-card')).toBeTruthy()
    expect(screen.getByTestId('couple-row-date')).toBeTruthy()
  })
})
