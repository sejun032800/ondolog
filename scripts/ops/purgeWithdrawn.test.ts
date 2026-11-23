/// <reference types="jest" />
/**
 * 76-f (c) · 76-g ③ 탈퇴 최종 삭제 시험 - 가짜 접속(메모리 표 · 파일)만. 원격 0.
 * 실제 DB 동작(m1 칸 비움 · 남은 사람 그대로)은 PGlite 시험 `__tests__/db/withdrawalPurge76g.test.ts`.
 */
import fs from 'fs'
import path from 'path'
import { makeProjectGate } from './sweepOrphanFiles.ts'
import { errorLogCutoffDay, HIDDEN_TABLES, parsePurgeArgs, runPurge, type CoupleWithStatus, type PurgePort } from './purgeWithdrawn.ts'

const DEV_REF = 'fakedevref000000aaaa'
const gate = makeProjectGate({ allowlistText: `project=${DEV_REF}\n`, url: `https://${DEV_REF}.supabase.co` })
const NOW = new Date('2026-11-16T00:00:00Z')
const PAST = '2026-11-01T00:00:00Z'
const FUTURE = '2026-11-20T00:00:00Z'

interface Profile { id: string; deleted_at: string | null; purge_scheduled_at: string | null }
interface Rec { table: 'data_entries' | 'messages' | 'stories'; couple_id: string; author: string; path: string; date_id?: string; deleted?: boolean; deleted_at?: string }
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
  /** 76-i: 이 표의 숨긴 행 삭제가 한 번 실패한다. */
  failHiddenOnce?: string
  /** 76-j: 날짜(하루) 행 - 숨김 표시 · AI 제목 · 서사. */
  days: Day[]
  /** 76-j: 고른 뒤(liveDateIds 두 번째 부름 = 지우기 직전) 일어나는 일 - 경쟁 상태 흉내. */
  beforeDayDelete?: (w: World) => void
  dayChecks: number
  /** 80-: 오류 기록 행의 KST 날짜(YYYY-MM-DD). */
  errorDays: string[]
  /** 80-: 오류 기록 표가 없다(80-m1 전) · 지우기가 한 번 실패한다. */
  errorTable?: 'missing' | 'failDeleteOnce'
  /** 87-: 알림 숫자 행의 KST 날짜 · 표 없음 / 지우기 한 번 실패. */
  pushDays: string[]
  pushTable?: 'missing' | 'failDeleteOnce'
}
interface Day { id: string; couple_id: string; deleted_at: string | null; title: string | null; narrative: string | null }

