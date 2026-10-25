/**
 * U1 메인 탭 화면 시험 - 상태별 화면(B01·B03·B04·B05·B06), 36.5 고정(발광 없음), 저장된 온도 분기(지금은 값이 없어 분기만),
 * 빼기로 한 것(끌어내리기 힌트·"이번 주" 인용·제작 현황 링크·일 단위 증감)이 없는가.
 * 시간은 KST 2026-10-21 12:00 으로 고정한다.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import MainTab from '../../app/(tabs)/main'
import type { LibraryState } from '../../src/hooks/useLibrary'
import type { LoveTypeSummary, MainFacts } from '../../src/hooks/useMainData'
import type { PublishedIssue } from '../../src/services/magazineApi'
import { useCoupleStore } from '../../src/store/coupleStore'
import { nocturne } from '../../src/theme/nocturne'

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
jest.mock('../../src/hooks/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))

let mockLibrary: LibraryState
jest.mock('../../src/hooks/useLibrary', () => ({ useLibrary: () => mockLibrary }))

let mockFacts: MainFacts
let mockSummary: LoveTypeSummary | null
jest.mock('../../src/hooks/useMainData', () => ({
  useDisplayNames: () => ({ selfName: '세준', partnerName: '서영' }),
  useLoveTypeSummary: () => mockSummary,
  useMainFacts: () => mockFacts,
}))

const NOW = new Date('2026-10-21T03:00:00Z') // KST 2026-10-21 12:00
const TODAY_KST = '2026-10-21'
const START_FOR_D1 = TODAY_KST
const START_FOR_D298 = '2025-12-28'
const START_FOR_D300 = '2025-12-26'

function issue(over: Partial<PublishedIssue> = {}): PublishedIssue {
  return {
    id: 'i3',
    coupleId: 'c1',
    issueType: 'monthly',
    issueNumber: 3,
    title: null,
    coverPath: 'c1/i3/render/page-01.jpg',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    pdfDigitalPath: null,
    pageCount: 19,
    publishedAt: '2026-10-18T00:00:00Z',
    theme: 'basic',
    ...over,
  }
}

function library(over: Partial<LibraryState> = {}): LibraryState {
  return { loading: false, error: false, issues: [], coverUrls: {}, next: null, reload: async () => {}, ...over }
}

function facts(over: Partial<MainFacts> = {}): MainFacts {
  return { hasActivity: true, profilesComplete: true, openedIssueIds: new Set(), ...over }
}

function connect(over: { temperature?: number | null; startDate?: string | null } = {}) {
  useCoupleStore.setState({
    status: 'connected',
    coupleId: 'c1',
    partnerId: 'u2',
    nickname: '늘봄',
    temperature: over.temperature === undefined ? null : over.temperature,
    relationshipStartDate: over.startDate === undefined ? START_FOR_D298 : over.startDate,
    refresh: async () => {},
  })
}

function flatStyle(node: { props: { style?: unknown } }) {
  return StyleSheet.flatten(node.props.style as never) as Record<string, unknown>
}

beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'performance',
    ],
  })
})

afterAll(() => {
  jest.useRealTimers()
})

beforeEach(() => {
  mockPush.mockClear()
  mockLibrary = library()
  mockFacts = facts()
  mockSummary = null
  useCoupleStore.setState({
    status: 'unknown',
    coupleId: null,
    partnerId: null,
    nickname: null,
    temperature: 36.5,
    relationshipStartDate: null,
    refresh: async () => {},
  })
})

describe('연결 여부가 정해지기 전', () => {
  it('미연결도 연결도 확정하지 않고 뼈대만 보인다', async () => {
    await render(<MainTab />)
    expect(screen.getByTestId('main-wait')).toBeTruthy()
    expect(screen.queryByTestId('main-state-B05')).toBeNull()
  })
})

describe('B05 미연결', () => {
  beforeEach(() => {
    useCoupleStore.setState({ status: 'disconnected', temperature: 36.5, refresh: async () => {} })
    mockSummary = { mbti: 'ISTJ', enneagramCore: 1, loveTypeCode: 'KLE' }
  })

  it('36.5° 고정, 연결 안내, 내 연애유형 카드, 초대 버튼. 연결 전용 칸은 없다', async () => {
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B05')).toBeTruthy()
    expect(screen.getByTestId('main-hero-fixedTemperature')).toBeTruthy()
    expect(screen.getByText('36')).toBeTruthy()
    expect(screen.getByText('.5°')).toBeTruthy()
    expect(screen.getByText('연인과 연결하면 두 사람의 온도로 바뀌어요')).toBeTruthy()
    expect(screen.getByText('MY LOVE TYPE')).toBeTruthy()
    expect(screen.getByText('KEELEMBER')).toBeTruthy()
    expect(screen.getByText('온돌 같은 원칙주의자')).toBeTruthy()
    expect(screen.getByText('아직 혼자예요')).toBeTruthy()
    expect(screen.getByTestId('main-empty-slot')).toBeTruthy()
    expect(screen.queryByText(/D\+/)).toBeNull()
    expect(screen.queryByTestId('main-issue-progress')).toBeNull()
  })

  it('36.5는 발광 없이 textSub 색이다(R36-1)', async () => {
    await render(<MainTab />)
    const style = flatStyle(screen.getByText('36'))
    expect(style.textShadowColor).toBeUndefined()
    expect(style.color).toBe(nocturne.textSub)
  })

  it('B05 영문 라벨은 ember 토큰 색이다(R36-4)', async () => {
    await render(<MainTab />)
    expect(flatStyle(screen.getByText('KEELEMBER')).color).toBe(nocturne.ember)
  })

  it('초대 버튼은 커플 게이트로 간다', async () => {
    await render(<MainTab />)
    await fireEvent.press(screen.getByTestId('main-invite'))
    expect(mockPush).toHaveBeenCalledWith('/couple-gate')
  })

  it('탭은 막지 않는다: 미연결에도 화면이 열린다', async () => {
    await render(<MainTab />)
    expect(screen.queryByTestId('main-wait')).toBeNull()
  })
})

describe('연결: 온도 표시 상태', () => {
  it('B03 활동 0일: "아직 온도를 잴 기록이 없어요", D+1 + "오늘 시작했어요", 02 FIRST STEP -> 채팅, 03 FIRST ISSUE 0%', async () => {
    connect({ startDate: START_FOR_D1 })
    mockFacts = facts({ hasActivity: false })
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B03')).toBeTruthy()
    expect(screen.getByText(/아직 온도를 잴/)).toBeTruthy()
    expect(screen.getByText('D+1')).toBeTruthy()
    expect(screen.getByText('오늘 시작했어요')).toBeTruthy()
    expect(screen.getByText('FIRST STEP')).toBeTruthy()
    expect(screen.getByText('FIRST ISSUE')).toBeTruthy()
    expect(screen.getByTestId('main-issue-percent').props.children).toBe('0%')
    await fireEvent.press(screen.getByTestId('main-first-step-link'))
    expect(mockPush).toHaveBeenCalledWith('/chat')
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('B03 활동 있음 + 저장된 온도 없음: "첫 온도는 기록한 다음 날 나와요"(같은 틀), 첫 대화 권유 없음', async () => {
    connect({ temperature: null, startDate: START_FOR_D1 })
    mockFacts = facts({ hasActivity: true })
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B03')).toBeTruthy()
    expect(screen.getByTestId('main-hero-awaitingBatch')).toBeTruthy()
    expect(screen.getByText(/첫 온도는 기록한/)).toBeTruthy()
    expect(screen.queryByText(/아직 온도를 잴/)).toBeNull()
    expect(screen.queryByText('FIRST STEP')).toBeNull()
  })

  it('B01 저장된 온도 있음: 숫자는 rose + 발광, 카운트업 없이 받은 값 그대로', async () => {
    connect({ temperature: 38.2 })
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B01')).toBeTruthy()
    expect(screen.getByTestId('main-hero-temperature')).toBeTruthy()
    const style = flatStyle(screen.getByText('38'))
    expect(style.textShadowColor).toBeTruthy()
    expect(screen.getByText('.2°')).toBeTruthy()
    expect(screen.getByText('D+298')).toBeTruthy()
  })

  it('연결 + 프로파일 미완: 저장값이 있어도 36.5 고정(발광 없음)', async () => {
    connect({ temperature: 38.2 })
    mockFacts = facts({ profilesComplete: false })
    await render(<MainTab />)
    expect(screen.getByTestId('main-hero-fixedTemperature')).toBeTruthy()
    expect(screen.getByText('36')).toBeTruthy()
    expect(flatStyle(screen.getByText('36')).textShadowColor).toBeUndefined()
  })

  it('연결 뒤 사실을 아직 못 읽었으면 값을 지어내지 않고 뼈대를 보인다', async () => {
    connect()
    mockFacts = facts({ hasActivity: null, profilesComplete: null })
    await render(<MainTab />)
    expect(screen.getByTestId('main-wait')).toBeTruthy()
  })
})

describe('마일스톤', () => {
  it('7일 전부터 칩: D+298 -> "300일 · 2일 남았어요"', async () => {
    connect({ temperature: 38.2, startDate: START_FOR_D298 })
    await render(<MainTab />)
    expect(screen.getByText('300일 · 2일 남았어요')).toBeTruthy()
  })

  it('B04 당일: 히어로가 "300"+"일"로 바뀌고 "오늘로 함께한 지 300일이에요", 온도 칩은 저장값이 있을 때만', async () => {
    connect({ temperature: 38.4, startDate: START_FOR_D300 })
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B04')).toBeTruthy()
    expect(screen.getByTestId('main-hero-milestone')).toBeTruthy()
    expect(screen.getByText('300')).toBeTruthy()
    expect(screen.getByText('오늘로 함께한 지 300일이에요')).toBeTruthy()
    expect(screen.getByText('38.4°')).toBeTruthy()
  })

  it('B04 + 저장된 온도 없음: 온도 칩이 없다', async () => {
    connect({ temperature: null, startDate: START_FOR_D300 })
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B04')).toBeTruthy()
    expect(screen.queryByTestId('main-temperature-chip')).toBeNull()
  })
})

describe('B06 새 호 도착과 지난 호 · 다음 호 카드', () => {
  const next = { monthLabel: '10월호', percent: 41, counts: { messages: 412, photos: 18, dates: 3 } }

  it('안 열었고 7일 이내: "VOL.03 · 10월호가 꽂혔어요" + [읽기] -> 뷰어', async () => {
    connect({ temperature: 38.6 })
    mockLibrary = library({ issues: [issue({ periodStart: '2026-10-01' })], next })
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B06')).toBeTruthy()
    expect(screen.getByText('VOL.03')).toBeTruthy()
    expect(screen.getByText(/10월호가/)).toBeTruthy()
    expect(screen.queryByTestId('main-last-issue')).toBeNull()
    await fireEvent.press(screen.getByTestId('main-new-issue-read'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/magazine-viewer', params: { issueId: 'i3' } })
    // 히어로는 그대로 온도(보드)다.
    expect(screen.getByTestId('main-hero-temperature')).toBeTruthy()
  })

  it('열어 본 호면 카드가 사라지고 "지난 호 다시 읽기"가 된다', async () => {
    connect({ temperature: 38.6 })
    mockLibrary = library({ issues: [issue()], next })
    mockFacts = facts({ openedIssueIds: new Set(['i3']) })
    await render(<MainTab />)
    expect(screen.getByTestId('main-state-B01')).toBeTruthy()
    expect(screen.queryByTestId('main-new-issue')).toBeNull()
    await fireEvent.press(screen.getByTestId('main-last-issue'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/magazine-viewer', params: { issueId: 'i3' } })
  })

  it('발행 7일이 지났으면 안 열었어도 카드가 사라진다', async () => {
    connect({ temperature: 38.6 })
    mockLibrary = library({ issues: [issue({ publishedAt: '2026-10-13T11:59:59Z' })], next })
    await render(<MainTab />)
    expect(screen.queryByTestId('main-new-issue')).toBeNull()
    expect(screen.getByTestId('main-last-issue')).toBeTruthy()
  })

  it('다음 호 카드: NEXT ISSUE, 기간 경과율, 재료 수. "제작 현황 →"은 없다. 새 호가 있으면 번호는 02', async () => {
    connect({ temperature: 38.6 })
    mockLibrary = library({ issues: [issue()], next })
    await render(<MainTab />)
    expect(screen.getByText('NEXT ISSUE')).toBeTruthy()
    expect(screen.getByText('10월호를 만들고 있어요')).toBeTruthy()
    expect(screen.getByTestId('main-issue-percent').props.children).toBe('41%')
    expect(screen.getByText('대화 412 · 사진 18 · 데이트 3')).toBeTruthy()
    expect(screen.getByText('02')).toBeTruthy()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('R32-2: 발행 1권 이상 + 초안 없음이면 다음 호 카드가 없다', async () => {
    connect({ temperature: 38.6 })
    mockLibrary = library({ issues: [issue()], next: null })
    mockFacts = facts({ openedIssueIds: new Set(['i3']) })
    await render(<MainTab />)
    expect(screen.queryByTestId('main-issue-progress')).toBeNull()
  })

  it('호 조회에 실패하면 0권으로 오해하게 두지 않고 호 칸을 그리지 않는다', async () => {
    connect({ temperature: 38.6 })
    mockLibrary = library({ error: true })
    await render(<MainTab />)
    expect(screen.queryByTestId('main-issue-progress')).toBeNull()
    expect(screen.getByTestId('main-hero-temperature')).toBeTruthy()
  })
})

describe('MVP에서 뺀 것', () => {
  const everyState = async () => {
    connect({ temperature: 38.2 })
    mockLibrary = library({
      issues: [issue()],
      next: { monthLabel: '10월호', percent: 41, counts: { messages: 1, photos: 2, dates: 3 } },
    })
    await render(<MainTab />)
  }

  it('끌어내리기 힌트 · "이번 주" 인용 · 제작 현황 링크 · 일 단위 증감 · 오늘 할 수 있는 일이 없다', async () => {
    await everyState()
    expect(screen.queryByText(/끌어내리면/)).toBeNull()
    expect(screen.queryByText(/놓으면 하늘/)).toBeNull()
    expect(screen.queryByText(/THIS WEEK/)).toBeNull()
    expect(screen.queryByText(/이번 주/)).toBeNull()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
    expect(screen.queryByText(/어제보다/)).toBeNull()
    expect(screen.queryByText(/오늘 할 수 있는 일/)).toBeNull()
  })

  it('세로 날짜 장식은 접근성 트리에서 빠져 있다', async () => {
    await everyState()
    const node = screen.getByTestId('main-vertical-date', { includeHiddenElements: true })
    expect(node.props.accessibilityElementsHidden).toBe(true)
  })
})

describe('하늘 장막', () => {
  it('메인은 하늘 장막(.42)과 하단 장막(460pt)을 둘 다 그린다', async () => {
    connect({ temperature: 38.2 })
    await render(<MainTab />)
    const veil = flatStyle(screen.getByTestId('sky-veil'))
    expect(veil.opacity).toBe(0.42)
    const bottom = flatStyle(screen.getByTestId('sky-bottom-veil'))
    expect(bottom.height).toBe(460)
    expect(String(bottom.experimental_backgroundImage)).toContain('0.94')
  })
})

afterEach(async () => {
  await act(async () => {})
})
