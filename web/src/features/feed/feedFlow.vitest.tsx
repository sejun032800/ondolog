/**
 * 피드 흐름 시험(74-4) - 앱 껍질 안에서: 피드 -> E03 -> E15 -> 뒤로 -> 뒤로, 하드웨어 뒤로 가기, E11 시트(뒤로 가기는 시트만 닫는다).
 * `nav.push(name, { params })`로 실린 데이트 id가 뒤로 갔다 돌아와도 남는지(주소 끝 `?id=`)도 여기서 본다. 서버는 가짜 - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { NAV_COOLDOWN_MS } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { useSheetStore } from '../../stores/sheetStore'
import { makeFakeBridge } from '../../testSupport'
import { COUPLE_ROW, PROFILES, dateRow, makeFeedDb, memoRow, photoRow, stopRow } from './feedTestSupport'

const screenName = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
const cooldown = () => act(async () => { await new Promise((r) => setTimeout(r, NAV_COOLDOWN_MS + 30)) })

beforeEach(() => {
  const db = makeFeedDb({
    me: 'me',
    couples: [COUPLE_ROW],
    profiles: PROFILES,
    dates: [dateRow('d1', '2026-10-03'), dateRow('d2', '2026-10-15')],
    stops: [stopRow('s0', 'd1', 0, '2026-10-03T14:20:00+09:00', '홍대 CGV')],
    entries: [photoRow('p1', { captured_at: '2026-10-03T14:30:00+09:00', date_stop_id: 's0' }), memoRow('m1', '스파이더맨 봤다')],
  })
  // 앱 시작 때 저장된 로그인으로 화면이 바뀌지 않게 세션은 비운다 - 로그인 상태는 저장소에 직접 둔다.
  ;(db.client as unknown as { auth: { getSession: () => Promise<unknown> } }).auth.getSession = async () => ({ data: { session: null }, error: null })
  setSupabaseForTest(db.client)
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
  useSheetStore.getState().closeAll()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

describe('피드 -> 데이트 상세 -> 장소 고치기', () => {
  it('카드 -> E03(탭 바 가림) -> 장소 -> E15 -> ← -> E03(같은 데이트) -> ← -> 피드', async () => {
    render(<App bridge={makeFakeBridge()} initialPath="/feed" />)
    expect(await screen.findByTestId('chapter-2026-10')).toBeTruthy()
    expect(screen.getByTestId('tab-bar')).toBeTruthy()

    await cooldown()
    fireEvent.click(screen.getByLabelText(/10월 3일 토요일/))
    expect(screenName()).toBe('date-detail')
    expect((await screen.findByTestId('detail-title')).textContent).toBe('10월 3일 토요일')
    expect(screen.queryByTestId('tab-bar')).toBeNull() // 탭 위에 쌓인 화면 - 탭 바가 가려진다

    await cooldown()
    fireEvent.click(screen.getByLabelText('홍대 CGV 장소 고치기'))
    expect(screenName()).toBe('stop-edit')
    const name = (await screen.findByTestId('stop-name-input')) as HTMLInputElement
    await waitFor(() => expect(name.value).toBe('홍대 CGV')) // 데이트 id + 장소 id가 실려 왔다

    await cooldown()
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(screenName()).toBe('date-detail')
    expect((await screen.findByTestId('detail-title')).textContent).toBe('10월 3일 토요일') // 돌아와도 같은 데이트

    await cooldown()
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(screenName()).toBe('feed')
    expect(await screen.findByTestId('chapter-2026-10')).toBeTruthy()
  })

  it('하드웨어 뒤로 가기: 상세 -> 피드, 피드 -> 메인(앱을 닫지 않는다)', async () => {
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/feed" />)
    await screen.findByTestId('chapter-2026-10')
    await cooldown()
    fireEvent.click(screen.getByLabelText(/10월 3일 토요일/))
    await screen.findByTestId('detail-title')
    await cooldown()
    act(() => bridge.emitBack())
    expect(screenName()).toBe('feed')
    await cooldown()
    act(() => bridge.emitBack())
    expect(screenName()).toBe('main')
    expect(bridge.exitApp).not.toHaveBeenCalled()
  })

  it('데이트 상세의 사진 크게 보기가 열려 있을 때 뒤로 가기는 그것만 닫는다', async () => {
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/feed" />)
    await screen.findByTestId('chapter-2026-10')
    await cooldown()
    fireEvent.click(screen.getByLabelText(/10월 3일 토요일/))
    fireEvent.click(await screen.findByTestId('photo-p1'))
    expect(screen.getByTestId('photo-viewer')).toBeTruthy()
    act(() => bridge.emitBack())
    expect(screen.queryByTestId('photo-viewer')).toBeNull()
    expect(screenName()).toBe('date-detail')
  })
})

describe('E11 기록 시트', () => {
  it('+ 버튼이 시트를 열고, 뒤로 가기는 시트만 닫는다(피드는 그대로)', async () => {
    const bridge = makeFakeBridge()
    render(<App bridge={bridge} initialPath="/feed" />)
    await screen.findByTestId('chapter-2026-10')
    await waitFor(() => expect(screen.getByTestId('feed-add-fab').getAttribute('aria-disabled')).toBeNull())
    fireEvent.click(screen.getByTestId('feed-add-fab'))
    expect(await screen.findByTestId('record-sheet')).toBeTruthy()
    act(() => bridge.emitBack())
    await waitFor(() => expect(screen.queryByTestId('record-sheet')).toBeNull())
    expect(screenName()).toBe('feed')
    expect(bridge.exitApp).not.toHaveBeenCalled()
  })

  it('탭을 옮기면 열려 있던 기록 시트도 닫힌다(B4)', async () => {
    render(<App bridge={makeFakeBridge()} initialPath="/feed" />)
    await screen.findByTestId('chapter-2026-10')
    await waitFor(() => expect(screen.getByTestId('feed-add-fab').getAttribute('aria-disabled')).toBeNull())
    fireEvent.click(screen.getByTestId('feed-add-fab'))
    await screen.findByTestId('record-sheet')
    fireEvent.click(screen.getByTestId('tab-chat')) // (시트의 어두운 면이 탭 바를 덮는 것은 실기기 확인 - 경로가 바뀌면 시트는 닫힌다)
    expect(screenName()).toBe('chat')
    expect(useSheetStore.getState().current).toBeNull()
    expect(screen.queryByTestId('record-sheet')).toBeNull()
  })
})
