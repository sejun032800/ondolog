/**
 * 가입 저장은 "없을 때만 넣기"다 (MASTER 6-5 r70, R38-3 d).
 *
 * 가짜 저장소는 진짜처럼 구는 두 제약만 가진다: profiles 기본키(id) 중복과 personality_assessments (user_id, seq) 중복은 23505.
 * 지켜야 하는 것: 두 번 불러도 같은 결과 · 이미 있는 프로필은 덮어쓰지 않음(이름 · 동의 시각 · 진행 단계) · 23505는 성공 ·
 * 일부만 들어간 상태(프로필만 있고 검사는 없음 등)에서 다시 불러도 끝까지 간다 · 응답만 끊긴 재시도도 같은 결과.
 */
import { createProfileAndAssessment, type CreateProfileAndAssessmentInput } from '../../src/services/personalityCore'

type Row = Record<string, unknown>

class FakeDb {
  profiles: Row[] = []
  assessments: Row[] = []
  /** 다음 N번의 profiles 삽입은 적용된 뒤 응답이 끊긴다. */
  dropProfileResponse = 0
  failAssessmentOnce = false

  from(table: string) {
    const db = this
    let single = false
    let maybe = false
    const filters: Array<(r: Row) => boolean> = []
    let pendingInsert: Row | null = null
    const run = async (): Promise<{ data: unknown; error: unknown }> => {
      if (pendingInsert) {
        const row = pendingInsert
        if (table === 'profiles') {
          if (db.profiles.some((r) => r.id === row.id)) return { data: null, error: { code: '23505' } }
          db.profiles.push({ ...row })
          if (db.dropProfileResponse > 0) {
            db.dropProfileResponse -= 1
            throw new TypeError('Network request failed')
          }
          return { data: null, error: null }
        }
        if (db.failAssessmentOnce) {
          db.failAssessmentOnce = false
          return { data: null, error: { code: '08006' } }
        }
        if (db.assessments.some((r) => r.user_id === row.user_id && r.seq === row.seq)) {
          return { data: null, error: { code: '23505' } }
        }
        const stored = { id: `a${db.assessments.length + 1}`, ...row }
        db.assessments.push(stored)
        return { data: single ? stored : [stored], error: null }
      }
      const found = db.assessments.filter((r) => filters.every((f) => f(r)))
      return { data: maybe ? (found[0] ?? null) : found, error: null }
    }
    const api: Record<string, unknown> = {
      insert: (row: Row) => ((pendingInsert = row), api),
      upsert: () => {
        throw new Error('upsert는 쓰지 않는다 - 이미 있는 프로필을 덮어쓴다')
      },
      select: () => api,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      single: () => ((single = true), api),
      maybeSingle: () => ((maybe = true), api),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => run().then(resolve, reject),
    }
    return api
  }
}

function input(over: Partial<CreateProfileAndAssessmentInput> = {}): CreateProfileAndAssessmentInput {
  return {
    userId: 'u1',
    name: 'test-세준',
    gender: 'male',
    birthDate: '2000-01-01',
    mbti: 'INFJ',
    mbtiSelfReported: true,
    q1: 'A',
    q2: 'B',
    q3: 'C',
    q4: 'A',
    q5: 'B',
    result: {
      enneagramCore: 4,
      loveTypeCode: 'KLE',
      big5: { bigE: 1, bigO: 2, bigA: 3, bigC: 4, bigN: 5 },
      sternberg: { intimacy: 1, passion: 2, commitment: 3 },
      attachAnxiety: 1,
      attachAvoidance: 2,
      attachment: 'SECURE',
    } as never,
    marketingAgreed: false,
    ...over,
  }
}

const save = (db: FakeDb, over?: Partial<CreateProfileAndAssessmentInput>) =>
  createProfileAndAssessment(db as never, input(over))

describe('없을 때만 넣기', () => {
  it('처음 저장하면 프로필 1행(진행 단계 0 · 세 동의 시각) + 검사 1행(seq 1)', async () => {
    const db = new FakeDb()
    const row = await save(db)
    expect(db.profiles).toHaveLength(1)
    expect(db.profiles[0]).toMatchObject({ id: 'u1', onboarding_step: 0, marketing_agreed_at: null })
    expect(db.profiles[0].terms_agreed_at).toBeTruthy()
    expect(db.assessments).toHaveLength(1)
    expect(row).toMatchObject({ user_id: 'u1', seq: 1 })
  })

  it('저장을 두 번 불러도 같은 결과이고 오류가 없다', async () => {
    const db = new FakeDb()
    const first = await save(db)
    const second = await save(db)
    expect(db.profiles).toHaveLength(1)
    expect(db.assessments).toHaveLength(1)
    expect(second).toEqual(first) // 23505 -> 이미 들어간 검사를 읽어 돌려준다
  })

  it('이미 있는 프로필은 덮어쓰지 않는다 - 이름 · 동의 시각 · 진행 단계 · 마케팅', async () => {
    const db = new FakeDb()
    await save(db)
    db.profiles[0].onboarding_step = 3 // 그 사이 앱이 진행 단계를 올렸다
    const before = JSON.parse(JSON.stringify(db.profiles[0]))
    await save(db, { name: 'test-다른이름', marketingAgreed: true, mbti: 'ENFP' })
    expect(db.profiles[0]).toEqual(before)
    expect(db.profiles[0].onboarding_step).toBe(3)
    expect(db.assessments[0].mbti).toBe('INFJ') // 검사도 덮지 않는다
  })

  it('일부만 들어간 상태(프로필만 있고 검사는 없음)에서 다시 불러도 끝까지 간다', async () => {
    const db = new FakeDb()
    db.failAssessmentOnce = true
    await expect(save(db)).rejects.toMatchObject({ code: '08006' }) // 검사 삽입 실패 -> 프로필만 들어간 상태
    expect(db.profiles).toHaveLength(1)
    expect(db.assessments).toHaveLength(0)

    const row = await save(db)
    expect(db.profiles).toHaveLength(1)
    expect(db.assessments).toHaveLength(1)
    expect(row).toMatchObject({ user_id: 'u1', seq: 1 })
  })

  it('응답만 끊긴 재시도도 같은 결과 - 프로필 삽입이 적용된 뒤 끊겨도 다시 불러 끝까지 간다', async () => {
    const db = new FakeDb()
    db.dropProfileResponse = 1
    await expect(save(db)).rejects.toThrow('Network request failed')
    expect(db.profiles).toHaveLength(1)

    await save(db)
    expect(db.profiles).toHaveLength(1)
    expect(db.assessments).toHaveLength(1)
  })

  it('프로필이 이미 있으면(23505) 오류 없이 지나가고 그 행을 건드리지 않는다', async () => {
    const db = new FakeDb()
    db.profiles.push({ id: 'u1', onboarding_step: 2 })
    await expect(save(db)).resolves.toMatchObject({ seq: 1 })
    expect(db.profiles[0]).toEqual({ id: 'u1', onboarding_step: 2 })
  })
})
