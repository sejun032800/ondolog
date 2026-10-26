/**
 * 027 해제 · 탈퇴 · 재검사 함수 + 칸 단위 쓰기 실증 (`68-` 1부 산출) - 원격 **개발** DB, 사용자 세션 (Deno 전용).
 * **작성만 했고 실행하지 않았다.** 027을 원격에 적용하고 `scripts/db/verify_027_privileges.sql`이 전부 ok 인 것을 본 뒤 사람이 실행한다.
 * 적용 전에 돌리면 ONDOLOG_027_APPLIED=1 이 없어 멈춘다.
 *
 * 세션 규칙 (R40-5 · R42-4): 시험 계정은 service_role 로 **만들기만** 하고(계정 생성 · 로그인 링크 발급), 가입 · 연결 · 해제 · 탈퇴 · 재검사 ·
 * 직접 UPDATE/INSERT 시도 · 조회는 전부 그 계정의 **사용자 세션**이다. 이 스크립트가 service_role 로 하는 일은 그 두 가지와 "service_role 이 함수를
 * 못 부른다"는 확인(⑳) 하나뿐이다. 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 실행하지 않고 SKIP 으로 적는다(null 을 다루지 않고 멈춘다, R40-5).
 * 파괴적 배치 함수(execute_dissolution · apply_retention_policy)는 어떤 경로로도 부르지 않는다(R34-3).
 *
 * 끝에서 모든 해제 · 탈퇴를 취소한다 - 단 `test-68-purge` 커플 하나는 해제 요청을 남겨 둔다. 그 커플의 purge_scheduled_at(서버 값)과
 * 확인 스크립트를 돌릴 날짜(유예 끝 다음 pg_cron 실행 시각)를 출력하고 scripts/ops/out/68-purge-target.json 에 적는다(키 · 토큰 · URL 없음).
 *
 * 경우 (SCHEMA 9-G 실증 목록):
 *   ① A 해제 요청 -> couples.status = dissolving · 유예 7일(서버 requested_at 기준 ±1분) · 개시자 = A · 사유 unlink
 *   ② 중복 요청 23505 (A 와 B 모두)
 *   ③ 상대 B 가 진행 중 해제를 본다
 *   ④ 상대 B 의 취소 시도 42501 (행 그대로)
 *   ⑤ 클라이언트가 purge_scheduled_at 을 넣는 INSERT · UPDATE · DELETE 거부 (행 그대로)
 *   ⑥ 개시자 A 취소 -> active · 재호출 멱등 · 다시 요청 가능(새 id) · 다시 취소
 *   ⑦ C 탈퇴 요청 -> profiles 두 칸(7일) + 커플 dissolving + 사유 withdrawal · 재호출 같은 값(멱등)
 *   ⑧ 탈퇴로 생긴 해제를 해제 취소 함수로 취소하려 하면 22023 (내부 결정 b) · 상대 D 는 그 해제를 보고 취소 시도 42501
 *   ⑨ C 탈퇴 취소 -> 원상(프로필 두 칸 null · 해제 취소됨 · 커플 active) · 재호출 멱등
 *   ⑩ 커플 없는 E 의 탈퇴 요청 -> 프로필 두 칸만(해제 행 없음) · 취소 -> 원상
 *   ⑪ deleted_at · purge_scheduled_at · terms/privacy/ai_usage_agreed_at · birth_date · mbti 직접 UPDATE 거부(행 그대로)
 *   ⑫ onboarding_step 감소 22023 · 같은 값 · 증가 허용
 *   ⑬ 마케팅 동의 켜기 · 끄기 · display_name · gender 허용(칸 단위)
 *   ⑭ profiles INSERT 에 deleted_at / purge_scheduled_at 을 넣으면 거부 · 정상 가입 INSERT 는 통과
 *   ⑮ personality_profiles: retest_used · active_assessment_id 직접 UPDATE 거부, 오버라이드 네 칸 UPDATE 허용, retest_used = true INSERT 거부 · false INSERT 통과
 *   ⑯ 재검사 함수 정상(E): out_recovered = false · seq 2 · profiles.mbti 갱신 · 오버라이드 null · retest_used true
 *   ⑰ 두 번째 호출 23505 (행 수 그대로)
 *   ⑱ 끊긴 상태 복구(F): seq 2 를 직접 넣어 둔 뒤 호출 -> out_recovered = true, 인자가 아니라 기존 seq 2 행의 값으로 끝남
 *   ⑲ 권한: anon 은 다섯 모두 거부 · service_role 은 다섯 모두 거부 (has_function_privilege · prosecdef · proconfig 는 SQL 파일이 본다)
 *   ⑳ RLS 회귀: A 가 자기 · 상대 프로필 읽기 · 구성원 아닌 계정이 해제 행 읽기 0
 *   ㉑ test-68-purge 커플 하나: 메시지 · 대표사진 경로를 준비한 뒤 해제 요청을 남겨 둔다 (확인 스크립트가 쓸 값 출력)
 *   ㉒ 마무리: 모든 해제 · 탈퇴 취소 (purge 커플 하나만 남음)
 *   보안 점검(get_advisors 원문 JSON)은 도구로 저장해야 한다(메인 세션) - 저장한 뒤 `compare` 모드로 기준선과 비교한다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY · ONDOLOG_027_APPLIED=1
 *           (선택) ONDOLOG_EXEC_DISSOLUTIONS_CRON  execute-dissolutions 작업의 cron 표현식. 없으면 014 의 '0 5 * * *'.
 *           사람은 verify_027_privileges.sql 이 아니라 아래로 값을 확인한다: select schedule from cron.job where jobname = 'execute-dissolutions'
 *
 * 사용 (저장소 루트에서, PowerShell 한 줄씩 - ref 는 supabase/.temp/project-ref 에서 읽는다):
 *   $ref = (Get-Content supabase/.temp/project-ref).Trim(); $env:ONDOLOG_027_APPLIED='1'; deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY,ONDOLOG_027_APPLIED,ONDOLOG_EXEC_DISSOLUTIONS_CRON --allow-net="$ref.supabase.co" --allow-read=supabase/.temp/linked-project.json,src,scripts/ops/out --allow-write=scripts/ops/out scripts/ops/verifyDissolution68.ts run
 *   (보안 점검 비교) deno run --no-check --no-lock --allow-read=scripts/ops/out --allow-write=scripts/ops/out scripts/ops/verifyDissolution68.ts compare
 *
 * 출력 원문: scripts/ops/out/68-dissolution.txt · 68-purge-target.json · 68-security-compare.txt (추적 안 함)
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any
// deno-lint-ignore no-explicit-any
type Err = { code?: string; message?: string } | null

const DAY_MS = 86400000
const WEEK_MS = 7 * DAY_MS
const TOLERANCE_MS = 60000

/** "m h * * *" 형태만 읽는다(pg_cron 은 UTC). 유예 끝(purgeAt) 이후 첫 실행 시각을 돌려준다. */
export function nextCronRun(purgeAt: Date, expr: string): Date {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(expr.trim())
  if (!m) throw new Error(`cron 표현식을 해석하지 못했다 ("m h * * *" 형태만 지원): ${expr}`)
  const minute = Number(m[1])
  const hour = Number(m[2])
  const c = new Date(Date.UTC(purgeAt.getUTCFullYear(), purgeAt.getUTCMonth(), purgeAt.getUTCDate(), hour, minute, 0, 0))
  // 실행 시점에 purge_scheduled_at <= now() 여야 집힌다 -> 실행 시각이 purgeAt 이상인 첫 날.
  if (c.getTime() < purgeAt.getTime()) c.setUTCDate(c.getUTCDate() + 1)
  return c
}

