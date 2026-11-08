import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleHardwareBack, pushBackHandler } from './backStack'

const releases: Array<() => void> = []
afterEach(() => {
  while (releases.length) releases.pop()?.()
})
const push = (h: () => void) => {
  const r = pushBackHandler(h)
  releases.push(r)
  return r
}

function actions(canGoBack: boolean) {
  return { canGoBack: () => canGoBack, goBack: vi.fn(), exitApp: vi.fn() }
}

describe('하드웨어 뒤로 가기', () => {
  it('받을 곳이 없고 뒤로 갈 수 있으면 앱 안 뒤로 가기', () => {
    const a = actions(true)
    handleHardwareBack(a)
    expect(a.goBack).toHaveBeenCalledTimes(1)
    expect(a.exitApp).not.toHaveBeenCalled()
  })

  it('첫 화면에서만 앱을 끝낸다', () => {
    const a = actions(false)
    handleHardwareBack(a)
    expect(a.exitApp).toHaveBeenCalledTimes(1)
    expect(a.goBack).not.toHaveBeenCalled()
  })

  it('화면 안에서 받는 곳(시트 등)이 있으면 그곳이 먼저 받고, 앱 이동 · 종료는 하지 않는다', () => {
    const screen = vi.fn()
    const sheet = vi.fn()
    push(screen)
    push(sheet)
    const a = actions(false)
    handleHardwareBack(a)
    expect(sheet).toHaveBeenCalledTimes(1)
    expect(screen).not.toHaveBeenCalled()
    expect(a.exitApp).not.toHaveBeenCalled()
    expect(a.goBack).not.toHaveBeenCalled()
  })

  it('받는 곳을 풀면 그 아래 것이 받는다', () => {
    const screen = vi.fn()
    const sheet = vi.fn()
    push(screen)
    const release = push(sheet)
    release()
    handleHardwareBack(actions(true))
    expect(screen).toHaveBeenCalledTimes(1)
    expect(sheet).not.toHaveBeenCalled()
  })
})
