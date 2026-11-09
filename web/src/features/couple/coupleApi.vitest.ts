/**
 * 커플 연결 · 사귄 날짜 서버 호출(웹판 `couple/coupleApi.ts`) 시험 - RN 시험의 행동 단언을 옮긴 것.
 * 원본: `__tests__/services/coupleConnect.test.ts` · `coupleStartApi.test.ts` · `onboardingStep.test.ts` · `utils/coupleStart.test.ts` · `utils/afterLogin.test.ts`(resumePathFor).
 * 가짜 클라이언트(`testSupportCouple.ts`)만 쓴다 - 원격 0.
 */
import { describe, expect, it } from 'vitest'
import {
  CONNECT_COUPLE_FN, CONNECT_ERROR_COPY, ConnectCoupleError, classifyConnectError, connectCouple, connectErrorMessage, type ConnectDb,
} from '@/services/coupleConnectCore'
import {
  formatStartDateInput, isStartDateSelectable, isValidNickname, nicknameLength, normalizeNickname, parseStartDateInput, withGwa, withIga,
} from '@/utils/coupleStart'
import { needsStartDateConfirm } from '@/utils/settingsRules'
import { resolveWebRoute, webRouteForStep } from '../../auth/finalize'
import {
  completeOnboardingWithoutCouple, fetchExistingInvite, generateInviteCode, getOrCreateInvite, markInviteDoneAwaitingStartDate,
  markStartDateOnboardingComplete, redeemInviteCode, saveStartDateAndNickname, setOrConfirmStartDate,
} from '../../couple/coupleApi'
import { makeCoupleDb, stepWrites } from '../../testSupportCouple'

describe('연결 오류 매핑(coupleConnect.test.ts)', () => {
  it('P0002 무효 · 22023 자기 코드 · 23505 이미 커플 -> 보드 문구', () => {
    expect(classifyConnectError({ code: 'P0002' })).toBe('invalid')
    expect(classifyConnectError({ code: '22023' })).toBe('own')
    expect(classifyConnectError({ code: '23505' })).toBe('already')
    expect(connectErrorMessage({ code: '23505' })).toBe('이미 다른 사람과 연결된 코드는 쓸 수 없어요')
    expect(new Set([CONNECT_ERROR_COPY.invalid, CONNECT_ERROR_COPY.own, CONNECT_ERROR_COPY.already]).size).toBe(3)
  })

  it('그 밖의 오류(28000 · 네트워크 · 코드 없음) -> 일반 처리', () => {
    for (const e of [{ code: '28000' }, { code: '42501' }, { code: null }, {}, null, undefined]) {
      expect(classifyConnectError(e)).toBe('other')
      expect(connectErrorMessage(e)).toBe(CONNECT_ERROR_COPY.other)
    }
  })

  it('connectCouple은 오류 코드를 ConnectCoupleError(kind · message)로 던진다', async () => {
    const db: ConnectDb = { rpc: async () => ({ data: null, error: { code: '22023', message: 'own invite code' } }) }
    await expect(connectCouple(db, 'ABC234')).rejects.toMatchObject({ name: 'ConnectCoupleError', kind: 'own', message: CONNECT_ERROR_COPY.own })
    await expect(connectCouple(db, 'ABC234')).rejects.toBeInstanceOf(ConnectCoupleError)
  })
})

