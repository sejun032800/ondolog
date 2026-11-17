/**
 * 80- 앱 오류 기록 시험(원격 0 - 가짜 클라이언트의 rpc 만 본다).
 *  - 잡는 곳마다 RPC 1회(종류 · 화면 이름만) · 보내는 값에 메시지 · 스택 · 이름 · id 0(인자 단언)
 *  - 묶음당 1시간 1번(나머지는 건수로 합침) · 기기 전체 1시간 30번 · 오프라인 모음 · 기록 실패 무해 · 반복 0
 *  - 지우기 규칙(로그아웃 · 계정 전환) · 허용 목록이 서버(80-m1)와 같음
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { setSupabaseForTest, type WebSupabase } from '../auth/client'
import { exchangeCodeOnce } from '../auth/callback'
import { clearAllDeviceCache, purgeOtherUsers, writeCache } from '../cache/deviceCache'
import { RenderGuard } from '../components/AccountProblem'
import { withUploadDiag } from '../features/feed/feedSave'
import { TextQueueHub } from '../features/chat/textQueueHub'
import { registerToken } from '../push/pushCore'
import { makeFakeNav } from '../testSupport'
import { ALL_ROUTES } from '../app/routes'
import {
  clearAppErrorCounts, ERROR_LOG_KEY, flushAppErrors, installErrorCapture, reportAppError, resetErrorLogForTest, setErrorScreen,
} from './errorLog'
import { ERROR_KINDS, ERROR_SCREENS, HOURLY_SEND_CAP, makeGiveUpTracker, PER_BUCKET_INTERVAL_MS } from './errorLogRules'

type Call = { fn: string; args: Record<string, unknown> }
const SECRET = 'secret-message-가온-user-1234'

function fakeClient(opts: { rpcFails?: 'throw' | 'error'; extra?: Record<string, unknown> } = {}) {
  const calls: Call[] = []
  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      if (fn === 'log_app_error' && opts.rpcFails === 'throw') throw new TypeError(`network ${SECRET}`)
      if (fn === 'log_app_error' && opts.rpcFails === 'error') return { data: null, error: { message: SECRET } }
      if (fn === 'push_register') return { data: null, error: { message: SECRET } }
      return { data: null, error: null }
    }),
    auth: {
      exchangeCodeForSession: async () => ({ data: { session: null }, error: { message: SECRET } }),
    },
    ...opts.extra,
  } as unknown as WebSupabase
  setSupabaseForTest(client)
  return { client, calls, logs: () => calls.filter((c) => c.fn === 'log_app_error') }
}

const NOW = Date.UTC(2026, 10, 17, 3, 0, 0)

beforeEach(() => {
  localStorage.clear()
  resetErrorLogForTest()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  resetErrorLogForTest()
  localStorage.clear()
  vi.restoreAllMocks()
})

/** 보낸 값에 내용이 섞이지 않았는지 - 키는 다섯 개뿐 · 값은 허용 목록 · 비밀 글자 0. */
function expectClean(c: Call) {
  expect(Object.keys(c.args).sort()).toEqual(['p_count', 'p_kind', 'p_platform', 'p_screen', 'p_version'])
  expect(ERROR_SCREENS).toContain(c.args.p_screen)
  expect(ERROR_KINDS).toContain(c.args.p_kind)
  expect(c.args.p_platform).toBe('web')
  expect(c.args.p_version).toMatch(/^[0-9]+(\.[0-9]+){0,3}$/)
  const text = JSON.stringify(c.args)
  for (const bad of ['secret', '1234', '가온', 'Error', ' at ', 'stack', 'smoke-user', 'me']) expect(text).not.toContain(bad)
}