function world(over: Partial<World>): World {
  return { profiles: [], couples: [], files: {}, issues: [], recs: [], orphans: {}, log: [], stops: [], dates: [], dissolutions: [], calls: [], days: [], dayChecks: 0, errorDays: [], pushDays: [], ...over }
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
    async hiddenRows(table, cutoff) {
      if (table === 'dates') {
        return w.days.filter((d) => d.deleted_at !== null && Date.parse(d.deleted_at) <= Date.parse(cutoff)).map((d) => ({ id: d.id, coupleId: d.couple_id, authorId: null }))
      }
      return w.recs.filter((r) => r.table === table && r.deleted_at !== undefined && Date.parse(r.deleted_at) <= Date.parse(cutoff))
        .map((r) => ({ id: r.path, coupleId: r.couple_id, authorId: r.author }))
    },
    async deleteHidden(table, ids, cutoff) {
      if (w.failHiddenOnce === table) { w.failHiddenOnce = undefined; throw new Error('삭제 실패') }
      if (table === 'dates') {
        const gone = (d: Day) => ids.includes(d.id) && d.deleted_at !== null && Date.parse(d.deleted_at) <= Date.parse(cutoff)
        const m = w.days.filter(gone).length
        if (m > 0) w.log.push(`rows:hidden:dates:${m}`)
        w.days = w.days.filter((d) => !gone(d))
        return m
      }
      const hit = (r: Rec) => r.table === table && ids.includes(r.path) && r.deleted_at !== undefined && Date.parse(r.deleted_at) <= Date.parse(cutoff)
      const n = w.recs.filter(hit).length
      if (n > 0) w.log.push(`rows:hidden:${table}:${n}`)
      w.recs = w.recs.filter((r) => !hit(r))
      return n
    },
    async liveDateIds(dateIds) {
      w.dayChecks += 1
      if (w.dayChecks === 2 && w.beforeDayDelete) w.beforeDayDelete(w)
      return dateIds.filter((d) =>
        w.stops.some((s) => s.date_id === d) || w.recs.some((r) => r.table === 'data_entries' && r.date_id === d && r.deleted_at === undefined))
    },
    async oldErrorRows(cutoffDay) {
      if (w.errorTable === 'missing') throw new Error('app_error_daily 조회: relation does not exist')
      return w.errorDays.filter((d) => d < cutoffDay).length
    },
    async deleteOldErrorRows(cutoffDay) {
      if (w.errorTable === 'failDeleteOnce') { w.errorTable = undefined; throw new Error('삭제 실패') }
      const n = w.errorDays.filter((d) => d < cutoffDay).length
      w.errorDays = w.errorDays.filter((d) => d >= cutoffDay)
      if (n > 0) w.log.push(`rows:app_error_daily:${n}`)
      return n
    },
    async oldPushRows(cutoffDay) {
      if (w.pushTable === 'missing') throw new Error('push_daily 조회: relation does not exist')
      return w.pushDays.filter((d) => d < cutoffDay).length
    },
    async deleteOldPushRows(cutoffDay) {
      if (w.pushTable === 'failDeleteOnce') { w.pushTable = undefined; throw new Error('삭제 실패') }
      const n = w.pushDays.filter((d) => d < cutoffDay).length
      w.pushDays = w.pushDays.filter((d) => d >= cutoffDay)
      if (n > 0) w.log.push(`rows:push_daily:${n}`)
      return n
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

describe('76-i 숨긴 행 정리(숨긴 지 24시간 지난 행 삭제)', () => {
  const lineOf = (lines: readonly string[], head: string) => lines.find((l) => l.startsWith(head))
  const OLD = '2026-11-14T00:00:00Z' // 48시간 전
  const EDGE = '2026-11-15T00:00:00Z' // 정확히 24시간 전
  const RECENT = '2026-11-15T12:00:00Z' // 12시간 전
  const hid = (table: Rec['table'], author: string, at: string, couple = 'c-1', tag = ''): Rec =>
    ({ ...rec(table, author, couple), path: `${couple}/${author}-${table}-${at}${tag}`, deleted_at: at, deleted: true })
  const COUPLE = { id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'active' }
  const setup = () => world({
    profiles: [live('u-a'), live('u-b')], couples: [COUPLE], issues: [{ couple_id: 'c-1' }],
    files: { 'c-1': { entries: 2, magazine: 1, 'magazine-print': 1 } },
    recs: [
      hid('data_entries', 'u-a', OLD), hid('data_entries', 'u-a', EDGE), hid('data_entries', 'u-a', RECENT),
      hid('messages', 'u-b', OLD),
      rec('data_entries', 'u-a'), rec('data_entries', 'u-b'), rec('messages', 'u-a'), rec('stories', 'u-b'),
    ],
  })

  it('미리 보기: 숫자만 · 지난 것만 센다 · 삭제 0', async () => {
    const w = setup()
    const before = JSON.stringify(w.recs)
    const out = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(lineOf(out.lines, '숨긴 행 정리:')).toBe('숨긴 행 정리: 3')
    expect(out.lines).toContain('숨긴 행 정리 data_entries: 2')
    expect(out.lines).toContain('숨긴 행 정리 messages: 1')
    expect(w.log).toEqual([])
    expect(JSON.stringify(w.recs)).toBe(before)
  })

  it('적용: 24시간 지난 숨긴 행만 지움 · 24시간 안 · 숨기지 않은 행 · 상대 행 · 스토리 · 호 · 매거진 파일 0건 영향', async () => {
    const w = setup()
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(out.lines).toContain('숨긴 행 지움: 3')
    expect(out.lines).toContain('숨긴 행 실패(다음 실행 때 다시): 0')
    expect(w.recs.map((r) => `${r.table}:${r.author}:${r.deleted_at ?? '-'}`)).toEqual([
      `data_entries:u-a:${RECENT}`, 'data_entries:u-a:-', 'data_entries:u-b:-', 'messages:u-a:-', 'stories:u-b:-',
    ])
    expect(w.issues).toEqual([{ couple_id: 'c-1' }])
    expect(w.files['c-1']).toEqual({ entries: 2, magazine: 1, 'magazine-print': 1 })
    expect(w.log.every((l) => l.startsWith('rows:hidden:'))).toBe(true)
    expect(w.profiles).toHaveLength(2)
  })

  it('멱등: 다시 돌리면 0 · 결과 같음', async () => {
    const w = setup()
    await runPurge(async () => port(w), { apply: true }, gate, NOW)
    const after = JSON.stringify(w.recs)
    const again = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(again.lines).toContain('숨긴 행 지움: 0')
    expect(JSON.stringify(w.recs)).toBe(after)
  })

  it('탈퇴 · 해제 단계 뒤에 돌고, 그 단계가 맡은 행은 두 번 세지 않는다', async () => {
    const w = world({
      profiles: [gone('u-a'), live('u-b'), gone('u-c'), gone('u-d')],
      couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'dissolved' }, { id: 'c-2', user_a_id: 'u-c', user_b_id: 'u-d', status: 'dissolved' }],
      recs: [
        hid('data_entries', 'u-a', OLD), // 떠난 사람(상대가 남음) - 76-g가 지운다
        hid('data_entries', 'u-b', OLD), // 남은 사람이 직접 지운 것 - 76-i
        hid('messages', 'u-c', OLD, 'c-2'), // 두 사람 모두 떠난 커플 - cascade
      ],
    })
    const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(lineOf(pre.lines, '숨긴 행 정리:')).toBe('숨긴 행 정리: 1')
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(out.lines).toContain('숨긴 행 지움: 1')
    const lastAuth = Math.max(...w.log.map((l, i) => (l.startsWith('auth:') ? i : -1)))
    expect(w.log.indexOf('rows:hidden:data_entries:1')).toBeGreaterThan(lastAuth)
    expect(w.recs).toEqual([])
  })

  it('한 표가 막히면 그 행 수만 실패 · 다른 표는 계속 · 다음 실행에 마무리', async () => {
    const w = setup()
    w.failHiddenOnce = 'data_entries'
    const first = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(first.lines).toContain('숨긴 행 지움: 1')
    expect(first.lines).toContain('숨긴 행 실패(다음 실행 때 다시): 2')
    expect(first.lines).toContain('실패: 0')
    const second = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(second.lines).toContain('숨긴 행 지움: 2')
    expect(second.lines).toContain('숨긴 행 실패(다음 실행 때 다시): 0')
  })

  it('대상 표는 data_entries · messages · dates(이 순서로 지움 · date_stops · stories는 숨김 칸 없음)', () => {
    expect(HIDDEN_TABLES.map(([t]) => t)).toEqual(['data_entries', 'messages', 'dates'])
  })
})

