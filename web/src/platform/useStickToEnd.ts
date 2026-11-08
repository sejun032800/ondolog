/**
 * 목록 "끝에 붙기"(73-1c) - 화면 코드와 분리. 75- 정식 채팅이 그대로 가져다 쓴다.
 *
 * - 끝에 붙어 있으면(STICK_THRESHOLD 안) 새 메시지 · 창 높이 변화(키보드 열고 닫기) 때 끝을 유지한다.
 * - 내가 보낸 메시지는 항상 끝으로 간다. 상대 메시지는 붙어 있을 때만 따라가고, 위로 올려 보는 중이면 위치를 건드리지 않는다.
 * - 새 메시지로 가는 이동은 부드럽게(SMOOTH_MS, ease-out). 창 높이 변화는 그 프레임에 바로 따라간다(키보드와 같이 움직이도록).
 * - 부드러운 이동은 직접 그린다(브라우저 smooth는 시간을 못 정한다). 이동 중 다시 불리면 지금 위치에서 새 끝으로 이어 간다.
 *   손가락이 닿으면(touchstart · wheel · pointerdown) 이동을 멈춘다.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export const STICK_THRESHOLD = 48
export const SMOOTH_MS = 220 // 보드 motion.screenEnter.durationMs(220)

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

const reducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useStickToEnd(listRef: RefObject<HTMLElement | null>) {
  const stuck = useRef(true)
  const anim = useRef<number | null>(null)

  const cancel = useCallback(() => {
    if (anim.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(anim.current)
    anim.current = null
  }, [])

  const endTop = (el: HTMLElement) => Math.max(0, el.scrollHeight - el.clientHeight)

  const jump = useCallback(() => {
    const el = listRef.current
    if (!el) return
    cancel()
    el.scrollTop = el.scrollHeight
    stuck.current = true
  }, [listRef, cancel])

  const smooth = useCallback(() => {
    const el = listRef.current
    if (!el) return
    stuck.current = true
    if (reducedMotion() || typeof requestAnimationFrame !== 'function') { jump(); return }
    cancel()
    const from = el.scrollTop
    let t0: number | null = null
    const step = (now: number) => {
      if (t0 === null) t0 = now
      const p = (now - t0) / SMOOTH_MS
      const to = endTop(el) // 이동 중 새 메시지로 끝이 늘어나도 따라간다
      el.scrollTop = p >= 1 ? el.scrollHeight : from + (to - from) * easeOut(p)
      anim.current = p >= 1 ? null : requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [listRef, jump, cancel])

  /** 새 메시지가 목록에 붙은 직후(레이아웃 효과 안에서) 부른다. */
  const followAppend = useCallback((mine: boolean) => {
    if (mine || stuck.current) smooth()
  }, [smooth])

  const onScroll = useCallback(() => {
    if (anim.current !== null) return // 우리가 움직이는 중에는 판정하지 않는다
    const el = listRef.current
    if (el) stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD
  }, [listRef])

  const userTouch = useCallback(() => { cancel() }, [cancel])

  // 창 높이 변화(키보드) 때 붙어 있었으면 끝을 유지한다.
  useEffect(() => {
    const el = listRef.current
    const follow = () => { if (stuck.current) { cancel(); const e = listRef.current; if (e) e.scrollTop = e.scrollHeight } }
    const ro = typeof ResizeObserver === 'function' && el ? new ResizeObserver(follow) : null
    if (ro && el) ro.observe(el)
    window.addEventListener('resize', follow)
    window.visualViewport?.addEventListener('resize', follow)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', follow)
      window.visualViewport?.removeEventListener('resize', follow)
      cancel()
    }
  }, [listRef, cancel])

  return { onScroll, jump, followAppend, userTouch, isStuck: () => stuck.current }
}
