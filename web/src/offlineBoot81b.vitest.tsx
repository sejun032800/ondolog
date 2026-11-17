/**
 * 81-b(보충 2 · 4 · 5) "네트워크 실패"와 "계정 없음"은 같은 흐름이 아니다 - 앱 시작 네 경우 · 채팅 저장분(76-A1) · 로그아웃 확인 문구.
 * 서버는 메모리 가짜(`makeCoupleDb`) + 오프라인 흉내(기기 offline · 요청은 연결 오류). 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { Preferences } from '@capacitor/preferences'
import App from './App'
import { setSupabaseForTest } from './auth/client'
import { resetCallbackStateForTest } from './auth/callback'
import { useAuthStore } from './auth/stores'
import { saveBootRoute, writeCache } from './cache/deviceCache'
import { useConnectionStore } from './connection/connectionMonitor'
import { ACTIVE, ASSESSMENT, ME, PARTNER, PERSONALITY } from './features/settings/settingsTestSupport'
import { writeChatCache } from './features/chat/chatCache'
import { useChatMessages, type ChatHubs } from './features/chat/useChatMessages'
import { countUnsentMessages, LOGOUT_KEPT_NOTE, LOGOUT_QUEUED_NOTE } from './features/settings/unsentCount'
import { ProfileScreen } from './features/settings/ProfileScreen'
import { forgetLibrary } from './features/magazine/libraryData'
import { resetSettingsSummaryCache } from './features/settings/useSettingsSummary'
import { useAccountProblemStore } from './stores/accountProblemStore'
import { useCoupleStore } from './stores/coupleStore'
import { useDissolutionStore } from './stores/dissolutionStore'
import { useProfileStore } from './stores/profileStore'
import { makeFakeBridge, makeFakeNav } from './testSupport'
import { makeCoupleDb, type FakeRow } from './testSupportCouple'
import { useSessionStore } from '@/store/sessionStore'

class FakeObserver { observe() {} unobserve() {} disconnect() {} }
async function settle(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const problemShown = () => document.querySelector('[data-testid="account-problem"]') !== null
const ONBOARDING = new Set(['intro', 'basic', 'mbti', 'quiz', 'brief', 'share-card', 'consent', 'underage', 'auth', 'callback'])

const AUTH_KEY = 'sb-test-auth-token'
/** 저장된 로그인(Preferences - 클라이언트와 같은 키). 토큰 값은 시험용 글자. */
async function storeSession(userId = 'me') {
  await Preferences.set({ key: AUTH_KEY, value: JSON.stringify({ access_token: 'x', refresh_token: 'r', expires_at: 1, user: { id: userId } }) })
}

function resetAll() {
  resetCallbackStateForTest()
  useAuthStore.getState().setUserId(null)
  useSessionStore.getState().resetSession()
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useDissolutionStore.getState().reset()
  useAccountProblemStore.getState().clear()
  useConnectionStore.setState({ offline: false })
  resetSettingsSummaryCache()
  forgetLibrary()
}

let onLine: ReturnType<typeof vi.spyOn> | null = null
function goOffline() {
  onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-10-21T12:00:00+09:00'))
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver
  localStorage.clear()
  await Preferences.clear()
  resetAll()
})
afterEach(() => {
  cleanup()
  onLine?.mockRestore()
  onLine = null
  setSupabaseForTest(undefined)
  vi.useRealTimers()
})

/**
 * 가짜 서버. `net.down`이면 모든 표 읽기가 연결 오류(supabase-js처럼 오류 값)로 끝나고, `sessionExpired`면 getSession이 "갱신 실패(연결)" - 세션 null + 오류.
 * `serverError`면 profiles 읽기가 서버 오류(연결은 됨).
 */
