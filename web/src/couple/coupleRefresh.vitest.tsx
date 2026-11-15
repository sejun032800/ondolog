/**
 * A-19 커플 값 다시 읽기(앱 복귀 · 탭 진입 · 탈퇴 취소) + A-24 해제 유예(메인 화면 · 초대 입구 막기) 시험. 서버는 가짜 클라이언트 - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DissolutionState } from '@/utils/dissolution'
import { GRACE_NO_INVITE, openInvite, setInviteEntry } from '../app/inviteEntry'
import { setSupabaseForTest } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { CoupleNeeded } from '../components/CoupleGate'
import { SoloBanner } from '../features/feed/FeedView'
import { EMPTY_FACTS, EMPTY_LIBRARY } from '../features/main/useMainData'
import { MainView, MAIN_COPY, type MainViewProps } from '../features/main/MainView'
import { Unconnected } from '../features/magazine/LibraryView'
import { SettingsView } from '../features/settings/SettingsView'
import { ACTIVE, DISSOLVING, DISSOLUTION_BY_PARTNER, ME, PARTNER, settingsDb } from '../features/settings/settingsTestSupport'
import { WithdrawCancelScreen } from '../features/settings/WithdrawCancelScreen'
import { onAppResume, RESUME_DEDUPE_MS } from '../platform/appResume'
import { useCoupleStore } from '../stores/coupleStore'
import { useDissolutionStore } from '../stores/dissolutionStore'
import { useToastStore } from '../stores/toastStore'
import { makeFakeNav } from '../testSupport'
import { makeCoupleDb } from '../testSupportCouple'
import { getOrCreateInvite, InviteBlockedByGraceError } from './coupleApi'
import { useCoupleRefresh } from './useCoupleRefresh'

const cap = vi.hoisted(() => ({ handlers: [] as Array<() => void>, removed: 0 }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (name: string, cb: () => void) => {
      if (name === 'resume') cap.handlers.push(cb)
      return { remove: async () => { cap.removed += 1 } }
    }),
    exitApp: vi.fn(),
  },
}))

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

beforeEach(() => {
  cap.handlers = []
  cap.removed = 0
  useAuthStore.getState().setUserId('me')
  useCoupleStore.getState().reset()
  useDissolutionStore.getState().reset()
  useToastStore.getState().hide()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setSupabaseForTest(undefined)
  setInviteEntry(null)
  useAuthStore.getState().setUserId(null)
})

describe('onAppResume - Capacitor resume + visibilitychange를 한 번으로', () => {
  it('두 신호가 함께 와도 한 번, 시간이 지난 뒤의 복귀는 다시 한 번', async () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const off = onAppResume(cb)
    await act(async () => { await Promise.resolve() })
    expect(cap.handlers).toHaveLength(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { cap.handlers[0](); document.dispatchEvent(new Event('visibilitychange')) })
    expect(cb).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(RESUME_DEDUPE_MS + 10) })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(cb).toHaveBeenCalledTimes(2)
    off()
    await act(async () => { await Promise.resolve() })
    expect(cap.removed).toBe(1)
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

describe('useCoupleRefresh - 탭에 들어올 때 · 앱 복귀 때 다시 읽기', () => {
  function Probe() {
    useCoupleRefresh()
    return <div data-testid="probe" />
  }
  function countedDb() {
    const db = makeCoupleDb({ couples: [{ ...ACTIVE }], profiles: [ME, PARTNER], extraTables: { couple_dissolutions: [] } })
    let coupleReads = 0
    const from = db.client.from.bind(db.client)
    ;(db.client as unknown as { from: unknown }).from = (table: string) => {
      if (table === 'couples') coupleReads += 1
      return from(table as never)
    }
    setSupabaseForTest(db.client)
    return { db, reads: () => coupleReads, reset: () => { coupleReads = 0 } }
  }

  it('탭 진입: 화면이 열릴 때 커플 상태를 읽고, 다시 열면(탭을 옮겼다 돌아옴) 또 읽는다', async () => {
    const c = countedDb()
    const first = render(<Probe />)
    await flush()
    await waitFor(() => expect(useCoupleStore.getState().status).toBe('connected'))
    const perRefresh = c.reads()
    expect(perRefresh).toBeGreaterThan(0)
    first.unmount()
    c.reset()
    render(<Probe />)
    await flush()
    await waitFor(() => expect(c.reads()).toBe(perRefresh))
  })

  it('앱 복귀: Capacitor resume과 visibilitychange가 함께 와도 한 번만 다시 읽는다', async () => {
    const c = countedDb()
    render(<Probe />)
    await flush()
    await waitFor(() => expect(useCoupleStore.getState().status).toBe('connected'))
    const perRefresh = c.reads()
    c.reset()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => { cap.handlers[0](); document.dispatchEvent(new Event('visibilitychange')) })
    await flush()
    expect(c.reads()).toBe(perRefresh)
  })

  it('상대 폰에서 바뀐 값(닉네임)을 복귀 때 가져온다', async () => {
    const c = countedDb()
    render(<Probe />)
    await flush()
    await waitFor(() => expect(useCoupleStore.getState().nickname).toBe('늘봄'))
    c.db.tables.couples[0].nickname = '새이름'
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => { cap.handlers[0]() })
    await waitFor(() => expect(useCoupleStore.getState().nickname).toBe('새이름'))
  })

  it('로그인이 없으면 읽지 않는다', async () => {
    useAuthStore.getState().setUserId(null)
    const c = countedDb()
    render(<Probe />)
    await flush()
    expect(c.reads()).toBe(0)
    expect(cap.handlers).toHaveLength(0)
  })
})

describe('A-24 해제 유예 - 연결 상태 읽기', () => {
  it('active 커플이 없고 dissolving 커플이 있으면 미연결 + grace, 닉네임은 유지한다', async () => {
    const db = settingsDb({ couples: [{ ...DISSOLVING }] })
    await useCoupleStore.getState().refresh('me')
    const s = useCoupleStore.getState()
    expect(s.status).toBe('disconnected')
    expect(s.grace).toBe(true)
    expect(s.nickname).toBe('늘봄')
    expect(s.coupleId).toBeNull()
    expect(db.writes).toEqual([])
  })

  it('유예가 풀려 active로 돌아오면 grace가 꺼진다(탈퇴 취소 뒤 다시 읽기)', async () => {
    const db = settingsDb({ couples: [{ ...DISSOLVING }] })
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().grace).toBe(true)
    db.tables.couples[0].status = 'active'
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().status).toBe('connected')
    expect(useCoupleStore.getState().grace).toBe(false)
  })

  it('커플이 아예 없으면 grace가 아니다', async () => {
    settingsDb({ couples: [] })
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().status).toBe('disconnected')
    expect(useCoupleStore.getState().grace).toBe(false)
  })

  it('탈퇴 취소 화면: 취소 성공 뒤 커플 상태를 바로 다시 읽는다(낡은 "혼자예요"가 남지 않는다)', async () => {
    const PENDING = { ...ME, deleted_at: '2025-10-19T00:00:00+09:00', purge_scheduled_at: '2025-10-26T00:00:00+09:00' }
    const db = settingsDb({
      profiles: [PENDING, PARTNER],
      couples: [{ ...DISSOLVING }],
      dissolutions: [{ ...DISSOLUTION_BY_PARTNER, initiated_by: 'me', reason: 'withdrawal' }],
      rpc: () => {
        db.tables.profiles[0].deleted_at = null
        db.tables.profiles[0].purge_scheduled_at = null
        db.tables.couples[0].status = 'active'
        return { data: null, error: null }
      },
    })
    await useCoupleStore.getState().refresh('me')
    expect(useCoupleStore.getState().grace).toBe(true)
    const nav = makeFakeNav()
    render(<WithdrawCancelScreen nav={nav} />)
    await waitFor(() => expect(screen.getByTestId('withdraw-days')).toBeTruthy(), { timeout: 4000 })
    fireEvent.click(screen.getByTestId('withdraw-cancel-button'))
    await waitFor(() => expect(nav.enterAccount).toHaveBeenCalled(), { timeout: 4000 })
    expect(useCoupleStore.getState().status).toBe('connected')
    expect(useCoupleStore.getState().grace).toBe(false)
  })
})

describe('A-24 해제 유예 - 화면', () => {
  const dissolution: DissolutionState = {
    dissolutionId: 'd1', coupleId: 'c1', partnerId: 'p1', reason: 'unlink', initiatedByMe: false, purgeScheduledAt: '2099-01-10T00:00:00+09:00',
  }
  function main(over: Partial<MainViewProps> = {}) {
    const onInvite = vi.fn()
    render(
      <MainView
        now={new Date('2098-12-31T03:00:00Z')}
        status="disconnected" nickname="늘봄" storedTemperature={null} startDate={null} selfName="세준" partnerName={null}
        facts={EMPTY_FACTS} library={{ ...EMPTY_LIBRARY, loading: false }} summary={null}
        onInvite={onInvite} onChat={() => {}} onOpenIssue={() => {}}
        {...over}
      />,
    )
    return onInvite
  }

  it('유예 중 메인: "아직 혼자예요"도 [연인 초대하기]도 없고, 닉네임 · 36.5 · 7일 요약 카드가 보인다', () => {
    useCoupleStore.setState({ status: 'disconnected', grace: true, nickname: '늘봄' })
    main({ grace: { dissolution } })
    expect(screen.getByTestId('main-state-grace')).toBeTruthy()
    expect(document.body.textContent).not.toContain('아직 혼자예요')
    expect(screen.queryByText(MAIN_COPY.invite)).toBeNull()
    expect(screen.getByTestId('main-header').textContent).toContain('늘봄')
    expect(screen.getByTestId('main-hero-fixedTemperature')).toBeTruthy()
    expect(screen.getByTestId('main-grace-days').textContent).toMatch(/^\d+일$/)
    expect(screen.getByTestId('main-grace-date').textContent).toBe('1월 10일에 연결이 해제돼요')
  })

  it('유예 정보를 아직 못 읽었으면 카드만 빼고 그린다(초대 버튼은 그래도 없다)', () => {
    useCoupleStore.setState({ status: 'disconnected', grace: true, nickname: '늘봄' })
    main({ grace: { dissolution: null } })
    expect(screen.queryByTestId('main-grace-card')).toBeNull()
    expect(screen.queryByText(MAIN_COPY.invite)).toBeNull()
  })

  it('유예가 아닌 미연결은 그대로 "아직 혼자예요" + [연인 초대하기]', () => {
    useCoupleStore.setState({ status: 'disconnected', grace: false, nickname: null })
    main({ nickname: null })
    expect(screen.getByText('아직 혼자예요')).toBeTruthy()
    expect(screen.getByText(MAIN_COPY.invite)).toBeTruthy()
  })

  it('설정 목록: 유예 중에도 커플 닉네임이 비지 않고 연인 줄은 "해제 예정"', async () => {
    settingsDb({ couples: [{ ...DISSOLVING }], dissolutions: [{ ...DISSOLUTION_BY_PARTNER }] })
    await useCoupleStore.getState().refresh('me')
    await useDissolutionStore.getState().refresh('me')
    render(<MemoryRouter><SettingsView nav={makeFakeNav()} /></MemoryRouter>)
    expect(screen.getByTestId('settings-row-nickname').textContent).toContain('늘봄')
    expect(screen.getByTestId('settings-row-partner').textContent).toContain('해제 예정')
  })

  it('초대 입구가 어디에도 없다: 게이트 카드 · 피드 배너 · 서재 잠긴 문', () => {
    useCoupleStore.setState({ status: 'disconnected', grace: true })
    const { unmount } = render(<CoupleNeeded />)
    expect(screen.queryByText('초대 코드 보내기')).toBeNull()
    expect(screen.queryByText('받은 코드 입력하기')).toBeNull()
    expect(screen.getByTestId('couple-gate')).toBeTruthy()
    unmount()
    render(<SoloBanner />)
    expect(screen.queryByRole('button', { name: '초대' })).toBeNull()
    cleanup()
    render(<Unconnected />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('openInvite는 유예 중이면 입구를 열지 않고 안내만 한다', () => {
    const entry = vi.fn()
    setInviteEntry(entry)
    useCoupleStore.setState({ status: 'disconnected', grace: true })
    openInvite('intro')
    openInvite('enter')
    expect(entry).not.toHaveBeenCalled()
    expect(useToastStore.getState().toast?.message).toBe(GRACE_NO_INVITE)
    useCoupleStore.setState({ grace: false })
    openInvite('intro')
    expect(entry).toHaveBeenCalledWith('intro')
  })

  it('getOrCreateInvite는 유예 중이면 발급을 시도하지 않는다(insert 0 - 23505 5회 되풀이 없음)', async () => {
    const db = makeCoupleDb({ couples: [{ ...DISSOLVING }], insertErrors: [{ code: '23505' }, { code: '23505' }, { code: '23505' }, { code: '23505' }, { code: '23505' }] })
    await expect(getOrCreateInvite(db.client, 'me')).rejects.toBeInstanceOf(InviteBlockedByGraceError)
    expect(db.writes).toEqual([])
  })
})
