/**
 * resetTestAccount 시험 (74-0) - 원격 없이 가짜 접속으로. 루트 jest가 줍지 않는 이름이다.
 * 실행: deno test --no-check --no-lock --unstable-sloppy-imports scripts/ops/resetTestAccountCheck.ts
 * (권한 플래그 불필요 - 가짜 접속은 환경·네트워크·파일을 쓰지 않는다)
 */
import { OpsStopError } from './opsGuards.ts'
import {
  COUPLE_BUCKETS,
  COUPLE_CASCADE_TABLES,
  failureLines,
  MAGAZINE_BUCKETS,
  parseAnyResetArgs,
  runCoupleReset,
  LOOKUP_FAILED_MESSAGE,
  looksLikePublicKey,
  PUBLIC_KEY_HINT,
  parseResetArgs,
  runReset,
  type CoupleLite,
  type ResetPort,
} from './resetTestAccount.ts'

const EMAIL = 'tester@example.com'
const USER = 'user-id-1111'
const COUPLE = 'couple-id-2222'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}
function eq<T>(a: T, b: T, msg: string): void {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)
}

interface Fake {
  port: ResetPort
  calls: string[]
}

function fake(opts: { users?: string[]; couples?: CoupleLite[]; published?: boolean; withdrawalAt?: string | null } = {}): Fake {
  const calls: string[] = []
  const port: ResetPort = {
    findUserIds: (e) => {
      calls.push('findUserIds')
      assert(e === EMAIL, 'email passed')
      return Promise.resolve(opts.users ?? [USER])
    },
    listCouples: () => Promise.resolve(opts.couples ?? [{ id: COUPLE, user_a_id: USER, user_b_id: null }]),
    hasPublishedIssue: () => Promise.resolve(opts.published ?? false),
    count: (table) => Promise.resolve(table === 'data_entries' ? 3 : 1),
    countFiles: (bucket) => Promise.resolve(bucket === 'entries' ? 4 : 0),
    removeFiles: (bucket, prefix) => {
      calls.push(`removeFiles:${bucket}:${prefix}`)
      return Promise.resolve(0)
    },
    deleteRows: (table) => {
      calls.push(`deleteRows:${table}`)
      return Promise.resolve()
    },
    deleteUser: () => {
      calls.push('deleteUser')
      return Promise.resolve()
    },
    withdrawalStartedAt: () => Promise.resolve(opts.withdrawalAt ?? null),
  }
  return { port, calls }
}

const DELETING = (c: string) => c.startsWith('removeFiles') || c.startsWith('deleteRows') || c === 'deleteUser'

Deno.test('거부 1: 개발 프로젝트가 아니면 접속 단계에서 멈춘다 (아무 호출 없음)', async () => {
  const r = await runReset(() => Promise.reject(new OpsStopError('x')), { email: EMAIL, apply: true })
  eq(r.kind, 'refused', 'kind')
  eq(r.lines.length, 1, 'one line')
})

Deno.test('거부 2: 사용자 0명 / 2명 이상', async () => {
  for (const users of [[], ['a', 'b']]) {
    const f = fake({ users })
    const r = await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply: true })
    eq(r.kind, 'refused', 'kind')
    eq(r.lines.length, 1, 'one line')
    assert(!f.calls.some(DELETING), 'no delete')
  }
})

Deno.test('거부 3: 커플로 연결된 계정 (user_b 채워진 행)', async () => {
  const f = fake({ couples: [{ id: COUPLE, user_a_id: USER, user_b_id: 'partner-id' }] })
  const r = await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply: true })
  eq(r.kind, 'refused', 'kind')
  assert(!f.calls.some(DELETING), 'no delete')
})

Deno.test('거부 4: 발행된 호가 있는 계정', async () => {
  const f = fake({ published: true })
  const r = await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply: true })
  eq(r.kind, 'refused', 'kind')
  assert(!f.calls.some(DELETING), 'no delete')
})

