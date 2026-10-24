/**
 * U3 뷰어 시트 시험 - 속표지 -> 읽기 -> 뒤로, 보던 쪽 기억, PDF 내려받기(서명 URL을 시스템에 넘긴다).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Linking } from 'react-native'
import MagazineViewerModal from '../../app/(modals)/magazine-viewer'
import type { IssueViewerState } from '../../src/hooks/useIssueViewer'
import type { PublishedIssue } from '../../src/services/magazineApi'
import { useViewerStore } from '../../src/store/viewerStore'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native')
  const chain = () => {
    const g: Record<string, unknown> = {}
    const self = new Proxy(g, { get: () => () => self })
    return self
  }
  return {
    Gesture: { Pinch: chain, Pan: chain, Tap: chain, Race: chain, Simultaneous: chain },
    GestureDetector: ({ children }: { children: unknown }) => children,
    GestureHandlerRootView: View,
  }
})
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ issueId: 'i1' }),
}))
jest.mock('../../src/services/supabase', () => ({ supabase: {} }))
jest.mock('../../src/hooks/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))

let mockViewer: IssueViewerState
jest.mock('../../src/hooks/useIssueViewer', () => ({ useIssueViewer: () => mockViewer }))

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

function viewerState(over: Partial<IssueViewerState> = {}): IssueViewerState {
  return {
    loading: false,
    error: false,
    issue,
    corners: [{ id: 'k1', pageTitle: '함께한 하루', cornerName: '데이트 아카이브' }],
    names: '세준 · 서영',
    pageUrls: {},
    ensurePages: jest.fn(async () => {}),
    reportImageError: jest.fn(async () => {}),
    signPdf: jest.fn(async () => 'https://signed.invalid/issue.pdf'),
    ...over,
  }
}

beforeEach(() => {
  mockBack.mockClear()
  mockViewer = viewerState()
  useViewerStore.getState().reset()
})

describe('뷰어 시트', () => {
  it('처음은 속표지다. ✕는 시트를 닫는다', async () => {
    await render(<MagazineViewerModal />)
    expect(screen.getByTestId('front-matter')).toBeTruthy()
    expect(screen.getByText('함께한 하루')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('front-matter-close'))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('표지 이미지를 위해 1쪽 서명 URL을 먼저 요청한다', async () => {
    await render(<MagazineViewerModal />)
    expect(mockViewer.ensurePages).toHaveBeenCalledWith(1)
  })

  it('[읽기] -> 뷰어, 뷰어의 <- -> 속표지. 뷰어에는 목차 버튼이 없다', async () => {
    await render(<MagazineViewerModal />)
    await fireEvent.press(screen.getByTestId('front-matter-read'))
    expect(screen.getByTestId('page-viewer')).toBeTruthy()
    expect(screen.queryByTestId('front-matter')).toBeNull()
    expect(screen.queryByText('목차')).toBeNull()
    expect(screen.getByTestId('page-counter').props.children).toBe('1 / 19')
    await fireEvent.press(screen.getByLabelText('뒤로'))
    expect(screen.getByTestId('front-matter')).toBeTruthy()
  })

  it('보던 쪽은 호별로 기억해 다시 읽기를 누르면 그 쪽에서 시작한다(메모리)', async () => {
    useViewerStore.getState().setLastPage('i1', 8)
    await render(<MagazineViewerModal />)
    await fireEvent.press(screen.getByTestId('front-matter-read'))
    expect(screen.getByTestId('page-counter').props.children).toBe('8 / 19')
    expect(mockViewer.ensurePages).toHaveBeenCalledWith(8)
  })

  it('PDF 내려받기: 새 서명 URL을 받아 시스템에 넘긴다', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    await render(<MagazineViewerModal />)
    await act(async () => {
      fireEvent.press(screen.getByTestId('front-matter-pdf'))
    })
    expect(mockViewer.signPdf).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('https://signed.invalid/issue.pdf')
    expect(screen.queryByTestId('front-matter-pdf-error')).toBeNull()
    open.mockRestore()
  })

  it('PDF URL을 못 받으면 열지 않고 알린다', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    mockViewer = viewerState({ signPdf: jest.fn(async () => null) })
    await render(<MagazineViewerModal />)
    await act(async () => {
      fireEvent.press(screen.getByTestId('front-matter-pdf'))
    })
    expect(open).not.toHaveBeenCalled()
    expect(screen.getByTestId('front-matter-pdf-error')).toBeTruthy()
    open.mockRestore()
  })

  it('시스템이 열기를 거부해도 앱은 멈추지 않고 알린다', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'))
    await render(<MagazineViewerModal />)
    await act(async () => {
      fireEvent.press(screen.getByTestId('front-matter-pdf'))
    })
    expect(screen.getByTestId('front-matter-pdf-error')).toBeTruthy()
    open.mockRestore()
  })

  it('호를 못 읽었으면 닫을 길이 있다', async () => {
    mockViewer = viewerState({ loading: false, error: true, issue: null })
    await render(<MagazineViewerModal />)
    expect(screen.getByText('호를 열지 못했어요')).toBeTruthy()
    await fireEvent.press(screen.getByLabelText('닫기'))
    expect(mockBack).toHaveBeenCalled()
  })
})
