/**
 * 서재 · 뷰어 시험(74-6) - 원본 RN: `__tests__/components/u3Library.test.tsx` · `u3MagazineTab.test.tsx` · `u3ViewerModal.test.tsx`(행동 단언) +
 * `services/magazineApi.test.ts`의 "issues_public만 · 인쇄 경로 0" 단언을 화면 호출 수준에서 다시 확인한다. 서버는 가짜 클라이언트(원격 0).
 * 루트의 순수 규칙(`@/utils/magazine`, `@/services/magazineApi`)은 루트 jest가 이미 지키므로 여기서는 화면이 그것을 올바르게 부르는지만 본다.
 * B13(빈 상태 깜빡임)은 화면이 거쳐 간 상태를 기록해 순서로 단언한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { Preferences } from '@capacitor/preferences'
import { FIRST_ISSUE_COPY, FRONT_MATTER_NOTICE, NEXT_ISSUE_COPY, UNCONNECTED_COPY } from '@/constants/magazineCopy'
import { loadIssueManifest, tocAvailable } from '@/services/issueManifest'
import { useViewerStore } from '@/store/viewerStore'
import { setInviteEntry } from '../../app/inviteEntry'
import { openIssueViewer, setViewerEntry } from '../../app/viewerEntry'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { handleHardwareBack } from '../../platform/backStack'
import { useCoupleStore } from '../../stores/coupleStore'
import { useViewerOpenStore } from '../../stores/viewerOpenStore'
import { MagazineTab } from '../../tabs/MagazineTab'
import { makeFakeBridge } from '../../testSupport'
import { issueOpenedKey, useIssueOpenedSignal } from '../main/issueSeen'
import { forgetLibrary } from './libraryData'
import { FirstIssue, LibraryContent, LibraryShelf, NextIssueCard, Unconnected, formatVol, materialLines, shelfLabels } from './LibraryView'
import { FrontMatter, IssueViewer, PageReader } from './IssueViewer'
import { installMagazineDb, issueRow, publishedIssue } from './magazineTestSupport'
import { ViewerHost } from './ViewerHost'

// 기기 저장(Capacitor Preferences)은 메모리 사본으로 바꾼다.
vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store.set(key, value) }),
      remove: vi.fn(async ({ key }: { key: string }) => { store.delete(key) }),
      clear: vi.fn(async () => { store.clear() }),
    },
  }
})

// jsdom에는 PointerEvent가 없어(`clientX` · `pointerId`가 사라진다) 시험에서만 마우스 이벤트 위에 얹는다.
if (typeof window.PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent, configurable: true })
}

function setConnected(over: Partial<ReturnType<typeof useCoupleStore.getState>> = {}) {
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'u2', nickname: '늘봄', ...over })
}

beforeEach(() => {
  useCoupleStore.getState().reset()
  useViewerOpenStore.getState().close()
  useViewerStore.getState().reset()
  forgetLibrary()
  useAuthStore.getState().setUserId('u1')
  vi.mocked(Preferences.set).mockClear()
})
afterEach(() => {
  cleanup()
  setInviteEntry(null)
  setViewerEntry(null)
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
})

const dataLibraryMode = () => document.querySelector('[data-library-mode]')?.getAttribute('data-library-mode') ?? 'none'

/** 화면이 거쳐 간 서재 상태를 순서대로 기록한다(연속 중복은 접는다). */
function recordModes() {
  const seen: string[] = [dataLibraryMode()]
  const push = () => {
    const m = dataLibraryMode()
    if (seen[seen.length - 1] !== m) seen.push(m)
  }
  const mo = new MutationObserver(push)
  mo.observe(document.body, { subtree: true, childList: true, attributes: true })
  return { seen, stop: () => { push(); mo.disconnect() } }
}

// ---------------------------------------------------------------------------
// D01 서재 · 다음 호 카드 · D14 · D16 (값만 받아 그리는 부분)
// ---------------------------------------------------------------------------

