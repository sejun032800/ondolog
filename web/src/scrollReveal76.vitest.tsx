/** 76-0-4 · B6(R99-3 · R99-2 P4) 결과 상세 - 지나간 요소는 바로 보인다(빈 화면 · 빈 막대 · 흐림 0). 스크롤 물리는 건드리지 않는다. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DetailBody } from './screens'
import { isSeenEntry } from './ui'

const props = {
  labelEn: 'KEELEMBER', labelKo: '키엠버', meta: 'ENFP · 7', description: ['가', '나'],
  big5: { bigE: 70, bigO: 60, bigA: 80, bigC: 40, bigN: 30 }, sternberg: { intimacy: 60, passion: 70, commitment: 50 },
  core: 7 as const, candidates: [] as never[], onMismatch: () => {},
}

describe('isSeenEntry - 이미 위로 지나간 요소도 본 것', () => {
  const e = (over: Partial<Parameters<typeof isSeenEntry>[0]>) => ({ isIntersecting: false, intersectionRatio: 0, boundingClientRect: { bottom: 500 }, rootBounds: { top: 0 }, ...over })
  it('35% 이상 겹침 = 봄 · 살짝 겹침 = 아직 · 아래에 있음 = 아직 · 위로 벗어남 = 봄(빠른 넘김)', () => {
    expect(isSeenEntry(e({ isIntersecting: true, intersectionRatio: 0.5 }))).toBe(true)
    expect(isSeenEntry(e({ isIntersecting: true, intersectionRatio: 0.1 }))).toBe(false)
    expect(isSeenEntry(e({ boundingClientRect: { bottom: 900 } }))).toBe(false)
    expect(isSeenEntry(e({ boundingClientRect: { bottom: -20 } }))).toBe(true)
    expect(isSeenEntry(e({ boundingClientRect: { bottom: 0 }, rootBounds: null }))).toBe(true)
  })
})

class FakeObserver { observe() {} disconnect() {} unobserve() {} takeRecords() { return [] } }

describe('결과 상세 DetailBody', () => {
  beforeEach(() => { ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver })
  afterEach(() => cleanup())
  const fills = () => [...document.querySelectorAll('.barRow .fl')].map((n) => (n as HTMLElement).style.width)

  it('처음에는 연출 시간표대로(막대 비어 있음 · 나머지 카드 투명)', () => {
    render(<DetailBody {...props} />)
    expect(fills().every((w) => w === '0px' || w === '0' || w === '')).toBe(true)
    expect((document.querySelector('.footer') as HTMLElement).style.opacity).toBe('0')
  })

  it('스크롤하기 시작하면 시간표를 버리고 전부 끝난 모습 - 막대 · 삼각형 · 아래 카드가 바로 보인다(빠른 넘김에 빈 화면 0)', () => {
    render(<DetailBody {...props} />)
    const content = document.querySelector('.content') as HTMLElement
    Object.defineProperty(content, 'scrollTop', { value: 600, configurable: true })
    fireEvent.scroll(content)
    expect([...fills()].sort()).toEqual(['30%', '40%', '60%', '70%', '80%']) // 순서는 BIG5_ORDER, 값은 모두 채워짐
    expect((document.querySelector('.footer') as HTMLElement).style.opacity).toBe('1')
    // 등장 연출(.appear + 지연)이 남아 있지 않다 - 투명 시작 · 흐림이 없다.
    for (const el of document.querySelectorAll<HTMLElement>('.appear')) {
      expect(el.style.animation).toBe('none')
      expect(el.style.opacity).toBe('1')
    }
    expect(screen.getByText('온도가 잘 맞는 유형')).toBeTruthy()
  })
})
