import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { ConnectionBanner, CONNECTION_COPY } from '../components/ConnectionBanner'
import { setChatQueueWaiting, useChatQueueSignal } from './chatQueueSignal'
import { listenBrowserOffline, registerConnectionProbe, trackConnection, useConnectionStore } from './connectionMonitor'
import { PROBE_INTERVAL_MS, PROBE_TIMEOUT_MS, useOfflineProbe } from './useOfflineProbe'

beforeEach(() => {
  vi.useFakeTimers()
  useConnectionStore.setState({ offline: false })
  setChatQueueWaiting(false)
})
afterEach(() => {
  cleanup()
  registerConnectionProbe(null)
  vi.useRealTimers()
})

describe('I02 판정: 감싼 fetch', () => {
  it('요청이 거부되면 끊김, 같은 오류를 다시 던진다', async () => {
    const report = vi.fn()
    const err = new TypeError('Failed to fetch')
    const wrapped = trackConnection(() => Promise.reject(err), report)
    await expect(wrapped('x')).rejects.toBe(err)
    expect(report).toHaveBeenCalledWith(false)
  })

  it('응답이 오면 상태 코드와 무관하게 연결이다(500도) - 응답은 그대로 돌려준다', async () => {
    const report = vi.fn()
    const res = new Response('', { status: 500 })
    const wrapped = trackConnection(() => Promise.resolve(res), report)
    await expect(wrapped('x')).resolves.toBe(res)
    expect(report).toHaveBeenCalledWith(true)
  })

  it('호출자가 중단한 요청(AbortError)은 끊김이 아니다', async () => {
    const report = vi.fn()
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    await expect(trackConnection(() => Promise.reject(abort), report)('x')).rejects.toBe(abort)
    expect(report).not.toHaveBeenCalled()
  })

  it('인자를 그대로 넘긴다', async () => {
    const base = vi.fn(async () => new Response(''))
    const init = { method: 'POST' }
    await trackConnection(base as unknown as typeof fetch, () => {})('u', init)
    expect(base).toHaveBeenCalledWith('u', init)
  })

  it('브라우저 offline 이벤트는 끊김으로 알린다(online 이벤트로는 풀지 않는다)', () => {
    const report = vi.fn()
    const off = listenBrowserOffline(window, report)
    window.dispatchEvent(new Event('offline'))
    expect(report).toHaveBeenCalledWith(false)
    report.mockClear()
    window.dispatchEvent(new Event('online'))
    expect(report).not.toHaveBeenCalled()
    off()
    window.dispatchEvent(new Event('offline'))
    expect(report).not.toHaveBeenCalled()
  })
})

describe('I02 풀기 확인(72b-/72c-)', () => {
  const goOffline = () => act(() => useConnectionStore.getState().report(false))

  it('끊기지 않았으면 아무 요청도 보내지 않는다', () => {
    const probe = vi.fn(() => Promise.resolve())
    registerConnectionProbe(probe)
    renderHook(() => useOfflineProbe())
    act(() => { vi.advanceTimersByTime(PROBE_INTERVAL_MS * 3) })
    expect(probe).not.toHaveBeenCalled()
  })

  it('15초마다 하나 보내고, 응답이 오면(상태 무관) 띠를 내린다', async () => {
    const probe = vi.fn(() => Promise.resolve(new Response('', { status: 401 })))
    registerConnectionProbe(probe)
    renderHook(() => useOfflineProbe())
    goOffline()
    expect(probe).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS) })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(useConnectionStore.getState().offline).toBe(false)
  })

  it('확인 요청에는 신호만 넘긴다(토큰 · 키 · 헤더 0)', async () => {
    const probe = vi.fn((_signal?: AbortSignal) => new Promise<never>(() => {}))
    registerConnectionProbe(probe)
    renderHook(() => useOfflineProbe())
    goOffline()
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS) })
    expect(probe.mock.calls[0]).toHaveLength(1)
    expect(probe.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
  })

  it('한 번은 8초를 넘으면 취소하고, 띠는 그대로 두며, 겹치지 않고 다음을 기다린다', async () => {
    let signal: AbortSignal | undefined
    const probe = vi.fn((s?: AbortSignal) => {
      signal = s
      return new Promise<never>((_, reject) => s?.addEventListener('abort', () => reject(Object.assign(new Error('a'), { name: 'AbortError' }))))
    })
    registerConnectionProbe(probe)
    renderHook(() => useOfflineProbe())
    goOffline()
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS) })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(signal?.aborted).toBe(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS) })
    expect(signal?.aborted).toBe(true)
    expect(useConnectionStore.getState().offline).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS) })
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('거부되면 띠를 그대로 두고 다음 시도를 기다린다', async () => {
    const probe = vi.fn(() => Promise.reject(new TypeError('x')))
    registerConnectionProbe(probe)
    renderHook(() => useOfflineProbe())
    goOffline()
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 2) })
    expect(probe).toHaveBeenCalledTimes(2)
    expect(useConnectionStore.getState().offline).toBe(true)
  })

  it('online 이벤트와 앱이 다시 보일 때(visibilitychange)도 시도한다 - online은 간격을 기다리지 않는다', async () => {
    const probe = vi.fn(() => new Promise<never>(() => {}))
    registerConnectionProbe(probe)
    renderHook(() => useOfflineProbe())
    goOffline()
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(probe).toHaveBeenCalledTimes(1)
    // 진행 중이면 겹치지 않는다.
    act(() => { window.dispatchEvent(new Event('online')) })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('정리하면 진행 중인 요청을 취소하고 타이머 · 구독을 모두 푼다', async () => {
    let signal: AbortSignal | undefined
    const probe = vi.fn((s?: AbortSignal) => {
      signal = s
      return new Promise<never>(() => {})
    })
    registerConnectionProbe(probe)
    const { unmount } = renderHook(() => useOfflineProbe())
    goOffline()
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS) })
    unmount()
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('띠가 내려가면(연결 회복) 효과가 정리되어 더 이상 보내지 않는다', async () => {
    const probe = vi.fn(() => Promise.resolve())
    registerConnectionProbe(probe)
    renderHook(() => useOfflineProbe())
    goOffline()
    act(() => { useConnectionStore.getState().report(true) })
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 3) })
    expect(probe).not.toHaveBeenCalled()
  })
})

describe('I02 띠', () => {
  it('끊기면 뜨고, 문장은 보드 그대로이며, 눌리지 않는 띠다(헤더 0 · 정지 점)', () => {
    render(<ConnectionBanner />)
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    act(() => useConnectionStore.getState().report(false))
    const el = screen.getByTestId('connection-banner')
    expect(el.textContent).toBe(CONNECTION_COPY.offline)
    expect(CONNECTION_COPY.offline).toBe('연결이 끊겼어요 · 마지막으로 받은 내용이에요')
    expect(el.querySelector('button, a, input')).toBeNull()
  })

  it('채팅에서 보낼 것이 남아 있으면 띠는 자리를 내준다(F05 문장이 말한다)', () => {
    act(() => useConnectionStore.getState().report(false))
    const { rerender } = render(<ConnectionBanner inChat />)
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    act(() => setChatQueueWaiting(true))
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    act(() => setChatQueueWaiting(false))
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    rerender(<ConnectionBanner inChat={false} />)
    act(() => setChatQueueWaiting(true))
    // 다른 탭에서는 큐와 관계없이 끊김을 보인다.
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    expect(useChatQueueSignal.getState().waiting).toBe(true)
  })

  it('브라우저 offline 이벤트로도 뜬다', () => {
    render(<ConnectionBanner />)
    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
  })
})
