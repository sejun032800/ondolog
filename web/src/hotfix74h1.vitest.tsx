/**
 * 74-h1 급한 수정 시험(R77-2): ① 같은 실행 재로그인 세 순서 · ③ 애착 이름 · ⑤ 기존 계정 알림.
 * 로그인은 **진짜 Supabase 인증 클라이언트**(PKCE 코드 교환 · 저장소 · 로그아웃)에 가짜 네트워크(`fetch`)와 메모리 저장소를 붙여 돌린다 - 가짜 클라이언트로는
 * "한 번 쓴 코드 · 지워지지 않은 세션 · 남은 표시"가 만드는 실패가 안 보이기 때문이다. 서버 표(프로필 · 커플)는 메모리 가짜. 주소 · 키 없음.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from 'react-router-dom'
import App, { NOTICE_MS } from './App'
import { createWebClient, setSupabaseForTest, type WebSupabase } from './auth/client'
import { callbackInbox, hasExchanged, resetCallbackStateForTest } from './auth/callback'
import { EXISTING_ACCOUNT_NOTICE } from './auth/finalize'
import { useAuthStore, useNoticeStore } from './auth/stores'
import { attachmentDisplayName, personalityMetaLine } from './attachmentNames'
import { forgetLibrary } from './features/magazine/libraryData'
import { PersonalityScreen } from './features/settings/PersonalityScreen'
import { SettingsResultScreen } from './features/settings/SettingsResultScreen'
import { ACTIVE, ME, PARTNER, PERSONALITY, ASSESSMENT } from './features/settings/settingsTestSupport'
import { resetSettingsSummaryCache } from './features/settings/useSettingsSummary'
import { ResultDetailScreen } from './screens'
import { useCoupleStore } from './stores/coupleStore'
import { useDissolutionStore } from './stores/dissolutionStore'
import { useProfileStore } from './stores/profileStore'
import { useSheetStore } from './stores/sheetStore'
import { fillOnboardingAnswers, makeFakeBridge, makeFakeNav } from './testSupport'
import { makeCoupleDb, type FakeRow } from './testSupportCouple'
import { useSessionStore } from '@/store/sessionStore'
import type { AttachmentType } from '@/constants/attachment'

const FAILED = '로그인하지 못했어요'

function memStorage() {
  const m = new Map<string, string>()
  return {
    m,
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => { m.set(k, v) },
    removeItem: async (k: string) => { m.delete(k) },
  }
}

/** 진짜 인증 클라이언트 + 가짜 네트워크. `good*`로 시작하는 코드만 교환에 성공하고, 한 번 쓴 코드는 다시 쓸 수 없다(진짜 서버처럼). */
function makeRealAuth(storage: ReturnType<typeof memStorage>) {
  const used = new Set<string>()
  const fakeFetch = (async (input: unknown, init?: { body?: string }) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/token?grant_type=pkce')) {
      const body = JSON.parse(init?.body ?? '{}') as { auth_code?: string; code_verifier?: string }
      const code = body.auth_code ?? ''
      if (!body.code_verifier || !code.startsWith('good') || used.has(code)) return json({ error: 'invalid_grant', error_code: 'flow_state_not_found', msg: 'no' }, 400)
      used.add(code)
      return json({
        access_token: 'a.b.c', refresh_token: 'r', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
        user: { id: 'me', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2020-01-01' },
      })
    }
    if (url.includes('/logout')) return new Response(null, { status: 204 })
    return json({})
  }) as typeof fetch
  vi.stubGlobal('fetch', fakeFetch)
  return createWebClient({ url: 'https://x.invalid', anonKey: 'k' }, storage)
}

function plug(real: WebSupabase, db: ReturnType<typeof makeCoupleDb>) {
  const dbClient = db.client as unknown as { from: unknown; rpc: unknown }
  const client = { from: dbClient.from, rpc: dbClient.rpc, auth: real.auth } as unknown as WebSupabase
  setSupabaseForTest(client)
  return client
}