describe('D01 서재', () => {
  const issues = [publishedIssue({ id: 'i2', issueNumber: 2, periodStart: '2026-09-01', coverPath: 'c1/i2/render/page-01.jpg' }), publishedIssue({ id: 'i1', issueNumber: 1, periodStart: '2026-08-01' })]
  const coverUrls = { 'c1/i2/render/page-01.jpg': 'https://signed.invalid/c2.jpg' }

  it('표지 밖 라벨 "VOL.NN" + "N월호", 번호는 issue_number · 호 수는 "N권"', () => {
    render(<LibraryShelf issues={issues} coverUrls={coverUrls} onOpen={() => {}} />)
    expect(screen.getByText('VOL.02')).toBeTruthy()
    expect(screen.getByText('9월호')).toBeTruthy()
    expect(screen.getByText('VOL.01')).toBeTruthy()
    expect(screen.getByText('8월호')).toBeTruthy()
    expect(screen.getByTestId('library-count').textContent).toBe('2권')
    expect(shelfLabels(issues[0])).toEqual({ vol: 'VOL.02', month: '9월호' })
    expect(formatVol(3)).toBe('VOL.03')
  })

  it('표지 그림 위에는 아무것도 얹지 않는다 - 표지 안에는 이미지뿐이고 글자가 없다 · Vol 라벨만 moon', () => {
    render(<LibraryShelf issues={issues} coverUrls={coverUrls} onOpen={() => {}} />)
    const covers = screen.getAllByTestId('shelf-cover')
    expect(covers).toHaveLength(2)
    for (const c of covers) expect(c.textContent).toBe('')
    expect(covers[0].querySelector('img')?.getAttribute('src')).toBe('https://signed.invalid/c2.jpg')
    expect(covers[1].querySelector('img')).toBeNull() // 서명 주소가 없으면 빈 종이 면
    expect(screen.getByText('VOL.02').className).toBe('libVol')
  })

  it('표지를 누르면 그 호를 연다', () => {
    const onOpen = vi.fn()
    render(<LibraryShelf issues={issues} coverUrls={coverUrls} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('shelf-issue-i2'))
    expect(onOpen).toHaveBeenCalledWith(issues[0])
  })

  it('다음 호 카드: 진행률은 정지 값이고 재료 수 두 줄이 나온다. 제작 현황 링크는 없다', () => {
    render(<NextIssueCard data={{ monthLabel: '10월호', percent: 41, counts: { messages: 412, photos: 18, dates: 3 } }} />)
    expect(screen.getByText(NEXT_ISSUE_COPY.kicker)).toBeTruthy()
    expect(screen.getByText('10월호')).toBeTruthy()
    expect(screen.getByText(NEXT_ISSUE_COPY.status)).toBeTruthy()
    expect(screen.getByTestId('next-issue-percent').textContent).toBe('41%')
    expect(screen.getByText('대화 412 · 사진 18')).toBeTruthy()
    expect(screen.getByText('데이트 3')).toBeTruthy()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
    expect(document.querySelector('.nextLine')?.getAttribute('style')).toContain('59%') // 100 - 41, 채움 연출 없이 위치만
  })

  it('수를 못 셌으면 수 줄을 그리지 않는다', () => {
    render(<NextIssueCard data={{ monthLabel: '10월호', percent: 41, counts: null }} />)
    expect(screen.queryByTestId('next-issue-counts')).toBeNull()
    expect(materialLines(null)).toBeNull()
    expect(materialLines({ messages: 1, photos: 2, dates: 3 })).toEqual(['대화 1 · 사진 2', '데이트 3'])
  })
})

