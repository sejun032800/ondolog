/**
 * 사진 영속 큐의 순수 규칙 + 러너(R37-2): 파싱 · 백오프 · 취소 · 앱 재시작(모듈 다시 불러오기) 뒤 이어 보내기.
 */
import {
  classifyUploadError,
  parseQueuedPhotos,
  recordPhotoFailure,
  restoreForStart,
  syncPhotoMessages,
  type QueuedPhoto,
} from '../../src/utils/chatPhotoQueue'
import { ChatPhotoQueue, type ChatPhotoQueueDeps } from '../../src/utils/chatPhotoQueueRunner'
import { MAX_RETRY_COUNT } from '../../src/utils/chatQueue'

function photo(over: Partial<QueuedPhoto> = {}): QueuedPhoto {
  return {
    clientId: 'c1',
    kind: 'message',
    coupleId: 'cp',
    userId: 'u1',
    localUri: 'file:///docs/c1.jpg',
    ext: 'jpg',
    contentType: 'image/jpeg',
    sentAt: '2026-10-25T01:00:00.000Z',
    retryCount: 0,
    status: 'pending',
    ...over,
  }
}

describe('순수 규칙', () => {
  it('깨진 저장 원문은 빈 큐로, 모양이 맞는 항목만 되살린다', () => {
    expect(parseQueuedPhotos(null)).toEqual([])
    expect(parseQueuedPhotos('{not json')).toEqual([])
    expect(parseQueuedPhotos('{"a":1}')).toEqual([])
    expect(parseQueuedPhotos(JSON.stringify([photo(), { clientId: 'x' }]))).toEqual([photo()])
  })

  it('일시 실패는 횟수를 올려 5회에서 failed, 영구 실패는 즉시 failed', () => {
    let item = photo()
    for (let i = 1; i < MAX_RETRY_COUNT; i++) {
      item = recordPhotoFailure(item, 'retryable')
      expect(item).toMatchObject({ retryCount: i, status: 'pending' })
    }
    expect(recordPhotoFailure(item, 'retryable')).toMatchObject({ retryCount: MAX_RETRY_COUNT, status: 'failed' })
    expect(recordPhotoFailure(photo(), 'permanent')).toMatchObject({ retryCount: 0, status: 'failed' })
  })

  it('앱을 열 때 멈춰 있던 스토리는 다시 시도하게 돌리고, 멈춘 메시지는 [다시 보내기]에 맡긴다', () => {
    const restored = restoreForStart([
      photo({ clientId: 's', kind: 'story', status: 'failed', retryCount: 5 }),
      photo({ clientId: 'm', kind: 'message', status: 'failed', retryCount: 5 }),
    ])
    expect(restored.find((i) => i.clientId === 's')).toMatchObject({ status: 'pending', retryCount: 0 })
    expect(restored.find((i) => i.clientId === 'm')).toMatchObject({ status: 'failed', retryCount: 5 })
  })

  it('올리기 오류: 4xx(408 · 429 제외)는 영구, 네트워크 · 5xx는 일시', () => {
    expect(classifyUploadError({ statusCode: '403' })).toBe('permanent')
    expect(classifyUploadError({ statusCode: 413 })).toBe('permanent')
    expect(classifyUploadError({ statusCode: '429' })).toBe('retryable')
    expect(classifyUploadError({ statusCode: '503' })).toBe('retryable')
    expect(classifyUploadError(new TypeError('Network request failed'))).toBe('retryable')
  })

  it('큐의 사진 메시지는 말풍선이 되고, 서버가 확정한 행은 되돌리지 않는다', () => {
    const synced = syncPhotoMessages([], [photo(), photo({ clientId: 's', kind: 'story' })])
    expect(synced).toHaveLength(1) // 스토리는 말풍선이 아니다
    expect(synced[0]).toMatchObject({ clientMsgId: 'c1', pending: true, localUri: 'file:///docs/c1.jpg', body: null })

    const confirmed = [{ ...synced[0], id: 'server-1', pending: false, mediaPath: 'cp/c1.jpg', localUri: null }]
    expect(syncPhotoMessages(confirmed, [photo()])).toEqual(confirmed)
  })
})