Deno.test('미리 보기는 삭제 호출을 하지 않고 표별 숫자를 낸다', async () => {
  const f = fake()
  const r = await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply: false })
  eq(r.kind, 'previewed', 'kind')
  assert(!f.calls.some(DELETING), 'no delete')
  assert(r.lines.includes('data_entries: 3'), 'table count line')
  assert(r.lines.includes('Storage: 4'), 'storage line')
})

Deno.test('74-h1: 미리 보기에 상대 유무 · 탈퇴 유예 · 시작일(KST 날짜만) 줄이 있고 삭제는 없다', async () => {
  const none = await runReset(() => Promise.resolve(fake().port), { email: EMAIL, apply: false })
  assert(none.lines.includes('상대 사용자: 아니오'), 'partner no')
  assert(none.lines.includes('탈퇴 유예: 아니오'), 'withdrawal no')
  assert(!none.lines.some((l) => l.startsWith('탈퇴 유예 시작일')), 'no start date')
  const f = fake({ withdrawalAt: '2026-11-09T16:30:00+00:00' })
  const r = await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply: false })
  assert(r.lines.includes('탈퇴 유예: 예'), 'withdrawal yes')
  assert(r.lines.includes('탈퇴 유예 시작일(KST): 2026-11-10'), 'kst date')
  assert(!r.lines.join(' ').includes('16:30'), 'no time')
  assert(!f.calls.some(DELETING), 'no delete')
})

Deno.test('--apply: Storage -> 커플 행 -> 사용자 순서', async () => {
  const f = fake()
  const r = await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply: true })
  eq(r.kind, 'applied', 'kind')
  const del = f.calls.filter(DELETING)
  const expected = [
    ...COUPLE_BUCKETS.map((b) => `removeFiles:${b}:${COUPLE}`),
    `removeFiles:avatars:${USER}`,
    'deleteRows:couples',
    'deleteUser',
  ]
  eq(del, expected, 'order')
})

Deno.test('커플이 없는 계정은 커플 행 삭제 없이 사용자만', async () => {
  const f = fake({ couples: [] })
  await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply: true })
  eq(f.calls.filter(DELETING), [`removeFiles:avatars:${USER}`, 'deleteUser'], 'order')
})

Deno.test('출력에 이메일 · id 가 없고 demo_responses 를 다루지 않는다', async () => {
  for (const apply of [false, true]) {
    const f = fake()
    const r = await runReset(() => Promise.resolve(f.port), { email: EMAIL, apply })
    const text = r.lines.join('\n')
    for (const secret of [EMAIL, 'example.com', USER, COUPLE]) assert(!text.includes(secret), `leak: ${secret}`)
    assert(!text.includes('demo_responses'), 'demo_responses')
    assert(!(COUPLE_CASCADE_TABLES as readonly string[]).includes('demo_responses'), 'table list')
  }
})

Deno.test('인자 읽기', () => {
  eq(parseResetArgs([EMAIL]), { email: EMAIL, apply: false }, 'default preview')
  eq(parseResetArgs([EMAIL, '--apply']), { email: EMAIL, apply: true }, 'apply')
  for (const bad of [[], ['--apply'], [EMAIL, '--force'], ['noemail']]) {
    let threw = false
    try {
      parseResetArgs(bad)
    } catch (e) {
      threw = true
      assert(!String((e as Error).message).includes('noemail'), 'message leaks arg')
    }
    assert(threw, `should throw: ${bad.length}`)
  }
})

// ── 74-h2 ④ 공개 키 안내 ───────────────────────────────────────────────────────────────────────────
// 시험용 가짜 키는 시험 안에서 조립한다(진짜 키가 아니다). 형식만 흉내 낸다.
const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwtWithRole = (role: string) => `${b64url({ alg: 'HS256' })}.${b64url({ role })}.sig-not-real`

