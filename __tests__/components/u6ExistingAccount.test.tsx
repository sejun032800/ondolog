/**
 * 기존 계정 · 동의 문장 (R38-2, R38-3 / MASTER 6-3 r70, 6-5 r70).
 *
 * - ① AI 활용 동의 설명 문장이 상수와 글자 그대로 같고, 화면이 그 상수를 쓴다.
 * - ② a "이미 계정이 있어요" -> 동의 없이 A11. 이 길의 표시는 메모리(sessionStore)뿐이다.
 * - ② b 로그인 직후 profiles가 있으면 저장 경로 호출 0 · 메모리의 답과 동의를 버림 · 서버 진행 단계로.
 * - ② c profiles가 없으면: 메모리가 비었으면 로그인한 채 A03부터, 이후 A10에서 A11을 건너뛰고 저장.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import AuthScreen from '../../app/(onboarding)/auth'
import ConsentScreen from '../../app/(onboarding)/consent'
import LogoStart from '../../app/index'
import { AI_USAGE_HELPER } from '../../src/constants/consent'
import { useSessionStore } from '../../src/store/sessionStore'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({}),
}))

// 서버 클라이언트 - 호출을 기록한다. 로그인 전 화면에서는 0이어야 한다.
const mockCalls: string[] = []
function mockRecorder(path: string[]): unknown {
  return new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return undefined
      return mockRecorder([...path, String(prop)])
    },
    apply() {
      mockCalls.push(path.join('.'))
      if (path[path.length - 1] === 'onAuthStateChange') {
        return { data: { subscription: { unsubscribe: () => {} } } }
      }
      return Promise.resolve({ data: { session: null }, error: null })
    },
  })
}
jest.mock('../../src/services/supabase', () => ({ supabase: mockRecorder(['supabase']) }))

let mockSession: { user: { id: string } } | null = null
jest.mock('../../src/hooks/useSession', () => ({
  useSession: () => ({ session: mockSession, loading: false }),
}))

const mockFetchProfile = jest.fn()
const mockFetchAssessment = jest.fn()
const mockCreate = jest.fn()
jest.mock('../../src/services/personalityApi', () => ({
  createProfileAndAssessment: (...a: unknown[]) => mockCreate(...a),
  fetchProfile: (...a: unknown[]) => mockFetchProfile(...a),
  fetchLatestAssessment: (...a: unknown[]) => mockFetchAssessment(...a),
}))
const mockKakao = jest.fn()
jest.mock('../../src/services/socialAuth', () => ({
  signInWithSocialProvider: (...a: unknown[]) => mockKakao(...a),
}))

let mockCouple: { status: string; relationshipStartDate: string | null } = { status: 'none', relationshipStartDate: null }
jest.mock('../../src/store/coupleStore', () => ({
  useCoupleStore: { getState: () => ({ refresh: async () => {}, ...mockCouple }) },
}))

const LITERAL =
  '두 사람의 대화·메모·사진이 잡지를 만드는 데 쓰여요. 글로 된 기록은 잡지 문장을 쓰기 위해 외부 AI 서비스로 보내지고, 사진 자체는 보내지 않아요.'
const ALL_CONSENT = { terms: true, privacy: true, aiUsage: true, marketing: false }

function fillSession(over: Partial<ReturnType<typeof useSessionStore.getState>> = {}) {
  useSessionStore.setState({
    name: '세준',
    gender: 'male',
    birthDate: '2000-01-01',
    mbti: 'INFJ',
    mbtiSelfReported: true,
    q1: 'A',
    q2: 'B',
    q3: 'C',
    q4: 'A',
    q5: 'B',
    result: {
      enneagramCore: 1,
      loveTypeCode: 'KLE',
      big5: { bigE: 1, bigO: 1, bigA: 1, bigC: 1, bigN: 1 },
      sternberg: { intimacy: 1, passion: 1, commitment: 1 },
      attachAnxiety: 1,
      attachAvoidance: 1,
      attachment: 'SECURE',
    } as never,
    consent: ALL_CONSENT,
    ...over,
  })
}

const profileAt = (step: number) => ({ id: 'u1', display_name: '기존', onboarding_step: step })

let setItemSpy: jest.SpyInstance

beforeEach(async () => {
  mockPush.mockClear()
  mockReplace.mockClear()
  mockBack.mockClear()
  mockCreate.mockReset()
  mockKakao.mockReset()
  mockFetchProfile.mockReset()
  mockFetchAssessment.mockReset()
  mockCalls.length = 0
  mockSession = null
  mockCouple = { status: 'none', relationshipStartDate: null }
  useSessionStore.getState().resetSession()
  await AsyncStorage.clear()
  setItemSpy = jest.spyOn(AsyncStorage, 'setItem')
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

function disabledOf(testID: string): boolean {
  return Boolean(screen.getByTestId(testID).props.accessibilityState?.disabled)
}

describe('① AI 활용 동의 설명 문장', () => {
  it('상수가 지시서의 문장과 글자 그대로 같다', () => {
    expect(AI_USAGE_HELPER).toBe(LITERAL)
  })

  it('A10 화면이 그 문장을 보여준다(옛 문장은 없다)', async () => {
    useSessionStore.setState({ birthDate: '2000-01-01' })
    await render(<ConsentScreen />)
    expect(screen.getByText(LITERAL)).toBeTruthy()
    expect(screen.queryByText('대화·사진·메모가 잡지를 만드는 데 쓰이고, 이때 외부 AI로 전송돼요')).toBeNull()
  })
})

describe('② a "이미 계정이 있어요" -> 동의 없이 로그인(A11)', () => {
  async function renderStart() {
    jest.useFakeTimers()
    await render(<LogoStart />)
    await act(async () => {
      jest.advanceTimersByTime(1600)
    })
  }

  it('누르면 A11로 바로 가고 표시는 메모리에만 남는다 - 서버 호출 · 영속 저장 0', async () => {
    await renderStart()
    expect(useSessionStore.getState().existingAccountPath).toBe(false)
    await fireEvent.press(screen.getByTestId('existing-account'))
    expect(mockPush).toHaveBeenCalledWith('/auth')
    expect(mockPush).not.toHaveBeenCalledWith('/consent')
    expect(useSessionStore.getState().existingAccountPath).toBe(true)
    expect(useSessionStore.getState().consent).toEqual({ terms: false, privacy: false, aiUsage: false, marketing: false })
    expect(mockCalls.filter((c) => c !== 'supabase.auth.getSession' && c !== 'supabase.auth.onAuthStateChange')).toEqual([])
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(await AsyncStorage.getAllKeys()).toEqual([])
  })

  it('"시작하기"로 들어오면 표시가 꺼진다', async () => {
    useSessionStore.getState().setExistingAccountPath(true)
    await renderStart()
    await fireEvent.press(screen.getByTestId('start-button'))
    expect(useSessionStore.getState().existingAccountPath).toBe(false)
    expect(mockPush).toHaveBeenCalledWith('/basic-info')
  })

  it('이 길로 온 A11은 동의가 비어도 머물고, 카카오 로그인이 눌린다', async () => {
    useSessionStore.getState().setExistingAccountPath(true)
    mockKakao.mockResolvedValue({ cancelled: true })
    await render(<AuthScreen />)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(disabledOf('auth-kakao')).toBe(false)
    await fireEvent.press(screen.getByTestId('auth-kakao'))
    expect(mockKakao).toHaveBeenCalledWith('kakao')
    expect(mockFetchProfile).not.toHaveBeenCalled() // 로그인 전 서버 조회 0
  })

  it('이 길이 아니면(표시 없음) 동의 없이 A11에 머물 수 없다 - 기존 가드 그대로', async () => {
    await render(<AuthScreen />)
    expect(mockReplace).toHaveBeenCalledWith('/consent')
  })
})

describe('② b 로그인 직후 profiles가 있다', () => {
  it.each([
    [0, '/result-detail'],
    [1, '/invite'],
    [3, '/main'],
  ])('진행 단계 %i -> %s, 저장 경로 호출 0 · 메모리의 답과 동의를 버린다', async (step, destination) => {
    fillSession()
    useSessionStore.getState().setExistingAccountPath(true)
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockResolvedValue(profileAt(step))
    mockFetchAssessment.mockResolvedValue({ id: 'a1', seq: 1 }) // 검사도 이미 있다
    await render(<AuthScreen />)
    await act(async () => {})

    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith(destination)
    expect(mockReplace).not.toHaveBeenCalledWith('/consent')
    const state = useSessionStore.getState()
    expect(state.name).toBe('')
    expect(state.q1).toBeNull()
    expect(state.result).toBeNull()
    expect(state.consent).toEqual({ terms: false, privacy: false, aiUsage: false, marketing: false })
    expect(state.existingAccountPath).toBe(false)
  })

  it('진행 단계 2(초대 끝) + 커플 연결 + 사귄 날짜 없음 -> 사귄 날짜 입력으로', async () => {
    mockSession = { user: { id: 'u1' } }
    mockCouple = { status: 'connected', relationshipStartDate: null }
    mockFetchProfile.mockResolvedValue(profileAt(2))
    await render(<AuthScreen />)
    await act(async () => {})
    expect(mockReplace).toHaveBeenCalledWith('/start-date')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('메모리가 비어 있어도(이미 계정 길) 저장 없이 서버 진행 단계로 간다', async () => {
    useSessionStore.getState().setExistingAccountPath(true)
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockResolvedValue(profileAt(3))
    await render(<AuthScreen />)
    await act(async () => {})
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockFetchAssessment).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/main')
  })

  it('저장이 중간에 끊겨 프로필만 있고 검사는 없는데 메모리 답이 온전하면 저장 경로로 끝까지 간다', async () => {
    fillSession()
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockResolvedValue(profileAt(0))
    mockFetchAssessment.mockResolvedValue(null)
    mockCreate.mockResolvedValue({})
    await render(<AuthScreen />)
    await act(async () => {})
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/result-detail')
  })

  it('프로필을 읽다 실패하면 넘어가지 않고 다시 시도할 수 있다 - 메모리 그대로', async () => {
    fillSession()
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(profileAt(1))
    mockFetchAssessment.mockResolvedValue({ id: 'a1' })
    await render(<AuthScreen />)
    await act(async () => {})
    expect(screen.getByTestId('auth-save-error')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(useSessionStore.getState().name).toBe('세준')
    await fireEvent.press(screen.getByTestId('auth-retry'))
    await act(async () => {})
    expect(mockReplace).toHaveBeenCalledWith('/invite')
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('② c 로그인 직후 profiles가 없다', () => {
  it('메모리가 비었으면(이미 계정 길 · 로그인 사이 앱 종료) 로그인한 채 A03부터 - 저장 0', async () => {
    useSessionStore.getState().setExistingAccountPath(true)
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockResolvedValue(null)
    await render(<AuthScreen />)
    await act(async () => {})
    expect(mockReplace).toHaveBeenCalledWith('/basic-info')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('답은 있는데 동의가 비었으면 A10부터', async () => {
    fillSession({ consent: { terms: false, privacy: false, aiUsage: false, marketing: false } })
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockResolvedValue(null)
    await render(<AuthScreen />)
    await act(async () => {})
    expect(mockReplace).toHaveBeenCalledWith('/consent')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('A03~A08을 다시 지나 A10에서 [동의하고 시작하기] -> A11을 건너뛰고 바로 저장 -> 결과 상세', async () => {
    fillSession()
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockResolvedValue(null)
    mockCreate.mockResolvedValue({})
    await render(<ConsentScreen />)
    await act(async () => {})

    expect(mockCreate).not.toHaveBeenCalled() // 버튼을 누르기 전에는 저장하지 않는다
    expect(disabledOf('consent-proceed')).toBe(false)
    await fireEvent.press(screen.getByTestId('consent-proceed'))
    await act(async () => {})

    expect(mockPush).not.toHaveBeenCalledWith('/auth')
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ userId: 'u1', name: '세준', marketingAgreed: false })
    expect(mockReplace).toHaveBeenCalledWith('/result-detail')
    expect(useSessionStore.getState().name).toBe('')
  })

  it('A10에서 저장이 실패하면 넘어가지 않고 안내가 나온다 - 다시 누르면 다시 저장한다', async () => {
    fillSession()
    mockSession = { user: { id: 'u1' } }
    mockFetchProfile.mockResolvedValue(null)
    mockCreate.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({})
    await render(<ConsentScreen />)
    await fireEvent.press(screen.getByTestId('consent-proceed'))
    await act(async () => {})
    expect(screen.getByTestId('consent-save-error')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalledWith('/result-detail')
    expect(useSessionStore.getState().name).toBe('세준')
    await fireEvent.press(screen.getByTestId('consent-proceed'))
    await act(async () => {})
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockReplace).toHaveBeenCalledWith('/result-detail')
  })

  it('로그인하지 않았으면 A10의 버튼은 지금처럼 A11로 간다', async () => {
    fillSession()
    await render(<ConsentScreen />)
    await fireEvent.press(screen.getByTestId('consent-proceed'))
    expect(mockPush).toHaveBeenCalledWith('/auth')
    expect(mockFetchProfile).not.toHaveBeenCalled()
  })
})
