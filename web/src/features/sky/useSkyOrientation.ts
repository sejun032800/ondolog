/**
 * 85- 둘러보기 센서(MASTER 9-8-4 "C08이 보일 때만 리스너 · 기기 안에서만 · 저장 · 전송 0") - 웹 기기 방향 API(`deviceorientation`)만. 새 패키지 0.
 *  - `active`일 때만 리스너를 붙이고, 아니면(나가기 시작 · 앱이 뒤로 · 화면 밖) 바로 뗀다.
 *  - 30Hz로 솎고(모션표) 그리기 프레임마다 지수 평활 α = 0.2. 값은 메모리의 숫자뿐 - 저장소 · 네트워크로 보내는 코드가 이 파일에 없다.
 *  - 85-b: 세 각도(alpha · beta · gamma) -> 회전 행렬 -> 시선(`lookFromOrientation`) · 화면 방향 보정 · iOS 나침반은 차이만 따라감(`nextCompass`).
 *  - 붙인 뒤 `SENSOR_WAIT_MS` 안에 값이 한 번도 없으면 `none`(센서 없음) -> 부르는 쪽이 끌기 모드로.
 * 시계 · 프레임 · 타이머 · 이벤트 대상은 주입할 수 있다(시험은 실제 시계 0 - 76-j).
 */
import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { COMPASS_NONE, SENSOR_MIN_INTERVAL_MS, SENSOR_WAIT_MS, lookFromOrientation, nextCompass, smoothView, withCompass, type CompassState, type View } from './tourMath'

export interface TourEnv {
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null
  now: () => number
  raf: (cb: (t: number) => void) => number
  caf: (id: number) => void
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (h: unknown) => void
  /** 화면 방향(도, 세로 0 · 가로 90/270). */
  screenAngle: () => number
}

/** 지금 화면 방향 - `screen.orientation.angle`, 없으면 옛 `window.orientation`, 그것도 없으면 0. */
function readScreenAngle(): number {
  if (typeof window === 'undefined') return 0
  const a = (window.screen as Screen | undefined)?.orientation?.angle
  if (typeof a === 'number' && Number.isFinite(a)) return a
  const legacy = (window as unknown as { orientation?: unknown }).orientation
  return typeof legacy === 'number' && Number.isFinite(legacy) ? legacy : 0
}

function defaultEnv(): TourEnv {
  const w = typeof window !== 'undefined' ? window : null
  return {
    target: w,
    now: () => (typeof performance !== 'undefined' ? performance.now() : 0),
    raf: (cb) => (w?.requestAnimationFrame ? w.requestAnimationFrame(cb) : (setTimeout(() => cb(0), 16) as unknown as number)),
    caf: (id) => (w?.cancelAnimationFrame ? w.cancelAnimationFrame(id) : clearTimeout(id)),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as number),
    screenAngle: readScreenAngle,
  }
}

let envOverride: Partial<TourEnv> | null = null
/** 시험용 - 시계 · 프레임 · 타이머 · 이벤트 대상을 바꿔 끼운다(undefined면 되돌림). */
export function setTourEnvForTest(env: Partial<TourEnv> | undefined): void {
  envOverride = env ?? null
}
export function tourEnv(): TourEnv {
  return { ...defaultEnv(), ...(envOverride ?? {}) }
}

/** 이 기기에 방향 API가 있는가. */
export function hasOrientationApi(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

let platformOverride: string | null = null
/** 시험용 - 플랫폼(ios · android · web)을 바꿔 끼운다(undefined면 되돌림). */
export function setTourPlatformForTest(p: string | undefined): void {
  platformOverride = p ?? null
}

/**
 * C09(권한 앞 화면)를 띄울 곳인가 - **iOS 앱에서만**(MASTER 9-8-4 "Android는 이 화면 없음"). iOS이고 `DeviceOrientationEvent.requestPermission`이 있을 때.
 * 최근 Chromium(Android 웹뷰 포함)에도 같은 함수가 있어 함수만으로 가르면 Android에 C09가 뜬다 - 플랫폼으로 가른다.
 */
export function orientationPermissionNeeded(): boolean {
  if ((platformOverride ?? Capacitor.getPlatform()) !== 'ios') return false
  if (!hasOrientationApi()) return false
  const ctor = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent
  return typeof ctor?.requestPermission === 'function'
}

/** iOS 권한 창(C09 [움직임 사용하기]). 허용이면 true. 던지지 않는다. */
export async function requestOrientationPermission(): Promise<boolean> {
  try {
    const ctor = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
    if (typeof ctor?.requestPermission !== 'function') return true
    return (await ctor.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

export type SensorStatus = 'waiting' | 'live' | 'none'

/**
 * 센서 -> 평활된 방향. `active`가 거짓이면 리스너 0 · 프레임 0.
 * 반환: 지금 방향(처음 값이 오기 전 null) · 상태 · 첫 값(C10 "20° 움직임" 기준).
 */
export function useSkyOrientation(active: boolean): { view: View | null; status: SensorStatus; first: View | null } {
  const [view, setView] = useState<View | null>(null)
  const [status, setStatus] = useState<SensorStatus>('waiting')
  const firstRef = useRef<View | null>(null)
  const [first, setFirst] = useState<View | null>(null)

  useEffect(() => {
    if (!active) return
    const env = tourEnv()
    if (!env.target) {
      setStatus('none')
      return
    }
    let target: View | null = null
    let smooth: View | null = null
    let lastAt = -Infinity
    let frame: number | null = null
    let gotAny = false
    let compass: CompassState = COMPASS_NONE

    const tick = () => {
      frame = null
      if (!target) return
      smooth = smooth ? smoothView(smooth, target) : target
      setView(smooth)
      const settled = Math.abs(((smooth.yaw - target.yaw + 540) % 360) - 180) < 0.05 && Math.abs(smooth.pitch - target.pitch) < 0.05
      if (!settled) frame = env.raf(tick)
    }

    const onEvent = (e: Event) => {
      const at = env.now()
      if (at - lastAt < SENSOR_MIN_INTERVAL_MS) return // 30Hz로 솎음
      const o = e as DeviceOrientationEvent & { webkitCompassHeading?: number }
      const look = lookFromOrientation({ alpha: o.alpha, beta: o.beta, gamma: o.gamma }, env.screenAngle())
      if (!look) return
      compass = nextCompass(compass, o.webkitCompassHeading, look)
      const v = withCompass(look, compass)
      lastAt = at
      target = v
      if (!gotAny) {
        gotAny = true
        firstRef.current = v
        setFirst(v)
        setStatus('live')
      }
      if (frame === null) frame = env.raf(tick)
    }

    setStatus('waiting')
    env.target.addEventListener('deviceorientation', onEvent)
    const wait = env.setTimer(() => { if (!gotAny) setStatus('none') }, SENSOR_WAIT_MS)
    return () => {
      env.target?.removeEventListener('deviceorientation', onEvent)
      env.clearTimer(wait)
      if (frame !== null) env.caf(frame)
    }
  }, [active])

  return { view, status, first }
}
