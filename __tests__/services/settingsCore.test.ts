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
 *   - 재검사(`68-`): 함수 `fn_complete_retest` 호출 하나(테이블 직접 쓰기 0) · 이미 썼으면 서버로 안 보냄 · 23505 = 이미 사용 · 복구 표시
 *   - 마케팅 토글: 켜기 = 시각 · 끄기 = null · 이 칸 하나만
 *   - 로그아웃 뒤 채팅 큐 저장 유지
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  RetestError,
  performLogout,
  updateMarketingConsent,
  retestPersonality,
  updateCoupleNickname,
  updateProfileBasics,
  updateStartDateByMe,
  type RetestInput,
  type RetestDb,
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
interface RpcCall {
  fn: string
  args: Record<string, unknown>
}

/** 쓰는 칸 표(R42-6) - 테이블별로 쓸 수 있는 칸. INSERT는 새 행이라 칸 전체가 새 값이다(personality_assessments만 허용). */
const ALLOWED_UPDATE_COLUMNS: Record<string, string[]> = {
  profiles: ['display_name', 'gender', 'marketing_agreed_at'],
  couples: ['relationship_start_date', 'start_date_set_by', 'start_date_confirmed_by', 'nickname'],
}
const ALLOWED_INSERT_TABLES: string[] = []