describe('80- 잡는 곳마다 RPC 1회 · 내용 0', () => {
  it('처리 안 된 예외 -> uncaught', async () => {
    const { logs } = fakeClient()
    const off = installErrorCapture(window)
    setErrorScreen('chat')
    window.dispatchEvent(new ErrorEvent('error', { message: SECRET, error: new Error(SECRET) }))
    await flushAppErrors(NOW)
    off()
    expect(logs()).toHaveLength(1)
    expect(logs()[0].args).toMatchObject({ p_screen: 'chat', p_kind: 'uncaught', p_count: 1 })
    expectClean(logs()[0])
  })

  it('ResizeObserver 경고는 세지 않는다', async () => {
    const { logs } = fakeClient()
    const off = installErrorCapture(window)
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }))
    await flushAppErrors(NOW)
    off()
    expect(logs()).toHaveLength(0)
  })

  it('처리 안 된 Promise 거부 -> unhandled_rejection', async () => {
    const { logs } = fakeClient()
    const off = installErrorCapture(window)
    setErrorScreen('feed')
    const ev = new Event('unhandledrejection') as Event & { reason?: unknown }
    ev.reason = new Error(SECRET)
    window.dispatchEvent(ev)
    await flushAppErrors(NOW)
    off()
    expect(logs().map((c) => c.args.p_kind)).toEqual(['unhandled_rejection'])
    expectClean(logs()[0])
  })

  it('화면 그리기 오류 -> 오류 경계가 대체 화면 + render_crash', async () => {
    const { logs } = fakeClient()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setErrorScreen('sky')
    const Boom = () => { throw new Error(SECRET) }
    render(<RenderGuard nav={makeFakeNav()}><Boom /></RenderGuard>)
    expect(screen.getByTestId('account-problem')).toBeTruthy()
    await flushAppErrors(NOW)
    expect(logs().map((c) => [c.args.p_screen, c.args.p_kind])).toEqual([['sky', 'render_crash']])
    expectClean(logs()[0])
  })

  it('사진 올리기 실패(피드) -> upload_fail · 결과는 그대로', async () => {
    const { logs } = fakeClient()
    const db = { from: () => ({}), rpc: async () => ({}), storage: { from: () => ({ upload: async () => ({ data: null, error: { message: SECRET } }) }) } }
    const wrapped = withUploadDiag(db as never) as unknown as { storage: { from: (b: string) => { upload: (...a: unknown[]) => Promise<{ error: unknown }> } } }
    const r = await wrapped.storage.from('entries').upload('c/x.jpg', new Blob())
    expect(r.error).toBeTruthy()
    await flushAppErrors(NOW)
    expect(logs().map((c) => c.args.p_kind)).toEqual(['upload_fail'])
    expectClean(logs()[0])
  })

  it('큐 재시도 한계(채팅 글) -> queue_giveup · 기기에서 읽어 온 멈춘 항목은 세지 않음', async () => {
    const { logs } = fakeClient()
    const stale = { clientMsgId: 'old', coupleId: 'c', senderId: 'me', body: SECRET, sentAt: '2026-11-16T00:00:00Z', retryCount: 5, status: 'failed' as const }
    const hub = new TextQueueHub({
      send: async () => ({ status: 'failed', errorClass: 'permanent', error: new Error(SECRET) }) as never,
      store: { load: async () => [stale], save: async () => {} } as never,
    })
    hub.attach('c', 'me')
    await Promise.resolve(); await Promise.resolve()
    await flushAppErrors(NOW)
    expect(logs()).toHaveLength(0)
    hub.getTextQueue()!.enqueueAfterInitialFailure({ clientMsgId: 'new', coupleId: 'c', senderId: 'me', body: SECRET, sentAt: '2026-11-17T00:00:00Z' }, 'permanent')
    await flushAppErrors(NOW)
    hub.detach()
    expect(logs().map((c) => [c.args.p_kind, c.args.p_count])).toEqual([['queue_giveup', 1]])
    expectClean(logs()[0])
  })

  it('알림 토큰 등록 실패 -> push_register_fail', async () => {
    const { logs } = fakeClient()
    expect(await registerToken('tok-' + SECRET, 'android')).toBe(false)
    await flushAppErrors(NOW)
    expect(logs().map((c) => c.args.p_kind)).toEqual(['push_register_fail'])
    expectClean(logs()[0])
  })

  it('기기 저장 실패 -> cache_fail(앱은 계속)', async () => {
    const { logs } = fakeClient()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    expect(() => writeCache('me', 'main', { secret: SECRET })).not.toThrow()
    await flushAppErrors(NOW)
    expect(logs().map((c) => c.args.p_kind)).toEqual(['cache_fail'])
    expectClean(logs()[0])
  })

  it('로그인 복귀 실패 -> auth_return_fail', async () => {
    const { client, logs } = fakeClient()
    const out = await exchangeCodeOnce(client, 'code-80-1')
    expect(out.ok).toBe(false)
    await flushAppErrors(NOW)
    expect(logs().map((c) => c.args.p_kind)).toEqual(['auth_return_fail'])
    expectClean(logs()[0])
  })

  it('모르는 화면 이름 -> unknown(허용 목록 밖 글자를 보내지 않음)', async () => {
    const { logs } = fakeClient()
    setErrorScreen('/settings?id=' + SECRET)
    reportAppError('uncaught')
    await flushAppErrors(NOW)
    expect(logs()[0].args.p_screen).toBe('unknown')
  })
})

