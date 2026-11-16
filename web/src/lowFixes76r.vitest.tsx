/**
 * 76-r 낮음 F7 · F8(R102-4).
 *  - F7 받은 사진 칸: 들어오기 전 자리 표시 색(waiting) -> 들어오면 흐려 나타남(ready). 한 번 그려진 뒤에는 다시 숨지 않는다.
 *  - F8 결과 상세 머리: 영문 · 이름 · 설명이 시작 투명 0인 `appear`가 아니라 `appearTop`(시작 .55)로 첫 프레임부터 보인다.
 * 폰에서만 확인되는 것: 실제 0.6초 · 0.3초 체감(녹화 판독).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ChatMessageItem } from './features/chat/ChatView'
import { DetailBody } from './screens'

afterEach(() => cleanup())

describe('F7 받은 사진 칸', () => {
  const msg = { id: 'm', clientMsgId: 'c', coupleId: 'c1', senderId: 'you', body: null, mediaPath: 'c1/p.jpg', sentAt: '2026-11-16T00:00:00Z', readAt: null }
  const props = { isMine: false, senderName: '서영', onRetry: vi.fn(), onCancel: vi.fn(), onOpenPhoto: vi.fn() }

  it('주소가 오기 전 · 사진이 들어오기 전에는 자리 표시(waiting), 들어오면 ready', () => {
    const { rerender } = render(<ChatMessageItem {...props} photoUri={undefined} message={msg} />)
    const box = () => screen.getByTestId('chat-photo-box')
    expect(box().className).toContain('waiting')
    rerender(<ChatMessageItem {...props} photoUri="https://signed.invalid/p" message={msg} />)
    expect(box().className).toContain('waiting')
    fireEvent.load(box().querySelector('img') as HTMLImageElement)
    expect(box().className).toContain('ready')
    rerender(<ChatMessageItem {...props} photoUri="https://signed.invalid/p2" message={msg} />)
    expect(box().className).toContain('ready')
  })

  it('CSS: 자리 표시 맥박 · 흐려 나타남 · 줄인 모션 대응', () => {
    const css = readFileSync(join(__dirname, 'styles.css'), 'utf8')
    expect(css).toMatch(/\.chatPhoto\.waiting::before \{[^}]*skeletonPulse/)
    expect(css).toMatch(/\.chatPhoto\.ready img \{ opacity: 1; \}/)
  })
})

describe('F8 결과 상세 진입', () => {
  class FakeObserver { observe() {} disconnect() {} unobserve() {} takeRecords() { return [] } }
  it('머리 · 본문은 appearTop(시작 투명 0 아님) · 지연 0.12초 이하', () => {
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver
    render(
      <DetailBody
        labelEn="KEELEMBER" labelKo="키엠버" meta="ENFP · 7" description={['가', '나']}
        big5={{ bigE: 70, bigO: 60, bigA: 80, bigC: 40, bigN: 30 }} sternberg={{ intimacy: 60, passion: 70, commitment: 50 }}
        core={7} candidates={[]} onMismatch={() => {}}
      />,
    )
    for (const id of ['detail-head-kicker', 'detail-head-title', 'detail-head-body']) {
      const el = screen.getByTestId(id)
      expect(el.className).toContain('appearTop')
      expect(el.className.split(/\s+/)).not.toContain('appear')
      expect(parseInt(el.style.animationDelay || '0', 10)).toBeLessThanOrEqual(120)
    }
    const css = readFileSync(join(__dirname, 'styles.css'), 'utf8')
    const from = /@keyframes appearTop \{ from \{ opacity: ([\d.]+)/.exec(css)
    expect(Number(from?.[1])).toBeGreaterThan(0)
  })
})
