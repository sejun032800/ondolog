/// <reference types="jest" />
/**
 * 91-b 패턴 모드(네 겹 잠금) 시험 - 메모리 가짜 저장소(`resetTestPatternFake.ts`)로, 원격 0 · 가짜 값만.
 * 같은 흐름의 Deno 실행 시험은 `resetTestPatternCheck.ts`.
 */
import { makeProjectGate } from './resetAllowlist.ts'
import { COUPLE_BUCKETS } from './resetTestAccount.ts'
import { isPatternTarget, kstMidnightMs, parsePatternArgs, runPatternReset, type PatternArgs } from './resetTestPattern.ts'
import { baseWorld, makeFakePatternPort, type FakeWorld } from './resetTestPatternFake.ts'

const DEV_REF = 'fakedevref000000aaaa'
const DEV_URL = `https://${DEV_REF}.supabase.co`
const LIST_NO_EMAILS = `# 이메일 줄 0 (C3 6부 뒤)\nproject=${DEV_REF}\n`
const gate = makeProjectGate({ allowlistText: LIST_NO_EMAILS, url: DEV_URL })
const CUTOFF = kstMidnightMs('2026-11-25')!
const preview = (extra: Partial<PatternArgs> = {}): PatternArgs => ({ createdBeforeMs: CUTOFF, apply: false, expectUsers: null, ...extra })
const apply = (n: number): PatternArgs => ({ createdBeforeMs: CUTOFF, apply: true, expectUsers: n })
const WRITE = (c: string) => c.startsWith('removeFiles') || c.startsWith('deleteRows') || c.startsWith('deleteUser')

function run(world: FakeWorld, args: PatternArgs, g = gate) {
  const fake = makeFakePatternPort(world)
  let connected = 0
  const outcome = runPatternReset(() => { connected++; return Promise.resolve(fake.port) }, args, g)
  return { outcome, fake, connected: () => connected }
}
const line = (lines: readonly string[], head: string) => lines.find((l) => l.startsWith(`${head}: `))?.slice(head.length + 2)

