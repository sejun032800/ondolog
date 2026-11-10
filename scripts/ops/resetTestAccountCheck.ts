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
    listCouples: () => Promise.resolve(opts.couples ?? [{ id: COUPLE, user_b_id: null }]),
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
  const f = fake({ couples: [{ id: COUPLE, user_b_id: 'partner-id' }] })
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
