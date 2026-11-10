/**
 * 74-h2 시험: ⓪ 새 계정 첫 로그인 뒤 빈 화면 · 상태표(서버 상태 조합 x 로그인 직후/재실행) · ① 앱 링크 리스너/세션 안전장치/진단 표시 · ③ 키보드 시험 · ⑤ 애착 네 값.
 * 서버는 메모리 가짜(`makeCoupleDb`) - 주소 · 키 · 이메일 없음. 로그인은 가짜 클라이언트의 코드 교환(앱 링크 -> 콜백 화면)을 그대로 지난다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { setSupabaseForTest } from './auth/client'
import { resetCallbackStateForTest } from './auth/callback'
import { useAuthStore, useNoticeStore } from './auth/stores'
import { attachmentDisplayName } from './attachmentNames'
import { KeyboardTestScreen } from './features/settings/KeyboardTestScreen'
import { ACTIVE, ASSESSMENT, ME, PARTNER, PERSONALITY } from './features/settings/settingsTestSupport'
import { forgetLibrary } from './features/magazine/libraryData'
import { resetSettingsSummaryCache } from './features/settings/useSettingsSummary'
import { ROUTE_ELEMENTS } from './app/routeTable'
import { IS_TRIAL_BUILD } from './config/env'
import { useTrialDiag, useListenerCount } from './platform/trialDiag'
import { useAccountProblemStore } from './stores/accountProblemStore'
import { useCoupleStore } from './stores/coupleStore'
import { useDissolutionStore } from './stores/dissolutionStore'
import { useProfileStore } from './stores/profileStore'
import { useSheetStore } from './stores/sheetStore'
import { fillOnboardingAnswers, makeFakeBridge, makeFakeNav } from './testSupport'
import { makeCoupleDb, type FakeRow } from './testSupportCouple'
import { ATTACHMENT_REFRAME_KO } from '@/constants/attachmentDisplay'
import { useSessionStore } from '@/store/sessionStore'

class FakeObserver { observe() {} unobserve() {} disconnect() {} }

async function settle(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const problemShown = () => document.querySelector('[data-testid="account-problem"]') !== null

function resetMemory() {
  resetCallbackStateForTest()
  useAuthStore.getState().setUserId(null)
  useNoticeStore.getState().clear()
  useSessionStore.getState().resetSession()
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useDissolutionStore.getState().reset()
  useSheetStore.getState().closeAll()
  useAccountProblemStore.getState().clear()
  useTrialDiag.getState().clear()
  resetSettingsSummaryCache()
  forgetLibrary()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-10-21T12:00:00+09:00'))
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver
  resetMemory()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  vi.useRealTimers()
})

/* -- 서버 상태 ------------------------------------------------------------ */
const A = { ...ASSESSMENT, enneagram_core: 4, attachment: 'secure' } as FakeRow
interface Server { profile: FakeRow | null; assessment: boolean; personality: boolean; couples: FakeRow[] }
/** `profilesReadError`가 켜져 있는 동안 profiles 읽기가 오류로 끝난다. 끄면(`readFailure.on = false`) 같은 클라이언트가 정상으로 돌아온다. */
const readFailure = { on: false }
function serverOf(s: Server, opts: { session: boolean; profilesReadError?: boolean }) {
  readFailure.on = !!opts.profilesReadError
  const db = makeCoupleDb({
    profiles: s.profile ? [s.profile, PARTNER] : [PARTNER],
    couples: s.couples,
    session: opts.session ? { user: { id: 'me', app_metadata: { provider: 'kakao' } } } : null,
    extraTables: {
      personality_profiles: s.personality ? [{ ...PERSONALITY, attachment: 'secure' }] : [],
      personality_assessments: s.assessment ? [A] : [],
      couple_dissolutions: [],
    },
  })
  const client = db.client as unknown as { from: (t: string) => unknown }
  const real = client.from
  const failing: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'order', 'limit', 'in', 'is', 'or']) failing[k] = () => failing
  failing.maybeSingle = async () => ({ data: null, error: { code: 'XX000' } })
  client.from = (t: string) => (t === 'profiles' && readFailure.on ? failing : real(t))
  setSupabaseForTest(db.client)
  return db
}
const PENDING = { id: 'c9', user_a_id: 'me', user_b_id: null, status: 'pending', relationship_start_date: null, invite_code: 'AB23CD' } as FakeRow
const ACTIVE_NO_DATE = { ...ACTIVE, relationship_start_date: null } as FakeRow
const me = (extra: FakeRow): FakeRow => ({ ...ME, ...extra })

