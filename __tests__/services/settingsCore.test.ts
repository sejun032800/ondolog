/**
 * 설정 탭 쓰기 규칙 (`67-`) - 실제 `settingsCore` 함수에 메모리 가짜 저장소를 넣어 본다.
 *
 * 가짜 저장소는 진짜처럼 구는 제약 둘을 가진다: personality_assessments `unique (user_id, seq)` 중복은 23505,
 * `couples.nickname` 1~20자 check 위반은 23514. 모든 쓰기는 호출 기록(`writes`)에 남는다.
 *
 * 지키는 것:
 *   - 쓰는 칸 목록 밖의 칸에 쓰기 0 (호출 기록으로) - `deleted_at` · `purge_scheduled_at` · 동의 시각 · `birth_date` · `onboarding_step` · `couple_dissolutions`
 *   - 사귄 날짜 수정은 한 번의 UPDATE에 날짜 · `set_by` = 나 · `confirmed_by` = null · 미래 날짜 불가
 *   - 닉네임 0자 · 21자 거부, 1자 · 20자 허용
 *   - 재검사 1회: 새 assessment INSERT(seq 2) · 이전 행 삭제 0 · 한 번의 UPDATE에 칸 전부 · 두 번째는 서버로 안 보냄 · INSERT의 23505는 실패(UPDATE 0)
 *   - 로그아웃 뒤 채팅 큐 저장 유지
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  RetestError,
  performLogout,
  retestPersonality,
  updateCoupleNickname,
  updateProfileBasics,
  updateStartDateByMe,
  type RetestInput,
  type SettingsDb,
} from '../../src/services/settingsCore'
import { chatQueueStorageKey } from '../../src/utils/chatQueue'
import { chatPhotoQueueKey } from '../../src/utils/chatPhotoQueue'
import { inferLoveType } from '../../src/engine/loveTypeInference'

type Row = Record<string, unknown>
interface Write {
  table: string
  op: 'insert' | 'update' | 'delete'
  payload: Row | null
}

/** 쓰는 칸 표(R42-6) - 테이블별로 쓸 수 있는 칸. INSERT는 새 행이라 칸 전체가 새 값이다(personality_assessments만 허용). */
const ALLOWED_UPDATE_COLUMNS: Record<string, string[]> = {
  profiles: ['display_name', 'gender'],
  couples: ['relationship_start_date', 'start_date_set_by', 'start_date_confirmed_by', 'nickname'],
  personality_profiles: [
    'active_assessment_id',
    'enneagram_inferred',
    'attachment',
    'enneagram_override',
    'love_type_code',
    'retest_used',
  ],
}
const ALLOWED_INSERT_TABLES = ['personality_assessments']

class FakeDb {
  tables: Record<string, Row[]> = { profiles: [], couples: [], personality_assessments: [], personality_profiles: [] }
  writes: Write[] = []
  /** 다음 INSERT를 이 오류로 실패시킨다. */
  failNextInsert: { code: string } | null = null
  /** UPDATE가 0행에 닿게 한다(조건 불일치). */
  updateMatchesNothing = false
  /** 다음 UPDATE를 이 오류로 실패시킨다. */
  failNextUpdate: { code: string } | null = null

  from(table: string) {
    const db = this
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row | null = null
    const filters: Array<(r: Row) => boolean> = []
    const rowsOf = () => (db.tables[table] ??= [])

    const run = async (): Promise<{ data: unknown; error: unknown }> => {
      if (op === 'insert') {
        db.writes.push({ table, op, payload })
        if (db.failNextInsert) {
          const error = db.failNextInsert
          db.failNextInsert = null
          return { data: null, error }
        }
        const row = payload as Row
        if (table === 'personality_assessments' && rowsOf().some((r) => r.user_id === row.user_id && r.seq === row.seq)) {
          return { data: null, error: { code: '23505' } }
        }
        const stored = { id: `a${rowsOf().length + 1}`, ...row }
        rowsOf().push(stored)
        return { data: stored, error: null }
      }
      if (op === 'update') {
        db.writes.push({ table, op, payload })
        if (db.failNextUpdate) {
          const error = db.failNextUpdate
          db.failNextUpdate = null
          return { data: null, error }
        }
        const target = db.updateMatchesNothing ? undefined : rowsOf().find((r) => filters.every((f) => f(r)))
        if (!target) return { data: null, error: { code: 'PGRST116' } }
        const next = payload as Row
        if (table === 'couples' && 'nickname' in next) {
          const n = [...String(next.nickname)].length
          if (n < 1 || n > 20) return { data: null, error: { code: '23514' } }
        }
        Object.assign(target, next)
        return { data: target, error: null }
      }
      if (op === 'delete') {
        db.writes.push({ table, op, payload: null })
        return { data: null, error: null }
      }
      return { data: rowsOf().find((r) => filters.every((f) => f(r))) ?? null, error: null }
    }

    const api: Record<string, unknown> = {
      select: () => api,
      insert: (p: Row) => ((op = 'insert'), (payload = p), api),
      update: (p: Row) => ((op = 'update'), (payload = p), api),
      delete: () => ((op = 'delete'), api),
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      single: () => run(),
      maybeSingle: () => run(),
    }
    return api
  }