const kst = (d: Date) => new Date(d.getTime() + 9 * 3600000).toISOString().replace('T', ' ').slice(0, 16) + ' KST'

async function compareMode(): Promise<void> {
  const read = async (p: string) => JSON.parse(await Deno.readTextFile(p))
  let after
  try {
    after = await read('scripts/ops/out/68-security-after.json')
  } catch {
    console.log('scripts/ops/out/68-security-after.json 이 없다 - 027 적용 뒤 get_advisors(security) 원문 JSON 을 그 이름으로 저장한 다음 다시 실행한다.')
    return
  }
  const before = await read('scripts/ops/out/68-security-baseline.json')
  const names = (j: { result: { lints: { name: string; findings: { detail: string }[] }[] } }) => {
    const m = new Map<string, Set<string>>()
    for (const l of j.result.lints) m.set(l.name, new Set(l.findings.map((f) => f.detail.replace(/observed_at.*/, ''))))
    return m
  }
  const b = names(before)
  const a = names(after)
  const out: string[] = []
  let bad = 0
  for (const name of new Set([...b.keys(), ...a.keys()])) {
    const bs = b.get(name) ?? new Set<string>()
    const as = a.get(name) ?? new Set<string>()
    const added = [...as].filter((x) => !bs.has(x))
    const removed = [...bs].filter((x) => !as.has(x))
    out.push(`${name}: 전 ${bs.size} -> 후 ${as.size}, 추가 ${added.length}, 사라짐 ${removed.length}`)
    for (const x of added) out.push(`  + ${x}`)
    for (const x of removed) out.push(`  - ${x}`)
    if (name === 'authenticated_security_definer_function_executable') {
      const fiveNames = ['fn_request_dissolution', 'fn_cancel_dissolution', 'fn_request_withdrawal', 'fn_cancel_withdrawal', 'fn_complete_retest']
      const addedOk = added.length === 5 && fiveNames.every((f) => added.some((x) => x.includes(`public.${f}(`)))
      if (!addedOk || removed.length > 0) bad += 1
      out.push(`  기대: 함수 다섯만 추가 -> ${addedOk && removed.length === 0 ? 'ok' : 'FAIL'}`)
    } else if (added.length > 0 || removed.length > 0) {
      bad += 1
      out.push('  기대: 변화 없음 -> FAIL')
    }
  }
  out.push(`\n어긋남 ${bad}건`)
  const text = out.join('\n') + '\n'
  console.log(text)
  await Deno.writeTextFile('scripts/ops/out/68-security-compare.txt', text)
  if (bad > 0) Deno.exit(1)
}

