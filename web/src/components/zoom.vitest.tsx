/**
 * 사진 크게 보기 시험(74-4) - 확대 계산(`zoomMath.ts`, 순수)과 `PhotoViewer`(포인터 이벤트 · 뒤로 가기). 라이브러리 0으로 직접 쓴 것이라 계산을 값으로 확인한다.
 * 원본 RN: `ZoomablePage`(U3 뷰어 핀치 줌) - 시험 파일이 따로 없어 이 파일이 새로 지킨다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { handleHardwareBack } from '../platform/backStack'
import { PhotoViewer } from './PhotoViewer'
import {
  clampScale, clampView, doubleTap, DOUBLE_TAP_MS, DOUBLE_TAP_SCALE, IDENTITY, isDoubleTap, MAX_SCALE, midpoint, pan, pinch, SWIPE_PX, swipeStep,
} from './zoomMath'

afterEach(cleanup)

// jsdom에는 PointerEvent가 없어(`clientX` · `pointerId`가 사라진다) 시험에서만 마우스 이벤트 위에 얹는다.
if (typeof window.PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent, configurable: true })
}

const frame = { width: 400, height: 600 }

describe('확대 계산', () => {
  it('배율은 1 ~ 4로 가둔다 · 숫자가 아니면 1', () => {
    expect(clampScale(0.3)).toBe(1)
    expect(clampScale(9)).toBe(MAX_SCALE)
    expect(clampScale(Number.NaN)).toBe(1)
    expect(clampScale(2)).toBe(2)
  })

  it('이미지는 면 밖으로 나가지 않는다 - 배율 1이면 늘 가운데, 2배면 절반 크기만큼만 움직인다', () => {
    expect(clampView({ scale: 1, x: 80, y: -40 }, frame)).toEqual({ scale: 1, x: 0, y: 0 })
    expect(clampView({ scale: 2, x: 999, y: -999 }, frame)).toEqual({ scale: 2, x: 200, y: -300 })
    expect(clampView({ scale: 2, x: 50, y: 10 }, frame)).toEqual({ scale: 2, x: 50, y: 10 })
  })

  it('핀치: 두 손가락 거리의 비만큼 배율이 바뀌고, 가운데가 움직이면 따라간다', () => {
    const start = { view: IDENTITY, distance: 100, center: { x: 200, y: 300 } }
    expect(pinch(start, { distance: 200, center: { x: 200, y: 300 } }, frame).scale).toBe(2)
    expect(pinch(start, { distance: 1000, center: { x: 200, y: 300 } }, frame).scale).toBe(MAX_SCALE)
    expect(pinch(start, { distance: 50, center: { x: 200, y: 300 } }, frame).scale).toBe(1) // 1 아래로는 줄지 않는다
    const moved = pinch(start, { distance: 200, center: { x: 230, y: 280 } }, frame)
    expect(moved).toEqual({ scale: 2, x: 30, y: -20 })
    expect(pinch({ ...start, distance: 0 }, { distance: 200, center: start.center }, frame)).toEqual(IDENTITY)
  })

  it('끌기는 확대돼 있을 때만 움직인다', () => {
    expect(pan(IDENTITY, 50, 50, frame)).toEqual(IDENTITY)
    expect(pan({ scale: 2, x: 0, y: 0 }, 50, -20, frame)).toEqual({ scale: 2, x: 50, y: -20 })
    expect(pan({ scale: 2, x: 190, y: 0 }, 50, 0, frame).x).toBe(200)
  })

  it('두 번 누르기: 처음이면 2.5배, 확대돼 있으면 처음으로', () => {
    expect(doubleTap(IDENTITY)).toEqual({ scale: DOUBLE_TAP_SCALE, x: 0, y: 0 })
    expect(doubleTap({ scale: 3, x: 40, y: 10 })).toEqual(IDENTITY)
  })

  it('두 번 누르기 판정: 시간 안 · 가까운 곳이어야 한다', () => {
    const first = { at: 1000, point: { x: 100, y: 100 } }
    expect(isDoubleTap(first, { at: 1000 + DOUBLE_TAP_MS, point: { x: 110, y: 100 } })).toBe(true)
    expect(isDoubleTap(first, { at: 1000 + DOUBLE_TAP_MS + 1, point: { x: 100, y: 100 } })).toBe(false)
    expect(isDoubleTap(first, { at: 1100, point: { x: 300, y: 100 } })).toBe(false)
    expect(isDoubleTap(null, { at: 1100, point: { x: 100, y: 100 } })).toBe(false)
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })

  it('넘기기: 배율 1에서 옆으로 충분히 밀었을 때만 · 왼쪽으로 밀면 뒤 사진', () => {
    expect(swipeStep(-SWIPE_PX, 1)).toBe(1)
    expect(swipeStep(SWIPE_PX, 1)).toBe(-1)
    expect(swipeStep(-(SWIPE_PX - 1), 1)).toBe(0)
    expect(swipeStep(-300, 2)).toBe(0) // 확대 중에는 끌기만
  })
})

describe('PhotoViewer', () => {
  const photos = [
    { id: 'a', url: 'https://signed.invalid/a.jpg', label: '사진 a' },
    { id: 'b', url: 'https://signed.invalid/b.jpg', label: '사진 b' },
    { id: 'c', url: undefined, label: '사진 c' },
  ]
  const frameEl = () => screen.getByTestId('zoom-frame')
  const scale = () => Number(screen.getByTestId('zoom-img').getAttribute('data-scale'))
  const tap = (x = 100, y = 100, pointerId = 1) => {
    fireEvent.pointerDown(frameEl(), { pointerId, clientX: x, clientY: y })
    fireEvent.pointerUp(frameEl(), { pointerId, clientX: x, clientY: y })
  }

  it('여러 장이면 "n / 전체"가 보이고 한 장이면 보이지 않는다 · 시작 사진이 열린다', () => {
    const { rerender } = render(<PhotoViewer photos={photos} startIndex={1} title="10월 3일 토요일" onClose={() => {}} />)
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('2 / 3')
    expect(screen.getByAltText('사진 b')).toBeTruthy()
    expect(screen.getByText('10월 3일 토요일')).toBeTruthy()
    rerender(<PhotoViewer photos={photos.slice(0, 1)} onClose={() => {}} />)
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('')
  })

  it('두 번 누르면 확대, 다시 두 번 누르면 처음으로', () => {
    render(<PhotoViewer photos={photos} onClose={() => {}} />)
    expect(scale()).toBe(1)
    tap(); tap()
    expect(scale()).toBe(DOUBLE_TAP_SCALE)
    tap(); tap()
    expect(scale()).toBe(1)
  })

  it('한 번만 누르면 아무 일도 없다', () => {
    render(<PhotoViewer photos={photos} onClose={() => {}} />)
    tap()
    expect(scale()).toBe(1)
  })

  it('두 손가락으로 벌리면 확대된다(핀치)', () => {
    render(<PhotoViewer photos={photos} onClose={() => {}} />)
    fireEvent.pointerDown(frameEl(), { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerDown(frameEl(), { pointerId: 2, clientX: 200, clientY: 100 })
    fireEvent.pointerMove(frameEl(), { pointerId: 2, clientX: 300, clientY: 100 })
    expect(scale()).toBe(2)
    fireEvent.pointerUp(frameEl(), { pointerId: 2, clientX: 300, clientY: 100 })
    fireEvent.pointerUp(frameEl(), { pointerId: 1, clientX: 100, clientY: 100 })
    expect(scale()).toBe(2) // 손을 떼도 배율은 그대로
  })

  it('배율 1에서 왼쪽으로 밀면 다음 사진, 오른쪽으로 밀면 앞 사진 · 끝에서는 더 가지 않는다', () => {
    render(<PhotoViewer photos={photos} onClose={() => {}} />)
    const swipe = (from: number, to: number) => {
      fireEvent.pointerDown(frameEl(), { pointerId: 1, clientX: from, clientY: 200 })
      fireEvent.pointerMove(frameEl(), { pointerId: 1, clientX: to, clientY: 200 })
      fireEvent.pointerUp(frameEl(), { pointerId: 1, clientX: to, clientY: 200 })
    }
    swipe(300, 100)
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('2 / 3')
    swipe(300, 100)
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('3 / 3')
    swipe(300, 100)
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('3 / 3')
    swipe(100, 300)
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('2 / 3')
  })

  it('짧게 스친 정도(문턱 아래)로는 넘어가지 않고, 사진이 바뀌면 배율은 처음으로 돌아온다', () => {
    render(<PhotoViewer photos={photos} onClose={() => {}} />)
    fireEvent.pointerDown(frameEl(), { pointerId: 1, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(frameEl(), { pointerId: 1, clientX: 170, clientY: 200 })
    fireEvent.pointerUp(frameEl(), { pointerId: 1, clientX: 170, clientY: 200 })
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('1 / 3')
    tap(); tap()
    expect(scale()).toBe(DOUBLE_TAP_SCALE)
    fireEvent.pointerDown(frameEl(), { pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerUp(frameEl(), { pointerId: 1, clientX: 300, clientY: 200 })
    // 확대 중에 옆으로 밀어도 넘어가지 않는다(끌기만)
    fireEvent.pointerDown(frameEl(), { pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerMove(frameEl(), { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(frameEl(), { pointerId: 1, clientX: 100, clientY: 200 })
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('1 / 3')
  })

  it('✕와 하드웨어 뒤로 가기는 뷰어만 닫는다(앞 화면으로 새지 않는다)', () => {
    const onClose = vi.fn()
    const goBack = vi.fn()
    const exitApp = vi.fn()
    render(<PhotoViewer photos={photos} onClose={onClose} />)
    handleHardwareBack({ canGoBack: () => true, goBack, exitApp })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(goBack).not.toHaveBeenCalled()
    expect(exitApp).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('photo-viewer-close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('사진이 하나도 없으면 아무것도 그리지 않는다 · 주소가 아직 없는 사진은 빈 면', () => {
    const { container, unmount } = render(<PhotoViewer photos={[]} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
    unmount()
    render(<PhotoViewer photos={photos} startIndex={2} onClose={() => {}} />)
    expect(screen.queryByTestId('zoom-img')).toBeNull()
    expect(screen.getByTestId('zoom-frame')).toBeTruthy()
  })
})
