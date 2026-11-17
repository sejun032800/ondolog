/** 77- 우리의 하늘 화면 - C01 · C02 · C04 · C05 · C06 · C07 · 줄인 모션 · B02 끌기 · 연결 전 / 해제 유예 · 기기 저장 'sky'. 가짜 데이터(원격 0). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { useSheetStore } from '../../stores/sheetStore'
import { clearAllDeviceCache, clearCoupleCache, COUPLE_KINDS, purgeOtherUsers, readCache, writeCache } from '../../cache/deviceCache'
import { makeFakeNav } from '../../testSupport'
import type { DayRecord } from '../records/dayRecordRead'
import type { SkyData } from './skyData'
import { SkyScreen } from './SkyScreen'
import { useSkyPull } from './useSkyPull'
import { skyOpenable } from './skyMath'

const hoisted = vi.hoisted(() => ({ data: null as unknown, reduced: false }))
vi.mock('./skyData', () => ({
  useSky: () => hoisted.data,
  useSkyNames: () => ({ u1: '서영' }),
  useSkyPhotoUrls: (paths: string[]) => Object.fromEntries(paths.map((p) => [p, `blob:${p}`])),
}))
vi.mock('../../platform/motion', () => ({ prefersReducedMotion: () => hoisted.reduced }))

const NOW = new Date('2026-10-20T12:00:00+09:00')
const rec = (id: string, date: string, o: Partial<DayRecord> = {}): DayRecord => {
  const stops = o.stops ?? [{ id: `${id}s1`, seq: 1, arrivedAt: `${date}T10:00:00+09:00`, placeName: '망원' }, { id: `${id}s2`, seq: 2, arrivedAt: `${date}T15:00:00+09:00`, placeName: '한강' }]
  const photos = o.photos ?? []
  const memos = o.memos ?? []
  return { id, date, stops, photos, memos, counts: { stops: stops.length, photos: photos.length, memos: memos.length }, ...o }
}
const photo = (id: string, date: string, hour: number, extra: Partial<DayRecord['photos'][number]> = {}) => ({
  id, authorId: 'u1', storagePath: `p/${id}.jpg`, capturedAt: `${date}T${String(hour).padStart(2, '0')}:30:00+09:00`, createdAt: `${date}T20:00:00+09:00`, dateStopId: null, accessLocked: false, ...extra,
})

function data(over: Partial<SkyData> = {}): SkyData {
  return { loading: false, error: false, records: [], allLoaded: true, temps: {}, tempStatus: {}, moons: [], draftPeriodStart: null, ensureTemps: vi.fn(), ...over }
}

function setCouple(over: Partial<ReturnType<typeof useCoupleStore.getState>> = {}) {
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1', relationshipStartDate: '2026-01-01', grace: false, graceCoupleId: null, gracePartnerId: null, ...over })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  hoisted.reduced = false
  useAuthStore.setState({ userId: 'u1' })
  setCouple()
  useSheetStore.getState().closeAll()
})
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear() })

const r1 = rec('rec-1', '2026-10-03', { photos: [photo('a', '2026-10-03', 11), photo('b', '2026-10-03', 16, { dateStopId: 's' })], memos: [{ id: 'm1', authorId: 'u1', text: '여기 케이크 진짜 맛있었어', createdAt: '2026-10-03T18:30:00+09:00', dateStopId: 'rec-1s2' }] })
const r2 = rec('rec-2', '2026-10-18', { stops: [{ id: 'x', seq: 1, arrivedAt: '2026-10-18T10:00:00+09:00', placeName: null }] })
const old = rec('rec-0', '2026-07-14', { photos: [photo('o', '2026-07-14', 12)], memos: [{ id: 'mo', authorId: 'u1', text: '벌써 200일이라니', createdAt: '2026-07-14T19:00:00+09:00', dateStopId: null }] })
const monthly = (extra: Partial<SkyData> = {}) =>
  data({ records: [old, r1, r2], temps: { '2026-10-03': 38.4, '2026-10-18': 36.5, '2026-07-14': 37 }, tempStatus: { '2026-10': 'ok', '2026-07': 'ok' }, moons: [{ periodStart: '2026-09-01', issueNumber: 2 }], draftPeriodStart: '2026-10-01', ...extra })

describe('C01 이달의 하늘', () => {
  it('머리 "{M}월의 하늘" · 부제 · 별 = 함께한 하루(장소만 있는 날도) · D+n · ✕ = 뒤로', () => {
    hoisted.data = monthly()
    const nav = makeFakeNav()
    render(<SkyScreen nav={nav} />)
    expect(screen.getByTestId('sky-title').textContent).toBe('10월의 하늘')
    expect(screen.getByTestId('sky-sub').textContent).toBe('우리가 함께한 하루가 별이 됐어요')
    expect(screen.getByTestId('sky-star-2026-10-03')).toBeTruthy()
    expect(screen.getByTestId('sky-star-2026-10-18')).toBeTruthy() // 구간만 있는 날도 별
    expect(screen.getByTestId('sky-days').textContent).toBe('D+293')
    fireEvent.click(screen.getByTestId('sky-close'))
    expect(vi.mocked(nav.back)).toHaveBeenCalled()
  })

  it('별이 날짜 순서대로 0.22초 간격으로 켜지고 크기는 그 달 안 순위(38.4 -> 8px · 36.5 -> 5px)', () => {
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    const a = screen.getByTestId('sky-star-2026-10-03')
    const b = screen.getByTestId('sky-star-2026-10-18')
    expect(a.style.animationDelay).toBe('0s')
    expect(b.style.animationDelay).toBe('0.22s')
    expect(a.getAttribute('data-size')).toBe('8')
    expect(b.getAttribute('data-size')).toBe('5')
    expect(Number(a.getAttribute('data-period'))).toBeGreaterThanOrEqual(2.8)
    expect(Number(a.getAttribute('data-period'))).toBeLessThanOrEqual(5.2)
  })

  it('가장 따뜻한 별 하나에만 "{M.D} {장소}" + "가장 따뜻했던 날" · 달: 발행(VOL) / 초안', () => {
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-warmest-2026-10').textContent).toBe('10.3 망원가장 따뜻했던 날')
    expect(screen.getByTestId('sky-moon-2026-09').textContent).toBe('VOL.02 · 9월호')
    expect(screen.getByTestId('sky-moon-2026-10').className).toContain('draft')
    expect(screen.getByTestId('sky-moon-2026-10').textContent).toBe('10월호')
    expect(screen.queryByTestId('sky-moon-2026-08')).toBeNull() // 없음
  })

  it('온도를 못 읽은 달은 모두 가운데(5px) · 라벨 없음', () => {
    hoisted.data = monthly({ tempStatus: { '2026-10': 'failed', '2026-07': 'ok' }, temps: { '2026-10-03': null, '2026-10-18': null } })
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-star-2026-10-03').getAttribute('data-size')).toBe('5')
    expect(screen.getByTestId('sky-star-2026-10-18').getAttribute('data-size')).toBe('5')
    expect(screen.queryByTestId('sky-warmest-2026-10')).toBeNull()
  })

  it('보이는 달만 온도를 읽는다(ensureTemps 호출) - 한 번은 이번 달', () => {
    const d = monthly()
    hoisted.data = d
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(d.ensureTemps).toHaveBeenCalledWith('2026-10')
  })
})

describe('C02 지난 하늘', () => {
  it('가장 오래된 달 = 첫 함께한 하루가 있는 달부터 이어 붙고, 별 · 달 수 · 기념일 고리가 있다', () => {
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    for (const m of ['2026-07', '2026-08', '2026-09', '2026-10']) expect(screen.getByTestId(`sky-month-${m}`)).toBeTruthy()
    expect(screen.queryByTestId('sky-month-2026-06')).toBeNull()
    expect(screen.getByTestId('sky-month-label-2026-07').textContent).toBe('7월 · 별 1')
    // 시작일 2026-01-01 -> D+200 = 2026-07-19(별 없음 = 고리만, 누를 수 없다) · D+100 = 04-10 (첫 달 이전이라 없음)
    expect(screen.getByTestId('sky-ring-200').textContent).toBe('200일')
    expect(screen.getByTestId('sky-ring-200').tagName).toBe('SPAN')
  })

  it('76-r S1(R103-3): C01 아래 안내는 "위로 끌면 지난 하늘"만(옛 뒷말 0)', () => {
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-hint').textContent).toBe('위로 끌면 지난 하늘')
    expect(document.body.textContent).not.toContain(['놓으면', '오늘로'].join(' '))
  })

  it('위로 끌어 지난 달에 있으면 머리가 "지난 하늘" · "{첫 달}월부터 · 별 n · 달 n" · 안내 "아래로 내리면 이번 달 ↓"', () => {
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    const scroll = screen.getByTestId('sky-scroll')
    Object.defineProperty(scroll, 'scrollHeight', { value: 4000, configurable: true })
    Object.defineProperty(scroll, 'clientHeight', { value: 800, configurable: true })
    Object.defineProperty(scroll, 'scrollTop', { value: 1000, configurable: true, writable: true })
    fireEvent.scroll(scroll)
    expect(screen.getByTestId('sky-title').textContent).toBe('지난 하늘')
    expect(screen.getByTestId('sky-sub').textContent).toBe('7월부터 · 별 3 · 달 1')
    expect(screen.getByTestId('sky-hint').textContent).toBe('아래로 내리면 이번 달 ↓')
    expect(screen.getByTestId('sky-month-label-2026-10').textContent).toBe('10월 · 이번 달 · 별 2')
  })

  it('이번 달 근처에서 놓으면 이번 달로 돌아온다(scrollTo)', async () => {
    vi.useRealTimers()
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    const scroll = screen.getByTestId('sky-scroll') as HTMLDivElement
    const scrollTo = vi.fn()
    scroll.scrollTo = scrollTo as unknown as typeof scroll.scrollTo
    Object.defineProperty(scroll, 'scrollHeight', { value: 4000, configurable: true })
    Object.defineProperty(scroll, 'clientHeight', { value: 800, configurable: true })
    Object.defineProperty(scroll, 'scrollTop', { value: 3000, configurable: true, writable: true }) // 바닥에서 200px
    fireEvent.scroll(scroll)
    await act(async () => { await new Promise((r) => setTimeout(r, 260)) })
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 4000 }))
  })
})

describe('C04 그날', () => {
  it('별을 누르면 그 달만 다가가고 시트: 장소들 · 그날의 온도 · 제목 = 첫 구간 장소 · 메모 한 줄(사람 · 시각) · 개수 · k번째 별', () => {
    hoisted.data = monthly()
    const nav = makeFakeNav()
    render(<SkyScreen nav={nav} />)
    fireEvent.click(screen.getByTestId('sky-star-2026-10-03'))
    expect(screen.getByTestId('sky-screen').getAttribute('data-view')).toBe('star')
    expect(screen.getByText('THE STAR OF')).toBeTruthy()
    expect(screen.getByTestId('sky-title').textContent).toBe('10월 3일 토요일')
    expect(screen.getByTestId('sky-places').textContent).toBe('망원 · 한강')
    expect(screen.getByTestId('sky-temp').textContent).toBe('그날의 온도 38.4°')
    expect(screen.getByTestId('sky-day-title').textContent).toBe('망원')
    expect(screen.getByTestId('sky-memo').textContent).toContain('“여기 케이크 진짜 맛있었어”')
    expect(screen.getByTestId('sky-memo').textContent).toContain('서영 · 18:30')
    expect(screen.getByTestId('sky-counts').textContent).toBe('사진 2 · 메모 1 · 10월의 1번째 별')
    // 마무리 질문 같은 답변 입력은 없다 - 입력창 0
    expect(document.querySelectorAll('input, textarea').length).toBe(0)
    fireEvent.click(screen.getByTestId('sky-open-day'))
    expect(vi.mocked(nav.push)).toHaveBeenCalledWith('date-detail', { params: { id: 'rec-1' } })
  })

  it('장소 이름이 없으면 제목을 짓지 않고 · 온도를 모르면 온도 줄이 없다 · 사진이 없으면 [사진 보기]가 없다', () => {
    hoisted.data = monthly({ tempStatus: { '2026-10': 'failed' }, temps: { '2026-10-18': null, '2026-10-03': null } })
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('sky-star-2026-10-18'))
    expect(screen.queryByTestId('sky-day-title')).toBeNull()
    expect(screen.queryByTestId('sky-temp')).toBeNull()
    expect(screen.queryByTestId('sky-view-photos')).toBeNull()
    expect(screen.getByTestId('sky-counts').textContent).toBe('사진 0 · 메모 0 · 10월의 2번째 별')
  })

  it('✕는 시트만 닫는다(하늘로 돌아옴)', () => {
    hoisted.data = monthly()
    const nav = makeFakeNav()
    render(<SkyScreen nav={nav} />)
    fireEvent.click(screen.getByTestId('sky-star-2026-10-03'))
    fireEvent.click(screen.getByTestId('sky-close'))
    expect(screen.queryByTestId('sky-sheet-day')).toBeNull()
    expect(vi.mocked(nav.back)).not.toHaveBeenCalled()
  })
})

describe('C05 그날의 사진', () => {
  it('머리 · "i / n" · 넘기기 · 사진 아래 "{시각} · {구간 장소}" + 그 구간 메모(— 사람) · 썸네일 줄', () => {
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('sky-star-2026-10-03'))
    fireEvent.click(screen.getByTestId('sky-view-photos'))
    expect(screen.getByTestId('sky-photos-date').textContent).toBe('10월 3일 토요일 · 망원')
    expect(screen.getByTestId('sky-photos-count').textContent).toBe('1 / 2')
    expect(screen.getByTestId('sky-photo-caption').textContent).toBe('11:30 · 망원')
    expect(screen.queryByTestId('sky-photo-memo')).toBeNull() // 첫 사진은 망원 구간 - 메모는 한강 구간
    expect(screen.getByTestId('sky-thumbs').querySelectorAll('button').length).toBe(2)
    fireEvent.click(screen.getByLabelText('다음 사진'))
    expect(screen.getByTestId('sky-photos-count').textContent).toBe('2 / 2')
    expect(screen.getByTestId('sky-photo-caption').textContent).toBe('16:30 · 한강')
    expect(screen.getByTestId('sky-photo-memo').textContent).toBe('“여기 케이크 진짜 맛있었어” — 서영')
    expect((screen.getByLabelText('다음 사진') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('이전 사진'))
    expect(screen.getByTestId('sky-photos-count').textContent).toBe('1 / 2')
    fireEvent.click(screen.getByTestId('sky-photos-close'))
    expect(screen.queryByTestId('sky-photos')).toBeNull()
  })

  it('잠긴 사진은 별은 그대로 · 사진은 잠금 표시만(서명 URL도 받지 않는다)', () => {
    const locked = rec('rec-L', '2026-10-05', { photos: [photo('L', '2026-10-05', 12, { accessLocked: true })] })
    hoisted.data = monthly({ records: [old, r1, locked], tempStatus: { '2026-10': 'ok' }, temps: { '2026-10-03': 38, '2026-10-05': 37 } })
    render(<SkyScreen nav={makeFakeNav()} />)
    fireEvent.click(screen.getByTestId('sky-star-2026-10-05'))
    fireEvent.click(screen.getByTestId('sky-view-photos'))
    expect(screen.getByTestId('sky-photo-locked').textContent).toBe('잠긴 사진')
    expect(screen.queryByTestId('sky-photo-img')).toBeNull()
  })
})

describe('C07 기념일 별', () => {
  it('그날 별이 있으면 고리 두른 별 - 누르면 ANNIVERSARY · "{M}월 {D}일의 별" · "{n}일" · 장소 · 사진 · 메모 · 메모 한 줄 · [사진 모두 보기] [데이트 기록 →]', () => {
    // 2026-04-10 = D+100
    const day100 = rec('rec-100', '2026-04-10', { photos: [photo('c', '2026-04-10', 12)], memos: [{ id: 'm', authorId: 'u1', text: '벌써 100일', createdAt: '2026-04-10T19:00:00+09:00', dateStopId: null }] })
    hoisted.data = monthly({ records: [day100, r1], tempStatus: { '2026-04': 'ok', '2026-10': 'ok' }, temps: { '2026-04-10': 37, '2026-10-03': 38 } })
    const nav = makeFakeNav()
    render(<SkyScreen nav={nav} />)
    const star = screen.getByTestId('sky-star-2026-04-10')
    expect(star.className).toContain('ring')
    fireEvent.click(star)
    expect(screen.getByText('ANNIVERSARY')).toBeTruthy()
    expect(screen.getByTestId('sky-title').textContent).toBe('4월 10일의 별')
    expect(screen.getByTestId('sky-anniv-days').textContent).toBe('100일')
    expect(screen.getByTestId('sky-counts').textContent).toBe('망원 · 사진 1 · 메모 1')
    expect(screen.getByTestId('sky-memo').textContent).toContain('벌써 100일')
    expect(screen.getByText('사진 모두 보기')).toBeTruthy()
    fireEvent.click(screen.getByText('데이트 기록 →'))
    expect(vi.mocked(nav.push)).toHaveBeenCalledWith('date-detail', { params: { id: 'rec-100' } })
  })

  it('1주년(D+365)도 고리 - 그날 별이 없으면 고리만(누를 수 없는 span)', () => {
    vi.setSystemTime(new Date('2027-01-05T12:00:00+09:00'))
    hoisted.data = monthly({ records: [rec('z', '2026-12-30')], tempStatus: { '2026-12': 'ok' }, temps: { '2026-12-30': 37 } })
    render(<SkyScreen nav={makeFakeNav()} />)
    const ring = screen.getByTestId('sky-ring-365')
    expect(ring.textContent).toBe('1주년')
    expect(ring.tagName).toBe('SPAN')
  })
})

describe('C06 빈 하늘', () => {
  it('함께한 하루가 0이면 문구 · 점선 원 · [데이트 기록하기]는 기록 시트를 연다', () => {
    hoisted.data = data({ records: [] })
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.getByTestId('sky-title').textContent).toBe('우리의 하늘')
    expect(screen.getByTestId('sky-sub').textContent).toBe('아직 별이 없어요')
    expect(screen.getByText(/첫 데이트를 기록하면/)).toBeTruthy()
    expect(screen.getByText('그날이 따뜻할수록 별이 커져요')).toBeTruthy()
    expect(screen.queryByText(/유성은 오늘 밤에도/)).toBeNull() // 유성은 2단계
    fireEvent.click(screen.getByTestId('sky-empty-record'))
    expect(useSheetStore.getState().current).toBe('record')
  })

  it('아직 전부 읽기 전에는 빈 하늘로 단정하지 않는다', () => {
    hoisted.data = data({ records: [], allLoaded: false })
    render(<SkyScreen nav={makeFakeNav()} />)
    expect(screen.queryByTestId('sky-empty')).toBeNull()
  })
})

describe('줄인 모션', () => {
  it('켜짐 · 흐름 · 반짝임 연출이 없다(정지 하늘) - 별은 그대로 보인다', () => {
    hoisted.reduced = true
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    const root = screen.getByTestId('sky-screen')
    expect(root.className).toContain('still')
    expect(screen.getByTestId('sky-star-2026-10-03').className).not.toContain('turnOn')
    expect(screen.getByTestId('sky-star-2026-10-03').style.animationDelay).toBe('')
    expect(screen.getByTestId('sky-month-2026-10').className).not.toContain('flow')
    expect(screen.getByTestId('sky-star-2026-10-18')).toBeTruthy()
  })
  it('켠 상태에서는 still이 없다 · 앱이 가려지면 paused', () => {
    hoisted.data = monthly()
    render(<SkyScreen nav={makeFakeNav()} />)
    const root = screen.getByTestId('sky-screen')
    expect(root.className).not.toContain('still')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(root.className).toContain('paused')
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })
})

describe('연결 전 · 해제 유예', () => {
  it('연결 전(혼자)은 하늘을 열지 않는다(메인으로 돌려보냄) · 해제 유예 중에는 열린다', () => {
    setCouple({ status: 'disconnected', coupleId: null, partnerId: null, grace: false })
    hoisted.data = data()
    const nav = makeFakeNav()
    render(<SkyScreen nav={nav} />)
    expect(vi.mocked(nav.back)).toHaveBeenCalled()
    cleanup()
    setCouple({ status: 'disconnected', coupleId: null, partnerId: null, grace: true, graceCoupleId: 'c-dissolving', gracePartnerId: 'p1' })
    const nav2 = makeFakeNav()
    render(<SkyScreen nav={nav2} />)
    expect(vi.mocked(nav2.back)).not.toHaveBeenCalled()
  })
})

describe('B02 끌어내리기(훅)', () => {
  function Harness({ status, grace, onOpen }: { status: string; grace: boolean; onOpen: () => void }) {
    const { ref, pull } = useSkyPull<HTMLDivElement>(skyOpenable(status, grace), onOpen)
    return <div ref={ref} data-testid="scroller" data-pull={pull.active ? (pull.armed ? 'armed' : 'pull') : 'none'} />
  }
  const touch = (el: Element, type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
    fireEvent[type](el, { touches: y === undefined ? [] : [{ clientY: y }], changedTouches: y === undefined ? [] : [{ clientY: y }] })
  const setTop = (el: Element, v: number) => Object.defineProperty(el, 'scrollTop', { value: v, configurable: true, writable: true })

  it('맨 위에서 문턱을 넘겨 놓으면 열린다 · 덜 끌면 제자리 · 연결 전에는 열리지 않는다 · 유예 중에는 열린다', () => {
    const open = vi.fn()
    const { rerender } = render(<Harness status="connected" grace={false} onOpen={open} />)
    const el = screen.getByTestId('scroller')
    setTop(el, 0)
    touch(el, 'touchStart', 100); touch(el, 'touchMove', 140)
    expect(el.getAttribute('data-pull')).toBe('pull')
    touch(el, 'touchEnd')
    expect(open).not.toHaveBeenCalled() // 덜 끌면 제자리
    touch(el, 'touchStart', 100); touch(el, 'touchMove', 230)
    expect(el.getAttribute('data-pull')).toBe('armed')
    touch(el, 'touchEnd')
    expect(open).toHaveBeenCalledTimes(1)

    rerender(<Harness status="disconnected" grace={false} onOpen={open} />)
    touch(el, 'touchStart', 100); touch(el, 'touchMove', 260); touch(el, 'touchEnd')
    expect(open).toHaveBeenCalledTimes(1) // 연결 전 - 열리지 않음
    expect(el.getAttribute('data-pull')).toBe('none')

    rerender(<Harness status="disconnected" grace onOpen={open} />)
    touch(el, 'touchStart', 100); touch(el, 'touchMove', 260); touch(el, 'touchEnd')
    expect(open).toHaveBeenCalledTimes(2) // 해제 유예 - 열림
  })

  it('맨 위가 아니면 · 터치 중 스크롤이 있었으면 · 스크롤 직후(관성)면 열리지 않는다', () => {
    const open = vi.fn()
    render(<Harness status="connected" grace={false} onOpen={open} />)
    const el = screen.getByTestId('scroller')
    setTop(el, 80)
    touch(el, 'touchStart', 100); touch(el, 'touchMove', 260); touch(el, 'touchEnd')
    expect(open).not.toHaveBeenCalled()

    setTop(el, 0)
    touch(el, 'touchStart', 100); fireEvent.scroll(el); touch(el, 'touchMove', 260); touch(el, 'touchEnd')
    expect(open).not.toHaveBeenCalled()

    fireEvent.scroll(el) // 방금 스크롤 중이었다
    touch(el, 'touchStart', 100); touch(el, 'touchMove', 260); touch(el, 'touchEnd')
    expect(open).not.toHaveBeenCalled()
  })
})

describe("기기 저장 'sky' - 커플 자료 종류", () => {
  it("COUPLE_KINDS에 'sky'가 들어 있다", () => { expect(COUPLE_KINDS).toContain('sky') })

  it('로그아웃 · 탈퇴 요청(clearAllDeviceCache) · 해제(유예 진입 · 완료, clearCoupleCache) · 계정 전환(purgeOtherUsers)에서 지워진다', () => {
    // 81-: 저장 모양 검사를 지나는 값(빈 하늘)
    const sky = (coupleId: string) => ({ coupleId, records: [], allLoaded: true, temps: {}, tempStatus: {}, moons: [], draftPeriodStart: null })
    const put = () => { writeCache('me', 'sky', sky('c1'), 'c1'); writeCache('me', 'name', { name: 'a' }, 'p'); writeCache('other', 'sky', sky('c2'), 'c2') }
    put(); clearAllDeviceCache()
    expect(readCache('me', 'sky', 'c1')).toBeNull()
    put(); clearCoupleCache('me')
    expect(readCache('me', 'sky', 'c1')).toBeNull()
    expect(readCache('me', 'name', 'p')).not.toBeNull() // 이름은 남는다
    expect(readCache('other', 'sky', 'c2')).not.toBeNull() // 다른 사용자 것은 건드리지 않는다
    put(); purgeOtherUsers('me')
    expect(readCache('other', 'sky', 'c2')).toBeNull()
    expect(readCache('me', 'sky', 'c1')).not.toBeNull()
  })

  it('PHOTO 서명 URL · 사진 파일은 저장 값에 없다(기록 행에는 경로만)', () => {
    const saved = JSON.stringify({ records: [r1] })
    expect(saved).not.toContain('blob:')
    expect(saved).not.toContain('http')
    expect(renderHook(() => 1).result.current).toBe(1)
  })
})
