/// <reference types="jest" />
/**
 * 76-f (c) · 76-g ③ 탈퇴 최종 삭제 시험 - 가짜 접속(메모리 표 · 파일)만. 원격 0.
 * 실제 DB 동작(m1 칸 비움 · 남은 사람 그대로)은 PGlite 시험 `__tests__/db/withdrawalPurge76g.test.ts`.
 */
import fs from 'fs'
import path from 'path'
import { makeProjectGate } from './sweepOrphanFiles.ts'
import { parsePurgeArgs, runPurge, type CoupleWithStatus, type PurgePort } from './purgeWithdrawn.ts'

const DEV_REF = 'fakedevref000000aaaa'
const gate = makeProjectGate({ allowlistText: `project=${DEV_REF}\n`, url: `https://${DEV_REF}.supabase.co` })
const NOW = new Date('2026-11-16T00:00:00Z')
const PAST = '2026-11-01T00:00:00Z'
const FUTURE = '2026-11-20T00:00:00Z'

interface Profile { id: string; deleted_at: string | null; purge_scheduled_at: string | null }
interface Rec { table: 'data_entries' | 'messages' | 'stories'; couple_id: string; author: string; path: string; date_id?: string; deleted?: boolean }
interface Stop { id: string; couple_id: string; date_id: string; author: string | null }
interface Diss { couple_id: string; initiated_by: string | null; executed: boolean; cancelled: boolean }
interface World {
  profiles: Profile[]
  couples: (CoupleWithStatus & { status: string })[]
  /** 커플/사용자 접두 -> 버킷별 파일 수 */
  files: Record<string, Record<string, number>>
  issues: { couple_id: string }[]
  recs: Rec[]
  /** 남길 커플 접두의 남은 파일 수 */
  orphans: Record<string, number>
  log: string[]
  failOnce?: string
  /** 76-h */
  stops: Stop[]
  dates: string[]
  dissolutions: Diss[]
  calls: string[]
}

function world(over: Partial<World>): World {
  return { profiles: [], couples: [], files: {}, issues: [], recs: [], orphans: {}, log: [], stops: [], dates: [], dissolutions: [], calls: [], ...over }
}

