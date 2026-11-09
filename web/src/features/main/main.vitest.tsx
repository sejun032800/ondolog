/**
 * 메인 탭 시험(74-3) - 원본: `__tests__/components/u1Main.test.tsx`(상태별 화면) · `__tests__/services/issueSeen.test.ts`(열어 본 호 기기 저장).
 * `MainView`는 값만 받아 그리므로 상태별 단언은 값을 바꿔 넣는다. 마지막 묶음은 가짜 클라이언트로 훅까지(`MainTab`) 돌린다 - 원격 0.
 * 시간은 KST 2026-10-21 12:00으로 고정한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Preferences } from '@capacitor/preferences'
import type { PublishedIssue } from '@/services/magazineApi'
import { setInviteEntry } from '../../app/inviteEntry'
import { setViewerEntry } from '../../app/viewerEntry'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useToastStore } from '../../stores/toastStore'
import { makeFakeNav } from '../../testSupport'
import { MainTab } from '../../tabs/MainTab'
import { issueOpenedKey, loadOpenedIssueIds, markIssueOpened } from './issueSeen'
import { MainView, type MainViewProps } from './MainView'
import type { LibraryState, LoveTypeSummary, MainFacts } from './useMainData'

// 기기 저장(Capacitor Preferences)은 메모리 사본으로 바꿔 읽기 · 쓰기 호출을 센다.
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

const NOW = new Date('2026-10-21T03:00:00Z') // KST 2026-10-21 12:00
const TODAY_KST = '2026-10-21'
const START_FOR_D298 = '2025-12-28'
const START_FOR_D300 = '2025-12-26'

function issue(over: Partial<PublishedIssue> = {}): PublishedIssue {
  return {
    id: 'i3', coupleId: 'c1', issueType: 'monthly', issueNumber: 3, title: null, coverPath: 'c1/i3/render/page-01.jpg',
    periodStart: '2026-09-01', periodEnd: '2026-09-30', pdfDigitalPath: null, pageCount: 19, publishedAt: '2026-10-18T00:00:00Z', theme: 'basic', ...over,
  }
}
const library = (over: Partial<LibraryState> = {}): LibraryState => ({ loading: false, error: false, issues: [], coverUrls: {}, next: null, ...over })
const issueKeyOf = (l: LibraryState) => l.issues.map((i) => i.id).join(',')
const facts = (l: LibraryState, over: Partial<MainFacts> = {}): MainFacts => ({
  hasActivity: true, profilesComplete: true, openedIssueIds: new Set(), openedFor: issueKeyOf(l), ...over,
})

function setCouple(over: Partial<ReturnType<typeof useCoupleStore.getState>> = {}) {
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'u2', nickname: '늘봄', temperature: null, relationshipStartDate: START_FOR_D298, ...over })
}

interface Spies { onInvite: () => void; onChat: () => void; onOpenIssue: (i: PublishedIssue) => void }
function view(over: Partial<MainViewProps> & { lib?: LibraryState; fact?: Partial<MainFacts> } = {}) {
  const lib = over.lib ?? library()
  const spies: Spies = { onInvite: vi.fn(), onChat: vi.fn(), onOpenIssue: vi.fn() }
  const props: MainViewProps = {
    now: NOW,
    status: useCoupleStore.getState().status,
    nickname: useCoupleStore.getState().nickname,
    storedTemperature: useCoupleStore.getState().temperature,
    startDate: useCoupleStore.getState().relationshipStartDate,
    selfName: '세준', partnerName: '서영',
    facts: facts(lib, over.fact), library: lib, summary: null,
    ...spies, ...over,
  }
  render(<MainView {...props} />)
  return spies
}

beforeEach(() => {
  useCoupleStore.getState().reset()
  useSheetStore.getState().closeAll()
  useToastStore.getState().hide()
})
afterEach(() => {
  cleanup()
  setInviteEntry(null)
  setViewerEntry(null)
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useProfileStore.getState().reset()
})

describe('연결 여부가 정해지기 전', () => {
  it('미연결도 연결도 확정하지 않고 뼈대만 보인다', () => {
    view({ status: 'unknown' })
    expect(screen.getByTestId('main-wait')).toBeTruthy()
    expect(screen.queryByTestId('main-state-B05')).toBeNull()
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })
})

describe('B05 미연결', () => {
  const summary: LoveTypeSummary = { mbti: 'ISTJ', enneagramCore: 1, loveTypeCode: 'KLE' }
  beforeEach(() => useCoupleStore.setState({ status: 'disconnected', temperature: 36.5 }))

  it('36.5° 고정, 연결 안내, 내 연애유형 카드, 초대 버튼. 연결 전용 칸은 없다', () => {
    view({ summary })
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

  it('36.5는 발광 없이 dim 색이다(R36-1) - 온도 숫자만 glow', () => {
    view({ summary })
    const numeral = screen.getByRole('img', { name: '36.5도' })
    expect(numeral.className).toContain('dim')
    expect(numeral.className).not.toContain('glow')
  })

  it('초대 버튼은 초대로 간다(커플 게이트 시트를 한 번 더 거치지 않는다)', () => {
    const spies = view({ summary })
    fireEvent.click(screen.getByText('연인 초대하기'))
    expect(spies.onInvite).toHaveBeenCalledTimes(1)
    expect(useSheetStore.getState().current).toBeNull()
  })

  it('탭은 막지 않는다: 미연결에도 화면이 열린다. 연결 전용 조회 결과가 없어도 뼈대에 머물지 않는다', () => {
    view({ lib: library({ loading: true }), fact: { hasActivity: null, openedFor: null } })
    expect(screen.queryByTestId('main-wait')).toBeNull()
    expect(screen.getByTestId('main-state-B05')).toBeTruthy()
  })

  it('연애유형 요약이 없어도(아직 읽는 중) 틀은 그리고 값을 지어내지 않는다', () => {
    view({ summary: null })
    expect(screen.getByText('MY LOVE TYPE')).toBeTruthy()
    expect(screen.queryByText('KEELEMBER')).toBeNull()
  })
})

describe('연결: 온도 표시 상태', () => {
  it('B03 활동 0일: "아직 온도를 잴 기록이 없어요", D+1 + "오늘 시작했어요", 02 FIRST STEP -> 채팅, 03 FIRST ISSUE 0%', () => {
    setCouple({ relationshipStartDate: TODAY_KST })
    const spies = view({ fact: { hasActivity: false } })
    expect(screen.getByTestId('main-state-B03')).toBeTruthy()
    expect(screen.getByText(/아직 온도를 잴/)).toBeTruthy()
    expect(screen.getByText('D+1')).toBeTruthy()
    expect(screen.getByText('오늘 시작했어요')).toBeTruthy()
    expect(screen.getByText('FIRST STEP')).toBeTruthy()
    expect(screen.getByText('FIRST ISSUE')).toBeTruthy()
    expect(screen.getByTestId('main-issue-percent').textContent).toBe('0%')
    fireEvent.click(screen.getByTestId('main-first-step-link'))
    expect(spies.onChat).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('B03 활동 있음 + 저장된 온도 없음: "첫 온도는 기록한 다음 날 나와요"(같은 틀), 첫 대화 권유 없음', () => {
    setCouple({ temperature: null, relationshipStartDate: TODAY_KST })
    view({ fact: { hasActivity: true } })
    expect(screen.getByTestId('main-state-B03')).toBeTruthy()
    expect(screen.getByTestId('main-hero-awaitingBatch')).toBeTruthy()
    expect(screen.getByText(/첫 온도는 기록한/)).toBeTruthy()
    expect(screen.queryByText(/아직 온도를 잴/)).toBeNull()
    expect(screen.queryByText('FIRST STEP')).toBeNull()
  })

  it('B01 저장된 온도 있음: 숫자는 rose + 발광, 받은 값 그대로(카운트업 없음), 앱이 계산하지 않는다', () => {
    setCouple({ temperature: 38.2 })
    view()
    expect(screen.getByTestId('main-state-B01')).toBeTruthy()
    expect(screen.getByTestId('main-hero-temperature')).toBeTruthy()
    expect(screen.getByRole('img', { name: '38.2도' }).className).toContain('glow')
    expect(screen.getByText('38')).toBeTruthy()
    expect(screen.getByText('.2°')).toBeTruthy()
    expect(screen.getByText('D+298')).toBeTruthy()
  })

  it('연결 + 프로파일 미완: 저장값이 있어도 36.5 고정(발광 없음)', () => {
    setCouple({ temperature: 38.2 })
    view({ fact: { profilesComplete: false } })
    expect(screen.getByTestId('main-hero-fixedTemperature')).toBeTruthy()
    expect(screen.getByRole('img', { name: '36.5도' }).className).toContain('dim')
  })

  it('연결 뒤 사실을 아직 못 읽었으면 값을 지어내지 않고 뼈대를 보인다', () => {
    setCouple()
    view({ fact: { hasActivity: null, profilesComplete: null } })
    expect(screen.getByTestId('main-wait')).toBeTruthy()
    expect(screen.queryByText(/아직 온도를 잴/)).toBeNull()
  })

  it('호 목록을 읽는 중이거나 "열어 봄"이 이번 호 목록 기준이 아니면 그리지 않는다(새 호 카드가 떴다 사라지지 않는다)', () => {
    setCouple({ temperature: 38.6 })
    const lib = library({ issues: [issue({ periodStart: '2026-10-01' })] })
    view({ lib, fact: { openedFor: '' } })
    expect(screen.getByTestId('main-wait')).toBeTruthy()
    expect(screen.queryByTestId('main-new-issue')).toBeNull()
  })
})

describe('마일스톤', () => {
  it('7일 전부터 칩: D+298 -> "300일 · 2일 남았어요"', () => {
    setCouple({ temperature: 38.2, relationshipStartDate: START_FOR_D298 })
    view()
    expect(screen.getByText('300일 · 2일 남았어요')).toBeTruthy()
  })

  it('B04 당일: 히어로가 "300"+"일"로 바뀌고 "오늘로 함께한 지 300일이에요", 온도 칩은 저장값이 있을 때만', () => {
    setCouple({ temperature: 38.4, relationshipStartDate: START_FOR_D300 })
    view()
    expect(screen.getByTestId('main-state-B04')).toBeTruthy()
    expect(screen.getByTestId('main-hero-milestone')).toBeTruthy()
    expect(screen.getByText('300')).toBeTruthy()
    expect(screen.getByText('오늘로 함께한 지 300일이에요')).toBeTruthy()
    expect(screen.getByText('38.4°')).toBeTruthy()
  })

  it('B04 + 저장된 온도 없음: 온도 칩이 없다', () => {
    setCouple({ temperature: null, relationshipStartDate: START_FOR_D300 })
    view()
    expect(screen.getByTestId('main-state-B04')).toBeTruthy()
    expect(screen.queryByTestId('main-temperature-chip')).toBeNull()
  })
})

describe('B06 새 호 도착과 지난 호 · 다음 호 카드', () => {
  const next = { monthLabel: '10월호', percent: 41, counts: { messages: 412, photos: 18, dates: 3 } }
  beforeEach(() => setCouple({ temperature: 38.6 }))

  it('안 열었고 7일 이내: "VOL.03 · 10월호가 꽂혔어요" + [읽기] -> 뷰어. 히어로는 그대로 온도', () => {
    const spies = view({ lib: library({ issues: [issue({ periodStart: '2026-10-01' })], next }) })
    expect(screen.getByTestId('main-state-B06')).toBeTruthy()
    expect(screen.getByText('VOL.03')).toBeTruthy()
    expect(screen.getByText(/10월호가/)).toBeTruthy()
    expect(screen.queryByTestId('main-last-issue')).toBeNull()
    fireEvent.click(screen.getByTestId('main-new-issue-read'))
    expect(spies.onOpenIssue).toHaveBeenCalledWith(expect.objectContaining({ id: 'i3' }))
    expect(screen.getByTestId('main-hero-temperature')).toBeTruthy()
  })

  it('열어 본 호면 카드가 사라지고 "지난 호 다시 읽기"가 된다', () => {
    const spies = view({ lib: library({ issues: [issue()], next }), fact: { openedIssueIds: new Set(['i3']) } })
    expect(screen.getByTestId('main-state-B01')).toBeTruthy()
    expect(screen.queryByTestId('main-new-issue')).toBeNull()
    fireEvent.click(screen.getByTestId('main-last-issue'))
    expect(spies.onOpenIssue).toHaveBeenCalledWith(expect.objectContaining({ id: 'i3' }))
  })

  it('발행 7일이 지났으면 안 열었어도 카드가 사라진다', () => {
    view({ lib: library({ issues: [issue({ publishedAt: '2026-10-13T11:59:59Z' })], next }) })
    expect(screen.queryByTestId('main-new-issue')).toBeNull()
    expect(screen.getByTestId('main-last-issue')).toBeTruthy()
  })

  it('다음 호 카드: NEXT ISSUE, 기간 경과율, 재료 수. "제작 현황 →"은 없다. 새 호가 있으면 번호는 02', () => {
    view({ lib: library({ issues: [issue()], next }) })
    expect(screen.getByText('NEXT ISSUE')).toBeTruthy()
    expect(screen.getByText('10월호를 만들고 있어요')).toBeTruthy()
    expect(screen.getByTestId('main-issue-percent').textContent).toBe('41%')
    expect(screen.getByText('대화 412 · 사진 18 · 데이트 3')).toBeTruthy()
    expect(screen.getByText('02')).toBeTruthy()
    expect(screen.queryByText(/제작 현황/)).toBeNull()
  })

  it('R32-2: 발행 1권 이상 + 초안 없음이면 다음 호 카드가 없다', () => {
    view({ lib: library({ issues: [issue()], next: null }), fact: { openedIssueIds: new Set(['i3']) } })
    expect(screen.queryByTestId('main-issue-progress')).toBeNull()
  })

  it('호 조회에 실패하면 0권으로 오해하게 두지 않고 호 칸을 그리지 않는다', () => {
    view({ lib: library({ error: true }) })
    expect(screen.queryByTestId('main-issue-progress')).toBeNull()
    expect(screen.getByTestId('main-hero-temperature')).toBeTruthy()
  })

  it('표지는 서명 URL 값을 그대로 이미지로만 쓰고 글로 내지 않는다', () => {
    view({ lib: library({ issues: [issue()], coverUrls: { 'c1/i3/render/page-01.jpg': 'https://signed.invalid/x' }, next }) })
    expect(document.querySelector('[data-testid="main-issue-cover"] img')?.getAttribute('src')).toBe('https://signed.invalid/x')
    expect(document.body.textContent).not.toContain('signed.invalid')
  })
})

describe('MVP에서 뺀 것 · 범위 밖', () => {
  it('끌어내리기 힌트 · "이번 주" 인용 · 제작 현황 링크 · 일 단위 증감 · 오늘 할 수 있는 일 · 하늘(C)로 가는 버튼이 없다', () => {
    setCouple({ temperature: 38.2 })
    view({ lib: library({ issues: [issue()], next: { monthLabel: '10월호', percent: 41, counts: { messages: 1, photos: 2, dates: 3 } } }) })
    for (const re of [/끌어내리면/, /놓으면 하늘/, /THIS WEEK/, /이번 주/, /제작 현황/, /어제보다/, /오늘 할 수 있는 일/, /우리의 하늘/]) {
      expect(screen.queryByText(re)).toBeNull()
    }
  })

  it('세로 날짜 장식은 접근성 트리에서 빠져 있다', () => {
    setCouple({ temperature: 38.2 })
    view()
    expect(screen.getByTestId('main-vertical-date').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByTestId('main-vertical-date').textContent).toBe('10월 21일 수요일')
  })
})

// ---------------------------------------------------------------------------
// 열어 본 호 기기 저장(B06)
// ---------------------------------------------------------------------------
describe('열어 본 호 기기 저장', () => {
  beforeEach(async () => { await Preferences.clear() })

  it('열었다고 남기면 그 사용자 · 그 호만 열린 것으로 읽힌다', async () => {
    expect(await markIssueOpened('u1', 'i1')).toBe(true)
    expect([...(await loadOpenedIssueIds('u1', ['i1', 'i2']))]).toEqual(['i1'])
  })

  it('사용자 단위: 다른 사용자가 열었다고 내 표시가 되지 않는다', async () => {
    await markIssueOpened('u1', 'i1')
    expect((await loadOpenedIssueIds('u2', ['i1'])).size).toBe(0)
  })

  it('호가 없으면 저장소를 읽지 않고 빈 집합', async () => {
    const spy = vi.mocked(Preferences.get)
    spy.mockClear()
    expect((await loadOpenedIssueIds('u1', [])).size).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('저장소가 실패해도 던지지 않는다(읽기 -> 빈 집합, 쓰기 -> false)', async () => {
    const get = vi.mocked(Preferences.get).mockRejectedValueOnce(new Error('boom'))
    expect((await loadOpenedIssueIds('u1', ['i1'])).size).toBe(0)
    void get
    const set = vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('boom'))
    expect(await markIssueOpened('u1', 'i1')).toBe(false)
    void set
  })

  it('키는 RN과 같다(사용자 · 호)', () => {
    expect(issueOpenedKey('u1', 'i1')).toBe('ondolog.issueOpened.u1.i1')
  })
})

// ---------------------------------------------------------------------------
// 훅까지: 가짜 클라이언트로 `MainTab`을 돌린다(원격 0)
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>
interface TableSet { [table: string]: Row[] }

function makeDb(tables: TableSet, progress: Row[] = []) {
  const from = (table: string) => {
    const filters: Array<(r: Row) => boolean> = []
    let head = false
    const b: Record<string, unknown> = {}
    const same = () => b
    b.select = (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return b }
    b.order = same; b.limit = same
    b.eq = (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return b }
    b.is = (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return b }
    b.not = (c: string, _op: string, v: unknown) => { filters.push((r) => (r[c] ?? null) !== v); return b }
    b.gte = same; b.lt = same; b.lte = same
    const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
    b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null })
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(head ? { count: rows().length, data: null, error: null } : { data: rows(), error: null }).then(res, rej)
    return b
  }
  return {
    from,
    rpc: async (fn: string) => ({ data: fn === 'fn_issue_progress' ? progress : null, error: null }),
    storage: { from: () => ({ createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.invalid/${p}` })), error: null }) }) },
    auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  } as never
}

describe('MainTab - 훅까지(가짜 클라이언트)', () => {
  beforeEach(async () => {
    await Preferences.clear()
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    useAuthStore.getState().setUserId('me')
    useProfileStore.setState({ status: 'loaded', profile: { id: 'me', displayName: '세준', gender: 'male', birthDate: '1999-01-01', mbti: null, onboardingStep: 3, deletedAt: null } })
  })
  afterEach(() => vi.useRealTimers())

  const ISSUE_ROW: Row = {
    id: 'i3', couple_id: 'c1', issue_type: 'monthly', issue_number: 3, title: null, cover_path: 'c1/i3/render/page-01.jpg',
    period_start: '2026-10-01', period_end: '2026-10-31', pdf_digital_path: null, page_count: 19, published_at: '2026-10-18T00:00:00Z', theme: 'basic',
  }
  const mount = () => render(<MainTab nav={makeFakeNav()} />)

  it('연결 · 기록 없음: B03 - 첫 대화 권유, 첫 호 카드. 깜빡이는 빈 상태가 먼저 뜨지 않는다', async () => {
    setSupabaseForTest(makeDb({ profiles: [{ id: 'u2', display_name: '서영' }], personality_profiles: [{ user_id: 'me' }, { user_id: 'u2' }] }))
    setCouple({ relationshipStartDate: TODAY_KST })
    mount()
    expect(screen.getByTestId('main-wait')).toBeTruthy()
    expect(screen.queryByText(/아직 온도를 잴/)).toBeNull()
    await waitFor(() => expect(screen.getByTestId('main-state-B03')).toBeTruthy())
    expect(screen.getByText('FIRST STEP')).toBeTruthy()
    expect(screen.getByText('FIRST ISSUE')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/세준 · 서영/)).toBeTruthy())
  })

  it('연결 · 기록 있음 · 온도 없음: "첫 온도는 기록한 다음 날 나와요"', async () => {
    setSupabaseForTest(makeDb({ messages: [{ id: 'm1', couple_id: 'c1' }], profiles: [{ id: 'u2', display_name: '서영' }], personality_profiles: [{ user_id: 'me' }, { user_id: 'u2' }] }))
    setCouple({ temperature: null })
    mount()
    await waitFor(() => expect(screen.getByTestId('main-hero-awaitingBatch')).toBeTruthy())
    expect(screen.queryByText('FIRST STEP')).toBeNull()
  })

  it('미연결: B05, 내 연애유형 읽기, 36.5 고정 - 연결 전용 조회는 하지 않는다', async () => {
    const db = makeDb({
      personality_assessments: [{ user_id: 'me', seq: 1, mbti: 'ISTJ' }],
      personality_profiles: [{ user_id: 'me', enneagram_inferred: 1, enneagram_effective: 1, attachment: 'secure' }],
    })
    const fromSpy = vi.spyOn(db as { from: (t: string) => unknown }, 'from')
    setSupabaseForTest(db)
    useCoupleStore.setState({ status: 'disconnected', temperature: 36.5 })
    mount()
    expect(screen.getByTestId('main-state-B05')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('MY LOVE TYPE')).toBeTruthy())
    const tables = fromSpy.mock.calls.map((c) => c[0])
    expect(tables).not.toContain('messages')
    expect(tables).not.toContain('issues_public')
    expect(screen.getByRole('img', { name: '36.5도' })).toBeTruthy()
  })

  it('발행 호 있음 · 안 열어 봄: B06 [읽기] -> 뷰어 입구. 열어 봤다고 남기면 다음에는 지난 호 카드', async () => {
    setSupabaseForTest(makeDb({
      issues_public: [ISSUE_ROW], messages: [{ id: 'm1', couple_id: 'c1' }],
      profiles: [{ id: 'u2', display_name: '서영' }], personality_profiles: [{ user_id: 'me' }, { user_id: 'u2' }],
    }))
    const open = vi.fn()
    setViewerEntry(open)
    setCouple({ temperature: 38.6 })
    const first = mount()
    await waitFor(() => expect(screen.getByTestId('main-state-B06')).toBeTruthy())
    fireEvent.click(screen.getByTestId('main-new-issue-read'))
    expect(open).toHaveBeenCalledWith('i3')
    first.unmount()
    await markIssueOpened('me', 'i3')
    mount()
    await waitFor(() => expect(screen.getByTestId('main-last-issue')).toBeTruthy())
    expect(screen.queryByTestId('main-new-issue')).toBeNull()
  })

  it('뷰어 입구가 아직 꽂히지 않았으면 안내 토스트(아무 일도 없는 버튼 0)', async () => {
    setSupabaseForTest(makeDb({ issues_public: [ISSUE_ROW], messages: [{ id: 'm1', couple_id: 'c1' }], profiles: [], personality_profiles: [{ user_id: 'me' }, { user_id: 'u2' }] }))
    setCouple({ temperature: 38.6 })
    mount()
    await waitFor(() => expect(screen.getByTestId('main-new-issue-read')).toBeTruthy())
    fireEvent.click(screen.getByTestId('main-new-issue-read'))
    expect(useToastStore.getState().toast?.message).toBe('매거진 뷰어는 곧 열려요')
    await act(async () => {})
  })
})

describe('하늘 · 탭 바(Shell)', () => {
  it('메인 경로는 하늘을 켜고 장막 .42 + 하단 장막을 둔다. 탭 5개는 미연결에도 모두 보인다', async () => {
    const { default: App } = await import('../../App')
    const { makeFakeBridge } = await import('../../testSupport')
    useCoupleStore.setState({ status: 'disconnected', temperature: 36.5 })
    render(<App bridge={makeFakeBridge()} initialPath="/main" />)
    await act(async () => {})
    const sky = document.querySelector('.sky') as HTMLElement
    expect(sky.style.opacity).toBe('1')
    expect((sky.querySelector('.veil') as HTMLElement).style.opacity).toBe('0.42')
    expect((sky.querySelector('.bottomVeil') as HTMLElement).style.opacity).toBe('1')
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    expect(screen.getByTestId('tab-screen-main')).toBeTruthy()
  })
})