Deno.test('74-h2 ④: 키 형식 판별 - anon JWT · sb_publishable_ = 공개, service_role JWT · sb_secret_ = 서비스, 모르면 아님', () => {
  eq(looksLikePublicKey(jwtWithRole('anon')), true, 'anon jwt')
  eq(looksLikePublicKey('sb_publishable_fake-not-real'), true, 'publishable')
  eq(looksLikePublicKey(jwtWithRole('service_role')), false, 'service jwt')
  eq(looksLikePublicKey('sb_secret_fake-not-real'), false, 'secret')
  eq(looksLikePublicKey(undefined), false, 'undefined')
  eq(looksLikePublicKey('not-a-key'), false, 'garbage')
  eq(looksLikePublicKey('a.b.c'), false, 'undecodable jwt')
})

Deno.test('74-h2 ④: 사용자 조회 실패 + 공개 키 형식이면 안내 한 줄이 나오고, 출력에 키 문자열이 0이다', () => {
  for (const key of [jwtWithRole('anon'), 'sb_publishable_fake-not-real']) {
    const lines = failureLines(new Error(LOOKUP_FAILED_MESSAGE), key)
    eq(lines, [`중단: ${LOOKUP_FAILED_MESSAGE}`, PUBLIC_KEY_HINT], 'lines')
    const text = lines.join(' ')
    assert(!text.includes(key), 'key leaked')
    for (const part of key.split('.')) assert(part.length < 8 || !text.includes(part), 'key part leaked')
    assert(text.includes('service_role'), 'hint text')
  }
})

Deno.test('74-h2 ④: 서비스 키이거나 다른 실패면 안내 줄이 없다', () => {
  eq(failureLines(new Error(LOOKUP_FAILED_MESSAGE), jwtWithRole('service_role')).length, 1, 'service key')
  eq(failureLines(new Error('couples 조회 실패'), jwtWithRole('anon')).length, 1, 'other failure')
  eq(failureLines('not an error', jwtWithRole('anon')).length, 1, 'non-error')
})

// ── 74-h3 시험 커플 모드 (R81-1) ───────────────────────────────────────────────────────────────────
const EMAIL_B = 'partner@example.com'
const USER_B = 'user-id-3333'
const PAIR: CoupleLite = { id: COUPLE, user_a_id: USER, user_b_id: USER_B }

function fakeCouple(
  opts: { users?: Record<string, string[]>; couples?: Record<string, CoupleLite[]>; published?: boolean; issues?: number } = {},
): Fake {
  const calls: string[] = []
  const users = opts.users ?? { [EMAIL]: [USER], [EMAIL_B]: [USER_B] }
  const couples = opts.couples ?? { [USER]: [PAIR], [USER_B]: [PAIR] }
  const port: ResetPort = {
    findUserIds: (e) => {
      calls.push('findUserIds')
      return Promise.resolve(users[e] ?? [])
    },
    listCouples: (u) => Promise.resolve(couples[u] ?? []),
    hasPublishedIssue: () => Promise.resolve(opts.published ?? false),
    count: (table) => Promise.resolve(table === 'issues' ? (opts.issues ?? 0) : table === 'data_entries' ? 3 : 1),
    countFiles: (bucket) => Promise.resolve(bucket === 'entries' ? 4 : bucket === 'magazine' ? 2 : bucket === 'magazine-print' ? 1 : 0),
    removeFiles: (bucket, prefix) => {
      calls.push(`removeFiles:${bucket}:${prefix}`)
      return Promise.resolve(0)
    },
    deleteRows: (table) => {
      calls.push(`deleteRows:${table}`)
      return Promise.resolve()
    },
    deleteUser: (u) => {
      calls.push(`deleteUser:${u}`)
      return Promise.resolve()
    },
    withdrawalStartedAt: () => Promise.resolve(null),
  }
  return { port, calls }
}