function port(w: World): PurgePort {
  const due = (p: Profile, now: string) => p.deleted_at !== null && p.purge_scheduled_at !== null && p.purge_scheduled_at <= now
  const authorCol: Record<string, string> = { data_entries: 'author_id', messages: 'sender_id', stories: 'author_id' }
  return {
    async dueUserIds(now) { return w.profiles.filter((p) => due(p, now)).map((p) => p.id) },
    async partnerGone(id, now) { const p = w.profiles.find((x) => x.id === id); return !p || due(p, now) },
    async listCouplesWithStatus(id) { return w.couples.filter((c) => c.user_a_id === id || c.user_b_id === id) },
    async count(table, column, ids) {
      if (table === 'issues') return w.issues.filter((r) => ids.includes(r.couple_id)).length
      if (table === 'profiles') return w.profiles.filter((p) => ids.includes(p.id)).length
      if (authorCol[table] === column) return w.recs.filter((r) => r.table === table && ids.includes(r.author)).length
      return 0
    },
    async countFiles(bucket, prefix) { return w.files[prefix]?.[bucket] ?? 0 },
    async removeFiles(bucket, prefix) {
      if (w.failOnce === `storage:${prefix}`) { w.failOnce = undefined; throw new Error('storage 삭제 실패') }
      const n = w.files[prefix]?.[bucket] ?? 0
      if (n > 0) w.log.push(`storage:${bucket}:${prefix}`)
      if (w.files[prefix]) w.files[prefix][bucket] = 0
      return n
    },
    async authoredPaths(id) { return w.recs.filter((r) => r.author === id).map((r) => ['b', r.path] as const) },
    async removeAuthoredFiles(id) {
      const n = w.recs.filter((r) => r.author === id).length
      if (n > 0) w.log.push(`storage:authored:${id}`)
      return n
    },
    async removeCoupleOrphans(coupleId) {
      const n = w.orphans[coupleId] ?? 0
      if (n > 0) w.log.push(`storage:orphans:${coupleId}`)
      w.orphans[coupleId] = 0
      return n
    },
    async dissolvedInitiators() {
      w.calls.push('dissolvedInitiators')
      return w.dissolutions
        .filter((d) => d.executed && !d.cancelled && d.initiated_by !== null && w.couples.some((c) => c.id === d.couple_id && c.status === 'dissolved'))
        .map((d) => ({ coupleId: d.couple_id, initiatorId: d.initiated_by as string }))
    },
    async stopDateIds(author, coupleIds) { return w.stops.filter((s) => s.author === author && coupleIds.includes(s.couple_id)).map((s) => s.date_id) },
    async entryDateIds(author, coupleIds) {
      return [...new Set(w.recs.filter((r) => r.table === 'data_entries' && r.author === author && coupleIds.includes(r.couple_id) && r.date_id).map((r) => r.date_id as string))]
    },
    async deleteStops(author, coupleIds) {
      const n = w.stops.filter((s) => s.author === author && coupleIds.includes(s.couple_id)).length
      if (n > 0) w.log.push(`rows:date_stops:${author}`)
      w.stops = w.stops.filter((s) => !(s.author === author && coupleIds.includes(s.couple_id)))
    },
    async emptyAfter(dateIds, author) {
      return [...new Set(dateIds)].filter((d) =>
        !w.stops.some((s) => s.date_id === d && s.author !== author) &&
        !w.recs.some((r) => r.table === 'data_entries' && r.date_id === d && !r.deleted && r.author !== author))
    },
    async deleteRows(table, column, ids) {
      w.log.push(`rows:${table}:${ids.join(',')}`)
      if (table === 'dates') { w.dates = w.dates.filter((d) => !ids.includes(d)); return }
      if (table === 'couples') {
        w.couples = w.couples.filter((c) => !ids.includes(c.id))
        w.issues = w.issues.filter((r) => !ids.includes(r.couple_id)) // cascade
        w.recs = w.recs.filter((r) => !ids.includes(r.couple_id))
      } else if (authorCol[table] === column) {
        w.recs = w.recs.filter((r) => !(r.table === table && ids.includes(r.author)))
      }
    },
    async deleteUser(id) {
      w.log.push(`auth:${id}`)
      w.profiles = w.profiles.filter((p) => p.id !== id)
      for (const s of w.stops) if (s.author === id) s.author = null // m3 · m1: 작성자 비움
      for (const d of w.dissolutions) if (d.initiated_by === id) d.initiated_by = null
      for (const c of w.couples) { // m1: 비움
        if (c.user_a_id === id) (c as { user_a_id: string | null }).user_a_id = null
        if (c.user_b_id === id) (c as { user_b_id: string | null }).user_b_id = null
      }
    },
  }
}

const gone = (id: string, at = PAST): Profile => ({ id, deleted_at: '2026-10-25T00:00:00Z', purge_scheduled_at: at })
const live = (id: string): Profile => ({ id, deleted_at: null, purge_scheduled_at: null })
const rec = (table: Rec['table'], author: string, couple = 'c-1'): Rec => ({ table, couple_id: couple, author, path: `${couple}/${author}-${table}.jpg` })

describe('대상', () => {
  it('유예가 남은 사용자는 0건(미리 보기 · 적용 모두)', async () => {
    const w = world({ profiles: [gone('u-a', FUTURE)], files: { 'u-a': { avatars: 1 } } })
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(out.lines).toContain('유예 끝난 사용자: 0')
    expect(w.log).toEqual([])
    expect(w.profiles).toHaveLength(1)
  })

  it('끝난 사용자만 지우고, 탈퇴하지 않은 사용자 · 유예 중 사용자는 그대로', async () => {
    const w = world({ profiles: [gone('u-a'), live('u-b'), gone('u-c', FUTURE)], files: { 'u-a': { avatars: 1 } } })
    await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.profiles.map((p) => p.id)).toEqual(['u-b', 'u-c'])
  })
})

