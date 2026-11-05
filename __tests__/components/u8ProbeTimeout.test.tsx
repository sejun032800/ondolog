/**
 * I02 확인 요청 시간 제한 · 헤더 시험 (`72c-`, R59-1 · R59-2) - 파일 내용이 아니라 실제로 등록된 함수를 불러서 본다.
 */
import { act, render, screen } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { ConnectionBanner } from '../../src/components/nocturne/ConnectionBanner'
import { PROBE_INTERVAL_MS, PROBE_TIMEOUT_MS } from '../../src/hooks/useOfflineProbe'
import { getConnectionProbe, registerConnectionProbe, useConnectionStore } from '../../src/services/connectionMonitor'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('../../src/services/chatQueueHub', () => ({
  chatQueueHub: { subscribe: () => () => undefined },
}))

const BASE = 'https://probe-test.invalid'
let mockFetch: jest.Mock
const realFetch = global.fetch

beforeEach(() => {
  jest.useFakeTimers()
  process.env.EXPO_PUBLIC_SUPABASE_URL = BASE
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-test'
  mockFetch = jest.fn()
  global.fetch = mockFetch as unknown as typeof fetch
  useConnectionStore.setState({ offline: false })
  registerConnectionProbe(null)
  jest.spyOn(AppState, 'addEventListener').mockImplementation((() => ({ remove: () => undefined })) as never)
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
  global.fetch = realFetch
})

/** supabase.ts 를 새로 불러 그 모듈이 실제로 등록한 확인 함수를 꺼낸다. */
function registerAndGet() {
  // isolateModules 안의 connectionMonitor 는 별도 사본이라, 그 사본에서 꺼낸다.
  let probe: ReturnType<typeof getConnectionProbe> = null
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/services/supabase')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    probe = require('../../src/services/connectionMonitor').getConnectionProbe()
  })
  return probe as ReturnType<typeof getConnectionProbe>
}

describe('supabase.ts 가 등록한 확인 요청', () => {
  it('경로 /auth/v1/health · GET · 헤더 0 · 본문 0 · signal 있음', async () => {
    const probe = registerAndGet()
    expect(probe).toBeTruthy()
    mockFetch.mockResolvedValue({ status: 401 })
    const signal = new AbortController().signal
    await probe!(signal)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).pathname).toBe('/auth/v1/health')
    expect(init.method).toBe('GET')
    expect(init.headers == null || Object.keys(init.headers as object).length === 0).toBe(true)
    expect(init.body == null).toBe(true)
    expect(init.signal).toBe(signal)
  })
})

describe('확인 요청 8초 제한', () => {
  const hangingProbe = () => {
    const signals: AbortSignal[] = []
    const probe = jest.fn(
      (signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signals.push(signal as AbortSignal)
          signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        }),
    )
    return { probe, signals }
  }

  it('응답 없음 -> 8초에 취소 -> 띠 유지 -> 다음 시도는 15초 뒤', async () => {
    const { probe, signals } = hangingProbe()
    registerConnectionProbe(probe)
    await render(<ConnectionBanner />)
    await act(async () => useConnectionStore.getState().report(false))
    await act(async () => { jest.advanceTimersByTime(PROBE_INTERVAL_MS) })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(signals[0].aborted).toBe(false)
    await act(async () => { jest.advanceTimersByTime(PROBE_TIMEOUT_MS - 1) })
    expect(signals[0].aborted).toBe(false)
    await act(async () => { jest.advanceTimersByTime(1) })
    expect(PROBE_TIMEOUT_MS).toBe(8_000)
    expect(signals[0].aborted).toBe(true)
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    // 첫 시도로부터 15초가 되기 전엔 다시 보내지 않고, 15초에 다시 보낸다
    await act(async () => { jest.advanceTimersByTime(PROBE_INTERVAL_MS - PROBE_TIMEOUT_MS - 1) })
    expect(probe).toHaveBeenCalledTimes(1)
    await act(async () => { jest.advanceTimersByTime(1) })
    expect(probe).toHaveBeenCalledTimes(2)
    expect(signals[1]).not.toBe(signals[0])
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
  })

  it('화면이 사라지면 진행 중 요청을 취소하고 타이머를 지운다', async () => {
    const { probe, signals } = hangingProbe()
    registerConnectionProbe(probe)
    const view = await render(<ConnectionBanner />)
    await act(async () => useConnectionStore.getState().report(false))
    await act(async () => { jest.advanceTimersByTime(PROBE_INTERVAL_MS) })
    expect(signals[0].aborted).toBe(false)
    await act(async () => view.unmount())
    expect(signals[0].aborted).toBe(true)
    await act(async () => { jest.advanceTimersByTime(120_000) })
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
