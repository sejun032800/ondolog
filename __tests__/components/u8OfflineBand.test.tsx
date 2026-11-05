/**
 * I02 연결 끊김 띠 바로잡기 시험 (`72b-`, R58-2 · R58-3) - 행동으로 본다(가짜 타이머, 파일 내용 비교 없음).
 */
import { act, render, screen } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { ConnectionBanner } from '../../src/components/nocturne/ConnectionBanner'
import { PROBE_INTERVAL_MS } from '../../src/hooks/useOfflineProbe'
import { registerConnectionProbe, trackConnection, useConnectionStore } from '../../src/services/connectionMonitor'
import { connectErrorMessage } from '../../src/services/coupleConnectCore'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
let mockQueueListener: { onTextQueue?: (q: unknown[]) => void } | null = null
jest.mock('../../src/services/chatQueueHub', () => ({
  chatQueueHub: {
    subscribe: (listener: typeof mockQueueListener) => {
      mockQueueListener = listener
      return () => {
        mockQueueListener = null
      }
    },
  },
}))

const asFetch = (fn: (...a: never[]) => unknown) => fn as unknown as typeof fetch
let appStateHandlers: Array<(s: string) => void> = []
let removed = 0

beforeEach(() => {
  jest.useFakeTimers()
  useConnectionStore.setState({ offline: false })
  registerConnectionProbe(null)
  appStateHandlers = []
  removed = 0
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, h: (s: string) => void) => {
    appStateHandlers.push(h)
    return { remove: () => { removed += 1 } }
  }) as never)
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('끊김 판정 - 감싼 fetch 호출의 거부만', () => {
  it('네트워크 거부 -> 끊김', async () => {
    const f = trackConnection(asFetch(async () => { throw new TypeError('Network request failed') }))
    await expect(f('x')).rejects.toThrow()
    expect(useConnectionStore.getState().offline).toBe(true)
  })
  it('상태 500 응답 -> 끊김 아님', async () => {
    const f = trackConnection(asFetch(async () => ({ ok: false, status: 500 })))
    await f('x')
    expect(useConnectionStore.getState().offline).toBe(false)
  })
  it('응답 뒤 앱 코드의 TypeError -> 끊김 아님', async () => {
    const f = trackConnection(asFetch(async () => ({ ok: true, json: () => undefined })))
    const res = (await f('x')) as unknown as { json: () => { a: number } }
    expect(() => res.json().a).toThrow(TypeError)
    expect(useConnectionStore.getState().offline).toBe(false)
  })
  it('AbortError -> 끊김 아님', async () => {
    const f = trackConnection(asFetch(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }) }))
    await expect(f('x')).rejects.toThrow()
    expect(useConnectionStore.getState().offline).toBe(false)
  })
})

describe('감싸기는 요청 · 응답 · 오류를 바꾸지 않는다', () => {
  it('같은 오류 객체 / 같은 응답 객체 / 같은 인자', async () => {
    const err = new TypeError('Network request failed')
    const calls: unknown[][] = []
    const bad = trackConnection(asFetch(async (...a: never[]) => { calls.push(a); throw err }))
    await expect(bad('u', { method: 'POST' })).rejects.toBe(err)
    expect(calls[0]).toEqual(['u', { method: 'POST' }])

    const response = { ok: true, status: 200 }
    const good = trackConnection(asFetch(async () => response))
    await expect(good('u')).resolves.toBe(response)
    const one: unknown[][] = []
    await trackConnection(asFetch(async (...a: never[]) => { one.push(a); return response }))('u')
    expect(one[0]).toHaveLength(1) // init를 만들어 붙이지 않는다
  })
  it('확인 요청은 감싸기를 지나지 않는다', async () => {
    const base = jest.fn(async () => ({ status: 200 }))
    trackConnection(asFetch(base))
    const probe = jest.fn(async () => ({ status: 401 }))
    registerConnectionProbe(probe)
    await render(<ConnectionBanner />)
    await act(async () => useConnectionStore.getState().report(false))
    await act(async () => { jest.advanceTimersByTime(PROBE_INTERVAL_MS) })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(base).toHaveBeenCalledTimes(0)
  })
})

describe('띠 풀기 확인 요청', () => {
  it('띠 없음 -> 확인 요청 0, 구독 0', async () => {
    const probe = jest.fn(async () => ({}))
    registerConnectionProbe(probe)
    await render(<ConnectionBanner />)
    await act(async () => { appStateHandlers.forEach((h) => h('active')); jest.advanceTimersByTime(60_000) })
    expect(probe).not.toHaveBeenCalled()
    expect(appStateHandlers).toHaveLength(0)
  })

  it('앞으로 옴 -> 한 번 / 15초 안 두 번째 0 / 15초 뒤 한 번 더 / 확인 요청에 signal 하나만', async () => {
    const probe = jest.fn(async () => { throw new TypeError('Network request failed') })
    registerConnectionProbe(probe as never)
    await render(<ConnectionBanner />)
    await act(async () => useConnectionStore.getState().report(false))
    await act(async () => { appStateHandlers.forEach((h) => h('active')) })
    expect(probe).toHaveBeenCalledTimes(1)
    await act(async () => { jest.advanceTimersByTime(5_000); appStateHandlers.forEach((h) => h('active')) })
    expect(probe).toHaveBeenCalledTimes(1)
    await act(async () => { jest.advanceTimersByTime(10_000) })
    expect(probe).toHaveBeenCalledTimes(2)
    expect(probe.mock.calls[0]).toHaveLength(1) // 사용자 토큰 · 헤더를 받을 자리가 없다 - 8초 제한용 signal 하나뿐
    expect((probe.mock.calls[0] as unknown[])[0]).toBeInstanceOf(AbortSignal)
    expect(screen.getByTestId('connection-banner')).toBeTruthy() // 거부 -> 띠 유지
  })

  it('응답(401 포함) -> 띠 내림 + 타이머 · AppState 구독 정리', async () => {
    const probe = jest.fn(async () => ({ status: 401 }))
    registerConnectionProbe(probe)
    await render(<ConnectionBanner />)
    await act(async () => useConnectionStore.getState().report(false))
    await act(async () => { appStateHandlers.forEach((h) => h('active')) })
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    expect(removed).toBe(1)
    await act(async () => { jest.advanceTimersByTime(120_000) })
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('화면이 사라지면 정리한다', async () => {
    const probe = jest.fn(async () => { throw new Error('x') })
    registerConnectionProbe(probe)
    const view = await render(<ConnectionBanner />)
    await act(async () => useConnectionStore.getState().report(false))
    await act(async () => view.unmount())
    expect(removed).toBe(1)
    await act(async () => { jest.advanceTimersByTime(60_000) })
    expect(probe).not.toHaveBeenCalled()
  })
})

describe('채팅 큐로 띠 숨기기는 채팅 화면에서만', () => {
  it('큐 대기 + 채팅 -> 숨김 / 큐 대기 + 다른 탭 -> 보임', async () => {
    const view = await render(<ConnectionBanner inChat />)
    await act(async () => useConnectionStore.getState().report(false))
    await act(async () => mockQueueListener?.onTextQueue?.([{ status: 'pending' }]))
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    await view.rerender(<ConnectionBanner inChat={false} />)
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
  })
})

describe('A18 무효 문구', () => {
  it('그 밖의 무효 코드', () => {
    expect(connectErrorMessage({ code: 'P0002' })).toBe('쓸 수 없는 코드예요. 상대에게 코드를 다시 받아 주세요.')
  })
})