describe('redeemInviteCode', () => {
  it('RPC를 부르고 couples를 직접 UPDATE하지 않는다', async () => {
    const { client, rpcCalls, writes } = makeCoupleDb({ couples: [{ id: 'c1', status: 'active', user_a_id: 'a', user_b_id: 'b' }] })
    const row = await redeemInviteCode(client, 'abc234')
    expect(rpcCalls[0]).toEqual({ fn: CONNECT_COUPLE_FN, args: { p_invite_code: 'abc234' } })
    expect(writes).toEqual([])
    expect(row.id).toBe('c1')
  })

  it('RPC가 P0002 · 22023 · 23505를 돌려주면 ConnectCoupleError(보드 문구)로 던지고 아무것도 쓰지 않는다', async () => {
    for (const [code, kind] of [['P0002', 'invalid'], ['22023', 'own'], ['23505', 'already']] as const) {
      const { client, writes } = makeCoupleDb({ rpc: () => ({ data: null, error: { code } }) })
      await expect(redeemInviteCode(client, 'ABC234')).rejects.toMatchObject({ kind, message: CONNECT_ERROR_COPY[kind] })
      expect(writes).toEqual([])
    }
  })
})

describe('초대 코드 발급(getOrCreateInvite · fetchExistingInvite)', () => {
  it('코드는 0/O · 1/I를 뺀 6자리다', () => {
    const picks = [0, 0.3, 0.6, 0.99, 0.5, 0.1]
    let i = 0
    const code = generateInviteCode(() => picks[i++ % picks.length])
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    for (let n = 0; n < 200; n++) expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('읽기만 하는 조회는 커플 행을 만들지 않는다', async () => {
    const { client, writes } = makeCoupleDb()
    expect(await fetchExistingInvite(client, 'me')).toBeNull()
    expect(writes).toEqual([])
  })

  it('이미 pending · active 행이 있으면 그대로 돌려주고 새로 만들지 않는다', async () => {
    const pending = makeCoupleDb({ couples: [{ id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', invite_code: 'AB23CD' }] })
    const a = await getOrCreateInvite(pending.client, 'me')
    expect(a.status).toBe('pending')
    expect(a.couple.invite_code).toBe('AB23CD')
    const active = makeCoupleDb({ couples: [{ id: 'c1', user_a_id: 'x', user_b_id: 'me', status: 'active', invite_code: 'AB23CD' }] })
    expect((await getOrCreateInvite(active.client, 'me')).status).toBe('connected')
    expect(pending.writes).toEqual([])
    expect(active.writes).toEqual([])
  })

  it('없으면 한 번 발급한다(내가 a, b는 비어 있음)', async () => {
    const { client, writes } = makeCoupleDb()
    const r = await getOrCreateInvite(client, 'me')
    expect(r.status).toBe('pending')
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ table: 'couples', op: 'insert' })
    expect(writes[0].payload.user_a_id).toBe('me')
    expect(Object.keys(writes[0].payload).sort()).toEqual(['invite_code', 'user_a_id'])
  })

  it('코드가 겹치면(23505) 다시 만들고, 다른 오류는 바로 던진다', async () => {
    const dup = makeCoupleDb({ insertErrors: [{ code: '23505' }, { code: '23505' }, undefined] })
    expect((await getOrCreateInvite(dup.client, 'me')).status).toBe('pending')
    expect(dup.writes).toHaveLength(3)
    const bad = makeCoupleDb({ insertErrors: [{ code: '42501' }] })
    await expect(getOrCreateInvite(bad.client, 'me')).rejects.toMatchObject({ code: '42501' })
    expect(bad.writes).toHaveLength(1)
  })
})

describe('진행 단계는 올리기만 한다(onboardingStep.test.ts)', () => {
  const profile = (step: number) => makeCoupleDb({ profiles: [{ id: 'me', onboarding_step: step }] })

  it('완료(3)인 계정에 어떤 함수를 불러도 3이 그대로다 - 쓰기 0', async () => {
    const { client, tables, writes } = profile(3)
    await markInviteDoneAwaitingStartDate(client, 'me')
    await completeOnboardingWithoutCouple(client, 'me')
    await markStartDateOnboardingComplete(client, 'me')
    expect(tables.profiles[0].onboarding_step).toBe(3)
    expect(writes).toEqual([])
  })

  it('가입 직후(1)에서는 순서대로 올라간다 - 초대 끝 2, 사귄 날짜 끝 3', async () => {
    const { client, tables, writes } = profile(1)
    await markInviteDoneAwaitingStartDate(client, 'me')
    await markStartDateOnboardingComplete(client, 'me')
    expect(stepWrites(writes).map((w) => w.payload.onboarding_step)).toEqual([2, 3])
    expect(tables.profiles[0].onboarding_step).toBe(3)
  })

  it('"나중에" · "솔로예요"는 단계를 3으로 올린다(그 뒤 2로 내려가지 않는다)', async () => {
    const { client, tables } = profile(1)
    await completeOnboardingWithoutCouple(client, 'me')
    await markInviteDoneAwaitingStartDate(client, 'me')
    expect(tables.profiles[0].onboarding_step).toBe(3)
  })
})

describe('A20 먼저 입력한 값이 적용된다(coupleStartApi.test.ts)', () => {
  const base = { id: 'c1', user_a_id: 'a', user_b_id: 'b', relationship_start_date: null, start_date_set_by: null, start_date_confirmed_by: null, nickname: null }

  it('날짜가 비어 있으면 첫 입력이 확정된다 - 정한 사람이 기록된다', async () => {
    const { client, writes } = makeCoupleDb({ couples: [base] })
    const row = await setOrConfirmStartDate(client, 'c1', 'a', '2025-12-27')
    expect(row.relationship_start_date).toBe('2025-12-27')
    expect(row.start_date_set_by).toBe('a')
    expect(writes.map((w) => w.payload)).toEqual([{ relationship_start_date: '2025-12-27', start_date_set_by: 'a' }])
  })

  it('이미 날짜가 있으면 뒤에 입력한 값은 적용되지 않는다 - 상대는 확인만 기록한다', async () => {
    const { client, writes } = makeCoupleDb({ couples: [{ ...base, relationship_start_date: '2025-12-27', start_date_set_by: 'a' }] })
    const row = await setOrConfirmStartDate(client, 'c1', 'b', '2024-01-01')
    expect(row.relationship_start_date).toBe('2025-12-27')
    expect(row.start_date_set_by).toBe('a')
    expect(row.start_date_confirmed_by).toBe('b')
    expect(writes.map((w) => w.payload)).toEqual([{ start_date_confirmed_by: 'b' }])
  })

  it('확인([확인했어요])은 상대가 정한 같은 날짜로 부르면 확인만 남는다', async () => {
    const { client, writes } = makeCoupleDb({ couples: [{ ...base, relationship_start_date: '2025-12-27', start_date_set_by: 'a' }] })
    await setOrConfirmStartDate(client, 'c1', 'b', '2025-12-27')
    expect(writes.map((w) => w.payload)).toEqual([{ start_date_confirmed_by: 'b' }])
  })

  describe('A19 저장 - 날짜 + 닉네임', () => {
    const now = new Date('2026-10-25T03:00:00Z') // KST 12:00

    it('내가 날짜를 정한 쪽이면 닉네임도 쓴다(앞뒤 공백은 지운다)', async () => {
      const { client, writes } = makeCoupleDb({ couples: [base] })
      const row = await saveStartDateAndNickname(client, 'c1', 'a', '2025-12-27', '  늘봄 ', now)
      expect(row.relationship_start_date).toBe('2025-12-27')
      expect(row.nickname).toBe('늘봄')
      expect(writes.map((w) => w.payload)).toEqual([{ relationship_start_date: '2025-12-27', start_date_set_by: 'a' }, { nickname: '늘봄' }])
    })

    it('상대가 먼저 날짜를 정했다면 닉네임도 덮지 않는다', async () => {
      const { client, writes } = makeCoupleDb({ couples: [{ ...base, relationship_start_date: '2025-12-27', start_date_set_by: 'a', nickname: '늘봄' }] })
      const row = await saveStartDateAndNickname(client, 'c1', 'b', '2024-01-01', '다른이름', now)
      expect(row.nickname).toBe('늘봄')
      expect(row.relationship_start_date).toBe('2025-12-27')
      expect(writes.map((w) => w.payload)).toEqual([{ start_date_confirmed_by: 'b' }])
    })

    it('미래 날짜는 저장 함수에서도 거부한다 - 아무것도 쓰지 않는다', async () => {
      const { client, writes } = makeCoupleDb({ couples: [base] })
      await expect(saveStartDateAndNickname(client, 'c1', 'a', '2026-10-26', '늘봄', now)).rejects.toThrow()
      expect(writes).toEqual([])
    })

    it('닉네임이 0자 · 21자면 거부, 1자 · 20자는 저장', async () => {
      const bad = makeCoupleDb({ couples: [base] })
      await expect(saveStartDateAndNickname(bad.client, 'c1', 'a', '2025-12-27', '', now)).rejects.toThrow()
      await expect(saveStartDateAndNickname(bad.client, 'c1', 'a', '2025-12-27', '가'.repeat(21), now)).rejects.toThrow()
      expect(bad.writes).toEqual([])
      const one = makeCoupleDb({ couples: [base] })
      expect((await saveStartDateAndNickname(one.client, 'c1', 'a', '2025-12-27', '가', now)).nickname).toBe('가')
      const twenty = makeCoupleDb({ couples: [base] })
      expect((await saveStartDateAndNickname(twenty.client, 'c1', 'a', '2025-12-27', '가'.repeat(20), now)).nickname).toBe('가'.repeat(20))
    })
  })
})

describe('A19 순수 규칙(coupleStart.test.ts) - 웹이 같은 함수를 쓴다', () => {
  it('닉네임 0자 · 공백뿐 거부, 1자 · 20자 허용, 21자 거부, 코드 포인트로 센다', () => {
    expect(isValidNickname('')).toBe(false)
    expect(isValidNickname('   ')).toBe(false)
    expect(isValidNickname('가')).toBe(true)
    expect(isValidNickname('가'.repeat(20))).toBe(true)
    expect(isValidNickname('가'.repeat(21))).toBe(false)
    expect(nicknameLength('  늘봄  ')).toBe(2)
    expect(normalizeNickname('  늘봄  ')).toBe('늘봄')
    expect(isValidNickname('🌙'.repeat(20))).toBe(true)
    expect(isValidNickname('🌙'.repeat(21))).toBe(false)
  })

  it('사귄 날짜: 오늘(KST)까지, 내일부터 불가 - KST 자정 경계', () => {
    const justAfterKstMidnight = new Date('2026-10-24T15:30:00Z') // KST 10-25 00:30
    const justBeforeKstMidnight = new Date('2026-10-24T14:59:00Z') // KST 10-24 23:59
    expect(isStartDateSelectable('2026-10-25', justAfterKstMidnight)).toBe(true)
    expect(isStartDateSelectable('2026-10-24', justBeforeKstMidnight)).toBe(true)
    expect(isStartDateSelectable('2026-10-26', justAfterKstMidnight)).toBe(false)
    expect(isStartDateSelectable('2026-10-25', justBeforeKstMidnight)).toBe(false)
    expect(isStartDateSelectable('2025-02-29', justAfterKstMidnight)).toBe(false)
    expect(isStartDateSelectable('1929-12-31', justAfterKstMidnight)).toBe(false)
    expect(parseStartDateInput('2025.12.27', justAfterKstMidnight)).toBe('2025-12-27')
    expect(parseStartDateInput('2026.10.26', justAfterKstMidnight)).toBeNull()
    expect(formatStartDateInput('20251227')).toBe('2025.12.27')
  })

  it('조사: 받침이 있으면 과 · 이, 없으면 와 · 가, 한글이 아니면 와 · 가', () => {
    expect(withGwa('서영')).toBe('서영과')
    expect(withGwa('지수')).toBe('지수와')
    expect(withIga('서영')).toBe('서영이')
    expect(withIga('Amy')).toBe('Amy가')
  })
})

describe('A20 재표시 판정(settingsRules.test.ts)', () => {
  const base = { relationship_start_date: '2025-12-27', start_date_set_by: 'p', start_date_confirmed_by: null }
  it('정한 사람이 상대이고 확인자가 없으면 참, 나머지는 거짓', () => {
    expect(needsStartDateConfirm(base, 'me')).toBe(true)
    expect(needsStartDateConfirm({ ...base, start_date_set_by: 'me' }, 'me')).toBe(false)
    expect(needsStartDateConfirm({ ...base, start_date_confirmed_by: 'me' }, 'me')).toBe(false)
    expect(needsStartDateConfirm({ ...base, relationship_start_date: null }, 'me')).toBe(false)
    expect(needsStartDateConfirm({ ...base, start_date_set_by: null }, 'me')).toBe(false)
    expect(needsStartDateConfirm(null, 'me')).toBe(false)
    expect(needsStartDateConfirm(base, null)).toBe(false)
  })
})

describe('서버 진행 단계 -> 화면(afterLogin.test.ts resumePathFor · 웹 resolveWebRoute)', () => {
  it('0 -> 결과 상세, 1 -> 초대, 2 -> 연결됐고 날짜 없으면 사귄 날짜 아니면 메인, 3 -> 메인', () => {
    expect(webRouteForStep(0)).toBe('detail')
    expect(webRouteForStep(1)).toBe('invite')
    expect(webRouteForStep(2, { connectedWithoutStartDate: true })).toBe('start-date')
    expect(webRouteForStep(2, { connectedWithoutStartDate: false })).toBe('main')
    expect(webRouteForStep(3, { connectedWithoutStartDate: true })).toBe('main')
  })

  const active = { id: 'c1', user_a_id: 'me', user_b_id: 'p', status: 'active' }

  it('단계 2 + 커플 연결 + 사귄 날짜 없음 -> 사귄 날짜 입력', async () => {
    const { client } = makeCoupleDb({ couples: [{ ...active, relationship_start_date: null }] })
    expect(await resolveWebRoute(client, 'me', 2)).toBe('start-date')
  })

  it('단계 2 + 커플 연결 + 사귄 날짜 있음 -> 메인', async () => {
    const { client } = makeCoupleDb({ couples: [{ ...active, relationship_start_date: '2025-12-27' }] })
    expect(await resolveWebRoute(client, 'me', 2)).toBe('main')
  })

  it('단계 2 + 미연결(대기 행만 있음) -> 메인', async () => {
    const { client } = makeCoupleDb({ couples: [{ id: 'c1', user_a_id: 'me', user_b_id: null, status: 'pending', relationship_start_date: null }] })
    expect(await resolveWebRoute(client, 'me', 2)).toBe('main')
  })

  it('단계 2에서 커플 조회가 실패하면 RN처럼 미연결로 보고 메인', async () => {
    const { client } = makeCoupleDb({ couples: [{ ...active, relationship_start_date: null }], failCoupleReads: true })
    expect(await resolveWebRoute(client, 'me', 2)).toBe('main')
  })

  it('단계 0 · 1 · 3은 서버를 더 부르지 않는다(커플 조회 0)', async () => {
    const { client, tables } = makeCoupleDb({ couples: [{ ...active, relationship_start_date: null }] })
    let reads = 0
    const orig = client.from.bind(client)
    ;(client as unknown as { from: (t: string) => unknown }).from = (t: string) => { if (t === 'couples') reads += 1; return orig(t as never) }
    expect(await resolveWebRoute(client, 'me', 0)).toBe('detail')
    expect(await resolveWebRoute(client, 'me', 1)).toBe('invite')
    expect(await resolveWebRoute(client, 'me', 3)).toBe('main')
    expect(reads).toBe(0)
    expect(tables.couples).toHaveLength(1)
  })
})
