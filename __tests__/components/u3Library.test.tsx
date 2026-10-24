/**
 * U3 서재·속표지·뷰어(`58-`) 화면 부품 시험 - 렌더 계약.
 * 서재(D01) · 다음 호 카드 · D14/D16 분기 · 속표지(D10) 문구 · 뷰어 쪽 목록.
 */
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { FIRST_ISSUE_COPY, FRONT_MATTER_NOTICE, UNCONNECTED_COPY } from '../../src/constants/magazineCopy'
import { FirstIssue, ShelfHint, Unconnected } from '../../src/components/magazine/EmptyShelves'
import { FrontMatter } from '../../src/components/magazine/FrontMatter'
import { LibraryContent } from '../../src/components/magazine/LibraryContent'
import { LibraryShelf, shelfLabels } from '../../src/components/magazine/LibraryShelf'
import { NextIssueCard, materialLines } from '../../src/components/magazine/NextIssueCard'
import { PageViewer, pageFromOffset } from '../../src/components/magazine/PageViewer'
import type { PublishedIssue } from '../../src/services/magazineApi'
import { nocturne } from '../../src/theme/nocturne'

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

const issue = (over: Partial<PublishedIssue> = {}): PublishedIssue => ({
  id: 'i1',
  coupleId: 'c1',
  issueType: 'monthly',
  issueNumber: 2,
  title: null,
  coverPath: 'c1/i1/render/page-01.jpg',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  pdfDigitalPath: 'c1/i1/render/issue.pdf',
  pageCount: 19,
  publishedAt: '2026-10-01T00:00:00Z',
  theme: 'basic',
  ...over,
})

describe('D01 서재', () => {
  it('표지 밖 라벨 "VOL.NN" + "N월호"가 있고, 번호는 issue_number다', async () => {
    await render(<LibraryShelf issues={[issue({ issueNumber: 2 }), issue({ id: 'i0', issueNumber: 1, periodStart: '2026-08-01' })]} coverUrls={{}} onOpen={() => {}} />)
    expect(screen.getByText('VOL.02')).toBeTruthy()
    expect(screen.getByText('9월호')).toBeTruthy()
    expect(screen.getByText('VOL.01')).toBeTruthy()
    expect(screen.getByText('8월호')).toBeTruthy()
    expect(screen.getByTestId('library-count').props.children).toBe('2권')
  })

  it('표지 그림 위에는 아무것도 얹지 않는다 - 표지 안에는 이미지뿐이고 글자가 없다', async () => {
    await render(
      <LibraryShelf issues={[issue()]} coverUrls={{ 'c1/i1/render/page-01.jpg': 'https://signed.invalid/x' }} onOpen={() => {}} />,
    )
    const cover = screen.getByTestId('shelf-cover')
    expect(within(cover).queryByText(/.+/)).toBeNull()
    expect(within(cover).queryByText(/VOL/)).toBeNull()
  })

  it('Vol 라벨만 moon 색을 쓴다', async () => {
    const { toJSON } = await render(<LibraryShelf issues={[issue()]} coverUrls={{}} onOpen={() => {}} />)
    const json = JSON.stringify(toJSON())
    expect(json).toContain(nocturne.moon)
    expect(json.split(nocturne.moon).length - 1).toBe(1)
  })

  it('표지를 누르면 그 호를 연다', async () => {
    const onOpen = jest.fn()
    await render(<LibraryShelf issues={[issue()]} coverUrls={{}} onOpen={onOpen} />)
    await fireEvent.press(screen.getByTestId('shelf-issue-i1'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }))
  })

  it('라벨 값', () => {
    expect(shelfLabels(issue({ issueNumber: 12 }))).toEqual({ vol: 'VOL.12', month: '9월호' })
  })
})

describe('D01 다음 호 카드', () => {
  it('진행률은 정지 값이고 재료 수 두 줄이 나온다. 제작 현황 링크는 없다', async () => {
    await render(
      <NextIssueCard data={{ monthLabel: '10월호', percent: 41, counts: { messages: 412, photos: 18, dates: 3 } }} />,
    )
    expect(screen.getByText('41%')).toBeTruthy()
    expect(screen.getByText('대화 412 · 사진 18')).toBeTruthy()
    expect(screen.getByText('데이트 3')).toBeTruthy()
    expect(screen.getByText('NEXT ISSUE')).toBeTruthy()
    expect(screen.getByText('10월호')).toBeTruthy()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
    expect(screen.queryByText(/VOL/)).toBeNull()
  })

  it('수를 못 셌으면 수 줄을 그리지 않는다', async () => {
    await render(<NextIssueCard data={{ monthLabel: '10월호', percent: 0, counts: null }} />)
    expect(screen.queryByTestId('next-issue-counts')).toBeNull()
    expect(materialLines(null)).toBeNull()
  })
})

