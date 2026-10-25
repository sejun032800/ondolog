/**
 * U4 채팅 - 보내기 막음 규칙(R21-5) 한 함수, 날짜·시각 글자, 사진 말풍선이 텍스트 큐 동기화에서 지워지지 않는 것.
 */
import {
  canSendBody,
  chatDateLabel,
  chatTimeLabel,
  isBlankBody,
  photoStampLabel,
  relativeAgeLabel,
  syncQueuedMessages,
  type ChatMessage,
} from '../../src/utils/chatMessages'

describe('보내기 막음 규칙 - 비었거나 공백뿐인 본문', () => {
  it('빈 값·null·undefined·공백뿐(전각 공백·개행 포함)은 빈 본문이다', () => {
    for (const body of ['', '   ', '\n\t ', '　', null, undefined]) {
      expect(isBlankBody(body)).toBe(true)
      expect(canSendBody(body)).toBe(false)
    }
  })

  it('글자가 하나라도 있으면 보낼 수 있다(앞뒤 공백은 상관없다)', () => {
    expect(canSendBody('안녕')).toBe(true)
    expect(canSendBody('  안녕 ')).toBe(true)
    expect(canSendBody('ㅋ')).toBe(true)
  })

  it('사진이 있으면 본문이 비어도 보낼 수 있다', () => {
    expect(canSendBody('', true)).toBe(true)
    expect(canSendBody(null, true)).toBe(true)
  })
})

describe('날짜·시각 글자', () => {
  it('날짜 구분선: 올해는 "10월 20일 화요일", 다른 해는 연도가 붙는다', () => {
    expect(chatDateLabel('2026-10-20', 2026)).toBe('10월 20일 화요일')
    expect(chatDateLabel('2025-10-20', 2026)).toBe('2025년 10월 20일 월요일')
  })

  it('시각은 24시간 "09:20"(기기 로컬)', () => {
    const d = new Date(2026, 9, 20, 9, 20)
    expect(chatTimeLabel(d.toISOString())).toBe('09:20')
    expect(photoStampLabel(new Date(2026, 9, 20, 12, 34).toISOString())).toBe('10월 20일 12:34')
  })

  it('스토리 나이: 방금 / N분 전 / N시간 전', () => {
    const now = new Date('2026-10-20T12:00:00Z')
    expect(relativeAgeLabel('2026-10-20T11:59:40Z', now)).toBe('방금')
    expect(relativeAgeLabel('2026-10-20T11:15:00Z', now)).toBe('45분 전')
    expect(relativeAgeLabel('2026-10-20T09:00:00Z', now)).toBe('3시간 전')
  })
})

function message(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'x',
    clientMsgId: null,
    coupleId: 'c',
    senderId: 'u',
    body: null,
    mediaPath: null,
    sentAt: '2026-10-20T00:00:00Z',
    readAt: null,
    ...over,
  }
}

describe('텍스트 큐 동기화는 사진 보내기 작업(이 세션 메모리)을 지우지 않는다', () => {
  it('큐에 없는 보내는 중 텍스트는 지워지고(취소), localUri가 있는 사진은 남는다', () => {
    const list = [
      message({ id: 'local:a', clientMsgId: 'a', body: '취소된 글', pending: true }),
      message({ id: 'local:p', clientMsgId: 'p', localUri: 'file:///x.jpg', pending: true }),
    ]
    const synced = syncQueuedMessages(list, [])
    expect(synced.map((m) => m.id)).toEqual(['local:p'])
  })
})
