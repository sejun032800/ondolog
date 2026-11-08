import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChatTrialScreen } from './ChatTrial'
import { isChatTrialOpen } from './chatTrialGate'
import { makeFakeMessages } from './fakeMessages'
import { handleHardwareBack } from '../platform/backStack'
import App from '../App'
import type { NativeBridge } from '../platform/bridge'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('채팅 시험 화면', () => {
  beforeEach(() => {
    // jsdom은 레이아웃이 없다 - 스크롤 높이를 고정해 "끝으로 붙는지"를 본다.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 12345 })
  })

  it('가짜 메시지 500개를 그린다 (같은 입력 -> 같은 목록)', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    expect(screen.getAllByTestId('chat-message')).toHaveLength(500)
    expect(makeFakeMessages(500)).toEqual(makeFakeMessages(500))
  })

  it('처음에는 맨 아래에서 시작한다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    expect(screen.getByTestId('chat-list').scrollTop).toBe(12345)
  })

  it('보내면 목록 끝에 추가되고 입력창이 비며 끝으로 붙는다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    const input = screen.getByPlaceholderText('메시지 보내기') as HTMLInputElement
    fireEvent.change(input, { target: { value: '안녕' } })
    fireEvent.click(screen.getByLabelText('보내기'))
    const rows = screen.getAllByTestId('chat-message')
    expect(rows).toHaveLength(501)
    expect(rows[500].textContent).toContain('안녕')
    expect(input.value).toBe('')
    expect(screen.getByTestId('chat-list').scrollTop).toBe(12345)
  })

  it('빈 입력은 보내지 않는다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('메시지 보내기'), { target: { value: '   ' } })
    expect((screen.getByLabelText('보내기') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByTestId('chat-message')).toHaveLength(500)
  })

  it('하드웨어 뒤로 가기가 이 화면의 뒤로 가기로 간다', () => {
    const onBack = vi.fn()
    render(<ChatTrialScreen onBack={onBack} />)
    const other = { canGoBack: () => true, goBack: vi.fn(), exitApp: vi.fn() }
    handleHardwareBack(other)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(other.goBack).not.toHaveBeenCalled()
  })
})

describe('채팅 시험 화면의 문', () => {
  const fakeBridge = (): NativeBridge => ({ onBackButton: () => () => {}, exitApp: () => {}, hideSplash: () => {} })

  it('개발 서버와 시험 빌드에서만 열린다', () => {
    expect(isChatTrialOpen({ DEV: true, MODE: 'development' })).toBe(true)
    expect(isChatTrialOpen({ DEV: false, MODE: 'trial' })).toBe(true)
    expect(isChatTrialOpen({ DEV: false, MODE: 'production' })).toBe(false)
  })

  it('운영 빌드에서는 경로로 들어가도 닫혀 있고 첫 화면으로 돌아간다', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    const { container } = render(<App bridge={fakeBridge()} initialPath="/dev/chat" />)
    expect(screen.queryByTestId('chat-list')).toBeNull()
    expect(container.querySelector('[data-screen="intro"]')).not.toBeNull()
    expect(screen.queryByTestId('chat-trial-button')).toBeNull()
    expect(screen.queryByText('채팅 시험')).toBeNull()
  })

  it('시험 빌드에서는 첫 화면에 "채팅 시험" 버튼이 1개 보이고, 누르면 들어간다', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'trial')
    const { container } = render(<App bridge={fakeBridge()} initialPath="/intro" />)
    expect(screen.getAllByText('채팅 시험')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('chat-trial-button'))
    expect(container.querySelector('[data-screen="dev"]')).not.toBeNull()
    expect(screen.getByTestId('chat-list')).not.toBeNull()
  })

  it('운영 빌드 설정에서는 첫 화면에 "채팅 시험" 버튼이 0개다', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    render(<App bridge={fakeBridge()} initialPath="/intro" />)
    expect(screen.queryAllByText('채팅 시험')).toHaveLength(0)
  })
})
