/**
 * 사진 확대(핀치 · 두 번 누르기 · 끌기)의 계산 - 화면 · 이벤트를 모르는 순수 함수(라이브러리 0).
 * `PhotoViewer`(E03 사진 보기)가 쓰고, 서재 뷰어(74-6)가 같은 계산을 쓸 수 있다.
 * 좌표는 보는 면의 가운데를 (0, 0)으로 두고, 이미지는 `translate(x, y) scale(s)`로 그린다.
 */
export const MIN_SCALE = 1
export const MAX_SCALE = 4
/** 두 번 누르면 이 배율로 들어간다(이미 확대돼 있으면 1로 돌아간다). */
export const DOUBLE_TAP_SCALE = 2.5
/** 이 시간 안의 두 번째 누름이 "두 번 누르기"다. */
export const DOUBLE_TAP_MS = 300
/** 두 번 누르기로 보는 두 누름 사이 최대 거리(px). */
export const DOUBLE_TAP_SLOP = 32
/** 배율 1에서 옆으로 이만큼(px) 밀면 앞뒤 사진으로 넘긴다. */
export const SWIPE_PX = 64

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface View { scale: number; x: number; y: number }

export const IDENTITY: View = { scale: 1, x: 0, y: 0 }

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** 이미지가 면 밖으로 사라지지 않게 옮긴 값을 가둔다. 배율 1이면 늘 (0, 0). */
export function clampView(view: View, frame: Size): View {
  const scale = clampScale(view.scale)
  const maxX = Math.max(0, (frame.width * scale - frame.width) / 2)
  const maxY = Math.max(0, (frame.height * scale - frame.height) / 2)
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, view.x)) + 0,
    y: Math.min(maxY, Math.max(-maxY, view.y)) + 0,
  }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * 핀치: 시작 때의 배율에 두 손가락 거리의 비를 곱하고, 두 손가락의 가운데가 움직인 만큼 이미지도 따라간다.
 * `start`는 시작 때의 보기와 두 손가락 거리 · 가운데, `now`는 지금의 값.
 */
export function pinch(
  start: { view: View; distance: number; center: Point },
  now: { distance: number; center: Point },
  frame: Size,
): View {
  if (start.distance <= 0) return clampView(start.view, frame)
  const scale = clampScale(start.view.scale * (now.distance / start.distance))
  return clampView(
    { scale, x: start.view.x + (now.center.x - start.center.x), y: start.view.y + (now.center.y - start.center.y) },
    frame,
  )
}

/** 한 손가락 끌기: 확대돼 있을 때만 이미지가 움직인다. */
export function pan(start: View, dx: number, dy: number, frame: Size): View {
  if (start.scale <= MIN_SCALE) return IDENTITY
  return clampView({ scale: start.scale, x: start.x + dx, y: start.y + dy }, frame)
}

/** 두 번 누르기: 확대돼 있으면 처음으로, 아니면 `DOUBLE_TAP_SCALE`로 가운데에서 확대. */
export function doubleTap(view: View): View {
  return view.scale > MIN_SCALE ? IDENTITY : { scale: DOUBLE_TAP_SCALE, x: 0, y: 0 }
}

/** 방금 누름이 앞 누름과 합쳐 "두 번 누르기"인가. */
export function isDoubleTap(prev: { at: number; point: Point } | null, now: { at: number; point: Point }): boolean {
  return prev !== null && now.at - prev.at <= DOUBLE_TAP_MS && distance(prev.point, now.point) <= DOUBLE_TAP_SLOP
}

/** 배율 1에서 옆으로 민 거리가 넘김인가: -1 = 앞 사진, 1 = 뒤 사진, 0 = 아님. 왼쪽으로 밀면 뒤 사진. */
export function swipeStep(dx: number, scale: number): -1 | 0 | 1 {
  if (scale > MIN_SCALE) return 0
  if (dx <= -SWIPE_PX) return 1
  if (dx >= SWIPE_PX) return -1
  return 0
}
