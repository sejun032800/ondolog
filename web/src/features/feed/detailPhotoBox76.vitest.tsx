/** 76-B4(R99-2 P2) 상세 큰 사진 칸 - 사진이 오기 전에 크기가 정해진다 · 저절로 스크롤하는 코드가 없다. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { makeFakeNav } from '../../testSupport'
import { COUPLE_ROW, PROFILES, dateRow, makeFeedDb, photoRow, stopRow } from './feedTestSupport'
import { DateDetailScreen } from './DateDetailScreen'
import { PHOTO_BOX_RATIO_MAX, PHOTO_BOX_RATIO_MIN, photoBoxRatio } from './photoBox'

describe('photoBoxRatio', () => {
  it('가로/세로 비율 · 너무 길거나 납작하면 자른다 · 모르면 null', () => {
    expect(photoBoxRatio(4000, 3000)).toBeCloseTo(4 / 3)
    expect(photoBoxRatio(3000, 4000)).toBe(PHOTO_BOX_RATIO_MIN)
    expect(photoBoxRatio(9000, 1000)).toBe(PHOTO_BOX_RATIO_MAX)
    expect(photoBoxRatio(null, 3000)).toBeNull()
    expect(photoBoxRatio(0, 0)).toBeNull()
  })
})

describe('E03 상세 사진 칸', () => {
  beforeEach(() => {
    useAuthStore.getState().setUserId('me')
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
  })
  afterEach(() => { cleanup(); setSupabaseForTest(undefined); useAuthStore.getState().setUserId(null); useCoupleStore.getState().reset() })

  const open = (entries: Record<string, unknown>[]) => {
    const db = makeFeedDb({
      me: 'me', couples: [COUPLE_ROW], profiles: PROFILES, dates: [dateRow('d1', '2026-10-03')],
      stops: [stopRow('s0', 'd1', 0, '2026-10-03T14:20:00+09:00', '홍대')], entries,
    })
    setSupabaseForTest(db.client)
    render(<MemoryRouter initialEntries={['/date-detail?id=d1']}><DateDetailScreen nav={makeFakeNav()} /></MemoryRouter>)
  }

  it('한 장짜리 칸: width/height가 있으면 그 비율로 칸을 잡는다(사진 주소가 오기 전에도 같은 칸)', async () => {
    open([photoRow('p1', { captured_at: '2026-10-03T14:30:00+09:00', width: 4000, height: 3000 })])
    const box = await screen.findByTestId('photo-box-p1')
    expect(box.getAttribute('style')).toContain('aspect-ratio: 1.33')
  })

  it('크기를 모르면 CSS 고정 높이(인라인 비율 없음) · 두 장이면 고정 높이 칸', async () => {
    open([photoRow('p1', { captured_at: '2026-10-03T14:30:00+09:00' })])
    expect((await screen.findByTestId('photo-box-p1')).getAttribute('style')).toBeNull()
    cleanup()
    open([photoRow('p1', { captured_at: '2026-10-03T14:30:00+09:00', width: 4000, height: 3000 }), photoRow('p2', { captured_at: '2026-10-03T14:40:00+09:00', width: 4000, height: 3000 })])
    expect((await screen.findByTestId('photo-box-p2')).getAttribute('style')).toBeNull()
  })
})

describe('상세 화면에는 저절로 스크롤하는 코드가 없다', () => {
  it('DateDetailScreen · feedData에 scrollIntoView · scrollTo · scrollTop · focus() 호출이 없다(원인 판정 고정)', () => {
    for (const f of ['DateDetailScreen.tsx', 'feedData.ts']) {
      const src = readFileSync(join(process.cwd(), 'src/features/feed', f), 'utf-8')
      expect(src).not.toMatch(/scrollIntoView|scrollTo\(|scrollTop|\.focus\(/)
    }
  })
  it('상세 스크롤 칸은 scroll anchoring을 끄고 머리 큰 사진 칸은 높이 고정이다', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf-8')
    expect(css).toMatch(/\.detailScroll \{[^}]*overflow-anchor: none/)
    expect(css).toMatch(/\.detailHero \{[^}]*height: 420px[^}]*flex: none/)
  })
})
