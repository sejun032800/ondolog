/**
 * A-4 "읽기 전 결론 화면 0" - 데이터를 읽는 동안 빈 상태 · 0% · "연결 전" · 낡은 값을 그리지 않고 이미 있는 회색 자리 표시(`Skeleton`)를 그린다.
 * 대상: 매거진 첫 진입 · 설정 > 커플 · 연결 직후 메인. 서버는 가짜(원격 0).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { setSupabaseForTest } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { MagazineTab } from '../tabs/MagazineTab'
import { MainView } from './main/MainView'
import { CoupleScreen } from './settings/CoupleScreen'
import { settingsDb } from './settings/settingsTestSupport'
import { forgetLibrary } from './magazine/libraryData'
import { useCoupleStore } from '../stores/coupleStore'
import { useDissolutionStore } from '../stores/dissolutionStore'
import { makeFakeNav } from '../testSupport'

beforeEach(() => {
  settingsDb() // 가짜 서버를 꽂아 둔다(실제 클라이언트 · 원격 0)
  useAuthStore.getState().setUserId('me')
  useCoupleStore.getState().reset()
  useDissolutionStore.getState().reset()
  forgetLibrary()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
})

describe('A-4 매거진 첫 진입', () => {
  it('연결 여부를 읽는 중(loading)에는 빈 화면이 아니라 뼈대 - 0% · 첫 호 · 잠긴 문을 그리지 않는다', () => {
    useCoupleStore.setState({ status: 'loading' })
    render(<MagazineTab />)
    expect(screen.getByTestId('library-skeleton')).toBeTruthy()
    expect(screen.queryByTestId('first-issue')).toBeNull()
    expect(screen.queryByTestId('first-issue-percent')).toBeNull()
    expect(screen.queryByTestId('unconnected-library')).toBeNull()
  })

  it('연결됐지만 서재를 아직 못 읽었으면 뼈대 - 0%를 그리지 않는다', () => {
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1' })
    render(<MagazineTab />) // 서버 연결 없음 -> 읽기가 끝나지 않는다
    expect(screen.getByTestId('library-skeleton')).toBeTruthy()
    expect(screen.queryByTestId('first-issue-percent')).toBeNull()
  })

  it('미연결로 확정되면 잠긴 문(뼈대 아님) - 탭은 보인다', () => {
    useCoupleStore.setState({ status: 'disconnected' })
    render(<MagazineTab />)
    expect(screen.getByTestId('unconnected-library')).toBeTruthy()
    expect(screen.queryByTestId('library-skeleton')).toBeNull()
  })
})

describe('A-4 설정 > 커플', () => {
  it('처음 열 때 다시 읽기가 끝날 때까지 뼈대 - 낡은 "연결됨 · 유예 없음" 값을 그리지 않는다. 끝나면 본문', async () => {
    // 이전에 읽어 둔 낡은 값(연결 · 유예 없음)이 있다.
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1', nickname: '낡은', relationshipStartDate: '2025-01-01' })
    useDissolutionStore.setState({ status: 'loaded', dissolution: null })
    render(<CoupleScreen nav={makeFakeNav()} />)
    // 첫 그림: 다시 읽기가 끝나기 전이다
    expect(screen.getByTestId('settings-couple')).toBeTruthy()
    expect(document.querySelector('[data-testid="skeleton"]')).toBeTruthy()
    expect(screen.queryByText('낡은')).toBeNull()
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0)
    expect(document.body.textContent).toContain('늘봄') // 서버 값
  })
})

describe('A-4 연결 직후 메인', () => {
  const base = {
    now: new Date('2025-10-21T12:00:00+09:00'), nickname: null, storedTemperature: null, startDate: null, selfName: '세준', partnerName: null,
    facts: { hasActivity: null, profilesComplete: null, openedIssueIds: [], openedFor: null },
    library: { issues: [], coverUrls: {}, next: null, loading: true, error: false },
    summary: null, onInvite: () => {}, onChat: () => {}, onOpenIssue: () => {},
  }
  it('연결 여부를 읽는 중에는 뼈대 - "아직 혼자예요" · 초대 버튼을 그리지 않는다', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<MainView {...(base as any)} status="loading" />)
    expect(screen.getByTestId('main-wait')).toBeTruthy()
    expect(screen.queryByTestId('main-state-B05')).toBeNull()
    expect(document.body.textContent).not.toContain('아직 혼자예요')
  })
  it('연결됐어도 사실 · 호 목록을 다 읽기 전에는 뼈대 - 0% · "첫 온도" 결론을 그리지 않는다', () => {
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'p1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<MainView {...(base as any)} status="connected" />)
    expect(screen.getByTestId('main-wait')).toBeTruthy()
    expect(screen.queryByTestId('main-issue-percent')).toBeNull()
  })
})
