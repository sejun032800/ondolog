/**
 * 시험 보조(시험 파일이 아니다) - 설정 시험의 고정 값과 가짜 서버 만들기. 실제 주소 · 키 · 이메일은 어디에도 없다.
 * 쓰기는 `makeCoupleDb`의 `writes`(표 · 종류 · 내용)와 `rpcCalls`(함수 이름 · 인자)에 모두 남는다.
 */
import { setSupabaseForTest } from '../../auth/client'
import { makeCoupleDb, type CoupleDbOptions, type FakeRow } from '../../testSupportCouple'

export const ME: FakeRow = {
  id: 'me', display_name: '세준', gender: 'male', birth_date: '1995-05-05', mbti: 'INFJ', onboarding_step: 3,
  marketing_agreed_at: null, deleted_at: null, purge_scheduled_at: null,
}
export const PARTNER: FakeRow = { id: 'p1', display_name: '서영', gender: 'female', birth_date: '1996-06-06', onboarding_step: 3, deleted_at: null }
export const ACTIVE: FakeRow = {
  id: 'c1', user_a_id: 'p1', user_b_id: 'me', status: 'active', relationship_start_date: '2025-01-01',
  start_date_set_by: 'p1', start_date_confirmed_by: 'me', nickname: '늘봄', invite_code: 'AB23CD',
}
export const PERSONALITY: FakeRow = {
  user_id: 'me', active_assessment_id: 'a1', enneagram_inferred: 4, enneagram_override: null, enneagram_effective: 4,
  override_count: 0, attachment: 'secure', retest_used: false, love_type_code: 'x',
}
export const ASSESSMENT: FakeRow = {
  id: 'a1', user_id: 'me', seq: 1, mbti: 'INFJ', q1: 'A', q2: 'B', q3: 'A', q4: 'B', q5: 'A',
  big_e: 40, big_o: 70, big_a: 60, big_c: 55, big_n: 35, stern_intimacy: 60, stern_passion: 50, stern_commitment: 55,
}
/** 해제 중인 커플(상대가 개시자) · 진행 중 해제 행. 파기 예정일은 KST 10월 26일. */
export const DISSOLVING: FakeRow = { ...ACTIVE, status: 'dissolving' }
export const DISSOLUTION_BY_PARTNER: FakeRow = {
  id: 'd1', couple_id: 'c1', initiated_by: 'p1', reason: 'unlink', purge_scheduled_at: '2025-10-26T00:00:00+09:00',
  executed_at: null, cancelled_at: null, requested_at: '2025-10-19T00:00:00+09:00',
}
export const DISSOLUTION_BY_ME: FakeRow = { ...DISSOLUTION_BY_PARTNER, initiated_by: 'me' }

/** 시험의 "지금"(KST 2025-10-21 낮). `vi.setSystemTime`에 넣는다. */
export const NOW = new Date('2025-10-21T12:00:00+09:00')

export type SettingsDbOptions = CoupleDbOptions & { personality?: FakeRow | null; assessment?: FakeRow | null; dissolutions?: FakeRow[] }

/** 연결된 커플 + 성격 결과가 있는 기본 서버. `opts`로 표를 바꾼다. 만든 클라이언트를 앱에 꽂는다. */
export function settingsDb(opts: SettingsDbOptions = {}) {
  const { personality = PERSONALITY, assessment = ASSESSMENT, dissolutions = [], ...rest } = opts
  const db = makeCoupleDb({
    profiles: [ME, PARTNER],
    couples: [ACTIVE],
    session: { user: { id: 'me', app_metadata: { provider: 'kakao' } } },
    ...rest,
    extraTables: {
      personality_profiles: personality ? [personality] : [],
      personality_assessments: assessment ? [assessment] : [],
      couple_dissolutions: dissolutions,
      ...(rest.extraTables ?? {}),
    },
  })
  setSupabaseForTest(db.client)
  return db
}

/** 실행 함수 이름 - 앱 어디서도 부르면 안 된다(R34-3). */
export const FORBIDDEN_RPC = ['execute_dissolution', 'apply_retention_policy', 'run_due_dissolutions', 'fn_execute_dissolution', 'fn_apply_retention_policy', 'fn_run_due_dissolutions']
