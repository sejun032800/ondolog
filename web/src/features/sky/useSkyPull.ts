/**
 * B02 - 메인 맨 위에서 아래로 끌어내리면 하늘이 열린다(MASTER 9-8-2).
 * 기기 기본 스크롤을 가로채지 않는다(R99-3): 모든 터치 리스너는 `passive`이고 `preventDefault`를 부르지 않는다.
 * 맨 위(scrollTop 0)에서 시작해 그 터치 동안 한 번도 스크롤되지 않은 "더 당기는" 동작만 받는다(`pullState` - 순수 함수).
 */
import { useEffect, useRef, useState } from 'react'
import { NO_PULL, PULL_SCROLL_QUIET_MS, pullState, type PullState } from './skyMath'

export function useSkyPull<T extends HTMLElement>(enabled: boolean, onOpen: () => void): { ref: React.RefObject<T | null>; pull: PullState } {
  const ref = useRef<T | null>(null)
  const [pull, setPull] = useState<PullState>(NO_PULL)
  const openRef = useRef(onOpen)
  openRef.current = onOpen

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) { setPull(NO_PULL); return }
    let startY: number | null = null
    let startTop = 0
    let scrolledDuring = false
    let wasScrolling = false
    let lastScrollAt = Number.NEGATIVE_INFINITY
    let cur: PullState = NO_PULL
    const set = (next: PullState) => {
      if (next.active === cur.active && next.offset === cur.offset && next.armed === cur.armed) return
      cur = next
      setPull(next)
    }
    const onScroll = () => {
      lastScrollAt = Date.now()
      scrolledDuring = true
      set(NO_PULL)
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { startY = null; return }
      startY = e.touches[0].clientY
      startTop = el.scrollTop
      scrolledDuring = false
      wasScrolling = Date.now() - lastScrollAt < PULL_SCROLL_QUIET_MS
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null || e.touches.length === 0) return
      set(pullState({ startScrollTop: startTop, scrollTop: el.scrollTop, dy: e.touches[0].clientY - startY, scrolledDuring, wasScrolling }))
    }
    const onEnd = () => {
      const open = startY !== null && cur.active && cur.armed
      startY = null
      set(NO_PULL)
      if (open) openRef.current()
    }
    const onCancel = () => { startY = null; set(NO_PULL) }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [enabled])

  return { ref, pull }
}
