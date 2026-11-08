import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChatTrialScreen } from './ChatTrial'
import { RESIDUE_GUARD_MS } from '../platform/useChatComposer'
import { SMOOTH_MS, easeOut } from '../platform/useStickToEnd'

const input = () => screen.getByPlaceholderText('메시지 보내기') as HTMLInputElement
const sendBtn = () => screen.getByLabelText('보내기')
const texts = () => screen.getAllByTestId('chat-message').map((r) => r.querySelector('.bubble')!.textContent)
const list = () => screen.getByTestId('chat-list')

/** IME가 값을 바꾸는 것을 흉내 낸다. React가 모르게(상태가 늦는 경우) 바꾸려면 notify=false. */
function type(value: string, opts: { composing?: boolean; notify?: boolean } = {}) {
  const el = input()
  if (opts.notify === false) { el.value = value; return }
  fireEvent.input(el, { target: { value }, isComposing: !!opts.composing })
}

let rafQueue: Array<(t: number) => void> = []
/** 가짜 requestAnimationFrame을 주어진 시각들로 돌린다. */
function frames(...times: number[]) {
  for (const t of times) {
    const q = rafQueue
    rafQueue = []
    act(() => { q.forEach((cb) => cb(t)) })
  }
}

beforeEach(() => {
  rafQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafQueue.push(cb); return rafQueue.length })
  vi.stubGlobal('cancelAnimationFrame', () => { rafQueue = [] })
  // jsdom은 레이아웃이 없다 - 끝 위치를 고정한다.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 12345 })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('(a) 보낸 뒤에도 포커스 유지', () => {
  it('보내기 버튼의 누름 시작 이벤트가 기본 동작(포커스 이동)을 막는다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    expect(fireEvent.mouseDown(sendBtn())).toBe(false) // false = preventDefault 됨
    expect(fireEvent.pointerDown(sendBtn())).toBe(false)
  })

  it('세 번 연속 보내도 입력 칸이 포커스를 유지하고 값이 비어 있다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    input().focus()
    for (const w of ['하나', '둘', '셋']) {
      type(w)
      fireEvent.mouseDown(sendBtn())
      fireEvent.click(sendBtn())
      expect(document.activeElement).toBe(input())
      expect(input().value).toBe('')
    }
    expect(texts().slice(-3)).toEqual(['하나', '둘', '셋'])
  })
})

describe('(d) 한글 조합 중 보내기', () => {
  it('조합 중 보내기: 값에 이미 들어 있는 조합 글자까지 "안녕"으로 보내고 입력 칸이 빈다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    input().focus()
    fireEvent.compositionStart(input())
    type('안녀', { composing: true })
    type('안녕', { notify: false }) // 키보드가 조합 글자를 값에 넣었지만 React는 아직 모른다
    fireEvent.mouseDown(sendBtn())
    fireEvent.click(sendBtn())
    expect(texts().at(-1)).toBe('안녕')
    expect(texts()).not.toContain('안녀')
    expect(input().value).toBe('')
    expect(document.activeElement).toBe(input())
  })

  it('보낸 뒤 키보드 앱이 조합 글자를 다시 넣어도 남지 않는다("ㅇ" · "녕" 잔여 0)', () => {
    vi.useFakeTimers()
    render(<ChatTrialScreen onBack={() => {}} />)
    input().focus()
    fireEvent.compositionStart(input())
    type('안녕', { composing: true })
    fireEvent.click(sendBtn())
    type('녕', { composing: true })
    expect(input().value).toBe('')
    type('ㅇ', { composing: true })
    expect(input().value).toBe('')
    fireEvent.compositionEnd(input())
    expect(input().value).toBe('')
    expect(screen.getAllByTestId('chat-message')).toHaveLength(501)
  })

  it('가드 시간이 지나면 다음 타이핑은 정상으로 들어간다', () => {
    vi.useFakeTimers()
    render(<ChatTrialScreen onBack={() => {}} />)
    fireEvent.compositionStart(input())
    type('사랑해', { composing: true })
    fireEvent.click(sendBtn())
    act(() => { vi.advanceTimersByTime(RESIDUE_GUARD_MS + 1) })
    fireEvent.compositionEnd(input())
    fireEvent.compositionStart(input())
    type('ㅋ', { composing: true })
    expect(input().value).toBe('ㅋ')
    expect(sendBtn().className).toContain('on')
  })

  it('조합 중 엔터: 한 번만 보내고 빈 말풍선이 없다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    fireEvent.compositionStart(input())
    type('안녕', { composing: true })
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input(), { key: 'Enter' }) // 조합이 끝나며 다시 오는 엔터
    fireEvent.compositionEnd(input())
    const t = texts()
    expect(t).toHaveLength(501)
    expect(t.at(-1)).toBe('안녕')
    expect(t.every((x) => (x ?? '').trim().length > 0)).toBe(true)
    expect(input().value).toBe('')
  })

  it('조합이 끝난 뒤 보내기는 정상이다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    fireEvent.compositionStart(input())
    type('안녕', { composing: true })
    fireEvent.compositionEnd(input())
    type('안녕')
    fireEvent.click(sendBtn())
    expect(texts().at(-1)).toBe('안녕')
    expect(input().value).toBe('')
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getAllByTestId('chat-message')).toHaveLength(501)
  })

  it('공백만 있는 입력은 버튼으로도 엔터로도 보내지 않는다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    type('   ')
    fireEvent.click(sendBtn())
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getAllByTestId('chat-message')).toHaveLength(500)
  })
})

