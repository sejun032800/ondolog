/**
 * 생성 칸 쓰기 0 + `love_type_code` 재계산 (`66-`, R40-4).
 *
 * 마이그레이션에서 `generated always`인 칸은 하나다: `004_personality.sql:63 personality_profiles.enneagram_effective`.
 * 클라이언트 쓰기 경로 중 그 테이블에 쓰는 곳 = `ensurePersonalityProfileCore`(insert) · `overrideEnneagramCore`(update). 둘 다 넘기는 객체에 생성 칸이 없어야 한다.
 */
import { ensurePersonalityProfileCore, overrideEnneagramCore, type PersonalityDb } from '../../src/services/personalityCore'

const GENERATED_COLUMNS = ['enneagram_effective']

type Row = Record<string, unknown>
const writes: { table: string; op: string; payload: Row }[] = []
let profile: Row | null

function fakeDb(): PersonalityDb {
  return {
    from: (table: string) => {
      let pending: { op: string; payload: Row } | null = null
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        insert: (p: Row) => {
          pending = { op: 'insert', payload: p }
          return api
        },
        update: (p: Row) => {
          pending = { op: 'update', payload: p }
          return api
        },
        maybeSingle: async () => ({ data: profile, error: null }),
        single: async () => {
          if (pending) {
            writes.push({ table, ...pending })
            if (GENERATED_COLUMNS.some((c) => c in pending!.payload)) return { data: null, error: { code: '428C9', message: 'generated column' } }
            profile = { ...(profile ?? {}), ...pending.payload }
            profile.enneagram_effective = profile.enneagram_override ?? profile.enneagram_inferred
          }
          return { data: profile, error: null }
        },
      }
      return api
    },
  } as unknown as PersonalityDb
}

const assessment = { id: 'a1', enneagram_core: 7, attachment: 'anxious' } as never

beforeEach(() => {
  writes.length = 0
  profile = null
})

describe('생성 칸 쓰기 0', () => {
  it('A14 생성(insert): enneagram_effective를 넘기지 않는다', async () => {
    const { row, created } = await ensurePersonalityProfileCore(fakeDb(), 'u1', assessment)
    expect(created).toBe(true)
    expect(writes).toHaveLength(1)
    expect(writes[0].op).toBe('insert')
    for (const c of GENERATED_COLUMNS) expect(Object.keys(writes[0].payload)).not.toContain(c)
    expect(row.enneagram_effective).toBe(7)
  })

  it('이미 있으면 쓰지 않는다', async () => {
    profile = { user_id: 'u1', enneagram_inferred: 7 }
    const { created } = await ensurePersonalityProfileCore(fakeDb(), 'u1', assessment)
    expect(created).toBe(false)
    expect(writes).toEqual([])
  })

  it('A16 오버라이드(update): 생성 칸을 넘기지 않는다', async () => {
    await ensurePersonalityProfileCore(fakeDb(), 'u1', assessment)
    writes.length = 0
    await overrideEnneagramCore(fakeDb(), 'u1', 9)
    expect(writes).toHaveLength(1)
    for (const c of GENERATED_COLUMNS) expect(Object.keys(writes[0].payload)).not.toContain(c)
  })
})

describe('love_type_code 재계산', () => {
  it('추론 7 + 애착 anxious는 RHF, 오버라이드 9(애착 같음)면 같은 UPDATE에서 LLF', async () => {
    await ensurePersonalityProfileCore(fakeDb(), 'u1', assessment)
    expect(writes[0].payload.love_type_code).toBe('RHF')
    writes.length = 0
    const row = await overrideEnneagramCore(fakeDb(), 'u1', 9)
    expect(writes).toHaveLength(1) // 한 번의 UPDATE
    expect(writes[0].op).toBe('update')
    expect(writes[0].payload.enneagram_override).toBe(9)
    expect(writes[0].payload.love_type_code).toBe('LLF')
    expect(row.love_type_code).toBe('LLF')
  })

  it('오버라이드가 없으면 추론값 그대로(RHF)', async () => {
    const { row } = await ensurePersonalityProfileCore(fakeDb(), 'u1', assessment)
    expect(row.love_type_code).toBe('RHF')
    expect(row.enneagram_override ?? null).toBeNull()
  })
})
