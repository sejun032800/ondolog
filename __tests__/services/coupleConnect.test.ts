/**
 * 커플 연결 (`66-`, R40-2) - `redeemInviteCode`는 026 RPC(`fn_connect_couple`)를 부르고 `couples`를 직접 UPDATE하지 않는다.
 * 오류 3종(P0002 · 22023 · 23505)은 A18 문구로, 그 밖의 오류는 일반 문구로 매핑된다.
 */
import {
  CONNECT_COUPLE_FN,
  CONNECT_ERROR_COPY,
  ConnectCoupleError,
  classifyConnectError,
  connectCouple,
  connectErrorMessage,
  type ConnectDb,
} from '../../src/services/coupleConnectCore'

const calls: { kind: string; name: string; args?: unknown }[] = []

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      calls.push({ kind: 'rpc', name, args })
      return Promise.resolve({ data: 'couple-1', error: null })
    },
    from: (table: string) => {
      calls.push({ kind: 'from', name: table })
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        update: () => {
          calls.push({ kind: 'update', name: table })
          return api
        },
        single: async () => ({ data: { id: 'couple-1', status: 'active' }, error: null }),
      }
      return api
    },
  },
}))

import { redeemInviteCode } from '../../src/services/coupleApi'

beforeEach(() => {
  calls.length = 0
})

describe('연결 오류 매핑', () => {
  it('P0002 무효 · 22023 자기 코드 · 23505 이미 커플 -> 보드 문구', () => {
    expect(classifyConnectError({ code: 'P0002' })).toBe('invalid')
    expect(classifyConnectError({ code: '22023' })).toBe('own')
    expect(classifyConnectError({ code: '23505' })).toBe('already')
    expect(connectErrorMessage({ code: '23505' })).toBe('이미 다른 사람과 연결된 코드는 쓸 수 없어요') // A18 보드 원문
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
    await expect(connectCouple(db, 'ABC234')).rejects.toMatchObject({
      name: 'ConnectCoupleError',
      kind: 'own',
      message: CONNECT_ERROR_COPY.own,
    })
    await expect(connectCouple(db, 'ABC234')).rejects.toBeInstanceOf(ConnectCoupleError)
  })
})

describe('redeemInviteCode', () => {
  it('RPC를 부르고 couples를 직접 UPDATE하지 않는다', async () => {
    const row = await redeemInviteCode('u-b', 'abc234')
    expect(calls[0]).toEqual({ kind: 'rpc', name: CONNECT_COUPLE_FN, args: { p_invite_code: 'abc234' } })
    expect(calls.filter((c) => c.kind === 'update')).toEqual([])
    expect(row.id).toBe('couple-1')
  })
})
