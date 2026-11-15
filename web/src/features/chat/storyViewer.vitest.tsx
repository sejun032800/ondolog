/** A-16 · R94-6 스토리 진행 막대 - 5000ms 자동 넘김 · 시간 채움 · 좌우 탭 · 누르면 멈춤 · 마지막 뒤 닫힘 · 줄인 모션이면 애니메이션만 뺀다. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { STORY_AUTO_ADVANCE_MS, STORY_CLOSE_MS, STORY_CLOSE_REDUCED_MS, STORY_SWIPE_DOWN_PX, StoryViewer, type StoryViewPayload } from './StoryViewer'

vi.mock('./useSignedMedia', () => ({ useSignedMedia: (_b: string, paths: string[]) => Object.fromEntries(paths.map((p) => [p, `https://x.test/${p}`])) }))

const story: StoryViewPayload = {
  authorName: '서영', isMine: false,
  items: [1, 2, 3].map((n) => ({ id: `s${n}`, path: `c1/${n}.jpg`, createdAt: '2026-10-03T00:00:00Z' })),
}
const segs = () => screen.getByTestId('story-segments').querySelectorAll('i')

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('A-16 스토리 막대', () => {
  it('막대 수 = 스토리 수, 기본값은 5000ms(R94-6)', () => {
    expect(STORY_AUTO_ADVANCE_MS).toBe(5000)
    render(<StoryViewer story={story} onClose={vi.fn()} />)
    expect(segs()).toHaveLength(3)
    expect(segs()[0].getAttribute('style')).toContain('5000ms')
    act(() => { vi.advanceTimersByTime(4999) })
    expect(segs()[0].className).toContain('fill')
    act(() => { vi.advanceTimersByTime(1) })
    expect(segs()[1].className).toContain('fill')
  })

  it('정지 막대(autoAdvanceMs=null)면 자동으로 넘어가지 않는다', () => {
    render(<StoryViewer story={story} onClose={vi.fn()} autoAdvanceMs={null} />)
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(1)
  })

  it('한 장짜리 스토리는 막대 하나', () => {
    render(<StoryViewer story={{ ...story, items: story.items.slice(0, 1) }} onClose={vi.fn()} />)
    expect(segs()).toHaveLength(1)
  })

  it('켜면: 지금 장이 시간으로 차오르고(fill), 시간이 되면 다음 장 · 마지막 장이 끝나면 닫는다', () => {
    const onClose = vi.fn()
    render(<StoryViewer story={story} onClose={onClose} autoAdvanceMs={5000} />)
    expect(segs()[0].className).toContain('fill')
    expect(segs()[0].getAttribute('style')).toContain('5000ms')
    act(() => { vi.advanceTimersByTime(4999) })
    expect(segs()[0].className).toContain('cur')
    act(() => { vi.advanceTimersByTime(1) })
    expect(segs()[0].className).toBe('on') // 지난 장은 가득
    expect(segs()[1].className).toContain('fill') // 다음 장이 차오르기 시작
  })

  it('눌러서 넘기면 다음 장의 시간이 처음부터 다시 센다 · 이전 장으로도 간다', () => {
    const onClose = vi.fn()
    render(<StoryViewer story={story} onClose={onClose} autoAdvanceMs={5000} />)
    act(() => { vi.advanceTimersByTime(3000) })
    fireEvent.click(screen.getByTestId('story-next'))
    expect(segs()[1].className).toContain('fill')
    act(() => { vi.advanceTimersByTime(4999) })
    expect(segs()[1].className).toContain('fill') // 3초 지난 값을 물려받지 않는다
    act(() => { vi.advanceTimersByTime(1) })
    expect(segs()[2].className).toContain('fill')
    act(() => { vi.advanceTimersByTime(5000) })
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_MS) }) // 닫힘 연출 뒤에 닫는다(R98-7)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('마지막 장이 다 차면 닫힌다', () => {
    const onClose = vi.fn()
    render(<StoryViewer story={{ ...story, items: story.items.slice(0, 2) }} onClose={onClose} />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(4999) })
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_MS) }) // 닫힘 연출 뒤에 닫는다(R98-7)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('왼쪽 탭 = 앞 장 · 오른쪽 탭 = 다음 장(시간은 처음부터)', () => {
    render(<StoryViewer story={story} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('story-next'))
    expect(segs()[1].className).toContain('fill')
    fireEvent.click(screen.getByTestId('story-prev'))
    expect(segs()[0].className).toContain('fill')
    expect(segs()[1].className).toBe('')
    act(() => { vi.advanceTimersByTime(4999) })
    expect(segs()[0].className).toContain('fill')
  })

  it('누르고 있으면 멈추고(막대도) 떼면 남은 시간만큼 이어서 간다 - 떼도 넘어가지 않는다', () => {
    render(<StoryViewer story={story} onClose={vi.fn()} />)
    act(() => { vi.advanceTimersByTime(3000) })
    const right = screen.getByTestId('story-next')
    fireEvent.pointerDown(right)
    expect(segs()[0].className).toContain('hold')
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(segs()[0].className).toContain('fill') // 멈춰 있는 동안 넘어가지 않는다
    fireEvent.pointerUp(right)
    fireEvent.click(right) // 오래 눌렀다 뗀 뒤의 click은 탭이 아니다
    expect(segs()[0].className).toContain('fill')
    expect(segs()[0].className).not.toContain('hold')
    act(() => { vi.advanceTimersByTime(1999) })
    expect(segs()[0].className).toContain('fill') // 3초 썼으니 남은 2초
    act(() => { vi.advanceTimersByTime(1) })
    expect(segs()[1].className).toContain('fill')
  })

  it('짧게 눌렀다 떼면 탭으로 센다', () => {
    render(<StoryViewer story={story} onClose={vi.fn()} />)
    const right = screen.getByTestId('story-next')
    fireEvent.pointerDown(right)
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.pointerUp(right)
    fireEvent.click(right)
    expect(segs()[1].className).toContain('fill')
  })

  it('줄인 모션이면 자동 넘김(시간)은 그대로, 차오르는 애니메이션만 뺀다', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const onClose = vi.fn()
    render(<StoryViewer story={{ ...story, items: story.items.slice(0, 2) }} onClose={onClose} />)
    expect(screen.getByTestId('story-segments').querySelectorAll('i.fill')).toHaveLength(0)
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(2)
    act(() => { vi.advanceTimersByTime(5000) })
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_MS) }) // 닫힘 연출 뒤에 닫는다(R98-7)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

/** 76-D1 · R98-7 열림 · 닫힘 연출 - 닫힘은 즉시 언마운트가 아니라 연출(0.22초) 뒤다. */
describe('D1 스토리 닫힘 연출', () => {
  const closing = () => screen.getByTestId('story-viewer').className.includes('closing')

  it('✕: 바로 닫지 않고 closing 연출을 시작하고, 0.22초 뒤에 닫는다', () => {
    const onClose = vi.fn()
    render(<StoryViewer story={story} onClose={onClose} />)
    expect(STORY_CLOSE_MS).toBe(220)
    expect(closing()).toBe(false)
    fireEvent.click(screen.getByTestId('story-close'))
    expect(onClose).not.toHaveBeenCalled()
    expect(closing()).toBe(true)
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_MS - 1) })
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('자동 닫힘(마지막 장이 끝남)도 같은 연출을 지난다', () => {
    const onClose = vi.fn()
    render(<StoryViewer story={{ ...story, items: story.items.slice(0, 1) }} onClose={onClose} autoAdvanceMs={5000} />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(closing()).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_MS) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('마지막 장에서 다음을 누르면 같은 연출', () => {
    const onClose = vi.fn()
    render(<StoryViewer story={{ ...story, items: story.items.slice(0, 1) }} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('story-next'))
    expect(closing()).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_MS) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('아래로 밀기(80px 넘게 끌고 떼기)도 같은 연출 - 짧은 끌기는 닫지 않는다', () => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {}) // jsdom에는 PointerEvent가 없어 clientY를 실으려면 필요
    const onClose = vi.fn()
    render(<StoryViewer story={story} onClose={onClose} />)
    const next = screen.getByTestId('story-next')
    fireEvent.pointerDown(next, { clientY: 100 })
    fireEvent.pointerUp(next, { clientY: 100 + STORY_SWIPE_DOWN_PX - 10 })
    expect(closing()).toBe(false)
    fireEvent.pointerDown(next, { clientY: 100 })
    fireEvent.pointerUp(next, { clientY: 100 + STORY_SWIPE_DOWN_PX + 10 })
    expect(closing()).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_MS) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('연출 중 다시 눌러도 한 번만 닫는다', () => {
    const onClose = vi.fn()
    render(<StoryViewer story={story} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('story-close'))
    fireEvent.click(screen.getByTestId('story-close'))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('줄인 모션이면 0.15초(투명만) 뒤에 닫는다', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    const onClose = vi.fn()
    render(<StoryViewer story={story} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('story-close'))
    act(() => { vi.advanceTimersByTime(STORY_CLOSE_REDUCED_MS - 1) })
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
