/**
 * 76-i 시험 - ④ 서랍 알림 지우기(R111-2) · ⑤ 앞에서 변경 안내를 받으면 커플 정보 새로 읽기(R111-3).
 * 가짜 플러그인 다리(`setPushPortForTest`) + 가짜 서버(`settingsDb`). 실제 토큰 · 키 · 주소 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { setSupabaseForTest } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { useAccountData } from '../app/useAccountData'
import { writeCache } from '../cache/deviceCache'
import { logoutToStart } from '../features/settings/accountActions'
import { UnlinkScreen } from '../features/settings/UnlinkScreen'
import { WithdrawScreen } from '../features/settings/WithdrawScreen'
import { DISSOLVING, settingsDb } from '../features/settings/settingsTestSupport'
import { useCoupleStore } from '../stores/coupleStore'
import { useDissolutionStore } from '../stores/dissolutionStore'
import { makeFakeNav } from '../testSupport'
import { setPushPortForTest, webPushPort, type PushNotice, type PushPort } from './pushPort'
import { clearDeliveredHere, deviceId, forgetThisDevicePush, isRegisteredHere, registerToken, usePushStore } from './pushCore'
import { usePushSetup } from './usePushSetup'

type Db = ReturnType<typeof settingsDb>

interface FakePort extends PushPort {
  calls: string[]
  emitReceived(n: PushNotice): void
}

/** `order`에 서랍 · 토큰 · 세션 순서를 함께 적는다. */
function fakePort(order: string[] = [], opts: { clearFails?: boolean } = {}): FakePort {
  let recv: ((n: PushNotice) => void) | null = null
  const calls: string[] = []
  return {
    platform: 'android',
    calls,
    checkPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    register: async () => {},
    unregister: async () => { calls.push('unregister'); order.push('unregister') },
    clearDelivered: async () => {
      calls.push('clear')
      order.push('clear')
      if (opts.clearFails) throw new Error('no plugin')
    },
    createChannels: async () => {},
    onRegistration: () => () => {},
    onReceived: (cb) => { recv = cb; return () => { recv = null } },
    onAction: () => () => {},
    emitReceived: (n) => recv?.(n),
  }
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
const clears = (p: FakePort) => p.calls.filter((c) => c === 'clear').length

async function registered(db: Db) {
  db.tables.push_tokens = [{ user_id: 'me', device_id: deviceId(), token: 't', platform: 'android' }]
  await registerToken('t', 'android')
  expect(isRegisteredHere()).toBe(true)
}

/** 서버 순서도 같은 `order`에 남긴다(토큰 행 삭제 · 세션 지우기). */
function traceServer(db: Db, order: string[]) {
  const client = db.client as unknown as { from: (t: string) => unknown; auth: { signOut: (a?: unknown) => unknown } }
  const from = client.from.bind(client)
  client.from = (t: string) => {
    const q = from(t) as { delete?: () => unknown }
    if (t === 'push_tokens' && q.delete) {
      const del = q.delete.bind(q)
      q.delete = () => { order.push('token'); return del() }
    }
    return q
  }
  const signOut = client.auth.signOut.bind(client.auth)
  client.auth.signOut = (a?: unknown) => { order.push('session'); return signOut(a) }
}

/** `couples` 읽기 수(= 커플 정보 새로 읽기 수). */
function countCoupleReads(db: Db): { n: number } {
  const box = { n: 0 }
  const client = db.client as unknown as { from: (t: string) => unknown }
  const from = client.from.bind(client)
  client.from = (t: string) => {
    if (t === 'couples') box.n++
    return from(t)
  }
  return box
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

describe('④ 서랍 알림 지우기 - 토큰 삭제 5자리와 같은 자리', () => {
  it('① 로그아웃: 서랍 지우기 1 -> 토큰 삭제 -> 세션 지우기 순서', async () => {
    const db = settingsDb()
    const order: string[] = []
    const port = fakePort(order)
    setPushPortForTest(port)
    await registered(db)
    traceServer(db, order)
    await logoutToStart(makeFakeNav())
    expect(clears(port)).toBe(1)
    expect(order.filter((o) => o !== 'unregister')).toEqual(['clear', 'token', 'session'])
    expect(order.indexOf('clear')).toBeLessThan(order.indexOf('unregister'))
  })

  it('② 탈퇴 요청 · ③ 해제 요청: 요청이 성공한 자리에서 서랍 지우기 1(토큰 삭제보다 먼저)', async () => {
    for (const which of ['withdraw', 'unlink'] as const) {
      const db = settingsDb({ rpc: () => ({ data: which === 'withdraw' ? '2025-10-28T00:00:00+09:00' : 'd9', error: null }) })
      const order: string[] = []
      const port = fakePort(order)
      setPushPortForTest(port)
      await useCoupleStore.getState().refresh('me')
      await registered(db)
      traceServer(db, order)
      render(which === 'withdraw' ? <WithdrawScreen nav={makeFakeNav()} /> : <UnlinkScreen nav={makeFakeNav()} />)
      await settle()
      expect(clears(port)).toBe(0) // 요청 전에는 0
      fireEvent.change(screen.getByTestId(`${which}-phrase-input`), { target: { value: which === 'withdraw' ? '탈퇴합니다' : '해제합니다' } })
      fireEvent.click(screen.getByTestId(`${which}-submit`))
      await settle()
      expect(clears(port)).toBe(1)
      expect(order.indexOf('clear')).toBeLessThan(order.indexOf('token'))
      cleanup()
    }
  })

  it('④ 해제 유예(상대 요청) · 해제 완료: 커플 다시 읽기가 그 상태를 본 자리에서 서랍 지우기', async () => {
    for (const couples of [[DISSOLVING], []]) {
      const db = settingsDb({ couples })
      const port = fakePort()
      setPushPortForTest(port)
      await registered(db)
      await useCoupleStore.getState().refresh('me')
      await settle()
      expect(clears(port)).toBe(1)
    }
  })

  it('⑤ 계정 전환: 다른 사람의 저장분이 있었으면 서랍 지우기 1 -> push_claim_device 순서 · 같은 사람이면 0', async () => {
    const db = settingsDb()
    const order: string[] = []
    const port = fakePort(order)
    setPushPortForTest(port)
    const rpc = db.client.rpc.bind(db.client)
    ;(db.client as unknown as { rpc: (fn: string, a: unknown) => unknown }).rpc = (fn: string, a: unknown) => { order.push(fn); return rpc(fn as never, a as never) }
    writeCache('someone-else', 'main', { coupleId: 'x' })
    const first = renderHook(() => useAccountData('main'))
    await settle()
    expect(clears(port)).toBe(1)
    expect(order.indexOf('clear')).toBeLessThan(order.indexOf('push_claim_device'))
    first.unmount()

    // 같은 사람의 앱 시작(다른 사람 저장분 없음) - 서랍은 그대로, 토큰 정리 RPC는 그대로 1
    const port2 = fakePort()
    setPushPortForTest(port2)
    renderHook(() => useAccountData('main'))
    await settle()
    expect(clears(port2)).toBe(0)
    expect(db.rpcCalls.filter((c) => c.fn === 'push_claim_device')).toHaveLength(2)
  })

  it('두 번 불려도 오류 0 · 등록 표시가 없어도 서랍은 지운다', async () => {
    settingsDb()
    const port = fakePort()
    setPushPortForTest(port)
    await expect(forgetThisDevicePush()).resolves.toBeUndefined()
    await expect(forgetThisDevicePush()).resolves.toBeUndefined()
    expect(clears(port)).toBe(2)
    expect(port.calls).not.toContain('unregister') // 등록한 적 없음 - 토큰 일은 0
  })

  it('서랍 지우기가 실패해도 토큰 삭제 · 로그아웃은 진행', async () => {
    const db = settingsDb()
    const order: string[] = []
    const port = fakePort(order, { clearFails: true })
    setPushPortForTest(port)
    await registered(db)
    traceServer(db, order)
    const nav = makeFakeNav()
    await logoutToStart(nav)
    expect(order.filter((o) => o !== 'unregister')).toEqual(['clear', 'token', 'session'])
    expect(db.tables.push_tokens).toEqual([])
    expect(nav.reset).toHaveBeenCalledWith('intro')
  })

  it('웹 미리보기(플러그인 없음): 조용히 0', async () => {
    setPushPortForTest(webPushPort)
    await expect(clearDeliveredHere()).resolves.toBeUndefined()
  })
})

describe('⑤ 앞에서 변경 안내를 받으면 커플 정보 새로 읽기', () => {
  async function shell() {
    const db = settingsDb()
    const port = fakePort()
    setPushPortForTest(port)
    await useCoupleStore.getState().refresh('me')
    const reads = countCoupleReads(db)
    renderHook(() => usePushSetup(makeFakeNav(), 'main', true))
    await settle()
    reads.n = 0 // 시작 때 읽기는 빼고 센다
    return { db, port, reads }
  }

  it('날짜 변경 안내 -> 새로 읽기 1 · 메인 D+ 근원(사귄 날짜) · 기기 저장값이 바로 바뀜', async () => {
    const { db, port, reads } = await shell()
    db.tables.couples[0].relationship_start_date = '2025-01-02'
    act(() => port.emitReceived({ body: '서영님이 사귄 날짜를 바꿨어요', kind: 'date', route: 'main' }))
    await settle()
    expect(reads.n).toBe(1)
    expect(useCoupleStore.getState().relationshipStartDate).toBe('2025-01-02')
    expect(JSON.stringify(localStorage)).toContain('2025-01-02')
  })

  it('닉네임 변경 안내 -> 새로 읽기 1 · 커플 이름이 바로 바뀜', async () => {
    const { db, port, reads } = await shell()
    db.tables.couples[0].nickname = '새벽'
    act(() => port.emitReceived({ body: '서영님이 커플 닉네임을 바꿨어요', kind: 'nickname', route: 'main' }))
    await settle()
    expect(reads.n).toBe(1)
    expect(useCoupleStore.getState().nickname).toBe('새벽')
  })

  it('메시지 알림 -> 0', async () => {
    const { port, reads } = await shell()
    act(() => port.emitReceived({ body: '서영님이 메시지를 보냈어요', kind: 'message', route: 'chat' }))
    await settle()
    expect(reads.n).toBe(0)
  })

  it('연달아 3건 -> 과하게 부르지 않음(2회 이하)', async () => {
    const { port, reads } = await shell()
    act(() => {
      port.emitReceived({ body: 'a', kind: 'date', route: 'main' })
      port.emitReceived({ body: 'b', kind: 'nickname', route: 'main' })
      port.emitReceived({ body: 'c', kind: 'date', route: 'main' })
    })
    await settle()
    expect(reads.n).toBeGreaterThanOrEqual(1)
    expect(reads.n).toBeLessThanOrEqual(2)
  })
})
