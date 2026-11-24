/**
 * 91-b 패턴 모드 Deno 시험 - 실제 실행기(Deno)에서 같은 흐름을 한 번 더 본다. 루트 jest가 줍지 않는 이름이다. 원격 0 · 가짜 값만.
 * 실행: deno test --no-check --no-lock --unstable-sloppy-imports scripts/ops/resetTestPatternCheck.ts
 * 경우 전체는 루트 jest `resetTestPattern.test.ts`.
 */
import { makeProjectGate } from './resetAllowlist.ts'
import { kstMidnightMs, parsePatternArgs, runPatternReset, type PatternArgs } from './resetTestPattern.ts'
import { baseWorld, makeFakePatternPort } from './resetTestPatternFake.ts'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}
const DEV_REF = 'fakedevref000000aaaa'
const gate = makeProjectGate({ allowlistText: `project=${DEV_REF}\n`, url: `https://${DEV_REF}.supabase.co` })
const CUTOFF = kstMidnightMs('2026-11-25')!
const args = (apply: boolean, n: number | null): PatternArgs => ({ createdBeforeMs: CUTOFF, apply, expectUsers: n })
const WRITE = (c: string) => c.startsWith('removeFiles') || c.startsWith('deleteRows') || c.startsWith('deleteUser')

Deno.test('91-b: 미리 보기는 쓰기 0 · 건수만(값 0)', async () => {
  const f = makeFakePatternPort(baseWorld())
  const r = await runPatternReset(() => Promise.resolve(f.port), args(false, null), gate)
  assert(r.kind === 'previewed', 'previewed')
  assert(f.calls.length === 0, 'no writes')
  assert(r.lines.includes('대상 사용자: 5'), 'target count')
  assert(!/u-t|u-real|c-t|c-real|@/.test(r.lines.join('\n')), 'no values')
})

Deno.test('91-b: 커플 상대가 패턴 밖이면 전체 거부 · 0 삭제', async () => {
  const w = baseWorld()
  w.couples.push({ id: 'c-mixed', user_a_id: 'u-t3', user_b_id: 'u-real1', status: 'active', start_date_set_by: null, start_date_confirmed_by: null, nickname_changed_by: null, nickname: null })
  const f = makeFakePatternPort(w)
  const r = await runPatternReset(() => Promise.resolve(f.port), args(true, 5), gate)
  assert(r.kind === 'refused' && r.lines.length === 1, 'refused one line')
  assert(f.calls.filter(WRITE).length === 0, 'no writes')
})

Deno.test('91-b: --expect-users 불일치 거부 · 일치하면 지우고 대상 밖은 남음', async () => {
  const w = baseWorld()
  const bad = await runPatternReset(() => Promise.resolve(makeFakePatternPort(w).port), args(true, 4), gate)
  assert(bad.kind === 'refused', 'mismatch refused')
  const r = await runPatternReset(() => Promise.resolve(makeFakePatternPort(w).port), args(true, 5), gate)
  assert(r.kind === 'applied', 'applied')
  assert(JSON.stringify(w.users.map((u) => u.id)) === JSON.stringify(['u-real1', 'u-real2']), 'outsiders kept')
  assert(w.untouchable.demo_responses.length === 2, 'demo_responses untouched')
})

Deno.test('91-b: 개발 프로젝트가 아니면 접속 전 거부 · 인자 없으면 거부', async () => {
  let connected = 0
  const prod = makeProjectGate({ allowlistText: `project=${DEV_REF}\n`, url: 'https://fakeprodref00000bbbb.supabase.co' })
  const r = await runPatternReset(() => { connected++; return Promise.resolve(makeFakePatternPort(baseWorld()).port) }, args(false, null), prod)
  assert(r.kind === 'refused' && connected === 0, 'refused before connect')
  let threw = false
  try {
    parsePatternArgs(['--apply'])
  } catch {
    threw = true
  }
  assert(threw, 'missing --created-before refused')
})
