/**
 * A19 저장 · A20 규칙 (`65-`) - 실제 `coupleApi` 함수에 메모리 가짜 저장소를 넣어 본다.
 *
 * A20: 먼저 입력한 값이 적용되고 상대는 확인만 한다(`setOrConfirmStartDate`, MASTER 9-1 화면 +) - 이 규칙은 바꾸지 않았다.
 * A19: 닉네임은 날짜를 정한 쪽이 쓰고, 입력 규칙(미래 날짜 · 닉네임 길이)을 저장 함수에서도 한 번 더 막는다.
 */
import { saveStartDateAndNickname, setOrConfirmStartDate } from '../../src/services/coupleApi'

type Row = Record<string, unknown>
let mockCouple: Row
const mockUpdates: Row[] = []

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'couples') throw new Error(`unexpected table ${table}`)
      let payload: Row | null = null
      const api: Record<string, unknown> = {
        select: () => api,
        update: (p: Row) => {
          payload = p
          return api
        },
        eq: () => api,
        single: async () => {
          if (payload) {
            mockUpdates.push(payload)
            mockCouple = { ...mockCouple, ...payload }
          }
          return { data: mockCouple, error: null }
        },
      }
      return api
    },
  },
}))

beforeEach(() => {
  mockUpdates.length = 0
  mockCouple = {
    id: 'c1',
    user_a_id: 'a',
    user_b_id: 'b',
    relationship_start_date: null,
    start_date_set_by: null,
    start_date_confirmed_by: null,
    nickname: null,
  }
})

describe('A20 먼저 입력한 값이 적용된다', () => {
  it('날짜가 비어 있으면 첫 입력이 확정된다 - 정한 사람이 기록된다', async () => {
    const row = await setOrConfirmStartDate('c1', 'a', '2025-12-27')
    expect(row.relationship_start_date).toBe('2025-12-27')
    expect(row.start_date_set_by).toBe('a')
    expect(mockUpdates).toEqual([{ relationship_start_date: '2025-12-27', start_date_set_by: 'a' }])
  })

  it('이미 날짜가 있으면 뒤에 입력한 값은 적용되지 않는다 - 상대는 확인만 기록한다', async () => {
    await setOrConfirmStartDate('c1', 'a', '2025-12-27')
    mockUpdates.length = 0
    const row = await setOrConfirmStartDate('c1', 'b', '2024-01-01')
    expect(row.relationship_start_date).toBe('2025-12-27') // 먼저 입력한 값 그대로
    expect(row.start_date_set_by).toBe('a')
    expect(row.start_date_confirmed_by).toBe('b')
    expect(mockUpdates).toEqual([{ start_date_confirmed_by: 'b' }]) // 날짜 칸은 쓰지 않았다
  })

  it('확인(A20 [확인했어요])은 상대가 정한 같은 날짜로 부르면 확인만 남는다', async () => {
    await setOrConfirmStartDate('c1', 'a', '2025-12-27')
    mockUpdates.length = 0
    await setOrConfirmStartDate('c1', 'b', '2025-12-27')
    expect(mockUpdates).toEqual([{ start_date_confirmed_by: 'b' }])
  })
})

describe('A19 저장 - 날짜 + 닉네임', () => {
  const now = new Date('2026-10-25T03:00:00Z') // KST 12:00

  it('내가 날짜를 정한 쪽이면 닉네임도 쓴다(앞뒤 공백은 지운다)', async () => {
    const row = await saveStartDateAndNickname('c1', 'a', '2025-12-27', '  늘봄 ', now)
    expect(row.relationship_start_date).toBe('2025-12-27')
    expect(row.nickname).toBe('늘봄')
    expect(mockUpdates).toEqual([{ relationship_start_date: '2025-12-27', start_date_set_by: 'a' }, { nickname: '늘봄' }])
  })

  it('상대가 먼저 날짜를 정했다면 닉네임도 덮지 않는다', async () => {
    await saveStartDateAndNickname('c1', 'a', '2025-12-27', '늘봄', now)
    mockUpdates.length = 0
    const row = await saveStartDateAndNickname('c1', 'b', '2024-01-01', '다른이름', now)
    expect(row.nickname).toBe('늘봄')
    expect(row.relationship_start_date).toBe('2025-12-27')
    expect(mockUpdates).toEqual([{ start_date_confirmed_by: 'b' }])
  })

  it('미래 날짜는 저장 함수에서도 거부한다 - 아무것도 쓰지 않는다', async () => {
    await expect(saveStartDateAndNickname('c1', 'a', '2026-10-26', '늘봄', now)).rejects.toThrow()
    expect(mockUpdates).toEqual([])
  })

  it('닉네임이 0자 · 21자면 거부, 1자 · 20자는 저장', async () => {
    await expect(saveStartDateAndNickname('c1', 'a', '2025-12-27', '', now)).rejects.toThrow()
    await expect(saveStartDateAndNickname('c1', 'a', '2025-12-27', '가'.repeat(21), now)).rejects.toThrow()
    expect(mockUpdates).toEqual([])
    const one = await saveStartDateAndNickname('c1', 'a', '2025-12-27', '가', now)
    expect(one.nickname).toBe('가')
    mockCouple = { ...mockCouple, relationship_start_date: null, start_date_set_by: null, nickname: null }
    const twenty = await saveStartDateAndNickname('c1', 'a', '2025-12-27', '가'.repeat(20), now)
    expect(twenty.nickname).toBe('가'.repeat(20))
  })
})
