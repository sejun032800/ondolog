import { fillMessageGap, latestServerSentAt } from '../../src/utils/chatGapFill'
import { mergeMessage, rowToChatMessage, type ChatMessage } from '../../src/utils/chatMessages'

function row(id: string, sentAt: string, clientMsgId = `c-${id}`) {
  return {
    id,
    couple_id: 'cp',
    sender_id: 'u2',
    body: `body-${id}`,
    media_path: null,
    sent_at: sentAt,
    read_at: null,
    client_msg_id: clientMsgId,
    deleted_at: null,
  } as never
}

describe('latestServerSentAt', () => {
  it('서버가 확정한 가장 늦은 시각을 고른다(임시 로컬 항목은 뺀다)', () => {
    const list: ChatMessage[] = [
      rowToChatMessage(row('a', '2026-10-25T01:00:00.000Z')),
      rowToChatMessage(row('b', '2026-10-25T02:00:00.000Z')),
      { ...rowToChatMessage(row('x', '2026-10-25T09:00:00.000Z')), id: 'local:x', pending: true },
    ]
    expect(latestServerSentAt(list)).toBe('2026-10-25T02:00:00.000Z')
  })
  it('서버 메시지가 없으면 null', () => {
    expect(latestServerSentAt([])).toBeNull()
  })
})

describe('fillMessageGap (R37-3)', () => {
  it('마지막으로 받은 메시지 이후를 조회해 합친다', async () => {
    let state: ChatMessage[] = [rowToChatMessage(row('a', '2026-10-25T01:00:00.000Z'))]
    const fetchAfter = jest.fn(async () => [row('b', '2026-10-25T02:00:00.000Z')])
    await fillMessageGap({
      getMessages: () => state,
      fetchAfter,
      apply: (update) => {
        state = update(state)
      },
    })
    expect(fetchAfter).toHaveBeenCalledWith('2026-10-25T01:00:00.000Z')
    expect(state.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('실시간으로 이미 온 메시지가 조회에도 오면 화면에는 하나', async () => {
    let state: ChatMessage[] = [rowToChatMessage(row('a', '2026-10-25T01:00:00.000Z'))]
    // 실시간이 먼저 b를 가져왔다.
    state = mergeMessage(state, rowToChatMessage(row('b', '2026-10-25T02:00:00.000Z')))
    // 조회는 같은 시각 이상을 돌려주므로 b가 또 온다(+ 그 사이 c).
    await fillMessageGap({
      getMessages: () => state,
      fetchAfter: async () => [row('b', '2026-10-25T02:00:00.000Z'), row('c', '2026-10-25T03:00:00.000Z')],
      apply: (update) => {
        state = update(state)
      },
    })
    expect(state.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('조회가 실패해도 던지지 않고 상태를 그대로 둔다', async () => {
    let state: ChatMessage[] = [rowToChatMessage(row('a', '2026-10-25T01:00:00.000Z'))]
    await expect(
      fillMessageGap({
        getMessages: () => state,
        fetchAfter: async () => {
          throw new Error('offline')
        },
        apply: (update) => {
          state = update(state)
        },
      }),
    ).resolves.toBeUndefined()
    expect(state).toHaveLength(1)
  })

  it('받은 메시지가 없으면 처음부터 조회한다(null)', async () => {
    const fetchAfter = jest.fn(async () => [])
    await fillMessageGap({ getMessages: () => [], fetchAfter, apply: () => {} })
    expect(fetchAfter).toHaveBeenCalledWith(null)
  })
})