async function settle(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const byId = (id: string) => screen.getByTestId(id)
const noFailure = () => expect(document.body.textContent ?? '').not.toContain(FAILED)
const sessionKeys = (m: Map<string, string>) => [...m.keys()].filter((k) => k.startsWith('sb-x-auth-token'))

function resetMemory() {
  resetCallbackStateForTest()
  useAuthStore.getState().setUserId(null)
  useNoticeStore.getState().clear()
  useSessionStore.getState().resetSession()
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useDissolutionStore.getState().reset()
  useSheetStore.getState().closeAll()
  resetSettingsSummaryCache()
  forgetLibrary()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-10-21T12:00:00+09:00'))
  resetMemory()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** 로그인 화면에서 카카오 왕복을 한 번 돌린다(시작 -> 앱 링크). */
async function kakaoRoundTrip(bridge: ReturnType<typeof makeFakeBridge>, code: string) {
  fireEvent.click(screen.getByText('카카오로 시작하기'))
  await settle(10)
  act(() => bridge.emitUrl(`ondolog://auth/callback?code=${code}`))
  await settle(60)
}
async function toSettingsProfile() {
  fireEvent.click(byId('tab-settings'))
  await settle(500)
  fireEvent.click(byId('settings-row-profile'))
  await settle(500)
}
async function backToLoginScreen() {
  await settle(6100) // 첫 화면 연출
  fireEvent.click(screen.getByText('이미 계정이 있어요'))
  await settle(500)
  expect(screenName()).toBe('auth')
}

type RpcFn = (fn: string, args: Record<string, unknown>) => { data: unknown; error: null }
function serverWith(extra: { rpc?: RpcFn } = {}) {
  return makeCoupleDb({
    profiles: [{ ...ME }, PARTNER],
    couples: [ACTIVE],
    extraTables: { personality_profiles: [PERSONALITY], personality_assessments: [ASSESSMENT], couple_dissolutions: [] },
    ...extra,
  })
}

describe('① D1 같은 실행 재로그인 - 세 순서에서 "로그인하지 못했어요"는 0', () => {
  it('(1) 로그인 -> 로그아웃 -> 같은 실행에서 다시 로그인 -> 메인', async () => {
    const storage = memStorage()
    plug(makeRealAuth(storage), serverWith())
    const bridge = makeFakeBridge()
    useSessionStore.getState().setExistingAccountPath(true)
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)

    await kakaoRoundTrip(bridge, 'good1')
    expect(screenName()).toBe('main')
    noFailure()
    expect(sessionKeys(storage.m)).toContain('sb-x-auth-token') // 세션이 저장됨

    await toSettingsProfile()
    fireEvent.click(byId('profile-logout'))
    await settle(200)
    expect(screenName()).toBe('intro')
    // 남은 상태가 없다: 세션 저장소 · 콜백 칸 · 처리한 코드 표시 · 알림 · 사용자 상태
    expect(sessionKeys(storage.m)).toEqual([])
    expect(callbackInbox.take()).toBeNull()
    expect(hasExchanged('good1')).toBe(false)
    expect(useNoticeStore.getState().message).toBeNull()
    expect(useAuthStore.getState().userId).toBeNull()

    await backToLoginScreen()
    await kakaoRoundTrip(bridge, 'good2')
    expect(screenName()).toBe('main')
    noFailure()
    expect(useAuthStore.getState().userId).toBe('me')
  })

  it('(2) 로그인 -> 탈퇴 요청 -> 다시 로그인 -> 유예 화면이 먼저(H16) -> 취소 -> 메인', async () => {
    const storage = memStorage()
    const db: ReturnType<typeof serverWith> = serverWith({
      rpc: (fn) => {
        const me = db.tables.profiles.find((p) => p.id === 'me') as FakeRow
        if (fn === 'fn_request_withdrawal') {
          me.deleted_at = '2025-10-21T00:00:00+09:00'
          me.purge_scheduled_at = '2025-10-28T00:00:00+09:00'
          return { data: '2025-10-28T00:00:00+09:00', error: null }
        }
        if (fn === 'fn_cancel_withdrawal') {
          me.deleted_at = null
          me.purge_scheduled_at = null
          return { data: null, error: null }
        }
        return { data: 'c1', error: null }
      },
    })
    plug(makeRealAuth(storage), db)
    const bridge = makeFakeBridge()
    useSessionStore.getState().setExistingAccountPath(true)
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    await kakaoRoundTrip(bridge, 'good1')
    expect(screenName()).toBe('main')

    await toSettingsProfile()
    fireEvent.click(byId('profile-withdraw'))
    await settle(500)
    fireEvent.change(byId('withdraw-phrase-input'), { target: { value: '탈퇴합니다' } })
    fireEvent.click(byId('withdraw-submit'))
    await settle(300)
    expect(db.rpcCalls.map((c) => c.fn)).toContain('fn_request_withdrawal')
    expect(screenName()).toBe('intro')
    expect(sessionKeys(storage.m)).toEqual([])
    expect(callbackInbox.take()).toBeNull()
    expect(hasExchanged('good1')).toBe(false)

    await backToLoginScreen()
    await kakaoRoundTrip(bridge, 'good2')
    expect(screenName()).toBe('withdraw-cancel') // 유예 화면이 단계(메인)보다 먼저
    noFailure()

    fireEvent.click(byId('withdraw-cancel-button'))
    await settle(300)
    expect(screenName()).toBe('main')
    noFailure()
  })

  it('(3) 로그인 -> 앱 종료(메모리만 비움) -> 재실행 -> 메인(다시 로그인하지 않는다)', async () => {
    const storage = memStorage()
    plug(makeRealAuth(storage), serverWith())
    const bridge = makeFakeBridge()
    useSessionStore.getState().setExistingAccountPath(true)
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    await kakaoRoundTrip(bridge, 'good1')
    expect(screenName()).toBe('main')

    // 앱 종료 = 화면 · 메모리 전부 사라짐. 저장소(Preferences)만 남는다.
    cleanup()
    setSupabaseForTest(undefined)
    resetMemory()
    plug(makeRealAuth(storage), serverWith())
    render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
    await settle(6100)
    await settle(500)
    expect(screenName()).toBe('main')
    noFailure()
  })

  it('로그아웃 뒤 새 로그인에서 같은 앱 링크가 두 번 들어와도 한 번만 처리하고 메인으로 간다', async () => {
    const storage = memStorage()
    plug(makeRealAuth(storage), serverWith())
    const bridge = makeFakeBridge()
    useSessionStore.getState().setExistingAccountPath(true)
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    await kakaoRoundTrip(bridge, 'good1')
    await toSettingsProfile()
    fireEvent.click(byId('profile-logout'))
    await settle(200)
    await backToLoginScreen()
    fireEvent.click(screen.getByText('카카오로 시작하기'))
    await settle(10)
    act(() => {
      bridge.emitUrl('ondolog://auth/callback?code=good2')
      bridge.emitUrl('ondolog://auth/callback?code=good2')
    })
    await settle(80)
    expect(screenName()).toBe('main')
    noFailure()
  })
})

describe('③ D3 애착 이름 - 원래 이름은 화면에 없고 재프레이밍 이름이 보인다', () => {
  beforeEach(() => {
    class FakeObserver { observe() {} unobserve() {} disconnect() {} }
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver
  })
  const FORBIDDEN = ['안정형', '불안형', '회피형', '혼란형']
  const CASES: Array<[AttachmentType, string | null]> = [
    ['secure', null],
    ['anxious', '애틋함, 온 마음'],
    ['avoidant', '조용함, 자기 세계'],
    ['fearful', '파도, 밀물썰물'],
  ]

  it('표: 불안 -> 애틋함 · 회피 -> 조용함 · 혼란 -> 파도(MASTER 10-5-3), 안정은 표에 없어 이름을 보이지 않는다', () => {
    for (const [attachment, name] of CASES) expect(attachmentDisplayName(attachment)).toBe(name)
    expect(personalityMetaLine({ mbti: 'INFJ', core: 4, attachment: 'secure' })).toBe('INFJ · 애니어그램 4')
    expect(personalityMetaLine({ mbti: null, core: 4, attachment: 'anxious' })).toBe('애니어그램 4 · 애틋함, 온 마음')
  })

  function expectReframed(name: string | null) {
    const text = document.body.textContent ?? ''
    for (const w of FORBIDDEN) expect(text).not.toContain(w)
    if (name) expect(text).toContain(name)
    expect(text).not.toContain('undefined')
  }

  it.each(CASES)('성격 프로필(H05) · 결과 다시 보기(A14) · 온보딩 결과 상세: %s', async (attachment, name) => {
    const db = makeCoupleDb({
      profiles: [{ ...ME }, PARTNER],
      couples: [ACTIVE],
      extraTables: { personality_profiles: [{ ...PERSONALITY, attachment }], personality_assessments: [ASSESSMENT], couple_dissolutions: [] },
    })
    setSupabaseForTest(db.client)
    useAuthStore.getState().setUserId('me')

    render(<PersonalityScreen nav={makeFakeNav()} />)
    await settle()
    expect(byId('personality-meta').textContent).toContain('애니어그램 4')
    expectReframed(name)
    cleanup()

    render(<MemoryRouter initialEntries={['/settings-result']}><SettingsResultScreen nav={makeFakeNav()} /></MemoryRouter>)
    await settle()
    expect(screen.getByText('BIG FIVE')).toBeTruthy()
    expectReframed(name)
    cleanup()

    // 온보딩 결과 상세(A14)는 74-h2부터 서버에 저장된 검사를 읽는다(성격 프로필이 없으면 처음 한 번 만든다).
    const onboardingDb = makeCoupleDb({
      profiles: [{ ...ME, onboarding_step: 0 }],
      couples: [],
      extraTables: { personality_profiles: [], personality_assessments: [{ ...ASSESSMENT, enneagram_core: 4, attachment }], couple_dissolutions: [] },
    })
    setSupabaseForTest(onboardingDb.client)
    render(<MemoryRouter><ResultDetailScreen nav={makeFakeNav()} /></MemoryRouter>)
    await settle(1500)
    expectReframed(name)
  })
})

describe('⑤ 기존 계정 알림 - 3초 뒤 닫힘 · 탭 이동 시 닫힘 · 상단 안전 영역 아래', () => {
  async function loginExisting() {
    plug(makeRealAuth(memStorage()), serverWith())
    const bridge = makeFakeBridge()
    fillOnboardingAnswers()
    useSessionStore.getState().setExistingAccountPath(true)
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    await kakaoRoundTrip(bridge, 'good1')
    expect(screenName()).toBe('main')
  }

  it('로그인 직후 알림이 한 번 보이고, 약 3초 뒤 저절로 닫힌다', async () => {
    expect(NOTICE_MS).toBe(3000)
    await loginExisting()
    expect(screen.getAllByText(EXISTING_ACCOUNT_NOTICE)).toHaveLength(1)
    await settle(NOTICE_MS - 1500)
    expect(screen.queryByText(EXISTING_ACCOUNT_NOTICE)).not.toBeNull()
    await settle(1600)
    expect(screen.queryByText(EXISTING_ACCOUNT_NOTICE)).toBeNull()
  })

  it('탭을 옮기면 바로 닫힌다(3초를 기다리지 않는다)', async () => {
    await loginExisting()
    expect(screen.queryByText(EXISTING_ACCOUNT_NOTICE)).not.toBeNull()
    await settle(500)
    fireEvent.click(byId('tab-feed'))
    await settle(50)
    expect(screenName()).toBe('feed')
    expect(screen.queryByText(EXISTING_ACCOUNT_NOTICE)).toBeNull()
  })

  it('눌러도 닫힌다 · 알림 칸은 상단 안전 영역(--top) 아래에서 시작하는 작은 크기다', async () => {
    await loginExisting()
    fireEvent.click(screen.getByRole('status'))
    expect(screen.queryByText(EXISTING_ACCOUNT_NOTICE)).toBeNull()
    const css = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')
    const rule = css.match(/\.notice\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/top:\s*calc\(var\(--top\)\s*\+\s*\d+px\)/)
    expect(rule).toMatch(/font-size:\s*13px/)
  })
})
