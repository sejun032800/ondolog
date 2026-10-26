/**
 * A16 "결과와 달라요" 저장 (`65-`) - 실제 `overrideEnneagramCore`에 메모리 가짜 저장소를 넣어 본다.
 *
 * 지키는 것: `enneagram_override`만 쓴다(`enneagram_inferred`는 그대로 - 둘 다 보관) · `enneagram_effective`는 서버가 계산하는 생성 칸이라 쓰지 않는다 ·
 * 빅5 · 스턴버그 · 애착이 있는 `personality_assessments`는 읽지도 쓰지도 않는다 · 횟수 제한 없음.
 */
import { overrideEnneagramCore, type PersonalityDb } from '../../src/services/personalityCore'

type Row = Record<string, unknown>
const touched: string[] = []
const updates: Row[] = []
let profile: Row

function fakeDb(): PersonalityDb {
  return {
    from: (table: string) => {
      touched.push(table)
      let payload: Row | null = null
      const api: Record<string, unknown> = {
        select: () => api,
        update: (p: Row) => {
          payload = p
          return api
        },
        eq: () => api,
        maybeSingle: async () => ({ data: profile, error: null }),
        single: async () => {
          if (payload) {
            updates.push(payload)
            // 생성 칸(enneagram_effective)은 서버가 계산한다 - 클라이언트가 쓰면 거부된다.
            if ('enneagram_effective' in payload) return { data: null, error: { code: '428C9', message: 'generated column' } }
            profile = { ...profile, ...payload }
            profile.enneagram_effective = profile.enneagram_override ?? profile.enneagram_inferred
          }
          return { data: profile, error: null }
        },
      }
      return api
    },
  } as unknown as PersonalityDb
}

beforeEach(() => {
  touched.length = 0
  updates.length = 0
  profile = {
    user_id: 'u1',
    enneagram_inferred: 1,
    enneagram_override: null,
    enneagram_effective: 1,
    override_count: 0,
    override_updated_at: null,
    attachment: 'secure',
    love_type_code: 'KLE',
  }
})

describe('overrideEnneagramCore', () => {
  it('override · count · updated_at · love_type_code 넷만 쓴다 - 추론값과 생성 칸(effective)은 쓰지 않는다', async () => {
    const row = await overrideEnneagramCore(fakeDb(), 'u1', 5)
    expect(updates).toHaveLength(1)
    expect(Object.keys(updates[0]).sort()).toEqual(['enneagram_override', 'love_type_code', 'override_count', 'override_updated_at'])
    expect(row.enneagram_override).toBe(5)
    expect(row.enneagram_inferred).toBe(1) // 원본 추론값 보관
    expect(row.enneagram_effective).toBe(5) // 서버가 계산
    expect(row.attachment).toBe('secure')
  })

  it('빅5 · 스턴버그 · 애착이 들어 있는 검사(personality_assessments)는 건드리지 않는다', async () => {
    await overrideEnneagramCore(fakeDb(), 'u1', 8)
    expect(new Set(touched)).toEqual(new Set(['personality_profiles']))
  })

  it('횟수 제한이 없다 - 여러 번 바꿔도 되고 count만 오른다, 추론값은 그대로', async () => {
    for (const core of [2, 3, 4, 5, 6, 7, 8, 9, 1, 2] as const) {
      await overrideEnneagramCore(fakeDb(), 'u1', core)
    }
    expect(profile.override_count).toBe(10)
    expect(profile.enneagram_override).toBe(2)
    expect(profile.enneagram_inferred).toBe(1)
  })

  it('프로필 행이 없으면 던진다', async () => {
    profile = null as unknown as Row
    await expect(overrideEnneagramCore(fakeDb(), 'u1', 3)).rejects.toThrow()
  })
})
