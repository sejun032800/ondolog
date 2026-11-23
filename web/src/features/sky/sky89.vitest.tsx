/**
 * 89- 우리의 하늘 감성 고도화(디자인 patch10 · 보드 `N-R17b-Our-Sky-3` · ROADMAP r149 R149-6 · R149-8 · MASTER r82 §9-8-4).
 * 가짜 데이터 · 주입 시계 / 프레임(실제 시계 0) · 원격 0.
 *  - 2-1 하늘 한 장: 각도 -> 띠 x(되돌림 · 들어가는 45° = C01) · 세로 10° 한도 · 원본 해시 = 문서 쪽 원본 · V40 정적 점검
 *  - 2-2 켜짐 연출(그날 처음 열 때만) · 반짝임 끔 범위
 *  - 2-3 네 방향 이름 · 칩 800ms 짧은 쪽
 *  - 2-4 시각 경계 표
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { useSheetStore } from '../../stores/sheetStore'
import { clearAllDeviceCache, clearCoupleCache, purgeOtherUsers, readCache } from '../../cache/deviceCache'
import { makeFakeNav } from '../../testSupport'
import type { DayRecord } from '../records/dayRecordRead'
import type { SkyData } from './skyData'
import { SkyScreen } from './SkyScreen'
import { DEFAULT_SKY_PREFS, useSkyPrefStore } from './skyPrefs'
import { STAR_ON_MS, STAR_ON_STEP_MS, shouldLightUp, skyClock } from './skyMath'
import { METEOR_SPARKS } from './Meteor'
import {
  CIRC_PT, DIRECTION_NAMES, DOWN_MAX_DEG, MOTION_MS, PANO_PX, PT_PER_DEG, WINDOW_PT, backgroundStarSpots, bandLiftPt, bandShiftPt, chipSide, directionIndex,
  dragBand, ENTRY, groundPath,
} from './tourMath'
import { setTourEnvForTest, setTourPlatformForTest } from './useSkyOrientation'

const hoisted = vi.hoisted(() => ({ data: null as unknown, reduced: false }))
vi.mock('./skyData', () => ({
  useSky: () => hoisted.data,
  useSkyNames: () => ({ u1: '서영' }),
  useSkyPhotoUrls: (paths: string[]) => Object.fromEntries(paths.map((p) => [p, `blob:${p}`])),
}))
vi.mock('../../platform/motion', () => ({ prefersReducedMotion: () => hoisted.reduced }))

const NOW = new Date('2026-10-20T12:00:00+09:00')
const rec = (id: string, date: string): DayRecord => ({
  id, date, stops: [{ id: `${id}s1`, seq: 1, arrivedAt: `${date}T10:00:00+09:00`, placeName: '망원' }], photos: [], memos: [], counts: { stops: 1, photos: 0, memos: 0 },
})
const data = (): SkyData => ({
  loading: false, error: false, allLoaded: true, temps: { '2026-10-03': 38.4, '2026-10-18': 36.5 }, tempStatus: { '2026-10': 'ok' },
  moons: [], draftPeriodStart: '2026-10-01', ensureTemps: vi.fn(),
  records: [rec('rec-0', '2026-09-14'), rec('rec-1', '2026-10-03'), rec('rec-2', '2026-10-18')],
})

interface Env { clock: number; frames: Map<number, (t: number) => void>; listeners: Set<(e: Event) => void> }
function fakeEnv(): Env {
  let seq = 0
  const env: Env = { clock: 0, frames: new Map(), listeners: new Set() }
  setTourEnvForTest({
    target: {
      addEventListener: (_t: string, l: EventListenerOrEventListenerObject) => { env.listeners.add(l as (e: Event) => void) },
      removeEventListener: (_t: string, l: EventListenerOrEventListenerObject) => { env.listeners.delete(l as (e: Event) => void) },
    },
    now: () => env.clock,
    raf: (cb) => { seq += 1; env.frames.set(seq, cb); return seq },
    caf: (id) => { env.frames.delete(id) },
    setTimer: () => 0,
    clearTimer: () => {},
    screenAngle: () => 0,
  })
  return env
}
const flush = (env: Env, n = 1) => {
  for (let i = 0; i < n; i += 1) {
    const pending = [...env.frames.values()]
    env.frames.clear()
    act(() => { for (const f of pending) f(env.clock) })
  }
}
const fire = (env: Env, alpha: number) => {
  const e = Object.assign(new Event('deviceorientation'), { alpha, beta: 90, gamma: 0 })
  act(() => { for (const l of [...env.listeners]) l(e) })
}
const W = window as unknown as Record<string, unknown>

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
describe('89- 2-1 하늘 한 장 - 띠 좌표', () => {
  it('1° = 8.656pt(보드) · 둘레 3116.8pt = 원본 폭 3896 ÷ 1.25 · 원본 폭 < V40 텍스처 한도 4096', () => {
    expect(CIRC_PT).toBeCloseTo(3116.8, 6)
    expect(PT_PER_DEG).toBeCloseTo(8.656, 2)
    expect(PANO_PX.width).toBeLessThan(4096)
  })

  it('각도 -> 띠 x: 들어간 쪽(0°) = 0(C01 그림) · 오른쪽을 보면 왼쪽으로 · 둘레만큼 되돌림((−둘레/2, 둘레/2]) · 한 바퀴 = 제자리', () => {
    expect(bandShiftPt(0)).toBe(0)
    expect(bandShiftPt(10)).toBeCloseTo(-10 * PT_PER_DEG, 6)
    expect(bandShiftPt(350)).toBeCloseTo(10 * PT_PER_DEG, 6)
    expect(bandShiftPt(360)).toBe(0)
    expect(bandShiftPt(720 + 45)).toBeCloseTo(-45 * PT_PER_DEG, 6)   // 45° = 화면 폭 390pt만큼
    expect(Math.abs(bandShiftPt(45))).toBeCloseTo(WINDOW_PT, 0)
    for (let y = 0; y < 360; y += 7) {
      const w = bandShiftPt(y)
      expect(w).toBeGreaterThan(-CIRC_PT / 2 - 1e-9)
      expect(w).toBeLessThanOrEqual(CIRC_PT / 2 + 1e-9)
    }
  })

  it('세로: 아래로 10°(87pt)까지만 · 위로는 0 · 끌기에서만(센서는 yaw 하나)', () => {
    expect(bandLiftPt(0)).toBe(-0)
    expect(bandLiftPt(30)).toBeCloseTo(-DOWN_MAX_DEG * PT_PER_DEG, 6)
    expect(Math.round(-bandLiftPt(99))).toBe(87)
    expect(bandLiftPt(-5)).toBe(-0)
    expect(dragBand(ENTRY, 0, -1000).down).toBe(10)
  })

  it('지평선: 0~390pt는 C01 실루엣 줄로 시작 · 둘레 끝(3116.8, 779)에서 처음 높이로 이어짐 · 배경 별은 보이는 범위에 한 번씩', () => {
    const d = groundPath()
    expect(d.startsWith('M0 779 C 60 775, 120 762, 205 761 S 330 768, 390 764')).toBe(true)
    expect(d.endsWith(`${CIRC_PT} 779`)).toBe(true)
    const spots = backgroundStarSpots()
    expect(new Set(spots.map((s) => s.i)).size).toBe(20)
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(-CIRC_PT / 2)
      expect(s.x).toBeLessThanOrEqual(CIRC_PT / 2 + WINDOW_PT)
    }
  })

  it('원본: 앱 자산 = 문서 쪽 원본(바이트까지 같음)', () => {
    const root = path.join(__dirname, '../../../..')
    const hash = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
    const app = hash(path.join(root, 'web/public/img/sky_pano_360.jpg'))
    expect(app).toBe(hash(path.join(root, 'docs/design/nocturne/sky/sky_pano_360.jpg')))
    expect(app).toBe('4095232c633170af54119a3cf2058e07c1be7559a11d15f4d1388a3e147d887a')
  })
})

// ---------------------------------------------------------------------------
describe('89- 2-3 네 방향 이름 · 칩', () => {
  it('이름 넷(고정 문구) · 들어간 쪽 = 처음 만난 쪽 · 경계 ±45° + 5° 여유(경계에서 깜빡이지 않음)', () => {
    expect(DIRECTION_NAMES).toEqual(['처음 만난 쪽', '함께 웃던 쪽', '나란히 걷던 쪽', '서로 기다리던 쪽'])
    // 경계(45°) 근처에서 흔들려도 한 번만 바뀐다
    let cur = directionIndex(0, null)
    const seen: number[] = [cur]
    for (const y of [44, 46, 49, 44, 47, 50.5, 47, 43, 41, 39.5]) {
      const next = directionIndex(y, cur)
      if (next !== cur) seen.push(next)
      cur = next
    }
    expect(seen).toEqual([0, 1, 0])
  })

  it('칩: 처음 만난 쪽으로 짧은 쪽 · 800ms(patch9b 600 -> 800)', () => {
    expect(MOTION_MS.chipTurn).toBe(800)
    expect(chipSide([100, 300], 200)).toBe('right')   // 200° = −160° -> 오른쪽으로 160°가 짧다
    expect(chipSide([100, 300], 100)).toBe('left')
  })

  it('화면: 칩을 누르면 짧은 쪽(200° -> 360°, 줄어들지 않음)으로 800ms 돈 뒤 처음 만난 쪽 · 이름 · 칩 사라짐', () => {
    const env = fakeEnv()
    W.DeviceOrientationEvent = function DeviceOrientationEvent() {}
    setTourPlatformForTest('android')
    useSkyPrefStore.setState({ userId: 'u1', prefs: { ...DEFAULT_SKY_PREFS, guideSeen: true } })
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('sky-tour-open'))
    fire(env, 0)
    flush(env)
    env.clock += 100
    fire(env, 160)                 // yaw = 200°
    flush(env, 80)
    const tour = screen.getByTestId('sky-tour')
    expect(Number(tour.getAttribute('data-yaw'))).toBeCloseTo(200, 0)
    expect(screen.getByTestId('sky-dir').textContent).toBe('나란히 걷던 쪽')
    fireEvent.click(screen.getByTestId('sky-tour-chip'))
    const t0 = env.clock
    env.clock = t0 + 400
    flush(env)
    const mid = Number(tour.getAttribute('data-yaw'))
    expect(mid).toBeGreaterThan(200)         // 짧은 쪽 = 오른쪽(늘어남)
    env.clock = t0 + 800
    flush(env)
    expect(Number(tour.getAttribute('data-yaw')) % 360).toBeCloseTo(0, 3)
    expect(screen.queryByTestId('sky-tour-chip')).toBeNull()
    flush(env)
    expect(screen.getByTestId('sky-dir').textContent).toBe('처음 만난 쪽')
  })
})

// ---------------------------------------------------------------------------
describe('89- 2-2 켜짐 연출 - 그날 처음 열 때만', () => {
  it('규칙: 본 날과 오늘이 다르면 켜짐 · 같으면 없음 · 45ms 간격 · 700ms', () => {
    expect(shouldLightUp(null, '2026-10-20')).toBe(true)
    expect(shouldLightUp('2026-10-19', '2026-10-20')).toBe(true)
    expect(shouldLightUp('2026-10-20', '2026-10-20')).toBe(false)
    expect(STAR_ON_STEP_MS).toBe(45)
    expect(STAR_ON_MS).toBe(700)
  })

  it('같은 날 두 번째 0 · 다음 날 다시 · 기기 하늘 범주에만(로그아웃 · 계정 전환 · 해제 때 지움)', () => {
    const first = render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-star-2026-10-03').className).toContain('turnOn')
    expect(readCache('u1', 'sky', 'lit:c1')).toEqual({ day: '2026-10-20' })
    first.unmount()
    const second = render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-star-2026-10-03').className).not.toContain('turnOn')
    second.unmount()
    vi.setSystemTime(new Date('2026-10-21T00:10:00+09:00'))   // KST 다음 날
    const third = render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-star-2026-10-03').className).toContain('turnOn')
    third.unmount()
    clearAllDeviceCache()   // 로그아웃
    expect(readCache('u1', 'sky', 'lit:c1')).toBeNull()
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(readCache('u1', 'sky', 'lit:c1')).toEqual({ day: '2026-10-21' })
    clearCoupleCache('u1')  // 해제(커플 자료)
    expect(readCache('u1', 'sky', 'lit:c1')).toBeNull()
    render(<SkyScreen nav={makeFakeNav()} />)
    purgeOtherUsers('u2')   // 계정 전환
    expect(readCache('u1', 'sky', 'lit:c1')).toBeNull()
  })

  it('줄인 모션이면 켜짐 연출 없음 · 둘러보기 띠 안의 별은 켜짐 없음', () => {
    hoisted.reduced = true
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-star-2026-10-03').className).not.toContain('turnOn')
  })
})

// ---------------------------------------------------------------------------
describe('89- 반짝임 끔 · 줄인 모션 범위(PM 확인 ②)', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../styles.css'), 'utf8')
  const rulesFor = (prefix: string) => css.split('\n').filter((l) => l.includes(prefix)).join('\n')

  it('반짝임 끔: 별 숨 · 배경 별 숨 · 고리 회전 · 달 후광이 멈춤 / 켜짐 연출 · 유성은 그대로', () => {
    const off = rulesFor('.noTwinkle')
    for (const sel of ['.star', '.skyStar .glow', '.ringMark', '.moonHalo']) expect(off).toContain(`.skyScreen.noTwinkle ${sel}`)
    expect(off).not.toMatch(/turnOn|glowWrap|meteor/)
  })

  it('줄인 모션: 켜짐 연출 · 흐름 · 숨 · 고리 회전 · 달 후광 정지', () => {
    const still = rulesFor('.skyScreen.still')
    for (const sel of ['.skyDrift', '.star', '.skyStar .glow', '.skyStar', '.ringMark', '.moonHalo']) expect(still).toContain(`.skyScreen.still ${sel}`)
  })
})

// ---------------------------------------------------------------------------
describe('89- 2-4 시각 표기(KST · 12시간제 · 0분이면 "분" 생략)', () => {
  const at = (hm: string) => `2026-09-01T${hm}:00+09:00`
  it.each([
    ['00:00', '밤 12시'], ['02:59', '밤 2시 59분'], ['03:00', '새벽 3시'], ['05:59', '새벽 5시 59분'], ['06:00', '아침 6시'],
    ['11:00', '낮 11시'], ['12:00', '낮 12시'], ['16:59', '낮 4시 59분'], ['17:00', '저녁 5시'], ['21:30', '밤 9시 30분'], ['23:59', '밤 11시 59분'],
  ])('%s -> %s', (hm, want) => {
    expect(skyClock(at(hm))).toBe(want)
  })
  it('UTC 입력도 KST로 · 읽을 수 없으면 빈 글자', () => {
    expect(skyClock('2026-09-01T12:30:00Z')).toBe('밤 9시 30분')
    expect(skyClock(null)).toBe('')
    expect(skyClock('nope')).toBe('')
  })
})

// ---------------------------------------------------------------------------
describe('89- V40 정적 점검', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../styles.css'), 'utf8')
  const NEW_KEYFRAMES = ['skyBreath', 'skyOn', 'skyOnGlow', 'skyRingSpin', 'skyMoonHalo', 'skyDirsRise', 'skyDirIn', 'skyDirOut', 'meteorFlare', 'meteorSpark',
    'meteorMove', 'meteorFade', 'meteorTailGrow', 'meteorTailShrink', 'tourIn', 'tourOut', 'twinkle']

  it('움직이는 속성은 transform · opacity뿐(하늘 · 유성 키프레임)', () => {
    for (const name of NEW_KEYFRAMES) {
      const m = css.match(new RegExp(`@keyframes ${name} \\{([^@]*?)\\}\\s*\\}`))
      expect(m, name).not.toBeNull()
      const props = [...(m as RegExpMatchArray)[1].matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1])
      for (const p of props) expect(['transform', 'opacity'], `${name}: ${p}`).toContain(p)
    }
  })

  it('하늘 띠가 둘러보기 안의 유일한 합성층(will-change) · 원본은 <img> 두 장 · 배경 위치 애니메이션 0', () => {
    const tourCss = css.slice(css.indexOf('/* 89- 하늘 한 장'), css.indexOf('/* 89- 네 방향 이름'))
    expect(tourCss.match(/will-change/g)).toHaveLength(1)
    expect(tourCss).toMatch(/\.skyBand \{[^}]*will-change: transform/)
    expect(css).not.toMatch(/background-position[^;]*;[^}]*animation|@keyframes [^{]*\{[^}]*background-position/)
    const sky = css.slice(css.indexOf('/* 89- 별 3단계'), css.indexOf('/* ═══ 78-'))
    expect(sky).not.toMatch(/will-change/)
    const src = fs.readFileSync(path.join(__dirname, 'SkyTour.tsx'), 'utf8')
    expect(src.match(/<img className="skyPano"/g)).toHaveLength(2)
    expect(src).toMatch(/translate3d\(/)
    expect(src).not.toMatch(/backgroundPosition/)
  })

  it('유성: 꼬리 96 · 0.35초 · 빛 4개를 0.5초마다 · 사라지기 150 + 450ms', () => {
    expect(METEOR_SPARKS.map((s) => s.atMs)).toEqual([500, 1000, 1500, 2000])
    expect(css).toMatch(/\.meteorTail \{[^}]*animation: meteorTailGrow 350ms/)
    expect(css).toMatch(/meteorFade 450ms ease-in 2550ms/)
    expect(css).toMatch(/meteorFlare 150ms ease-out 2400ms/)
    expect(fs.readFileSync(path.join(__dirname, 'Meteor.tsx'), 'utf8')).toMatch(/const TAIL = 96/)
  })
})
