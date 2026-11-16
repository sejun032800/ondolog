/**
 * 78- 푸시(앱) 시험 - 가짜 플러그인 다리(`setPushPortForTest`) + 가짜 서버(`settingsDb`). 실제 토큰 · 키 · 주소 0.
 * 권한 흐름 3갈래(허용 · 거부 · 나중에) · I08 한 번 · Android 10(처음부터 허용) 바로 등록 · 토큰 저장 · 갱신 ·
 * 삭제 규칙 5자리(로그아웃 · 탈퇴 요청 · 해제 요청 · 해제 유예/완료 · 계정 전환) · 앞에 있을 때 띠 · 보고 있는 채팅이면 0 · 누름 이동 2가지 ·
 * H10 토글 · 닉네임 안내 1회 · 처리방침 v1.2 문장과 앱 동작 대조.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { setSupabaseForTest } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { useAccountData } from '../app/useAccountData'
import { logoutToStart } from '../features/settings/accountActions'
import { NotifySettingsScreen } from '../features/settings/NotifySettingsScreen'
import { UnlinkScreen } from '../features/settings/UnlinkScreen'
import { WithdrawScreen } from '../features/settings/WithdrawScreen'
import { ACTIVE, DISSOLVING, ME, PARTNER, settingsDb } from '../features/settings/settingsTestSupport'
import { needsNicknameNotice, nicknameNoticeKey, useNicknameNotice, NICKNAME_NOTICE_SCOPE } from '../couple/useNicknameNotice'
import { NICKNAME_NOTICE_COPY, NicknameNoticeScreen } from '../features/couple/NicknameNoticeScreen'
import { LEGAL_DOCUMENTS, legalPlainText } from '../legal/consent'
import { readCache } from '../cache/deviceCache'
import { useCoupleStore } from '../stores/coupleStore'
import { useDissolutionStore } from '../stores/dissolutionStore'
import { makeFakeNav } from '../testSupport'
import type { ScreenName } from '../app/routes'
import { setPushPortForTest, type PushNotice, type PushPermission, type PushPort, type PushRoute } from './pushPort'
import { deviceId, isRegisteredHere, registerToken, usePushStore } from './pushCore'
import { PushBand, PUSH_BAND_MS } from './PushBand'
import { PushPermissionScreen } from './PushPermissionScreen'
import { usePushSetup } from './usePushSetup'

interface FakePort extends PushPort {
  emitToken(t: string): void
  emitReceived(n: PushNotice): void
  emitAction(r: PushRoute): void
  calls: string[]
}

function fakePort(opts: { check?: PushPermission; request?: PushPermission } = {}): FakePort {
  let reg: ((t: string) => void) | null = null
  let recv: ((n: PushNotice) => void) | null = null
  let act_: ((r: PushRoute) => void) | null = null
  const calls: string[] = []
  return {
    platform: 'android',
    calls,
    checkPermission: async () => { calls.push('check'); return opts.check ?? 'prompt' },
    requestPermission: async () => { calls.push('request'); return opts.request ?? 'granted' },
    register: async () => { calls.push('register') },
    unregister: async () => { calls.push('unregister') },
    createChannels: async () => { calls.push('channels') },
    onRegistration: (cb) => { reg = cb; return () => { reg = null } },
    onReceived: (cb) => { recv = cb; return () => { recv = null } },
    onAction: (cb) => { act_ = cb; return () => { act_ = null } },
    emitToken: (t) => reg?.(t),
    emitReceived: (n) => recv?.(n),
    emitAction: (r) => act_?.(r),
  }
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
const tokenDeletes = (db: ReturnType<typeof settingsDb>) => db.writes.filter((w) => w.table === 'push_tokens' && w.op === 'delete')

/** 이 기기가 토큰을 등록한 상태로(서버 행 하나). */
async function registered(db: ReturnType<typeof settingsDb>) {
  db.tables.push_tokens = [{ user_id: 'me', device_id: deviceId(), token: 't', platform: 'android' }]
  await registerToken('t', 'android')
  expect(isRegisteredHere()).toBe(true)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  useAuthStore.getState().setUserId('me')
  useCoupleStore.getState().reset()
  useDissolutionStore.getState().reset()
  usePushStore.getState().reset()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  setPushPortForTest(undefined)
  useAuthStore.getState().setUserId(null)
  localStorage.clear()
  vi.useRealTimers()
})