describe('D14 · D16', () => {
  it('D14: 첫 호 문구 + 진행률, 제작 현황 링크 없음', () => {
    render(<FirstIssue percent={0} />)
    expect(screen.getByText(FIRST_ISSUE_COPY.kicker)).toBeTruthy()
    expect(screen.getByText(FIRST_ISSUE_COPY.title)).toBeTruthy()
    expect(screen.getByTestId('first-issue-percent').textContent).toBe('0%')
    expect(screen.getByTestId('issue-silhouette')).toBeTruthy()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('D16: 잠긴 자리와 "연인 초대하기"가 초대로 이어진다', () => {
    const onInvite = vi.fn()
    render(<Unconnected onInvite={onInvite} />)
    expect(screen.getByText(UNCONNECTED_COPY.title)).toBeTruthy()
    expect(screen.getByText(UNCONNECTED_COPY.body)).toBeTruthy()
    fireEvent.click(screen.getByText(UNCONNECTED_COPY.invite))
    expect(onInvite).toHaveBeenCalledTimes(1)
  })

  it('서재 본문 분기: 호 0권이면 D14(초안 진행률 반영), 1권 이상이면 서재 + 다음 호 카드, 초안이 없으면 카드 없음', () => {
    const next = { monthLabel: '10월호', percent: 41, counts: null }
    const { rerender } = render(<LibraryContent mode="first" library={{ issues: [], coverUrls: {}, next }} onOpen={() => {}} onRetry={() => {}} />)
    expect(screen.getByTestId('first-issue-percent').textContent).toBe('41%')
    expect(screen.getByText(FIRST_ISSUE_COPY.shelfHint)).toBeTruthy()
    rerender(<LibraryContent mode="shelf" library={{ issues: [publishedIssue()], coverUrls: {}, next }} onOpen={() => {}} onRetry={() => {}} />)
    expect(screen.getByTestId('next-issue-card')).toBeTruthy()
    expect(screen.getByTestId('library-shelf')).toBeTruthy()
    rerender(<LibraryContent mode="shelf" library={{ issues: [publishedIssue()], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={() => {}} />)
    expect(screen.queryByTestId('next-issue-card')).toBeNull()
  })

  it('오류에서 다시 불러오기, 로딩은 뼈대(스피너 없음)', () => {
    const onRetry = vi.fn()
    const { rerender } = render(<LibraryContent mode="error" library={{ issues: [], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={onRetry} />)
    expect(screen.getByText('서재를 불러오지 못했어요')).toBeTruthy()
    fireEvent.click(screen.getByText('다시 불러오기'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender(<LibraryContent mode="loading" library={{ issues: [], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={() => {}} />)
    expect(screen.getByTestId('library-skeleton')).toBeTruthy()
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('pending · unconnected는 본문이 그리지 않는다(게이트가 맡는다)', () => {
    const { container, rerender } = render(<LibraryContent mode="pending" library={{ issues: [], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={() => {}} />)
    expect(container.firstChild).toBeNull()
    rerender(<LibraryContent mode="unconnected" library={{ issues: [], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 매거진 탭 (훅까지: 가짜 클라이언트)
// ---------------------------------------------------------------------------

describe('매거진 탭', () => {
  it('미연결: 탭은 열리고 D16 "잠긴 문"이 보인다. 초대 버튼은 초대로 간다(서재 조회 0)', async () => {
    const db = installMagazineDb()
    const enter = vi.fn()
    setInviteEntry(enter)
    useCoupleStore.setState({ status: 'disconnected', coupleId: null })
    render(<MagazineTab />)
    expect(screen.getByText('매거진')).toBeTruthy()
    expect(screen.getByText(UNCONNECTED_COPY.title)).toBeTruthy()
    expect(screen.queryByTestId('library-count')).toBeNull()
    fireEvent.click(screen.getByText(UNCONNECTED_COPY.invite))
    expect(enter).toHaveBeenCalledWith('intro')
    expect(db.reads).toHaveLength(0)
    expect(db.rpcs).toHaveLength(0)
  })

  it('D13 · D02 · D04~D06 쪽으로 가는 버튼이 없다', async () => {
    installMagazineDb({ issues: [issueRow()] })
    setConnected()
    render(<MagazineTab />)
    await screen.findByTestId('library-shelf')
    expect(screen.queryByText(/정렬|검색|제작 현황|공유/)).toBeNull()
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('data-testid'))).toEqual(['shelf-issue-i1'])
  })

  it('연결 + 발행된 호 0권: D14 첫 호 시작(초안이 없으면 0%)', async () => {
    installMagazineDb()
    setConnected()
    render(<MagazineTab />)
    expect(await screen.findByTestId('first-issue')).toBeTruthy()
    expect(screen.getByTestId('first-issue-percent').textContent).toBe('0%')
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('연결 + 발행된 호: 최신순 서재(발행 시각 내림차순, 같으면 번호 내림차순) + 다음 호 카드. 표지를 누르면 뷰어 입구가 불린다', async () => {
    const open = vi.fn()
    setViewerEntry(open)
    installMagazineDb({
      issues: [
        issueRow({ id: 'a', issue_number: 1, published_at: '2026-08-01T00:00:00Z', period_start: '2026-07-01', cover_path: 'c1/a/render/page-01.jpg' }),
        issueRow({ id: 'c', issue_number: 3, published_at: '2026-10-01T00:00:00Z', period_start: '2026-09-01', cover_path: 'c1/c/render/page-01.jpg' }),
        issueRow({ id: 'b', issue_number: 2, published_at: '2026-10-01T00:00:00Z', period_start: '2026-09-01', cover_path: 'c1/b/render/page-01.jpg' }),
      ],
      progress: [{ issue_id: 'd', issue_type: 'monthly', period_start: '2026-10-01', period_end: '2026-10-31', corner_type: 'x', status: 'pending', skip_reason: null }],
      counts: { messages: 412, data_entries: 18, dates: 3 },
    })
    setConnected()
    render(<MagazineTab />)
    await screen.findByTestId('library-shelf')
    expect(screen.getAllByTestId(/^shelf-issue-/).map((e) => e.getAttribute('data-testid'))).toEqual(['shelf-issue-c', 'shelf-issue-b', 'shelf-issue-a'])
    expect(screen.getByTestId('next-issue-card')).toBeTruthy()
    expect(screen.getByText('10월호')).toBeTruthy()
    expect(screen.getByText('대화 412 · 사진 18')).toBeTruthy()
    expect(screen.getByText('VOL.03')).toBeTruthy()
    expect(screen.getAllByTestId('shelf-cover')[0].querySelector('img')?.getAttribute('src')).toContain('/magazine/c1/c/render/page-01.jpg')
    fireEvent.click(screen.getByTestId('shelf-issue-b'))
    expect(open).toHaveBeenCalledWith('b')
  })

  it('서재 조회는 issues_public만 · 발행된 것만 · 인쇄용 칸 · 인쇄용 버킷 0(절대 규칙 3)', async () => {
    const db = installMagazineDb({ issues: [issueRow()] })
    setConnected()
    render(<MagazineTab />)
    await screen.findByTestId('library-shelf')
    const tables = db.reads.map((r) => r.table)
    expect(tables).toContain('issues_public')
    expect(tables).not.toContain('issues')
    const shelfRead = db.reads.find((r) => r.table === 'issues_public')!
    expect(shelfRead.filters).toContain('not:published_at')
    expect(shelfRead.columns).not.toMatch(/print/i)
    expect(db.rpcs).toEqual(['fn_issue_progress'])
    expect(db.signs.length).toBeGreaterThan(0)
    for (const s of db.signs) {
      expect(s.bucket).toBe('magazine')
      for (const p of s.paths) expect(p).not.toMatch(/print/i)
    }
  })

  it('조회가 끝나기 전은 뼈대, 오류는 한 번도 못 읽었을 때만 · 다시 불러오기로 서재가 나온다', async () => {
    const db = installMagazineDb({ issues: [issueRow()] })
    db.state.failIssues = true
    setConnected()
    render(<MagazineTab />)
    expect(screen.getByTestId('library-skeleton')).toBeTruthy()
    expect(await screen.findByTestId('library-error')).toBeTruthy()
    db.state.failIssues = false
    fireEvent.click(screen.getByText('다시 불러오기'))
    expect(await screen.findByTestId('library-shelf')).toBeTruthy()
    expect(screen.queryByTestId('library-error')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// B13: 매거진 빈 상태 깜빡임 0 - 로드 상태가 오가지 않는다
// ---------------------------------------------------------------------------

describe('B13 로드 상태가 오가지 않는다', () => {
  it('호가 있는 커플: 뼈대 -> 서재 한 방향. D14(빈 상태)나 오류가 사이에 끼지 않는다', async () => {
    const db = installMagazineDb({ issues: [issueRow()] })
    let release!: () => void
    db.state.gate = new Promise<void>((r) => { release = r })
    setConnected()
    const rec = recordModes()
    render(<MagazineTab />)
    await act(async () => { await Promise.resolve() })
    expect(dataLibraryMode()).toBe('loading')
    await act(async () => { release() })
    await screen.findByTestId('library-shelf')
    rec.stop()
    expect(rec.seen.filter((m) => m !== 'none')).toEqual(['loading', 'shelf'])
  })

  it('호가 0권인 커플: 뼈대 -> D14. 서재 상태가 끼지 않는다', async () => {
    const db = installMagazineDb()
    let release!: () => void
    db.state.gate = new Promise<void>((r) => { release = r })
    setConnected()
    const rec = recordModes()
    render(<MagazineTab />)
    await act(async () => { await Promise.resolve() })
    await act(async () => { release() })
    await screen.findByTestId('first-issue')
    rec.stop()
    expect(rec.seen.filter((m) => m !== 'none')).toEqual(['loading', 'first'])
  })

  it('연결 여부가 정해지기 전에는 D16도 D14도 확정하지 않고, 연결이 정해지면 뼈대 -> 서재로만 간다', async () => {
    installMagazineDb({ issues: [issueRow()] })
    useCoupleStore.setState({ status: 'unknown', coupleId: null })
    const rec = recordModes()
    render(<MagazineTab />)
    expect(screen.queryByTestId('unconnected-library')).toBeNull()
    expect(screen.queryByTestId('first-issue')).toBeNull()
    act(() => useCoupleStore.setState({ status: 'loading' }))
    expect(screen.queryByTestId('unconnected-library')).toBeNull()
    act(() => setConnected())
    await screen.findByTestId('library-shelf')
    rec.stop()
    expect(rec.seen.filter((m) => m !== 'none')).toEqual(['loading', 'shelf'])
    expect(screen.queryByTestId('unconnected-library')).toBeNull()
  })

  it('앱이 다시 보여 다시 읽는 동안에도 서재는 그대로이고, 다시 읽기가 실패해도 오류 화면으로 바뀌지 않는다', async () => {
    const db = installMagazineDb({ issues: [issueRow()] })
    setConnected()
    render(<MagazineTab />)
    await screen.findByTestId('library-shelf')
    const rec = recordModes()
    // 느린 다시 읽기
    let release!: () => void
    db.state.gate = new Promise<void>((r) => { release = r })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await Promise.resolve() })
    expect(dataLibraryMode()).toBe('shelf')
    await act(async () => { release() })
    // 실패하는 다시 읽기
    db.state.gate = null
    db.state.failIssues = true
    const before = db.reads.length
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(db.reads.length).toBeGreaterThan(before))
    await act(async () => { await Promise.resolve() })
    rec.stop()
    expect(rec.seen).toEqual(['shelf'])
    expect(screen.queryByTestId('library-error')).toBeNull()
    expect(screen.queryByTestId('library-skeleton')).toBeNull()
  })

  it('탭을 옮겼다 돌아와도(다시 그려도) 직전 서재를 먼저 보여 준다 - 뼈대를 거치지 않는다', async () => {
    installMagazineDb({ issues: [issueRow()] })
    setConnected()
    const first = render(<MagazineTab />)
    await screen.findByTestId('library-shelf')
    first.unmount()
    render(<MagazineTab />)
    const rec = recordModes()
    expect(dataLibraryMode()).toBe('shelf') // 첫 그림부터
    await act(async () => { await Promise.resolve() })
    rec.stop()
    expect(rec.seen).toEqual(['shelf'])
  })

  it('호 목록이 바뀌어도(새 호 발행) 서재가 비었다 차지 않는다', async () => {
    installMagazineDb({ issues: [issueRow()] })
    setConnected()
    render(<MagazineTab />)
    await screen.findByTestId('library-shelf')
    const rec = recordModes()
    // 가짜 표를 직접 늘리지 않고 새 클라이언트로 갈아 끼운다(발행 뒤 서버가 호를 하나 더 준다)
    const next = installMagazineDb({ issues: [issueRow(), issueRow({ id: 'i2', issue_number: 2, published_at: '2026-11-01T00:00:00Z' })] })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(screen.getByTestId('library-count').textContent).toBe('2권'))
    rec.stop()
    expect(rec.seen).toEqual(['shelf'])
    expect(next.reads.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// D10 속표지 · D11 뷰어 · PDF
// ---------------------------------------------------------------------------

const CORNERS = [
  { id: 'k2', issue_id: 'i1', status: 'published', corner_type: 'sweet_words', seq: 2, content: { header: { title: '다정한 말들', cornerName: '대화에서' } } },
  { id: 'k1', issue_id: 'i1', status: 'published', corner_type: 'date_archive', seq: 1, content: { header: { title: '함께한 하루', cornerName: '데이트 아카이브' } } },
]
const PROFILES = [{ id: 'u1', display_name: '세준' }, { id: 'u2', display_name: '서영' }]

function openViewer(opts: { issues?: ReturnType<typeof issueRow>[]; bridge?: ReturnType<typeof makeFakeBridge>; onClose?: () => void; issueId?: string } = {}) {
  const db = installMagazineDb({ issues: opts.issues ?? [issueRow()], corners: CORNERS, profiles: PROFILES })
  setConnected()
  const bridge = opts.bridge ?? makeFakeBridge()
  const onClose = opts.onClose ?? vi.fn()
  render(<IssueViewer issueId={opts.issueId ?? 'i1'} bridge={bridge} onClose={onClose} />)
  return { db, bridge, onClose }
}

const frameEl = () => screen.getByTestId('zoom-frame')
function swipe(from: number, to: number) {
  fireEvent.pointerDown(frameEl(), { pointerId: 1, clientX: from, clientY: 200 })
  fireEvent.pointerMove(frameEl(), { pointerId: 1, clientX: to, clientY: 200 })
  fireEvent.pointerUp(frameEl(), { pointerId: 1, clientX: to, clientY: 200 })
}
const tap = () => {
  fireEvent.pointerDown(frameEl(), { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerUp(frameEl(), { pointerId: 1, clientX: 100, clientY: 100 })
}
const counter = () => screen.getByTestId('page-counter').textContent

describe('D10 속표지', () => {
  it('워드마크 · 닉네임 · "N월호" · 이름 · 실린 코너(지면 제목, 지면 순서) · 표지 이미지', async () => {
    const { db } = openViewer()
    expect(screen.getByTestId('viewer-wait')).toBeTruthy() // 읽는 동안 뼈대
    await screen.findByTestId('front-matter')
    expect(screen.getByText('ONDOLOG')).toBeTruthy()
    expect(screen.getByText('늘봄')).toBeTruthy()
    expect(screen.getByText('9월호')).toBeTruthy()
    expect(screen.getByText('세준 · 서영')).toBeTruthy()
    const rows = screen.getByTestId('front-matter-corners').querySelectorAll('.fmCornerTitle')
    expect([...rows].map((r) => r.textContent)).toEqual(['함께한 하루', '다정한 말들'])
    expect(screen.getByText('데이트 아카이브')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('front-matter-cover').querySelector('img')?.getAttribute('src')).toContain('/magazine/c1/i1/render/page-01.jpg'))
    // 표지를 위해 1쪽(과 이웃)만 서명한다
    expect(db.signs[0]).toMatchObject({ bucket: 'magazine', paths: ['c1/i1/render/page-01.jpg', 'c1/i1/render/page-02.jpg'] })
    expect(db.reads.find((r) => r.table === 'corners')?.filters).toContain('eq:status')
  })

  it('고지 문구는 PM 문장(R31-9)이고 보드의 옛 문장은 없다. 종이 바탕이고 호 번호(Vol) · 목차가 없다', async () => {
    openViewer()
    await screen.findByTestId('front-matter')
    expect(screen.getByTestId('front-matter-notice').textContent).toBe(FRONT_MATTER_NOTICE)
    expect(FRONT_MATTER_NOTICE).toBe('두 사람이 남긴 말과 사진은 고치지 않고 실었어요. 온도록이 쓴 문장은 발행 노트에 따로 적었어요.')
    expect(document.body.textContent).not.toContain('편집 외의 각색')
    expect(screen.getByTestId('issue-viewer').className).toContain('paper')
    expect(document.body.textContent).not.toMatch(/VOL\./)
    expect(screen.queryByText('목차')).toBeNull()
  })

  it('✕는 덮개를 닫고, 하드웨어 뒤로 가기도 이것만 닫는다', async () => {
    const goBack = vi.fn()
    const exitApp = vi.fn()
    const { onClose } = openViewer()
    await screen.findByTestId('front-matter')
    handleHardwareBack({ canGoBack: () => true, goBack, exitApp })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(goBack).not.toHaveBeenCalled()
    expect(exitApp).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('front-matter-close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('호를 열면 기기에만 "열어 봤다"고 남기고(메인 B06용, 사용자 · 호 단위) 메인에 알린다', async () => {
    const version = useIssueOpenedSignal.getState().version
    openViewer()
    await screen.findByTestId('front-matter')
    await waitFor(() => expect(Preferences.set).toHaveBeenCalledWith({ key: issueOpenedKey('u1', 'i1'), value: '1' }))
    expect(issueOpenedKey('u1', 'i1')).toBe('ondolog.issueOpened.u1.i1')
    await waitFor(() => expect(useIssueOpenedSignal.getState().version).toBe(version + 1))
  })

  it('호를 못 읽었으면(없는 호) 알리고 닫을 길이 있다 · 열어 봤다고 남기지 않는다', async () => {
    const { onClose } = openViewer({ issueId: 'nope' })
    expect(await screen.findByText('호를 열지 못했어요')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('닫기'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(Preferences.set).not.toHaveBeenCalled()
  })

  it('목차(D12)는 숨긴다: 매니페스트가 없어 null이고 진입 버튼도 없다', async () => {
    expect(await loadIssueManifest({ id: 'i1', coupleId: 'c1' })).toBeNull()
    expect(tocAvailable(null)).toBe(false)
    openViewer()
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    expect(screen.queryByText('목차')).toBeNull()
  })
})

describe('D11 뷰어: 넘기기 · 확대', () => {
  it('[읽기] -> 뷰어(1 / 19, 밤 바탕), 뷰어의 ← -> 속표지', async () => {
    openViewer()
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    expect(screen.getByTestId('page-viewer')).toBeTruthy()
    expect(screen.queryByTestId('front-matter')).toBeNull()
    expect(screen.getByTestId('issue-viewer').className).toContain('night')
    expect(screen.getByText('9월호')).toBeTruthy()
    expect(counter()).toBe('1 / 19')
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(screen.getByTestId('front-matter')).toBeTruthy()
  })

  it('옆으로 밀면 앞뒤 쪽(왼쪽으로 밀면 다음) · 처음과 끝에서는 더 가지 않는다 · 이웃 쪽 서명 주소를 받는다', async () => {
    const { db } = openViewer({ issues: [issueRow({ page_count: 3 })] })
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    await waitFor(() => expect(screen.getByTestId('zoom-img').getAttribute('src')).toContain('page-01.jpg'))
    swipe(100, 300) // 첫 쪽에서 앞으로
    expect(counter()).toBe('1 / 3')
    swipe(300, 100)
    expect(counter()).toBe('2 / 3')
    await waitFor(() => expect(screen.getByTestId('zoom-img').getAttribute('src')).toContain('page-02.jpg'))
    swipe(300, 100)
    expect(counter()).toBe('3 / 3')
    swipe(300, 100) // 끝에서 더 가지 않는다
    expect(counter()).toBe('3 / 3')
    swipe(100, 300)
    expect(counter()).toBe('2 / 3')
    // 쪽 경로는 55-1 규칙, magazine 버킷만
    expect(db.signs.every((s) => s.bucket === 'magazine')).toBe(true)
    expect(db.signs.flatMap((s) => s.paths)).toContain('c1/i1/render/page-03.jpg')
  })

  it('문턱 아래로 스치면 넘어가지 않고, 확대 중에는 옆으로 밀어도 넘어가지 않으며, 쪽이 바뀌면 배율은 처음으로 돌아온다', async () => {
    openViewer({ issues: [issueRow({ page_count: 3 })] })
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    await waitFor(() => expect(screen.getByTestId('zoom-img')).toBeTruthy())
    swipe(200, 170)
    expect(counter()).toBe('1 / 3')
    tap(); tap()
    expect(screen.getByTestId('zoom-img').getAttribute('data-scale')).toBe('2.5')
    swipe(300, 100)
    expect(counter()).toBe('1 / 3')
    tap(); tap()
    expect(screen.getByTestId('zoom-img').getAttribute('data-scale')).toBe('1')
    swipe(300, 100)
    expect(counter()).toBe('2 / 3')
    await waitFor(() => expect(screen.getByTestId('zoom-img').getAttribute('data-scale')).toBe('1'))
  })

  it('방향키로도 넘긴다', async () => {
    openViewer({ issues: [issueRow({ page_count: 3 })] })
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(counter()).toBe('2 / 3')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(counter()).toBe('1 / 3')
  })

  it('보던 쪽은 호별로 기억해(메모리) 속표지로 갔다 [읽기]를 다시 눌러도 그 쪽에서 시작한다 · 그 쪽 가까이를 서명한다', async () => {
    useViewerStore.getState().setLastPage('i1', 8)
    const { db } = openViewer()
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    expect(counter()).toBe('8 / 19')
    await waitFor(() => expect(db.signs.flatMap((s) => s.paths)).toContain('c1/i1/render/page-09.jpg'))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(useViewerStore.getState().lastPageOf('i1', 19)).toBe(9)
    fireEvent.click(screen.getByLabelText('뒤로'))
    fireEvent.click(screen.getByTestId('front-matter-read'))
    expect(counter()).toBe('9 / 19')
  })

  it('보던 쪽은 저장소(AsyncStorage · localStorage)에 쓰지 않는다 - 메모리뿐', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    openViewer()
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('쪽 이미지가 안 열리면 그 쪽의 서명 주소를 버리고 한 번만 다시 받는다', async () => {
    const { db } = openViewer({ issues: [issueRow({ page_count: 3 })] })
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    await waitFor(() => expect(screen.getByTestId('zoom-img')).toBeTruthy())
    const asked = () => db.signs.filter((s) => s.paths.includes('c1/i1/render/page-01.jpg')).length
    const before = asked()
    fireEvent.error(screen.getByTestId('zoom-img'))
    await waitFor(() => expect(asked()).toBe(before + 1))
    fireEvent.error(screen.getByTestId('zoom-img'))
    await act(async () => { await Promise.resolve() })
    expect(asked()).toBe(before + 1)
  })

  it('주소가 아직 없는 쪽은 뼈대 면이다(번쩍이는 빈 화면 0)', () => {
    render(<PageReader title="9월호" pageCount={3} initialPage={2} pageUrls={{}} onBack={() => {}} onPageChange={() => {}} onImageError={() => {}} />)
    expect(screen.getByTestId('reader-wait')).toBeTruthy()
    expect(screen.queryByTestId('zoom-img')).toBeNull()
    expect(counter()).toBe('2 / 3')
  })

  it('시작 쪽은 범위 안으로 가둔다', () => {
    render(<PageReader title="9월호" pageCount={3} initialPage={99} pageUrls={{}} onBack={() => {}} onPageChange={() => {}} onImageError={() => {}} />)
    expect(counter()).toBe('3 / 3')
  })
})

describe('PDF 열기', () => {
  it('디지털 PDF의 새 서명 주소(10분)를 받아 다리(시스템 브라우저)에 넘긴다 · 인쇄용 경로 · 버킷은 어디에도 없다', async () => {
    const { db, bridge } = openViewer()
    await screen.findByTestId('front-matter')
    await act(async () => { fireEvent.click(screen.getByTestId('front-matter-pdf')) })
    const pdfSign = db.signs.find((s) => s.paths.includes('c1/i1/render/issue.pdf'))!
    expect(pdfSign).toMatchObject({ bucket: 'magazine', paths: ['c1/i1/render/issue.pdf'], ttl: 600 })
    await waitFor(() => expect(bridge.openBrowser).toHaveBeenCalledWith('https://signed.invalid/magazine/c1/i1/render/issue.pdf'))
    expect(screen.queryByTestId('front-matter-pdf-error')).toBeNull()
    for (const s of db.signs) {
      expect(s.bucket).not.toMatch(/print/i)
      for (const p of s.paths) expect(p).not.toMatch(/print/i)
    }
  })

  it('PDF 경로가 없으면 누를 수 없다', async () => {
    openViewer({ issues: [issueRow({ pdf_digital_path: null })] })
    await screen.findByTestId('front-matter')
    expect((screen.getByTestId('front-matter-pdf') as HTMLButtonElement).disabled).toBe(true)
  })

  it('서명 주소를 못 받으면 열지 않고 알린다', async () => {
    const { db, bridge } = openViewer()
    await screen.findByTestId('front-matter')
    db.state.signEmpty = true
    await act(async () => { fireEvent.click(screen.getByTestId('front-matter-pdf')) })
    expect(bridge.openBrowser).not.toHaveBeenCalled()
    expect(screen.getByTestId('front-matter-pdf-error')).toBeTruthy()
  })

  it('시스템이 열기를 거부해도 앱은 멈추지 않고 알린다 · 다시 누를 수 있다', async () => {
    const bridge = makeFakeBridge({ openBrowser: vi.fn(async () => { throw new Error('no handler') }) })
    openViewer({ bridge })
    await screen.findByTestId('front-matter')
    await act(async () => { fireEvent.click(screen.getByTestId('front-matter-pdf')) })
    expect(screen.getByTestId('front-matter-pdf-error')).toBeTruthy()
    expect((screen.getByTestId('front-matter-pdf') as HTMLButtonElement).disabled).toBe(false)
  })

  it('속표지 부품 단독: 닫기 · 읽기 · PDF가 각자 부르고, 닉네임이 없으면 그리지 않는다', () => {
    const onClose = vi.fn(); const onRead = vi.fn(); const onPdf = vi.fn()
    render(
      <FrontMatter
        issue={{ issueType: 'monthly', periodStart: '2026-09-01', title: null, pdfDigitalPath: 'x.pdf' }}
        coverUrl={undefined} nickname={null} names="" corners={[]}
        onClose={onClose} onRead={onRead} onPdf={onPdf} pdfBusy={false} pdfFailed={false}
      />,
    )
    fireEvent.click(screen.getByTestId('front-matter-close'))
    fireEvent.click(screen.getByTestId('front-matter-read'))
    fireEvent.click(screen.getByTestId('front-matter-pdf'))
    expect([onClose, onRead, onPdf].map((f) => f.mock.calls.length)).toEqual([1, 1, 1])
    expect(document.querySelector('.fmNickname')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 뷰어 입구 · 덮개 · 뒤로 가기
// ---------------------------------------------------------------------------

function NavProbe() {
  const navigate = useNavigate()
  return <button type="button" data-testid="go-chat" onClick={() => navigate('/chat')}>go</button>
}

describe('뷰어 입구(viewerEntry)와 덮개', () => {
  function host() {
    installMagazineDb({ issues: [issueRow()], corners: CORNERS, profiles: PROFILES })
    setConnected()
    const bridge = makeFakeBridge()
    render(<MemoryRouter initialEntries={['/main']}><NavProbe /><ViewerHost bridge={bridge} /></MemoryRouter>)
    return bridge
  }

  it('메인 · 서재가 부르는 입구가 덮개를 연다. 아무 일도 없는 버튼(곧 열려요 토스트)이 아니다', async () => {
    host()
    expect(screen.queryByTestId('issue-viewer')).toBeNull()
    act(() => openIssueViewer('i1'))
    expect(await screen.findByTestId('front-matter')).toBeTruthy()
    expect(useViewerOpenStore.getState().issueId).toBe('i1')
  })

  it('하드웨어 뒤로 가기는 덮개만 닫는다(앞 화면으로 새지 않는다)', async () => {
    host()
    act(() => openIssueViewer('i1'))
    await screen.findByTestId('front-matter')
    const goBack = vi.fn(); const exitApp = vi.fn()
    act(() => handleHardwareBack({ canGoBack: () => true, goBack, exitApp }))
    expect(screen.queryByTestId('issue-viewer')).toBeNull()
    expect(goBack).not.toHaveBeenCalled()
    expect(exitApp).not.toHaveBeenCalled()
    // 뷰어 쪽에서도 같다
    act(() => openIssueViewer('i1'))
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    act(() => handleHardwareBack({ canGoBack: () => true, goBack, exitApp }))
    expect(screen.queryByTestId('issue-viewer')).toBeNull()
    expect(goBack).not.toHaveBeenCalled()
    // 닫힌 뒤에는 평소 뒤로 가기가 돌아온다
    handleHardwareBack({ canGoBack: () => true, goBack, exitApp })
    expect(goBack).toHaveBeenCalledTimes(1)
  })

  it('경로가 바뀌면 덮개도 닫힌다(다른 화면으로 따라오지 않는다) · 다시 열면 속표지부터', async () => {
    host()
    act(() => openIssueViewer('i1'))
    await screen.findByTestId('front-matter')
    fireEvent.click(screen.getByTestId('front-matter-read'))
    fireEvent.click(screen.getByTestId('go-chat'))
    expect(screen.queryByTestId('issue-viewer')).toBeNull()
    act(() => openIssueViewer('i1'))
    expect(await screen.findByTestId('front-matter')).toBeTruthy()
  })

  it('덮개는 탭 바 위(.phone 안)에 붙는다 - 틀이 없으면 body', async () => {
    host()
    act(() => openIssueViewer('i1'))
    await screen.findByTestId('front-matter')
    expect(screen.getByTestId('issue-viewer').parentElement).toBe(document.body)
  })
})