class FakeDb {
  tables: Record<string, Row[]> = { profiles: [], couples: [], personality_assessments: [], personality_profiles: [] }
  writes: Write[] = []
  rpcCalls: RpcCall[] = []
  /** 다음 rpc를 이 오류로 실패시킨다. */
  failNextRpc: { code: string } | null = null
  /** 다음 rpc가 복구(기존 행으로 마저 끝냄)로 답한다. */
  rpcRecovered = false
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
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => run().then(resolve, reject),
    }
    return api
  }

  rpc(fn: string, args: Record<string, unknown>) {
    this.rpcCalls.push({ fn, args })
    if (this.failNextRpc) {
      const error = this.failNextRpc
      this.failNextRpc = null
      return Promise.resolve({ data: null, error })
    }
    return Promise.resolve({ data: [{ out_assessment_id: 'a2', out_recovered: this.rpcRecovered }], error: null })
  }

  asDb(): SettingsDb {
    return this as unknown as SettingsDb
  }

  asRetestDb(): RetestDb {
    return this as unknown as RetestDb
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

describe('H06 재검사 - 계정당 1회, 함수 호출 하나', () => {
  it('fn_complete_retest를 한 번 부르고 테이블 직접 쓰기는 0이다', async () => {
    const out = await retestPersonality(db.asRetestDb(), 'me', retestInput())
    expect(db.rpcCalls).toHaveLength(1)
    expect(db.rpcCalls[0].fn).toBe('fn_complete_retest')
    expect(db.writes).toEqual([])
    expect(out).toEqual({ assessmentId: 'a2', recovered: false })
  })

  it('채점 결과는 엔진 출력 그대로 인자로 넘긴다 - love_type_code도 엔진 함수로 만든다', async () => {
    const r = result()
    await retestPersonality(db.asRetestDb(), 'me', retestInput())
    expect(db.rpcCalls[0].args).toMatchObject({
      p_mbti: 'INFJ',
      p_mbti_self_reported: true,
      p_q1: 'A',
      p_q5: 'A',
      p_enneagram_core: r.enneagramCore,
      p_attachment: r.attachment,
      p_love_type_code: r.loveTypeCode,
      p_attach_anxiety: r.attachAnxiety,
      p_attach_avoidance: r.attachAvoidance,
    })
  })

  it('같은 입력은 같은 인자를 만든다(결정론)', async () => {
    await retestPersonality(db.asRetestDb(), 'me', retestInput())
    db.tables.personality_profiles[0].retest_used = false
    await retestPersonality(db.asRetestDb(), 'me', retestInput())
    expect(db.rpcCalls[1].args).toEqual(db.rpcCalls[0].args)
  })

  it('이미 썼으면(retest_used) 서버로 아무것도 보내지 않는다(버튼 비활성과 같은 판정)', async () => {
    db.tables.personality_profiles[0].retest_used = true
    await expect(retestPersonality(db.asRetestDb(), 'me', retestInput())).rejects.toMatchObject({ kind: 'already-used' })
    expect(db.rpcCalls).toEqual([])
    expect(db.writes).toEqual([])
  })

  it('함수의 23505는 이미 사용으로 처리한다', async () => {
    db.failNextRpc = { code: '23505' }
    await expect(retestPersonality(db.asRetestDb(), 'me', retestInput())).rejects.toMatchObject({
      name: 'RetestError',
      kind: 'already-used',
    })
  })

  it('다른 오류는 실패(다시 시도 가능)다', async () => {
    db.failNextRpc = { code: '08006' }
    await expect(retestPersonality(db.asRetestDb(), 'me', retestInput())).rejects.toMatchObject({ kind: 'failed' })
  })

  it('끊긴 상태를 함수가 기존 행으로 마저 끝내면 recovered = true로 알린다', async () => {
    db.rpcRecovered = true
    await expect(retestPersonality(db.asRetestDb(), 'me', retestInput())).resolves.toEqual({
      assessmentId: 'a2',
      recovered: true,
    })
  })

  it('프로필 행이 없으면 아무것도 보내지 않는다', async () => {
    db.tables.personality_profiles.length = 0
    await expect(retestPersonality(db.asRetestDb(), 'me', retestInput())).rejects.toBeInstanceOf(RetestError)
    expect(db.rpcCalls).toEqual([])
  })
})

describe('H11 마케팅 수신 - marketing_agreed_at 한 칸', () => {
  const now = new Date('2026-10-26T03:00:00Z')

  it('켜기 = 지금 시각, 끄기 = null - 이 칸만 UPDATE', async () => {
    expect(await updateMarketingConsent(db.asDb(), 'me', true, now)).toBe(now.toISOString())
    expect(await updateMarketingConsent(db.asDb(), 'me', false, now)).toBeNull()
    expect(db.writes).toEqual([
      { table: 'profiles', op: 'update', payload: { marketing_agreed_at: now.toISOString() } },
      { table: 'profiles', op: 'update', payload: { marketing_agreed_at: null } },
    ])
  })

  it('저장이 실패하면 던진다(화면이 되돌린다)', async () => {
    db.failNextUpdate = { code: '08006' }
    await expect(updateMarketingConsent(db.asDb(), 'me', true, now)).rejects.toBeTruthy()
  })
})

describe('쓰는 칸 목록 밖에 쓰기 0', () => {
  it('모든 설정 쓰기를 한 번씩 돌린 호출 기록이 표 안에 있다', async () => {
    const now = new Date('2026-10-26T03:00:00Z')
    await updateProfileBasics(db.asDb(), 'me', { displayName: '새이름', gender: 'female' })
    await updateStartDateByMe(db.asDb(), 'c1', 'me', '2025-11-01', now)
    await updateCoupleNickname(db.asDb(), 'c1', '별빛')
    await updateMarketingConsent(db.asDb(), 'me', true, now)
    await retestPersonality(db.asRetestDb(), 'me', retestInput())

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
    await updateMarketingConsent(db.asDb(), 'me', true, now)
    await retestPersonality(db.asRetestDb(), 'me', retestInput())
    const forbidden = [
      'deleted_at',
      'purge_scheduled_at',
      'terms_agreed_at',
      'privacy_agreed_at',
      'ai_usage_agreed_at',
      'biometric_consent_at',
      'birth_date',
      'onboarding_step',
      'enneagram_effective',
      'status',
      'retest_used',
      'active_assessment_id',
      'enneagram_inferred',
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