describe('76-g ③ 상대가 남은 탈퇴자 - 끝까지 지운다', () => {
  const KEPT = { id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'dissolved' }
  const setup = (status = 'dissolved') => world({
    profiles: [gone('u-a'), live('u-b')], couples: [{ ...KEPT, status }], issues: [{ couple_id: 'c-1' }],
    recs: [rec('data_entries', 'u-a'), rec('messages', 'u-a'), rec('data_entries', 'u-b'), rec('messages', 'u-b')],
    files: { 'c-1': { entries: 3, magazine: 2 }, 'u-a': { avatars: 1 } }, orphans: { 'c-1': 2 },
  })

  it('미리 보기: "보류" 0 · 떠난 사람 기록 수 · 삭제 0', async () => {
    const w = setup()
    const out = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(out.lines.join('\n')).not.toContain('보류')
    expect(out.lines).toContain('처리 대상: 1')
    expect(out.lines).toContain('해제 실행 대기(다음 실행 때): 0')
    expect(out.lines).toContain('상대가 남은 커플(커플 · 호 · 상대 기록 남김): 1')
    expect(out.lines).toContain('떠난 사람 data_entries(상대가 남은 커플): 1')
    expect(out.lines).toContain('떠난 사람 messages(상대가 남은 커플): 1')
    expect(out.lines).toContain('couples: 0')
    expect(w.log).toEqual([])
  })

  it('적용: 저장소(avatars · 기록 파일 · 커플 남은 파일) -> 떠난 사람 기록 행 -> 인증 · 커플 · 호 · 상대 기록 · 커플 파일 그대로', async () => {
    const w = setup()
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.log).toEqual([
      'storage:avatars:u-a', 'storage:authored:u-a', 'storage:orphans:c-1',
      'rows:data_entries:u-a', 'rows:messages:u-a', 'rows:stories:u-a',
      'auth:u-a',
    ])
    expect(out.lines).toContain('지운 사용자: 1')
    expect(w.couples).toEqual([{ ...KEPT, user_a_id: null }])
    expect(w.issues).toEqual([{ couple_id: 'c-1' }])
    expect(w.recs.map((r) => r.author)).toEqual(['u-b', 'u-b'])
    expect(w.files['c-1']).toEqual({ entries: 3, magazine: 2 })
  })

  it('상대가 남은 커플이 아직 해제 실행 전이면 이번에는 기다린다(030이 칸 빈 커플을 "둘 다 떠남"으로 읽지 않게)', async () => {
    const w = setup('dissolving')
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(out.lines).toContain('해제 실행 대기(다음 실행 때): 1')
    expect(w.log).toEqual([])
    expect(w.profiles.map((p) => p.id)).toEqual(['u-a', 'u-b'])
  })

  it('상대가 유예 중(아직 취소할 수 있음)이면 남은 것으로 본다 - 호 · 상대 기록 그대로', async () => {
    const w = setup()
    w.profiles = [gone('u-a'), gone('u-b', FUTURE)]
    await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.issues).toHaveLength(1)
    expect(w.recs.map((r) => r.author)).toEqual(['u-b', 'u-b'])
  })
})

describe('두 사람 모두 떠난 경우 - 회귀 0', () => {
  const COUPLE = { id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'dissolved' }
  it('호(행 · magazine 파일)까지 지운다 - 순서: 저장소 -> 행 -> 인증', async () => {
    const w = world({
      profiles: [gone('u-a'), gone('u-b')], couples: [COUPLE], issues: [{ couple_id: 'c-1' }],
      files: { 'c-1': { entries: 3, magazine: 2, 'magazine-print': 1 }, 'u-a': { avatars: 1 }, 'u-b': { avatars: 1 } },
    })
    const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(pre.lines).toContain('issues: 1')
    expect(pre.lines).toContain('매거진 파일(magazine · magazine-print): 3')
    expect(pre.lines).toContain('Storage: 8')
    expect(w.log).toEqual([])

    await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.issues).toEqual([])
    const firstRows = w.log.findIndex((l) => l.startsWith('rows:'))
    const firstAuth = w.log.findIndex((l) => l.startsWith('auth:'))
    expect(w.log.slice(0, firstRows).every((l) => l.startsWith('storage:'))).toBe(true)
    expect(firstRows).toBeLessThan(firstAuth)
    expect(w.profiles).toEqual([])
  })

  it('상대 없는 혼자 초대 행은 함께 지운다', async () => {
    const w = world({ profiles: [gone('u-a')], couples: [{ id: 'c-2', user_a_id: 'u-a', user_b_id: null, status: 'pending' }] })
    await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.log).toEqual(['rows:couples:c-2', 'auth:u-a'])
  })
})

