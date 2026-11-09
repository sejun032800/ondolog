/**
 * 사진 크게 보기 - 한 장 확대(핀치 · 두 번 누르기 · 끌기) + 여러 장이면 옆으로 밀어 넘기기. **라이브러리 0** - 포인터 이벤트와 `zoomMath.ts`(순수 계산)로 직접 쓴다.
 * E03 데이트 상세가 쓰고, 서재 뷰어(74-6)가 같은 부품 · 같은 계산을 쓸 수 있게 `components/`에 둔다(`ZoomableImage`는 한 장 면만 필요할 때).
 *
 * - 시트가 아니라 화면 위에 덮이는 면이다. 열려 있는 동안 뒤로 가기는 이것만 닫는다(`platform/backStack`).
 * - 배율 1에서만 넘기기가 되고, 확대 중에는 끌기만 한다. 두 번 누르면 확대 <-> 처음.
 * - 1b 웹뷰 처리: 길게 누르기 메뉴 · 끌어서 저장 0(`draggable=false`, 전역 CSS). 연출은 CSS(열릴 때 페이드 180ms, `prefers-reduced-motion`이면 즉시).
 */
import { useRef, useState } from 'react'
import { useBackHandler } from '../platform/backStack'
import { doubleTap, IDENTITY, isDoubleTap, midpoint, pan, pinch, swipeStep, distance, type Point, type Size, type View } from './zoomMath'

export interface ViewerPhoto {
  id: string
  /** 서명 주소. 아직 못 받았으면 빈 면. */
  url?: string
  /** 스크린리더용 설명. */
  label: string
}

type Gesture =
  | { kind: 'drag'; view: View; origin: Point; at: number; moved: boolean }
  | { kind: 'pinch'; view: View; distance: number; center: Point }

/** 한 장의 확대 면. `onSwipe`는 배율 1에서 옆으로 충분히 밀었을 때 -1(앞) / 1(뒤)로 부른다. */
export function ZoomableImage({ url, label, onSwipe, onError }: {
  url?: string
  label: string
  onSwipe?: (step: -1 | 1) => void
  /** 이미지가 안 열렸을 때(서명 주소 만료 등). 서재 뷰어(74-6)가 새 주소를 한 번 다시 받는다. */
  onError?: () => void
}) {
  const [view, setView] = useState<View>(IDENTITY)
  const [gesturing, setGesturing] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ at: number; point: Point } | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  const frame = (): Size => {
    const r = frameRef.current?.getBoundingClientRect()
    return { width: r?.width ?? 0, height: r?.height ?? 0 }
  }
  const startPinch = () => {
    const [a, b] = [...pointers.current.values()]
    gesture.current = { kind: 'pinch', view: viewRef.current, distance: distance(a, b), center: midpoint(a, b) }
  }

  const onDown = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* 지원하지 않는 환경 */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setGesturing(true)
    if (pointers.current.size >= 2) startPinch()
    else gesture.current = { kind: 'drag', view: viewRef.current, origin: { x: e.clientX, y: e.clientY }, at: Date.now(), moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      setView(pinch({ view: g.view, distance: g.distance, center: g.center }, { distance: distance(a, b), center: midpoint(a, b) }, frame()))
    } else if (g.kind === 'drag') {
      const dx = e.clientX - g.origin.x
      const dy = e.clientY - g.origin.y
      if (Math.hypot(dx, dy) > 6) g.moved = true
      if (g.view.scale > 1) setView(pan(g.view, dx, dy, frame()))
    }
  }
  const onUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (pointers.current.size >= 1) {
      // 핀치에서 한 손가락이 남으면 그 손가락으로 끌기를 이어 간다.
      const [rest] = [...pointers.current.values()]
      gesture.current = { kind: 'drag', view: viewRef.current, origin: rest, at: Date.now(), moved: true }
      return
    }
    gesture.current = null
    setGesturing(false)
    if (!g || g.kind !== 'drag') return
    if (!g.moved) {
      const now = { at: Date.now(), point: { x: e.clientX, y: e.clientY } }
      if (isDoubleTap(lastTap.current, now)) {
        lastTap.current = null
        setView((v) => doubleTap(v))
      } else lastTap.current = now
      return
    }
    const step = swipeStep(e.clientX - g.origin.x, g.view.scale)
    if (step !== 0) onSwipe?.(step)
  }

  return (
    <div
      ref={frameRef}
      className="zoomFrame"
      data-testid="zoom-frame"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {url ? (
        <img
          className={`zoomImg ${gesturing ? '' : 'settle'}`}
          src={url}
          alt={label}
          draggable={false}
          onError={onError}
          data-testid="zoom-img"
          data-scale={view.scale}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
      ) : null}
    </div>
  )
}

export function PhotoViewer({ photos, startIndex = 0, title, heading, footer, onClose }: {
  photos: readonly ViewerPhoto[]
  startIndex?: number
  /** 머리에 보이는 글(날짜 · 장소 등). */
  title?: string
  /** 머리 가운데를 글 한 줄 대신 직접 그린다(채팅 F06: 이름 + 날짜). 있으면 `title`을 대신한다. */
  heading?: React.ReactNode
  /** 사진 아래 줄(채팅 F06: [저장] [공유]). */
  footer?: React.ReactNode
  onClose: () => void
}) {
  const [rawIndex, setIndex] = useState(Math.max(0, startIndex))
  useBackHandler(onClose)
  // 사진 목록이 줄어도(삭제 등) 없는 칸을 가리키지 않는다.
  const index = Math.min(rawIndex, Math.max(0, photos.length - 1))
  const photo = photos[index]
  if (!photo) return null
  const step = (s: -1 | 1) => setIndex(Math.min(photos.length - 1, Math.max(0, index + s)))
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="사진 크게 보기" data-testid="photo-viewer">
      <div className="viewerHead">
        <button type="button" className="viewerClose press" aria-label="닫기" data-testid="photo-viewer-close" onClick={onClose}>✕</button>
        {heading ? <span className="viewerHeading">{heading}</span> : <span className="viewerTitle t-caption c-sub">{title ?? ''}</span>}
        <span className="viewerCount t-caption c-mute" data-testid="photo-viewer-count">{photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}</span>
      </div>
      <ZoomableImage key={photo.id} url={photo.url} label={photo.label} onSwipe={step} />
      {footer ? <div className="viewerFoot">{footer}</div> : null}
    </div>
  )
}