/** [이름, 서버, 재실행에서 가는 화면, 로그인 직후(메모리 답 없음 = 기존 계정 길)에서 가는 화면] */
const TABLE: Array<[string, Server, string, string]> = [
  ['프로필 있음 · 검사 없음(저장이 중간에 끊김)', { profile: me({ onboarding_step: 0 }), assessment: false, personality: false, couples: [] }, 'detail', 'detail'],
  ['프로필 + 검사, 성격 프로필 없음(Proteur 미리 보기)', { profile: me({ onboarding_step: 0 }), assessment: true, personality: false, couples: [] }, 'detail', 'detail'],
  ['프로필 + 검사 + 성격 프로필(단계 1)', { profile: me({ onboarding_step: 1 }), assessment: true, personality: true, couples: [] }, 'invite', 'invite'],
  ['pending 커플(단계 1)', { profile: me({ onboarding_step: 1 }), assessment: true, personality: true, couples: [PENDING] }, 'invite', 'invite'],
  ['active 커플, 사귄 날짜 없음(단계 2)', { profile: me({ onboarding_step: 2 }), assessment: true, personality: true, couples: [ACTIVE_NO_DATE] }, 'start-date', 'start-date'],
  ['active 커플(단계 3)', { profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }, 'main', 'main'],
  ['탈퇴 유예', { profile: me({ onboarding_step: 3, deleted_at: '2025-10-20T00:00:00+09:00', purge_scheduled_at: '2025-10-27T00:00:00+09:00' }), assessment: true, personality: true, couples: [ACTIVE] }, 'withdraw-cancel', 'withdraw-cancel'],
]

/** 빈 화면이 아니다: 화면 이름이 있고 안에 글자가 있다(안내 화면 포함). */
function expectNotBlank() {
  const el = document.querySelector('[data-screen]')
  expect(el, '화면 틀').not.toBeNull()
  expect((el!.textContent ?? '').trim().length, `${screenName()}에 글자가 없다(빈 화면)`).toBeGreaterThan(0)
}

async function rerun(server: Server, extra: { profilesReadError?: boolean } = {}) {
  const db = serverOf(server, { session: true, ...extra })
  render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
  await settle(6100)
  await settle(800)
  return db
}
async function loginRightAfter(server: Server, opts: { answers?: boolean; profilesReadError?: boolean } = {}) {
  const db = serverOf(server, { session: false, ...opts })
  if (opts.answers) fillOnboardingAnswers()
  else useSessionStore.getState().setExistingAccountPath(true)
  const bridge = makeFakeBridge()
  render(<App bridge={bridge} initialPath="/auth" />)
  await settle(6100)
  act(() => bridge.emitUrl('ondolog://auth/callback?code=c1'))
  await settle(1500)
  return { db, bridge }
}

