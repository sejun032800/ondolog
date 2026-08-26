import {
  dequeueOutgoing,
  enqueueOutgoing,
  isDuplicateInsertError,
  shouldDequeueAfterSendOutcome,
  type OutgoingMessage,
} from '../../src/utils/chatQueue'

const sample = (clientMsgId: string): OutgoingMessage => ({
  clientMsgId,
  coupleId: 'couple-1',
  senderId: 'user-1',
  body: 'hi',
})

describe('isDuplicateInsertError', () => {
  it('23505(유니크 제약 위반)면 true', () => {
    expect(isDuplicateInsertError({ code: '23505' })).toBe(true)
  })

  it('다른 코드면 false', () => {
    expect(isDuplicateInsertError({ code: '42501' })).toBe(false)
  })

  it('에러 자체가 없으면 false', () => {
    expect(isDuplicateInsertError(null)).toBe(false)
    expect(isDuplicateInsertError(undefined)).toBe(false)
  })
})

describe('shouldDequeueAfterSendOutcome', () => {
  it('sent는 큐에서 제거한다', () => {
    expect(shouldDequeueAfterSendOutcome('sent')).toBe(true)
  })

  it('already_sent(중복 판정)도 큐에서 제거한다 — 이미 성공한 것이므로', () => {
    expect(shouldDequeueAfterSendOutcome('already_sent')).toBe(true)
  })

  it('failed는 큐에 남긴다', () => {
    expect(shouldDequeueAfterSendOutcome('failed')).toBe(false)
  })
})

describe('enqueueOutgoing', () => {
  it('빈 큐에 새 항목을 추가한다', () => {
    const result = enqueueOutgoing([], sample('a'))
    expect(result).toHaveLength(1)
    expect(result[0].clientMsgId).toBe('a')
  })

  it('동일 clientMsgId는 중복 추가하지 않는다(멱등 큐잉)', () => {
    const first = enqueueOutgoing([], sample('a'))
    const second = enqueueOutgoing(first, sample('a'))
    expect(second).toHaveLength(1)
    expect(second).toBe(first) // 변경 없으면 원본 참조 그대로(불필요한 리렌더 방지)
  })

  it('다른 clientMsgId는 함께 쌓인다', () => {
    const result = enqueueOutgoing([sample('a')], sample('b'))
    expect(result.map((m) => m.clientMsgId)).toEqual(['a', 'b'])
  })
})

describe('dequeueOutgoing', () => {
  it('해당 clientMsgId 항목만 제거한다', () => {
    const queue = [sample('a'), sample('b')]
    const result = dequeueOutgoing(queue, 'a')
    expect(result.map((m) => m.clientMsgId)).toEqual(['b'])
  })

  it('없는 clientMsgId면 원본을 그대로 반환한다', () => {
    const queue = [sample('a')]
    const result = dequeueOutgoing(queue, 'z')
    expect(result).toBe(queue)
  })
})