  asDb(): SettingsDb {
    return this as unknown as SettingsDb
  }
}

function result(): RetestInput['result'] {
  // 엔진 출력 그대로(결정론) - INFJ에 문항 A만 고른 입력.
  return inferLoveType({ mbti: 'INFJ', q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A' })
}

function retestInput(): RetestInput {
  return { mbti: 'INFJ', mbtiSelfReported: true, q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A', result: result() }
}

let db: FakeDb

beforeEach(() => {
  db = new FakeDb()
  db.tables.profiles.push({ id: 'me', display_name: '세준', gender: 'male', birth_date: '2004-03-28', onboarding_step: 3 })
  db.tables.couples.push({
    id: 'c1',
    user_a_id: 'me',
    user_b_id: 'p',
    relationship_start_date: '2025-12-27',
    start_date_set_by: 'p',
    start_date_confirmed_by: 'p',
    nickname: '늘봄',
  })
  db.tables.personality_assessments.push({ id: 'a1', user_id: 'me', seq: 1, enneagram_core: 7, attachment: 'anxious' })
  db.tables.personality_profiles.push({
    user_id: 'me',
    active_assessment_id: 'a1',
    enneagram_inferred: 7,
    enneagram_override: 9,
    attachment: 'anxious',
    love_type_code: 'LLF',
    retest_used: false,
  })
})

describe('H03 프로필 - 이름 · 성별만 쓴다', () => {
  it('이름 · 성별을 고치면 두 칸만 UPDATE한다 - 생년월일 · 동의 시각 · 진행 단계 칸은 없다', async () => {
    await updateProfileBasics(db.asDb(), 'me', { displayName: ' 새이름 ', gender: 'other' })
    expect(db.writes).toEqual([{ table: 'profiles', op: 'update', payload: { display_name: '새이름', gender: 'other' } }])
    expect(db.tables.profiles[0].birth_date).toBe('2004-03-28')
    expect(db.tables.profiles[0].onboarding_step).toBe(3)
  })

  it('이름이 비었거나 21자면 서버로 보내지 않는다', async () => {
    await expect(updateProfileBasics(db.asDb(), 'me', { displayName: '  ', gender: 'male' })).rejects.toThrow()
    await expect(updateProfileBasics(db.asDb(), 'me', { displayName: '가'.repeat(21), gender: 'male' })).rejects.toThrow()
    expect(db.writes).toEqual([])
  })
})

describe('H04 사귄 날짜 - 같은 UPDATE에서 정한 사람 = 나, 확인한 사람 = null', () => {
  const now = new Date('2026-10-26T03:00:00Z') // KST 12:00

  it('날짜 · set_by = 나 · confirmed_by = null이 한 번의 UPDATE에 같이 들어간다', async () => {
    const row = await updateStartDateByMe(db.asDb(), 'c1', 'me', '2025-11-01', now)
    expect(db.writes).toHaveLength(1)
    expect(db.writes[0]).toEqual({
      table: 'couples',
      op: 'update',
      payload: { relationship_start_date: '2025-11-01', start_date_set_by: 'me', start_date_confirmed_by: null },
    })
    expect(row.start_date_set_by).toBe('me')
    expect(row.start_date_confirmed_by).toBeNull()
  })

  it('미래 날짜는 서버로 보내지 않는다(KST 오늘까지는 된다)', async () => {
    await expect(updateStartDateByMe(db.asDb(), 'c1', 'me', '2026-10-28', now)).rejects.toThrow()
    expect(db.writes).toEqual([])
    await expect(updateStartDateByMe(db.asDb(), 'c1', 'me', '2026-10-26', now)).resolves.toBeTruthy()
  })

  it('없는 날짜도 보내지 않는다', async () => {
    await expect(updateStartDateByMe(db.asDb(), 'c1', 'me', '2025-02-30', now)).rejects.toThrow()
    expect(db.writes).toEqual([])
  })
})

describe('H04 커플 닉네임 1~20자', () => {
  it.each([
    [0, false],
    [1, true],
    [20, true],
    [21, false],
  ])('%i자 -> 허용 %s', async (len, ok) => {
    const nick = '가'.repeat(len)
    if (ok) {
      await expect(updateCoupleNickname(db.asDb(), 'c1', nick)).resolves.toBeTruthy()
      expect(db.writes).toEqual([{ table: 'couples', op: 'update', payload: { nickname: nick } }])
    } else {
      await expect(updateCoupleNickname(db.asDb(), 'c1', nick)).rejects.toThrow()
      expect(db.writes).toEqual([])
    }
  })

  it('서버 check(23514)가 21자를 한 번 더 막는다 - 가짜 저장소도 같은 오류를 낸다', async () => {
    const api = db.from('couples') as { update: (p: Row) => { eq: (k: string, v: unknown) => { single: () => Promise<{ error: { code: string } | null }> } } }
    const { error } = await api.update({ nickname: '가'.repeat(21) }).eq('id', 'c1').single()
    expect(error?.code).toBe('23514')
  })
})

describe('H06 재검사 - 계정당 1회', () => {
  it('새 assessment(seq 2)를 INSERT하고, 이전 행은 지우지도 고치지도 않는다', async () => {
    const before = { ...db.tables.personality_assessments[0] }
    const { assessment } = await retestPersonality(db.asDb(), 'me', retestInput())
    const inserts = db.writes.filter((w) => w.op === 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].table).toBe('personality_assessments')
    expect(inserts[0].payload).toMatchObject({ user_id: 'me', seq: 2, mbti: 'INFJ' })
    expect(db.writes.filter((w) => w.op === 'delete')).toEqual([])
    expect(db.tables.personality_assessments).toHaveLength(2)
    expect(db.tables.personality_assessments[0]).toEqual(before) // 이전 행 그대로
    expect(assessment.seq).toBe(2)
  })

  it('personality_profiles는 한 번의 UPDATE로 칸 전부를 고친다 - override는 null, love_type_code는 새 결과 기준', async () => {
    const r = result()
    const { assessment } = await retestPersonality(db.asDb(), 'me', retestInput())
    const updates = db.writes.filter((w) => w.op === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('personality_profiles')
    expect(updates[0].payload).toEqual({
      active_assessment_id: assessment.id,
      enneagram_inferred: r.enneagramCore,
      attachment: r.attachment,
      enneagram_override: null,
      love_type_code: r.loveTypeCode,
      retest_used: true,
    })
    expect(db.tables.personality_profiles[0]).toMatchObject({ retest_used: true, enneagram_override: null })
  })

  it('두 번째 재검사는 서버로 아무것도 보내지 않는다(버튼 비활성과 같은 판정)', async () => {
    await retestPersonality(db.asDb(), 'me', retestInput())
    db.writes.length = 0
    await expect(retestPersonality(db.asDb(), 'me', retestInput())).rejects.toMatchObject({ kind: 'already-used' })
    expect(db.writes).toEqual([])
  })

  it('재검사 INSERT의 23505는 실패다 - 성공으로 삼키지 않고 프로필도 건드리지 않는다', async () => {
    db.failNextInsert = { code: '23505' }
    await expect(retestPersonality(db.asDb(), 'me', retestInput())).rejects.toMatchObject({
      name: 'RetestError',
      kind: 'duplicate',
    })
    expect(db.writes.filter((w) => w.op === 'update')).toEqual([])
    expect(db.tables.personality_profiles[0]).toMatchObject({ retest_used: false, enneagram_override: 9 })
  })

  it('같은 키(seq 2)가 이미 있으면 진짜 제약이 23505를 내고 그것도 실패다', async () => {
    db.tables.personality_assessments.push({ id: 'a2', user_id: 'me', seq: 2 })
    await expect(retestPersonality(db.asDb(), 'me', retestInput())).rejects.toMatchObject({ kind: 'duplicate' })
    expect(db.writes.filter((w) => w.op === 'update')).toEqual([])
  })

  it('INSERT가 다른 오류로 실패해도 프로필은 그대로다', async () => {
    db.failNextInsert = { code: '08006' }
    await expect(retestPersonality(db.asDb(), 'me', retestInput())).rejects.toMatchObject({ kind: 'failed' })
    expect(db.writes.filter((w) => w.op === 'update')).toEqual([])
  })

  it('UPDATE가 0행에 닿으면(다른 기기가 먼저 썼다) 실패다', async () => {
    db.updateMatchesNothing = true
    await expect(retestPersonality(db.asDb(), 'me', retestInput())).rejects.toBeInstanceOf(RetestError)
  })

  it('프로필 행이 없으면 아무것도 보내지 않는다', async () => {
    db.tables.personality_profiles.length = 0
    await expect(retestPersonality(db.asDb(), 'me', retestInput())).rejects.toBeInstanceOf(RetestError)
    expect(db.writes).toEqual([])
  })
})

describe('쓰는 칸 목록 밖에 쓰기 0', () => {
  it('모든 설정 쓰기를 한 번씩 돌린 호출 기록이 표 안에 있다', async () => {
    const now = new Date('2026-10-26T03:00:00Z')
    await updateProfileBasics(db.asDb(), 'me', { displayName: '새이름', gender: 'female' })
    await updateStartDateByMe(db.asDb(), 'c1', 'me', '2025-11-01', now)
    await updateCoupleNickname(db.asDb(), 'c1', '별빛')
    await retestPersonality(db.asDb(), 'me', retestInput())

    expect(db.writes.length).toBeGreaterThan(0)
    for (const w of db.writes) {
      expect(w.op).not.toBe('delete')
      if (w.op === 'insert') {
        expect(ALLOWED_INSERT_TABLES).toContain(w.table)
        continue
      }
      const allowed = ALLOWED_UPDATE_COLUMNS[w.table]
      expect(allowed).toBeDefined()
      for (const column of Object.keys(w.payload ?? {})) expect(allowed).toContain(column)
    }
  })

  it('금지 칸 이름이 어떤 쓰기 값에도 없다', async () => {
    const now = new Date('2026-10-26T03:00:00Z')
    await updateProfileBasics(db.asDb(), 'me', { displayName: '새이름', gender: 'female' })
    await updateStartDateByMe(db.asDb(), 'c1', 'me', '2025-11-01', now)
    await updateCoupleNickname(db.asDb(), 'c1', '별빛')
    await retestPersonality(db.asDb(), 'me', retestInput())
    const forbidden = [
      'deleted_at',
      'purge_scheduled_at',
      'terms_agreed_at',
      'privacy_agreed_at',
      'ai_usage_agreed_at',
      'marketing_agreed_at',
      'biometric_consent_at',
      'birth_date',
      'onboarding_step',
      'enneagram_effective',
      'status',
    ]
    for (const w of db.writes) for (const c of forbidden) expect(Object.keys(w.payload ?? {})).not.toContain(c)
    expect(db.writes.map((w) => w.table)).not.toContain('couple_dissolutions')
  })
})

describe('로그아웃 - 그 사용자 키의 채팅 큐는 그대로', () => {
  it('메모리를 비우고 세션을 끝내되, 기기에 저장된 텍스트 · 사진 큐 키를 지우지 않는다', async () => {
    const textKey = chatQueueStorageKey('c1')
    const photoKey = chatPhotoQueueKey('c1', 'me')
    await AsyncStorage.setItem(textKey, JSON.stringify([{ id: 'q1', body: '안녕' }]))
    await AsyncStorage.setItem(photoKey, JSON.stringify([{ id: 'p1' }]))
    const removeItem = jest.spyOn(AsyncStorage, 'removeItem')
    const multiRemove = jest.spyOn(AsyncStorage, 'multiRemove')
    const clear = jest.spyOn(AsyncStorage, 'clear')
    const order: string[] = []

    await performLogout({
      resetMemory: () => order.push('reset'),
      signOut: async () => {
        order.push('signOut')
      },
    })

    expect(order).toEqual(['reset', 'signOut'])
    expect(removeItem).not.toHaveBeenCalled()
    expect(multiRemove).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    expect(await AsyncStorage.getItem(textKey)).toBe(JSON.stringify([{ id: 'q1', body: '안녕' }]))
    expect(await AsyncStorage.getItem(photoKey)).toBe(JSON.stringify([{ id: 'p1' }]))
    removeItem.mockRestore()
    multiRemove.mockRestore()
    clear.mockRestore()
  })
})
