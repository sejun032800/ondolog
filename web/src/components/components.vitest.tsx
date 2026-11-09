import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { CoupleGate, GATE_COPY, useCoupleAction } from './CoupleGate'
import { ConfirmDialog } from './ConfirmDialog'
import { EmptyState } from './EmptyState'
import { SHEET_CLOSE_MS, Sheet } from './Sheet'
import { Skeleton } from './Skeleton'
import { ToastHost } from './ToastHost'
import { SheetHost } from '../app/sheets'
import { setInviteEntry } from '../app/inviteEntry'
import { handleHardwareBack } from '../platform/backStack'
import { useCoupleStore } from '../stores/coupleStore'
import { useSheetStore } from '../stores/sheetStore'
import { TOAST_DURATION_MS, showToast, useToastStore } from '../stores/toastStore'
import { TabBar } from '../tabs/TabBar'

beforeEach(() => {
  vi.useFakeTimers()
  useCoupleStore.getState().reset()
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
})
afterEach(() => {
  cleanup()
  setInviteEntry(null)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const back = () => handleHardwareBack({ canGoBack: () => true, goBack: vi.fn(), exitApp: vi.fn() })

describe('공용 시트 부품', () => {
  it('바깥 누름으로 닫힌다: 닫기 연출 뒤에 onClosed', () => {
    const onClosed = vi.fn()
    render(<Sheet onClosed={onClosed}><p>내용</p></Sheet>)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(screen.getByTestId('sheet').className).toContain('closing')
    expect(onClosed).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(SHEET_CLOSE_MS) })
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('뒤로 가기는 시트만 닫고 앞 화면으로 새지 않는다', () => {
    const onClosed = vi.fn()
    const goBack = vi.fn()
    const exitApp = vi.fn()
    render(<Sheet onClosed={onClosed}><p>내용</p></Sheet>)
    act(() => handleHardwareBack({ canGoBack: () => true, goBack, exitApp }))
    act(() => { vi.advanceTimersByTime(SHEET_CLOSE_MS) })
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(goBack).not.toHaveBeenCalled()
    expect(exitApp).not.toHaveBeenCalled()
  })

  it('닫는 중에 바깥 · 뒤로 가기를 또 눌러도 한 번만 닫히고 앞 화면으로 새지 않는다', () => {
    const onClosed = vi.fn()
    const goBack = vi.fn()
    render(<Sheet onClosed={onClosed}><p>내용</p></Sheet>)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    act(() => handleHardwareBack({ canGoBack: () => true, goBack, exitApp: vi.fn() }))
    act(() => { vi.advanceTimersByTime(SHEET_CLOSE_MS * 2) })
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(goBack).not.toHaveBeenCalled()
  })

  it('prefers-reduced-motion이면 연출 없이 즉시 닫힌다', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const onClosed = vi.fn()
    render(<Sheet onClosed={onClosed}><p>내용</p></Sheet>)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('시트가 내려가면(언마운트) 뒤로 가기 등록이 풀린다', () => {
    const { unmount } = render(<Sheet onClosed={() => {}}><p>내용</p></Sheet>)
    unmount()
    const goBack = vi.fn()
    handleHardwareBack({ canGoBack: () => true, goBack, exitApp: vi.fn() })
    expect(goBack).toHaveBeenCalledTimes(1)
  })
})

describe('I01 커플 게이트', () => {
  it('조회 전에는 아무것도 확정하지 않는다(안내가 번쩍이지 않는다)', () => {
    render(<CoupleGate><p>본문</p></CoupleGate>)
    expect(screen.queryByText('본문')).toBeNull()
    expect(screen.queryByTestId('couple-gate')).toBeNull()
  })

  it('연결이면 본문, 미연결이면 화면 안 안내 카드(시트 손잡이 없음 · 시트 자동으로 안 뜸)', () => {
    useCoupleStore.setState({ status: 'connected' })
    const { rerender } = render(<CoupleGate><p>본문</p></CoupleGate>)
    expect(screen.getByText('본문')).toBeTruthy()
    useCoupleStore.setState({ status: 'disconnected' })
    rerender(<CoupleGate><p>본문</p></CoupleGate>)
    expect(screen.queryByText('본문')).toBeNull()
    expect(screen.getByText(GATE_COPY.title)).toBeTruthy()
    expect(screen.getByText(GATE_COPY.body)).toBeTruthy()
    expect(document.querySelector('.gateCard .handle')).toBeNull()
    expect(useSheetStore.getState().current).toBeNull()
  })

  it('카드의 버튼은 같은 문구 시트를 다시 열지 않고 바로 초대로 간다', () => {
    const entry = vi.fn()
    setInviteEntry(entry)
    useCoupleStore.setState({ status: 'disconnected' })
    render(<CoupleGate><p>본문</p></CoupleGate>)
    fireEvent.click(screen.getByText(GATE_COPY.invite))
    fireEvent.click(screen.getByText(GATE_COPY.enter))
    expect(entry.mock.calls).toEqual([['intro'], ['enter']])
    expect(useSheetStore.getState().current).toBeNull()
  })

  it('초대 입구가 아직 없으면 안내 토스트가 뜬다(아무 일 없는 버튼 0)', () => {
    useCoupleStore.setState({ status: 'disconnected' })
    render(<CoupleGate><p>본문</p></CoupleGate>)
    fireEvent.click(screen.getByText(GATE_COPY.invite))
    expect(useToastStore.getState().toast?.message).toBeTruthy()
  })

  function Action({ onDo }: { onDo: () => void }) {
    const guard = useCoupleAction()
    return <button onClick={() => guard(onDo)}>기록 남기기</button>
  }

  it('커플 기능을 누르면: 미연결이면 시트가 한 번만 열리고, 연결이면 기능이 실행된다', () => {
    const onDo = vi.fn()
    useCoupleStore.setState({ status: 'disconnected' })
    render(<><Action onDo={onDo} /><SheetHost /></>)
    fireEvent.click(screen.getByText('기록 남기기'))
    fireEvent.click(screen.getByText('기록 남기기'))
    expect(screen.getAllByTestId('sheet-couple-gate')).toHaveLength(1)
    expect(onDo).not.toHaveBeenCalled()
    // 시트 안 문구 = I01 문구. 시트에는 손잡이가 있다.
    expect(screen.getByText(GATE_COPY.title)).toBeTruthy()
    expect(document.querySelector('.sheet .handle')).toBeTruthy()
  })

  it('조회 전에는 누름이 아무 시트도 열지 않는다. 연결이면 기능 실행', () => {
    const onDo = vi.fn()
    render(<Action onDo={onDo} />)
    fireEvent.click(screen.getByText('기록 남기기'))
    expect(useSheetStore.getState().current).toBeNull()
    act(() => { useCoupleStore.setState({ status: 'connected' }) })
    fireEvent.click(screen.getByText('기록 남기기'))
    expect(onDo).toHaveBeenCalledTimes(1)
  })

  it('시트의 버튼은 시트를 닫고 초대로 간다', () => {
    const entry = vi.fn()
    setInviteEntry(entry)
    useCoupleStore.setState({ status: 'disconnected' })
    render(<><Action onDo={() => {}} /><SheetHost /></>)
    fireEvent.click(screen.getByText('기록 남기기'))
    fireEvent.click(screen.getByText(GATE_COPY.invite))
    act(() => { vi.advanceTimersByTime(SHEET_CLOSE_MS) })
    expect(entry).toHaveBeenCalledWith('intro')
    expect(useSheetStore.getState().current).toBeNull()
  })

  it('화면이 열릴 때 효과로 시트를 여는 일이 없다(B4: 닫아도 다시 뜸 방지) - 게이트를 여러 번 그려도 시트 0', () => {
    useCoupleStore.setState({ status: 'disconnected' })
    function Many() {
      useEffect(() => {}, [])
      return <><CoupleGate><p>a</p></CoupleGate><CoupleGate><p>b</p></CoupleGate></>
    }
    const { rerender } = render(<Many />)
    for (let i = 0; i < 5; i++) rerender(<Many />)
    expect(useSheetStore.getState().current).toBeNull()
  })
})

describe('I05 확인 카드', () => {
  it('열려 있으면 두 버튼, 뒤로 가기 = 취소', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmDialog open title="이 기록을 지울까요?" message="되돌릴 수 없어요." onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText('지우기')).toBeTruthy()
    act(() => back())
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('지우기'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('처리 중에는 두 버튼이 막히고 뒤로 가기도 취소하지 않는다', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open busy title="t" message="m" onConfirm={() => {}} onCancel={onCancel} />)
    expect((screen.getByTestId('confirm-yes') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('confirm-no') as HTMLButtonElement).disabled).toBe(true)
    act(() => back())
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('닫혀 있으면 아무것도 그리지 않고 뒤로 가기도 가로채지 않는다', () => {
    const goBack = vi.fn()
    render(<ConfirmDialog open={false} title="t" message="m" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByTestId('confirm-dialog')).toBeNull()
    handleHardwareBack({ canGoBack: () => true, goBack, exitApp: vi.fn() })
    expect(goBack).toHaveBeenCalledTimes(1)
  })
})

describe('I03 · I04', () => {
  it('뼈대는 스피너 없이 숨은 막대다', () => {
    render(<Skeleton width={120} height={12} />)
    const el = screen.getByTestId('skeleton')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toBe('skeleton')
  })

  it('빈 상태: 점선 네모 셋 + 제목 + 보조 문장 + 버튼(선택)', () => {
    const onAction = vi.fn()
    render(<EmptyState title="기록을 남기면 여기에 쌓여요" body={'사진 몇 장과 한 줄이면 충분해요.\n이번 호의 재료가 돼요.'} actionLabel="첫 기록 남기기" onAction={onAction} />)
    expect(document.querySelectorAll('.emptySquares i')).toHaveLength(3)
    fireEvent.click(screen.getByText('첫 기록 남기기'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('버튼 글자나 동작이 없으면 버튼을 그리지 않는다', () => {
    render(<EmptyState title="비었어요" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('I06 토스트', () => {
  it('3초 뒤 저절로 사라지고, 새 토스트는 시간을 새로 센다', () => {
    render(<ToastHost aboveTabBar />)
    act(() => showToast('기록을 남겼어요'))
    expect(screen.getByTestId('toast-message').textContent).toBe('기록을 남겼어요')
    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS - 100) })
    act(() => showToast('다른 글'))
    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS - 100) })
    expect(screen.getByTestId('toast-message').textContent).toBe('다른 글')
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('보기 버튼은 토스트를 닫고 동작한다. 탭 바 위/아래 자리 구분', () => {
    const onPress = vi.fn()
    const { container, rerender } = render(<ToastHost aboveTabBar />)
    act(() => showToast('기록을 남겼어요', { label: '보기', onPress }))
    expect(container.querySelector('.toastWrap.aboveTabs')).toBeTruthy()
    rerender(<ToastHost aboveTabBar={false} />)
    expect(container.querySelector('.toastWrap.aboveTabs')).toBeNull()
    fireEvent.click(screen.getByTestId('toast-action'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('toast')).toBeNull()
  })
})

describe('탭 바', () => {
  it('활성 탭을 누르면 그 탭 이름으로 onSelect, 5개 모두 항상 있다', () => {
    const onSelect = vi.fn()
    render(<TabBar active="chat" onSelect={onSelect} />)
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    fireEvent.click(screen.getByTestId('tab-feed'))
    expect(onSelect).toHaveBeenCalledWith('feed')
    expect(screen.getByTestId('tab-chat').className).toContain('on')
    expect(screen.getByTestId('tab-main').className).not.toContain('on')
  })

  it('아이콘은 보드의 선 아이콘(viewBox 24 · currentColor) 5개다', () => {
    render(<TabBar active="main" onSelect={() => {}} />)
    const svgs = document.querySelectorAll('.tabBar svg')
    expect(svgs).toHaveLength(5)
    svgs.forEach((s) => {
      expect(s.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(s.getAttribute('stroke')).toBe('currentColor')
      expect(s.getAttribute('stroke-width')).toBe('1.6')
    })
    // 메인 = 보드의 초승달 경로 원문
    expect(document.querySelector('[data-testid="tab-main"] path')?.getAttribute('d')).toBe('M19.1 14.8A7.6 7.6 0 019.2 4.9a7.6 7.6 0 109.9 9.9z')
  })
})