const C_DELETING = (c: string) => c.startsWith('removeFiles') || c.startsWith('deleteRows') || c.startsWith('deleteUser')
const coupleArgs = (o: { apply?: boolean; withIssues?: boolean } = {}) => ({
  emails: [EMAIL, EMAIL_B] as const,
  apply: o.apply ?? true,
  withIssues: o.withIssues ?? false,
})

async function expectRefused(f: Fake, args = coupleArgs()): Promise<void> {
  const r = await runCoupleReset(() => Promise.resolve(f.port), args)
  eq(r.kind, 'refused', 'kind')
  eq(r.lines.length, 1, 'one line')
  assert(!f.calls.some(C_DELETING), 'no delete')
}

Deno.test('74-h3 거부: 개발 프로젝트가 아니면 접속 단계에서 멈춘다', async () => {
  const r = await runCoupleReset(() => Promise.reject(new OpsStopError('x')), coupleArgs())
  eq(r.kind, 'refused', 'kind')
  eq(r.lines.length, 1, 'one line')
})

Deno.test('74-h3 거부: 이메일에 걸리는 사용자가 정확히 2명이 아님 (0명 · 한쪽 2명 · 같은 사람)', async () => {
  for (const users of [
    { [EMAIL]: [USER], [EMAIL_B]: [] },
    { [EMAIL]: [USER, 'x'], [EMAIL_B]: [USER_B] },
    { [EMAIL]: [USER], [EMAIL_B]: [USER] },
  ]) {
    await expectRefused(fakeCouple({ users }))
  }
})

Deno.test('74-h3 거부: 어느 한쪽이 다른 상대와 연결됨', async () => {
  const other: CoupleLite = { id: 'couple-other', user_a_id: USER_B, user_b_id: 'third-person' }
  await expectRefused(fakeCouple({ couples: { [USER]: [PAIR], [USER_B]: [PAIR, other] } }))
})

Deno.test('74-h3 거부: 두 사람이 같은 커플이 아님 (각자 혼자 초대 행만)', async () => {
  const a: CoupleLite = { id: 'c-a', user_a_id: USER, user_b_id: null }
  const b: CoupleLite = { id: 'c-b', user_a_id: USER_B, user_b_id: null }
  await expectRefused(fakeCouple({ couples: { [USER]: [a], [USER_B]: [b] } }))
})

Deno.test('74-h3 거부: 발행 호가 있고 --with-issues 가 없음 (미리 보기 · apply 모두)', async () => {
  for (const apply of [false, true]) await expectRefused(fakeCouple({ published: true, issues: 1 }), coupleArgs({ apply }))
})

Deno.test('74-h3 미리 보기: 지우지 않고 호 수 · 매거진 파일 수를 낸다', async () => {
  const f = fakeCouple({ published: true, issues: 2 })
  const r = await runCoupleReset(() => Promise.resolve(f.port), coupleArgs({ apply: false, withIssues: true }))
  eq(r.kind, 'previewed', 'kind')
  assert(!f.calls.some(C_DELETING), 'no delete')
  assert(r.lines.includes('발행 호 있음: 예'), 'published line')
  assert(r.lines.includes('호(issues): 2'), 'issue count')
  assert(r.lines.includes('매거진 파일(magazine · magazine-print): 3'), 'magazine files')
  assert(r.lines.includes('auth 사용자: 2'), 'two users')
  assert(r.lines.includes('Storage: 7'), 'storage total')
})

Deno.test('74-h3 --apply (발행 호 없음): Storage -> 커플 행 -> 두 사용자, issues 직접 삭제 없음', async () => {
  const f = fakeCouple()
  const r = await runCoupleReset(() => Promise.resolve(f.port), coupleArgs())
  eq(r.kind, 'applied', 'kind')
  eq(
    f.calls.filter(C_DELETING),
    [
      ...COUPLE_BUCKETS.map((b) => `removeFiles:${b}:${COUPLE}`),
      `removeFiles:avatars:${USER}`,
      `removeFiles:avatars:${USER_B}`,
      'deleteRows:couples',
      `deleteUser:${USER}`,
      `deleteUser:${USER_B}`,
    ],
    'order',
  )
})

