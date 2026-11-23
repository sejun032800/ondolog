/**
 * 85- 우리의 하늘 2단계(MASTER 9-8-4 · 보드 N-R17-Our-Sky-2 patch9b · ROADMAP R127) - 둘러보기 + 별 반짝임 토글.
 * 가짜 데이터 · 가짜 센서 · 주입 시계 / 프레임 / 타이머(실제 시계 0 - 76-j). 원격 0.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { useSheetStore } from '../../stores/sheetStore'
import { clearAllDeviceCache, clearCoupleCache, purgeOtherUsers, readCache, writeCache } from '../../cache/deviceCache'
import { makeFakeNav } from '../../testSupport'
import type { DayRecord } from '../records/dayRecordRead'
import type { SkyData } from './skyData'
import { SkyScreen } from './SkyScreen'
import { DEFAULT_SKY_PREFS, readSkyPrefs, useSkyPrefStore } from './skyPrefs'
import {
  ENTRY, MOTION_MS, PT_PER_DEG, SENSOR_MIN_INTERVAL_MS, SENSOR_WAIT_MS, chipSide, clampPitch, cubicBezier, decideTourStart, directionIndex, dragBand,
  smoothView, viewFromOrientation, wrap180,
} from './tourMath'
import { setTourEnvForTest, setTourPlatformForTest, useSkyOrientation } from './useSkyOrientation'

// jsdom에는 PointerEvent가 없어(`clientX` · `pointerId`가 사라진다) 시험에서만 마우스 이벤트 위에 얹는다(`zoom.vitest.tsx`와 같은 방식).
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

const hoisted = vi.hoisted(() => ({ data: null as unknown, reduced: false }))
vi.mock('./skyData', () => ({
  useSky: () => hoisted.data,
  useSkyNames: () => ({ u1: '서영' }),
  useSkyPhotoUrls: (paths: string[]) => Object.fromEntries(paths.map((p) => [p, `blob:${p}`])),
}))
vi.mock('../../platform/motion', () => ({ prefersReducedMotion: () => hoisted.reduced }))

const NOW = new Date('2026-10-20T12:00:00+09:00')
const rec = (id: string, date: string): DayRecord => {
  const stops = [{ id: `${id}s1`, seq: 1, arrivedAt: `${date}T10:00:00+09:00`, placeName: '망원' }]
  return { id, date, stops, photos: [], memos: [], counts: { stops: 1, photos: 0, memos: 0 } }
}
function data(over: Partial<SkyData> = {}): SkyData {
  return {
    loading: false, error: false, allLoaded: true, temps: { '2026-10-03': 38.4, '2026-10-18': 36.5 }, tempStatus: { '2026-10': 'ok' },
    moons: [], draftPeriodStart: '2026-10-01', ensureTemps: vi.fn(),
    records: [rec('rec-0', '2026-09-14'), rec('rec-1', '2026-10-03'), rec('rec-2', '2026-10-18')], ...over,
  }
}

// ── 주입 환경: 프레임은 손으로 돌리고, 타이머는 손으로 부른다 ──
interface FakeEnv {
  clock: number
  frames: Map<number, (t: number) => void>
  timers: Map<number, () => void>
  listeners: Set<(e: Event) => void>
  adds: number
  removes: number
  flushFrames: (n?: number) => void
  fire: (o: { alpha?: number | null; beta?: number | null; webkitCompassHeading?: number }) => void
  runTimers: () => void
}
function fakeEnv(): FakeEnv {
  let seq = 0
  const env: FakeEnv = {
    clock: 0,
    frames: new Map(),
    timers: new Map(),
    listeners: new Set(),
    adds: 0,
    removes: 0,
    flushFrames(n = 1) {
      for (let i = 0; i < n; i += 1) {
        const pending = [...env.frames.values()]
        env.frames.clear()
        act(() => { for (const f of pending) f(env.clock) })
      }
    },
    fire(o) {
      const e = Object.assign(new Event('deviceorientation'), { alpha: o.alpha ?? null, beta: o.beta ?? null, webkitCompassHeading: o.webkitCompassHeading })
      act(() => { for (const l of [...env.listeners]) l(e) })
    },
    runTimers() {
      const pending = [...env.timers.values()]
      env.timers.clear()
      act(() => { for (const t of pending) t() })
    },
  }
  setTourEnvForTest({
    target: {
      addEventListener: (_t: string, l: EventListenerOrEventListenerObject) => { env.adds += 1; env.listeners.add(l as (e: Event) => void) },
      removeEventListener: (_t: string, l: EventListenerOrEventListenerObject) => { env.removes += 1; env.listeners.delete(l as (e: Event) => void) },
    },
    now: () => env.clock,
    raf: (cb) => { seq += 1; env.frames.set(seq, cb); return seq },
    caf: (id) => { env.frames.delete(id) },
    setTimer: (fn) => { seq += 1; env.timers.set(seq, fn); return seq },
    clearTimer: (h) => { env.timers.delete(h as number) },
  })
  return env
}

const W = window as unknown as Record<string, unknown>
function withOrientationApi(requestPermission?: () => Promise<string>, platform: 'ios' | 'android' = requestPermission ? 'ios' : 'android') {
  W.DeviceOrientationEvent = Object.assign(function DeviceOrientationEvent() {}, requestPermission ? { requestPermission } : {})
  setTourPlatformForTest(platform)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(NOW)
  hoisted.reduced = false
  hoisted.data = data()
  localStorage.clear()
  useAuthStore.setState({ userId: 'u1' })
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1', relationshipStartDate: '2026-01-01', grace: false, graceCoupleId: null, gracePartnerId: null })
  useSheetStore.getState().closeAll()
  useSkyPrefStore.setState({ userId: null, prefs: DEFAULT_SKY_PREFS })
})
afterEach(() => {
  cleanup()
  setTourEnvForTest(undefined)
  setTourPlatformForTest(undefined)
  delete W.DeviceOrientationEvent
  vi.useRealTimers()
  localStorage.clear()
})

// ---------------------------------------------------------------------------
describe('85- 순수 계산(tourMath)', () => {
  it('방위 감기 · 높이 제한(−10°~90°)', () => {
    expect(wrap180(190)).toBe(-170)
    expect(wrap180(-180)).toBe(180)
    expect(clampPitch(120)).toBe(90)
    expect(clampPitch(-30)).toBe(-10)
  })


  it('기기 방향 -> 바라보는 방향: beta 90 = 지평선 · 더 젖히면 위 · 값 없으면 null(85-b: 회전 행렬 - 나침반은 tourSensor85b)', () => {
    const v0 = viewFromOrientation({ alpha: 0, beta: 90 })!
    expect(v0.yaw).toBeCloseTo(0, 6)
    expect(v0.pitch).toBeCloseTo(0, 6)
    const v1 = viewFromOrientation({ alpha: 90, beta: 120 })!
    expect(v1.yaw).toBeCloseTo(270, 6)
    expect(v1.pitch).toBeCloseTo(30, 6)
    expect(viewFromOrientation({ alpha: 0, beta: 175 })!.pitch).toBeCloseTo(85, 6) // 거의 꼭대기 - 90에서 멈춤은 clampPitch
    expect(viewFromOrientation({ alpha: null, beta: 90 })).toBeNull()
  })

  it('지수 평활 α = 0.2(방위는 짧은 쪽으로)', () => {
    expect(smoothView({ yaw: 0, pitch: 0 }, { yaw: 10, pitch: 10 })).toEqual({ yaw: 2, pitch: 2 })
    const v = smoothView({ yaw: 350, pitch: 0 }, { yaw: 10, pitch: 0 })
    expect(v.yaw).toBeCloseTo(354, 6)
  })

  it('끌기(89-): 손가락 오른쪽 = 하늘도 오른쪽(왼쪽을 본다) · 위로 끌면 아래를 본다 - 아래 10°까지만 · 위로는 0°', () => {
    expect(dragBand(ENTRY, 13 * PT_PER_DEG, 0).yaw).toBeCloseTo(360 - 13, 6)
    expect(dragBand(ENTRY, 0, -10_000).down).toBe(10)
    expect(dragBand(ENTRY, 0, 10_000).down).toBe(0)
  })

  it('네 방향 이름(89-): 들어간 쪽 = 처음 만난 쪽 · 90°마다 · 경계 ±45°에 5° 여유', () => {
    expect([0, 90, 180, 270].map((y) => directionIndex(y, null))).toEqual([0, 1, 2, 3])
    expect(directionIndex(48, 0)).toBe(0)     // 45° 넘었지만 5° 여유 안 - 그대로
    expect(directionIndex(51, 0)).toBe(1)     // 50° 넘으면 바뀐다
    expect(directionIndex(42, 1)).toBe(1)     // 되돌아올 때도 같은 여유(새 이름 가운데에서 40°까지는 그대로)
    expect(directionIndex(39, 1)).toBe(0)
    expect(directionIndex(-48, 0)).toBe(0)
    expect(directionIndex(311, 0)).toBe(0)    // −49°
    expect(directionIndex(309, 0)).toBe(3)
  })

  it('"이번 달 별" 칩(89-): 보이는 별이 있으면 없음 · 다 밖이면 처음 만난 쪽으로 가는 짧은 쪽 화살표 · 별이 0이면 없음', () => {
    expect(chipSide([120], 0)).toBeNull()
    expect(chipSide([120], 70)).toBe('left')    // 오른쪽으로 돌아 있으면 ‹
    expect(chipSide([120], 290)).toBe('right')  // 왼쪽으로 돌아 있으면 ›
    expect(chipSide([], 180)).toBeNull()
  })

  it('들어가는 길: 줄인 모션 · API 없음 -> 끌기 / iOS -> C09(거부 뒤 끌기) / Android -> 센서', () => {
    expect(decideTourStart({ reduced: true, hasApi: true, needsPermission: false, denied: false })).toBe('drag')
    expect(decideTourStart({ reduced: false, hasApi: false, needsPermission: false, denied: false })).toBe('drag')
    expect(decideTourStart({ reduced: false, hasApi: true, needsPermission: true, denied: false })).toBe('ask')
    expect(decideTourStart({ reduced: false, hasApi: true, needsPermission: true, denied: true })).toBe('drag')
    expect(decideTourStart({ reduced: false, hasApi: true, needsPermission: false, denied: false })).toBe('sensor')
  })

  it('곡선 cubic-bezier(.2,.8,.2,1) 끝점 · 움직임 측정', () => {
    const e = cubicBezier(0.2, 0.8, 0.2, 1)
    expect(e(0)).toBe(0)
    expect(e(1)).toBe(1)
    expect(e(0.5)).toBeGreaterThan(0.8)
  })
})

// ---------------------------------------------------------------------------
describe('85- 센서 - 보일 때만 리스너 · 30Hz · 평활 · 저장 · 전송 0', () => {
  it('active일 때만 붙고, 꺼지면 떼어진다(붙임 · 해제 횟수)', () => {
    const env = fakeEnv()
    const { rerender, unmount } = renderHook(({ on }) => useSkyOrientation(on), { initialProps: { on: false } })
    expect(env.adds).toBe(0)
    rerender({ on: true })
    expect(env.adds).toBe(1)
    expect(env.listeners.size).toBe(1)
    rerender({ on: false })
    expect(env.removes).toBe(1)
    expect(env.listeners.size).toBe(0)
    unmount()
    expect(env.adds).toBe(1)
  })

  it('30Hz로 솎고 프레임마다 α = 0.2 평활(주입 시계)', () => {
    const env = fakeEnv()
    const { result } = renderHook(() => useSkyOrientation(true))
    env.fire({ alpha: 0, beta: 90 })
    env.flushFrames()
    expect(result.current.view).toEqual({ yaw: 0, pitch: 0 })
    expect(result.current.status).toBe('live')
    env.clock = SENSOR_MIN_INTERVAL_MS - 1
    env.fire({ alpha: 0, beta: 140 }) // 33ms 안 - 버림
    env.flushFrames()
    expect(result.current.view?.pitch).toBe(0)
    env.clock = SENSOR_MIN_INTERVAL_MS + 1
    env.fire({ alpha: 0, beta: 100 })
    env.flushFrames()
    expect(result.current.view?.pitch).toBeCloseTo(2, 6) // 0 + (10 - 0) * 0.2
    env.flushFrames()
    expect(result.current.view?.pitch).toBeCloseTo(3.6, 6)
  })

  it(`값이 ${SENSOR_WAIT_MS}ms 안에 한 번도 없으면 센서 없음`, () => {
    const env = fakeEnv()
    const { result } = renderHook(() => useSkyOrientation(true))
    expect(result.current.status).toBe('waiting')
    env.runTimers()
    expect(result.current.status).toBe('none')
  })

  it('런타임: 센서 값이 저장소 · 네트워크로 가지 않는다', () => {
    const env = fakeEnv()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('no network')))
    renderHook(() => useSkyOrientation(true))
    for (let i = 0; i < 10; i += 1) {
      env.clock += 40
      env.fire({ alpha: i * 10, beta: 90 + i })
      env.flushFrames(2)
    }
    expect(setItem).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    setItem.mockRestore()
    fetchSpy.mockRestore()
  })

  it('정적: 둘러보기 파일에 저장소 · 네트워크 코드가 없다', () => {
    const forbidden = /localStorage|sessionStorage|indexedDB|\bfetch\b|XMLHttpRequest|sendBeacon|Preferences|getSupabase|writeCache|WebSocket/
    for (const f of ['tourMath.ts', 'useSkyOrientation.ts', 'SkyTour.tsx']) {
      const code = fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\*\*|\*|\/\/)/.test(l)).join('\n')
      expect(code, f).not.toMatch(forbidden)
    }
  })
})

// ---------------------------------------------------------------------------
const tourOpen = () => screen.getByTestId('sky-tour-open')
const tourEl = () => screen.queryByTestId('sky-tour')

describe('85- C01 [둘러보기] 칩', () => {
  it('✕ 왼쪽 같은 줄 · 읽기 이름 "하늘 둘러보기" · 글자 "둘러보기" · 자동 진입 0 · C01 안내 "위로 끌면 지난 하늘" 그대로', () => {
    fakeEnv()
    render(<SkyScreen nav={makeFakeNav()} />)
    const btn = tourOpen()
    expect(btn.getAttribute('aria-label')).toBe('하늘 둘러보기')
    expect(screen.getByTestId('sky-tour-open-text').textContent).toBe('둘러보기')
    expect(btn.parentElement?.lastElementChild).toBe(screen.getByTestId('sky-close'))
    expect(tourEl()).toBeNull()
    expect(screen.getByTestId('sky-hint').textContent).toBe('위로 끌면 지난 하늘')
  })

  it('빈 하늘 · 별 시트 · 지난 하늘에서는 칩 없음', () => {
    fakeEnv()
    hoisted.data = data({ records: [] })
    const { unmount } = render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.queryByTestId('sky-tour-open')).toBeNull()
    unmount()
    hoisted.data = data()
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('sky-star-2026-10-03'))
    expect(screen.queryByTestId('sky-tour-open')).toBeNull()
  })

  it('CSS: 380pt 미만이면 글자를 숨기고 40pt 원(✕와 같은 크기)', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../styles.css'), 'utf8')
    const block = css.slice(css.indexOf('@media (max-width: 379.98px)'))
    expect(block).toMatch(/\.skyTourBtn \{ width: 40px;[^}]*border-radius: 50%/)
    expect(block).toMatch(/\.skyTourBtnText \{ display: none; \}/)
  })
})

describe('85- C08-alt 끌기 · C10 처음 한 번', () => {
  it('센서 API 없음 -> 끌기 · C10(끌기 문구) · [알겠어요] -> 기기에만 봤음 · 다시 열면 C10 0', () => {
    fakeEnv()
    const { unmount } = render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(tourEl()?.getAttribute('data-mode')).toBe('drag')
    expect(screen.getByTestId('sky-guide').textContent).toContain('손가락으로 하늘을 끌어 보세요')
    expect(screen.queryByTestId('sky-drag-hint')).toBeNull() // 안내가 먼저
    fireEvent.click(screen.getByTestId('sky-guide-ok'))
    expect(screen.queryByTestId('sky-guide')).toBeNull()
    expect(readCache(  'u1', 'skypref', 'guide')).toEqual({ seen: true })
    expect(screen.getByTestId('sky-drag-hint').textContent).toContain('손가락으로 하늘을 끌어 보세요')
    unmount()
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(screen.queryByTestId('sky-guide')).toBeNull()
  })

  it('첫 끌기에서 힌트가 사라지고 다시 안 나옴 · 끌면 하늘 한 장(원본 · 별 · 지평선 - 띠)이 함께 돈다(89-)', () => {
    fakeEnv()
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    const band = () => screen.getByTestId('sky-band')
    const before = band().style.transform
    expect(band().contains(screen.getByTestId('sky-tour-star-2026-10-03'))).toBe(true)   // 별은 띠의 자식
    expect(band().querySelectorAll('img.skyPano')).toHaveLength(2)                       // 원본 두 장도 띠의 자식
    const field = tourEl() as HTMLElement
    fireEvent.pointerDown(field, { pointerId: 1, clientX: 200, clientY: 400 })
    fireEvent.pointerMove(field, { pointerId: 1, clientX: 240, clientY: 400 })
    fireEvent.pointerUp(field, { pointerId: 1, clientX: 240, clientY: 400 })
    expect(screen.queryByTestId('sky-drag-hint')).toBeNull()
    expect(readCache('u1', 'skypref', 'dragHint')).toEqual({ seen: true })
    expect(band().style.transform).not.toBe(before)
    expect(band().style.transform).toMatch(/^translate3d\(/)
  })

  it('줄인 모션 -> 끌기 · 관성 없음 · 별 반짝임 없음', () => {
    const env = fakeEnv()
    hoisted.reduced = true
    withOrientationApi()
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(tourEl()?.getAttribute('data-mode')).toBe('drag')
    expect(tourEl()?.className).toContain('noTwinkle')
    const field = tourEl() as HTMLElement
    fireEvent.pointerDown(field, { pointerId: 1, clientX: 200, clientY: 400 })
    fireEvent.pointerMove(field, { pointerId: 1, clientX: 260, clientY: 400 })
    fireEvent.pointerUp(field, { pointerId: 1, clientX: 260, clientY: 400 })
    expect(env.frames.size).toBe(0) // 관성 프레임 0
  })
})

describe('85- C08 센서 둘러보기', () => {
  it('센서 yaw대로 하늘이 돈다 · 들어간 쪽 = 처음 만난 쪽 · D+ · 안내는 숨김 · 머리 "{M}월의 하늘"(89-)', () => {
    const env = fakeEnv()
    withOrientationApi()
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(tourEl()?.getAttribute('data-mode')).toBe('sensor')
    expect(env.adds).toBe(1)
    expect(screen.queryByTestId('sky-days')).toBeNull()
    expect(screen.queryByTestId('sky-hint')).toBeNull()
    expect(screen.getByTestId('sky-title').textContent).toBe('10월의 하늘')
    env.fire({ alpha: 0, beta: 90 })
    env.flushFrames()
    expect(screen.getByTestId('sky-dir').textContent).toBe('처음 만난 쪽')
    expect(screen.queryByTestId('sky-compass')).toBeNull()                 // 눈금 · 방위 글자 0
    env.clock += 100
    env.fire({ webkitCompassHeading: 123, alpha: 270, beta: 90 })          // 오른쪽으로 90° - 나침반 값은 쓰지 않는다
    env.flushFrames(80)
    expect(screen.getByTestId('sky-dir').textContent).toBe('함께 웃던 쪽')
    expect(Number(tourEl()?.getAttribute('data-yaw'))).toBeCloseTo(90, 0)
  })

  it('이번 달 별이 화면 밖이면 칩 -> 누르면 0.8초 동안 처음 만난 쪽으로 돈 뒤 칩이 사라짐(89-)', () => {
    const env = fakeEnv()
    withOrientationApi()
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    env.fire({ alpha: 0, beta: 90 })
    env.flushFrames()
    env.clock += 100
    env.fire({ alpha: 180, beta: 90 })   // 뒤로 180° - 이번 달 별(들어가는 창 안)이 모두 화면 밖
    env.flushFrames(80)
    expect(screen.getByTestId('sky-tour-chip').textContent).toMatch(/이번 달 별/)
    expect(MOTION_MS.chipTurn).toBe(800)
    fireEvent.click(screen.getByTestId('sky-tour-chip'))
    env.clock += MOTION_MS.chipTurn / 2
    env.flushFrames()
    env.clock += MOTION_MS.chipTurn
    env.flushFrames()
    expect(screen.queryByTestId('sky-tour-chip')).toBeNull()
    expect(screen.getAllByTestId(/^sky-tour-star-/).length).toBeGreaterThan(0)
  })

  it('C10(센서): "폰을 하늘 쪽으로 들어 보세요" · 폰이 20° 넘게 움직이면 닫힘', () => {
    const env = fakeEnv()
    withOrientationApi()
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(screen.getByTestId('sky-guide').textContent).toContain('폰을 하늘 쪽으로 들어 보세요')
    env.fire({ alpha: 0, beta: 90 })
    env.flushFrames()
    env.clock += 100
    env.fire({ alpha: 0, beta: 115 })     // 위아래로만 - 89-: 둘러보기는 yaw만 본다(닫히지 않음)
    env.flushFrames(30)
    expect(screen.getByTestId('sky-guide')).toBeTruthy()
    env.clock += 100
    env.fire({ alpha: 330, beta: 90 })    // 오른쪽으로 30°
    env.flushFrames(30)
    expect(screen.queryByTestId('sky-guide')).toBeNull()
    expect(readCache('u1', 'skypref', 'guide')).toEqual({ seen: true })
  })

  it('센서가 값을 주지 않으면 끌기 모드로', () => {
    const env = fakeEnv()
    withOrientationApi()
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    env.runTimers()
    expect(tourEl()?.getAttribute('data-mode')).toBe('drag')
    expect(env.listeners.size).toBe(0)
  })

  it('별을 누르면 기존 C04 시트(새 시트 0) · ✕는 시트만', () => {
    const env = fakeEnv()
    withOrientationApi()
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    env.fire({ alpha: 0, beta: 90 })
    env.flushFrames()
    fireEvent.click(screen.getByTestId('sky-tour-star-2026-10-03'))
    expect(screen.getByTestId('sky-sheet-day')).toBeTruthy()
    fireEvent.click(screen.getByTestId('sky-close'))
    expect(screen.queryByTestId('sky-sheet-day')).toBeNull()
    expect(tourEl()).toBeTruthy()
  })

  it('✕ = C01로(메인 아님) · 나가기 시작 때 리스너 해제 · 처음 만난 쪽으로 500ms + 이름 180ms 뒤 C01 칩이 돌아온다(89-)', () => {
    const env = fakeEnv()
    withOrientationApi()
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    const nav = makeFakeNav()
    render(<SkyScreen nav={nav} />)
    fireEvent.click(tourOpen())
    expect(env.listeners.size).toBe(1)
    fireEvent.click(screen.getByTestId('sky-close'))
    expect(nav.back).not.toHaveBeenCalled()
    expect(env.listeners.size).toBe(0) // 나가기 시작 시점에 해제
    expect(tourEl()?.className).toContain('leave')
    act(() => { vi.advanceTimersByTime(MOTION_MS.exit) })
    expect(tourEl()).toBeTruthy()                       // 아직 돌아가는 중
    act(() => { vi.advanceTimersByTime(MOTION_MS.exitTurn) })
    expect(tourEl()).toBeNull()
    expect(tourOpen()).toBeTruthy()
  })
})

describe('85- C09 iOS 움직임 권한 앞 화면(코드만 - 실행 확인은 Mac 뒤)', () => {
  it('[움직임 사용하기] 허용 -> 센서', async () => {
    fakeEnv()
    const ask = vi.fn(async () => 'granted')
    withOrientationApi(ask)
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(screen.getByTestId('sky-motion-ask').textContent).toContain('움직임 정보는 이 폰 안에서만 쓰고, 저장하거나 보내지 않아요.')
    await act(async () => { fireEvent.click(screen.getByTestId('sky-motion-allow')) })
    expect(ask).toHaveBeenCalledTimes(1)
    expect(tourEl()?.getAttribute('data-mode')).toBe('sensor')
  })

  it('거부 -> 끌기 · 기기에 거부 기록 -> 다음엔 C09 없이 끌기', async () => {
    fakeEnv()
    withOrientationApi(async () => 'denied')
    writeCache('u1', 'skypref', { seen: true }, 'guide')
    const { unmount } = render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    await act(async () => { fireEvent.click(screen.getByTestId('sky-motion-allow')) })
    expect(tourEl()?.getAttribute('data-mode')).toBe('drag')
    expect(readCache('u1', 'skypref', 'motion')).toEqual({ denied: true })
    unmount()
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(screen.queryByTestId('sky-motion-ask')).toBeNull()
    expect(tourEl()?.getAttribute('data-mode')).toBe('drag')
  })

  it('[손가락으로 둘러볼게요] -> 권한을 묻지 않고 끌기', () => {
    fakeEnv()
    const ask = vi.fn(async () => 'granted')
    withOrientationApi(ask)
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    fireEvent.click(screen.getByTestId('sky-motion-drag'))
    expect(ask).not.toHaveBeenCalled()
    expect(tourEl()?.getAttribute('data-mode')).toBe('drag')
  })

  it('Android는 권한 함수가 있어도 C09 없음(최근 Chromium 웹뷰에도 함수가 있다) -> 센서', () => {
    fakeEnv()
    withOrientationApi(async () => 'granted', 'android')
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(tourOpen())
    expect(screen.queryByTestId('sky-motion-ask')).toBeNull()
    expect(tourEl()?.getAttribute('data-mode')).toBe('sensor')
  })
})

describe('85- 별 반짝임(기기에만)', () => {
  it('끄면 하늘 화면에 noTwinkle(배경 별 + 데이트 별 모두 정지 - CSS) · 켜면 다시', () => {
    fakeEnv()
    const { container } = render(<SkyScreen nav={makeFakeNav()} />)
    const root = () => container.querySelector('[data-testid="sky-screen"]') as HTMLElement
    expect(root().className).not.toContain('noTwinkle')
    act(() => { useSkyPrefStore.getState().setTwinkle(false) })
    expect(root().className).toContain('noTwinkle')
    expect(readCache('u1', 'skypref', 'twinkle')).toEqual({ on: false })
    const css = fs.readFileSync(path.join(__dirname, '../../styles.css'), 'utf8')
    expect(css).toMatch(/\.skyScreen\.noTwinkle \.star \{ animation: none !important;/)
    expect(css).toMatch(/\.skyScreen\.noTwinkle \.skyStar \.glow,[^{]*\{ animation: none !important;/)
  })

  it('기기 저장: 사용자 키 · 깨진 값은 기본(켬) · 로그아웃 · 계정 전환 때 지움 · 해제 완료 때 남김', () => {
    writeCache('u1', 'skypref', { on: false }, 'twinkle')
    expect(readSkyPrefs('u1').twinkle).toBe(false)
    expect(readSkyPrefs('u2').twinkle).toBe(true)
    clearCoupleCache('u1')
    expect(readSkyPrefs('u1').twinkle).toBe(false)
    purgeOtherUsers('u2')
    expect(readSkyPrefs('u1').twinkle).toBe(true)
    writeCache('u2', 'skypref', { on: false }, 'twinkle')
    clearAllDeviceCache()
    expect(readSkyPrefs('u2').twinkle).toBe(true)
    localStorage.setItem('ondolog.dc1:u1:skypref:twinkle', '{"__v":1,"d":{"on":"아니"}}')
    expect(readSkyPrefs('u1').twinkle).toBe(true)
  })
})
