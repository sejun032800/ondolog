/**
 * §0 b - 구독이 SUBSCRIBED가 될 때·앱이 앞으로 돌아올 때 메우고, 실시간과 조회가 겹쳐도 하나.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { useRealtimeMessages } from '../../src/hooks/useRealtimeMessages'

function mockRow(id: string, sentAt: string) {
  return {
    id,
    couple_id: 'cp',
    sender_id: 'u2',
    body: `body-${id}`,
    media_path: null,
    sent_at: sentAt,
    read_at: '2026-10-25T23:00:00.000Z',
    client_msg_id: `c-${id}`,
    deleted_at: null,
  }
}

let mockStatusCb: ((status: string) => void) | null = null
let mockEventCb: ((payload: unknown) => void) | null = null
const mockChannel = {
  on: (_t: string, _f: unknown, cb: (p: unknown) => void) => {
    mockEventCb = cb
    return mockChannel
  },
  subscribe: (cb: (s: string) => void) => {
    mockStatusCb = cb
    return mockChannel
  },
}
jest.mock('../../src/services/supabase', () => ({
  supabase: { channel: () => mockChannel, removeChannel: jest.fn() },
}))

const mockFetchAfter = jest.fn()
jest.mock('../../src/services/chatApi', () => ({
  fetchMessages: async () => [mockRow('a', '2026-10-25T01:00:00.000Z')],
  fetchMessagesAfter: (...a: unknown[]) => mockFetchAfter(...a),
  fetchStories: async () => [],
  markMessagesRead: async () => [],
  sendMessage: jest.fn(),
  createStory: jest.fn(),
  uploadChatMedia: jest.fn(),
}))
jest.mock('../../src/services/photoPicker', () => ({ readLocalBytes: jest.fn() }))

describe('채팅 실시간 메우기 (R37-3)', () => {
  beforeEach(() => {
    mockFetchAfter.mockReset()
    mockStatusCb = null
    mockEventCb = null
  })

  it('SUBSCRIBED가 되면 마지막 메시지 이후를 조회하고, 실시간과 겹쳐도 하나', async () => {
    mockFetchAfter.mockResolvedValue([mockRow('b', '2026-10-25T02:00:00.000Z'), mockRow('c', '2026-10-25T03:00:00.000Z')])
    const { result } = await renderHook(() => useRealtimeMessages('cp', 'u1'))
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['a']))

    // 실시간이 b를 먼저 가져온다.
    await act(async () => {
      mockEventCb?.({ eventType: 'INSERT', new: mockRow('b', '2026-10-25T02:00:00.000Z') })
    })
    expect(result.current.messages.map((m) => m.id)).toEqual(['a', 'b'])

    // 구독 확정 - 조회가 b·c를 돌려준다.
    await act(async () => {
      mockStatusCb?.('SUBSCRIBED')
    })
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['a', 'b', 'c']))
    expect(mockFetchAfter).toHaveBeenCalledWith('cp', '2026-10-25T02:00:00.000Z')
  })

  it('앱이 앞으로 돌아오면(AppState active) 다시 메운다', async () => {
    let appStateCb: ((s: string) => void) | null = null
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, cb: (s: string) => void) => {
      appStateCb = cb
      return { remove: jest.fn() }
    }) as never)
    mockFetchAfter.mockResolvedValue([mockRow('d', '2026-10-25T04:00:00.000Z')])
    const { result } = await renderHook(() => useRealtimeMessages('cp', 'u1'))
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['a']))

    await act(async () => {
      appStateCb?.('active')
    })
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['a', 'd']))
    spy.mockRestore()
  })
})