Deno.test('74-h3 --with-issues --apply: 매거진 파일 포함 Storage -> issues -> 커플 행 -> 두 사용자', async () => {
  const f = fakeCouple({ published: true, issues: 1 })
  const r = await runCoupleReset(() => Promise.resolve(f.port), coupleArgs({ withIssues: true }))
  eq(r.kind, 'applied', 'kind')
  const del = f.calls.filter(C_DELETING)
  for (const b of MAGAZINE_BUCKETS) assert(del.includes(`removeFiles:${b}:${COUPLE}`), `magazine bucket ${b}`)
  eq(del.slice(-4), ['deleteRows:issues', 'deleteRows:couples', `deleteUser:${USER}`, `deleteUser:${USER_B}`], 'tail order')
  assert(del.indexOf('deleteRows:issues') > del.lastIndexOf(`removeFiles:avatars:${USER_B}`), 'storage first')
})

Deno.test('74-h3 서로가 유일한 상대면 혼자 초대 행도 함께 지운다', async () => {
  const solo: CoupleLite = { id: 'c-solo', user_a_id: USER, user_b_id: null }
  const f = fakeCouple({ couples: { [USER]: [PAIR, solo], [USER_B]: [PAIR] } })
  const r = await runCoupleReset(() => Promise.resolve(f.port), coupleArgs())
  eq(r.kind, 'applied', 'kind')
  assert(r.lines.includes('couples: 2'), 'two couple rows')
  assert(f.calls.includes('removeFiles:entries:c-solo'), 'solo storage')
})

Deno.test('74-h3 출력에 이메일 · id 가 없다', async () => {
  for (const apply of [false, true]) {
    const f = fakeCouple({ published: true, issues: 1 })
    const r = await runCoupleReset(() => Promise.resolve(f.port), coupleArgs({ apply, withIssues: true }))
    const text = r.lines.join('\n')
    for (const secret of [EMAIL, EMAIL_B, 'example.com', USER, USER_B, COUPLE]) assert(!text.includes(secret), `leak: ${secret}`)
    assert(!text.includes('demo_responses'), 'demo_responses')
  }
})

Deno.test('74-h3 인자 읽기: 이메일 1개는 단독 모드 그대로, 2개는 커플 모드', () => {
  eq(parseAnyResetArgs([EMAIL]), { mode: 'single', args: { email: EMAIL, apply: false } }, 'single')
  eq(parseAnyResetArgs([EMAIL, '--apply']), { mode: 'single', args: { email: EMAIL, apply: true } }, 'single apply')
  eq(parseAnyResetArgs([EMAIL, EMAIL_B]), { mode: 'couple', args: { emails: [EMAIL, EMAIL_B], apply: false, withIssues: false } }, 'couple')
  eq(
    parseAnyResetArgs([EMAIL, EMAIL_B, '--with-issues', '--apply']),
    { mode: 'couple', args: { emails: [EMAIL, EMAIL_B], apply: true, withIssues: true } },
    'couple flags',
  )
  for (const bad of [[EMAIL, '--with-issues'], [EMAIL, 'noemail'], [EMAIL, EMAIL.toUpperCase()], [EMAIL, EMAIL_B, '--force'], [EMAIL, EMAIL_B, 'c@x.y']]) {
    let threw = false
    try {
      parseAnyResetArgs(bad)
    } catch (e) {
      threw = true
      const m = String((e as Error).message)
      assert(!m.includes('noemail') && !m.includes('example.com'), 'message leaks arg')
    }
    assert(threw, `should throw: ${bad.join(' ')}`)
  }
})
