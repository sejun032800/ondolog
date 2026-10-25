/**
 * U6 온보딩 1부 시험 - A01~A13 화면 동작.
 *
 * 지키는 것: 로그인 전 답은 메모리뿐(AsyncStorage 0) · 동의 + 로그인 전에는 서버 호출 0 · 동의 -> 로그인 순서(동의 없이는
 * 로그인 화면에 못 머문다) · 동의 버튼 활성 조건 · 로그인 뒤 저장 실패 시 넘어가지 않음.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import ConsentScreen from '../../app/(onboarding)/consent'
import AuthScreen from '../../app/(onboarding)/auth'
import BasicInfoScreen from '../../app/(onboarding)/basic-info'
import LoveQuizScreen from '../../app/(onboarding)/love-quiz'
import MbtiScreen from '../../app/(onboarding)/mbti'
import ResultBriefScreen from '../../app/(onboarding)/result-brief'
import UnderageScreen from '../../app/(onboarding)/underage'
import LegalDocumentSheet from '../../app/(modals)/legal-document'
import LogoStart from '../../app/index'
import { LEGAL_DOCUMENTS } from '../../src/constants/legalDocuments'
import { ONBOARDING_QUESTIONS } from '../../src/data/onboardingQuestions'
import { useSessionStore } from '../../src/store/sessionStore'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}))

// 서버 클라이언트 - 모든 호출을 기록한다(경로 문자열). 로그인 전 화면에서는 0이어야 한다.
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
let mockRealSession = false
jest.mock('../../src/hooks/useSession', () => {
  const actual = jest.requireActual('../../src/hooks/useSession')
  return {
    useSession: () => (mockRealSession ? actual.useSession() : { session: mockSession, loading: false }),
  }
})

const mockCreate = jest.fn()
jest.mock('../../src/services/personalityApi', () => ({
  createProfileAndAssessment: (...a: unknown[]) => mockCreate(...a),
  fetchProfile: async () => {
    mockCalls.push('fetchProfile')
    return null
  },
}))
const mockKakao = jest.fn()
jest.mock('../../src/services/socialAuth', () => ({
  signInWithSocialProvider: (...a: unknown[]) => mockKakao(...a),
}))

const ADULT_BIRTH = '2000-01-01'
const CHILD_BIRTH = '2020-01-01'

function fillSession(over: Partial<ReturnType<typeof useSessionStore.getState>> = {}) {
  useSessionStore.setState({
    name: '세준',
    gender: 'male',
    birthDate: ADULT_BIRTH,
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
    consent: { terms: true, privacy: true, aiUsage: true, marketing: false },
    ...over,
  })
}

let setItemSpy: jest.SpyInstance
let multiSetSpy: jest.SpyInstance
let mergeItemSpy: jest.SpyInstance

beforeEach(async () => {
  mockPush.mockClear()
  mockReplace.mockClear()
  mockBack.mockClear()
  mockCreate.mockReset()
  mockKakao.mockReset()
  mockCalls.length = 0
  mockParams = {}
  mockSession = null
  mockRealSession = false
  useSessionStore.getState().resetSession()
  await AsyncStorage.clear()
  setItemSpy = jest.spyOn(AsyncStorage, 'setItem')
  multiSetSpy = jest.spyOn(AsyncStorage, 'multiSet')
  mergeItemSpy = jest.spyOn(AsyncStorage, 'mergeItem')
})

afterEach(() => {
  jest.restoreAllMocks()
})

function disabledOf(testID: string): boolean {
  return Boolean(screen.getByTestId(testID).props.accessibilityState?.disabled)
}

describe('A03 기본정보', () => {
  it('필수값이 비면 [다음]이 비활성이고, 채우면 켜지며, 다시 들어와도 입력이 남는다', async () => {
    const { unmount } = await render(<BasicInfoScreen />)
    expect(disabledOf('basic-next')).toBe(true)

    await fireEvent.changeText(screen.getByTestId('basic-name'), '세준')
    expect(disabledOf('basic-next')).toBe(true)
    await fireEvent.press(screen.getByTestId('basic-gender-male'))
    expect(disabledOf('basic-next')).toBe(true)
    await fireEvent.changeText(screen.getByTestId('basic-birth'), '20040328')
    expect(screen.getByTestId('basic-birth').props.value).toBe('2004.03.28')
    expect(disabledOf('basic-next')).toBe(false)
    expect(useSessionStore.getState().birthDate).toBe('2004-03-28')

    // 없는 날짜·미래 날짜는 값으로 인정하지 않는다.
    await fireEvent.changeText(screen.getByTestId('basic-birth'), '20040230')
    expect(useSessionStore.getState().birthDate).toBeNull()
    expect(disabledOf('basic-next')).toBe(true)
    await fireEvent.changeText(screen.getByTestId('basic-birth'), '20040328')

    await unmount()
    await render(<BasicInfoScreen />)
    expect(screen.getByTestId('basic-name').props.value).toBe('세준')
    expect(screen.getByTestId('basic-birth').props.value).toBe('2004.03.28')
    expect(disabledOf('basic-next')).toBe(false)
  })
})

describe('A04~A06 MBTI - 어느 길이든 네 글자 하나로 모인다', () => {
  it('알아요 - 네 글자를 고르면 store.mbti가 되고 A07로 간다', async () => {
    await render(<MbtiScreen />)
    expect(disabledOf('mbti-choose-next')).toBe(true)
    await fireEvent.press(screen.getByTestId('mbti-known'))
    await fireEvent.press(screen.getByTestId('mbti-choose-next'))
    expect(disabledOf('mbti-known-next')).toBe(true)
    for (const letter of ['I', 'N', 'F', 'J']) await fireEvent.press(screen.getByTestId(`mbti-letter-${letter}`))
    expect(screen.getByTestId('mbti-preview').props.children).toBe('INFJ')
    await fireEvent.press(screen.getByTestId('mbti-known-next'))
    expect(useSessionStore.getState().mbti).toBe('INFJ')
    expect(mockPush).toHaveBeenCalledWith('/love-quiz')
  })

  it('몰라요 - 네 문항에 답하면 네 글자 하나로 모이고 마지막 답에서 A07로 간다', async () => {
    await render(<MbtiScreen />)
    await fireEvent.press(screen.getByTestId('mbti-unknown'))
    await fireEvent.press(screen.getByTestId('mbti-choose-next'))
    // A=E, B=N, A=F, B=P -> ENFP
    for (const id of ['quick-a', 'quick-b', 'quick-a', 'quick-b']) {
      expect(mockPush).not.toHaveBeenCalled()
      await fireEvent.press(screen.getByTestId(id))
    }
    expect(useSessionStore.getState().mbti).toBe('ENFP')
    expect(useSessionStore.getState().mbti).toHaveLength(4)
    expect(mockPush).toHaveBeenCalledWith('/love-quiz')
  })

  it('네 글자가 바뀌면 이전 5문항 답과 결과를 비운다(문항 세트가 달라진다)', async () => {
    fillSession()
    useSessionStore.getState().setMbtiSelfReported('ENFP')
    const s = useSessionStore.getState()
    expect([s.q1, s.q2, s.q3, s.q4, s.q5, s.result]).toEqual([null, null, null, null, null, null])
    // 같은 글자를 다시 고르면 답이 남는다.
    fillSession()
    useSessionStore.getState().setMbtiSelfReported('INFJ')
    expect(useSessionStore.getState().q1).toBe('A')
  })
})

describe('A07 연애유형 5문항 - 기존 엔진 그대로', () => {
  it('다섯 문항을 고르면 채점해 A08로 간다', async () => {
    useSessionStore.setState({ mbti: 'INFJ', mbtiSelfReported: true })
    await render(<LoveQuizScreen />)
    const questions = ONBOARDING_QUESTIONS.INFJ
    for (let i = 0; i < questions.length; i++) {
      expect(screen.getByTestId('quiz-prompt').props.children).toBe(questions[i].prompt)
      expect(mockPush).not.toHaveBeenCalled()
      await fireEvent.press(screen.getByTestId('quiz-option-B'))
    }
    expect(mockPush).toHaveBeenCalledWith('/result-brief')
    expect(useSessionStore.getState().result).not.toBeNull()
  })
})

describe('A08 간략 결과', () => {
  it('이름을 싣지 않고, 공유·이미지 저장 버튼을 숨긴다(공유 카드는 M3-6)', async () => {
    fillSession({ name: '세준' })
    await render(<ResultBriefScreen />)
    expect(screen.getByTestId('love-type-meta').props.children.join('')).toContain('INFJ')
    expect(screen.queryByText(/세준/)).toBeNull()
    expect(screen.queryByText(/공유/)).toBeNull()
    expect(screen.queryByText(/이미지 저장/)).toBeNull()
    await fireEvent.press(screen.getByTestId('brief-more'))
    expect(mockPush).toHaveBeenCalledWith('/consent') // 동의가 로그인 앞이다
  })
})

describe('A10 약관 동의', () => {
  async function renderConsent(consent: { terms: boolean; privacy: boolean; aiUsage: boolean; marketing: boolean }, birth = ADULT_BIRTH) {
    useSessionStore.setState({ birthDate: birth, consent })
    return render(<ConsentScreen />)
  }

  it('필수 셋이 전부 체크됐을 때만 [동의하고 시작하기]가 켜진다(마케팅은 상관없다)', async () => {
    const cases: Array<[Parameters<typeof renderConsent>[0], boolean]> = [
      [{ terms: false, privacy: false, aiUsage: false, marketing: false }, true],
      [{ terms: true, privacy: false, aiUsage: false, marketing: false }, true],
      [{ terms: true, privacy: true, aiUsage: false, marketing: true }, true],
      [{ terms: true, privacy: false, aiUsage: true, marketing: true }, true],
      [{ terms: false, privacy: true, aiUsage: true, marketing: true }, true],
      [{ terms: true, privacy: true, aiUsage: true, marketing: false }, false],
      [{ terms: true, privacy: true, aiUsage: true, marketing: true }, false],
    ]
    for (const [consent, disabled] of cases) {
      const { unmount } = await renderConsent(consent)
      expect(disabledOf('consent-proceed')).toBe(disabled)
      await unmount()
    }
  })

  it('항목을 눌러 체크하다 필수가 다 차면 켜지고, 누르면 로그인(A11)으로 간다', async () => {
    await renderConsent({ terms: false, privacy: false, aiUsage: false, marketing: false })
    await fireEvent.press(screen.getByTestId('consent-terms'))
    await fireEvent.press(screen.getByTestId('consent-privacy'))
    expect(disabledOf('consent-proceed')).toBe(true)
    await fireEvent.press(screen.getByTestId('consent-ai'))
    expect(disabledOf('consent-proceed')).toBe(false)
    await fireEvent.press(screen.getByTestId('consent-proceed'))
    expect(mockPush).toHaveBeenCalledWith('/auth')
  })

  it('전체 동의는 네 항목을 한 번에 켜고 끈다', async () => {
    await renderConsent({ terms: false, privacy: false, aiUsage: false, marketing: false })
    await fireEvent.press(screen.getByTestId('consent-all'))
    expect(useSessionStore.getState().consent).toEqual({ terms: true, privacy: true, aiUsage: true, marketing: true })
    await fireEvent.press(screen.getByTestId('consent-all'))
    expect(useSessionStore.getState().consent).toEqual({ terms: false, privacy: false, aiUsage: false, marketing: false })
  })

  it('문서가 있는 ②~⑤에는 [보기]가 있고 ① 만 14세에는 없다 - [보기]는 A12 시트를 연다', async () => {
    await renderConsent({ terms: false, privacy: false, aiUsage: false, marketing: false })
    for (const id of ['consent-terms-view', 'consent-privacy-view', 'consent-ai-view', 'consent-marketing-view']) {
      expect(screen.getByTestId(id)).toBeTruthy()
    }
    expect(screen.getAllByText('보기')).toHaveLength(4)
    await fireEvent.press(screen.getByTestId('consent-ai-view'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/legal-document', params: { key: 'aiUsage' } })
  })

  it('만 14세 미만이면 A13으로 가고, 생년월일이 없으면 처음 입력으로 간다', async () => {
    await renderConsent({ terms: true, privacy: true, aiUsage: true, marketing: false }, CHILD_BIRTH)
    expect(mockReplace).toHaveBeenCalledWith('/underage')
    expect(disabledOf('consent-proceed')).toBe(true)
  })

  it('생년월일이 없으면 처음 입력으로 보낸다', async () => {
    useSessionStore.setState({ birthDate: null })
    await render(<ConsentScreen />)
    expect(mockReplace).toHaveBeenCalledWith('/basic-info')
  })
})

describe('A12 약관 전문 / A13 만 14세 미만', () => {
  it('A12는 저장소에 있는 문장을 그대로 보여준다', async () => {
    mockParams = { key: 'privacy' }
    await render(<LegalDocumentSheet />)
    expect(screen.getByTestId('legal-title').props.children).toBe(LEGAL_DOCUMENTS.privacy.title)
    for (const paragraph of LEGAL_DOCUMENTS.privacy.body) expect(screen.getByText(paragraph)).toBeTruthy()
    await fireEvent.press(screen.getByTestId('legal-confirm'))
    expect(mockBack).toHaveBeenCalled()
  })

  it('A13은 MASTER 6-3 ①의 안내를 보이고 시작 버튼이 늘 꺼져 있으며, [처음으로]는 메모리를 비운다', async () => {
    fillSession({ birthDate: CHILD_BIRTH })
    await render(<UnderageScreen />)
    expect(screen.getByText('만 14세 미만은 서비스를 이용할 수 없습니다')).toBeTruthy()
    expect(disabledOf('underage-proceed')).toBe(true)
    await fireEvent.press(screen.getByTestId('underage-restart'))
    expect(useSessionStore.getState().name).toBe('')
    expect(useSessionStore.getState().birthDate).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})

describe('동의 -> 로그인 순서 (MASTER 6-1, R24-4)', () => {
  it('동의 없이는 로그인 화면에 머물 수 없다 - 동의로 되돌린다', async () => {
    fillSession({ consent: { terms: true, privacy: false, aiUsage: true, marketing: true } })
    await render(<AuthScreen />)
    expect(mockReplace).toHaveBeenCalledWith('/consent')
    expect(mockKakao).not.toHaveBeenCalled()
  })

  it('만 14세 미만·생년월일 없음도 로그인에 못 머문다', async () => {
    fillSession({ birthDate: CHILD_BIRTH })
    const first = await render(<AuthScreen />)
    expect(mockReplace).toHaveBeenCalledWith('/consent')
    await first.unmount()
    mockReplace.mockClear()
    useSessionStore.setState({ birthDate: null })
    await render(<AuthScreen />)
    expect(mockReplace).toHaveBeenCalledWith('/consent')
  })

  it('동의가 끝났으면 머물고, 카카오만 보이며(구글·애플 숨김) 누르면 기존 카카오 로그인을 부른다', async () => {
    fillSession()
    mockKakao.mockResolvedValue({ cancelled: true })
    await render(<AuthScreen />)
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByText(/Google/)).toBeNull()
    expect(screen.queryByText(/Apple/)).toBeNull()
    await fireEvent.press(screen.getByTestId('auth-kakao'))
    expect(mockKakao).toHaveBeenCalledWith('kakao')
  })

  it('로그인 인증이 실패해도 동의와 답은 그대로 남는다', async () => {
    fillSession()
    mockKakao.mockRejectedValue(new Error('x'))
    await render(<AuthScreen />)
    await fireEvent.press(screen.getByTestId('auth-kakao'))
    expect(screen.getByTestId('auth-login-error')).toBeTruthy()
    expect(useSessionStore.getState().consent).toEqual({ terms: true, privacy: true, aiUsage: true, marketing: false })
    expect(useSessionStore.getState().name).toBe('세준')
  })
})

describe('로그인 뒤 저장', () => {
  it('세션이 없으면 저장하지 않는다', async () => {
    fillSession()
    await render(<AuthScreen />)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('동의가 빠진 채 세션이 생겨도 저장하지 않고 동의로 돌려보낸다', async () => {
    fillSession({ consent: { terms: false, privacy: false, aiUsage: false, marketing: false } })
    mockSession = { user: { id: 'u1' } }
    await render(<AuthScreen />)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/consent')
  })

  it('저장이 실패하면 넘어가지 않고 다시 시도할 수 있다 - 동의·답은 그대로', async () => {
    fillSession({ consent: { terms: true, privacy: true, aiUsage: true, marketing: true } })
    mockSession = { user: { id: 'u1' } }
    mockCreate.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({})
    await render(<AuthScreen />)
    await act(async () => {})

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ userId: 'u1', name: '세준', birthDate: ADULT_BIRTH, marketingAgreed: true })
    expect(screen.getByTestId('auth-save-error')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalledWith('/result-detail')
    expect(mockReplace).not.toHaveBeenCalledWith('/consent')
    expect(useSessionStore.getState().name).toBe('세준')
    expect(useSessionStore.getState().consent.aiUsage).toBe(true)

    await fireEvent.press(screen.getByTestId('auth-retry'))
    await act(async () => {})
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockReplace).toHaveBeenCalledWith('/result-detail')
    expect(mockReplace).not.toHaveBeenCalledWith('/consent') // 저장 뒤 메모리가 비워져도 되돌리지 않는다
    expect(useSessionStore.getState().name).toBe('')
  })
})

describe('로그인 전 서버 호출 0건 · 영속 저장소에 온보딩 답 0건', () => {
  it('A03~A13 + A12를 지나는 동안 서버 클라이언트를 한 번도 부르지 않고 AsyncStorage에 쓰지 않는다', async () => {
    // A03
    let view = await render(<BasicInfoScreen />)
    await fireEvent.changeText(screen.getByTestId('basic-name'), '세준')
    await fireEvent.press(screen.getByTestId('basic-gender-male'))
    await fireEvent.changeText(screen.getByTestId('basic-birth'), '20000101')
    await view.unmount()

    // A04~A05
    view = await render(<MbtiScreen />)
    await fireEvent.press(screen.getByTestId('mbti-known'))
    await fireEvent.press(screen.getByTestId('mbti-choose-next'))
    for (const letter of ['I', 'N', 'F', 'J']) await fireEvent.press(screen.getByTestId(`mbti-letter-${letter}`))
    await fireEvent.press(screen.getByTestId('mbti-known-next'))
    await view.unmount()

    // A07
    view = await render(<LoveQuizScreen />)
    for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByTestId('quiz-option-A'))
    await view.unmount()

    // A08
    view = await render(<ResultBriefScreen />)
    await view.unmount()

    // A10 (+ A12)
    view = await render(<ConsentScreen />)
    await fireEvent.press(screen.getByTestId('consent-all'))
    await fireEvent.press(screen.getByTestId('consent-proceed'))
    await view.unmount()
    mockParams = { key: 'aiUsage' }
    view = await render(<LegalDocumentSheet />)
    await view.unmount()

    // A13
    useSessionStore.setState({ birthDate: CHILD_BIRTH })
    view = await render(<UnderageScreen />)
    await view.unmount()

    expect(mockCalls).toEqual([])
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(multiSetSpy).not.toHaveBeenCalled()
    expect(mergeItemSpy).not.toHaveBeenCalled()
    expect(await AsyncStorage.getAllKeys()).toEqual([])
    // 답은 메모리(스토어)에만 있다.
    expect(useSessionStore.getState().mbti).toBe('INFJ')
    expect(useSessionStore.getState().consent.terms).toBe(true)
  })

  it('A01·A02(앱 첫 화면)는 기기 안 세션 복원(auth.getSession·onAuthStateChange)만 하고 데이터 호출·프로필 조회는 없다', async () => {
    jest.useFakeTimers()
    mockRealSession = true
    await render(<LogoStart />)
    await act(async () => {
      jest.advanceTimersByTime(1600)
    })
    expect(screen.getByTestId('start-button')).toBeTruthy()
    expect(screen.queryByText(/이미 계정/)).toBeNull() // 동의 없이 로그인으로 가는 길을 두지 않는다
    const allowed = new Set(['supabase.auth.getSession', 'supabase.auth.onAuthStateChange'])
    expect(mockCalls.filter((c) => !allowed.has(c))).toEqual([])
    expect(setItemSpy).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('start-button'))
    expect(mockPush).toHaveBeenCalledWith('/basic-info')
    jest.useRealTimers()
  })
})
