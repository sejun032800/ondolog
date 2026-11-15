/**
 * 길게 누르기(A-2-2) - 지정한 시간(기본 500ms) 가만히 누르고 있으면 `onLong`을 부른다. 손가락이 10px 넘게 움직이거나(스크롤) 떼거나 취소되면 센 것을 버린다.
 * 길게 눌러 열렸으면 뒤따르는 click(= 사진 크게 보기 등)은 삼킨다. `onLong`이 없으면 아무 속성도 돌려주지 않는다(= 눌러도 아무 일 · 아무 연출 없음).
 * 웹뷰의 길게 누르기 기본 메뉴(`contextmenu`)는 막는다.
 */
import { useEffect, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

export const LONG_PRESS_MS = 500
const MOVE_TOLERANCE_PX = 10

export interface LongPressProps {
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void
  onPointerMove?: (e: PointerEvent<HTMLElement>) => void
  onPointerUp?: () => void
  onPointerLeave?: () => void
  onPointerCancel?: () => void
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void
  onClickCapture?: (e: MouseEvent<HTMLElement>) => void
}

export function useLongPress(onLong: (() => void) | undefined, ms: number = LONG_PRESS_MS): LongPressProps {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const latest = useRef(onLong)
  latest.current = onLong

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])

  if (!onLong) return {}
  return {
    onPointerDown: (e) => {
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = setTimeout(() => {
        timer.current = null
        fired.current = true
        latest.current?.()
      }, ms)
    },
    onPointerMove: (e) => {
      const o = origin.current
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE_PX) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClickCapture: (e) => {
      if (!fired.current) return
      fired.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
