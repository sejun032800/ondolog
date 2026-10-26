/**
 * 026 커플 연결 함수 · couples 직접 쓰기 회수 실증 (`66-` 1부 산출) - 원격 **개발** DB, 사용자 세션 중심 (Deno 전용).
 * **작성만 했고 실행하지 않았다.** 026을 원격에 적용한 뒤 메인 세션이 실행한다. 적용 전에 돌리면 ONDOLOG_026_APPLIED=1 이 없어 멈춘다.
 *
 * 먼저 `scripts/db/verify_026_privileges.sql` 이 전부 ok 인지 본다(권한 · 정책 · 칸 단위 권한 카탈로그 확인).
 *
 * 세션 규칙 (R40-5): 시험 계정은 service_role 로 **만들기만** 하고(계정 생성은 사용자 세션으로 할 수 없다), 로그인 · 프로필 · 초대 발급 · 연결 호출 ·
 * 직접 UPDATE/INSERT 시도 · 조회는 전부 그 계정의 **사용자 세션**이다. service_role 을 쓰는 곳은 둘뿐이다:
 *   (a) 시험 계정 생성 / 로그인 링크 발급, (b) ⑤의 만료 시험 행의 invite_expires_at 을 과거로 바꾸기.
 * 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 실행하지 않고 SKIP 으로 적는다(null 을 다루지 않고 멈춘다).
 *
 * 경우 (66- 2부 표):
 *   ① A 초대 발급(앱과 같은 INSERT) -> B 가 함수 호출: active · connected_at · 반환 = 커플 id
 *   ② B 가 미리 발급해 둔 대기 행이 연결 뒤 삭제된다
 *   ③ 같은 B 가 같은 코드로 다시 호출: 같은 id, 오류 없음
 *   ④ C 가 자기 코드로 호출: 22023
 *   ⑤ 없는 코드 · 만료 코드 · 이미 쓴 코드: 셋 다 P0002, 메시지도 같다
 *   ⑥ 이미 active 인 A 가 남의 코드 호출 / 이미 커플인 B 가 발급한 코드를 F 가 호출: 23505
 *   ⑦ A 가 자기 행의 user_b_id · status · subscription_tier 를 직접 UPDATE: 거부 (행 변화 없음)
 *   ⑧ user_b_id 를 채운 · status='active' · subscription_tier='paid' INSERT: 각각 거부
 *   ⑨ 앱이 쓰는 칸 UPDATE(사귄 날짜 · 닉네임 · 대표사진 경로 · 확인자): 동작
 *   ⑩ 권한: /rpc 로 anon 거부 · service_role 거부 · authenticated 동작. has_function_privilege · prosecdef · proconfig 는 SQL 파일이 본다
 *   ⑪ RLS 회귀: A 가 messages · data_entries 읽기 오류 없음, 구성원 아닌 E 가 A 의 커플 행 읽기 0
 *   ⑫ 보안 점검(get_advisors) 비교는 도구로 한다(메인 세션) - 이 스크립트는 하지 않는다
 *
 * - destructive 배치 함수는 부르지 않는다. 시험 데이터 이름에 test. 비밀값은 어디에도 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY · ONDOLOG_026_APPLIED=1
 *
 * 사용 (저장소 루트에서, PowerShell 한 줄):
 *   $env:ONDOLOG_026_APPLIED='1'; deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY,ONDOLOG_026_APPLIED --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src --allow-write=scripts/ops/out scripts/ops/verifyCoupleConnect.ts run
 *
 * 출력 원문: scripts/ops/out/66-couple-connect.txt (추적 안 함)
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any
// deno-lint-ignore no-explicit-any
type Err = { code?: string; message?: string } | null

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

async function main(): Promise<void> {
  if (Deno.env.get('ONDOLOG_026_APPLIED') !== '1') {
    throw new Error('026 적용 전에는 실행하지 않는다. 적용 · verify_026_privileges.sql 확인 뒤 ONDOLOG_026_APPLIED=1 로 실행')
  }
  const ops = await connectOps()
  const admin: Db = ops.client
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
  const anonKey = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
  if (!anonKey) throw new Error('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
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
  /** 한 단계. needs 중 하나라도 실패했거나 실행되지 않았으면 SKIP. 던지면 실패로 센다. */
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

  // ── 준비: 시험 계정 6개(이름에 test) + 각자 사용자 세션 로그인 + 각자 프로필 ──────────────────────────
  const run = Date.now().toString(36)
  const labels = ['a', 'b', 'c', 'd', 'e', 'f']
  const ids: Record<string, string> = {}
  const dbs: Record<string, Db> = {}
  async function makeUser(label: string): Promise<void> {
    const email = `test-66-${run}-${label}@example.com`
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
    if (created.error) throw new Error(`계정 생성 실패(${label}): ${created.error.message}`)
    ids[label] = created.data.user.id
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패(${label}): ${link.error.message}`)
    const c: Db = createClient(url, anonKey as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const v = await c.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (v.error) throw new Error(`로그인 실패(${label}): ${v.error.message}`)
    secrets.push(v.data.session?.access_token ?? '', v.data.session?.refresh_token ?? '')
    // 앱 가입 경로(personalityCore.createProfileAndAssessment)의 profiles insert와 같은 칸: 017 이후 terms · privacy 동의 시각은 NOT NULL에 default 없음.
    // (그 함수는 검사 답 5개까지 요구해서 부르지 않고, profiles 칸만 같게 넣는다. 이 시험은 profiles 행만 있으면 된다.)
    const now = new Date().toISOString()
    const p = await c.from('profiles').insert({
      id: ids[label],
      display_name: `test-66-${label}`,
      gender: 'other',
      birth_date: '1995-01-01',
      terms_agreed_at: now,
      privacy_agreed_at: now,
      ai_usage_agreed_at: now,
    })
    if (p.error) throw new Error(`프로필 생성 실패(${label}): ${errText(p.error)}`)
    dbs[label] = c
  }
  await step('준비', '시험 계정 6개 생성 · 사용자 세션 로그인 · 프로필(사용자 세션)', [], async () => {
    for (const l of labels) await makeUser(l)
    return `a~f 6개 (이메일 접두 test-66-${run}-)`
  })
  if (!done.has('준비')) {
    line('\n준비 실패 - 이하 전부 실행하지 않는다')
    return await finish()
  }
  const dbAnon: Db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const issue = (l: string, code: string) => dbs[l].from('couples').insert({ user_a_id: ids[l], invite_code: code }).select().single()
  const connect = (l: string, code: string) => dbs[l].rpc('fn_connect_couple', { p_invite_code: code })

  const codeA = randomCode()
  const codeB = randomCode()
  let coupleA = ''

  // ① + ②
  await step('①', 'A 초대 발급 -> B 가 미리 자기 대기 초대를 발급해 둔 뒤 A 의 코드로 함수 호출', ['준비'], async () => {
    const ia = await issue('a', codeA)
    must(!ia.error, `A 발급 실패 ${errText(ia.error)}`)
    must(ia.data.status === 'pending' && ia.data.user_b_id === null, 'A 발급 행이 pending 이 아니다')
    const ib = await issue('b', codeB)
    must(!ib.error, `B 대기 초대 발급 실패 ${errText(ib.error)}`)
    const r = await connect('b', codeA)
    must(!r.error, `연결 호출 실패 ${errText(r.error)}`)
    coupleA = r.data
    must(coupleA === ia.data.id, `반환 id(${coupleA}) != A 의 커플 id(${ia.data.id})`)
    const row = await dbs.a.from('couples').select('id, status, user_b_id, connected_at').eq('id', coupleA).single()
    must(!row.error, `A 의 조회 실패 ${errText(row.error)}`)
    must(row.data.status === 'active' && row.data.user_b_id === ids.b && row.data.connected_at !== null, `행 상태 이상 ${JSON.stringify(row.data)}`)
    return `반환=${coupleA} status=active connected_at=${row.data.connected_at}`
  })
  await step('②', 'B 가 미리 발급한 대기 행이 삭제됨', ['①'], async () => {
    // B 는 자기가 user_a 인 행을 볼 수 있으므로, 0행이면 지워진 것이다(B 의 사용자 세션 조회).
    const r = await dbs.b.from('couples').select('id').eq('invite_code', codeB)
    must(!r.error, `조회 실패 ${errText(r.error)}`)
    must(r.data.length === 0, `대기 행이 남아 있다(${r.data.length}행)`)
    return '0행'
  })
  await step('③', '같은 B 가 같은 코드로 다시 호출 -> 같은 id', ['①'], async () => {
    const r = await connect('b', codeA)
    must(!r.error, `재호출 오류 ${errText(r.error)}`)
    must(r.data === coupleA, `다른 id(${r.data})`)
    return `같은 id ${r.data}`
  })
  await step('④', 'C 가 자기 코드로 호출 -> 22023', ['준비'], async () => {
    const codeC = randomCode()
    const ic = await issue('c', codeC)
    must(!ic.error, `C 발급 실패 ${errText(ic.error)}`)
    const r = await connect('c', codeC)
    must(!!r.error && r.error.code === '22023', `기대 22023, 실제 ${errText(r.error)}`)
    return errText(r.error)
  })
  await step('⑤', '없는 코드 · 만료 코드 · 이미 쓴 코드 -> 같은 P0002, 같은 메시지', ['①'], async () => {
    const codeD = randomCode()
    const id = await issue('d', codeD)
    must(!id.error, `D 발급 실패 ${errText(id.error)}`)
    // service_role 로 시험 행의 만료를 과거로 (이 단계의 유일한 service_role 쓰기)
    const exp = await admin.from('couples').update({ invite_expires_at: new Date(Date.now() - 86400000).toISOString() }).eq('id', id.data.id)
    must(!exp.error, `만료 설정 실패 ${errText(exp.error)}`)
    const none = await connect('e', randomCode() + 'X')
    const expired = await connect('e', codeD)
    const used = await connect('e', codeA)
    const rs = [none, expired, used]
    must(rs.every((r) => !!r.error && r.error.code === 'P0002'), `기대 셋 다 P0002, 실제 ${rs.map((r) => errText(r.error)).join(' | ')}`)
    must(new Set(rs.map((r) => r.error.message)).size === 1, `메시지가 다르다: ${rs.map((r) => r.error.message).join(' | ')}`)
    return `셋 다 ${errText(none.error)}`
  })
  await step('⑥', '이미 active 인 A 가 남의 코드 호출 / 이미 커플인 B 가 발급한 코드를 F 가 호출 -> 23505', ['①'], async () => {
    const codeE = randomCode()
    const ie = await issue('e', codeE)
    must(!ie.error, `E 발급 실패 ${errText(ie.error)}`)
    const r1 = await connect('a', codeE)
    must(!!r1.error && r1.error.code === '23505', `A 호출: 기대 23505, 실제 ${errText(r1.error)}`)
    // B 는 (A,B) active 의 user_b. user_a 로는 행이 없으니 새 대기 초대를 직접 넣을 수 있다 -> 초대한 사람이 이미 커플인 경우.
    const codeB2 = randomCode()
    const ib2 = await issue('b', codeB2)
    must(!ib2.error, `B 두 번째 초대 발급 실패 ${errText(ib2.error)}`)
    const r2 = await connect('f', codeB2)
    must(!!r2.error && r2.error.code === '23505', `F 호출: 기대 23505, 실제 ${errText(r2.error)}`)
    return `A 호출 ${errText(r1.error)} / F 호출 ${errText(r2.error)}`
  })
  await step('⑦', 'A 가 자기 커플 행의 user_b_id · status · subscription_tier 직접 UPDATE -> 거부, 행 그대로', ['①'], async () => {
    const attempts: [string, Record<string, unknown>][] = [
      ['user_b_id', { user_b_id: ids.c }],
      ['status', { status: 'pending' }],
      ['subscription_tier', { subscription_tier: 'paid' }],
    ]
    const msgs: string[] = []
    for (const [name, patch] of attempts) {
      const r = await dbs.a.from('couples').update(patch).eq('id', coupleA).select()
      must(denied(r.error), `${name}: 거부되지 않음 ${errText(r.error)} data=${JSON.stringify(r.data)}`)
      msgs.push(`${name} ${r.error.code}`)
    }
    const row = await dbs.a.from('couples').select('user_b_id, status, subscription_tier').eq('id', coupleA).single()
    must(row.data.user_b_id === ids.b && row.data.status === 'active' && row.data.subscription_tier === 'free', `행이 바뀌었다 ${JSON.stringify(row.data)}`)
    return `${msgs.join(' / ')} - 행 그대로`
  })
  await step('⑧', 'user_b_id 를 채운 · status=active · subscription_tier=paid INSERT -> 각각 거부', ['준비'], async () => {
    const bad: [string, Record<string, unknown>][] = [
      ['user_b_id', { user_b_id: ids.e }],
      ['status=active', { status: 'active', user_b_id: ids.e }],
      ['subscription_tier=paid', { subscription_tier: 'paid' }],
      ['status=active(단독)', { status: 'active' }],
    ]
    const msgs: string[] = []
    for (const [name, extra] of bad) {
      const r = await dbs.f.from('couples').insert({ user_a_id: ids.f, invite_code: randomCode(), ...extra }).select()
      must(denied(r.error), `${name}: 거부되지 않음 ${errText(r.error)} data=${JSON.stringify(r.data)}`)
      msgs.push(`${name} ${r.error.code}`)
    }
    return msgs.join(' / ')
  })
  await step('⑨', 'A 가 앱이 쓰는 칸 UPDATE(사귄 날짜 · 닉네임 · 대표사진 경로) / B 가 확인자 칸 UPDATE -> 동작', ['①'], async () => {
    const r = await dbs.a
      .from('couples')
      .update({ relationship_start_date: '2025-01-01', start_date_set_by: ids.a, nickname: 'test-66-nick', reference_photo_path: `${coupleA}/test-66.jpg` })
      .eq('id', coupleA)
      .select()
      .single()
    must(!r.error, `A UPDATE 실패 ${errText(r.error)}`)
    must(r.data.nickname === 'test-66-nick' && r.data.relationship_start_date === '2025-01-01', `값이 안 바뀜 ${JSON.stringify(r.data)}`)
    const b = await dbs.b.from('couples').update({ start_date_confirmed_by: ids.b }).eq('id', coupleA).select().single()
    must(!b.error, `B 확인 UPDATE 실패 ${errText(b.error)}`)
    must(b.data.start_date_confirmed_by === ids.b, 'B 확인 칸이 안 바뀜')
    return '사귄 날짜 · set_by · 닉네임 · 대표사진 경로 · confirmed_by 모두 동작'
  })
  await step('⑩', '/rpc 권한: anon 거부 · service_role 거부 · authenticated 동작(③에서 확인)', ['①'], async () => {
    const ra = await dbAnon.rpc('fn_connect_couple', { p_invite_code: codeA })
    must(denied(ra.error), `anon: 거부되지 않음 ${errText(ra.error)}`)
    const rs = await admin.rpc('fn_connect_couple', { p_invite_code: codeA })
    must(denied(rs.error), `service_role: 거부되지 않음 ${errText(rs.error)} data=${JSON.stringify(rs.data)}`)
    return `anon ${ra.error.code} / service_role ${rs.error.code} (has_function_privilege · prosecdef · proconfig 는 verify_026_privileges.sql)`
  })
  await step('⑪', 'RLS 회귀: A 가 채팅 · 피드 읽기, 구성원 아닌 E 가 A 의 커플 행 읽기 0', ['①'], async () => {
    const m = await dbs.a.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', coupleA)
    must(!m.error, `messages 읽기 오류 ${errText(m.error)}`)
    const f = await dbs.a.from('data_entries').select('id', { count: 'exact', head: true }).eq('couple_id', coupleA)
    must(!f.error, `data_entries 읽기 오류 ${errText(f.error)}`)
    const o = await dbs.e.from('couples').select('id').eq('id', coupleA)
    must(!o.error && o.data.length === 0, `구성원 아닌 계정이 커플 행을 읽었다 ${errText(o.error)} ${o.data?.length}`)
    const o2 = await dbs.e.from('couples').select('id').eq('invite_code', codeA)
    must(!o2.error && o2.data.length === 0, '구성원 아닌 계정이 코드로 커플 행을 읽었다')
    return `messages ${m.count}행 · data_entries ${f.count}행 읽기 오류 없음 / 구성원 아닌 계정 0행`
  })

  async function finish(): Promise<void> {
    line(`\n실패 ${failures}건 · 통과하지 못한 단계 [${[...failed].join(',')}]`)
    line('시험 데이터는 이름에 test 가 들어간 계정 · 커플 행으로 남긴다(개발 프로젝트). 삭제하지 않는다.')
    await Deno.mkdir('scripts/ops/out', { recursive: true })
    let text = out.join('\n') + '\n'
    for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
    await Deno.writeTextFile('scripts/ops/out/66-couple-connect.txt', text)
    if (failures > 0) Deno.exit(1)
  }
  await finish()
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyCoupleConnect.ts run')