describe('D14 · D16', () => {
  it('D14: 첫 호 문구 + 0%, 제작 현황 링크 없음', async () => {
    await render(
      <>
        <FirstIssue percent={0} />
        <ShelfHint />
      </>,
    )
    expect(screen.getByText(FIRST_ISSUE_COPY.title)).toBeTruthy()
    expect(screen.getByText(FIRST_ISSUE_COPY.kicker)).toBeTruthy()
    expect(screen.getByText('0%')).toBeTruthy()
    expect(screen.getByText(FIRST_ISSUE_COPY.shelfHint)).toBeTruthy()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('D16: 잠긴 자리와 "연인 초대하기"가 초대로 이어진다', async () => {
    const onInvite = jest.fn()
    await render(<Unconnected onInvite={onInvite} />)
    expect(screen.getByText(UNCONNECTED_COPY.title)).toBeTruthy()
    expect(screen.getByText(UNCONNECTED_COPY.body)).toBeTruthy()
    await fireEvent.press(screen.getByTestId('unconnected-invite'))
    expect(onInvite).toHaveBeenCalledTimes(1)
  })

  it('서재 본문: 발행된 호 0권이면 D14(초안 진행률 반영), 1권 이상이면 서재 + 다음 호 카드', async () => {
    const { rerender } = await render(
      <LibraryContent
        mode="first"
        library={{ issues: [], coverUrls: {}, next: { monthLabel: '10월호', percent: 74, counts: null } }}
        onOpen={() => {}}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByTestId('first-issue')).toBeTruthy()
    expect(screen.getByText('74%')).toBeTruthy()

    await rerender(
      <LibraryContent
        mode="shelf"
        library={{ issues: [issue()], coverUrls: {}, next: { monthLabel: '10월호', percent: 41, counts: null } }}
        onOpen={() => {}}
        onRetry={() => {}}
      />,
    )
    expect(screen.queryByTestId('first-issue')).toBeNull()
    expect(screen.getByTestId('next-issue-card')).toBeTruthy()
    expect(screen.getByText('VOL.02')).toBeTruthy()
  })

  it('서재에 호는 있는데 초안이 없으면(빈 결과) 다음 호 카드를 그리지 않는다', async () => {
    await render(
      <LibraryContent mode="shelf" library={{ issues: [issue()], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={() => {}} />,
    )
    expect(screen.queryByTestId('next-issue-card')).toBeNull()
    expect(screen.getByText('VOL.02')).toBeTruthy()
  })

  it('오류에서 다시 불러오기, 로딩은 뼈대(스피너 없음)', async () => {
    const onRetry = jest.fn()
    const { rerender } = await render(
      <LibraryContent mode="error" library={{ issues: [], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={onRetry} />,
    )
    await fireEvent.press(screen.getByText('다시 불러오기'))
    expect(onRetry).toHaveBeenCalled()
    await rerender(<LibraryContent mode="loading" library={{ issues: [], coverUrls: {}, next: null }} onOpen={() => {}} onRetry={onRetry} />)
    expect(screen.getByTestId('library-skeleton')).toBeTruthy()
  })
})

describe('D10 속표지', () => {
  const props = {
    issue: issue(),
    coverUri: 'https://signed.invalid/cover',
    nickname: '늘봄',
    names: '세준 · 서영',
    corners: [
      { id: 'k1', pageTitle: '함께한 하루', cornerName: '데이트 아카이브' },
      { id: 'k2', pageTitle: '다정한 말들', cornerName: '다정한 말들' },
    ],
    onClose: () => {},
    onRead: () => {},
    onPdf: () => {},
    pdfBusy: false,
    pdfFailed: false,
  }

  it('워드마크 · 닉네임 · "N월호" · 이름 · 실린 코너(지면 제목)', async () => {
    await render(<FrontMatter {...props} />)
    expect(screen.getByText('ONDOLOG')).toBeTruthy()
    expect(screen.getByText('늘봄')).toBeTruthy()
    expect(screen.getByText('9월호')).toBeTruthy()
    expect(screen.getByText('세준 · 서영')).toBeTruthy()
    expect(screen.getByText('함께한 하루')).toBeTruthy()
    expect(screen.getByText('데이트 아카이브')).toBeTruthy()
    expect(screen.getAllByText('다정한 말들')).toHaveLength(2)
  })

  it('고지 문구는 PM 문장이고 디자인 보드 문장은 없다', async () => {
    await render(<FrontMatter {...props} />)
    expect(FRONT_MATTER_NOTICE).toBe(
      '두 사람이 남긴 말과 사진은 고치지 않고 실었어요. 온도록이 쓴 문장은 발행 노트에 따로 적었어요.',
    )
    expect(screen.getByTestId('front-matter-notice').props.children).toBe(FRONT_MATTER_NOTICE)
    expect(screen.queryByText(/편집 외의 각색/)).toBeNull()
    expect(screen.queryByText(/각색은 하지 않았습니다/)).toBeNull()
  })

  it('종이 바탕이고 호 번호(Vol)·moon이 없다', async () => {
    const { toJSON } = await render(<FrontMatter {...props} />)
    const json = JSON.stringify(toJSON())
    expect(json).toContain(nocturne.paper)
    expect(json).not.toContain(nocturne.moon)
    expect(screen.queryByText(/VOL/)).toBeNull()
  })

  it('읽기 · 닫기 · PDF 내려받기', async () => {
    const onRead = jest.fn()
    const onClose = jest.fn()
    const onPdf = jest.fn()
    await render(<FrontMatter {...props} onRead={onRead} onClose={onClose} onPdf={onPdf} />)
    await fireEvent.press(screen.getByTestId('front-matter-read'))
    await fireEvent.press(screen.getByTestId('front-matter-close'))
    await fireEvent.press(screen.getByTestId('front-matter-pdf'))
    expect(onRead).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPdf).toHaveBeenCalledTimes(1)
  })

  it('PDF 경로가 없으면 누를 수 없다. 열기에 실패하면 알린다', async () => {
    const onPdf = jest.fn()
    await render(<FrontMatter {...props} issue={issue({ pdfDigitalPath: null })} onPdf={onPdf} pdfFailed />)
    await fireEvent.press(screen.getByTestId('front-matter-pdf'))
    expect(onPdf).not.toHaveBeenCalled()
    expect(screen.getByTestId('front-matter-pdf-error')).toBeTruthy()
  })
})

describe('D11 뷰어', () => {
  it('목차 버튼이 없다(D12 숨김)', async () => {
    await render(
      <PageViewer title="9월호" pageCount={19} initialPage={8} pageUrls={{}} onBack={() => {}} onPageChange={() => {}} onImageError={() => {}} />,
    )
    expect(screen.queryByText('목차')).toBeNull()
    expect(screen.getByText('9월호')).toBeTruthy()
    expect(screen.getByTestId('page-counter').props.children).toBe('8 / 19')
  })

  it('칸이 잰 뒤에는 보던 쪽 이미지를 그린다(서명 URL이 있으면 이미지, 없으면 빈 면)', async () => {
    await render(
      <PageViewer
        title="9월호"
        pageCount={19}
        initialPage={8}
        pageUrls={{ 8: 'https://signed.invalid/p8' }}
        onBack={() => {}}
        onPageChange={() => {}}
        onImageError={() => {}}
      />,
    )
    await fireEvent(screen.getByTestId('page-pager'), 'layout', { nativeEvent: { layout: { width: 390, height: 600 } } })
    expect(screen.getAllByTestId('zoomable-page').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('page-image')[0].props.source).toEqual({ uri: 'https://signed.invalid/p8' })
  })

  it('스크롤 위치에서 쪽 번호를 구한다(범위 안)', () => {
    expect(pageFromOffset(0, 390, 19)).toBe(1)
    expect(pageFromOffset(390 * 7, 390, 19)).toBe(8)
    expect(pageFromOffset(390 * 99, 390, 19)).toBe(19)
    expect(pageFromOffset(-50, 390, 19)).toBe(1)
    expect(pageFromOffset(100, 0, 19)).toBe(1)
  })
})
