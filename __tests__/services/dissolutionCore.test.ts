/**
 * 연결 해제 · 탈퇴 코어 (`68-`) - 함수 호출(가짜 클라이언트의 호출 기록) · 오류 코드 매핑 · 유예 상태 읽기 · 순수 규칙(문구 · KST 남은 날짜).
 * 쓰기는 rpc뿐이고 테이블 직접 쓰기 기록(`writes`)은 비어 있어야 한다.
 */
import {
  DissolutionError,
  cancelDissolution,
  cancelWithdrawal,
  fetchDissolutionState,
  requestDissolution,
  requestWithdrawal,
  type DissolutionDb,
} from '../../src/services/dissolutionCore'
import {
  UNLINK_PHRASE,
  WITHDRAW_PHRASE,
  canCancelDissolution,
  graceDateLabel,
  graceDaysLeft,
  isPhraseMatch,
  isWithdrawalPending,
} from '../../src/utils/dissolution'

type Row = Record<string, unknown>

function makeDb(opts: { rpcData?: unknown; rpcError?: { code: string } | null; tables?: Record<string, Row | null> } = {}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = []
  const writes: string[] = []
  const db: DissolutionDb = {
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: opts.rpcData ?? null, error: opts.rpcError ?? null })
    },
    from: (table: string) => {
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        is: () => api,
        or: () => api,
        order: () => api,
        limit: () => api,
        maybeSingle: () => Promise.resolve({ data: opts.tables?.[table] ?? null, error: null }),
        insert: () => (writes.push(`${table}:insert`), api),
        update: () => (writes.push(`${table}:update`), api),
        delete: () => (writes.push(`${table}:delete`), api),
      }
      return api
    },
  }
  return { db, rpcCalls, writes }
}

describe('함수 호출 - 이름 · 인자', () => {
  it('해제 요청 = fn_request_dissolution(인자 없음) -> 해제 id', async () => {
    const { db, rpcCalls, writes } = makeDb({ rpcData: 'd1' })
    await expect(requestDissolution(db)).resolves.toBe('d1')
    expect(rpcCalls).toEqual([{ fn: 'fn_request_dissolution', args: undefined }])
    expect(writes).toEqual([])
  })

  it('해제 취소 = fn_cancel_dissolution({ p_dissolution_id })', async () => {
    const { db, rpcCalls, writes } = makeDb()
    await cancelDissolution(db, 'd1')
    expect(rpcCalls).toEqual([{ fn: 'fn_cancel_dissolution', args: { p_dissolution_id: 'd1' } }])
    expect(writes).toEqual([])
  })

  it('탈퇴 요청 = fn_request_withdrawal(인자 없음) -> 서버가 정한 시각', async () => {
    const { db, rpcCalls, writes } = makeDb({ rpcData: '2026-11-02T00:00:00Z' })
    await expect(requestWithdrawal(db)).resolves.toBe('2026-11-02T00:00:00Z')
    expect(rpcCalls).toEqual([{ fn: 'fn_request_withdrawal', args: undefined }])
    expect(writes).toEqual([])
  })

  it('탈퇴 취소 = fn_cancel_withdrawal(인자 없음)', async () => {
    const { db, rpcCalls, writes } = makeDb()
    await cancelWithdrawal(db)
    expect(rpcCalls).toEqual([{ fn: 'fn_cancel_withdrawal', args: undefined }])
    expect(writes).toEqual([])
  })

  it('유예 기간 인자가 없다 - 7일은 서버가 정한다', async () => {
    const { db, rpcCalls } = makeDb({ rpcData: 'd1' })
    await requestDissolution(db)
    await requestWithdrawal(db)
    for (const c of rpcCalls) expect(c.args).toBeUndefined()
  })
})

describe('오류 코드(027 파일에서 읽음)', () => {
  it.each([
    ['23505', 'in-progress'],
    ['P0002', 'no-couple'],
    ['42501', 'not-allowed'],
    ['22023', 'grace-over'],
    ['28000', 'other'],
  ])('%s -> %s', async (code, kind) => {
    const { db } = makeDb({ rpcError: { code } })
    await expect(requestDissolution(db)).rejects.toMatchObject({ name: 'DissolutionError', kind, code })
    await expect(cancelWithdrawal(db)).rejects.toBeInstanceOf(DissolutionError)
  })

  it('해제 요청이 id를 돌려주지 않으면 실패다', async () => {
    const { db } = makeDb({ rpcData: null })
    await expect(requestDissolution(db)).rejects.toBeInstanceOf(DissolutionError)
  })
})

