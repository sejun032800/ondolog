/**
 * 시험 보조(시험 파일이 아니다) - 91-b 패턴 모드용 메모리 가짜 저장소. 원격 0 · 가짜 값만.
 * 커플 행을 지우면 커플 칸으로 든 행이 함께 지워지고(cascade), 사용자를 지우면 커플 칸 · 사용자 칸이 비워진다(g1 set null) - 마이그레이션 지도와 같은 모양.
 * 모든 쓰기는 `calls`에 남는다. 루트 jest(`resetTestPattern.test.ts`)와 Deno 시험(`resetTestPatternCheck.ts`)이 같이 쓴다.
 */
import type { CoupleLite } from './resetTestAccount.ts'
import type { AuthUserLite, PatternPort } from './resetTestPattern.ts'

export type FakeRow = Record<string, string | null>

export interface FakeWorld {
  users: AuthUserLite[]
  couples: (CoupleLite & FakeRow)[]
  /** 커플 칸(couple_id)으로 든 행들 - 표 이름별. */
  rows: Record<string, FakeRow[]>
  /** 사용자 칸으로 든 행(profiles 등) - 표 이름별, 칸은 `id` 또는 `user_id`. */
  userRows: Record<string, FakeRow[]>
  /** 버킷 -> 파일 경로들. */
  files: Record<string, string[]>
  /** 손대면 안 되는 표(demo_responses · push_daily · app_error_daily) - 행 수가 그대로인지 본다. */
  untouchable: Record<string, FakeRow[]>
}

export function makeFakePatternPort(world: FakeWorld): { port: PatternPort; calls: string[] } {
  const calls: string[] = []
  const tableRows = (table: string): FakeRow[] => {
    if (table === 'couples') return world.couples as FakeRow[]
    if (table in world.untouchable) throw new Error(`금지 표 접근: ${table}`)
    return world.rows[table] ?? world.userRows[table] ?? []
  }
  const port: PatternPort = {
    findUserIds: () => { throw new Error('패턴 모드는 이메일로 찾지 않는다') },
    listAuthUsers: () => Promise.resolve(world.users.map((u) => ({ ...u }))),
    listAllCouples: () => Promise.resolve(world.couples.map((c) => ({ id: c.id, user_a_id: c.user_a_id, user_b_id: c.user_b_id }))),
    listCouples: (userId) => Promise.resolve(world.couples.filter((c) => c.user_a_id === userId || c.user_b_id === userId).map((c) => ({ id: c.id, user_a_id: c.user_a_id, user_b_id: c.user_b_id }))),
    hasPublishedIssue: (ids) => Promise.resolve((world.rows.issues ?? []).some((r) => ids.includes(r.couple_id ?? '') && r.published_at !== null)),
    count: (table, column, ids) => Promise.resolve(tableRows(table).filter((r) => ids.includes(r[column] ?? '')).length),
    countLinks: (table, userCol, coupleCol, userIds, coupleIds, direction) => {
      const rows = tableRows(table)
      const n = direction === 'inUsersOutCouples'
        ? rows.filter((r) => userIds.includes(r[userCol] ?? '') && !coupleIds.includes(r[coupleCol] ?? '')).length
        : rows.filter((r) => coupleIds.includes(r[coupleCol] ?? '') && r[userCol] != null && !userIds.includes(r[userCol] ?? '')).length
      return Promise.resolve(n)
    },
    countFiles: (bucket, prefix) => Promise.resolve((world.files[bucket] ?? []).filter((p) => p.startsWith(`${prefix}/`)).length),
    removeFiles: (bucket, prefix) => {
      calls.push(`removeFiles:${bucket}:${prefix}`)
      const before = world.files[bucket] ?? []
      world.files[bucket] = before.filter((p) => !p.startsWith(`${prefix}/`))
      return Promise.resolve(before.length - world.files[bucket].length)
    },
    deleteRows: (table, column, ids) => {
      calls.push(`deleteRows:${table}:${ids.join(',')}`)
      if (table === 'couples') {
        world.couples = world.couples.filter((c) => !ids.includes(c[column] ?? ''))
        for (const t of Object.keys(world.rows)) world.rows[t] = world.rows[t].filter((r) => !ids.includes(r.couple_id ?? ''))
      } else {
        if (table in world.untouchable) throw new Error(`금지 표 쓰기: ${table}`)
        world.rows[table] = (world.rows[table] ?? []).filter((r) => !ids.includes(r[column] ?? ''))
      }
      return Promise.resolve()
    },
    deleteUser: (userId) => {
      calls.push(`deleteUser:${userId}`)
      world.users = world.users.filter((u) => u.id !== userId)
      for (const c of world.couples) {
        for (const k of ['user_a_id', 'user_b_id', 'start_date_set_by', 'start_date_confirmed_by', 'nickname_changed_by']) if (c[k] === userId) c[k] = null
      }
      for (const t of Object.keys(world.userRows)) world.userRows[t] = world.userRows[t].filter((r) => r.id !== userId && r.user_id !== userId)
      return Promise.resolve()
    },
    withdrawalStartedAt: () => Promise.resolve(null),
  }
  return { port, calls }
}

