/**
 * U3 매거진 탭 화면 시험 - `<CoupleGate>` 분기(D16) · 발행된 호 0권(D14) · 서재(D01)와 뷰어로 가는 길.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import MagazineTab from '../../app/(tabs)/magazine'
import { UNCONNECTED_COPY } from '../../src/constants/magazineCopy'
import { useCoupleStore } from '../../src/store/coupleStore'
import type { LibraryState } from '../../src/hooks/useLibrary'
import type { PublishedIssue } from '../../src/services/magazineApi'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('../../src/services/supabase', () => ({ supabase: {} }))
jest.mock('../../src/hooks/useSession', () => ({ useSession: () => ({ session: null }) }))

let mockLibrary: LibraryState
jest.mock('../../src/hooks/useLibrary', () => ({ useLibrary: () => mockLibrary }))

const issue: PublishedIssue = {
  id: 'i1',
  coupleId: 'c1',
  issueType: 'monthly',
  issueNumber: 1,
  title: null,
  coverPath: 'c1/i1/render/page-01.jpg',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  pdfDigitalPath: 'c1/i1/render/issue.pdf',
  pageCount: 19,
  publishedAt: '2026-10-01T00:00:00Z',
  theme: 'basic',
}

function state(over: Partial<LibraryState> = {}): LibraryState {
  return { loading: false, error: false, issues: [], coverUrls: {}, next: null, reload: async () => {}, ...over }
}

beforeEach(() => {
  mockPush.mockClear()
  mockLibrary = state()
  useCoupleStore.setState({ status: 'unknown', coupleId: null })
})

describe('매거진 탭', () => {
  it('미연결: 탭은 열리고 D16 "잠긴 문"이 보인다. 초대 버튼은 커플 게이트로 간다', async () => {
    useCoupleStore.setState({ status: 'disconnected', coupleId: null })
    await render(<MagazineTab />)
    expect(screen.getByText('매거진')).toBeTruthy()
    expect(screen.getByText(UNCONNECTED_COPY.title)).toBeTruthy()
    expect(screen.queryByTestId('library-count')).toBeNull()
    await fireEvent.press(screen.getByTestId('unconnected-invite'))
    expect(mockPush).toHaveBeenCalledWith('/couple-gate')
  })

  it('연결 여부가 정해지기 전에는 서재도 D16도 확정하지 않는다', async () => {
    await render(<MagazineTab />)
    expect(screen.queryByTestId('unconnected-library')).toBeNull()
    expect(screen.queryByTestId('first-issue')).toBeNull()
  })

  it('연결 + 발행된 호 0권: D14 첫 호 시작', async () => {
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1' })
    await render(<MagazineTab />)
    expect(screen.getByTestId('first-issue')).toBeTruthy()
    expect(screen.getByText('0%')).toBeTruthy()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('연결 + 발행된 호: 서재와 다음 호 카드, 표지를 누르면 뷰어 시트로 간다', async () => {
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1' })
    mockLibrary = state({ issues: [issue], next: { monthLabel: '10월호', percent: 41, counts: { messages: 412, photos: 18, dates: 3 } } })
    await render(<MagazineTab />)
    expect(screen.getByTestId('next-issue-card')).toBeTruthy()
    expect(screen.getByText('VOL.01')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('shelf-issue-i1'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/magazine-viewer', params: { issueId: 'i1' } })
  })

  it('연결 + 로딩: 뼈대', async () => {
    useCoupleStore.setState({ status: 'connected', coupleId: 'c1' })
    mockLibrary = state({ loading: true })
    await render(<MagazineTab />)
    expect(screen.getByTestId('library-skeleton')).toBeTruthy()
  })
})