describe('76-j 숨긴 하루(dates) 행 정리', () => {
  const lineOf = (lines: readonly string[], head: string) => lines.find((l) => l.startsWith(head))
  const OLD = '2026-11-14T00:00:00Z'
  const RECENT = '2026-11-15T12:00:00Z'
  const day = (id: string, at: string | null, couple = 'c-1'): Day => ({ id, couple_id: couple, deleted_at: at, title: 'AI 제목', narrative: 'AI 서사' })
  const setup = () => world({
    profiles: [live('u-a'), live('u-b')], couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'active' }],
    issues: [{ couple_id: 'c-1' }], files: { 'c-1': { magazine: 1, 'magazine-print': 1 } },
    days: [day('d-old', OLD), day('d-recent', RECENT), day('d-live', null), day('d-partner', OLD), day('d-stop', OLD), day('d-hidden-entry', OLD)],
    recs: [
      { ...rec('data_entries', 'u-b'), date_id: 'd-partner' }, // 상대의 살아 있는 사진
      { ...rec('data_entries', 'u-a'), path: 'c-1/hidden.jpg', date_id: 'd-hidden-entry', deleted_at: OLD, deleted: true }, // 숨긴 기록만 - 같은 단계에서 먼저 지워짐
    ],
    stops: [{ id: 's1', couple_id: 'c-1', date_id: 'd-stop', author: 'u-b' }],
  })

  it('미리 보기: 지난 것만 · 살아 있는 기록이 있는 날은 건너뜀 · 숫자만 · 삭제 0', async () => {
    const w = setup()
    const out = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(out.lines).toContain('숨긴 행 정리 dates: 2')
    expect(out.lines).toContain('건너뜀(살아 있는 기록): 2')
    expect(lineOf(out.lines, '숨긴 행 정리:')).toBe('숨긴 행 정리: 3') // 숨긴 사진 1 + 날 2
    expect(w.days).toHaveLength(6)
    expect(w.log).toEqual([])
    for (const bad of ['d-old', 'c-1', 'AI']) expect(out.lines.join('\n')).not.toContain(bad)
  })

  it('적용: 지난 날만 행째 삭제(AI 제목 · 서사가 남지 않음) · 24시간 안 · 숨기지 않은 날 · 상대 기록 · 장소가 있는 날 0건 · 호 · 매거진 파일 0건', async () => {
    const w = setup()
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.days.map((d) => d.id)).toEqual(['d-recent', 'd-live', 'd-partner', 'd-stop'])
    expect(w.days.some((d) => d.id === 'd-old' || d.id === 'd-hidden-entry')).toBe(false)
    expect(out.lines).toContain('숨긴 행 지움: 3')
    expect(out.lines).toContain('건너뜀(지울 때 살아 있는 기록): 0')
    expect(w.stops).toHaveLength(1)
    expect(w.recs.map((r) => r.date_id)).toEqual(['d-partner'])
    expect(w.issues).toEqual([{ couple_id: 'c-1' }])
    expect(w.files['c-1']).toEqual({ magazine: 1, 'magazine-print': 1 })
    expect(w.log.indexOf('rows:hidden:data_entries:1')).toBeLessThan(w.log.indexOf('rows:hidden:dates:2'))
  })

  it('경쟁 상태: 고른 뒤 지우기 전에 앱이 되살린 날(deleted_at 비움)은 0건', async () => {
    const w = setup()
    w.beforeDayDelete = (x) => { x.days.find((d) => d.id === 'd-old')!.deleted_at = null }
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.days.find((d) => d.id === 'd-old')).toMatchObject({ deleted_at: null, title: 'AI 제목' })
    expect(out.lines).toContain('숨긴 행 지움: 2') // 숨긴 사진 1 + d-hidden-entry
    expect(out.lines).toContain('숨긴 행 실패(다음 실행 때 다시): 0')
  })

  it('경쟁 상태: 고른 뒤 살아 있는 기록이 생긴 날은 지울 때 다시 보고 건너뜀', async () => {
    const w = setup()
    w.beforeDayDelete = (x) => { x.stops.push({ id: 's9', couple_id: 'c-1', date_id: 'd-old', author: 'u-a' }) }
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.days.some((d) => d.id === 'd-old')).toBe(true)
    expect(out.lines).toContain('건너뜀(지울 때 살아 있는 기록): 1')
  })

  it('24시간 안에 되살아난 날(숨김 표시 없음)은 대상 밖', async () => {
    const w = world({ days: [day('d-revived', null)] })
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(out.lines).toContain('숨긴 행 정리 dates: 0')
    expect(w.days).toHaveLength(1)
  })

  it('두 사람 모두 떠난 커플의 날은 76-g cascade가 맡음 - 두 번 세지 않음 · 멱등', async () => {
    const w = setup()
    w.profiles = [gone('u-a'), gone('u-b')]
    const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(pre.lines).toContain('숨긴 행 정리 dates: 0')
    const v = setup()
    await runPurge(async () => port(v), { apply: true }, gate, NOW)
    const after = JSON.stringify(v.days)
    const again = await runPurge(async () => port(v), { apply: true }, gate, NOW)
    expect(again.lines).toContain('숨긴 행 지움: 0')
    expect(JSON.stringify(v.days)).toBe(after)
  })
})