describe('유예 상태 읽기', () => {
  const couple = { id: 'c1', user_a_id: 'me', user_b_id: 'p' }
  const row = { id: 'd1', couple_id: 'c1', initiated_by: 'me', reason: 'unlink', purge_scheduled_at: '2026-11-02T01:00:00Z' }

  it('dissolving 커플이 없으면 null', async () => {
    const { db } = makeDb({ tables: { couples: null } })
    await expect(fetchDissolutionState(db, 'me')).resolves.toBeNull()
  })

  it('진행 중 해제가 없으면 null', async () => {
    const { db } = makeDb({ tables: { couples: couple, couple_dissolutions: null } })
    await expect(fetchDissolutionState(db, 'me')).resolves.toBeNull()
  })

  it('개시자 · 상대를 구분하고 서버의 purge_scheduled_at을 그대로 담는다', async () => {
    const mine = makeDb({ tables: { couples: couple, couple_dissolutions: row } })
    await expect(fetchDissolutionState(mine.db, 'me')).resolves.toEqual({
      dissolutionId: 'd1',
      coupleId: 'c1',
      partnerId: 'p',
      reason: 'unlink',
      initiatedByMe: true,
      purgeScheduledAt: '2026-11-02T01:00:00Z',
    })
    const theirs = makeDb({ tables: { couples: couple, couple_dissolutions: row } })
    const state = await fetchDissolutionState(theirs.db, 'p')
    expect(state).toMatchObject({ partnerId: 'me', initiatedByMe: false })
    expect(mine.writes).toEqual([])
  })
})

describe('순수 규칙', () => {
  it('문구는 정확히 같아야 한다(앞뒤 공백만 무시)', () => {
    expect(isPhraseMatch(WITHDRAW_PHRASE, WITHDRAW_PHRASE)).toBe(true)
    expect(isPhraseMatch(` ${WITHDRAW_PHRASE} `, WITHDRAW_PHRASE)).toBe(true)
    expect(isPhraseMatch('탈퇴합', WITHDRAW_PHRASE)).toBe(false)
    expect(isPhraseMatch('탈퇴합니다.', WITHDRAW_PHRASE)).toBe(false)
    expect(isPhraseMatch('', WITHDRAW_PHRASE)).toBe(false)
    expect(isPhraseMatch(WITHDRAW_PHRASE, UNLINK_PHRASE)).toBe(false)
  })

  it('남은 날짜는 서버 purge_scheduled_at의 KST 달력 날짜 차이다', () => {
    const now = new Date('2026-10-26T03:00:00Z') // KST 10-26 12:00
    expect(graceDaysLeft('2026-11-02T03:00:00Z', now)).toBe(7)
    expect(graceDaysLeft('2026-10-31T03:00:00Z', now)).toBe(5)
    // UTC로는 10-26이지만 KST로는 10-27 00:30 -> 하루 뒤
    expect(graceDaysLeft('2026-10-26T15:30:00Z', now)).toBe(1)
    expect(graceDaysLeft('2026-10-26T20:00:00Z', now)).toBe(1)
    expect(graceDaysLeft('2026-10-26T03:00:00Z', now)).toBe(0)
    expect(graceDaysLeft('2026-10-20T03:00:00Z', now)).toBe(0) // 지났으면 0
  })

  it('날짜 글자는 서버 값의 KST 날짜', () => {
    expect(graceDateLabel('2026-10-26T15:30:00Z')).toBe('10월 27일')
  })

  it('[취소]는 내가 직접 요청한 해제에만 - 상대 · 탈퇴로 생긴 해제는 없다', () => {
    expect(canCancelDissolution({ initiatedByMe: true, reason: 'unlink' })).toBe(true)
    expect(canCancelDissolution({ initiatedByMe: false, reason: 'unlink' })).toBe(false)
    expect(canCancelDissolution({ initiatedByMe: true, reason: 'withdrawal' })).toBe(false)
  })

  it('탈퇴 유예 판정은 deleted_at 유무', () => {
    expect(isWithdrawalPending({ deleted_at: '2026-10-26T00:00:00Z' })).toBe(true)
    expect(isWithdrawalPending({ deleted_at: null })).toBe(false)
    expect(isWithdrawalPending(null)).toBe(false)
  })
})