function setupHook(screen: ScreenName | null = 'main', bootDone = true) {
  const nav = makeFakeNav()
  const hook = renderHook(({ s, b }) => usePushSetup(nav, s, b), { initialProps: { s: screen, b: bootDone } })
  return { nav, hook }
}

describe('권한 흐름(I08)', () => {
  it('연결 뒤 처음 메인에 오면 I08을 한 번 연다 - 다시 와도 0', async () => {
    settingsDb()
    const port = fakePort({ check: 'prompt' })
    setPushPortForTest(port)
    await useCoupleStore.getState().refresh('me')
    const { nav, hook } = setupHook('main')
    await settle()
    expect(nav.push).toHaveBeenCalledWith('push-permission', { urgent: true })
    hook.rerender({ s: 'chat', b: true })
    hook.rerender({ s: 'main', b: true })
    await settle()
    expect((nav.push as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === 'push-permission')).toHaveLength(1)
    expect(port.calls).not.toContain('register')
  })

  it('연결 전 · 해제 유예에는 묻지도 등록하지도 않는다', async () => {
    settingsDb({ couples: [DISSOLVING] })
    const port = fakePort({ check: 'granted' })
    setPushPortForTest(port)
    await useCoupleStore.getState().refresh('me')
    const { nav } = setupHook('main')
    await settle()
    expect(port.calls).toEqual([])
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('Android 10(V40)처럼 처음부터 허용이면 I08 없이 바로 채널 · 등록', async () => {
    settingsDb()
    const port = fakePort({ check: 'granted' })
    setPushPortForTest(port)
    await useCoupleStore.getState().refresh('me')
    const { nav } = setupHook('main')
    await settle()
    expect(nav.push).not.toHaveBeenCalled()
    expect(port.calls).toEqual(['check', 'channels', 'register'])
  })

  it('[알림 받기] -> 허용: OS 창 -> 채널 · 등록 -> 닫기', async () => {
    settingsDb()
    const port = fakePort({ request: 'granted' })
    setPushPortForTest(port)
    const nav = makeFakeNav()
    render(<PushPermissionScreen nav={nav} />)
    fireEvent.click(screen.getByText('알림 받기'))
    await settle()
    expect(port.calls).toEqual(['request', 'channels', 'register'])
    expect(nav.back).toHaveBeenCalledTimes(1)
    expect(usePushStore.getState().permission).toBe('granted')
  })

  it('[알림 받기] -> 거부: 등록 0 · 닫기(앱은 그대로)', async () => {
    settingsDb()
    const port = fakePort({ request: 'denied' })
    setPushPortForTest(port)
    const nav = makeFakeNav()
    render(<PushPermissionScreen nav={nav} />)
    fireEvent.click(screen.getByText('알림 받기'))
    await settle()
    expect(port.calls).toEqual(['request'])
    expect(nav.back).toHaveBeenCalledTimes(1)
  })

  it('[나중에]: OS 창 0 · 등록 0 · 닫기', async () => {
    settingsDb()
    const port = fakePort()
    setPushPortForTest(port)
    const nav = makeFakeNav()
    render(<PushPermissionScreen nav={nav} />)
    fireEvent.click(screen.getByText('나중에'))
    await settle()
    expect(port.calls).toEqual([])
    expect(nav.back).toHaveBeenCalledTimes(1)
  })
})

describe('토큰 저장 · 갱신', () => {
  it('토큰이 오면 push_register(기기 id · 토큰 · android) · 바뀐 토큰도 다시 저장 · 받을 수 없을 때는 0', async () => {
    const db = settingsDb()
    const port = fakePort({ check: 'granted' })
    setPushPortForTest(port)
    await useCoupleStore.getState().refresh('me')
    setupHook('main')
    await settle()
    port.emitToken('tok-1')
    await settle()
    port.emitToken('tok-2')
    await settle()
    const regs = db.rpcCalls.filter((c) => c.fn === 'push_register')
    expect(regs.map((c) => c.args.p_token)).toEqual(['tok-1', 'tok-2'])
    expect(regs.every((c) => c.args.p_device_id === deviceId() && c.args.p_platform === 'android')).toBe(true)
    expect(isRegisteredHere()).toBe(true)
    act(() => useCoupleStore.getState().reset())
    port.emitToken('tok-3')
    await settle()
    expect(db.rpcCalls.filter((c) => c.fn === 'push_register')).toHaveLength(2)
  })
})

describe('삭제 규칙 5자리(76- 기기 저장 삭제와 같은 자리)', () => {
  it('① 로그아웃: 세션을 지우기 전에 이 기기 행 삭제 + FCM 토큰 없애기', async () => {
    const db = settingsDb()
    const port = fakePort()
    setPushPortForTest(port)
    await registered(db)
    await logoutToStart(makeFakeNav())
    expect(tokenDeletes(db)).toHaveLength(1)
    expect(db.tables.push_tokens).toEqual([])
    expect(port.calls).toContain('unregister')
    expect(isRegisteredHere()).toBe(false)
    expect(db.signOutCalls.length).toBe(1)
  })

  it('② 탈퇴 요청 · ③ 해제 요청: 요청이 성공한 자리에서 삭제', async () => {
    for (const which of ['withdraw', 'unlink'] as const) {
      const db = settingsDb({ rpc: () => ({ data: which === 'withdraw' ? '2025-10-28T00:00:00+09:00' : 'd9', error: null }) })
      const port = fakePort()
      setPushPortForTest(port)
      await useCoupleStore.getState().refresh('me')
      await registered(db)
      render(which === 'withdraw' ? <WithdrawScreen nav={makeFakeNav()} /> : <UnlinkScreen nav={makeFakeNav()} />)
      await settle()
      fireEvent.change(screen.getByTestId(`${which}-phrase-input`), { target: { value: which === 'withdraw' ? '탈퇴합니다' : '해제합니다' } })
      fireEvent.click(screen.getByTestId(`${which}-submit`))
      await settle()
      expect(tokenDeletes(db)).toHaveLength(1)
      expect(port.calls).toContain('unregister')
      cleanup()
    }
  })

  it('④ 해제 유예(상대 요청) · 해제 완료: 커플 다시 읽기가 그 상태를 본 자리에서 삭제 · 등록한 적 없으면 0', async () => {
    for (const couples of [[DISSOLVING], []]) {
      const db = settingsDb({ couples })
      setPushPortForTest(fakePort())
      await registered(db)
      await useCoupleStore.getState().refresh('me')
      await settle()
      expect(tokenDeletes(db)).toHaveLength(1)
      await useCoupleStore.getState().refresh('me')
      await settle()
      expect(tokenDeletes(db)).toHaveLength(1)
    }
  })

  it('⑤ 계정 전환: 로그인한 사람이 바뀌면 push_claim_device(이 기기의 다른 사람 행 정리)', async () => {
    const db = settingsDb()
    setPushPortForTest(fakePort())
    renderHook(() => useAccountData('main'))
    await settle()
    expect(db.rpcCalls.filter((c) => c.fn === 'push_claim_device')).toEqual([{ fn: 'push_claim_device', args: { p_device_id: deviceId() } }])
  })
})

describe('I07 앞에 있을 때 띠 · 누름 이동', () => {
  function shell(screenName: ScreenName) {
    settingsDb()
    const port = fakePort({ check: 'granted' })
    setPushPortForTest(port)
    const nav = makeFakeNav()
    renderHook(() => usePushSetup(nav, screenName, true))
    render(<PushBand nav={nav} screen={screenName} />)
    return { port, nav }
  }

  it('메인에 있을 때 메시지 -> 띠(본문 그대로) · 누르면 채팅 탭 · 4초 뒤 닫힘', async () => {
    const { port, nav } = shell('main')
    await settle()
    act(() => port.emitReceived({ body: '서영님이 메시지를 보냈어요', kind: 'message', route: 'chat' }))
    expect(screen.getByTestId('push-band-body').textContent).toBe('서영님이 메시지를 보냈어요')
    fireEvent.click(screen.getByTestId('push-band'))
    expect(nav.reset).toHaveBeenCalledWith('chat')
    expect(screen.queryByTestId('push-band')).toBeNull()
    act(() => port.emitReceived({ body: 'b', kind: 'date', route: 'main' }))
    await settle(PUSH_BAND_MS + 10)
    expect(screen.queryByTestId('push-band')).toBeNull()
  })

  it('지금 채팅을 보고 있으면 메시지 띠 0 · 변경 안내는 띠', async () => {
    const { port } = shell('chat')
    await settle()
    act(() => port.emitReceived({ body: 'm', kind: 'message', route: 'chat' }))
    expect(screen.queryByTestId('push-band')).toBeNull()
    act(() => port.emitReceived({ body: '서영님이 사귄 날짜를 바꿨어요', kind: 'date', route: 'main' }))
    expect(screen.getByTestId('push-band')).toBeTruthy()
  })

  it('알림 누름: 메시지 = 채팅 탭, 변경 안내 = 메인 · 시작이 끝난 뒤 한 번만', async () => {
    settingsDb()
    const port = fakePort()
    setPushPortForTest(port)
    const nav = makeFakeNav()
    const hook = renderHook(({ s, b }) => usePushSetup(nav, s, b), { initialProps: { s: 'intro' as ScreenName, b: false } })
    act(() => port.emitAction('chat'))
    await settle()
    expect(nav.reset).not.toHaveBeenCalled() // 아직 시작 전
    hook.rerender({ s: 'main', b: true })
    await settle()
    expect(nav.reset).toHaveBeenCalledWith('chat')
    hook.rerender({ s: 'chat', b: true })
    hook.rerender({ s: 'main', b: true })
    await settle()
    expect(nav.reset).toHaveBeenCalledTimes(1)
    hook.rerender({ s: 'chat', b: true })
    act(() => port.emitAction('main'))
    await settle()
    expect(nav.reset).toHaveBeenLastCalledWith('main')
    expect(nav.reset).toHaveBeenCalledTimes(2)
  })
})

describe('H10 알림 설정', () => {
  it('행이 없으면 둘 다 켬 · 토글하면 본인 행 upsert · 실패하면 되돌림', async () => {
    const db = settingsDb({ extraTables: { notification_settings: [] } })
    setPushPortForTest(fakePort({ check: 'granted' }))
    render(<NotifySettingsScreen nav={makeFakeNav()} />)
    await settle()
    const messages = screen.getByTestId('notify-messages')
    expect(messages.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('notify-changes').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(messages)
    await settle()
    expect(db.tables.notification_settings).toEqual([{ user_id: 'me', messages: false, changes: true }])
    expect(screen.getByTestId('notify-messages').getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByTestId('notify-os-off')).toBeNull()
  })

  it('저장 실패면 원래 값 · 안내', async () => {
    settingsDb({ extraTables: { notification_settings: [{ user_id: 'me', messages: true, changes: false }] }, failUpdates: ['notification_settings'] })
    setPushPortForTest(fakePort({ check: 'granted' }))
    render(<NotifySettingsScreen nav={makeFakeNav()} />)
    await settle()
    expect(screen.getByTestId('notify-changes').getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByTestId('notify-changes'))
    await settle()
    expect(screen.getByTestId('notify-changes').getAttribute('aria-checked')).toBe('false')
    expect(screen.getByTestId('notify-error')).toBeTruthy()
  })

  it('폰 권한이 꺼져 있으면 안내 + [폰 설정에서 켜기] -> 다시 물음, 그래도 꺼지면 폰 설정 경로 글', async () => {
    settingsDb({ extraTables: { notification_settings: [] } })
    const port = fakePort({ check: 'denied', request: 'denied' })
    setPushPortForTest(port)
    render(<NotifySettingsScreen nav={makeFakeNav()} />)
    await settle()
    expect(screen.getByTestId('notify-os-off')).toBeTruthy()
    fireEvent.click(screen.getByTestId('notify-os-on'))
    await settle()
    expect(port.calls).toContain('request')
    expect(screen.getByText(/폰 설정 > 애플리케이션 > 온도록 > 알림/)).toBeTruthy()
  })
})

describe('R101-5 닉네임 변경 안내', () => {
  it('판정: 상대가 바꾼 것만 · 내가 바꾼 것 · 처음 정하기(칸 비어 있음) 0', () => {
    expect(needsNicknameNotice({ id: 'c1', nickname: '새벽', nickname_changed_by: 'p1' }, 'me')).toBe(true)
    expect(needsNicknameNotice({ id: 'c1', nickname: '새벽', nickname_changed_by: 'me' }, 'me')).toBe(false)
    expect(needsNicknameNotice({ id: 'c1', nickname: '새벽', nickname_changed_by: null }, 'me')).toBe(false)
  })

  it('앱을 열면 한 번 - 같은 값으로는 다시 0 · 새 값이면 다시', async () => {
    const db = settingsDb({ couples: [{ ...ACTIVE, nickname: '새벽', nickname_changed_by: 'p1' }] })
    const nav = makeFakeNav()
    const hook = renderHook(({ on }) => useNicknameNotice(nav, true, on), { initialProps: { on: true } })
    await settle()
    expect(nav.push).toHaveBeenCalledWith('nickname-recheck', { urgent: true })
    expect(readCache<{ key: string }>('me', 'main', NICKNAME_NOTICE_SCOPE)?.key).toBe(nicknameNoticeKey({ id: 'c1', nickname: '새벽', nickname_changed_by: 'p1' }))
    hook.rerender({ on: false })
    hook.rerender({ on: true })
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
    db.tables.couples[0].nickname = '한낮'
    hook.rerender({ on: false })
    hook.rerender({ on: true })
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(2)
  })

  it('화면: "{상대}님이 커플 닉네임을 바꿨어요" + 둘째 줄 새 값(조사 0) · [확인했어요] -> 메인', async () => {
    settingsDb({ couples: [{ ...ACTIVE, nickname: '새벽', nickname_changed_by: 'p1' }], profiles: [ME, PARTNER] })
    const nav = makeFakeNav()
    render(<NicknameNoticeScreen nav={nav} />)
    await settle()
    expect(screen.getByText(NICKNAME_NOTICE_COPY.changed('서영'))).toBeTruthy()
    expect(document.querySelector('.subtitle')?.textContent).toBe('새벽')
    fireEvent.click(screen.getByText('확인했어요'))
    await settle()
    expect(nav.reset).toHaveBeenCalledWith('main')
  })
})

describe('처리방침 v1.2 문장 = 앱 동작(R109-3)', () => {
  it('토큰 삭제 시점 · 설정 → 알림에서 끄기 · 알림 본문 원문 0을 문장이 말하고, 위 시험이 그 동작을 단언한다', () => {
    const text = legalPlainText(LEGAL_DOCUMENTS.privacy)
    expect(text).toContain('로그아웃 · 탈퇴 요청 · 커플 해제 요청 때 그 기기의 알림 토큰을 지웁니다.')
    expect(text).toContain('알림은 설정 → 알림에서 언제든 끌 수 있습니다.')
    expect(text).toContain('대화 원문은 보내지 않음')
  })
})
