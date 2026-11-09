/**
 * 설정 흐름 시험(앱 전체 단위) - 탈퇴 유예 판정(로그인 · 앱 시작) · 뒤로 가기 · 해제 알림 · 로그아웃(첫 화면 · 채팅 큐 유지) · RN이 부르던 함수만 부르는지.
 * 원본(행동 단언): `__tests__/hooks/resolveResumePath.test.ts` · `useDissolutionNotice.test.tsx` · `settingsCore.test.ts`(로그아웃) · `u7Dissolution.test.tsx`(유예 먼저).
 * 가짜 서버 + 가짜 다리 - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useRef } from 'react'
import { Preferences } from '@capacitor/preferences'
import App from '../../App'
import { setSupabaseForTest, type WebSupabase } from '../../auth/client'
import { finalizeAfterLogin, resolveWebRoute } from '../../auth/finalize'
import { useAuthStore } from '../../auth/stores'
import { NAV_COOLDOWN_MS, useAppNav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useToastStore } from '../../stores/toastStore'
import { useSessionStore } from '@/store/sessionStore'
import { makeFakeBridge, makeFakeNav } from '../../testSupport'
import type { FakeRow } from '../../testSupportCouple'
import { logoutToStart } from './accountActions'
import {
  DISSOLUTION_BY_ME, DISSOLUTION_BY_PARTNER, DISSOLVING, FORBIDDEN_RPC, ME, NOW, settingsDb, type SettingsDbOptions,
} from './settingsTestSupport'
import { resetSettingsSummaryCache } from './useSettingsSummary'
import { useDissolutionNotice } from './useDissolutionNotice'

// Preferences(로그인 세션 · 채팅 큐 저장소)는 메모리로 바꾼다.
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
const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const byId = (id: string) => screen.getByTestId(id)
const PENDING: FakeRow = { ...ME, deleted_at: '2025-10-19T00:00:00+09:00', purge_scheduled_at: '2025-10-26T00:00:00+09:00' }
const ALLOWED_RPC = ['fn_request_dissolution', 'fn_cancel_dissolution', 'fn_request_withdrawal', 'fn_cancel_withdrawal', 'fn_complete_retest']

async function startApp(opts: SettingsDbOptions = {}, bridge = makeFakeBridge()) {
  const db = settingsDb(opts)
  render(<App bridge={bridge} initialPath="/intro" />)
  await settle(6100)
  return { db, bridge }
}

// ───────────────────────────── 탈퇴 유예가 먼저 ─────────────────────────────

describe('탈퇴 유예 계정은 단계보다 먼저 유예 화면(withdraw-cancel)', () => {
  it('resolveWebRoute: 유예 시각이 있으면 어떤 진행 단계여도 withdraw-cancel, 없으면 RN 단계 판정 그대로', async () => {
    const db = settingsDb()
    const client = db.client as WebSupabase
    for (const step of [0, 1, 2, 3]) {
      expect(await resolveWebRoute(client, 'me', step, '2025-10-19T00:00:00+09:00')).toBe('withdraw-cancel')
    }
    expect(await resolveWebRoute(client, 'me', 0)).toBe('detail')
    expect(await resolveWebRoute(client, 'me', 1)).toBe('invite')
    expect(await resolveWebRoute(client, 'me', 3, null)).toBe('main')
  })

  it('유예 판정은 서버를 더 부르지 않는다(이미 읽은 프로필 값으로 판정)', async () => {
    const db = settingsDb()
    const from = vi.spyOn(db.client, 'from')
    await resolveWebRoute(db.client as WebSupabase, 'me', 2, '2025-10-19T00:00:00+09:00')
    expect(from).not.toHaveBeenCalled()
  })

  it('앱을 켤 때: 저장된 로그인 + 유예 계정이면 메인이 아니라 유예 화면이 먼저다', async () => {
    await startApp({ profiles: [PENDING] })
    expect(screenName()).toBe('withdraw-cancel')
    expect(byId('withdraw-days').textContent).toBe('5일')
    expect(screen.queryByTestId('tab-bar')).toBeNull()
  })

  it('앱을 켤 때: 유예가 아니면 평소대로 메인', async () => {
    await startApp()
    expect(screenName()).toBe('main')
  })

  it('로그인 직후(기존 계정): 가입 저장 경로를 부르지 않고 유예 시각을 알려 주어 유예 화면으로 간다', async () => {
    const db = settingsDb({ profiles: [PENDING] })
    const outcome = await finalizeAfterLogin(db.client as WebSupabase, 'me', useSessionStore.getState())
    expect(outcome).toMatchObject({ kind: 'existing', step: 3, deletedAt: '2025-10-19T00:00:00+09:00' })
    expect(db.writes).toEqual([])
  })

  it('뒤로 가기: 유예 화면에서 하드웨어 뒤로 = 앱 종료(RN 루트 화면), 화면의 ← 는 로그아웃', async () => {
    const { bridge, db } = await startApp({ profiles: [PENDING] })
    act(() => bridge.emitBack())
    expect(bridge.exitApp).toHaveBeenCalledTimes(1)
    expect(screenName()).toBe('withdraw-cancel')
    fireEvent.click(screen.getByLabelText('뒤로'))
    await settle()
    expect(db.signOutCalls.length).toBe(1)
    expect(screenName()).toBe('intro')
  })

  it('탈퇴를 취소하면 토스트 "탈퇴를 취소했어요"와 함께 원래 단계(메인)로 돌아간다', async () => {
    const db = settingsDb({
      profiles: [PENDING],
      rpc: () => {
        db.tables.profiles[0].deleted_at = null
        db.tables.profiles[0].purge_scheduled_at = null
        return { data: null, error: null }
      },
    })
    render(<App bridge={makeFakeBridge()} initialPath="/intro" />)
    await settle(6100)
    fireEvent.click(byId('withdraw-cancel-button'))
    await settle()
    // 메인 화면이 읽는 진행률 함수(fn_issue_progress)는 이 시험의 관심 밖 - 해제 · 탈퇴 함수만 본다.
    expect(db.rpcCalls.map((c) => c.fn).filter((n) => /dissolution|withdrawal/.test(n))).toEqual(['fn_cancel_withdrawal'])
    expect(screenName()).toBe('main')
    expect(useToastStore.getState().toast?.message).toBe('탈퇴를 취소했어요')
    expect(byId('toast-message').textContent).toBe('탈퇴를 취소했어요')
  })
})

// ───────────────────────────── 설정 안 이동 · 뒤로 가기 ─────────────────────────────

describe('설정 탭과 하위 화면 이동', () => {
  it('설정 탭 -> 프로필 -> 탈퇴: 뒤로 가기는 한 단계씩 앞 화면으로, 탭에서는 메인으로', async () => {
    const { bridge } = await startApp()
    fireEvent.click(byId('tab-settings'))
    expect(screenName()).toBe('settings')
    await settle(NAV_COOLDOWN_MS)
    fireEvent.click(byId('settings-row-profile'))
    expect(screenName()).toBe('settings-profile')
    expect(screen.queryByTestId('tab-bar')).toBeNull()
    await settle(NAV_COOLDOWN_MS)
    await settle()
    fireEvent.click(byId('profile-withdraw'))
    expect(screenName()).toBe('settings-withdraw')
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(screenName()).toBe('settings-profile')
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(screenName()).toBe('settings')
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(screenName()).toBe('main')
    expect(bridge.exitApp).not.toHaveBeenCalled()
  })

  it('열려 있는 확인 시트(H06)가 있으면 하드웨어 뒤로 가기는 시트만 닫는다', async () => {
    const { bridge } = await startApp()
    fireEvent.click(byId('tab-settings'))
    await settle(NAV_COOLDOWN_MS)
    fireEvent.click(byId('settings-row-personality'))
    await settle(NAV_COOLDOWN_MS)
    await settle()
    fireEvent.click(byId('personality-row-retest'))
    expect(byId('retest-confirm')).toBeTruthy()
    act(() => bridge.emitBack())
    await settle(400)
    expect(screen.queryByTestId('retest-confirm')).toBeNull()
    expect(screenName()).toBe('settings-personality')
  })

  it('H05 -> 재검사(retest)에서 하드웨어 뒤로 가기는 MBTI 단계에서 H05로 돌아간다(한 경로 안의 단계)', async () => {
    const { bridge } = await startApp()
    fireEvent.click(byId('tab-settings'))
    await settle(NAV_COOLDOWN_MS)
    fireEvent.click(byId('settings-row-personality'))
    await settle(NAV_COOLDOWN_MS)
    await settle()
    fireEvent.click(byId('personality-row-retest'))
    fireEvent.click(byId('retest-confirm-yes'))
    expect(screenName()).toBe('retest')
    await settle(NAV_COOLDOWN_MS)
    act(() => bridge.emitBack())
    expect(screenName()).toBe('settings-personality')
  })

  it('연인 줄을 누르면 커플 화면, 미연결이면 잠긴 문(I01)이 보인다(5개 탭 모두 보인 채)', async () => {
    await startApp({ couples: [] })
    fireEvent.click(byId('tab-settings'))
    await settle(NAV_COOLDOWN_MS)
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    fireEvent.click(byId('settings-row-partner'))
    expect(screenName()).toBe('settings-couple')
    await settle()
    expect(byId('couple-needed')).toBeTruthy()
  })
})

// ───────────────────────────── 해제 알림 ─────────────────────────────

describe('상대의 해제 알림(앱 안 표시뿐)', () => {
  function Probe({ nav, enabled }: { nav: ReturnType<typeof makeFakeNav>; enabled: boolean }) {
    useDissolutionNotice(nav, enabled)
    return null
  }
  const visible = () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('상대가 해제를 요청했으면 앱에 들어올 때 처음 한 번 커플 화면(유예 화면)을 연다', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_PARTNER] })
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith('settings-couple', { urgent: true })
  })

  it('같은 해제 요청은 앱을 켠 동안 한 번만 연다(복귀할 때마다 다시 띄우지 않는다)', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_PARTNER] })
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    visible()
    await settle()
    visible()
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('내가 개시자면 열지 않는다(스스로 한 일)', async () => {
    settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_ME] })
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('해제 요청이 없으면 열지 않는다 · 탭 화면이 아니면(enabled = false) 읽지도 않는다', async () => {
    const db = settingsDb()
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    const view = render(<Probe nav={nav} enabled />)
    await settle()
    expect(nav.push).not.toHaveBeenCalled()
    view.unmount()
    const from = vi.spyOn(db.client, 'from')
    render(<Probe nav={nav} enabled={false} />)
    await settle()
    expect(from).not.toHaveBeenCalled()
  })

  it('읽기가 실패해도 조용히 넘어간다(화면을 열지 않고 오류를 내지 않는다)', async () => {
    const db = settingsDb({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_PARTNER], failCoupleReads: true })
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    render(<Probe nav={nav} enabled />)
    await settle()
    expect(nav.push).not.toHaveBeenCalled()
    expect(db.writes).toEqual([])
  })

  it('앱 전체: 상대가 해제를 요청했으면 로그인 뒤 메인에서 곧바로 유예 화면(상대 쪽, 취소 버튼 없음)이 한 번 뜬다', async () => {
    await startApp({ couples: [DISSOLVING], dissolutions: [DISSOLUTION_BY_PARTNER] })
    expect(screenName()).toBe('settings-couple')
    expect(byId('grace-days').textContent).toBe('5일')
    expect(screen.queryByText('해제 취소하기')).toBeNull()
    expect(byId('grace-cancel-reason')).toBeTruthy()
  })
})

// ───────────────────────────── 로그아웃 ─────────────────────────────

describe('로그아웃', () => {
  it('세션을 끝내고 첫 화면으로 간다 - 그 사용자의 채팅 큐(글 · 사진)는 기기에 그대로 남는다(R39-5 b)', async () => {
    const db = settingsDb()
    await Preferences.set({ key: 'chat_queue:c1', value: '[{"id":"q1"}]' })
    await Preferences.set({ key: 'chat_photo_queue:c1:me', value: '[{"id":"p1"}]' })
    useAuthStore.getState().setUserId('me')
    const nav = makeFakeNav()
    await logoutToStart(nav)
    expect(db.signOutCalls.length).toBe(1)
    expect(nav.reset).toHaveBeenCalledWith('intro')
    expect(memory.get('chat_queue:c1')).toBe('[{"id":"q1"}]')
    expect(memory.get('chat_photo_queue:c1:me')).toBe('[{"id":"p1"}]')
    expect(Preferences.remove).not.toHaveBeenCalled()
  })

  it('앱 전체: 프로필에서 로그아웃하면 첫 화면이고 탭 바가 사라진다', async () => {
    const { db } = await startApp()
    fireEvent.click(byId('tab-settings'))
    await settle(NAV_COOLDOWN_MS)
    fireEvent.click(byId('settings-row-profile'))
    await settle(NAV_COOLDOWN_MS)
    await settle()
    fireEvent.click(byId('profile-logout'))
    await settle()
    expect(db.signOutCalls.length).toBe(1)
    expect(screenName()).toBe('intro')
    expect(screen.queryByTestId('tab-bar')).toBeNull()
    expect(useAuthStore.getState().userId).toBeNull()
    expect(useDissolutionStore.getState().status).toBe('unknown')
  })

  it('로그아웃으로 첫 화면에 돌아오면 계정 잠금이 풀린다 - 다시 가입하는 온보딩에서 뒤로 가기가 앱 종료로 막히지 않는다', () => {
    function Harness({ onNav }: { onNav: (n: ReturnType<typeof useAppNav>) => void }) {
      const n = useAppNav()
      const loc = useLocation()
      const ref = useRef(n)
      ref.current = n
      onNav(n)
      return <span data-testid="at">{loc.pathname}</span>
    }
    let nav!: ReturnType<typeof useAppNav>
    render(<MemoryRouter initialEntries={['/intro']}><Harness onNav={(n) => { nav = n }} /></MemoryRouter>)
    act(() => { nav.nav.enterAccount('main') })
    act(() => { vi.advanceTimersByTime(NAV_COOLDOWN_MS) })
    act(() => { nav.nav.push('basic') }) // 계정이 있는 동안 온보딩 화면의 뒤로 가기는 종료
    expect(nav.canGoBack()).toBe(false)
    act(() => { nav.nav.reset('intro') }) // 로그아웃
    act(() => { vi.advanceTimersByTime(NAV_COOLDOWN_MS) })
    act(() => { nav.nav.push('basic') })
    expect(nav.canGoBack()).toBe(true)
    act(() => { vi.advanceTimersByTime(NAV_COOLDOWN_MS) })
    act(() => { nav.nav.back() })
    expect(screen.getByTestId('at').textContent).toBe('/intro')
  })
})

// ───────────────────────────── 실행 함수 호출 0 (R34-3) ─────────────────────────────

describe('R34-3 - 해제 · 탈퇴는 RN이 부르던 요청/취소 함수만', () => {
  it('설정의 모든 서버 호출을 한 번씩 지나가도 부른 함수는 요청 · 취소 · 재검사 완료뿐이고 실행 함수는 한 번도 없다', async () => {
    const results: Record<string, unknown> = {
      fn_request_dissolution: 'd9',
      fn_request_withdrawal: '2025-10-28T00:00:00+09:00',
      fn_cancel_withdrawal: null,
      fn_cancel_dissolution: null,
      fn_complete_retest: [{ out_assessment_id: 'a2', out_recovered: false }],
    }
    const db = settingsDb({ rpc: (fn) => ({ data: results[fn] ?? null, error: null }) })
    // 요청 두 개 + 취소 두 개 + 재검사를 각각 부른다.
    const { requestDissolution, requestWithdrawal, cancelDissolution, cancelWithdrawal } = await import('@/services/dissolutionCore')
    const { retestPersonality } = await import('@/services/settingsCore')
    const dissolutionDb = db.client as unknown as Parameters<typeof requestDissolution>[0]
    await requestDissolution(dissolutionDb)
    await cancelDissolution(dissolutionDb, 'd9')
    await requestWithdrawal(dissolutionDb)
    await cancelWithdrawal(dissolutionDb)
    useSessionStore.getState().setMbtiSelfReported('ENFP')
    ;(['A', 'B', 'A', 'B', 'A'] as const).forEach((c, i) => useSessionStore.getState().setQuizAnswer((i + 1) as 1 | 2 | 3 | 4 | 5, c))
    useSessionStore.getState().computeResult()
    const s = useSessionStore.getState()
    await retestPersonality(db.client as never, 'me', { mbti: s.mbti!, mbtiSelfReported: s.mbtiSelfReported, q1: s.q1!, q2: s.q2!, q3: s.q3!, q4: s.q4!, q5: s.q5!, result: s.result! })
    const names = db.rpcCalls.map((c) => c.fn)
    expect(names).toEqual(['fn_request_dissolution', 'fn_cancel_dissolution', 'fn_request_withdrawal', 'fn_cancel_withdrawal', 'fn_complete_retest'])
    for (const n of names) {
      expect(ALLOWED_RPC).toContain(n)
      expect(FORBIDDEN_RPC).not.toContain(n)
    }
    // 어느 것도 해제 · 탈퇴 칸을 직접 쓰지 않았다.
    expect(db.writes).toEqual([])
  })
})
