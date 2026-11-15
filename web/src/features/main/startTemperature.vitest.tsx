/** A-2-5 시작 온도 - 엔진 값과 같다(결정론) · 저장값이 이긴다 · 표시 전용(서버 쓰기 0). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { computeDailyTemperature } from '@/engine/temperature'
import { resolveTypeAffinity } from '@/engine/typeAffinity'
import type { EnneagramCore } from '@/constants/enneagram'
import { useCoupleStore } from '../../stores/coupleStore'
import { MainView, type MainViewProps } from './MainView'
import { START_TEMPERATURE_COEFFICIENTS, START_TEMPERATURE_COPY, startTemperatureOf } from './startTemperature'

const CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const BY_CATEGORY = { contrast: 36.5, neutral: 39, best: 42 } as const

describe('startTemperatureOf (엔진 그대로)', () => {
  it('모든 코어 조합(9x9)에서 범주 값(36.5 / 39 / 42)이고 배치 식(activityDelta = 0)과 같다', () => {
    const seen = new Set<number>()
    for (const a of CORES) for (const b of CORES) {
      const v = startTemperatureOf(a, b)
      expect(v).toBe(BY_CATEGORY[resolveTypeAffinity(a, b)])
      const batch = computeDailyTemperature(a, b, [], { baseline: START_TEMPERATURE_COEFFICIENTS, activity: { windowDays: 14, widthCap: 55, min: 0 } })
      expect(v).toBe(batch)
      expect(startTemperatureOf(b, a)).toBe(v) // 순서와 무관
      seen.add(v as number)
    }
    expect([...seen].sort()).toEqual([36.5, 39, 42]) // 세 범주가 모두 나온다
  })

  it('범주별 표본: 잘 맞음 (1,7) = 42 · 온도차 (1,8) = 36.5 · 중립 (1,2) = 39 · 비대칭(2,9)은 높은 쪽 42', () => {
    expect(startTemperatureOf(1, 7)).toBe(42)
    expect(startTemperatureOf(1, 8)).toBe(36.5)
    expect(startTemperatureOf(1, 2)).toBe(39)
    expect(startTemperatureOf(2, 9)).toBe(42)
  })

  it('같은 입력은 늘 같은 값(결정론) · 코어가 빠지면 지어내지 않고 null', () => {
    expect(startTemperatureOf(4, 5)).toBe(startTemperatureOf(4, 5))
    expect(startTemperatureOf(null, 5)).toBeNull()
    expect(startTemperatureOf(4, undefined)).toBeNull()
  })
})

describe('메인 히어로', () => {
  beforeEach(() => { useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1' }) })
  afterEach(() => { cleanup(); useCoupleStore.getState().reset() })
  const base = (over: Partial<MainViewProps>): MainViewProps => ({
    now: new Date('2025-10-21T12:00:00+09:00'), status: 'connected', nickname: null, storedTemperature: null, startDate: '2025-10-01', selfName: '세준', partnerName: '서영',
    facts: { hasActivity: false, profilesComplete: true, openedIssueIds: new Set(), openedFor: '' },
    library: { issues: [], coverUrls: {}, next: null, loading: false, error: false },
    summary: null, onInvite: () => {}, onChat: () => {}, onOpenIssue: () => {}, ...over,
  })

  it('활동 0일: 시작 온도 숫자 + 안내 문장 + 기존 보조 문구', () => {
    render(<MainView {...base({ startTemperature: 42 })} />)
    expect(screen.getByTestId('main-start-temperature')).toBeTruthy()
    expect(screen.getByRole('img', { name: '42.0도' })).toBeTruthy()
    expect(screen.getByTestId('main-start-temperature-caption').textContent).toBe(START_TEMPERATURE_COPY)
    expect(START_TEMPERATURE_COPY).toBe('시작 온도예요. 기록이 쌓이면 다음 날부터 움직여요.')
    expect(document.body.textContent).toContain('아직 온도를 잴')
  })

  it('활동은 있는데 저장값이 아직 없을 때도(첫 배치 전) 시작 온도 + "첫 온도는 기록한 다음 날 나와요"', () => {
    render(<MainView {...base({ startTemperature: 39, facts: { hasActivity: true, profilesComplete: true, openedIssueIds: new Set(), openedFor: '' } })} />)
    expect(screen.getByRole('img', { name: '39.0도' })).toBeTruthy()
    expect(document.body.textContent).toContain('첫 온도는 기록한')
  })

  it('저장값이 있으면 저장값이 이긴다 - 시작 온도를 그리지 않는다', () => {
    render(<MainView {...base({ startTemperature: 42, storedTemperature: 38.2, facts: { hasActivity: true, profilesComplete: true, openedIssueIds: new Set(), openedFor: '' } })} />)
    expect(screen.queryByTestId('main-start-temperature')).toBeNull()
    expect(screen.getByRole('img', { name: '38.2도' })).toBeTruthy()
  })

  it('시작 온도를 못 구했으면(프로필 한쪽 없음 등) 지금까지의 문구 그대로', () => {
    render(<MainView {...base({ startTemperature: null })} />)
    expect(screen.queryByTestId('main-start-temperature')).toBeNull()
    expect(document.body.textContent).toContain('아직 온도를 잴')
  })

  it('프로필이 미완이면 36.5 고정 그대로(시작 온도로 덮지 않는다)', () => {
    render(<MainView {...base({ startTemperature: 42, facts: { hasActivity: false, profilesComplete: false, openedIssueIds: new Set(), openedFor: '' } })} />)
    expect(screen.queryByTestId('main-start-temperature')).toBeNull()
    expect(screen.getByRole('img', { name: '36.5도' })).toBeTruthy()
  })
})