describe('실패 · 멱등', () => {
  it('한 사용자 중간 실패 -> 다른 사용자는 계속 · 실패 수 출력 · 다시 돌리면 마무리', async () => {
    const w = world({ profiles: [gone('u-a'), gone('u-z')], files: { 'u-a': { avatars: 1 }, 'u-z': { avatars: 1 } }, failOnce: 'storage:u-a' })
    const first = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(first.lines).toContain('지운 사용자: 1')
    expect(first.lines).toContain('실패: 1')
    expect(w.profiles.map((p) => p.id)).toEqual(['u-a'])
    const second = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(second.lines).toContain('지운 사용자: 1')
    expect(second.lines).toContain('실패: 0')
    expect(w.profiles).toEqual([])
  })

  it('상대가 남은 탈퇴자도 중간 실패 뒤 다시 돌리면 끝난다', async () => {
    const w = world({
      profiles: [gone('u-a'), live('u-b')], couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'dissolved' }],
      recs: [rec('messages', 'u-a')], files: { 'u-a': { avatars: 1 } }, failOnce: 'storage:u-a',
    })
    expect((await runPurge(async () => port(w), { apply: true }, gate, NOW)).lines).toContain('실패: 1')
    expect((await runPurge(async () => port(w), { apply: true }, gate, NOW)).lines).toContain('지운 사용자: 1')
    expect(w.profiles.map((p) => p.id)).toEqual(['u-b'])
    expect(w.recs).toEqual([])
  })
})

describe('76-h 떠난 사람이 남긴 장소', () => {
  const stop = (id: string, date: string, author: string | null, couple = 'c-1'): Stop => ({ id, couple_id: couple, date_id: date, author })
  const lineOf = (lines: readonly string[], head: string) => lines.find((l) => l.startsWith(head))

  describe('① 탈퇴', () => {
    const setup = () => world({
      profiles: [gone('u-a'), live('u-b')],
      couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'dissolved' }],
      dates: ['d-only-a', 'd-shared', 'd-old'],
      stops: [stop('s1', 'd-only-a', 'u-a'), stop('s2', 'd-shared', 'u-a'), stop('s3', 'd-shared', 'u-b'), stop('s4', 'd-old', 'u-a'), stop('s5', 'd-old', null)],
      recs: [
        { ...rec('data_entries', 'u-a'), date_id: 'd-only-a' },
        { ...rec('data_entries', 'u-b'), path: 'c-1/b-photo.jpg', date_id: 'd-shared' },
      ],
    })

    it('미리 보기: "떠난 사람의 장소" · "빈 날 정리" 숫자 · 삭제 0', async () => {
      const w = setup()
      const out = await runPurge(async () => port(w), { apply: false }, gate, NOW)
      expect(lineOf(out.lines, '떠난 사람의 장소:')).toBe('떠난 사람의 장소: 3')
      expect(lineOf(out.lines, '빈 날 정리:')).toBe('빈 날 정리: 1')
      expect(w.log).toEqual([])
      expect(w.stops).toHaveLength(5)
    })

    it('떠난 사람의 장소만 지움 · 남은 사람 장소 · 사진 0건 영향 · 작성자 빈 장소 0건 · 빈 날만 정리 · 장소 -> 계정 순서', async () => {
      const w = setup()
      await runPurge(async () => port(w), { apply: true }, gate, NOW)
      expect(w.stops.map((s) => s.id)).toEqual(['s3', 's5'])
      expect(w.recs.map((r) => r.author)).toEqual(['u-b'])
      expect(w.dates).toEqual(['d-shared', 'd-old']) // d-only-a만 비었다(d-old는 작성자 빈 옛 장소가 남음)
      expect(w.log.indexOf('rows:date_stops:u-a')).toBeLessThan(w.log.indexOf('auth:u-a'))
      expect(w.log.indexOf('rows:dates:d-only-a')).toBeLessThan(w.log.indexOf('auth:u-a'))
    })

    it('해제 실행 전(대기)이면 장소도 0건', async () => {
      const w = setup()
      w.couples[0].status = 'dissolving'
      const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
      expect(lineOf(out.lines, '떠난 사람의 장소:')).toBe('떠난 사람의 장소: 0')
      expect(w.stops).toHaveLength(5)
      expect(w.dates).toHaveLength(3)
    })

    it('다시 돌려도 같은 결과(멱등)', async () => {
      const w = setup()
      await runPurge(async () => port(w), { apply: true }, gate, NOW)
      const after = JSON.stringify([w.stops, w.dates, w.recs])
      const again = await runPurge(async () => port(w), { apply: true }, gate, NOW)
      expect(JSON.stringify([w.stops, w.dates, w.recs])).toBe(after)
      expect(lineOf(again.lines, '떠난 사람의 장소:')).toBe('떠난 사람의 장소: 0')
    })
  })

  describe('② 해제(해제된 커플 정리)', () => {
    const setup = (status = 'dissolved') => world({
      profiles: [live('u-a'), live('u-b')],
      couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status }],
      dissolutions: [{ couple_id: 'c-1', initiated_by: 'u-a', executed: status === 'dissolved', cancelled: false }],
      dates: ['d1', 'd2'],
      stops: [stop('s1', 'd1', 'u-a'), stop('s2', 'd2', 'u-a'), stop('s3', 'd2', 'u-b'), stop('s4', 'd1', null)],
      recs: [{ ...rec('data_entries', 'u-b'), date_id: 'd2' }],
    })

    it('요청자 장소만 지우고 요청받은 사람 장소 · 사진은 남김 · 작성자 빈 장소 0건 · 탈퇴자 0명이어도 돈다', async () => {
      const w = setup()
      const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
      expect(lineOf(pre.lines, '떠난 사람의 장소:')).toBe('떠난 사람의 장소: 2')
      expect(lineOf(pre.lines, '빈 날 정리:')).toBe('빈 날 정리: 0') // d1은 옛 장소, d2는 상대 것이 남음
      await runPurge(async () => port(w), { apply: true }, gate, NOW)
      expect(w.stops.map((s) => s.id)).toEqual(['s3', 's4'])
      expect(w.dates).toEqual(['d1', 'd2'])
      expect(w.recs).toHaveLength(1)
    })

    it('남은 것이 0인 날은 그날 행도 정리', async () => {
      const w = setup()
      w.stops = [stop('s1', 'd1', 'u-a'), stop('s3', 'd2', 'u-b')]
      w.recs = []
      await runPurge(async () => port(w), { apply: true }, gate, NOW)
      expect(w.dates).toEqual(['d2'])
    })

    it('해제 실행 전(유예 중) · 취소된 해제는 0건', async () => {
      for (const make of [() => setup('dissolving'), () => { const w = setup(); w.dissolutions[0].cancelled = true; return w }]) {
        const w = make()
        const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
        expect(lineOf(out.lines, '떠난 사람의 장소:')).toBe('떠난 사람의 장소: 0')
        expect(w.stops).toHaveLength(4)
      }
    })

    it('해제 정리는 탈퇴 단계보다 먼저(같은 실행에서 요청자가 지워져도 장소를 가를 수 있게)', async () => {
      const w = setup()
      w.profiles = [gone('u-a'), live('u-b')]
      const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
      expect(lineOf(pre.lines, '떠난 사람의 장소:')).toBe('떠난 사람의 장소: 2') // 두 단계가 같은 장소를 두 번 세지 않음
      await runPurge(async () => port(w), { apply: true }, gate, NOW)
      expect(w.stops.map((s) => s.id)).toEqual(['s3', 's4'])
      expect(w.log.indexOf('rows:date_stops:u-a')).toBeLessThan(w.log.indexOf('auth:u-a'))
    })
  })
})