describe('80- 상한 · 모음', () => {
  it('같은 묶음은 1시간에 한 번 - 사이 건수는 기기에서 세어 다음 전송에 합침', async () => {
    const { logs } = fakeClient()
    setErrorScreen('main')
    reportAppError('uncaught')
    reportAppError('uncaught')
    await flushAppErrors(NOW)
    expect(logs().map((c) => c.args.p_count)).toEqual([2])
    reportAppError('uncaught')
    reportAppError('uncaught')
    reportAppError('uncaught')
    await flushAppErrors(NOW + 10 * 60 * 1000)
    expect(logs()).toHaveLength(1) // 1시간 안 - 보내지 않음
    await flushAppErrors(NOW + PER_BUCKET_INTERVAL_MS)
    expect(logs().map((c) => c.args.p_count)).toEqual([2, 3])
  })

  it('기기 전체 1시간 상한(30) - 나머지는 다음 시간에', async () => {
    const { logs } = fakeClient()
    for (const s of ALL_ROUTES.slice(0, 35)) { setErrorScreen(s); reportAppError('cache_fail') }
    await flushAppErrors(NOW)
    expect(logs()).toHaveLength(HOURLY_SEND_CAP)
    await flushAppErrors(NOW + 5 * 60 * 1000)
    expect(logs()).toHaveLength(HOURLY_SEND_CAP)
    await flushAppErrors(NOW + PER_BUCKET_INTERVAL_MS)
    expect(logs()).toHaveLength(35)
  })

  it('오프라인이면 보내지 않고 기기에 건수만 모음 -> 다시 온라인이 되면 보냄', async () => {
    const { logs } = fakeClient()
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    setErrorScreen('chat')
    reportAppError('upload_fail')
    reportAppError('upload_fail')
    await flushAppErrors(NOW)
    expect(logs()).toHaveLength(0)
    const saved = localStorage.getItem(ERROR_LOG_KEY)!
    expect(saved).toContain('"count":2')
    for (const bad of ['secret', 'message', 'stack']) expect(saved).not.toContain(bad)
    onLine.mockReturnValue(true)
    const off = installErrorCapture(window)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(logs()).toHaveLength(1))
    off()
    expect(logs()[0].args).toMatchObject({ p_kind: 'upload_fail', p_count: 2 })
  })

  it('연결 값이 없으면(원격 0) 보내지 않고 모아 둠', async () => {
    setSupabaseForTest(null)
    reportAppError('uncaught')
    await expect(flushAppErrors(NOW)).resolves.toBeUndefined()
    expect(localStorage.getItem(ERROR_LOG_KEY)).toContain('"count":1')
  })
})