describe('출력 · 가드 · 금지', () => {
  it('출력은 숫자만(경로 · id 0)', async () => {
    const w = world({ profiles: [gone('u-a'), live('u-b')], couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b', status: 'dissolved' }], recs: [rec('data_entries', 'u-a'), { ...rec('messages', 'u-b'), deleted_at: '2026-11-01T00:00:00Z' }], files: { 'c-1': { entries: 1 } } })
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

describe('80- 오류 기록 90일 정리', () => {
  // NOW = 2026-11-16T00:00Z = KST 11-16 09:00 -> 기준 날짜 2026-08-18(이 날짜보다 앞선 행을 지운다)
  it('기준 날짜 = KST 오늘 - 90일', () => {
    expect(errorLogCutoffDay(NOW)).toBe('2026-08-18')
    expect(errorLogCutoffDay(new Date('2026-11-16T15:30:00Z'))).toBe('2026-08-19') // KST 11-17 00:30
  })
  it('미리 보기는 세기만 · 적용은 90일 지난 행만 지움 · 두 번째 실행 0(멱등)', async () => {
    const w = world({ errorDays: ['2026-08-01', '2026-08-17', '2026-08-18', '2026-11-16'] })
    const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(pre.lines).toContain('오류 기록 90일 정리: 2')
    expect(w.errorDays).toHaveLength(4)
    const first = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(first.lines).toContain('오류 기록 지움: 2')
    expect(w.errorDays).toEqual(['2026-08-18', '2026-11-16'])
    const second = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(second.lines).toContain('오류 기록 90일 정리: 0')
    expect(second.lines).toContain('오류 기록 지움: 0')
    expect(second.lines).toContain('완료')
  })
  it('표가 없으면(80-m1 전) 이 단계만 건너뛰고 다른 단계는 그대로', async () => {
    const w = world({ profiles: [gone('u-a')], couples: [], errorTable: 'missing' })
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(out.lines).toContain('오류 기록 90일 정리: 확인 못 함(80-m1 전이면 정상)')
    expect(out.lines).toContain('오류 기록 지움: 0')
    expect(out.lines).toContain('지운 사용자: 1')
    expect(out.lines).toContain('완료')
  })
  it('지우기 실패 -> 실패 한 줄 · 다음 실행 때 지움', async () => {
    const w = world({ errorDays: ['2026-01-01'], errorTable: 'failDeleteOnce' })
    const first = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(first.lines).toContain('오류 기록 지움: 실패(다음 실행 때 다시)')
    expect(first.lines).toContain('완료(실패한 것은 다음 실행 때 다시)')
    const second = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(second.lines).toContain('오류 기록 지움: 1')
    expect(w.errorDays).toEqual([])
  })
})

describe('87- 알림 숫자 90일 정리', () => {
  it('미리 보기는 세기만 · 적용은 90일 지난 행만 · 두 번째 실행 0(멱등) · 오류 기록과 따로 센다', async () => {
    const w = world({ pushDays: ['2026-08-01', '2026-08-17', '2026-08-18', '2026-11-16'], errorDays: ['2026-08-01'] })
    const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(pre.lines).toContain('알림 숫자 90일 정리: 2')
    expect(pre.lines).toContain('오류 기록 90일 정리: 1')
    expect(w.pushDays).toHaveLength(4)
    const first = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(first.lines).toContain('알림 숫자 지움: 2')
    expect(first.lines).toContain('오류 기록 지움: 1')
    expect(w.pushDays).toEqual(['2026-08-18', '2026-11-16'])
    const second = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(second.lines).toContain('알림 숫자 90일 정리: 0')
    expect(second.lines).toContain('알림 숫자 지움: 0')
    expect(second.lines).toContain('완료')
  })
  it('표가 없으면(87-m1 전) 이 단계만 건너뜀 · 지우기 실패 -> 실패 한 줄 · 다음 실행 때 지움', async () => {
    const missing = world({ profiles: [gone('u-a')], pushTable: 'missing' })
    const out = await runPurge(async () => port(missing), { apply: true }, gate, NOW)
    expect(out.lines).toContain('알림 숫자 90일 정리: 확인 못 함(87-m1 전이면 정상)')
    expect(out.lines).toContain('알림 숫자 지움: 0')
    expect(out.lines).toContain('지운 사용자: 1')
    expect(out.lines).toContain('완료')
    const w = world({ pushDays: ['2026-01-01'], pushTable: 'failDeleteOnce' })
    const first = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(first.lines).toContain('알림 숫자 지움: 실패(다음 실행 때 다시)')
    expect(first.lines).toContain('완료(실패한 것은 다음 실행 때 다시)')
    const second = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(second.lines).toContain('알림 숫자 지움: 1')
    expect(w.pushDays).toEqual([])
  })
})
