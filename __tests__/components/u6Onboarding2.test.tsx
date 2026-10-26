/**
 * U6 온보딩 2부 시험 (`65-`) - A14~A20 화면 동작.
 *
 * 지키는 것: A14·A15 고정 문장이 글자 그대로 · 공유 버튼 없음 · A16 오버라이드가 코어만 바꾼다(화면은 override 함수만 부른다) ·
 * A17 [솔로예요]·[나중에 할게요]는 완료 처리 뒤 메인 · A19 저장 규칙(닉네임 1~20자, 미래 날짜 불가) · A20 확인 · 앱을 다시 열면 서버 진행 단계에서 재개.
 * 서버 함수는 가짜다 - 실제 저장 규칙은 `coupleStart.test.ts`(순수 규칙 + 가짜 저장소)와 `personalityOverride.test.ts`가 본다.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import InviteScreen from '../../app/(onboarding)/invite'
import ResultDetailScreen from '../../app/(onboarding)/result-detail'
import StartDateScreen from '../../app/(onboarding)/start-date'
import LogoStart from '../../app/index'
import { COMPATIBILITY_START_TEMPERATURE_NOTICE } from '../../src/constants/resultDetailCopy'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
// 렌더마다 같은 객체를 돌려준다(진짜 라우터처럼) - 새 객체를 주면 그것에 기대는 효과가 끝없이 다시 돈다.
const mockRouter = { push: mockPush, replace: mockReplace, back: mockBack }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}))

jest.mock('../../src/services/supabase', () => ({ supabase: {} }))

let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }
jest.mock('../../src/hooks/useSession', () => ({
  useSession: () => ({ session: mockSession, loading: false }),
}))

const mockFetchAssessment = jest.fn()
const mockEnsureProfile = jest.fn()
const mockOverride = jest.fn()
const mockFetchProfile = jest.fn()
jest.mock('../../src/services/personalityApi', () => ({
  fetchLatestAssessment: (...a: unknown[]) => mockFetchAssessment(...a),
  ensurePersonalityProfile: (...a: unknown[]) => mockEnsureProfile(...a),
  overrideEnneagramCore: (...a: unknown[]) => mockOverride(...a),
  fetchProfile: (...a: unknown[]) => mockFetchProfile(...a),
}))

const mockFetchExistingInvite = jest.fn()
const mockGetOrCreateInvite = jest.fn()
const mockRedeem = jest.fn()
const mockMarkInviteDone = jest.fn()
const mockCompleteWithoutCouple = jest.fn()
const mockFetchCouple = jest.fn()
import { ConnectCoupleError } from '../../src/services/coupleConnectCore'

const mockSaveStart = jest.fn()
const mockSetOrConfirm = jest.fn()
const mockMarkStartDone = jest.fn()
jest.mock('../../src/services/coupleApi', () => ({
  fetchExistingInvite: (...a: unknown[]) => mockFetchExistingInvite(...a),
  getOrCreateInvite: (...a: unknown[]) => mockGetOrCreateInvite(...a),
  redeemInviteCode: (...a: unknown[]) => mockRedeem(...a),
  markInviteDoneAwaitingStartDate: (...a: unknown[]) => mockMarkInviteDone(...a),
  completeOnboardingWithoutCouple: (...a: unknown[]) => mockCompleteWithoutCouple(...a),
  fetchCouple: (...a: unknown[]) => mockFetchCouple(...a),
  saveStartDateAndNickname: (...a: unknown[]) => mockSaveStart(...a),
  setOrConfirmStartDate: (...a: unknown[]) => mockSetOrConfirm(...a),
  markStartDateOnboardingComplete: (...a: unknown[]) => mockMarkStartDone(...a),
}))

let mockCouple: Record<string, unknown> = {}
const mockRefresh = jest.fn(async () => {})
jest.mock('../../src/store/coupleStore', () => ({
  useCoupleStore: { getState: () => ({ refresh: mockRefresh, ...mockCouple }) },
}))

const ASSESSMENT = {
  id: 'a1',
  user_id: 'me',
  seq: 1,
  mbti: 'INFJ',
  q1: 'B',
  big_e: 34,
  big_o: 62,
  big_a: 70,
  big_c: 81,
  big_n: 41,
  stern_intimacy: 78,
  stern_passion: 54,
  stern_commitment: 86,
  attach_anxiety: 20,
  attach_avoidance: 30,
  attachment: 'anxious',
  enneagram_core: 1,
}
const PROFILE = {
  user_id: 'me',
  love_type_code: 'KLF',
  enneagram_inferred: 1,
  enneagram_override: null,
  enneagram_effective: 1,
  override_count: 0,
  attachment: 'anxious',
}

beforeEach(() => {
  jest.useRealTimers()
  for (const m of [
    mockPush, mockReplace, mockBack, mockFetchAssessment, mockEnsureProfile, mockOverride, mockFetchProfile,
    mockFetchExistingInvite, mockGetOrCreateInvite, mockRedeem, mockMarkInviteDone, mockCompleteWithoutCouple,
    mockFetchCouple, mockSaveStart, mockSetOrConfirm, mockMarkStartDone,
  ]) {
    m.mockReset()
  }
  mockRefresh.mockClear()
  mockSession = { user: { id: 'me' } }
  mockCouple = { status: 'connected', coupleId: 'c1', partnerId: 'p1' }
  mockFetchAssessment.mockResolvedValue(ASSESSMENT)
  mockEnsureProfile.mockResolvedValue(PROFILE)
  mockFetchProfile.mockResolvedValue({ display_name: '서영' })
  mockMarkInviteDone.mockResolvedValue(undefined)
  mockMarkStartDone.mockResolvedValue(undefined)
  mockCompleteWithoutCouple.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.useRealTimers()
})

async function renderDetail() {
  await render(<ResultDetailScreen />)
  await act(async () => {})
}

describe('A14 · A15 상세 결과', () => {
  it('고정 문장이 MASTER 문장과 글자 그대로 같다', async () => {
    expect(COMPATIBILITY_START_TEMPERATURE_NOTICE).toBe('연인과 연결하면 이 궁합이 두 사람의 시작 온도에 반영됩니다.')
    await renderDetail()
    expect(screen.getByTestId('compatibility-start-notice').props.children).toBe(
      '연인과 연결하면 이 궁합이 두 사람의 시작 온도에 반영됩니다.',
    )
  })

  it('"시작 온도가 높다"처럼 단정하는 문장은 없다', async () => {
    await renderDetail()
    expect(screen.queryByText(/시작 온도가 (높|낮)/)).toBeNull()
  })

  it('①~⑥이 서버 결과 그대로 보인다 - 라벨 · 빅5 · 코어와 후보 2개 · 스턴버그 · 애착 · 궁합', async () => {
    await renderDetail()
    expect(screen.getByTestId('detail-label-en').props.children).toBe('KEELFLARE')
    expect(screen.getByTestId('detail-meta')).toBeTruthy()
    expect(screen.getByTestId('bar-개방성')).toBeTruthy()
    expect(screen.getAllByText('62').length).toBeGreaterThan(0) // 개방성 값
    expect(screen.getByTestId('sternberg-intimacy')).toBeTruthy()
    expect(screen.getByTestId('enneagram-core').props.children.join('')).toContain('KEEL')
    expect(screen.getByTestId('candidate-2')).toBeTruthy() // 후보 2개(Q1 그룹 1·2·6 중 코어 1을 뺀 나머지)
    expect(screen.getByTestId('candidate-6')).toBeTruthy()
    expect(screen.getAllByText(/번일 수도 있어요/)).toHaveLength(2)
    expect(screen.getByTestId('attachment-reframe')).toBeTruthy()
    expect(screen.getByText('온도가 잘 맞는 유형')).toBeTruthy()
    expect(screen.getByText('온도차가 있는 유형')).toBeTruthy()
    expect(screen.getByTestId('compatibility-framing-text')).toBeTruthy()
  })

  it('공유 버튼이 없다(A09 공유 카드는 M3-6)', async () => {
    await renderDetail()
    expect(screen.queryByLabelText(/공유/)).toBeNull()
    expect(screen.queryByText(/공유/)).toBeNull()
  })

  it('[다음]은 초대(A17)로 간다 - 이 화면은 진행 단계를 직접 쓰지 않는다', async () => {
    await renderDetail()
    await fireEvent.press(screen.getByTestId('detail-next'))
    expect(mockPush).toHaveBeenCalledWith('/invite')
    expect(mockMarkInviteDone).not.toHaveBeenCalled()
    expect(mockMarkStartDone).not.toHaveBeenCalled()
  })
})

describe('A16 결과와 달라요', () => {
  it('"결과와 달라요 →"로 9유형 목록이 열리고, 지금 결과에 표시가 있다', async () => {
    await renderDetail()
    await fireEvent.press(screen.getByTestId('override-open'))
    for (let core = 1; core <= 9; core += 1) expect(screen.getByTestId(`core-${core}`)).toBeTruthy()
    expect(screen.getByText('지금 결과')).toBeTruthy()
  })

  it('다른 코어를 고르면 오버라이드 함수만 부른다(추론값 · 빅5 · 스턴버그 · 애착을 쓰는 함수는 없다) - 횟수 제한 없이 다시 고를 수 있다', async () => {
    mockOverride.mockResolvedValue({ ...PROFILE, enneagram_override: 5, enneagram_effective: 5, override_count: 1 })
    await renderDetail()
    await fireEvent.press(screen.getByTestId('override-open'))
    await fireEvent.press(screen.getByTestId('core-5'))
    await fireEvent.press(screen.getByTestId('override-confirm'))
    await act(async () => {})
    expect(mockOverride).toHaveBeenCalledTimes(1)
    expect(mockOverride).toHaveBeenCalledWith('me', 5)
    // 상세로 돌아오고 코어가 바뀌어 보인다. 후보는 오버라이드 뒤에는 보이지 않는다.
    expect(screen.getByTestId('enneagram-core').props.children.join('')).toContain('LORE')
    expect(screen.queryByTestId('candidate-2')).toBeNull()
    // 다시 한 번 - 제한 없음.
    mockOverride.mockResolvedValue({ ...PROFILE, enneagram_override: 8, enneagram_effective: 8, override_count: 2 })
    await fireEvent.press(screen.getByTestId('override-open'))
    await fireEvent.press(screen.getByTestId('core-8'))
    await fireEvent.press(screen.getByTestId('override-confirm'))
    await act(async () => {})
    expect(mockOverride).toHaveBeenCalledTimes(2)
    expect(mockOverride).toHaveBeenLastCalledWith('me', 8)
  })

  it('지금 결과를 그대로 [이 코어로 할게요]하면 저장하지 않는다', async () => {
    await renderDetail()
    await fireEvent.press(screen.getByTestId('override-open'))
    await fireEvent.press(screen.getByTestId('override-confirm'))
    await act(async () => {})
    expect(mockOverride).not.toHaveBeenCalled()
  })

  it('저장이 실패하면 안내가 나오고 목록에 머문다', async () => {
    mockOverride.mockRejectedValue(new Error('x'))
    await renderDetail()
    await fireEvent.press(screen.getByTestId('override-open'))
    await fireEvent.press(screen.getByTestId('core-2'))
    await fireEvent.press(screen.getByTestId('override-confirm'))
    await act(async () => {})
    expect(screen.getByTestId('override-error')).toBeTruthy()
    expect(screen.getByTestId('core-2')).toBeTruthy()
  })
})

describe('A17 연인 초대', () => {
  it('열기만 해서는 커플 행을 만들지 않는다 - 읽기만 하고, [초대 코드 만들기]를 눌러야 발급한다', async () => {
    mockFetchExistingInvite.mockResolvedValue(null)
    await render(<InviteScreen />)
    await act(async () => {})
    expect(mockFetchExistingInvite).toHaveBeenCalledWith('me')
    expect(mockGetOrCreateInvite).not.toHaveBeenCalled()

    mockGetOrCreateInvite.mockResolvedValue({ status: 'pending', couple: { invite_code: 'K7Q2MX' } })
    await fireEvent.press(screen.getByTestId('invite-make'))
    await act(async () => {})
    expect(mockGetOrCreateInvite).toHaveBeenCalledTimes(1)
    const code = screen.getByTestId('invite-code')
    expect(code.props.children).toBe('K7Q2MX')
    expect(code.props.selectable).toBe(true) // 길게 눌러 복사(R37-4)
    expect(screen.queryByText('복사하기')).toBeNull()
  })

  it('이미 발급한 코드가 있으면 그대로 보인다(만들지 않는다)', async () => {
    mockFetchExistingInvite.mockResolvedValue({ status: 'pending', couple: { invite_code: 'AB23CD' } })
    await render(<InviteScreen />)
    await act(async () => {})
    expect(screen.getByTestId('invite-code').props.children).toBe('AB23CD')
    expect(mockGetOrCreateInvite).not.toHaveBeenCalled()
  })

  it('이미 연결돼 있으면 진행 단계를 올리고 사귄 날짜(A19)로 간다', async () => {
    mockFetchExistingInvite.mockResolvedValue({ status: 'connected', couple: { invite_code: 'AB23CD' } })
    await render(<InviteScreen />)
    await act(async () => {})
    expect(mockMarkInviteDone).toHaveBeenCalledWith('me')
    expect(mockReplace).toHaveBeenCalledWith('/start-date')
  })

  it('코드를 보여 둔 채 기다리면 상대가 입력해 연결됐을 때 A19로 간다 - 두 번 가지 않는다', async () => {
    jest.useFakeTimers()
    mockFetchExistingInvite.mockResolvedValue({ status: 'pending', couple: { invite_code: 'AB23CD' } })
    await render(<InviteScreen />)
    await act(async () => {})
    expect(mockReplace).not.toHaveBeenCalled()

    mockFetchExistingInvite.mockResolvedValue({ status: 'connected', couple: { invite_code: 'AB23CD' } })
    await act(async () => {
      jest.advanceTimersByTime(4100)
    })
    await act(async () => {
      jest.advanceTimersByTime(4100)
    })
    expect(mockMarkInviteDone).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/start-date')
  })

  it.each([
    ['invite-later', '나중에 할게요'],
    ['invite-solo', '솔로예요'],
  ])('[%s] 둘 다 같다 - 완료 처리(진행 단계 COMPLETE) 뒤 바로 메인, 코드를 만들지 않는다', async (testID) => {
    mockFetchExistingInvite.mockResolvedValue(null)
    await render(<InviteScreen />)
    await act(async () => {})
    await fireEvent.press(screen.getByTestId(testID))
    await act(async () => {})
    expect(mockCompleteWithoutCouple).toHaveBeenCalledWith('me')
    expect(mockReplace).toHaveBeenCalledWith('/main')
    expect(mockGetOrCreateInvite).not.toHaveBeenCalled()
  })
})

describe('A18 초대 코드 입력', () => {
  async function openEnter() {
    mockFetchExistingInvite.mockResolvedValue(null)
    await render(<InviteScreen />)
    await act(async () => {})
    await fireEvent.press(screen.getByTestId('invite-received'))
  }

  it('여섯 글자가 차야 [연결하기]가 켜지고, 소문자는 대문자로 · 글자 아닌 것은 걸러진다', async () => {
    await openEnter()
    expect(screen.getByTestId('invite-connect').props.accessibilityState.disabled).toBe(true)
    await fireEvent.changeText(screen.getByTestId('invite-input'), 'p4n-8x')
    expect(screen.getByTestId('invite-connect').props.accessibilityState.disabled).toBe(true) // 5글자
    await fireEvent.changeText(screen.getByTestId('invite-input'), 'p4n8xq')
    expect(screen.getByTestId('invite-input').props.value).toBe('P4N8XQ')
    expect(screen.getByTestId('invite-connect').props.accessibilityState.disabled).toBe(false)
  })

  it('보드의 안내 문장이 항상 보인다', async () => {
    await openEnter()
    expect(screen.getByTestId('invite-enter-hint').props.children).toBe('이미 다른 사람과 연결된 코드는 쓸 수 없어요')
  })

  it('무효 코드(자기 코드 · 이미 연결된 코드)는 연결 함수가 오류를 던지고, 보드 문구만 보이며 넘어가지 않는다', async () => {
    mockRedeem.mockRejectedValue(new ConnectCoupleError({ code: 'P0002' }))
    await openEnter()
    await fireEvent.changeText(screen.getByTestId('invite-input'), 'P4N8XQ')
    await fireEvent.press(screen.getByTestId('invite-connect'))
    await act(async () => {})
    expect(mockRedeem).toHaveBeenCalledWith('me', 'P4N8XQ')
    expect(screen.getByTestId('invite-error').props.children).toBe('연결할 수 없어요. 코드를 다시 확인해주세요.')
    expect(mockMarkInviteDone).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('연결되면 진행 단계를 올리고 A19로 간다', async () => {
    mockRedeem.mockResolvedValue({ id: 'c1' })
    await openEnter()
    await fireEvent.changeText(screen.getByTestId('invite-input'), 'P4N8XQ')
    await fireEvent.press(screen.getByTestId('invite-connect'))
    await act(async () => {})
    expect(mockMarkInviteDone).toHaveBeenCalledWith('me')
    expect(mockReplace).toHaveBeenCalledWith('/start-date')
  })
})

describe('A19 사귄 날짜 + 커플 닉네임', () => {
  beforeEach(() => {
    mockFetchCouple.mockResolvedValue({ id: 'c1', relationship_start_date: null, start_date_set_by: null, nickname: null })
  })

  async function openEnter() {
    await render(<StartDateScreen />)
    await act(async () => {})
  }
  const submitDisabled = () => Boolean(screen.getByTestId('start-submit').props.accessibilityState?.disabled)

  it('상대 이름으로 "…과 연결됐어요"가 나온다', async () => {
    await openEnter()
    expect(screen.getByTestId('start-headline').props.children).toBe('서영과 연결됐어요')
  })

  it('날짜와 닉네임이 모두 맞아야 [시작하기]가 켜진다 - 닉네임이 비면(0자) 꺼진다', async () => {
    await openEnter()
    expect(submitDisabled()).toBe(true)
    await fireEvent.changeText(screen.getByTestId('start-date-input'), '20240101')
    expect(submitDisabled()).toBe(true) // 닉네임 0자
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '늘봄')
    expect(submitDisabled()).toBe(false)
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '가'.repeat(21))
    expect(submitDisabled()).toBe(true) // 21자
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '가'.repeat(20))
    expect(submitDisabled()).toBe(false) // 20자
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '가')
    expect(submitDisabled()).toBe(false) // 1자
  })

  it('미래 날짜는 고를 수 없다', async () => {
    await openEnter()
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '늘봄')
    await fireEvent.changeText(screen.getByTestId('start-date-input'), '20990101')
    expect(submitDisabled()).toBe(true)
    expect(screen.getByTestId('start-date-hint').props.children).toBe('오늘까지의 날짜를 입력해주세요')
  })

  it('고른 날짜에는 "오늘 D+N"이 보인다', async () => {
    await openEnter()
    await fireEvent.changeText(screen.getByTestId('start-date-input'), '20240101')
    expect(String(screen.getByTestId('start-date-hint').props.children)).toMatch(/오늘 D\+\d+/)
  })

  it('[시작하기]는 저장 함수를 부르고, 진행 단계 COMPLETE를 올린 뒤 메인으로 간다', async () => {
    mockSaveStart.mockResolvedValue({ start_date_set_by: 'me', relationship_start_date: '2024-01-01', nickname: '늘봄' })
    await openEnter()
    await fireEvent.changeText(screen.getByTestId('start-date-input'), '20240101')
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '늘봄')
    await fireEvent.press(screen.getByTestId('start-submit'))
    await act(async () => {})
    expect(mockSaveStart).toHaveBeenCalledWith('c1', 'me', '2024-01-01', '늘봄')
    expect(mockMarkStartDone).toHaveBeenCalledWith('me')
    expect(mockReplace).toHaveBeenCalledWith('/main')
  })

  it('저장이 실패하면 넘어가지 않고 안내가 나온다', async () => {
    mockSaveStart.mockRejectedValue(new Error('x'))
    await openEnter()
    await fireEvent.changeText(screen.getByTestId('start-date-input'), '20240101')
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '늘봄')
    await fireEvent.press(screen.getByTestId('start-submit'))
    await act(async () => {})
    expect(screen.getByTestId('start-error')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('거의 동시에 입력해 상대 날짜가 먼저 적용됐으면 그 날짜를 A20으로 보여 준다', async () => {
    mockSaveStart.mockResolvedValue({ start_date_set_by: 'p1', relationship_start_date: '2023-05-05', nickname: '봄' })
    await openEnter()
    await fireEvent.changeText(screen.getByTestId('start-date-input'), '20240101')
    await fireEvent.changeText(screen.getByTestId('start-nickname-input'), '늘봄')
    await fireEvent.press(screen.getByTestId('start-submit'))
    await act(async () => {})
    expect(screen.getByTestId('start-since-date').props.children).toBe('2023.05.05')
    expect(mockMarkStartDone).not.toHaveBeenCalled() // 확인할 때 마무리
  })
})

describe('A20 상대가 정한 날짜 확인', () => {
  beforeEach(() => {
    mockFetchCouple.mockResolvedValue({
      id: 'c1',
      relationship_start_date: '2025-12-27',
      start_date_set_by: 'p1',
      nickname: '늘봄',
    })
  })

  it('상대가 먼저 정했으면 A19가 아니라 A20이 열리고, 먼저 정한 값이 보인다', async () => {
    await render(<StartDateScreen />)
    await act(async () => {})
    expect(screen.queryByTestId('start-date-input')).toBeNull()
    expect(screen.getByTestId('start-since-date').props.children).toBe('2025.12.27')
    expect(screen.getByTestId('start-since-sub').props.children).toMatch(/^오늘 D\+\d+ · 늘봄$/)
    expect(screen.getByText('서영이 날짜를\n먼저 정했어요')).toBeTruthy()
    // 보드의 "설정 > 커플에서 고칠 수 있어요" - 설정 > 커플(H04, `67-`)이 생겨 이제 사실이라 넣었다(`65-`에서는 그 기능이 없어 뺐다).
    expect(screen.getByText('날짜가 다르면 설정 > 커플에서 함께 고칠 수 있어요')).toBeTruthy()
  })

  it('[확인했어요]는 입력 없이 기존 규칙(확인만)으로 부르고 진행 단계를 마무리해 메인으로 간다', async () => {
    mockSetOrConfirm.mockResolvedValue({})
    await render(<StartDateScreen />)
    await act(async () => {})
    await fireEvent.press(screen.getByTestId('start-confirm'))
    await act(async () => {})
    expect(mockSetOrConfirm).toHaveBeenCalledWith('c1', 'me', '2025-12-27')
    expect(mockSaveStart).not.toHaveBeenCalled()
    expect(mockMarkStartDone).toHaveBeenCalledWith('me')
    expect(mockReplace).toHaveBeenCalledWith('/main')
  })

  it('내가 이미 정한 날짜면 이 화면에서 할 일이 없다 - 마무리하고 메인으로', async () => {
    mockFetchCouple.mockResolvedValue({ id: 'c1', relationship_start_date: '2025-12-27', start_date_set_by: 'me', nickname: '늘봄' })
    await render(<StartDateScreen />)
    await act(async () => {})
    expect(mockMarkStartDone).toHaveBeenCalledWith('me')
    expect(mockReplace).toHaveBeenCalledWith('/main')
  })
})

describe('앱을 닫았다 열면 서버 진행 단계에서 재개한다', () => {
  async function reopen(step: number, couple: Record<string, unknown>) {
    mockCouple = couple
    mockFetchProfile.mockResolvedValue({ id: 'me', display_name: '나', onboarding_step: step })
    await render(<LogoStart />)
    await act(async () => {})
  }

  it.each([
    [0, { status: 'disconnected' }, '/result-detail'],
    [1, { status: 'disconnected' }, '/invite'],
    [2, { status: 'connected', relationshipStartDate: null }, '/start-date'],
    [2, { status: 'connected', relationshipStartDate: '2025-12-27' }, '/main'],
    [3, { status: 'connected', relationshipStartDate: '2025-12-27' }, '/main'],
  ])('진행 단계 %i + 커플 %j -> %s', async (step, couple, destination) => {
    await reopen(step, couple)
    expect(mockReplace).toHaveBeenCalledWith(destination)
    // 이 경로에서 진행 단계를 새로 쓰지 않는다 - 읽기만 한다.
    expect(mockMarkInviteDone).not.toHaveBeenCalled()
    expect(mockMarkStartDone).not.toHaveBeenCalled()
    expect(mockCompleteWithoutCouple).not.toHaveBeenCalled()
  })
})
