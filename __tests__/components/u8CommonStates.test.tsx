/**
 * 공통 상태 I01 · I02 · I04 · I05(틀) · I06 · H19 시험 (`72-`) - 렌더 · 누름 · 결과를 본다(파일 내용 비교 없음).
 * 확인어(`해제합니다` · `탈퇴합니다`)와 두 화면의 확인 동작은 `u7Dissolution.test.tsx`가 본다.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'
import SettingsAboutScreen from '../../app/settings-about'
import { CoupleGate, GATE_COPY } from '../../src/components/CoupleGate'
import { InviteSheet, INVITE_COPY } from '../../src/components/couple/InviteSheet'
import { ConnectionBanner, CONNECTION_COPY } from '../../src/components/nocturne/ConnectionBanner'
import { EmptyState } from '../../src/components/nocturne/EmptyState'
import { PhraseConfirm } from '../../src/components/nocturne/PhraseConfirm'
import { ToastHost } from '../../src/components/nocturne/Toast'
import { MESSAGE_COPY } from '../../src/components/chat/Messages'
import { START_TEMPERATURE_HINT_LINES } from '../../src/constants/mainCopy'
import { SUPPORT_EMAIL, SUPPORT_MAIL_SUBJECT } from '../../src/constants/support'
import { connectErrorMessage } from '../../src/services/coupleConnectCore'
import { isNetworkFailure, trackConnection, useConnectionStore } from '../../src/services/connectionMonitor'
import { useCoupleStore } from '../../src/store/coupleStore'
import { showToast, TOAST_DURATION_MS, useToastStore } from '../../src/store/toastStore'
import { SETTINGS_GROUPS } from '../../src/utils/settingsRules'
import { nameWithSubject } from '../../src/utils/dissolution'
import { buildSupportMailto } from '../../src/utils/supportMail'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }))
jest.mock('../../src/services/supabase', () => ({ supabase: {} }))
jest.mock('../../src/services/coupleApi', () => ({ getOrCreateInvite: jest.fn(), redeemInviteCode: jest.fn() }))

// 채팅 큐 허브 - 큐 변화를 시험이 직접 보낸다.
let mockQueueListener: { onTextQueue?: (q: unknown[]) => void; onPhotoQueue?: (q: unknown[]) => void } | null = null
jest.mock('../../src/services/chatQueueHub', () => ({
  chatQueueHub: {
    subscribe: (listener: typeof mockQueueListener) => {
      mockQueueListener = listener
      return () => {
        mockQueueListener = null
      }
    },
  },
}))

// 계정 · 커플 값 - H19 문의 메일에 새어 나가면 안 된다.
const ACCOUNT = { id: 'acct-9f3c-secret-id', email: 'someone.private@example.com', name: '비밀이름' }
jest.mock('../../src/hooks/useSession', () => ({
  useSession: () => ({
    session: { user: { id: 'acct-9f3c-secret-id', email: 'someone.private@example.com' } },
    loading: false,
  }),
}))

beforeEach(() => {
  mockPush.mockClear()
  mockBack.mockClear()
  mockQueueListener = null
  useConnectionStore.setState({ offline: false })
  useToastStore.setState({ toast: null, hostStack: [] })
  useCoupleStore.setState({ status: 'unknown', coupleId: null })
})

// ── I01 커플 게이트 ──

describe('I01 커플 게이트', () => {
  it('미연결이면 I01 문구와 두 버튼이 보이고, 누르면 초대로 안내한다', async () => {
    useCoupleStore.setState({ status: 'disconnected', coupleId: null })
    await render(<CoupleGate>{null}</CoupleGate>)
    expect(screen.getByText('여기까지 왔어요. 상대만 있으면 돼요')).toBeTruthy()
    expect(screen.getByText('두 사람의 기록을 한 타임라인으로 보려면 연인과 연결해요.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled() // 진입만으로는 막지 않는다 - 누르는 순간 안내
    await fireEvent.press(screen.getByText(GATE_COPY.invite))
    expect(mockPush).toHaveBeenLastCalledWith('/couple-gate?from=gate')
    await fireEvent.press(screen.getByText(GATE_COPY.enter))
    expect(mockPush).toHaveBeenLastCalledWith('/couple-gate?from=gate&step=enter')
  })

  it('연결돼 있거나 아직 정해지기 전에는 게이트를 그리지 않는다', async () => {
    await render(<CoupleGate>{null}</CoupleGate>)
    expect(screen.queryByTestId('couple-gate')).toBeNull()
    await act(async () => useCoupleStore.setState({ status: 'connected', coupleId: 'c1' }))
    expect(screen.queryByTestId('couple-gate')).toBeNull()
  })

  it('초대 시트: I01에서 열면 I01 문구, [받은 코드 입력하기]에서 열면 바로 코드 입력 단계', async () => {
    const first = await render(<InviteSheet userId="u1" fromGate onClose={() => {}} onConnected={() => {}} />)
    expect(screen.getByText(INVITE_COPY.titleGate)).toBeTruthy()
    expect(screen.getByText(INVITE_COPY.bodyGate)).toBeTruthy()
    await first.unmount()
    await render(<InviteSheet userId="u1" fromGate initialStep="enter" onClose={() => {}} onConnected={() => {}} />)
    expect(screen.queryByTestId('invite-send')).toBeNull()
    expect(screen.getByPlaceholderText(INVITE_COPY.codePlaceholder)).toBeTruthy()
  })
})

// ── I02 연결 끊김 ──

describe('I02 연결 끊김 판정 - 요청 실패', () => {
  it('네트워크 오류로 던지면 끊김, 응답이 오면(5xx도) 풀린다. 중단(AbortError)은 끊김이 아니다', async () => {
    const fail = trackConnection((async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch)
    await expect(fail('x')).rejects.toThrow('Network request failed')
    expect(useConnectionStore.getState().offline).toBe(true)

    const server500 = trackConnection((async () => ({ ok: false, status: 500 }) as Response) as unknown as typeof fetch)
    await server500('x')
    expect(useConnectionStore.getState().offline).toBe(false)

    useConnectionStore.setState({ offline: true })
    const aborted = trackConnection((async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    }) as unknown as typeof fetch)
    await expect(aborted('x')).rejects.toThrow('aborted')
    expect(useConnectionStore.getState().offline).toBe(true) // 건드리지 않는다

    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkFailure(new Error('boom'))).toBe(false)
    expect(isNetworkFailure(null)).toBe(false)
  })

  it('끊기면 띠가 보이고, 풀리면 사라진다', async () => {
    await render(<ConnectionBanner />)
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    await act(async () => useConnectionStore.getState().report(false))
    expect(screen.getByText(CONNECTION_COPY.offline)).toBeTruthy()
    await act(async () => useConnectionStore.getState().report(true))
    expect(screen.queryByTestId('connection-banner')).toBeNull()
  })

  it('채팅에 보낼 것이 남아 있으면 띠를 그리지 않는다 - 채팅의 큐 문장과 겹치지 않는다', async () => {
    await render(<ConnectionBanner />)
    await act(async () => useConnectionStore.getState().report(false))
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    await act(async () => mockQueueListener?.onTextQueue?.([{ status: 'pending' }]))
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    await act(async () => mockQueueListener?.onTextQueue?.([]))
    await act(async () => mockQueueListener?.onPhotoQueue?.([{ status: 'pending' }]))
    expect(screen.queryByTestId('connection-banner')).toBeNull()
    await act(async () => mockQueueListener?.onPhotoQueue?.([{ status: 'failed' }])) // 자동 재시도가 끝난 것은 큐 문장이 말하지 않는다
    expect(screen.getByTestId('connection-banner')).toBeTruthy()
    // 두 문장은 서로 다른 말이다(받은 것 / 보낼 것).
    expect(CONNECTION_COPY.offline).not.toBe(MESSAGE_COPY.offline)
    expect(CONNECTION_COPY.offline).not.toContain('이어서 보내요')
  })
})

// ── I05 틀 ──

describe('I05 문구 입력 틀', () => {
  it('확인어가 정확히 맞을 때만 요청 버튼이 켜지고, 다른 확인어로는 안 켜진다', async () => {
    const onSubmit = jest.fn()
    await render(
      <PhraseConfirm
        title="t"
        onBack={() => {}}
        heading="h"
        pdfLabel="발행된 호 PDF로 받아두기"
        onOpenPdf={() => {}}
        phrase="해제합니다"
        phraseLabel="l"
        submitLabel="해제 요청하기"
        onSubmit={onSubmit}
        busy={false}
        error={null}
        testIDPrefix="p"
      >
        {null}
      </PhraseConfirm>,
    )
    for (const wrong of ['탈퇴합니다', '', '해제합니다!']) {
      await fireEvent.changeText(screen.getByTestId('p-phrase-input'), wrong)
      await fireEvent.press(screen.getByTestId('p-submit'))
    }
    expect(onSubmit).not.toHaveBeenCalled()
    await fireEvent.changeText(screen.getByTestId('p-phrase-input'), '해제합니다')
    await fireEvent.press(screen.getByTestId('p-submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

// ── I04 빈 상태 ──

describe('I04 빈 상태', () => {
  it('제목 · 보조 문장 · 주 버튼이 보이고 누르면 동작한다', async () => {
    const onAction = jest.fn()
    await render(
      <EmptyState title="기록을 남기면 여기에 쌓여요" body={'한 줄\n두 줄'} actionLabel="첫 기록 남기기" onAction={onAction} testID="e" />,
    )
    expect(screen.getByText('기록을 남기면 여기에 쌓여요')).toBeTruthy()
    await fireEvent.press(screen.getByText('첫 기록 남기기'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})

// ── I06 토스트 ──

describe('I06 토스트', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('한 줄 알림이 뜨고, 정해진 시간이 지나면 사라진다', async () => {
    await render(<ToastHost />)
    expect(screen.queryByTestId('toast')).toBeNull()
    await act(async () => showToast('기록을 남겼어요'))
    expect(screen.getByTestId('toast-message').props.children).toBe('기록을 남겼어요')
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS - 1))
    expect(screen.getByTestId('toast')).toBeTruthy()
    await act(async () => jest.advanceTimersByTime(2))
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('글자 버튼을 누르면 동작하고 닫힌다. 새 알림은 이전 것을 바꾸고 시간을 새로 센다', async () => {
    const onPress = jest.fn()
    await render(<ToastHost />)
    await act(async () => showToast('기록을 남겼어요', { label: '보기', onPress }))
    await fireEvent.press(screen.getByTestId('toast-action'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('toast')).toBeNull()

    await act(async () => showToast('첫째'))
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS - 100))
    await act(async () => showToast('둘째'))
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS - 100))
    expect(screen.getByTestId('toast-message').props.children).toBe('둘째')
  })

  it('토스트 자리가 여럿 붙어 있어도(루트 + 모달) 하나만 그린다', async () => {
    await render(
      <>
        <ToastHost />
        <ToastHost aboveTabBar={false} />
      </>,
    )
    await act(async () => showToast('한 번만'))
    expect(screen.getAllByTestId('toast')).toHaveLength(1)
  })
})

// ── H19 앱 정보 · 문의 ──

describe('H19 앱 정보 · 문의', () => {
  let openURL: jest.SpyInstance

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never)
    useCoupleStore.setState({ status: 'connected', coupleId: 'couple-77-secret' })
  })
  afterEach(() => openURL.mockRestore())

  function parseMailto(url: string) {
    expect(url.startsWith('mailto:')).toBe(true)
    const [address, query] = url.slice('mailto:'.length).split('?')
    const params: Record<string, string> = {}
    for (const pair of query.split('&')) {
      const [k, v] = pair.split('=')
      params[k] = decodeURIComponent(v)
    }
    return { address, subject: params.subject, body: params.body }
  }

  it('버전을 그대로 보이고 "최신"은 없다. 오픈소스 항목도 없다', async () => {
    await render(<SettingsAboutScreen />)
    expect(screen.getByTestId('about-version').props.children).toBe('버전 1.0.0')
    expect(screen.queryByText(/최신/)).toBeNull()
    expect(screen.queryByText(/오픈소스/)).toBeNull()
    expect(screen.getByText('문의하기')).toBeTruthy()
    expect(screen.getByText('이용약관')).toBeTruthy()
    expect(screen.getByText('개인정보 처리방침')).toBeTruthy()
  })

  it('문의하기는 mailto: - 주소 = SUPPORT_EMAIL, 제목, 본문 머리 세 줄. 계정 id · 이메일 · 이름 · 커플 id는 없다', async () => {
    await render(<SettingsAboutScreen />)
    await fireEvent.press(screen.getByTestId('about-inquiry'))
    expect(openURL).toHaveBeenCalledTimes(1)
    const url = openURL.mock.calls[0][0] as string
    const { address, subject, body } = parseMailto(url)
    expect(address).toBe(SUPPORT_EMAIL)
    expect(SUPPORT_EMAIL).toBe('TODO_SUPPORT_EMAIL') // 자리표시자 - 운영 주소는 Proteur가 넣는다
    expect(subject).toBe('[온도록 문의]')
    expect(subject).toBe(SUPPORT_MAIL_SUBJECT)
    const head = body.split('\n').slice(0, 3)
    expect(head[0]).toBe('앱 버전: 1.0.0')
    expect(head[1]).toMatch(/^OS: (iOS|Android)/)
    expect(head[1]).toContain(String(Platform.Version))
    expect(head[2]).toBe('발행물 정정 요청이면 몇 월호 몇 쪽인지 적어 주세요.')
    for (const secret of [ACCOUNT.id, ACCOUNT.email, ACCOUNT.name, 'couple-77-secret', 'someone.private']) {
      expect(decodeURIComponent(url)).not.toContain(secret)
    }
  })

  it('메일 앱을 열 수 없으면 토스트로 주소를 안내한다', async () => {
    openURL.mockRejectedValueOnce(new Error('no mail app'))
    await render(
      <>
        <SettingsAboutScreen />
        <ToastHost />
      </>,
    )
    await fireEvent.press(screen.getByTestId('about-inquiry'))
    await act(async () => {})
    expect(screen.getByTestId('toast-message').props.children).toContain(SUPPORT_EMAIL)
  })

  it('이용약관 · 개인정보 처리방침은 온보딩 동의와 같은 약관 전문 시트를 연다', async () => {
    await render(<SettingsAboutScreen />)
    await fireEvent.press(screen.getByTestId('about-terms'))
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/legal-document', params: { key: 'terms' } })
    await fireEvent.press(screen.getByTestId('about-privacy'))
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/legal-document', params: { key: 'privacy' } })
  })

  it('버전을 읽지 못하면 본문에 "알 수 없음"이고 다른 값은 넣지 않는다', () => {
    const url = buildSupportMailto({ appVersion: null, os: 'android', osVersion: 34 })
    const { body } = parseMailto(url)
    expect(body.split('\n').slice(0, 2)).toEqual(['앱 버전: 알 수 없음', 'OS: Android API 34'])
  })

  it('H01 설정 목록에 H19 항목이 있다', () => {
    const labels = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => `${i.key}:${i.label}:${i.href}`))
    expect(labels).toContain('about:앱 정보 · 문의:/settings-about')
  })
})

// ── 문장 ──

describe('해요체 문장', () => {
  it('B01 보조 문구는 patch8의 해요체 두 줄이다', () => {
    expect(START_TEMPERATURE_HINT_LINES).toEqual([
      '온도가 잘 맞는 유형일수록 시작 온도가 조금 높아요.',
      '나머지는 두 사람이 만들어가요.',
    ])
  })

  it('A18 자기 코드 오류는 patch7 보드 문구다', () => {
    expect(connectErrorMessage({ code: '22023' })).toBe('내가 만든 코드는 쓸 수 없어요. 상대의 코드를 입력해 주세요.')
  })

  it('H14 상대 쪽 주어: 받침이 있으면 "이", 없으면 "가"', () => {
    expect(nameWithSubject('세준')).toBe('세준이')
    expect(nameWithSubject('서영')).toBe('서영이')
    expect(nameWithSubject('지우')).toBe('지우가')
    expect(nameWithSubject('Sam')).toBe('Sam님이')
  })
})
