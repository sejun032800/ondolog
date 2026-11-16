/// <reference types="jest" />
/**
 * 76-f (c) 탈퇴 최종 삭제 시험 - 가짜 접속(메모리 표 · 파일)만. 원격 0.
 */
import fs from 'fs'
import path from 'path'
import { makeProjectGate } from './sweepOrphanFiles.ts'
import { parsePurgeArgs, runPurge, type PurgePort } from './purgeWithdrawn.ts'
import type { CoupleLite } from './resetTestAccount.ts'

const DEV_REF = 'fakedevref000000aaaa'
const gate = makeProjectGate({ allowlistText: `project=${DEV_REF}\n`, url: `https://${DEV_REF}.supabase.co` })
const NOW = new Date('2026-11-16T00:00:00Z')
const PAST = '2026-11-01T00:00:00Z'
const FUTURE = '2026-11-20T00:00:00Z'

interface Profile { id: string; deleted_at: string | null; purge_scheduled_at: string | null }
interface World {
  profiles: Profile[]
  couples: CoupleLite[]
  /** 커플/사용자 접두 -> 버킷별 파일 수 */
  files: Record<string, Record<string, number>>
  issues: { couple_id: string }[]
  entries: { couple_id: string; author_id: string }[]
  log: string[]
  failOnce?: string
}

function world(over: Partial<World>): World {
  return { profiles: [], couples: [], files: {}, issues: [], entries: [], log: [], ...over }
}

function port(w: World): PurgePort {
  const due = (p: Profile, now: string) => p.deleted_at !== null && p.purge_scheduled_at !== null && p.purge_scheduled_at <= now
  return {
    async dueUserIds(now) { return w.profiles.filter((p) => due(p, now)).map((p) => p.id) },
    async partnerGone(id, now) { const p = w.profiles.find((x) => x.id === id); return !p || due(p, now) },
    async listCouples(id) { return w.couples.filter((c) => c.user_a_id === id || c.user_b_id === id) },
    async count(table, _col, ids) {
      if (table === 'issues') return w.issues.filter((r) => ids.includes(r.couple_id)).length
      if (table === 'data_entries') return w.entries.filter((r) => ids.includes(r.couple_id)).length
      if (table === 'profiles') return w.profiles.filter((p) => ids.includes(p.id)).length
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
    async deleteRows(table, _col, ids) {
      w.log.push(`rows:${table}:${ids.join(',')}`)
      if (table === 'couples') {
        w.couples = w.couples.filter((c) => !ids.includes(c.id))
        w.issues = w.issues.filter((r) => !ids.includes(r.couple_id)) // cascade
        w.entries = w.entries.filter((r) => !ids.includes(r.couple_id))
      }
    },
    async deleteUser(id) {
      w.log.push(`auth:${id}`)
      w.profiles = w.profiles.filter((p) => p.id !== id)
    },
  }
}

const gone = (id: string, at = PAST): Profile => ({ id, deleted_at: '2026-10-25T00:00:00Z', purge_scheduled_at: at })
const live = (id: string): Profile => ({ id, deleted_at: null, purge_scheduled_at: null })

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

describe('발행된 호 · 상대', () => {
  const COUPLE: CoupleLite = { id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b' }

  it('상대가 남아 있으면 보류: 호 · 상대 기록 · 파일 0건 영향', async () => {
    const w = world({
      profiles: [gone('u-a'), live('u-b')], couples: [COUPLE], issues: [{ couple_id: 'c-1' }],
      entries: [{ couple_id: 'c-1', author_id: 'u-b' }], files: { 'c-1': { entries: 3, magazine: 2 }, 'u-a': { avatars: 1 } },
    })
    const out = await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(out.lines).toContain('보류(상대 남음 · 계정 행은 스키마 변경 필요): 1')
    expect(out.lines).toContain('처리 대상: 0')
    expect(w.log).toEqual([])
    expect(w.issues).toHaveLength(1)
    expect(w.files['c-1']).toEqual({ entries: 3, magazine: 2 })
  })

  it('상대가 유예 중(아직 취소할 수 있음)이어도 남아 있는 것으로 본다', async () => {
    const w = world({ profiles: [gone('u-a'), gone('u-b', FUTURE)], couples: [COUPLE], issues: [{ couple_id: 'c-1' }] })
    await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.issues).toHaveLength(1)
    expect(w.log).toEqual([])
  })

  it('둘 다 떠났으면 호(행 · magazine 파일)까지 지운다 - 순서: 저장소 -> 행 -> 인증', async () => {
    const w = world({
      profiles: [gone('u-a'), gone('u-b')], couples: [COUPLE], issues: [{ couple_id: 'c-1' }],
      files: { 'c-1': { entries: 3, magazine: 2, 'magazine-print': 1 }, 'u-a': { avatars: 1 }, 'u-b': { avatars: 1 } },
    })
    const pre = await runPurge(async () => port(w), { apply: false }, gate, NOW)
    expect(pre.lines).toContain('issues: 1')
    expect(pre.lines).toContain('매거진 파일(magazine · magazine-print): 3')
    expect(pre.lines).toContain('Storage: 8')
    expect(w.log).toEqual([]) // 미리 보기 삭제 0

    await runPurge(async () => port(w), { apply: true }, gate, NOW)
    expect(w.issues).toEqual([])
    const firstRows = w.log.findIndex((l) => l.startsWith('rows:'))
    const firstAuth = w.log.findIndex((l) => l.startsWith('auth:'))
    const lastStorageBeforeRows = w.log.slice(0, firstRows).every((l) => l.startsWith('storage:'))
    expect(lastStorageBeforeRows).toBe(true)
    expect(firstRows).toBeLessThan(firstAuth)
    expect(w.log.filter((l) => l.startsWith('storage:'))).toEqual([
      'storage:entries:c-1', 'storage:magazine:c-1', 'storage:magazine-print:c-1', 'storage:avatars:u-a', 'storage:avatars:u-b',
    ])
    expect(w.profiles).toEqual([])
  })

  it('상대 없는 혼자 초대 행은 함께 지운다', async () => {
    const w = world({ profiles: [gone('u-a')], couples: [{ id: 'c-2', user_a_id: 'u-a', user_b_id: null }] })
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
})

describe('출력 · 가드 · 금지', () => {
  it('출력은 숫자만(경로 · id 0)', async () => {
    const w = world({ profiles: [gone('u-a'), gone('u-b')], couples: [{ id: 'c-1', user_a_id: 'u-a', user_b_id: 'u-b' }], files: { 'c-1': { entries: 1 } } })
    for (const apply of [false, true]) {
      const out = await runPurge(async () => port(w), { apply }, gate, NOW)
      const text = out.lines.join('\n')
      for (const bad of ['u-a', 'u-b', 'c-1', DEV_REF]) expect(text).not.toContain(bad)
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
