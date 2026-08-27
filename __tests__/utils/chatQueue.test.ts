import {
  MAX_RETRY_COUNT,
  chatQueueStorageKey,
  classifySendError,
  computeBackoffDelayMs,
  dequeueOutgoing,
  enqueueOutgoing,
  isDuplicateInsertError,
  nextRetryDelayMs,
  parseQueuedMessages,
  recordFailedRetry,
  resetForRetry,
  shouldDequeueAfterSendOutcome,
  toQueuedMessage,
  type OutgoingMessage,
  type QueuedMessage,
} from '../../src/utils/chatQueue'

const sample = (clientMsgId: string): OutgoingMessage => ({
  clientMsgId,
  coupleId: 'couple-1',
  senderId: 'user-1',
  body: 'hi',
  sentAt: '2026-08-27T00:00:00.000Z',
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

describe('classifySendError — 재시도 정책 "에러 유형별 분기"', () => {
  it('에러 코드가 없으면(네트워크 오류·타임아웃) retryable', () => {
    expect(classifySendError(null)).toBe('retryable')
    expect(classifySendError(undefined)).toBe('retryable')
    expect(classifySendError({})).toBe('retryable')
  })

  it('42501(RLS 거부)은 permanent', () => {
    expect(classifySendError({ code: '42501' })).toBe('permanent')
  })

  it('제약 위반(23xxx)은 permanent', () => {
    expect(classifySendError({ code: '23505' })).toBe('permanent')
    expect(classifySendError({ code: '23503' })).toBe('permanent')
    expect(classifySendError({ code: '23514' })).toBe('permanent')
  })

  it('연결 예외/자원부족/운영자개입(08·53·57 클래스, 5xx급 일시 장애)은 retryable', () => {
    expect(classifySendError({ code: '08006' })).toBe('retryable')
    expect(classifySendError({ code: '53300' })).toBe('retryable')
    expect(classifySendError({ code: '57014' })).toBe('retryable')
  })
})

describe('computeBackoffDelayMs / nextRetryDelayMs — 지수 백오프(2s→4s→8s→16s→32s)', () => {
  it('1~5번째 재시도 전 대기 시간이 2000/4000/8000/16000/32000ms다', () => {
    expect([1, 2, 3, 4, 5].map(computeBackoffDelayMs)).toEqual([2000, 4000, 8000, 16000, 32000])
  })

  it('동일 retryAttemptNumber는 항상 동일한 값을 반환한다(결정론)', () => {
    const results = Array.from({ length: 10 }, () => computeBackoffDelayMs(3))
    expect(new Set(results).size).toBe(1)
  })

  it('nextRetryDelayMs는 retryCount+1번째 대기 시간을 반환한다', () => {
    const item = { ...sample('a'), retryCount: 2, status: 'pending' as const }
    expect(nextRetryDelayMs(item)).toBe(computeBackoffDelayMs(3))
  })
})

describe('toQueuedMessage', () => {
  it('retryable이면 pending·retryCount 0으로 큐에 들어간다', () => {
    const item = toQueuedMessage(sample('a'), 'retryable')
    expect(item.status).toBe('pending')
    expect(item.retryCount).toBe(0)
  })

  it('permanent면(예: RLS 거부) 재시도 없이 즉시 failed', () => {
    const item = toQueuedMessage(sample('a'), 'permanent')
    expect(item.status).toBe('failed')
    expect(item.retryCount).toBe(0)
  })
})

describe('recordFailedRetry — 완료 기준 "5회 소진 후 failed로 전환, 자동 재시도 중단"', () => {
  it('permanent면 재시도 횟수와 무관하게 즉시 failed로 전환한다', () => {
    const item: QueuedMessage = { ...sample('a'), retryCount: 0, status: 'pending' }
    const next = recordFailedRetry(item, 'permanent')
    expect(next.status).toBe('failed')
    expect(next.retryCount).toBe(0) // 재시도를 소진해서가 아니라 즉시 실패이므로 카운터는 그대로다
  })

  it('retryable이면 retryCount를 1 늘리고, MAX_RETRY_COUNT 미만이면 pending을 유지한다', () => {
    const item: QueuedMessage = { ...sample('a'), retryCount: 0, status: 'pending' }
    const next = recordFailedRetry(item, 'retryable')
    expect(next.retryCount).toBe(1)
    expect(next.status).toBe('pending')
  })

  it('retryCount가 MAX_RETRY_COUNT에 도달하면 failed로 전환한다', () => {
    const item: QueuedMessage = { ...sample('a'), retryCount: MAX_RETRY_COUNT - 1, status: 'pending' }
    const next = recordFailedRetry(item, 'retryable')
    expect(next.retryCount).toBe(MAX_RETRY_COUNT)
    expect(next.status).toBe('failed')
  })
})

describe('resetForRetry — "다시 시도" 탭', () => {
  it('failed 항목의 retryCount를 0으로, status를 pending으로 되돌린다', () => {
    const item: QueuedMessage = { ...sample('a'), retryCount: MAX_RETRY_COUNT, status: 'failed' }
    const reset = resetForRetry(item)
    expect(reset.retryCount).toBe(0)
    expect(reset.status).toBe('pending')
  })
})

describe('chatQueueStorageKey', () => {
  it('coupleId별로 키를 분리한다', () => {
    expect(chatQueueStorageKey('couple-1')).toBe('chat_queue:couple-1')
    expect(chatQueueStorageKey('couple-2')).toBe('chat_queue:couple-2')
  })
})

describe('parseQueuedMessages — AsyncStorage 복원 방어', () => {
  it('정상 JSON 배열이면 그대로 복원한다', () => {
    const queued: QueuedMessage = { ...sample('a'), retryCount: 1, status: 'pending' }
    const restored = parseQueuedMessages(JSON.stringify([queued]))
    expect(restored).toEqual([queued])
  })

  it('null/빈 문자열이면 빈 큐를 반환한다', () => {
    expect(parseQueuedMessages(null)).toEqual([])
    expect(parseQueuedMessages(undefined)).toEqual([])
    expect(parseQueuedMessages('')).toEqual([])
  })

  it('JSON 파싱 자체가 깨져도 던지지 않고 빈 큐를 반환한다', () => {
    expect(parseQueuedMessages('{not valid json')).toEqual([])
  })

  it('배열이 아니거나 형식이 다른 원소는 걸러낸다', () => {
    expect(parseQueuedMessages(JSON.stringify({ not: 'an array' }))).toEqual([])
    const queued: QueuedMessage = { ...sample('a'), retryCount: 0, status: 'pending' }
    const broken = { ...queued, retryCount: 'not-a-number' }
    expect(parseQueuedMessages(JSON.stringify([queued, broken]))).toEqual([queued])
  })
})