function server(opts: { session: boolean; sessionExpiredOffline?: boolean }) {
  const net = { down: false, serverError: false }
  const db = makeCoupleDb({
    profiles: [{ ...ME, onboarding_step: 3 }, PARTNER],
    couples: [ACTIVE],
    session: opts.session ? { user: { id: 'me', app_metadata: { provider: 'kakao' } } } : null,
    extraTables: { personality_profiles: [{ ...PERSONALITY, attachment: 'secure' }], personality_assessments: [ASSESSMENT as FakeRow], couple_dissolutions: [] },
  })
  const client = db.client as unknown as { from: (t: string) => unknown; auth: Record<string, unknown> }
  const real = client.from
  const failing = (err: Record<string, unknown>) => {
    const f: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'order', 'limit', 'in', 'is', 'or', 'gte', 'lte', 'range', 'neq', 'not']) f[k] = () => f
    f.maybeSingle = async () => ({ data: null, error: err })
    f.single = async () => ({ data: null, error: err })
    f.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: err }).then(ok)
    return f
  }
  client.from = (t: string) => {
    if (net.down) return failing({ message: 'TypeError: Failed to fetch' })
    if (net.serverError && t === 'profiles') return failing({ code: 'XX000' })
    return real(t)
  }
  client.auth.storageKey = AUTH_KEY
  if (opts.sessionExpiredOffline) {
    client.auth.getSession = async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } })
  }
  setSupabaseForTest(db.client)
  return { db, net }
}

async function boot() {
  render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
  await settle(6100)
  await settle(800)
}