describe('91-b 패턴 모드 - 겹 1 이메일 모양', () => {
  it('#1 패턴 밖(카카오 모양 · example.org · testx- · example.com.evil · 이메일 없음)은 대상에서 빠지고 그대로 남는다', async () => {
    const w = baseWorld()
    const outsiders = [
      { id: 'o1', email: 'someone@kakao.com', created_at: '2026-11-01T00:00:00Z' },
      { id: 'o2', email: 'test-a@example.org', created_at: '2026-11-01T00:00:00Z' },
      { id: 'o3', email: 'testx-a@example.com', created_at: '2026-11-01T00:00:00Z' },
      { id: 'o4', email: 'test-a@example.com.evil', created_at: '2026-11-01T00:00:00Z' },
      { id: 'o5', email: 'test-@example.com', created_at: '2026-11-01T00:00:00Z' },
      { id: 'o6', email: 'test-a b@example.com', created_at: '2026-11-01T00:00:00Z' },
    ]
    w.users.push(...outsiders)
    for (const u of outsiders) expect(isPatternTarget(u, CUTOFF)).toBe(false)
    const p = await run(w, preview()).outcome
    expect(p.kind).toBe('previewed')
    expect(line(p.lines, '대상 사용자')).toBe('5')
    expect(line(p.lines, '대상 밖 사용자(남김)')).toBe(String(2 + outsiders.length))

    const r = await run(w, apply(5)).outcome
    expect(r.kind).toBe('applied')
    expect(w.users.map((u) => u.id).sort()).toEqual(['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'u-real1', 'u-real2'])
    expect(w.couples.map((c) => c.id)).toEqual(['c-real'])
    expect(w.rows.messages.map((m) => m.id)).toEqual(['m3'])
    expect(w.files.entries).toEqual(['c-real/x.jpg'])
    expect(w.files.avatars).toEqual(['u-real1/reference'])
  })

  it('시드(test-m2b-*)는 모양이 맞아 대상이고 따로 센다', async () => {
    const w = baseWorld()
    w.users.push({ id: 'u-seed', email: 'test-m2b-a@example.com', created_at: '2026-10-01T00:00:00Z' })
    const p = await run(w, preview()).outcome
    expect(line(p.lines, '대상 사용자')).toBe('6')
    expect(line(p.lines, '그중 시드(test-m2b)')).toBe('1')
  })
})

describe('91-b 패턴 모드 - 전체 거부', () => {
  it('#2 대상 사용자의 커플 상대가 패턴 밖 -> 전체 거부 · 0 삭제 (미리 보기 · apply)', async () => {
    for (const args of [preview(), apply(5)]) {
      const w = baseWorld()
      w.couples.push({ id: 'c-mixed', user_a_id: 'u-t3', user_b_id: 'u-real1', status: 'dissolved', start_date_set_by: null, start_date_confirmed_by: null, nickname_changed_by: null, nickname: null })
      const { outcome, fake } = run(w, args)
      const r = await outcome
      expect(r.kind).toBe('refused')
      expect(r.lines).toHaveLength(1)
      expect(fake.calls.filter(WRITE)).toEqual([])
    }
  })

  it('#2-b 대상의 행이 대상 밖 커플에 있음(실제 커플에 시험 계정이 쓴 메시지) -> 전체 거부', async () => {
    const w = baseWorld()
    w.rows.messages.push({ id: 'm9', couple_id: 'c-real', sender_id: 'u-t1' })
    const { outcome, fake } = run(w, apply(5))
    expect((await outcome).kind).toBe('refused')
    expect(fake.calls.filter(WRITE)).toEqual([])
  })

  it('#2-c 지울 커플에 대상 밖 사람이 쓴 행(cascade가 그 사람 것까지 지움) -> 전체 거부', async () => {
    const w = baseWorld()
    w.rows.data_entries.push({ id: 'e9', couple_id: 'c-t12', author_id: 'u-real2' })
    const { outcome, fake } = run(w, apply(5))
    expect((await outcome).kind).toBe('refused')
    expect(fake.calls.filter(WRITE)).toEqual([])
  })

  it('#2-d 대상 밖 커플의 사귄 날짜를 정한 사람이 대상 -> 전체 거부', async () => {
    const w = baseWorld()
    w.couples[3].start_date_confirmed_by = 'u-t1'
    expect((await run(w, preview()).outcome).kind).toBe('refused')
  })

  it('#2-e 패턴 밖 사용자 수는 실행 전후 같다 - 지우는 호출에 대상 밖 사용자 · 커플이 한 번도 나오지 않는다', async () => {
    const w = baseWorld()
    const { outcome, fake } = run(w, apply(5))
    const r = await outcome
    expect(r.kind).toBe('applied')
    expect(line(r.lines, '대상 밖 사용자 실행 뒤')).toBe('2')
    for (const c of fake.calls.filter(WRITE)) expect(c).not.toMatch(/u-real|c-real/)
  })
})

describe('91-b 패턴 모드 - 겹 3 만든 날짜 상한 · 인자', () => {
  it('#3 --created-before 없음 · 모양 틀림 · 없는 날짜 -> 거부(문구에 값 0)', () => {
    for (const argv of [[], ['--apply'], ['--created-before'], ['--created-before', '2026/11/25'], ['--created-before', '2026-13-01'], ['--created-before', '2026-02-30'], ['--created-before', '20261125']]) {
      let message = ''
      try {
        parsePatternArgs(argv)
      } catch (e) {
        message = (e as Error).message
      }
      expect(message).not.toBe('')
      expect(message).not.toMatch(/2026|20261125/)
    }
  })

  it('인자 읽기: 미리 보기 기본 · apply 는 --expect-users 필수 · 알 수 없는 인자 거부', () => {
    expect(parsePatternArgs(['--created-before', '2026-11-25'])).toEqual({ createdBeforeMs: CUTOFF, apply: false, expectUsers: null })
    expect(parsePatternArgs(['--created-before', '2026-11-25', '--expect-users', '63', '--apply'])).toEqual({ createdBeforeMs: CUTOFF, apply: true, expectUsers: 63 })
    expect(() => parsePatternArgs(['--created-before', '2026-11-25', '--apply'])).toThrow()
    expect(() => parsePatternArgs(['--created-before', '2026-11-25', '--expect-users', 'x'])).toThrow()
    expect(() => parsePatternArgs(['--created-before', '2026-11-25', '--force'])).toThrow()
  })

  it('KST 0시: 2026-11-25 = 2026-11-24T15:00Z', () => {
    expect(new Date(CUTOFF).toISOString()).toBe('2026-11-24T15:00:00.000Z')
  })

  it('#4 상한 뒤(KST 11/25 0시 이후)에 만든 패턴 계정은 대상 아님 · 남는다 (만든 시각 모름도)', async () => {
    const w = baseWorld()
    w.users.push({ id: 'u-new', email: 'test-90-x@example.com', created_at: '2026-11-24T15:00:00Z' })
    w.users.push({ id: 'u-unk', email: 'test-90-y@example.com', created_at: null })
    w.users.push({ id: 'u-edge', email: 'test-90-z@example.com', created_at: '2026-11-24T14:59:59Z' })
    const p = await run(w, preview()).outcome
    expect(line(p.lines, '대상 사용자')).toBe('6')
    await run(w, apply(6)).outcome
    expect(w.users.map((u) => u.id)).toEqual(expect.arrayContaining(['u-new', 'u-unk']))
    expect(w.users.map((u) => u.id)).not.toContain('u-edge')
  })
})

describe('91-b 패턴 모드 - 겹 2 개발 프로젝트', () => {
  it('#5 project= 불일치 · 목록 파일 없음 · project 줄 없음 · URL 없음 -> 접속 전 거부(출력에 ref 0)', async () => {
    const gates = [
      makeProjectGate({ allowlistText: LIST_NO_EMAILS, url: 'https://fakeprodref00000bbbb.supabase.co' }),
      makeProjectGate({ allowlistText: null, url: DEV_URL }),
      makeProjectGate({ allowlistText: 'test-a@example.com\n', url: DEV_URL }),
      makeProjectGate({ allowlistText: LIST_NO_EMAILS, url: undefined }),
    ]
    for (const g of gates) {
      const { outcome, connected } = run(baseWorld(), preview(), g)
      const r = await outcome
      expect(r.kind).toBe('refused')
      expect(connected()).toBe(0)
      expect(r.lines.join(' ')).not.toMatch(/fakeprodref|fakedevref/)
    }
  })

  it('이메일 줄이 0인 목록도 project 만 맞으면 통과', () => {
    expect(gate()).toBeNull()
  })
})

describe('91-b 패턴 모드 - 겹 4 미리 보기 · apply 이중 확인', () => {
  it('#6 미리 보기는 쓰기 호출 0 · 종류별 건수', async () => {
    const w = baseWorld()
    const { outcome, fake } = run(w, preview())
    const r = await outcome
    expect(r.kind).toBe('previewed')
    expect(fake.calls).toEqual([])
    expect(line(r.lines, '대상 사용자')).toBe('5')
    expect(line(r.lines, '그중 커플 없는 사용자')).toBe('0')
    expect(line(r.lines, 'couples')).toBe('3')
    expect(line(r.lines, 'messages')).toBe('2')
    expect(line(r.lines, 'issues')).toBe('1')
    expect(line(r.lines, 'Storage entries')).toBe('2')
    expect(line(r.lines, 'Storage avatars')).toBe('1')
    expect(line(r.lines, 'Storage 합계')).toBe('4')
    expect(line(r.lines, '사용자에 묶이지 않은 커플(지우지 않음)')).toBe('0')
  })

  it('#7 --expect-users 가 다시 센 수와 다름 -> 거부 · 0 삭제', async () => {
    const w = baseWorld()
    const { outcome, fake } = run(w, apply(4))
    expect((await outcome).kind).toBe('refused')
    expect(fake.calls.filter(WRITE)).toEqual([])
    expect(w.users).toHaveLength(7)
  })

  it('#8 커플 없는 시험 사용자 · 해제 유예 중인 시험 커플 -> 코어 순서(커플: Storage -> 호 -> 커플 행 / 사용자: avatars -> 인증 사용자) · R34-3 함수 0', async () => {
    const w = baseWorld()
    w.users.push({ id: 'u-lone', email: 'test-57-lone@example.com', created_at: '2026-11-10T00:00:00Z' })
    const { outcome, fake } = run(w, apply(6))
    const r = await outcome
    expect(r.kind).toBe('applied')
    const writes = fake.calls.filter(WRITE)
    const coupleBlock = (id: string) => [...COUPLE_BUCKETS.map((b) => `removeFiles:${b}:${id}`), `deleteRows:issues:${id}`, `deleteRows:couples:${id}`]
    expect(writes.slice(0, 3 * coupleBlock('x').length)).toEqual([...coupleBlock('c-t12'), ...coupleBlock('c-t3pending'), ...coupleBlock('c-t45')])
    const userPart = writes.slice(3 * coupleBlock('x').length)
    expect(userPart).toEqual(['u-t1', 'u-t2', 'u-t3', 'u-t4', 'u-t5', 'u-lone'].flatMap((u) => [`removeFiles:avatars:${u}`, `deleteUser:${u}`]))
    expect(fake.calls.join(' ')).not.toMatch(/execute_dissolution|apply_retention_policy|run_due_dissolutions/)
    expect(w.rows.couple_dissolutions).toEqual([])
    expect(line(r.lines, '남은 대상 사용자')).toBe('0')
  })

  it('끊겼다 다시 치면 남은 것만 지운다(같은 명령 · 남은 수로 --expect-users)', async () => {
    const w = baseWorld()
    const fake = makeFakePatternPort(w)
    const del = fake.port.deleteUser
    let n = 0
    fake.port.deleteUser = (id) => { if (++n === 3) return Promise.reject(new Error('연결 끊김')); return del(id) }
    await expect(runPatternReset(() => Promise.resolve(fake.port), apply(5), gate)).rejects.toThrow()
    expect(w.couples.map((c) => c.id)).toEqual(['c-real'])
    const again = await run(w, apply(3)).outcome
    expect(again.kind).toBe('applied')
    expect(w.users.map((u) => u.id)).toEqual(['u-real1', 'u-real2'])
  })

  it('사용자에 묶이지 않은 커플(g1 set null 뒤)은 세기만 하고 지우지 않는다', async () => {
    const w = baseWorld()
    w.couples.push({ id: 'c-orphan', user_a_id: null as unknown as string, user_b_id: null, status: 'dissolved', start_date_set_by: null, start_date_confirmed_by: null, nickname_changed_by: null, nickname: null })
    w.rows.messages.push({ id: 'm-o', couple_id: 'c-orphan', sender_id: null })
    w.files.entries.push('c-orphan/z.jpg')
    const p = await run(w, preview()).outcome
    expect(line(p.lines, '사용자에 묶이지 않은 커플(지우지 않음)')).toBe('1')
    expect(line(p.lines, 'couples')).toBe('3')
    const { outcome, fake } = run(w, apply(5))
    expect((await outcome).kind).toBe('applied')
    expect(fake.calls.join(' ')).not.toContain('c-orphan')
    expect(w.couples.map((c) => c.id)).toEqual(['c-real', 'c-orphan'])
    expect(w.files.entries).toContain('c-orphan/z.jpg')
  })
})

describe('91-b 패턴 모드 - 금지 · 출력', () => {
  it('#9 demo_responses · push_daily · app_error_daily 는 읽지도 쓰지도 않는다(행 수 그대로)', async () => {
    const w = baseWorld()
    const before = JSON.stringify(w.untouchable)
    await run(w, preview()).outcome
    await run(w, apply(5)).outcome
    expect(JSON.stringify(w.untouchable)).toBe(before)
  })

  it('#10 출력 · 거부 문구에 id · 이메일 · ref · 별명 0', async () => {
    const texts: string[] = []
    texts.push(...(await run(baseWorld(), preview()).outcome).lines)
    texts.push(...(await run(baseWorld(), apply(4)).outcome).lines)
    const mixed = baseWorld()
    mixed.couples.push({ id: 'c-mixed', user_a_id: 'u-t3', user_b_id: 'u-real1', status: 'active', start_date_set_by: null, start_date_confirmed_by: null, nickname_changed_by: null, nickname: null })
    texts.push(...(await run(mixed, preview()).outcome).lines)
    texts.push(...(await run(baseWorld(), apply(5)).outcome).lines)
    const all = texts.join('\n')
    expect(all).not.toMatch(/u-t\d|u-real|c-t|c-real|c-mixed|@|example|fakedevref|test 별명|진짜커플/)
  })
})