describe('러너', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  function makeDeps(over: Partial<ChatPhotoQueueDeps> = {}) {
    const changes: QueuedPhoto[][] = []
    const discarded: Array<[string, string]> = []
    const deps: ChatPhotoQueueDeps = {
      attempt: jest.fn(async () => ({ outcome: 'done' as const })),
      onChange: (q) => changes.push(q),
      discard: (item, reason) => discarded.push([item.clientId, reason]),
      ...over,
    }
    return { deps, changes, discarded }
  }

  it('일시 실패는 2s -> 4s 백오프로 이어 시도하고, 성공하면 큐에서 빼며 복사본을 지운다', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValueOnce({ outcome: 'retry' })
      .mockResolvedValueOnce({ outcome: 'retry' })
      .mockResolvedValueOnce({ outcome: 'done' })
    const { deps, discarded } = makeDeps({ attempt })
    const queue = new ChatPhotoQueue(deps)

    expect(await queue.add(photo())).toBe('retry')
    expect(attempt).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1999)
    expect(attempt).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)
    expect(attempt).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(3999)
    expect(attempt).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(1)
    expect(attempt).toHaveBeenCalledTimes(3)
    expect(queue.getQueue()).toEqual([])
    expect(discarded).toEqual([['c1', 'done']])
    queue.dispose()
  })

  it('영구 실패는 멈추고, [다시 보내기]로 다시 시작한다', async () => {
    const attempt = jest.fn().mockResolvedValueOnce({ outcome: 'failed' }).mockResolvedValueOnce({ outcome: 'done' })
    const { deps } = makeDeps({ attempt })
    const queue = new ChatPhotoQueue(deps)
    await queue.add(photo())
    expect(queue.getQueue()[0].status).toBe('failed')
    await jest.advanceTimersByTimeAsync(60_000)
    expect(attempt).toHaveBeenCalledTimes(1) // 자동으로 다시 하지 않는다
    queue.retryNow('c1')
    await jest.advanceTimersByTimeAsync(0)
    expect(attempt).toHaveBeenCalledTimes(2)
    expect(queue.getQueue()).toEqual([])
    queue.dispose()
  })

  it('복사본이 사라진 항목은 큐에서 빠지고 알린다', async () => {
    const onLost = jest.fn()
    const { deps, discarded } = makeDeps({ attempt: jest.fn(async () => ({ outcome: 'lost' as const })), onLost })
    const queue = new ChatPhotoQueue(deps)
    expect(await queue.add(photo())).toBe('lost')
    expect(queue.getQueue()).toEqual([])
    expect(onLost).toHaveBeenCalledTimes(1)
    expect(discarded).toEqual([['c1', 'lost']])
    queue.dispose()
  })

  it('같은 항목은 겹쳐 시도하지 않는다', async () => {
    let release: (() => void) | undefined
    const attempt = jest.fn(
      () =>
        new Promise<{ outcome: 'done' }>((resolve) => {
          release = () => resolve({ outcome: 'done' })
        }),
    )
    const { deps } = makeDeps({ attempt })
    const queue = new ChatPhotoQueue(deps)
    const first = queue.add(photo())
    queue.hydrate([photo()]) // 이미 있는 id는 건드리지 않는다
    queue.retryNow('c1')
    await jest.advanceTimersByTimeAsync(0)
    expect(attempt).toHaveBeenCalledTimes(1)
    release?.()
    await first
    queue.dispose()
  })

  it('앱 재시작(모듈 다시 불러오기): 저장된 항목을 새 러너가 이어 보낸다', async () => {
    let saved: QueuedPhoto[] = []
    // 1회차: 시도가 끊긴 채 저장만 남는다.
    jest.isolateModules(() => {
      const { ChatPhotoQueue: First } = require('../../src/utils/chatPhotoQueueRunner')
      const first = new First({
        attempt: async () => ({ outcome: 'retry' }),
        onChange: (q: QueuedPhoto[]) => {
          saved = q
        },
        discard: () => {},
      })
      void first.add(photo({ clientId: 'm1' }))
      void first.add(photo({ clientId: 's1', kind: 'story' }))
      first.dispose()
    })
    await jest.advanceTimersByTimeAsync(0)
    expect(saved.map((i) => i.clientId).sort()).toEqual(['m1', 's1'])

    // 2회차: 모듈을 새로 불러온다 - 메모리 상태 없이 저장된 항목만으로 이어 보낸다.
    const sent: string[] = []
    jest.isolateModules(() => {
      const { ChatPhotoQueue: Second } = require('../../src/utils/chatPhotoQueueRunner')
      const second = new Second({
        attempt: async (item: QueuedPhoto) => {
          sent.push(item.clientId)
          return { outcome: 'done' }
        },
        onChange: (q: QueuedPhoto[]) => {
          saved = q
        },
        discard: () => {},
      })
      second.hydrate(saved)
    })
    await jest.advanceTimersByTimeAsync(0)
    expect(sent.sort()).toEqual(['m1', 's1'])
    expect(saved).toEqual([])
  })
})
