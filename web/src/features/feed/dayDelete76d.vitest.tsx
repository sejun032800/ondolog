/**
 * 76-d 하루 지우기(R98-8 · R101-4) 앱 시험 - 밀기 · 확인 · 취소 · 오프라인 막힘 · 지운 뒤 카드 두 가지 · 기기 저장분(피드 · 하늘) 갱신 · 기록 신호.
 * 서버는 가짜(`feedTestSupport.ts`의 `fn_delete_my_day` - 76-m3 규칙 그대로). 원격 0. 서버 규칙 자체는 PGlite 시험(`__tests__/db/dayDelete76m3.test.ts`).
 * 폰에서만 확인되는 것: 손가락 밀기 감 · 세로 스크롤과 겹침 0 · 하늘 별 변화.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { readCache, writeCache } from '../../cache/deviceCache'
import { clearSignedUrlCache } from '../../cache/signedUrlCache'
import { ToastHost } from '../../components/ToastHost'
import { useConnectionStore } from '../../connection/connectionMonitor'
import { useCoupleStore } from '../../stores/coupleStore'
import { useToastStore } from '../../stores/toastStore'
import { makeFakeNav } from '../../testSupport'
import { FeedTab } from '../../tabs/FeedTab'
import { DAY_DELETE_COPY, patchSkyCache } from './dayDelete'
import { useFeedSignal } from './feedData'
import { SWIPE_ACTION_W } from './FeedView'
import { COUPLE_ROW, PROFILES, dateRow, makeFeedDb, memoRow, photoRow, stopRow, type FeedDbOptions } from './feedTestSupport'

// jsdom에 PointerEvent가 없으면 좌표가 실리지 않는다 - 마우스 이벤트 위에 pointerId만 얹은 대용.
if (typeof window.PointerEvent === 'undefined') {
  class FakePointerEvent extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1 }
  }
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent
}

function useDb(opts: Partial<FeedDbOptions> = {}) {
  const db = makeFeedDb({ me: 'me', couples: [COUPLE_ROW], profiles: PROFILES, ...opts })
  setSupabaseForTest(db.client)
  return db
}

beforeEach(() => {
  localStorage.clear()
  clearSignedUrlCache()
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
  useToastStore.getState().hide()
  useConnectionStore.setState({ offline: false })
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
  useConnectionStore.setState({ offline: false })
})

/** 왼쪽으로 민다(가로 문턱을 넘겨 [지우기] 폭의 절반 이상). */
function swipeLeft(el: HTMLElement, dx = -(SWIPE_ACTION_W + 10)) {
  fireEvent.pointerDown(el, { clientX: 200, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: 190, clientY: 101, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 102, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 102, pointerId: 1 })
}
const front = (id: string) => screen.getByTestId(`day-swipe-${id}`).querySelector('[data-testid="swipe-front"]') as HTMLElement

const ONLY_MINE = { dates: [dateRow('d1', '2026-10-03')], stops: [{ ...stopRow('s1', 'd1', 0, '2026-10-03T03:00:00Z', '연남동'), author_id: 'me' }], entries: [photoRow('p1'), memoRow('m1', '내 메모')] }
const SHARED = {
  dates: [dateRow('d1', '2026-10-03')],
  entries: [photoRow('p1'), memoRow('m1', '내 메모'), photoRow('p2', { author_id: 'you' }), memoRow('m2', '상대 메모', { author_id: 'you' })],
}

