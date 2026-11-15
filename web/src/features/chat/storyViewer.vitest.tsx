/** A-16 스토리 진행 막대 - 개수 = 스토리 수 · 켜졌을 때 시간 채움 + 자동 넘김 + 눌러 넘기기 · 꺼진 기본값은 정지 막대 · 줄인 모션이면 자동 넘김 0. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { STORY_AUTO_ADVANCE_MS, StoryViewer, type StoryViewPayload } from './StoryViewer'

vi.mock('./useSignedMedia', () => ({ useSignedMedia: (_b: string, paths: string[]) => Object.fromEntries(paths.map((p) => [p, `https://x.test/${p}`])) }))

const story: StoryViewPayload = {
  authorName: '서영', isMine: false,
  items: [1, 2, 3].map((n) => ({ id: `s${n}`, path: `c1/${n}.jpg`, createdAt: '2026-10-03T00:00:00Z' })),
}
const segs = () => screen.getByTestId('story-segments').querySelectorAll('i')

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('A-16 스토리 막대', () => {
  it('막대 수 = 스토리 수, 기본값(꺼짐)은 정지 막대 - 자동으로 넘어가지 않는다', () => {
    expect(STORY_AUTO_ADVANCE_MS).toBeNull()
    render(<StoryViewer story={story} onClose={vi.fn()} />)
    expect(segs()).toHaveLength(3)
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
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('줄인 모션이면 켜져 있어도 차오름 · 자동 넘김 없이 정지 막대(눌러 넘기기는 된다)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    const onClose = vi.fn()
    render(<StoryViewer story={story} onClose={onClose} autoAdvanceMs={5000} />)
    expect(screen.getByTestId('story-segments').querySelectorAll('i.fill')).toHaveLength(0)
    act(() => { vi.advanceTimersByTime(20_000) })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('story-next'))
    expect(screen.getByTestId('story-segments').querySelectorAll('i.on')).toHaveLength(2)
  })
})