/** 기본 세계: 시험 커플 하나(두 사람 패턴) · 커플 없는 시험 사용자 하나 · 해제 유예 중 시험 커플 하나 · 실제 사용자 둘(카카오 모양 커플) · 금지 표. */
export function baseWorld(): FakeWorld {
  const old = '2026-11-20T03:00:00Z'
  const users: AuthUserLite[] = [
    { id: 'u-t1', email: 'test-55-1700000000@example.com', created_at: old },
    { id: 'u-t2', email: 'TEST-55-1700000001@Example.COM', created_at: old },
    { id: 'u-t3', email: 'test-u2_lone.x@example.com', created_at: old },
    { id: 'u-t4', email: 'test-70-a@example.com', created_at: old },
    { id: 'u-t5', email: 'test-70-b@example.com', created_at: old },
    { id: 'u-real1', email: 'real1@kakao.example', created_at: old },
    { id: 'u-real2', email: null, created_at: old },
  ]
  return {
    users,
    couples: [
      { id: 'c-t12', user_a_id: 'u-t1', user_b_id: 'u-t2', status: 'active', start_date_set_by: 'u-t1', start_date_confirmed_by: 'u-t2', nickname_changed_by: null, nickname: 'test 별명' },
      { id: 'c-t45', user_a_id: 'u-t4', user_b_id: 'u-t5', status: 'dissolving', start_date_set_by: null, start_date_confirmed_by: null, nickname_changed_by: null, nickname: null },
      { id: 'c-t3pending', user_a_id: 'u-t3', user_b_id: null, status: 'pending', start_date_set_by: null, start_date_confirmed_by: null, nickname_changed_by: null, nickname: null },
      { id: 'c-real', user_a_id: 'u-real1', user_b_id: 'u-real2', status: 'active', start_date_set_by: 'u-real1', start_date_confirmed_by: null, nickname_changed_by: null, nickname: '진짜커플' },
    ],
    rows: {
      couple_dissolutions: [{ id: 'd1', couple_id: 'c-t45', initiated_by: 'u-t4' }],
      messages: [
        { id: 'm1', couple_id: 'c-t12', sender_id: 'u-t1' }, { id: 'm2', couple_id: 'c-t12', sender_id: 'u-t2' },
        { id: 'm3', couple_id: 'c-real', sender_id: 'u-real1' },
      ],
      data_entries: [{ id: 'e1', couple_id: 'c-t12', author_id: 'u-t1' }, { id: 'e2', couple_id: 'c-real', author_id: 'u-real2' }],
      issues: [{ id: 'i1', couple_id: 'c-t12', published_at: '2026-11-01T00:00:00Z' }],
      corners: [{ id: 'k1', couple_id: 'c-t12' }],
      stories: [], date_stops: [], stat_snapshots: [], dates: [],
    },
    userRows: {
      profiles: users.map((u) => ({ id: u.id })),
      personality_assessments: [{ id: 'pa1', user_id: 'u-t1' }],
      personality_profiles: [{ user_id: 'u-t1' }],
    },
    files: {
      entries: ['c-t12/a.jpg', 'c-t12/b.jpg', 'c-real/x.jpg'],
      magazine: ['c-t12/i1/page-01.jpg'],
      avatars: ['u-t3/reference', 'u-real1/reference'],
    },
    untouchable: {
      demo_responses: [{ id: 'dr1' }, { id: 'dr2' }],
      push_daily: [{ day: '2026-11-23' }],
      app_error_daily: [{ day: '2026-11-23' }],
    },
  }
}
