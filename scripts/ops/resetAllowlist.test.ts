/// <reference types="jest" />
/**
 * 초기화 스크립트 잠금 (75- 0-6) 시험 - 허용 목록(저장소 밖 파일) · 개발 프로젝트 확인. 가짜 값만 쓴다.
 * 흐름 전체(가짜 접속 · 단독/커플 · --with-issues)는 Deno 시험 `resetTestAccountCheck.ts`의 "75- 0-6" 묶음이 본다.
 */

import {
  RESET_ALLOWLIST_ENV,
  makeResetGate,
  parseAllowlist,
  resolveAllowlistPath,
} from './resetAllowlist.ts'
import { runCoupleReset, runReset, type ResetPort } from './resetTestAccount.ts'

const DEV_REF = 'fakedevref000000aaaa'
const PROD_REF = 'fakeprodref00000bbbb'
const DEV_URL = `https://${DEV_REF}.supabase.co`
const A = 'tester@example.com'
const B = 'partner@example.com'
const OUTSIDER = 'outsider@example.com'
const LIST = ['# 시험용 가짜 목록', `project=${DEV_REF}`, '', `  ${A.toUpperCase()}  # 대소문자 무시`, B].join('\n')

const envOf = (vars: Record<string, string>) => (name: string) => vars[name]

describe('허용 목록 파일 위치', () => {
  it('환경변수가 있으면 그 경로', () => {
    expect(resolveAllowlistPath(envOf({ [RESET_ALLOWLIST_ENV]: '/fake/list.txt', HOME: '/home/x' }))).toBe('/fake/list.txt')
  })
  it('없으면 홈 아래 .ondolog/reset-allowlist.txt (Windows 홈 우선)', () => {
    expect(resolveAllowlistPath(envOf({ USERPROFILE: 'C:\\Users\\fake', HOME: '/home/x' }))).toBe('C:\\Users\\fake\\.ondolog\\reset-allowlist.txt')
    expect(resolveAllowlistPath(envOf({ HOME: '/home/fake/' }))).toBe('/home/fake/.ondolog/reset-allowlist.txt')
  })
  it('홈도 모르면 null (-> 거부)', () => {
    expect(resolveAllowlistPath(envOf({}))).toBeNull()
  })
})

describe('허용 목록 형식', () => {
  it('주석 · 빈 줄 무시, 이메일은 소문자로, project= 줄은 ref', () => {
    const list = parseAllowlist(`\uFEFF${LIST}\r\n`)
    expect([...list.emails].sort()).toEqual([B, A].sort())
    expect([...list.projects]).toEqual([DEV_REF])
  })
  it('모양이 틀린 줄은 줄 번호만 알리고 내용은 내지 않는다', () => {
    expect(() => parseAllowlist(`project=${DEV_REF}\nnot-an-email-line`)).toThrow('2번째 줄')
    try {
      parseAllowlist('secret-looking-value')
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('secret-looking-value')
    }
    expect(() => parseAllowlist('project=')).toThrow('1번째 줄')
  })
})

describe('문(gate) - 접속 전 판정 (75- 0-6)', () => {
  const gate = makeResetGate({ allowlistText: LIST, url: DEV_URL })

  it('목록 안 이메일 + 개발 프로젝트 = 통과 (단독 · 커플, 대소문자 무시)', () => {
    expect(gate([A])).toBeNull()
    expect(gate([A.toUpperCase(), ` ${B} `])).toBeNull()
  })

  it('목록 밖 이메일은 거부 - 커플에서 한 명만 밖이어도 거부, 문구에 이메일 0', () => {
    for (const emails of [[OUTSIDER], [A, OUTSIDER], [OUTSIDER, B]]) {
      const reason = gate(emails)
      expect(reason).toBe('허용 목록에 없는 이메일이다')
      expect(reason).not.toContain('@')
    }
  })

  it('목록 파일이 없으면 거부', () => {
    expect(makeResetGate({ allowlistText: null, url: DEV_URL })([A])).toMatch(/허용 목록 파일이 없/)
  })

  it('개발 프로젝트가 아니면 거부 - 다른 ref · project 줄 없음 · URL 없음/모양 틀림, 문구에 ref 0', () => {
    const cases = [
      makeResetGate({ allowlistText: LIST, url: `https://${PROD_REF}.supabase.co` }),
      makeResetGate({ allowlistText: [A, B].join('\n'), url: DEV_URL }),
      makeResetGate({ allowlistText: LIST, url: undefined }),
      makeResetGate({ allowlistText: LIST, url: 'http://localhost:54321' }),
    ]
    for (const g of cases) {
      const reason = g([A])
      expect(reason).not.toBeNull()
      expect(reason).not.toContain(PROD_REF)
      expect(reason).not.toContain(DEV_REF)
      expect(reason).not.toContain('@')
    }
    expect(cases[0]([A])).toBe('개발 프로젝트가 아니다(허용 목록의 project와 다르다)')
  })

  it('목록 · 프로젝트 판정이 이메일 판정보다 먼저다 (목록 밖 이메일이어도 개발 아님이 먼저 보인다)', () => {
    const g = makeResetGate({ allowlistText: LIST, url: `https://${PROD_REF}.supabase.co` })
    expect(g([OUTSIDER])).toBe('개발 프로젝트가 아니다(허용 목록의 project와 다르다)')
  })

  it('같은 입력 -> 같은 결과 (순수)', () => {
    expect(gate([OUTSIDER])).toBe(gate([OUTSIDER]))
    expect(gate([A])).toBe(gate([A]))
  })
})