describe('출력 · 가드 · 금지', () => {
  it('출력은 숫자만(경로 · id 0)', async () => {
    const w = world({ profiles: [gone('u-a'), live('u-b')], couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'dissolved' }], recs: [rec('data_entries', 'u-a')], files: { 'c-1': { entries: 1 } } })
    for (const apply of [false, true]) {
      const out = await runPurge(async () => port(w), { apply }, gate, NOW)
      const text = out.lines.join('\n')
      for (const bad of ['u-a', 'u-b', 'c-1', '.jpg', DEV_REF]) expect(text).not.toContain(bad)
    }
  })
  it('가드 불일치 -> 접속 0', async () => {
    const connect = jest.fn()
    const out = await runPurge(connect, { apply: true }, makeProjectGate({ allowlistText: null, url: undefined }), NOW)
    expect(out.kind).toBe('refused')
    expect(connect).not.toHaveBeenCalled()
  })
  it('인수: --apply 하나만', () => {
    expect(parsePurgeArgs([])).toEqual({ apply: false })
    expect(() => parsePurgeArgs(['--with-issues'])).toThrow()
  })
  it('코드(주석 밖)에 서버 파괴 함수 · demo_responses · rpc 호출 0', () => {
    const src = fs.readFileSync(path.join(__dirname, 'purgeWithdrawn.ts'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/demo_responses|execute_dissolution|apply_retention_policy|run_due_dissolutions|\.rpc\(/)
  })
})
