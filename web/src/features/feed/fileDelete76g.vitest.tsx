/**
 * 76-g P1(R105-4) 앱에서 지운 순간 내 파일도 지움 - 사진 하나 · 하루 지우기. 서버 · 저장소는 가짜(`feedTestSupport.ts`). 원격 0.
 * 확인: 행 삭제 성공 -> 파일 삭제 호출 1 · 행 실패 -> 0 · 파일 실패 -> 기기 대기열 -> 재시도 성공 · 상대 파일 0 · 대기열 지우는 때.
 * 저장소 권한(본인 파일만 · 상대 · 매거진 거부)은 PGlite 시험(`__tests__/db/withdrawalPurge76g.test.ts`).
 * 폰에서만 확인되는 것: 지운 뒤 다음 월요일 미리 보기에서 그 파일이 "남은 파일"로 잡히지 않음.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SheetHost } from '../../app/sheets'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { clearAllDeviceCache, clearCoupleCache, purgeOtherUsers } from '../../cache/deviceCache'
import { clearSignedUrlCache } from '../../cache/signedUrlCache'
import { ToastHost } from '../../components/ToastHost'
import { useConnectionStore } from '../../connection/connectionMonitor'
import { useCoupleStore } from '../../stores/coupleStore'
import { useToastStore } from '../../stores/toastStore'
import { makeFakeNav } from '../../testSupport'
import { FeedTab } from '../../tabs/FeedTab'
import { DateDetailScreen } from './DateDetailScreen'
import { SWIPE_ACTION_W } from './FeedView'
import { COUPLE_ROW, PROFILES, dateRow, makeFeedDb, memoRow, photoRow, stopRow, type FeedDbOptions } from './feedTestSupport'
import { deleteMyFiles, flushFileQueue, readFileQueue } from './fileDelete'

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
})

const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

describe('대기열 장치', () => {
  it('성공 -> 지우기 호출 1 · 대기열 0', async () => {
    const db = useDb()
    await deleteMyFiles(['c1/p1.jpg', null, 'c1/p1.jpg'])
    expect(db.removeCalls).toEqual([{ bucket: 'entries', paths: ['c1/p1.jpg'] }])
    expect(readFileQueue()).toEqual([])
  })

  it('실패 -> 기기 대기열 -> 다시 지우기 성공 -> 대기열 0', async () => {
    const db = useDb({ removeFailures: 1 })
    await deleteMyFiles(['c1/p1.jpg'])
    expect(readFileQueue()).toEqual(['c1/p1.jpg'])
    await flushFileQueue()
    expect(db.removeCalls.map((c) => c.paths)).toEqual([['c1/p1.jpg'], ['c1/p1.jpg']])
    expect(readFileQueue()).toEqual([])
  })

  it('대기열은 커플 자료 삭제 규칙에 든다(로그아웃 · 탈퇴 요청 · 해제 · 계정 전환) - 남은 파일은 월요일 정리가 받는다', async () => {
    useDb({ removeFailures: 99 })
    for (const clear of [() => clearAllDeviceCache(), () => clearCoupleCache('me'), () => purgeOtherUsers('other')]) {
      await deleteMyFiles(['c1/p9.jpg'])
      expect(readFileQueue()).toEqual(['c1/p9.jpg'])
      clear()
      expect(readFileQueue('me')).toEqual([])
    }
  })
})

describe('사진 하나 지우기(E03)', () => {
  const base: Partial<FeedDbOptions> = {
    dates: [dateRow('d1', '2026-10-03')],
    stops: [stopRow('s0', 'd1', 0, '2026-10-03T14:20:00+09:00', '홍대 CGV')],
    entries: [
      photoRow('p1', { captured_at: '2026-10-03T14:30:00+09:00', date_stop_id: 's0' }),
      photoRow('p2', { captured_at: '2026-10-03T15:00:00+09:00', author_id: 'you' }),
    ],
  }
  const open = () => render(<MemoryRouter initialEntries={['/date-detail?id=d1']}><DateDetailScreen nav={makeFakeNav()} /><SheetHost /><ToastHost aboveTabBar={false} /></MemoryRouter>)
  const hold = async (el: Element) => {
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 })
    await act(async () => { await new Promise((r) => setTimeout(r, 560)) })
  }

  it('행 삭제 성공 -> 내 파일 지우기 1번(그 사진 경로만)', async () => {
    const db = useDb(base)
    open()
    await screen.findByTestId('detail-title')
    await hold(screen.getByTestId('photo-p1'))
    fireEvent.click(within(await screen.findByTestId('delete-confirm')).getByTestId('confirm-yes'))
    await waitFor(() => expect(db.removeCalls).toEqual([{ bucket: 'entries', paths: ['c1/p1.jpg'] }]))
  })

  it('행 삭제 실패 -> 파일 0', async () => {
    const db = useDb({ ...base, deleteFails: true })
    open()
    await screen.findByTestId('detail-title')
    await hold(screen.getByTestId('photo-p1'))
    fireEvent.click(within(await screen.findByTestId('delete-confirm')).getByTestId('confirm-yes'))
    await settle()
    await settle()
    expect(db.rpcCalls.map((c) => c.fn)).toEqual(['fn_delete_own_entry'])
    expect(db.removeCalls).toEqual([])
  })
})

describe('하루 지우기(76-d)', () => {
  const day = {
    dates: [dateRow('d1', '2026-10-03')],
    stops: [{ ...stopRow('s1', 'd1', 0, '2026-10-03T03:00:00Z', '연남동'), author_id: 'me' }],
    entries: [photoRow('p1'), memoRow('m1', '내 메모'), photoRow('p2', { author_id: 'you' })],
  }
  const swipeAndConfirm = async () => {
    await screen.findByTestId('day-swipe-d1')
    const el = screen.getByTestId('day-swipe-d1').querySelector('[data-testid="swipe-front"]') as HTMLElement
    fireEvent.pointerDown(el, { clientX: 200, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 190, clientY: 101, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 200 - SWIPE_ACTION_W - 10, clientY: 102, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 200 - SWIPE_ACTION_W - 10, clientY: 102, pointerId: 1 })
    fireEvent.click(screen.getByTestId('day-delete-action'))
    await act(async () => { fireEvent.click(screen.getByTestId('confirm-yes')) })
    await settle()
  }

  it('RPC 성공 뒤 내 파일만 지운다(상대 사진 경로 0) · 지우기 전에 경로를 읽어 둔다', async () => {
    const db = useDb(day)
    render(<FeedTab nav={makeFakeNav()} />)
    await swipeAndConfirm()
    expect(db.rpcCalls.map((c) => c.fn)).toEqual(['fn_delete_my_day'])
    expect(db.removeCalls).toEqual([{ bucket: 'entries', paths: ['c1/p1.jpg'] }])
  })

  it('RPC 실패 -> 파일 0', async () => {
    const db = useDb({ ...day, dayDeleteFails: true })
    render(<FeedTab nav={makeFakeNav()} />)
    await swipeAndConfirm()
    expect(db.removeCalls).toEqual([])
  })

  it('파일 지우기 실패 -> 대기열 -> 다시 연결 때 비움', async () => {
    const db = useDb({ ...day, removeFailures: 1 })
    render(<FeedTab nav={makeFakeNav()} />)
    await swipeAndConfirm()
    expect(readFileQueue()).toEqual(['c1/p1.jpg'])
    await flushFileQueue()
    expect(readFileQueue()).toEqual([])
    expect(db.removeCalls).toHaveLength(2)
  })
})
