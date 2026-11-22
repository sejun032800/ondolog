/**
 * 84-h 시험판 "유성 미리 보기" - 출시 빌드 쪽(`IS_TRIAL_BUILD` = false). 설정 줄 0 · 하늘에 미리 보기 요청이 남아 있어도 떨어지지 않는다.
 * 번들에 글자가 남지 않는 것은 `smoke/run.mjs`(출시 빌드 임시 폴더 검사)와 `meteorPreview84h.vitest.tsx`의 `web/dist` 검사가 본다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { makeFakeNav } from '../../testSupport'
import type { DayRecord } from '../records/dayRecordRead'
import type { SkyData } from './skyData'
import { requestMeteorPreview, takeMeteorPreview } from './meteorPreview'
import { useSkyPrefStore } from './skyPrefs'

vi.mock('../../config/env', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../config/env')>()), IS_TRIAL_BUILD: false }))
const hoisted = vi.hoisted(() => ({ data: null as unknown }))
vi.mock('./skyData', () => ({ useSky: () => hoisted.data, useSkyNames: () => ({}), useSkyPhotoUrls: () => ({}) }))
vi.mock('../../platform/motion', () => ({ prefersReducedMotion: () => true }))
vi.mock('../../auth/client', async (orig) => ({ ...(await orig<object>()), getSupabase: () => null }))
vi.mock('../settings/useSettingsSummary', () => ({
  useSettingsSummary: () => ({ loaded: true, displayName: '세준', provider: 'kakao', loveTypeLabelEn: null, partnerName: '서영' }),
}))

const { SkyScreen } = await import('./SkyScreen')
const { SettingsView } = await import('../settings/SettingsView')

const rec = (id: string, date: string): DayRecord => ({
  id, date, stops: [{ id: `${id}s`, seq: 1, arrivedAt: `${date}T10:00:00+09:00`, placeName: '망원' }], photos: [], memos: [], counts: { stops: 1, photos: 0, memos: 0 },
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T12:00:00+09:00'))
  hoisted.data = { loading: false, error: false, records: [rec('r0', '2026-10-03')], allLoaded: true, temps: {}, tempStatus: {}, moons: [], draftPeriodStart: null, ensureTemps: vi.fn() } satisfies SkyData
  useAuthStore.setState({ userId: 'u1' })
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1', relationshipStartDate: '2026-01-01', grace: false, graceCoupleId: null, gracePartnerId: null })
  useSkyPrefStore.getState().load('u1')
})
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); takeMeteorPreview(); useSkyPrefStore.setState({ userId: null }) })

describe('84-h 출시 빌드(IS_TRIAL_BUILD = false)', () => {
  it('설정 OUR SKY에 미리 보기 줄 0 - 실제 두 줄만', () => {
    render(<SettingsView nav={makeFakeNav()} />)
    expect(screen.queryByTestId('settings-row-sky-meteor-preview')).toBeNull()
    expect(screen.queryByText(/미리 보기/)).toBeNull()
    const rows = Array.from(screen.getByTestId('settings-oursky').querySelectorAll('[data-testid^="settings-row-"]')).map((el) => el.getAttribute('data-testid'))
    expect(rows).toEqual(['settings-row-sky-meteor', 'settings-row-sky-twinkle'])
  })

  it('미리 보기 요청이 남아 있어도 하늘에 떨어지지 않는다(요청을 읽지도 않는다)', async () => {
    requestMeteorPreview()
    render(<SkyScreen nav={makeFakeNav()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
    expect(screen.queryByTestId('sky-fallen')).toBeNull()
    expect(takeMeteorPreview()).toBe(true) // 하늘 화면이 읽지 않았다 - 분기째 없음
  })
})
