import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import type { NativeBridge } from './platform/bridge'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function setup() {
  let back: (() => void) | undefined
  const bridge: NativeBridge = {
    onBackButton: (cb) => {
      back = cb
      return () => {
        back = undefined
      }
    },
    exitApp: vi.fn(),
    hideSplash: vi.fn(),
  }
  vi.useFakeTimers()
  render(<App bridge={bridge} />)
  // 하늘 이미지가 준비되는 걸 기다리는 대체 시간(6초) 뒤에 첫 화면이 시작된다.
  act(() => {
    vi.advanceTimersByTime(6000)
  })
  // 첫 화면 연출을 건너뛴다(눌러서 넘기기).
  fireEvent.click(document.querySelector('.screen') as Element)
  return {
    bridge,
    pressBack: () =>
      act(() => {
        back?.()
      }),
  }
}

describe('앱 뒤로 가기 (하드웨어 버튼)', () => {
  it('첫 화면에서는 앱을 끝낸다', () => {
    const { bridge, pressBack } = setup()
    expect(screen.getByText('시작하기')).toBeTruthy()
    pressBack()
    expect(bridge.exitApp).toHaveBeenCalledTimes(1)
  })

  it('다음 화면에서는 앱 안 뒤로 가기이고, 앱은 끝나지 않는다', () => {
    const { bridge, pressBack } = setup()
    fireEvent.click(screen.getByText('시작하기'))
    expect(screen.getByText('먼저 알려주세요')).toBeTruthy()
    pressBack()
    expect(screen.queryByText('먼저 알려주세요')).toBeNull()
    expect(screen.getByText('시작하기')).toBeTruthy()
    expect(bridge.exitApp).not.toHaveBeenCalled()
    // 다시 첫 화면이므로 이번에는 끝난다.
    pressBack()
    expect(bridge.exitApp).toHaveBeenCalledTimes(1)
  })

  it('첫 화면이 그려지면 스플래시를 걷는다', () => {
    const { bridge } = setup()
    expect(bridge.hideSplash).toHaveBeenCalled()
  })
})