describe('0 상태표 - 세션이 있을 때 서버 상태 조합 x (재실행 · 로그인 직후): 어느 화면으로 가고, 빈 화면은 0', () => {
  it.each(TABLE)('%s', async (_name, server, afterRerun, afterLogin) => {
    await rerun(server)
    expect(screenName()).toBe(afterRerun)
    expectNotBlank()
    cleanup(); setSupabaseForTest(undefined); resetMemory()
    await loginRightAfter(server)
    expect(screenName()).toBe(afterLogin)
    expectNotBlank()
  })

  it('프로필 없음: 재실행 = 첫 화면(온보딩부터) · 로그인 직후 = 방금 본 결과 저장 후 결과 상세(Proteur 새 계정)', async () => {
    const none: Server = { profile: null, assessment: false, personality: false, couples: [] }
    await rerun(none)
    expect(screenName()).toBe('intro')
    expectNotBlank()
    cleanup(); setSupabaseForTest(undefined); resetMemory()

    const { db } = await loginRightAfter(none, { answers: true })
    expect(screenName()).toBe('detail')
    expect(document.querySelector('[data-testid="detail-loading"]')).toBeNull() // 로딩에서 멈추지 않는다
    expect(screen.getByText('BIG FIVE')).toBeTruthy() // 서버에 저장된 결과를 그린다(메모리를 비운 뒤에도)
    expectNotBlank()
    // 성격 프로필을 이 화면이 처음 한 번 만들고, 만들었을 때 진행 단계를 RESULT(1)로 올린다.
    expect(db.writes.filter((w) => w.table === 'personality_profiles' && w.op === 'insert')).toHaveLength(1)
    const stepWrites = db.writes.filter((w) => w.table === 'profiles' && w.op === 'update' && w.payload.onboarding_step === 1)
    expect(stepWrites).toHaveLength(1)
  })

  it('Proteur 케이스(프로필 + 검사, 성격 프로필 0): 결과 상세가 서버 검사로 그려지고 성격 프로필 1 · 단계 1이 남는다 · 재실행하면 초대로 가고 더 만들지 않는다', async () => {
    const server: Server = { profile: me({ onboarding_step: 0 }), assessment: true, personality: false, couples: [] }
    const db = await rerun(server)
    expect(screenName()).toBe('detail')
    expect(screen.getByText('BIG FIVE')).toBeTruthy()
    expect(db.tables.personality_profiles).toHaveLength(1)
    expect(db.tables.profiles.find((p) => p.id === 'me')!.onboarding_step).toBe(1)
    cleanup(); useAccountProblemStore.getState().clear()
    // 앱을 다시 켠다(서버 상태는 그대로): 이제 단계 1 -> 초대. 성격 프로필은 더 만들지 않는다.
    render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
    await settle(6100); await settle(800)
    expect(screenName()).toBe('invite')
    expect(db.tables.personality_profiles).toHaveLength(1)
  })

  it('조회 오류(재실행): 첫 화면으로 조용히 가지 않고 안내 화면([다시 시도] · [로그아웃]) · 시험 빌드에는 단계 이름이 보인다', async () => {
    await rerun({ profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }, { profilesReadError: true })
    expect(problemShown()).toBe(true)
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeTruthy()
    expect(IS_TRIAL_BUILD).toBe(true)
    expect(screen.getByTestId('trial-diag').textContent).toContain('상태 읽기')
    expect(screen.getByTestId('trial-diag').textContent).not.toMatch(/https?:|@|eyJ/)
    expectNotBlank()
  })

  it('조회 오류 뒤 [다시 시도]가 성공하면 서버 진행 단계 화면으로 간다', async () => {
    const server: Server = { profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }
    await rerun(server, { profilesReadError: true })
    expect(problemShown()).toBe(true)
    readFailure.on = false // 서버가 다시 정상
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await settle(800)
    expect(problemShown()).toBe(false)
    expect(screenName()).toBe('main')
  })

  it('조회 오류(로그인 직후): 콜백 화면에 [다시 시도] · [로그아웃]이 있고 빈 화면이 아니다', async () => {
    await loginRightAfter({ profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }, { profilesReadError: true })
    expect(screenName()).toBe('callback')
    expect(screen.getByText('저장하지 못했어요. 다시 시도해주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeTruthy()
    expect(screen.getByTestId('trial-diag').textContent).toContain('계정 마무리')
    expectNotBlank()
  })

  it('A14: 검사가 없는 단계 0 계정은 빈 화면이 아니라 안내 화면, [로그아웃]은 첫 화면으로', async () => {
    await rerun({ profile: me({ onboarding_step: 0 }), assessment: false, personality: false, couples: [] })
    expect(screenName()).toBe('detail')
    expect(problemShown()).toBe(true)
    expect(screen.getByTestId('trial-diag').textContent).toContain('no_assessment')
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    await settle(300)
    expect(screenName()).toBe('intro')
  })

  it('A16 코어 고치기: 정본 overrideEnneagramCore로 서버에 저장하고(override · count) 화면으로 돌아온다', async () => {
    const db = await rerun({ profile: me({ onboarding_step: 0 }), assessment: true, personality: false, couples: [] })
    await settle(3600)
    db.tables.personality_profiles[0].override_count = 0 // (가짜 서버는 DB 기본값 0을 채우지 않는다)
    fireEvent.click(screen.getByText('결과와 달라요 →'))
    await settle(50)
    fireEvent.click(screen.getByTestId('core-7'))
    fireEvent.click(screen.getByText('이 코어로 할게요'))
    await settle(100)
    const row = db.tables.personality_profiles[0]
    expect(row.enneagram_override).toBe(7)
    expect(row.override_count).toBe(1)
    expect(row.enneagram_inferred).toBe(4) // 원본 추론값은 그대로
    expect(screen.getByText('BIG FIVE')).toBeTruthy()
  })
})

describe('1 앱 링크 리스너 · 실패 화면 안전장치 · 진단 표시', () => {
  function countingBridge() {
    const bridge = makeFakeBridge()
    const real = bridge.onAppUrlOpen
    const stats = { registered: 0, removed: 0 }
    bridge.onAppUrlOpen = (cb) => {
      stats.registered += 1
      const off = real(cb)
      return () => { stats.removed += 1; off() }
    }
    return { bridge, stats }
  }

  it('b-1 리스너는 앱 생애에 한 번만 등록된다 - 화면을 여러 번 옮겨도 등록 1 · 해제 0, 살아 있는 리스너는 늘 1', async () => {
    const { bridge, stats } = countingBridge()
    const before = useListenerCount.getState().n
    render(<App bridge={bridge} initialPath="/intro" />)
    await settle(6100) // 하늘 준비(최대 6초)
    await settle(5500) // 첫 화면 연출(5.3초) 뒤에 [이미 계정이 있어요]가 나온다
    expect(stats.registered).toBe(1)
    fireEvent.click(screen.getByText('이미 계정이 있어요'))
    await settle(500)
    expect(screenName()).toBe('auth')
    act(() => bridge.emitBack())
    await settle(500)
    fireEvent.click(screen.getByText('이미 계정이 있어요'))
    await settle(500)
    expect(stats).toEqual({ registered: 1, removed: 0 })
    expect(useListenerCount.getState().n - before).toBe(1)
  })

  it('b-3 같은 코드가 두 번 와도 교환 1 · 실패 화면 0', async () => {
    const db = serverOf({ profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }, { session: false })
    const exchange = vi.spyOn(db.client.auth, 'exchangeCodeForSession')
    useSessionStore.getState().setExistingAccountPath(true)
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    act(() => { bridge.emitUrl('ondolog://auth/callback?code=dup1'); bridge.emitUrl('ondolog://auth/callback?code=dup1') })
    await settle(1500)
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(screenName()).toBe('main')
    expect(document.body.textContent).not.toContain('로그인하지 못했어요')
  })

  it('a 교환이 실패로 돌아와도 세션이 유효하면 실패 화면 없이 정상 흐름(세션 교환은 됐는데 화면만 실패로 덮이던 D1)', async () => {
    const db = serverOf({ profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }, { session: false })
    const auth = db.client.auth as unknown as { exchangeCodeForSession: unknown; getSession: unknown }
    auth.exchangeCodeForSession = async () => ({ data: { session: null }, error: { code: 'flow_state_not_found', message: 'x' } })
    auth.getSession = async () => ({ data: { session: { user: { id: 'me' } } }, error: null }) // 다른 경로가 이미 세션을 만들었다
    useSessionStore.getState().setExistingAccountPath(true)
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    act(() => bridge.emitUrl('ondolog://auth/callback?code=late1'))
    await settle(1500)
    expect(document.body.textContent).not.toContain('로그인하지 못했어요')
    expect(screenName()).toBe('main')
  })

  it('a 이미 성공한 로그인 위에 오류 링크가 두 번째 콜백 화면을 열어도 실패 화면이 덮지 않는다', async () => {
    const db = serverOf({ profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }, { session: false })
    let signedIn = false
    const auth = db.client.auth as unknown as { exchangeCodeForSession: unknown; getSession: unknown }
    auth.exchangeCodeForSession = async () => { signedIn = true; return { data: { session: { user: { id: 'me' } } }, error: null } }
    auth.getSession = async () => ({ data: { session: signedIn ? { user: { id: 'me' } } : null }, error: null })
    useSessionStore.getState().setExistingAccountPath(true)
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    act(() => bridge.emitUrl('ondolog://auth/callback?code=ok1'))
    act(() => bridge.emitUrl('ondolog://auth/callback?error=access_denied')) // 콜백 화면이 바뀌어 다시 열리고 칸에는 오류만 있다
    await settle(1500)
    expect(document.body.textContent).not.toContain('로그인하지 못했어요')
    expect(screenName()).toBe('main')
  })

  it('세션이 없을 때만 실패 화면이고, 실패 화면이 떠 있는 동안 세션이 생기면 정상 흐름으로 넘어간다', async () => {
    const db = serverOf({ profile: me({ onboarding_step: 3 }), assessment: true, personality: true, couples: [ACTIVE] }, { session: false })
    const handlers: Array<(e: string, s: { user: { id: string } } | null) => void> = []
    const auth = db.client.auth as unknown as Record<string, unknown>
    auth.exchangeCodeForSession = async () => ({ data: { session: null }, error: { code: 'flow_state_not_found', message: 'x' } })
    auth.onAuthStateChange = (cb: (e: string, s: { user: { id: string } } | null) => void) => {
      handlers.push(cb)
      return { data: { subscription: { unsubscribe: () => { handlers.splice(handlers.indexOf(cb), 1) } } } }
    }
    useSessionStore.getState().setExistingAccountPath(true)
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/auth" />)
    await settle(6100)
    act(() => bridge.emitUrl('ondolog://auth/callback?code=bad1'))
    await settle(300)
    expect(screenName()).toBe('callback')
    expect(screen.getByText('로그인하지 못했어요')).toBeTruthy()
    // 시험 빌드 진단: 단계 이름 · 분류 · 접수 순번만(코드 · 주소 0)
    const diag = screen.getByTestId('trial-diag').textContent ?? ''
    expect(diag).toContain('코드 교환')
    expect(diag).toContain('flow_state_not_found')
    expect(diag).toContain('#1')
    expect(diag).not.toContain('bad1')
    // 세션이 뒤늦게 생긴다
    await act(async () => { handlers.forEach((h) => h('SIGNED_IN', { user: { id: 'me' } })); await vi.advanceTimersByTimeAsync(1500) })
    expect(document.body.textContent).not.toContain('로그인하지 못했어요')
    expect(screenName()).toBe('main')
  })
})

describe('3 키보드 시험 · 코드 칸', () => {
  it('시험 빌드(시험)에서 화면이 있다 - 네 칸 조합은 email(inputMode) · url · email · url(inputMode), 모두 자동 대문자 · 고침 끔', () => {
    expect(ROUTE_ELEMENTS['keyboard-test']({ nav: makeFakeNav(), bridge: makeFakeBridge(), ready: true, onPhase: () => {} })).not.toBeNull()
    render(<MemoryRouter><KeyboardTestScreen nav={makeFakeNav()} /></MemoryRouter>)
    const el = (n: number) => screen.getByTestId(`kb-field-${n}`)
    expect([el(1).getAttribute('type'), el(1).getAttribute('inputmode')]).toEqual(['text', 'email'])
    expect([el(2).getAttribute('type'), el(2).getAttribute('inputmode')]).toEqual(['url', null])
    expect([el(3).getAttribute('type'), el(3).getAttribute('inputmode')]).toEqual(['email', null])
    expect([el(4).getAttribute('type'), el(4).getAttribute('inputmode')]).toEqual(['text', 'url'])
    for (const n of [1, 2, 3, 4]) {
      expect(el(n).getAttribute('autocapitalize')).toBe('none')
      expect(el(n).getAttribute('autocorrect')).toBe('off')
      expect(el(n).getAttribute('autocomplete')).toBe('off')
      expect(el(n).getAttribute('spellcheck')).toBe('false')
    }
    expect(screen.getByText('영문으로 바꿔 입력해 주세요')).toBeTruthy()
  })
})

describe('5 애착 표시 이름 - 웹이 정본 표를 그대로 읽는다', () => {
  it('네 값 모두 정본 표와 같고(안정은 null = 이름 칸 없음), 원래 이름은 표시 이름이 아니다', () => {
    for (const k of ['secure', 'anxious', 'avoidant', 'fearful'] as const) {
      expect(attachmentDisplayName(k)).toBe(ATTACHMENT_REFRAME_KO[k])
    }
    expect(attachmentDisplayName('secure')).toBeNull()
    expect((['anxious', 'avoidant', 'fearful'] as const).map((k) => attachmentDisplayName(k))).toEqual(['애틋함, 온 마음', '조용함, 자기 세계', '파도, 밀물썰물'])
  })
})
