/** A-3 탭 바 아래는 화면으로 인식하지 않는다 - 탭 바 뒤 바탕색 받침 + 모든 탭 본문의 아래 여백이 탭 바 높이(12 + 64) + 안전 영역 이상. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TabBar } from './TabBar'

afterEach(cleanup)

describe('A-3 탭 바 받침', () => {
  it('메인을 뺀 탭에는 받침이 있고(내용이 탭 바 옆 · 아래로 비치지 않음), 메인은 하늘이 보이게 받침이 없다', () => {
    const { rerender } = render(<TabBar active="feed" onSelect={() => {}} />)
    expect(screen.getByTestId('tab-shelf')).toBeTruthy()
    rerender(<TabBar active="main" onSelect={() => {}} />)
    expect(screen.queryByTestId('tab-shelf')).toBeNull()
    for (const t of ['chat', 'magazine', 'settings'] as const) {
      rerender(<TabBar active={t} onSelect={() => {}} />)
      expect(screen.getByTestId('tab-shelf')).toBeTruthy()
    }
  })

  it('받침은 터치를 가로채지 않는다 · 탭 바는 5개 그대로', () => {
    render(<TabBar active="chat" onSelect={() => {}} />)
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8')
    expect(css).toMatch(/\.tabShelf\s*\{[^}]*pointer-events:\s*none/)
  })

  it('탭 본문(.tabBody · .mainScroll · .feedScroll · .magazineScroll)의 아래 여백은 탭 바(12 + 64) + 안전 영역 이상', () => {
    const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8')
    for (const sel of ['tabBody', 'mainScroll', 'feedScroll', 'magazineScroll']) {
      const rule = new RegExp(String.raw`\.${sel}\s*\{[^}]*\}`, 's').exec(css)?.[0] ?? ''
      expect(rule, sel).toMatch(/var\(--bot\)\s*\+\s*12px\s*\+\s*64px\s*\+\s*(2[4-9]|[3-9]\d|\d{3,})px/)
    }
  })
})