async function main(): Promise<void> {
  if (Deno.env.get('ONDOLOG_027_APPLIED') !== '1') {
    throw new Error('027 적용 전에는 실행하지 않는다. 적용 · verify_027_privileges.sql 확인 뒤 ONDOLOG_027_APPLIED=1 로 실행')
  }
  const ops = await connectOps()
  const admin: Db = ops.client
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
  const anonKey = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
  if (!anonKey) throw new Error('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
  const cronExpr = Deno.env.get('ONDOLOG_EXEC_DISSOLUTIONS_CRON') ?? '0 5 * * *'
  const secrets = [...ops.secrets, anonKey]
  const say = printer(secrets)
  const out: string[] = []
  let failures = 0
  const line = (s: string) => {
    out.push(s)
    say(s)
  }
  const failed = new Set<string>()
  const done = new Set<string>()
  async function step(id: string, label: string, needs: string[], fn: () => Promise<string>): Promise<void> {
    const blocked = needs.filter((n) => !done.has(n))
    if (blocked.length > 0) {
      failed.add(id)
      line(`SKIP ${id} ${label} - 앞 단계(${blocked.join(',')})가 통과하지 못해 실행하지 않음`)
      return
    }
    try {
      const detail = await fn()
      done.add(id)
      line(`OK   ${id} ${label} - ${detail}`)
    } catch (e) {
      failures += 1
      failed.add(id)
      line(`FAIL ${id} ${label} - ${(e as Error).message}`)
    }
  }
  const must = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg)
  }
  const errText = (e: Err) => (e ? `${e.code ?? '?'} ${e.message ?? ''}` : '오류 없음(!)')
  const denied = (e: Err) => !!e && (e.code === '42501' || /permission denied|row-level security/i.test(e.message ?? ''))
  const code = (e: Err) => (e ? (e.code ?? '?') : '오류 없음')

  // ── 준비: 시험 계정 + 각자 사용자 세션 로그인 ───────────────────────────────────────
  const run = Date.now().toString(36)
  const ids: Record<string, string> = {}
  const dbs: Record<string, Db> = {}
  async function makeUser(label: string, prefix = 'test-68'): Promise<void> {
    const email = `${prefix}-${run}-${label}@example.com`
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
    if (created.error) throw new Error(`계정 생성 실패(${label}): ${created.error.message}`)
    ids[label] = created.data.user.id
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패(${label}): ${link.error.message}`)
    const c: Db = createClient(url, anonKey as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const v = await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (v.error) throw new Error(`로그인 실패(${label}): ${v.error.message}`)
    secrets.push(v.data.session?.access_token ?? '', v.data.session?.refresh_token ?? '')
    dbs[label] = c
  }
  // 앱 가입 INSERT(personalityCore.createProfileAndAssessment)와 같은 칸. 사용자 세션.
  const signupProfile = (label: string, step = 3) => {
    const now = new Date().toISOString()
    return dbs[label].from('profiles').insert({
      id: ids[label], display_name: `test-68-${label}`, gender: 'other', birth_date: '1995-01-01', mbti: 'INFJ',
      onboarding_step: step, terms_agreed_at: now, privacy_agreed_at: now, ai_usage_agreed_at: now,
    })
  }
  const assessmentRow = (label: string, seq: number, core: number, attachment: string, mbti: string) => ({
    user_id: ids[label], seq, mbti, mbti_self_reported: true, q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A',
    enneagram_core: core, big_o: 50, big_c: 50, big_e: 50, big_a: 50, big_n: 50,
    stern_intimacy: 50, stern_passion: 50, stern_commitment: 50, attach_anxiety: 50, attach_avoidance: 50,
    attachment, engine_version: 'test-68',
  })
  const retestArgs = (core: number, attachment: string, mbti: string, loveType: string) => ({
    p_mbti: mbti, p_mbti_self_reported: true, p_q1: 'B', p_q2: 'B', p_q3: 'B', p_q4: 'B', p_q5: 'B',
    p_enneagram_core: core, p_big_o: 60, p_big_c: 60, p_big_e: 60, p_big_a: 60, p_big_n: 60,
    p_stern_intimacy: 60, p_stern_passion: 60, p_stern_commitment: 60, p_attach_anxiety: 60, p_attach_avoidance: 60,
    p_attachment: attachment, p_engine_version: 'test-68-retest', p_love_type_code: loveType,
  })
  const issue = (l: string, c: string) => dbs[l].from('couples').insert({ user_a_id: ids[l], invite_code: c }).select().single()
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const randomCode = () => Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
  async function connectPair(a: string, b: string, nickname?: string): Promise<string> {
    const i = await issue(a, randomCode())
    if (i.error) throw new Error(`${a} 초대 발급 실패 ${errText(i.error)}`)
    const r = await dbs[b].rpc('fn_connect_couple', { p_invite_code: i.data.invite_code })
    if (r.error) throw new Error(`${b} 연결 실패 ${errText(r.error)}`)
    if (nickname) {
      const n = await dbs[a].from('couples').update({ nickname }).eq('id', r.data)
      if (n.error) throw new Error(`닉네임 실패 ${errText(n.error)}`)
    }
    return r.data
  }
  const profileOf = async (l: string) => (await dbs[l].from('profiles').select('*').eq('id', ids[l]).single()).data
  const couple1: { id: string } = { id: '' }
  const couple2: { id: string } = { id: '' }
  const couplePurge: { id: string } = { id: '' }

  await step('준비', '시험 계정 9개(a~d, e, f, g, p, q) 생성 · 로그인 · 프로필(e 제외) · 커플 3쌍 연결 · e · f 성격 행', [], async () => {
    for (const l of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) await makeUser(l)
    for (const l of ['p', 'q']) await makeUser(l, 'test-68-purge')
    for (const l of ['a', 'b', 'c', 'd', 'f', 'g', 'p', 'q']) {
      const r = await signupProfile(l, 3)
      if (r.error) throw new Error(`프로필 생성 실패(${l}): ${errText(r.error)}`)
    }
    couple1.id = await connectPair('a', 'b')
    couple2.id = await connectPair('c', 'd')
    couplePurge.id = await connectPair('p', 'q', 'test-68-purge')
    for (const l of ['f', 'g']) {
      const a = await dbs[l].from('personality_assessments').insert(assessmentRow(l, 1, 1, 'secure', 'INFJ')).select().single()
      if (a.error) throw new Error(`assessment 실패(${l}): ${errText(a.error)}`)
      if (l === 'f') continue // f 는 ⑮에서 personality_profiles INSERT 를 직접 시험한다
      const p = await dbs[l].from('personality_profiles').insert({
        user_id: ids[l], active_assessment_id: a.data.id, enneagram_inferred: 1, attachment: 'secure', love_type_code: 'KLE',
      })
      if (p.error) throw new Error(`personality_profiles 실패(${l}): ${errText(p.error)}`)
    }
    return `커플 ${couple1.id.slice(0, 8)} · ${couple2.id.slice(0, 8)} · purge ${couplePurge.id.slice(0, 8)} (이메일 접두 test-68-${run}- / test-68-purge-${run}-)`
  })
  if (!done.has('준비')) {
    line('\n준비 실패 - 이하 전부 실행하지 않는다')
    return await finish()
  }
  const dbAnon: Db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const openDiss = async (l: string, coupleId: string) =>
    (await dbs[l].from('couple_dissolutions').select('*').eq('couple_id', coupleId).is('cancelled_at', null).is('executed_at', null)).data ?? []
  const coupleStatus = async (l: string, coupleId: string) => (await dbs[l].from('couples').select('status').eq('id', coupleId).single()).data?.status

  let dissA = ''
  // ① ~ ⑥ 해제
  await step('①', 'A 해제 요청 -> dissolving · 유예 7일(서버 시각 기준 ±1분) · 개시자 A · unlink', ['준비'], async () => {
    const r = await dbs.a.rpc('fn_request_dissolution')
    must(!r.error, `요청 실패 ${errText(r.error)}`)
    dissA = r.data
    const d = await dbs.a.from('couple_dissolutions').select('*').eq('id', dissA).single()
    must(!d.error, `조회 실패 ${errText(d.error)}`)
    const grace = new Date(d.data.purge_scheduled_at).getTime() - new Date(d.data.requested_at).getTime()
    must(Math.abs(grace - WEEK_MS) <= TOLERANCE_MS, `유예가 7일이 아니다(${grace / DAY_MS}일)`)
    must(d.data.initiated_by === ids.a && d.data.reason === 'unlink' && d.data.cancelled_at === null && d.data.executed_at === null, `행 이상 ${JSON.stringify(d.data)}`)
    const st = await coupleStatus('a', couple1.id)
    must(st === 'dissolving', `couples.status = ${st}`)
    return `id ${dissA.slice(0, 8)} · purge_scheduled_at ${d.data.purge_scheduled_at} (요청 +${(grace / DAY_MS).toFixed(4)}일) · status dissolving`
  })
  await step('②', '중복 요청 23505 (A 와 B 모두)', ['①'], async () => {
    const ra = await dbs.a.rpc('fn_request_dissolution')
    const rb = await dbs.b.rpc('fn_request_dissolution')
    must(code(ra.error) === '23505', `A: 기대 23505, 실제 ${errText(ra.error)}`)
    must(code(rb.error) === '23505', `B: 기대 23505, 실제 ${errText(rb.error)}`)
    const n = (await openDiss('a', couple1.id)).length
    must(n === 1, `진행 중 해제가 ${n}건`)
    return `A ${code(ra.error)} / B ${code(rb.error)} / 진행 중 1건`
  })
  await step('③', '상대 B 가 진행 중 해제를 본다', ['①'], async () => {
    const r = await dbs.b.from('couple_dissolutions').select('id, initiated_by, purge_scheduled_at').eq('couple_id', couple1.id)
    must(!r.error && r.data.length === 1 && r.data[0].id === dissA, `B 가 못 봄 ${errText(r.error)} ${JSON.stringify(r.data)}`)
    return `B 가 ${r.data[0].id.slice(0, 8)} 를 봄`
  })
  await step('④', '상대 B 의 취소 시도 42501 (행 그대로)', ['①'], async () => {
    const r = await dbs.b.rpc('fn_cancel_dissolution', { p_dissolution_id: dissA })
    must(code(r.error) === '42501', `기대 42501, 실제 ${errText(r.error)}`)
    must((await openDiss('a', couple1.id)).length === 1 && (await coupleStatus('a', couple1.id)) === 'dissolving', '행이 바뀌었다')
    return errText(r.error)
  })
  await step('⑤', '클라이언트 INSERT · UPDATE · DELETE 거부 (purge_scheduled_at 포함, 행 그대로)', ['①'], async () => {
    const before = (await dbs.a.from('couple_dissolutions').select('*').eq('id', dissA).single()).data
    const msgs: string[] = []
    const ins = await dbs.a.from('couple_dissolutions').insert({
      couple_id: couple1.id, initiated_by: ids.a, reason: 'unlink', purge_scheduled_at: new Date(Date.now() + 60000).toISOString(),
    }).select()
    must(denied(ins.error), `INSERT 거부 안 됨 ${errText(ins.error)}`)
    msgs.push(`INSERT ${ins.error.code}`)
    for (const [name, patch] of [
      ['purge_scheduled_at', { purge_scheduled_at: new Date(Date.now() + 60000).toISOString() }],
      ['cancelled_at', { cancelled_at: new Date().toISOString() }],
      ['executed_at', { executed_at: new Date().toISOString() }],
    ] as [string, Record<string, unknown>][]) {
      const u = await dbs.a.from('couple_dissolutions').update(patch).eq('id', dissA).select()
      must(denied(u.error), `UPDATE ${name} 거부 안 됨 ${errText(u.error)} data=${JSON.stringify(u.data)}`)
      msgs.push(`UPDATE ${name} ${u.error.code}`)
    }
    const del = await dbs.a.from('couple_dissolutions').delete().eq('id', dissA).select()
    must(denied(del.error), `DELETE 거부 안 됨 ${errText(del.error)} data=${JSON.stringify(del.data)}`)
    msgs.push(`DELETE ${del.error.code}`)
    const after = (await dbs.a.from('couple_dissolutions').select('*').eq('id', dissA).single()).data
    must(JSON.stringify(before) === JSON.stringify(after), '행이 바뀌었다')
    return msgs.join(' / ') + ' - 행 그대로'
  })
  await step('⑥', '개시자 A 취소 -> active · 멱등 · 다시 요청(새 id) · 다시 취소', ['①', '⑤'], async () => {
    const c1 = await dbs.a.rpc('fn_cancel_dissolution', { p_dissolution_id: dissA })
    must(!c1.error, `취소 실패 ${errText(c1.error)}`)
    const st = await coupleStatus('a', couple1.id)
    const d = (await dbs.a.from('couple_dissolutions').select('cancelled_at, executed_at').eq('id', dissA).single()).data
    must(st === 'active' && d.cancelled_at !== null && d.executed_at === null, `상태 이상 status=${st} ${JSON.stringify(d)}`)
    const c2 = await dbs.a.rpc('fn_cancel_dissolution', { p_dissolution_id: dissA })
    must(!c2.error, `재취소(멱등) 실패 ${errText(c2.error)}`)
    const again = await dbs.a.rpc('fn_request_dissolution')
    must(!again.error && again.data !== dissA, `재요청 실패 ${errText(again.error)}`)
    const c3 = await dbs.a.rpc('fn_cancel_dissolution', { p_dissolution_id: again.data })
    must(!c3.error, `두 번째 해제 취소 실패 ${errText(c3.error)}`)
    must((await coupleStatus('a', couple1.id)) === 'active' && (await openDiss('a', couple1.id)).length === 0, '최종 상태 이상')
    return `취소 -> active, 재취소 오류 없음, 재요청 새 id ${again.data.slice(0, 8)}, 다시 취소 -> active`
  })

  // ⑦ ~ ⑩ 탈퇴
  let withdrawalPurge = ''
  await step('⑦', 'C 탈퇴 요청 -> 프로필 두 칸(7일) + 커플 dissolving + 사유 withdrawal · 재호출 같은 값', ['준비'], async () => {
    const r = await dbs.c.rpc('fn_request_withdrawal')
    must(!r.error, `요청 실패 ${errText(r.error)}`)
    withdrawalPurge = r.data
    const p = await profileOf('c')
    must(p.deleted_at !== null && p.purge_scheduled_at !== null, `프로필 칸 이상 ${p.deleted_at} ${p.purge_scheduled_at}`)
    const grace = new Date(p.purge_scheduled_at).getTime() - new Date(p.deleted_at).getTime()
    must(Math.abs(grace - WEEK_MS) <= TOLERANCE_MS, `유예가 7일이 아니다(${grace / DAY_MS}일)`)
    must(new Date(r.data).getTime() === new Date(p.purge_scheduled_at).getTime(), `반환값이 purge_scheduled_at 과 다르다(${r.data})`)
    const diss = await openDiss('c', couple2.id)
    must(diss.length === 1 && diss[0].reason === 'withdrawal' && diss[0].initiated_by === ids.c, `해제 행 이상 ${JSON.stringify(diss)}`)
    must(new Date(diss[0].purge_scheduled_at).getTime() === new Date(p.purge_scheduled_at).getTime(), '해제 유예와 프로필 유예가 다르다')
    must((await coupleStatus('c', couple2.id)) === 'dissolving', '커플이 dissolving 이 아니다')
    const r2 = await dbs.c.rpc('fn_request_withdrawal')
    must(!r2.error && new Date(r2.data).getTime() === new Date(withdrawalPurge).getTime(), `재호출이 같은 값이 아니다 ${errText(r2.error)} ${r2.data}`)
    must((await openDiss('c', couple2.id)).length === 1, '재호출이 해제를 또 만들었다')
    return `deleted_at ${p.deleted_at} · purge_scheduled_at ${p.purge_scheduled_at} · 해제 1건(withdrawal) · 재호출 같은 값`
  })
  await step('⑧', '탈퇴로 생긴 해제: 해제 취소 함수 22023 · 상대 D 는 보고 취소 시도 42501', ['⑦'], async () => {
    const diss = await openDiss('c', couple2.id)
    const r = await dbs.c.rpc('fn_cancel_dissolution', { p_dissolution_id: diss[0].id })
    must(code(r.error) === '22023', `C: 기대 22023, 실제 ${errText(r.error)}`)
    const seen = await dbs.d.from('couple_dissolutions').select('id').eq('couple_id', couple2.id)
    must(!seen.error && seen.data.length === 1, `D 가 해제를 못 봄 ${errText(seen.error)}`)
    const rd = await dbs.d.rpc('fn_cancel_dissolution', { p_dissolution_id: diss[0].id })
    must(code(rd.error) === '42501', `D: 기대 42501, 실제 ${errText(rd.error)}`)
    return `C ${code(r.error)} / D 가 봄 · 취소 시도 ${code(rd.error)}`
  })
  await step('⑨', 'C 탈퇴 취소 -> 원상 · 재호출 멱등', ['⑦'], async () => {
    const r = await dbs.c.rpc('fn_cancel_withdrawal')
    must(!r.error, `취소 실패 ${errText(r.error)}`)
    const p = await profileOf('c')
    must(p.deleted_at === null && p.purge_scheduled_at === null, `프로필 칸이 안 비워짐 ${p.deleted_at} ${p.purge_scheduled_at}`)
    must((await openDiss('c', couple2.id)).length === 0, '진행 중 해제가 남았다')
    const all = (await dbs.c.from('couple_dissolutions').select('cancelled_at').eq('couple_id', couple2.id)).data ?? []
    must(all.length === 1 && all[0].cancelled_at !== null, `해제 행이 취소되지 않음 ${JSON.stringify(all)}`)
    must((await coupleStatus('c', couple2.id)) === 'active', '커플이 active 로 안 돌아옴')
    const r2 = await dbs.c.rpc('fn_cancel_withdrawal')
    must(!r2.error, `재호출 오류 ${errText(r2.error)}`)
    return '프로필 두 칸 null · 해제 취소됨 · 커플 active · 재호출 오류 없음'
  })
  await step('⑩', '커플 없는 E 의 탈퇴 요청(프로필 2칸만, 해제 행 없음) -> 취소 -> 원상', ['준비'], async () => {
    // e 는 아직 프로필이 없다 -> 함수는 P0002. 프로필을 먼저 만든다(정상 가입 INSERT, ⑭에서 거부 시험 뒤 같은 INSERT).
    const none = await dbs.e.rpc('fn_request_withdrawal')
    must(code(none.error) === 'P0002', `프로필 없는 계정: 기대 P0002, 실제 ${errText(none.error)}`)
    const bad = await signupProfile('e', 1)
    must(!bad.error, `E 가입 INSERT 실패 ${errText(bad.error)}`)
    const r = await dbs.e.rpc('fn_request_withdrawal')
    must(!r.error, `요청 실패 ${errText(r.error)}`)
    const p = await profileOf('e')
    must(p.deleted_at !== null && p.purge_scheduled_at !== null, '프로필 칸 이상')
    const cnt = await dbs.e.from('couple_dissolutions').select('id', { count: 'exact', head: true })
    must(!cnt.error && cnt.count === 0, `E 에게 보이는 해제 행 ${cnt.count}`)
    const c = await dbs.e.rpc('fn_cancel_withdrawal')
    must(!c.error, `취소 실패 ${errText(c.error)}`)
    const p2 = await profileOf('e')
    must(p2.deleted_at === null && p2.purge_scheduled_at === null, '원상이 아님')
    return `프로필 없음 P0002 -> 가입 INSERT -> 요청(두 칸만) -> 취소(원상)`
  })

  // ⑪ ~ ⑭ profiles 칸
  await step('⑪', 'deleted_at · purge_scheduled_at · 동의 시각 3칸 · birth_date · mbti 직접 UPDATE 거부(행 그대로)', ['⑩'], async () => {
    const before = await profileOf('e')
    const attempts: [string, Record<string, unknown>][] = [
      ['deleted_at', { deleted_at: new Date().toISOString() }],
      ['purge_scheduled_at', { purge_scheduled_at: new Date().toISOString() }],
      ['terms_agreed_at', { terms_agreed_at: new Date().toISOString() }],
      ['privacy_agreed_at', { privacy_agreed_at: new Date().toISOString() }],
      ['ai_usage_agreed_at', { ai_usage_agreed_at: new Date().toISOString() }],
      ['birth_date', { birth_date: '2000-01-01' }],
      ['mbti', { mbti: 'ENTP' }],
    ]
    const msgs: string[] = []
    for (const [name, patch] of attempts) {
      const r = await dbs.e.from('profiles').update(patch).eq('id', ids.e).select()
      must(denied(r.error), `${name}: 거부 안 됨 ${errText(r.error)} data=${JSON.stringify(r.data)}`)
      msgs.push(`${name} ${r.error.code}`)
    }
    const after = await profileOf('e')
    must(JSON.stringify(before) === JSON.stringify({ ...after, updated_at: before.updated_at }), '행이 바뀌었다')
    return msgs.join(' / ') + ' - 행 그대로'
  })
  await step('⑫', 'onboarding_step: 감소 22023 · 같은 값 · 증가 허용', ['⑩'], async () => {
    const set = (v: number) => dbs.e.from('profiles').update({ onboarding_step: v }).eq('id', ids.e).select().single()
    const up = await set(2)
    must(!up.error && up.data.onboarding_step === 2, `증가 실패 ${errText(up.error)}`)
    const same = await set(2)
    must(!same.error, `같은 값 실패 ${errText(same.error)}`)
    const down = await set(1)
    must(code(down.error) === '22023', `감소: 기대 22023, 실제 ${errText(down.error)}`)
    const row = await profileOf('e')
    must(row.onboarding_step === 2, `단계가 바뀜 ${row.onboarding_step}`)
    const up3 = await set(3)
    must(!up3.error && up3.data.onboarding_step === 3, `2 -> 3 실패 ${errText(up3.error)}`)
    return `1 -> 2 허용 · 2 -> 2 허용 · 2 -> 1 ${code(down.error)} (단계 2 그대로) · 2 -> 3 허용`
  })
  await step('⑬', '마케팅 동의 켜기 · 끄기 · display_name · gender 허용', ['⑩'], async () => {
    const on = await dbs.e.from('profiles').update({ marketing_agreed_at: new Date().toISOString() }).eq('id', ids.e).select().single()
    must(!on.error && on.data.marketing_agreed_at !== null, `켜기 실패 ${errText(on.error)}`)
    const off = await dbs.e.from('profiles').update({ marketing_agreed_at: null }).eq('id', ids.e).select().single()
    must(!off.error && off.data.marketing_agreed_at === null, `끄기 실패 ${errText(off.error)}`)
    const b = await dbs.e.from('profiles').update({ display_name: 'test-68-e2', gender: 'female' }).eq('id', ids.e).select().single()
    must(!b.error && b.data.display_name === 'test-68-e2' && b.data.gender === 'female', `이름 · 성별 실패 ${errText(b.error)}`)
    const bio = await dbs.e.from('profiles').update({ biometric_consent_at: new Date().toISOString(), biometric_consent_revoked_at: null }).eq('id', ids.e).select().single()
    must(!bio.error, `생체 동의 칸 실패 ${errText(bio.error)}`)
    const ref = await dbs.e.from('profiles').update({ reference_photo_path: null }).eq('id', ids.e).select().single()
    must(!ref.error, `대표사진 칸 실패 ${errText(ref.error)}`)
    return '마케팅 켜기 · 끄기 · 이름 · 성별 · 생체 동의 두 칸 · 대표사진 경로 모두 동작'
  })
  await step('⑭', 'profiles INSERT 에 deleted_at / purge_scheduled_at 거부 · 정상 가입 INSERT 통과', ['준비'], async () => {
    // h: 프로필이 아직 없는 새 계정
    await makeUser('h')
    const now = new Date().toISOString()
    const base = { id: ids.h, display_name: 'test-68-h', gender: 'other', birth_date: '1995-01-01', onboarding_step: 0, terms_agreed_at: now, privacy_agreed_at: now }
    const r1 = await dbs.h.from('profiles').insert({ ...base, deleted_at: now, purge_scheduled_at: new Date(Date.now() + WEEK_MS).toISOString() }).select()
    must(denied(r1.error), `deleted_at + purge INSERT 거부 안 됨 ${errText(r1.error)}`)
    const r2 = await dbs.h.from('profiles').insert({ ...base, deleted_at: now }).select()
    must(!!r2.error, `deleted_at 단독 INSERT 거부 안 됨 (chk_purge_after_delete 아닌 정책이 막아야 함) ${errText(r2.error)}`)
    const none = await dbs.h.from('profiles').select('id').eq('id', ids.h)
    must(!none.error && none.data.length === 0, '거부된 INSERT 가 행을 남겼다')
    const ok = await dbs.h.from('profiles').insert(base).select().single()
    must(!ok.error, `정상 가입 INSERT 실패 ${errText(ok.error)}`)
    return `deleted_at+purge ${r1.error.code} / deleted_at 단독 ${r2.error.code} / 정상 INSERT 통과`
  })

  // ⑮ ~ ⑱ personality
  await step('⑮', 'personality_profiles: retest_used · active_assessment_id 직접 UPDATE 거부 · 오버라이드 칸 허용 · INSERT retest_used=true 거부', ['준비'], async () => {
    // f: assessment 만 있고 personality_profiles 가 아직 없다
    const fa = (await dbs.f.from('personality_assessments').select('id').eq('user_id', ids.f).eq('seq', 1).single()).data
    const base = { user_id: ids.f, active_assessment_id: fa.id, enneagram_inferred: 1, attachment: 'secure', love_type_code: 'KLE' }
    const bad = await dbs.f.from('personality_profiles').insert({ ...base, retest_used: true }).select()
    must(denied(bad.error), `retest_used=true INSERT 거부 안 됨 ${errText(bad.error)}`)
    const good = await dbs.f.from('personality_profiles').insert({ ...base, retest_used: false }).select().single()
    must(!good.error, `retest_used=false INSERT 실패 ${errText(good.error)}`)
    const before = (await dbs.f.from('personality_profiles').select('*').eq('user_id', ids.f).single()).data
    const msgs: string[] = []
    for (const [name, patch] of [
      ['retest_used', { retest_used: true }],
      ['active_assessment_id', { active_assessment_id: fa.id }],
      ['enneagram_inferred', { enneagram_inferred: 2 }],
      ['attachment', { attachment: 'anxious' }],
    ] as [string, Record<string, unknown>][]) {
      const r = await dbs.f.from('personality_profiles').update(patch).eq('user_id', ids.f).select()
      must(denied(r.error), `${name}: 거부 안 됨 ${errText(r.error)} data=${JSON.stringify(r.data)}`)
      msgs.push(`${name} ${r.error.code}`)
    }
    const after = (await dbs.f.from('personality_profiles').select('*').eq('user_id', ids.f).single()).data
    must(JSON.stringify(before) === JSON.stringify(after), '행이 바뀌었다')
    const ov = await dbs.f.from('personality_profiles').update({
      enneagram_override: 9, override_count: 1, override_updated_at: new Date().toISOString(), love_type_code: 'LLF',
    }).eq('user_id', ids.f).select().single()
    must(!ov.error && ov.data.enneagram_override === 9 && ov.data.love_type_code === 'LLF', `오버라이드 UPDATE 실패 ${errText(ov.error)}`)
    const ef = await dbs.f.from('personality_profiles').update({ enneagram_effective: 1 }).eq('user_id', ids.f).select()
    must(!!ef.error, '생성 칸 enneagram_effective UPDATE 가 통과했다')
    return `INSERT true ${bad.error.code} / false 통과 / ${msgs.join(' / ')} - 행 그대로 / 오버라이드 네 칸 허용 / 생성 칸 거부`
  })
  let mbtiBefore = ''
  await step('⑯', '재검사 함수 정상(E): out_recovered false · seq 2 · profiles.mbti 갱신 · 오버라이드 null · retest_used true', ['⑩', '준비'], async () => {
    // e 의 성격 행: 가입 경로와 같은 INSERT (사용자 세션)
    const a = await dbs.e.from('personality_assessments').insert(assessmentRow('e', 1, 1, 'secure', 'INFJ')).select().single()
    must(!a.error, `E assessment 실패 ${errText(a.error)}`)
    const p = await dbs.e.from('personality_profiles').insert({
      user_id: ids.e, active_assessment_id: a.data.id, enneagram_inferred: 1, attachment: 'secure', love_type_code: 'KLE',
    })
    must(!p.error, `E personality_profiles 실패 ${errText(p.error)}`)
    const ov = await dbs.e.from('personality_profiles').update({ enneagram_override: 9, override_count: 1, override_updated_at: new Date().toISOString(), love_type_code: 'LLF' }).eq('user_id', ids.e)
    must(!ov.error, `E 오버라이드 실패 ${errText(ov.error)}`)
    mbtiBefore = (await profileOf('e')).mbti
    const r = await dbs.e.rpc('fn_complete_retest', retestArgs(3, 'anxious', 'ENTP', 'AXF'))
    must(!r.error, `함수 실패 ${errText(r.error)}`)
    const row = Array.isArray(r.data) ? r.data[0] : r.data
    must(row.out_recovered === false, `out_recovered ${row.out_recovered}`)
    const pp = (await dbs.e.from('personality_profiles').select('*').eq('user_id', ids.e).single()).data
    const asr = (await dbs.e.from('personality_assessments').select('id, seq, mbti').eq('user_id', ids.e).order('seq')).data
    const prof = await profileOf('e')
    must(asr.length === 2 && asr[1].seq === 2 && asr[1].id === row.out_assessment_id, `assessments ${JSON.stringify(asr)}`)
    must(pp.retest_used === true && pp.enneagram_override === null && pp.active_assessment_id === row.out_assessment_id, `pp 이상 ${JSON.stringify(pp)}`)
    must(pp.enneagram_inferred === 3 && pp.attachment === 'anxious' && pp.love_type_code === 'AXF' && pp.enneagram_effective === 3, `pp 값 이상 ${JSON.stringify(pp)}`)
    must(prof.mbti === 'ENTP' && mbtiBefore === 'INFJ', `profiles.mbti ${mbtiBefore} -> ${prof.mbti}`)
    return `out_recovered false · seq 2 행 · pp(inferred 3 · anxious · AXF · override null · retest_used true) · profiles.mbti ${mbtiBefore} -> ${prof.mbti}`
  })
  await step('⑰', '재검사 두 번째 호출 23505 (행 수 그대로)', ['⑯'], async () => {
    const r = await dbs.e.rpc('fn_complete_retest', retestArgs(5, 'secure', 'ISTP', 'KLE'))
    must(code(r.error) === '23505', `기대 23505, 실제 ${errText(r.error)}`)
    const n = await dbs.e.from('personality_assessments').select('id', { count: 'exact', head: true }).eq('user_id', ids.e)
    must(n.count === 2, `assessment 행 ${n.count}`)
    must((await profileOf('e')).mbti === 'ENTP', 'mbti 가 바뀌었다')
    return `${errText(r.error)} - assessment 2행 · mbti ENTP 그대로`
  })
  await step('⑱', '끊긴 상태 복구(F): seq 2 를 직접 넣어 둔 뒤 호출 -> out_recovered true · 기존 seq 2 행의 값으로 끝남', ['⑮'], async () => {
    // love_type_labels 가 비어 있으면(2026-10-26 원격 개발은 0행이었다) 복구 경로가 P0002 로 끝난다 - 그 사실을 실패 메시지에 적는다.
    const labels = await dbs.f.from('love_type_labels').select('code', { count: 'exact', head: true })
    // f 의 retest_used 는 false 이고 seq 1 만 있다. 옛 방식(INSERT 한 번 후 끊김)과 같은 상태를 만든다: seq 2 직접 INSERT.
    const broken = await dbs.f.from('personality_assessments').insert(assessmentRow('f', 2, 7, 'avoidant', 'ESFP')).select().single()
    must(!broken.error, `seq 2 직접 INSERT 실패 ${errText(broken.error)}`)
    // 인자는 일부러 다른 값(core 2 · secure · ISTP · KLE) - 복구 경로가 인자를 쓰면 아래 확인이 걸린다.
    const r = await dbs.f.rpc('fn_complete_retest', retestArgs(2, 'secure', 'ISTP', 'KLE'))
    must(!r.error, `복구 호출 실패 ${errText(r.error)}${labels.count === 0 ? ' [love_type_labels 가 0행이다 - 라벨 시드가 원격에 없다]' : ''}`)
    const row = Array.isArray(r.data) ? r.data[0] : r.data
    must(row.out_recovered === true && row.out_assessment_id === broken.data.id, `반환 이상 ${JSON.stringify(row)}`)
    const pp = (await dbs.f.from('personality_profiles').select('*').eq('user_id', ids.f).single()).data
    const prof = await profileOf('f')
    must(pp.retest_used === true && pp.active_assessment_id === broken.data.id, `pp 이상 ${JSON.stringify(pp)}`)
    must(pp.enneagram_inferred === 7 && pp.attachment === 'avoidant' && pp.enneagram_override === null, `기존 행의 값이 아님 ${JSON.stringify(pp)}`)
    must(prof.mbti === 'ESFP', `profiles.mbti = ${prof.mbti} (기존 행의 ESFP 여야 함, 인자는 ISTP)`)
    const n = await dbs.f.from('personality_assessments').select('id', { count: 'exact', head: true }).eq('user_id', ids.f)
    must(n.count === 2, `assessment 행 ${n.count}`)
    const again = await dbs.f.rpc('fn_complete_retest', retestArgs(2, 'secure', 'ISTP', 'KLE'))
    must(code(again.error) === '23505', `복구 뒤 재호출: 기대 23505, 실제 ${errText(again.error)}`)
    return `out_recovered true · 기존 seq 2 행 값(7 · avoidant · ESFP) 으로 끝남(인자 2 · secure · ISTP 는 쓰지 않음) · love_type_code ${pp.love_type_code} (love_type_labels 에서) · 재호출 23505`
  })

  // ⑲ ⑳
  await step('⑲', '권한: anon · service_role 은 다섯 함수 모두 거부', ['준비'], async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['fn_request_dissolution', {}],
      ['fn_cancel_dissolution', { p_dissolution_id: dissA || '00000000-0000-0000-0000-000000000000' }],
      ['fn_request_withdrawal', {}],
      ['fn_cancel_withdrawal', {}],
      ['fn_complete_retest', retestArgs(1, 'secure', 'INFJ', 'KLE')],
    ]
    const msgs: string[] = []
    for (const [name, args] of calls) {
      const ra = await dbAnon.rpc(name, args)
      must(denied(ra.error), `anon ${name}: 거부 안 됨 ${errText(ra.error)}`)
      const rs = await admin.rpc(name, args)
      must(denied(rs.error), `service_role ${name}: 거부 안 됨 ${errText(rs.error)} data=${JSON.stringify(rs.data)}`)
      msgs.push(`${name} anon ${ra.error.code}/service ${rs.error.code}`)
    }
    return msgs.join(' | ') + ' (has_function_privilege · prosecdef · proconfig 는 verify_027_privileges.sql)'
  })
  await step('⑳', 'RLS 회귀: A 가 자기 · 상대 프로필 읽기 · 구성원 아닌 계정이 해제 행 읽기 0', ['①', '⑦'], async () => {
    const own = await dbs.a.from('profiles').select('id, display_name').in('id', [ids.a, ids.b])
    must(!own.error && own.data.length === 2, `A 의 프로필 읽기 ${errText(own.error)} ${own.data?.length}`)
    const other = await dbs.g.from('couple_dissolutions').select('id').in('couple_id', [couple1.id, couple2.id])
    must(!other.error && other.data.length === 0, `구성원 아닌 계정이 해제 행을 읽었다 ${errText(other.error)} ${other.data?.length}`)
    const pp = await dbs.a.from('personality_profiles').select('user_id').in('user_id', [ids.a, ids.b])
    must(!pp.error, `personality_profiles 읽기 오류 ${errText(pp.error)}`)
    return `A 프로필 2행 · 구성원 아닌 계정 해제 행 0 · personality_profiles 읽기 오류 없음`
  })

  // ㉑ test-68-purge
  let purgeDiss = ''
  let purgeAt = ''
  await step('㉑', 'test-68-purge 커플: 메시지 · 대표사진 경로 준비 후 p 의 해제 요청을 남겨 둔다', ['준비'], async () => {
    for (const l of ['p', 'q']) {
      const m = await dbs[l].from('messages').insert({ couple_id: couplePurge.id, sender_id: ids[l], body: `test-68-purge ${l}` }).select('id').single()
      must(!m.error, `${l} 메시지 실패 ${errText(m.error)}`)
    }
    const ref = await dbs.p.from('profiles').update({ reference_photo_path: `${ids.p}/test-68-purge.jpg` }).eq('id', ids.p)
    must(!ref.error, `p 대표사진 경로 실패 ${errText(ref.error)}`)
    const r = await dbs.p.rpc('fn_request_dissolution')
    must(!r.error, `purge 커플 해제 요청 실패 ${errText(r.error)}`)
    purgeDiss = r.data
    const d = (await dbs.p.from('couple_dissolutions').select('*').eq('id', purgeDiss).single()).data
    purgeAt = d.purge_scheduled_at
    const next = nextCronRun(new Date(purgeAt), cronExpr)
    const target = {
      note: 'test-68-purge 확인 스크립트 입력. 키 · 토큰 · URL 없음.',
      coupleId: couplePurge.id, dissolutionId: purgeDiss, initiatedBy: ids.p, partner: ids.q,
      purgeScheduledAt: purgeAt, cron: cronExpr, nextRunUtc: next.toISOString(), nextRunKst: kst(next),
    }
    await Deno.mkdir('scripts/ops/out', { recursive: true })
    await Deno.writeTextFile('scripts/ops/out/68-purge-target.json', JSON.stringify(target, null, 2) + '\n')
    line(`     purge_scheduled_at(서버 값) = ${purgeAt}`)
    line(`     확인 스크립트를 돌릴 날짜 = ${next.toISOString()} 이후 (${kst(next)}) — execute-dissolutions '${cronExpr}' (UTC)`)
    return `해제 ${purgeDiss.slice(0, 8)} 남김 · 커플 ${couplePurge.id.slice(0, 8)} dissolving · 메시지 p 1 · q 1 · p 대표사진 경로 설정`
  })

  // ㉒ 마무리: purge 커플 하나만 남기고 전부 취소
  await step('㉒', '마무리: 모든 해제 · 탈퇴 취소 (test-68-purge 커플 하나만 남김)', ['준비'], async () => {
    const cancelled: string[] = []
    for (const l of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      if (!dbs[l]) continue
      const w = await dbs[l].rpc('fn_cancel_withdrawal')
      if (w.error) throw new Error(`${l} 탈퇴 취소 실패 ${errText(w.error)}`)
      const open = (await dbs[l].from('couple_dissolutions').select('id, initiated_by').is('cancelled_at', null).is('executed_at', null)).data ?? []
      for (const o of open) {
        if (o.initiated_by !== ids[l]) continue
        const c = await dbs[l].rpc('fn_cancel_dissolution', { p_dissolution_id: o.id })
        if (c.error) throw new Error(`${l} 해제 취소 실패 ${errText(c.error)}`)
        cancelled.push(o.id.slice(0, 8))
      }
    }
    // 남은 진행 중 해제가 purge 커플 하나인지 본다 (p 의 사용자 세션에서 보이는 것 = purge 커플, 다른 커플은 각자 세션으로)
    let remaining = 0
    for (const [l, cid] of [['a', couple1.id], ['c', couple2.id], ['p', couplePurge.id]] as [string, string][]) remaining += (await openDiss(l, cid)).length
    must(remaining === 1, `남은 진행 중 해제 ${remaining}건 (1건이어야 함)`)
    must((await coupleStatus('a', couple1.id)) === 'active' && (await coupleStatus('c', couple2.id)) === 'active' && (await coupleStatus('p', couplePurge.id)) === 'dissolving', '커플 상태 이상')
    for (const l of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'p', 'q']) {
      const p = await profileOf(l)
      must(p.deleted_at === null && p.purge_scheduled_at === null, `${l} 프로필에 탈퇴 칸이 남았다`)
    }
    return `취소한 해제 ${cancelled.length}건 · 남은 진행 중 해제 1건(purge 커플 ${purgeDiss.slice(0, 8)}) · 모든 프로필 탈퇴 칸 비어 있음`
  })

  async function finish(): Promise<void> {
    line(`\n실패 ${failures}건 · 통과하지 못한 단계 [${[...failed].join(',')}]`)
    line('시험 데이터는 이름에 test 가 들어간 계정 · 커플 행으로 남긴다(개발 프로젝트). 삭제하지 않는다. test-68-purge 커플 하나는 해제 요청을 남겼다.')
    line('보안 점검: 027 적용 뒤 get_advisors(security) 원문 JSON 을 scripts/ops/out/68-security-after.json 에 저장하고 `compare` 모드로 기준선(68-security-baseline.json)과 비교한다.')
    await Deno.mkdir('scripts/ops/out', { recursive: true })
    let text = out.join('\n') + '\n'
    for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
    await Deno.writeTextFile('scripts/ops/out/68-dissolution.txt', text)
    if (failures > 0) Deno.exit(1)
  }
  await finish()
}

if (import.meta.main) {
  if (Deno.args[0] === 'run') await main()
  else if (Deno.args[0] === 'compare') await compareMode()
  else console.log('사용: verifyDissolution68.ts run | compare')
}
