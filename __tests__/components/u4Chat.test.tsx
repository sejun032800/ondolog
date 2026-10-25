/**
 * U4 채팅 화면 시험 - F01 채팅 · F02 게이팅(진입 즉시 초대) · F04 첨부 · F05 보내는 중/다시 보내기.
 * 실시간·큐·스토리의 동작은 훅이 맡아 여기서는 훅을 가짜로 두고 "화면이 상태를 어떻게 그리는가"만 본다.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import ChatTab from '../../app/(tabs)/chat'
import { CoupleGate } from '../../src/components/CoupleGate'
import { Composer } from '../../src/components/chat/Composer'
import { ChatMessageItem } from '../../src/components/chat/Messages'
import { InviteSheet } from '../../src/components/couple/InviteSheet'
import type { UseRealtimeMessagesResult } from '../../src/hooks/useRealtimeMessages'
import { useCoupleStore } from '../../src/store/coupleStore'
import { nocturne } from '../../src/theme/nocturne'
import type { ChatMessage } from '../../src/utils/chatMessages'

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}))
jest.mock('../../src/services/supabase', () => ({ supabase: {} }))
jest.mock('../../src/hooks/useSession', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))
jest.mock('../../src/services/personalityApi', () => ({
  fetchProfile: async (id: string) => ({ display_name: id === 'u1' ? '세준' : '서영' }),
}))
jest.mock('../../src/hooks/useSignedMedia', () => ({ useSignedMedia: () => ({}) }))
const mockPick = jest.fn()
jest.mock('../../src/services/photoPicker', () => ({ pickPhotos: (...a: unknown[]) => mockPick(...a) }))

let mockChat: UseRealtimeMessagesResult
jest.mock('../../src/hooks/useRealtimeMessages', () => ({ useRealtimeMessages: () => mockChat }))

const mockGetOrCreate = jest.fn()
const mockRedeem = jest.fn()
jest.mock('../../src/services/coupleApi', () => ({
  getOrCreateInvite: (...a: unknown[]) => mockGetOrCreate(...a),
  redeemInviteCode: (...a: unknown[]) => mockRedeem(...a),
}))

function msg(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm',
    clientMsgId: null,
    coupleId: 'c1',
    senderId: 'u2',
    body: '안녕',
    mediaPath: null,
    sentAt: new Date(2026, 9, 20, 9, 20).toISOString(),
    readAt: null,
    ...over,
  }
}

function chatState(over: Partial<UseRealtimeMessagesResult> = {}): UseRealtimeMessagesResult {
  return {
    messages: [],
    loading: false,
    sendText: jest.fn(async () => {}),
    retryFailed: jest.fn(),
    cancelPending: jest.fn(),
    hasQueued: false,
    sendPhoto: jest.fn(async () => {}),
    stories: [],
    storiesLoading: false,
    postStory: jest.fn(async () => true),
    ...over,
  }
}

function flat(node: { props: { style?: unknown } }) {
  return StyleSheet.flatten(node.props.style as never) as Record<string, unknown>
}

beforeEach(() => {
  mockPush.mockClear()
  mockPick.mockReset()
  mockGetOrCreate.mockReset()
  mockRedeem.mockReset()
  mockChat = chatState()
  useCoupleStore.setState({
    status: 'unknown',
    coupleId: null,
    partnerId: null,
    nickname: null,
    relationshipStartDate: null,
    refresh: async () => {},
  })
})

function connect() {
  useCoupleStore.setState({
    status: 'connected',
    coupleId: 'c1',
    partnerId: 'u2',
    relationshipStartDate: '2025-12-28',
    refresh: async () => {},
  })
}

describe('F02 게이팅 - 채팅은 진입 즉시 초대', () => {
  it('연결 여부가 정해지기 전에는 시트도 본문도 띄우지 않는다', async () => {
    await render(
      <CoupleGate autoOpenInvite inviteFrom="chat">
        <Text>본문</Text>
      </CoupleGate>,
    )
    expect(screen.queryByText('본문')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('미연결로 정해지면 초대 시트로 곧바로 간다(채팅 문구 출처 포함)', async () => {
    useCoupleStore.setState({ status: 'disconnected', refresh: async () => {} })
    await render(
      <CoupleGate autoOpenInvite inviteFrom="chat" fallback={<Text>뒤</Text>}>
        <Text>본문</Text>
      </CoupleGate>,
    )
    expect(mockPush).toHaveBeenCalledWith('/couple-gate?from=chat')
    expect(screen.queryByText('본문')).toBeNull()
    expect(screen.getByText('뒤')).toBeTruthy()
  })

  it('연결되면 본문을 보이고 시트를 열지 않는다', async () => {
    connect()
    await render(
      <CoupleGate autoOpenInvite inviteFrom="chat">
        <Text>본문</Text>
      </CoupleGate>,
    )
    expect(screen.getByText('본문')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('버튼 방식(탭 안 잠긴 카드)은 누르면 시트로 간다 - 진입 즉시가 아니다', async () => {
    useCoupleStore.setState({ status: 'disconnected', refresh: async () => {} })
    await render(
      <CoupleGate>
        <Text>본문</Text>
      </CoupleGate>,
    )
    expect(mockPush).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByText('초대하기'))
    expect(mockPush).toHaveBeenCalledWith('/couple-gate')
  })

  it('채팅 탭: 미연결이면 "채팅" 머리만 비치고 대화 화면은 없다', async () => {
    useCoupleStore.setState({ status: 'disconnected', refresh: async () => {} })
    await render(<ChatTab />)
    expect(screen.getByTestId('chat-disconnected')).toBeTruthy()
    expect(screen.queryByTestId('chat-composer')).toBeNull()
    expect(mockPush).toHaveBeenCalledWith('/couple-gate?from=chat')
  })
})

describe('F02 초대 시트', () => {
  it('채팅에서 열면 안내 한 줄뿐이고 코드 보내기·받은 코드 입력하기가 있다', async () => {
    await render(<InviteSheet userId="u1" fromChat onClose={() => {}} onConnected={() => {}} />)
    expect(screen.getByText('상대만 있으면 돼요')).toBeTruthy()
    expect(screen.getByText('채팅은 연인과 연결되면 열려요.')).toBeTruthy()
    expect(screen.getByText('초대 코드 보내기')).toBeTruthy()
    expect(screen.getByText('받은 코드 입력하기')).toBeTruthy()
  })

  it('초대 코드 보내기 -> 기존 발급 함수를 부르고 코드를 보여 준다', async () => {
    mockGetOrCreate.mockResolvedValue({ status: 'pending', couple: { invite_code: 'K7Q2MX' } })
    await render(<InviteSheet userId="u1" onClose={() => {}} onConnected={() => {}} />)
    await fireEvent.press(screen.getByTestId('invite-send'))
    await act(async () => {})
    expect(mockGetOrCreate).toHaveBeenCalledWith('u1')
    expect(screen.getByTestId('invite-code').props.children).toBe('K7Q2MX')
  })

  it('받은 코드 입력 -> 기존 입력 함수로 연결하면 연결 콜백이 불린다', async () => {
    mockRedeem.mockResolvedValue({ id: 'couple' })
    const onConnected = jest.fn()
    await render(<InviteSheet userId="u1" onClose={() => {}} onConnected={onConnected} />)
    await fireEvent.press(screen.getByTestId('invite-enter'))
    await fireEvent.changeText(screen.getByTestId('invite-input'), 'p4n8xx')
    await fireEvent.press(screen.getByTestId('invite-connect'))
    await act(async () => {})
    expect(mockRedeem).toHaveBeenCalledWith('u1', 'P4N8XX')
    expect(onConnected).toHaveBeenCalled()
  })

  it('쓸 수 없는 코드면 시트 안에 이유를 적는다', async () => {
    mockRedeem.mockResolvedValue(null)
    await render(<InviteSheet userId="u1" onClose={() => {}} onConnected={() => {}} />)
    await fireEvent.press(screen.getByTestId('invite-enter'))
    await fireEvent.changeText(screen.getByTestId('invite-input'), 'ZZZZZZ')
    await fireEvent.press(screen.getByTestId('invite-connect'))
    await act(async () => {})
    expect(screen.getByTestId('invite-error')).toBeTruthy()
  })
})

describe('F05 보내는 중 · 다시 보내기 - 정지 표시, 스피너 없음', () => {
  const props = {
    isMine: true,
    senderName: '세준',
    photoUri: undefined,
    onRetry: jest.fn(),
    onCancel: jest.fn(),
    onOpenPhoto: jest.fn(),
  }

  it('보내는 중: 글자 "보내는 중" + 말풍선 흐리게, 스피너 없음', async () => {
    await render(
      <ChatMessageItem {...props} message={msg({ senderId: 'u1', body: '저녁 뭐 먹을까', clientMsgId: 'a', pending: true })} />,
    )
    expect(screen.getByText('보내는 중')).toBeTruthy()
    expect(screen.queryByText('다시 보내기')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(flat(screen.getByText('저녁 뭐 먹을까').parent as never).opacity).toBe(0.55)
  })

  it('실패: "다시 보내기" 버튼을 누르면 그 메시지로 다시 보낸다', async () => {
    const onRetry = jest.fn()
    await render(
      <ChatMessageItem {...props} onRetry={onRetry} message={msg({ senderId: 'u1', body: '떡볶이 어때', clientMsgId: 'b', failed: true })} />,
    )
    await fireEvent.press(screen.getByTestId('chat-retry'))
    expect(onRetry).toHaveBeenCalledWith('b')
    expect(screen.queryByText('보내는 중')).toBeNull()
  })

  it('길게 누르면 보내기 취소(기존 동작)', async () => {
    const onCancel = jest.fn()
    await render(
      <ChatMessageItem {...props} onCancel={onCancel} message={msg({ senderId: 'u1', body: '취소할 글', clientMsgId: 'c', pending: true })} />,
    )
    await fireEvent(screen.getByText('취소할 글'), 'longPress')
    expect(onCancel).toHaveBeenCalledWith('c')
  })

  it('보낸 뒤: 내 메시지는 상대가 안 읽었을 때만 숫자 1(rose), 읽으면 사라진다. 상대 메시지엔 없다', async () => {
    await render(<ChatMessageItem {...props} message={msg({ senderId: 'u1', body: '안 읽음', readAt: null })} />)
    expect(screen.getByTestId('chat-unread')).toBeTruthy()
    expect(flat(screen.getByTestId('chat-unread')).color).toBe(nocturne.rose)
  })

  it('읽은 내 메시지에는 1이 없다', async () => {
    await render(<ChatMessageItem {...props} message={msg({ senderId: 'u1', body: '읽음', readAt: '2026-10-20T00:01:00Z' })} />)
    expect(screen.queryByTestId('chat-unread')).toBeNull()
  })

  it('상대 메시지에는 1이 없다', async () => {
    await render(<ChatMessageItem {...props} isMine={false} message={msg({ body: '상대 말' })} />)
    expect(screen.queryByTestId('chat-unread')).toBeNull()
  })

  it('말풍선 색: 내 것은 text 면 + ink 글자, 상대 것은 inkRaise2 면 + text 글자(Pretendard)', async () => {
    await render(
      <>
        <ChatMessageItem {...props} message={msg({ senderId: 'u1', body: '내 말' })} />
        <ChatMessageItem {...props} isMine={false} message={msg({ body: '상대 말' })} />
      </>,
    )
    expect(flat(screen.getByText('내 말')).color).toBe(nocturne.ink)
    expect(flat(screen.getByText('내 말').parent as never).backgroundColor).toBe(nocturne.text)
    expect(flat(screen.getByText('상대 말')).color).toBe(nocturne.text)
    expect(flat(screen.getByText('상대 말').parent as never).backgroundColor).toBe(nocturne.inkRaise2)
    expect(flat(screen.getByText('내 말')).fontFamily).toBe('Pretendard-Regular')
  })

  it('사진 메시지: 서버에 올라간 사진은 눌러 크게 보고, 올리는 중인 사진은 "보내는 중"', async () => {
    const onOpenPhoto = jest.fn()
    await render(
      <>
        <ChatMessageItem {...props} onOpenPhoto={onOpenPhoto} message={msg({ id: 'p1', mediaPath: 'c1/p1.jpg', body: null })} photoUri="https://example.invalid/p1" />
        <ChatMessageItem {...props} message={msg({ id: 'local:q', clientMsgId: 'q', senderId: 'u1', body: null, localUri: 'file:///q.jpg', pending: true })} />
      </>,
    )
    await fireEvent.press(screen.getByTestId('chat-photo'))
    expect(onOpenPhoto).toHaveBeenCalledTimes(1)
    expect(screen.getByText('보내는 중')).toBeTruthy()
  })
})

describe('F01 채팅 화면', () => {
  beforeEach(() => connect())

  it('상대 이름 · D+N(KST) · 스토리 줄 · 날짜 구분 · 말풍선 · 입력창', async () => {
    mockChat = chatState({
      messages: [
        msg({ id: 'a', body: '오늘 비 온대. 우산 챙겼어?' }),
        msg({ id: 'b', senderId: 'u1', body: '응 챙겼어', sentAt: new Date(2026, 9, 20, 9, 21).toISOString() }),
      ],
    })
    await render(<ChatTab />)
    await act(async () => {})
    expect(screen.getByText('서영')).toBeTruthy()
    expect(screen.getByTestId('chat-days').props.children).toMatch(/^D\+\d+$/)
    expect(screen.getByTestId('chat-story-add')).toBeTruthy()
    expect(screen.getByText('10월 20일 화요일')).toBeTruthy()
    expect(screen.getByText('오늘 비 온대. 우산 챙겼어?')).toBeTruthy()
    expect(screen.getByTestId('chat-composer')).toBeTruthy()
  })

  it('불러오는 중에는 스피너 대신 뼈대', async () => {
    mockChat = chatState({ loading: true })
    await render(<ChatTab />)
    expect(screen.getByTestId('chat-loading')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('다시 보낼 메시지가 큐에 남아 있으면 연결 끊김 안내가 보이고, 없으면 없다', async () => {
    mockChat = chatState({ messages: [msg({ id: 'x', senderId: 'u1', clientMsgId: 'x', pending: true })], hasQueued: true })
    await render(<ChatTab />)
    expect(screen.getByTestId('chat-offline-banner')).toBeTruthy()
  })

  it('큐가 비면 안내가 없다', async () => {
    mockChat = chatState({ messages: [msg({ id: 'y' })], hasQueued: false })
    await render(<ChatTab />)
    expect(screen.queryByTestId('chat-offline-banner')).toBeNull()
  })

  it('메시지가 없으면 첫 마디를 권한다(공유 카드·잡지 예고 문구는 없다)', async () => {
    await render(<ChatTab />)
    expect(screen.getByText('첫 마디를 남겨보세요')).toBeTruthy()
  })

  it('보내기: 공백뿐이면 비활성이라 훅을 부르지 않고, 글자가 있으면 보낸다', async () => {
    const sendText = jest.fn(async () => {})
    mockChat = chatState({ sendText })
    await render(<ChatTab />)
    await fireEvent.changeText(screen.getByTestId('chat-input'), '   ')
    await fireEvent.press(screen.getByTestId('chat-send'))
    expect(sendText).not.toHaveBeenCalled()
    await fireEvent.changeText(screen.getByTestId('chat-input'), '점심 먹었어?')
    await fireEvent.press(screen.getByTestId('chat-send'))
    expect(sendText).toHaveBeenCalledWith('점심 먹었어?')
  })

  it('F04 첨부: + -> 시트 -> 앨범 -> 고른 사진을 한 장씩 보낸다(시스템 선택기)', async () => {
    const sendPhoto = jest.fn(async () => {})
    mockChat = chatState({ sendPhoto })
    mockPick.mockResolvedValue([{ uri: 'file:///a.jpg', ext: 'jpg' }, { uri: 'file:///b.jpg', ext: 'jpg' }])
    await render(<ChatTab />)
    expect(screen.queryByTestId('chat-attach-sheet')).toBeNull()
    await fireEvent.press(screen.getByTestId('chat-attach'))
    expect(screen.getByTestId('chat-attach-sheet')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('chat-attach-album'))
    await act(async () => {})
    expect(mockPick).toHaveBeenCalledTimes(1)
    expect(sendPhoto).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('chat-attach-sheet')).toBeNull()
  })

  it('스토리 올리기: 한 장 고르면 바로 올린다(편집 화면 없음)', async () => {
    const postStory = jest.fn(async () => true)
    mockChat = chatState({ postStory })
    mockPick.mockResolvedValue([{ uri: 'file:///s.jpg', ext: 'jpg' }])
    await render(<ChatTab />)
    await fireEvent.press(screen.getByTestId('chat-story-add'))
    await act(async () => {})
    expect(mockPick).toHaveBeenCalledWith(1)
    expect(postStory).toHaveBeenCalledTimes(1)
  })

  it('사진 메시지를 누르면 사진 크게 보기 시트로 간다', async () => {
    mockChat = chatState({ messages: [msg({ id: 'p', mediaPath: 'c1/p.jpg', body: null })] })
    await render(<ChatTab />)
    await fireEvent.press(screen.getByTestId('chat-photo'))
    expect(mockPush).toHaveBeenCalledWith('/photo-viewer')
  })
})

describe('입력창', () => {
  it('공백뿐이면 보내기가 비활성(접근성 상태)이다', async () => {
    const onSend = jest.fn()
    await render(<Composer onSend={onSend} onAttach={() => {}} bottomOffset={0} />)
    expect(screen.getByTestId('chat-send').props.accessibilityState.disabled).toBe(true)
    await fireEvent.changeText(screen.getByTestId('chat-input'), '안녕')
    expect(screen.getByTestId('chat-send').props.accessibilityState.disabled).toBe(false)
  })
})
