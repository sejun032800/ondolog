/**
 * 메인 읽기(활동 유무 · 프로파일 유무) 시험 - 읽기 전용 호출만 쓴다(select/eq/is/in/limit). 쓰기 호출이 없다.
 */
import { fetchHasActivity, fetchProfilesComplete } from '../../src/services/mainApi'
import type { Db } from '../../src/services/dateRecordApi'

type Rows = Record<string, unknown[]>

/** 읽기 체인만 있는 가짜 Db. 호출된 메서드 이름을 모은다. */
function fakeDb(rows: Rows, errors: Record<string, string> = {}) {
  const calls: string[] = []
  const db = {
    from(table: string) {
      calls.push(`from:${table}`)
      const result = () => ({ data: errors[table] ? null : (rows[table] ?? []), error: errors[table] ? { message: errors[table] } : null })
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is', 'in', 'limit']) {
        chain[m] = (..._args: unknown[]) => {
          calls.push(m)
          return chain
        }
      }
      chain.then = (resolve: (v: unknown) => unknown) => resolve(result())
      return chain
    },
  }
  return { db: db as unknown as Db, calls }
}

describe('fetchHasActivity', () => {
  it('대화·기록·데이트 중 하나라도 있으면 true', async () => {
    expect(await fetchHasActivity(fakeDb({ messages: [{ id: 1 }] }).db, 'c1')).toBe(true)
    expect(await fetchHasActivity(fakeDb({ data_entries: [{ id: 1 }] }).db, 'c1')).toBe(true)
    expect(await fetchHasActivity(fakeDb({ dates: [{ id: 1 }] }).db, 'c1')).toBe(true)
  })

  it('셋 다 없으면 false(활동 0일)', async () => {
    expect(await fetchHasActivity(fakeDb({}).db, 'c1')).toBe(false)
  })

  it('읽기 실패는 던진다(호출한 쪽이 값을 지어내지 않는다)', async () => {
    await expect(fetchHasActivity(fakeDb({}, { messages: 'denied' }).db, 'c1')).rejects.toThrow('denied')
  })

  it('읽기 호출만 쓴다', async () => {
    const { db, calls } = fakeDb({})
    await fetchHasActivity(db, 'c1')
    for (const c of calls) {
      if (!c.startsWith('from:')) expect(['select', 'eq', 'is', 'in', 'limit']).toContain(c)
    }
    expect(calls.filter((c) => c.startsWith('from:')).sort()).toEqual(['from:data_entries', 'from:dates', 'from:messages'])
  })
})

describe('fetchProfilesComplete', () => {
  it('본인과 상대 프로파일이 모두 있을 때만 true', async () => {
    expect(await fetchProfilesComplete(fakeDb({ personality_profiles: [{ user_id: 'a' }, { user_id: 'b' }] }).db, 'a', 'b')).toBe(true)
    expect(await fetchProfilesComplete(fakeDb({ personality_profiles: [{ user_id: 'a' }] }).db, 'a', 'b')).toBe(false)
    expect(await fetchProfilesComplete(fakeDb({ personality_profiles: [] }).db, 'a', 'b')).toBe(false)
  })
})
