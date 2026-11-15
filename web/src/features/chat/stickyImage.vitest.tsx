/** A-26: 사진 말풍선의 그림이 바뀌는 사이 비지 않는다. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { STICKY_IMAGE_MAX_WAIT_MS, useStickyImage } from './stickyImage'

const loaders: Array<{ src: string; fire: (ok: boolean) => void }> = []
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''
  set src(v: string) { this._src = v; loaders.push({ src: v, fire: (ok) => (ok ? this.onload?.() : this.onerror?.()) }) }
  get src() { return this._src }
}

function Probe({ uri }: { uri: string | undefined }) {
  const shown = useStickyImage(uri)
  return <span data-testid="shown">{shown ?? ''}</span>
}
const shown = () => document.querySelector('[data-testid="shown"]')!.textContent

beforeEach(() => { vi.useFakeTimers(); loaders.length = 0; vi.stubGlobal('Image', FakeImage) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('useStickyImage', () => {
  it('미리보기 -> 서버 주소: 주소가 아직 없는 동안 · 내려받는 동안 앞 그림을 두고, 불러온 뒤에야 바꾼다', () => {
    const { rerender } = render(<Probe uri="blob:local" />)
    expect(shown()).toBe('blob:local')
    rerender(<Probe uri={undefined} />) // 서명 주소를 읽는 중(약 1.8초 빈칸이던 구간)
    expect(shown()).toBe('blob:local')
    rerender(<Probe uri="https://cdn/x.jpg" />)
    expect(shown()).toBe('blob:local') // 아직 내려받는 중
    act(() => loaders[0].fire(true))
    expect(shown()).toBe('https://cdn/x.jpg')
  })

  it('앞 그림이 없으면 새 주소를 바로 보인다', () => {
    const { rerender } = render(<Probe uri={undefined} />)
    expect(shown()).toBe('')
    rerender(<Probe uri="https://cdn/x.jpg" />)
    expect(shown()).toBe('https://cdn/x.jpg')
  })

  it('새 그림이 오류이거나 너무 오래 걸리면 바꾼다(낡은 그림에 멈춰 있지 않는다)', () => {
    const { rerender } = render(<Probe uri="blob:local" />)
    rerender(<Probe uri="https://cdn/a.jpg" />)
    act(() => loaders[0].fire(false))
    expect(shown()).toBe('https://cdn/a.jpg')
    rerender(<Probe uri="https://cdn/b.jpg" />)
    expect(shown()).toBe('https://cdn/a.jpg')
    act(() => { vi.advanceTimersByTime(STICKY_IMAGE_MAX_WAIT_MS + 10) })
    expect(shown()).toBe('https://cdn/b.jpg')
  })
})