describe('(b) 등장 연출 · 부드러운 이동', () => {
  it('새 메시지가 끝에 추가되고 등장 연출 클래스가 붙는다(처음 500개에는 없다)', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    expect(document.querySelectorAll('.chatRow.enter')).toHaveLength(0)
    type('하나'); fireEvent.click(sendBtn())
    type('둘'); fireEvent.click(sendBtn())
    const rows = screen.getAllByTestId('chat-message')
    expect(rows.slice(-2).map((r) => r.className.includes('enter'))).toEqual([true, true])
    expect(texts().slice(-2)).toEqual(['하나', '둘']) // 순서 유지
  })

  it('내가 보내면 끝으로 부드럽게 이동한다(순간 이동하지 않고 이징을 따른다)', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    list().scrollTop = 0
    fireEvent.scroll(list())
    type('끝으로'); fireEvent.click(sendBtn())
    expect(list().scrollTop).toBe(0) // 첫 프레임 전에는 그대로
    frames(0)
    frames(SMOOTH_MS / 2)
    const mid = list().scrollTop
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(12345)
    expect(mid).toBeCloseTo(12345 * easeOut(0.5), 0)
    frames(SMOOTH_MS)
    expect(list().scrollTop).toBe(12345)
  })

  it('위로 올려 보는 중에 상대 메시지가 와도 위치를 유지한다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    list().scrollTop = 100
    fireEvent.scroll(list())
    fireEvent.click(screen.getByTestId('fake-partner'))
    expect(screen.getAllByTestId('chat-message')).toHaveLength(501)
    frames(0, SMOOTH_MS)
    expect(list().scrollTop).toBe(100)
  })

  it('끝에 붙어 있으면 상대 메시지도 따라간다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    list().scrollTop = 12345
    fireEvent.scroll(list())
    fireEvent.click(screen.getByTestId('fake-partner'))
    frames(0, SMOOTH_MS)
    expect(list().scrollTop).toBe(12345)
  })

  it('위로 올린 상태에서도 내가 보낸 메시지는 끝으로 간다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    list().scrollTop = 100
    fireEvent.scroll(list())
    type('내 말'); fireEvent.click(sendBtn())
    frames(0, SMOOTH_MS)
    expect(list().scrollTop).toBe(12345)
  })

  it('이동 중 손가락이 닿으면 이동을 멈춘다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    list().scrollTop = 0
    fireEvent.scroll(list())
    type('멈춤'); fireEvent.click(sendBtn())
    frames(0, SMOOTH_MS / 2)
    const at = list().scrollTop
    fireEvent.touchStart(list())
    frames(SMOOTH_MS)
    expect(list().scrollTop).toBe(at)
  })
})

describe('(c) 창 높이 변화 때 끝 유지', () => {
  let trigger: () => void = () => {}
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { trigger = cb }
      observe() {}
      disconnect() {}
    })
  })

  it('끝에 붙어 있었다면 높이가 바뀔 때 끝을 유지한다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    list().scrollTop = 12345
    fireEvent.scroll(list())
    list().scrollTop = 12000 // 창 높이가 바뀐 뒤 위치가 어긋난 상태
    trigger()
    expect(list().scrollTop).toBe(12345)
  })

  it('위로 올려 보는 중이면 높이가 바뀌어도 위치를 건드리지 않는다', () => {
    render(<ChatTrialScreen onBack={() => {}} />)
    list().scrollTop = 100
    fireEvent.scroll(list())
    trigger()
    expect(list().scrollTop).toBe(100)
  })
})