describe('81-b 상태표 - 세션 있음 + 오프라인 (빈 화면 0 · 시작 화면 0)', () => {
  it('저장값 있음: 메인을 저장값으로(D+ · 끊김 띠) · 온보딩 · 로그인 0 · 안내 화면 0', async () => {
    await storeSession()
    // 실제 폰에 남는 메인 저장분(76-r F3 · F4): 요약 · 서재 · 사실
    writeCache('me', 'main', { coupleId: 'c1', partnerId: 'p1', nickname: '우리', temperature: 37, temperatureDateOn: null, relationshipStartDate: '2025-01-01', referencePhotoPath: null })
    writeCache('me', 'main', { coupleId: 'c1', issues: [], next: null }, 'library')
    writeCache('me', 'main', { coupleId: 'c1', hasActivity: true, profilesComplete: true, openedIssueIds: [], openedFor: '' }, 'facts')
    saveBootRoute('me', 'main')
    const { net } = server({ session: false, sessionExpiredOffline: true })
    net.down = true
    goOffline()
    await boot()
    expect(screenName()).toBe('main')
    expect(problemShown()).toBe(false)
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    expect(screen.getByTestId('main-days').textContent).toMatch(/^D\+\d+$/)
    expect(useCoupleStore.getState().status).toBe('connected')
  })

  it('저장값 비었음(버전 변경 · 첫 실행): 메인 자리 표시 + 띠 · 온보딩 · 로그인 0 · "미연결"로 판정 0', async () => {
    await storeSession()
    const { net } = server({ session: false, sessionExpiredOffline: true })
    net.down = true
    goOffline()
    await boot()
    expect(screenName()).toBe('main')
    expect(ONBOARDING.has(screenName() ?? '')).toBe(false)
    expect(problemShown()).toBe(false)
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    expect(useCoupleStore.getState().status).not.toBe('disconnected')
  })

  it('세션은 확인됐지만 서버를 못 읽음(오프라인): 같은 길 - 메인 + 띠 · 연결이 돌아오면 서버로 다시 읽어 채움', async () => {
    const { net } = server({ session: true })
    net.down = true
    goOffline()
    await boot()
    expect(screenName()).toBe('main')
    expect(problemShown()).toBe(false)
    net.down = false
    onLine?.mockReturnValue(true)
    act(() => { useConnectionStore.getState().report(true) })
    await settle(800)
    expect(screenName()).toBe('main')
    expect(useCoupleStore.getState().status).toBe('connected')
  })

  it('[다시 시도]는 다시 시도만 - 실패가 이어져도 안내 화면이 걷히지 않음(그 아래 첫 화면 노출 0) · 서버가 돌아오면 메인', async () => {
    const { net } = server({ session: true })
    net.serverError = true // 연결은 됨 - 서버 오류(네트워크 실패가 아니라 안내 화면 길)
    await boot()
    expect(problemShown()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(problemShown()).toBe(true) // 누른 순간에도 걷히지 않는다
    await settle(800)
    expect(problemShown()).toBe(true)
    net.serverError = false
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await settle(800)
    expect(problemShown()).toBe(false)
    expect(screenName()).toBe('main')
  })

  it('세션 정말 없음(저장분 0) -> 첫 화면 · 오프라인이어도 저장분이 없으면 첫 화면', async () => {
    server({ session: false })
    await boot()
    expect(screenName()).toBe('intro')
    cleanup(); resetAll()
    server({ session: false, sessionExpiredOffline: true })
    goOffline()
    await boot()
    expect(screenName()).toBe('intro')
    expect(useAuthStore.getState().userId).toBeNull()
  })
})

describe('81-b 채팅 저장분(76-A1 회귀) - 처음 그릴 때 커플이 아직 없어도 정해지면 저장분을 바로 그림', () => {
  const hubs = {
    text: { attach: vi.fn(), subscribe: () => () => {}, isAttempting: () => false },
    photo: { attach: vi.fn(), subscribe: () => () => {}, isAttempting: () => false },
  } as unknown as ChatHubs
  it('coupleId null -> c1: 저장된 대화가 보이고 자리 표시(loading) 0 · 오프라인 읽기 실패에도 그대로', async () => {
    const { db, net } = server({ session: true })
    net.down = true
    const ch = { on: () => ch, subscribe: () => ch, unsubscribe: async () => 'ok' }
    Object.assign(db.client as object, { channel: () => ch, removeChannel: async () => 'ok' })
    writeChatCache('me', 'c1', [{ id: 'm1', clientMsgId: null, coupleId: 'c1', senderId: 'partner', body: '저장된 대화', mediaPath: null, sentAt: '2025-10-20T10:00:00Z', readAt: null }])
    const { result, rerender } = renderHook(({ c }: { c: string | null }) => useChatMessages(c, 'me', hubs), { initialProps: { c: null as string | null } })
    expect(result.current.messages).toEqual([])
    rerender({ c: 'c1' })
    expect(result.current.messages.map((m) => m.body)).toEqual(['저장된 대화'])
    expect(result.current.loading).toBe(false)
    await settle(100) // 서버 읽기(연결 오류)가 끝나도 저장된 대화는 그대로
    expect(result.current.messages.map((m) => m.body)).toEqual(['저장된 대화'])
  })
})

describe('81-b 로그아웃 확인 - 보내지 못한 메시지 수(R119-2 문구 그대로 · 동작은 R39-5 b 그대로 · 계정 전환 줄 0)', () => {
  const text = (id: string) => ({ clientMsgId: id, coupleId: 'c1', senderId: 'me', body: '글', sentAt: '2025-10-20T00:00:00Z', retryCount: 0, status: 'pending' })
  const photo = (id: string) => ({ clientId: id, kind: 'message', coupleId: 'c1', userId: 'me', localUri: `chat-photo-queue/${id}.jpg`, ext: 'jpg', contentType: 'image/jpeg', sentAt: '2025-10-20T00:00:00Z', retryCount: 0, status: 'pending' })

  function openConfirm() {
    vi.useRealTimers()
    useAuthStore.getState().setUserId('me')
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'partner' })
    setSupabaseForTest(null)
    const nav = makeFakeNav()
    render(<ProfileScreen nav={nav} />)
    fireEvent.click(screen.getByTestId('profile-logout'))
    return nav
  }

  it('수 세기: 대기열 0 · 1 · 3(글 2 + 사진 1) / 보존 원본은 따로(같은 원본 한 번)', async () => {
    expect(await countUnsentMessages('me', 'c1')).toEqual({ queued: 0, kept: 0 })
    await Preferences.set({ key: 'chat_queue:c1', value: JSON.stringify({ __v: 1, items: [text('a')] }) })
    expect(await countUnsentMessages('me', 'c1')).toEqual({ queued: 1, kept: 0 })
    await Preferences.set({ key: 'chat_queue:c1', value: JSON.stringify({ __v: 1, items: [text('a'), text('b')] }) })
    await Preferences.set({ key: 'chat_photo_queue:c1:me', value: JSON.stringify({ __v: 1, items: [photo('p')] }) })
    expect(await countUnsentMessages('me', 'c1')).toEqual({ queued: 3, kept: 0 })
    localStorage.setItem('ondolog.dc1:me:qkeep:text:c1', JSON.stringify({ __v: 1, d: { entries: [{ at: 'x', raw: '{"q":1}' }, { at: 'y', raw: '{"q":1}' }] } }))
    expect(await countUnsentMessages('me', 'c1')).toEqual({ queued: 3, kept: 1 })
    expect(await countUnsentMessages(null, 'c1')).toEqual({ queued: 0, kept: 0 })
  })

  it('n = 0 -> 지금 문장 그대로(한 줄 더 0)', async () => {
    openConfirm()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('다시 로그인하면 기록은 그대로 볼 수 있어요.')).toBeTruthy()
    expect(screen.queryByTestId('confirm-note')).toBeNull()
  })

  it('n = 1 -> 문구와 숫자', async () => {
    await Preferences.set({ key: 'chat_queue:c1', value: JSON.stringify({ __v: 1, items: [text('a')] }) })
    openConfirm()
    expect((await screen.findByTestId('confirm-note')).textContent).toBe('아직 보내지 못한 메시지 1개가 있어요. 같은 계정으로 다시 로그인하면 이어서 보내요.')
    expect(screen.getAllByTestId('confirm-note')).toHaveLength(1) // 계정 전환 줄 0(코드 근거 없음)
  })

  it('n = 3(글 2 + 사진 1) -> 문구와 숫자 · [취소]하면 대기열 그대로', async () => {
    await Preferences.set({ key: 'chat_queue:c1', value: JSON.stringify({ __v: 1, items: [text('a'), text('b')] }) })
    await Preferences.set({ key: 'chat_photo_queue:c1:me', value: JSON.stringify({ __v: 1, items: [photo('p')] }) })
    openConfirm()
    expect((await screen.findByTestId('confirm-note')).textContent).toBe(LOGOUT_QUEUED_NOTE(3))
    fireEvent.click(screen.getByTestId('confirm-no'))
    expect(screen.queryByTestId('logout-confirm')).toBeNull()
    expect(JSON.parse((await Preferences.get({ key: 'chat_queue:c1' })).value!).items).toHaveLength(2)
    expect(JSON.parse((await Preferences.get({ key: 'chat_photo_queue:c1:me' })).value!).items).toHaveLength(1)
  })

  it('[로그아웃] 확인 -> 기존 삭제 규칙대로: 기기 저장 · 보존 원본은 지움, 대기열 키는 남김(R39-5 b - 동작 변경 0)', async () => {
    await Preferences.set({ key: 'chat_queue:c1', value: JSON.stringify({ __v: 1, items: [text('a')] }) })
    localStorage.setItem('ondolog.dc1:me:qkeep:text:c1', JSON.stringify({ __v: 1, d: { entries: [{ at: 'x', raw: '{"q":1}' }] } }))
    writeCache('me', 'feed', { chapters: [], names: {} })
    const nav = openConfirm()
    await vi.waitFor(() => expect(screen.getAllByTestId('confirm-note').map((n) => n.textContent)).toEqual([LOGOUT_QUEUED_NOTE(1), LOGOUT_KEPT_NOTE(1)]))
    expect(LOGOUT_KEPT_NOTE(1)).toBe('보내지 못한 메시지 1개는 로그아웃하면 이 폰에서 사라져요.')
    await act(async () => { fireEvent.click(screen.getByTestId('confirm-yes')) })
    await vi.waitFor(() => expect(nav.reset).toHaveBeenCalledWith('intro'))
    expect(localStorage.getItem('ondolog.dc1:me:qkeep:text:c1')).toBeNull()
    expect(localStorage.getItem('ondolog.dc1:me:feed')).toBeNull()
    expect((await Preferences.get({ key: 'chat_queue:c1' })).value).not.toBeNull()
  })
})