describe('80- 기록 실패는 무해 · 반복 0', () => {
  it.each(['throw', 'error'] as const)('RPC가 %s -> 던지지 않음 · 처리 안 된 거부 0 · 건수 그대로 · 새 오류 0', async (how) => {
    const { logs } = fakeClient({ rpcFails: how })
    const rejections: unknown[] = []
    const onRej = (e: Event) => rejections.push(e)
    window.addEventListener('unhandledrejection', onRej)
    const off = installErrorCapture(window)
    setErrorScreen('main')
    reportAppError('uncaught')
    await expect(flushAppErrors(NOW)).resolves.toBeUndefined()
    await flushAppErrors(NOW + 1)
    off()
    window.removeEventListener('unhandledrejection', onRej)
    expect(rejections).toEqual([])
    expect(logs()).toHaveLength(2) // 두 번 시도 - 둘 다 같은 묶음 하나(실패가 새 묶음을 만들지 않음)
    const state = JSON.parse(localStorage.getItem(ERROR_LOG_KEY)!)
    expect(Object.keys(state.buckets)).toEqual(['main|uncaught'])
    expect(state.buckets['main|uncaught'].count).toBe(1)
  })

  it('저장이 막혀도 메모리로 세고 보냄(앱 멈춤 0)', async () => {
    const { logs } = fakeClient()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => reportAppError('uncaught')).not.toThrow()
    await flushAppErrors(NOW)
    expect(logs().map((c) => c.args.p_kind)).toEqual(['uncaught'])
  })
})

describe('80- 지우기 규칙', () => {
  it('로그아웃 · 탈퇴 요청(clearAllDeviceCache) -> 오류 건수도 지움', () => {
    reportAppError('uncaught')
    expect(localStorage.getItem(ERROR_LOG_KEY)).not.toBeNull()
    clearAllDeviceCache()
    expect(localStorage.getItem(ERROR_LOG_KEY)).toBeNull()
  })

  it('계정 전환 때만 지움 - 같은 사람의 앱 시작은 남김 · 전환 신호(지운 수)는 그대로', () => {
    writeCache('me', 'main', { a: 1 })
    reportAppError('uncaught')
    expect(purgeOtherUsers('me')).toBe(0)
    expect(localStorage.getItem(ERROR_LOG_KEY)).not.toBeNull()
    writeCache('other', 'main', { a: 1 })
    expect(purgeOtherUsers('me')).toBe(1)
    expect(localStorage.getItem(ERROR_LOG_KEY)).toBeNull()
  })

  it('clearAppErrorCounts 뒤 보낼 것 0', async () => {
    const { logs } = fakeClient()
    reportAppError('uncaught')
    clearAppErrorCounts()
    await flushAppErrors(NOW)
    expect(logs()).toHaveLength(0)
  })
})

describe('80- 허용 목록 = 서버(80-m1)', () => {
  const sql = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations/20261117120000_m1_app_error_log.sql'), 'utf8')
  const listIn = (marker: string) => {
    const at = sql.indexOf(marker)
    const block = sql.slice(at, sql.indexOf(')', sql.indexOf('in (', at) + 4))
    return [...block.matchAll(/'([a-z_-]+)'/g)].map((m) => m[1]).filter((v) => v !== 'other')
  }
  it('화면 이름 = 라우트 이름 + unknown', () => {
    expect(listIn('v_screen := case').sort()).toEqual([...ERROR_SCREENS].sort())
  })
  it('오류 종류 = 앱의 고정 값', () => {
    expect(listIn('v_kind := case').sort()).toEqual([...ERROR_KINDS].sort())
  })
  it('큐 한계 세기: 같은 항목은 한 번 · prime 한 것은 0', () => {
    const t = makeGiveUpTracker()
    t.prime([{ id: 'a', failed: true }])
    expect(t.observe([{ id: 'a', failed: true }, { id: 'b', failed: false }])).toBe(0)
    expect(t.observe([{ id: 'b', failed: true }])).toBe(1)
    expect(t.observe([{ id: 'b', failed: true }])).toBe(0)
  })
})