describe('runReset / runCoupleReset - 거부는 접속(네트워크) 전 (75- 0-6)', () => {
  const gate = makeResetGate({ allowlistText: LIST, url: DEV_URL })
  const neverConnect = () => jest.fn(() => Promise.reject(new Error('connect must not be called')))

  /** 가짜 접속 - A·B 두 사람이 한 커플. 지우는 호출을 기록한다. */
  function fakePort() {
    const calls: string[] = []
    const users: Record<string, string[]> = { [A]: ['fake-user-a'], [B]: ['fake-user-b'] }
    const pair = { id: 'fake-couple', user_a_id: 'fake-user-a', user_b_id: 'fake-user-b' }
    const port: ResetPort = {
      findUserIds: async (e) => users[e] ?? [],
      listCouples: async () => [pair],
      hasPublishedIssue: async () => true,
      count: async (table) => (table === 'issues' ? 1 : 0),
      countFiles: async () => 0,
      removeFiles: async (bucket) => (calls.push(`removeFiles:${bucket}`), 0),
      deleteRows: async (table) => void calls.push(`deleteRows:${table}`),
      deleteUser: async () => void calls.push('deleteUser'),
      withdrawalStartedAt: async () => null,
    }
    return { port, calls }
  }

  it('목록 밖 이메일 미리 보기 -> 거부, 접속 0 (단독 · 커플 --with-issues)', async () => {
    const connect = neverConnect()
    const r = await runReset(connect, { email: OUTSIDER, apply: false }, gate)
    expect(r.kind).toBe('refused')
    expect(r.lines.join(' ')).not.toContain(OUTSIDER)
    const c = await runCoupleReset(connect, { emails: [A, OUTSIDER], apply: false, withIssues: true }, gate)
    expect(c.kind).toBe('refused')
    expect(connect).not.toHaveBeenCalled()
  })

  it('목록 파일 없음 · 개발 아님 -> 거부, 접속 0', async () => {
    const connect = neverConnect()
    const noList = makeResetGate({ allowlistText: null, url: DEV_URL })
    const prod = makeResetGate({ allowlistText: LIST, url: `https://${PROD_REF}.supabase.co` })
    expect((await runReset(connect, { email: A, apply: false }, noList)).kind).toBe('refused')
    expect((await runCoupleReset(connect, { emails: [A, B], apply: true, withIssues: true }, prod)).kind).toBe('refused')
    expect(connect).not.toHaveBeenCalled()
  })

  it('목록 안 + 개발 프로젝트면 전처럼 동작 (커플 미리 보기 -> --with-issues --apply)', async () => {
    const preview = fakePort()
    const p = await runCoupleReset(async () => preview.port, { emails: [A, B], apply: false, withIssues: true }, gate)
    expect(p.kind).toBe('previewed')
    expect(preview.calls).toEqual([])

    const apply = fakePort()
    const r = await runCoupleReset(async () => apply.port, { emails: [A, B], apply: true, withIssues: true }, gate)
    expect(r.kind).toBe('applied')
    expect(apply.calls).toContain('deleteRows:issues')
    expect(apply.calls.filter((c) => c === 'deleteUser')).toHaveLength(2)
    expect(r.lines.join(' ')).not.toMatch(/@|fake-user|fake-couple/)
  })
})