describe('밀기', () => {
  it('왼쪽으로 밀면 오른쪽에 [지우기]가 드러나고, 열린 카드를 누르면 열지 않고 닫는다', async () => {
    useDb(ONLY_MINE)
    const nav = makeFakeNav()
    render(<FeedTab nav={nav} />)
    await screen.findByTestId('day-swipe-d1')
    swipeLeft(front('d1'))
    expect(screen.getByTestId('day-swipe-d1').className).toContain('open')
    expect(front('d1').style.transform).toBe(`translate3d(${-SWIPE_ACTION_W}px, 0, 0)`)
    fireEvent.click(front('d1').querySelector('button') as HTMLElement) // 민 직후 클릭은 삼킨다
    expect(nav.push).not.toHaveBeenCalled()
    fireEvent.click(front('d1').querySelector('button') as HTMLElement) // 열린 채 누르면 닫힘
    expect(screen.getByTestId('day-swipe-d1').className).not.toContain('open')
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('세로로 먼저 움직이면 밀기가 아니다(세로 스크롤과 겹치지 않음)', async () => {
    useDb(ONLY_MINE)
    render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('day-swipe-d1')
    const el = front('d1')
    fireEvent.pointerDown(el, { clientX: 200, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 198, clientY: 130, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 80, clientY: 140, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 80, clientY: 140, pointerId: 1 })
    expect(screen.getByTestId('day-swipe-d1').className).not.toContain('open')
    expect(el.style.transform).toBe('')
  })

  it('미연결이면 밀기가 없다', async () => {
    useCoupleStore.setState({ status: 'disconnected', coupleId: null, partnerId: null, grace: false })
    useDb({ ...ONLY_MINE, couples: [] })
    render(<FeedTab nav={makeFakeNav()} />)
    await waitFor(() => expect(screen.queryByTestId('feed-skeleton')).toBeNull())
    expect(screen.queryByTestId('day-swipe-d1')).toBeNull()
  })
})

describe('확인 · 취소', () => {
  it('[지우기] -> 확인 문구 그대로 · [취소]면 아무것도 지우지 않는다', async () => {
    const db = useDb(ONLY_MINE)
    render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('day-swipe-d1')
    swipeLeft(front('d1'))
    fireEvent.click(screen.getByTestId('day-delete-action'))
    const dialog = screen.getByTestId('day-delete-confirm')
    expect(dialog.textContent).toContain('이 날 내가 남긴 장소 · 사진 · 메모를 지울까요? 상대가 남긴 것은 남아요. 이미 발행된 호에서는 지워지지 않아요.')
    expect(DAY_DELETE_COPY.confirm).toBe('이 날 내가 남긴 장소 · 사진 · 메모를 지울까요? 상대가 남긴 것은 남아요. 이미 발행된 호에서는 지워지지 않아요.')
    fireEvent.click(screen.getByTestId('confirm-no'))
    expect(screen.queryByTestId('day-delete-confirm')).toBeNull()
    expect(db.rpcCalls).toEqual([])
    expect(screen.getByTestId('day-swipe-d1')).toBeTruthy()
  })

  it('내 것만 있던 날: 확인하면 RPC 하나 -> 카드가 사라진다(기기 저장분에서도)', async () => {
    const db = useDb(ONLY_MINE)
    const before = useFeedSignal.getState().version
    render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('day-swipe-d1')
    swipeLeft(front('d1'))
    fireEvent.click(screen.getByTestId('day-delete-action'))
    await act(async () => { fireEvent.click(screen.getByTestId('confirm-yes')) })
    expect(db.rpcCalls).toEqual([{ fn: 'fn_delete_my_day', args: { p_date_id: 'd1' } }])
    expect(db.writes).toEqual([]) // 앱은 표를 직접 고치지 않는다
    await waitFor(() => expect(screen.queryByTestId('day-swipe-d1')).toBeNull())
    expect(await screen.findByTestId('feed-empty')).toBeTruthy()
    expect(useFeedSignal.getState().version).toBeGreaterThan(before)
    const saved = readCache<{ chapters: { dates: { id: string }[] }[] }>('me', 'feed')
    expect(saved?.chapters.flatMap((c) => c.dates.map((d) => d.id)) ?? []).not.toContain('d1')
  })

  it('상대 것이 남는 날: 카드는 남고 남은 것만 보인다(사진 1 · 메모 1)', async () => {
    useDb(SHARED)
    render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('day-swipe-d1')
    expect(screen.getByText('사진 2 · 메모 2')).toBeTruthy()
    swipeLeft(front('d1'))
    fireEvent.click(screen.getByTestId('day-delete-action'))
    await act(async () => { fireEvent.click(screen.getByTestId('confirm-yes')) })
    await waitFor(() => expect(screen.getByText('사진 1 · 메모 1')).toBeTruthy())
    expect(screen.getByTestId('day-swipe-d1')).toBeTruthy()
    expect(screen.getByText(/상대 메모/)).toBeTruthy()
  })

  it('서버가 실패하면 짧은 안내 · 카드 그대로(부분 삭제 0)', async () => {
    useDb({ ...ONLY_MINE, dayDeleteFails: true })
    render(<><FeedTab nav={makeFakeNav()} /><ToastHost aboveTabBar /></>)
    await screen.findByTestId('day-swipe-d1')
    swipeLeft(front('d1'))
    fireEvent.click(screen.getByTestId('day-delete-action'))
    await act(async () => { fireEvent.click(screen.getByTestId('confirm-yes')) })
    expect(useToastStore.getState().toast?.message).toBe(DAY_DELETE_COPY.failed)
    expect(screen.getByTestId('day-swipe-d1')).toBeTruthy()
  })
})

describe('오프라인', () => {
  it('끊김 상태면 [지우기]를 막고 짧은 안내 - 확인 창도 RPC도 없다', async () => {
    const db = useDb(ONLY_MINE)
    render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('day-swipe-d1')
    useConnectionStore.setState({ offline: true })
    swipeLeft(front('d1'))
    fireEvent.click(screen.getByTestId('day-delete-action'))
    expect(useToastStore.getState().toast?.message).toBe(DAY_DELETE_COPY.offline)
    expect(screen.queryByTestId('day-delete-confirm')).toBeNull()
    expect(db.rpcCalls).toEqual([])
    expect(screen.getByTestId('day-swipe-d1').className).not.toContain('open')
  })
})

describe('하늘 기기 저장분', () => {
  it('지운 뒤 하늘 저장분에서 그날을 빼고 그 달부터의 그날 온도를 비운다(다시 계산)', async () => {
    useDb(ONLY_MINE)
    writeCache('me', 'sky', {
      coupleId: 'c1', allLoaded: true, moons: [], draftPeriodStart: null,
      // 81-: 저장 모양 검사를 지나는 온전한 하루 기록
      records: [{ id: 'd0', date: '2026-09-20' }, { id: 'd1', date: '2026-10-03' }].map((r) => ({ ...r, stops: [], photos: [], memos: [], counts: { stops: 0, photos: 0, memos: 0 } })),
      temps: { '2026-09-20': 40, '2026-10-03': 41 }, tempStatus: { '2026-09': 'ok', '2026-10': 'ok' },
    }, 'c1')
    render(<FeedTab nav={makeFakeNav()} />)
    await screen.findByTestId('day-swipe-d1')
    swipeLeft(front('d1'))
    fireEvent.click(screen.getByTestId('day-delete-action'))
    await act(async () => { fireEvent.click(screen.getByTestId('confirm-yes')) })
    const sky = readCache<{ records: { id: string }[]; temps: Record<string, number>; tempStatus: Record<string, string> }>('me', 'sky', 'c1')
    expect(sky?.records.map((r) => r.id)).toEqual(['d0'])
    expect(sky?.temps).toEqual({ '2026-09-20': 40 })
    expect(sky?.tempStatus).toEqual({ '2026-09': 'ok' })
  })

  it('patchSkyCache는 순수(입력 그대로)', () => {
    const input = { coupleId: 'c1', records: [{ id: 'd1', date: '2026-10-03' }] as never[], temps: {}, tempStatus: {} }
    const out = patchSkyCache(input, 'd1', '2026-10-03')
    expect(out.records).toEqual([])
    expect(input.records).toHaveLength(1)
  })
})
