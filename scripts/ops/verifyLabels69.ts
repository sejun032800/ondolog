/**
 * 028 라벨 36행 + 재검사 행 구멍 실증 (`69-` 산출) - 원격 **개발** DB (Deno 전용).
 * **작성만 했고 실행하지 않았다.** 028을 원격에 적용하고 `scripts/db/verify_028_privileges.sql`이 전부 ok 인 것을 본 뒤 사람이 실행한다.
 * 적용 전에 돌리면 ONDOLOG_028_APPLIED=1 이 없어 멈춘다.
 *
 * 세션 규칙 (R40-5 · R44-3): service_role 은 시험 계정을 **만들기**(계정 생성 · 로그인 링크 발급)와 ② 의 **끊긴 상태 준비**(seq 2 행 한 줄 INSERT)에만 쓴다.
 * 그 밖의 가입 · 조회 · 재검사 복구 호출 · 직접 INSERT 시도는 전부 그 계정의 **사용자 세션**이다.
 * 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 실행하지 않고 SKIP 으로 적는다(null 을 다루지 않고 멈춘다).
 * 파괴적 배치 함수(execute_dissolution · apply_retention_policy)는 어떤 경로로도 부르지 않는다(R34-3).
 *
 * 경우:
 *   ① 라벨 36행 - 사용자 세션으로 love_type_labels 를 읽어 저장소의 MASTER 10-5-2(10-5-1 의 코어 · 접미사 포함)와 8칸 글자 단위 대조, 불일치 0
 *      (엘리전: MSE = MUSEMBER · LRE = LOREMBER 도 따로 본다)
 *   ② ⑱ 재검사 복구 재실증 - 끊긴 상태(seq 2 있음 + retest_used false)를 service_role 로 준비, 복구 호출은 사용자 세션
 *      -> out_recovered true · 기존 seq 2 행의 값(인자의 값이 아님)으로 끝남 · love_type_code(라벨 표에서, MASTER 대조값과 같음) · profiles.mbti · 재호출 23505
 *   ③ 사용자 세션으로 seq = 2 직접 INSERT -> 거부(42501, 행 안 생김) · seq = 1 가입 경로 INSERT 는 통과
 *   ④ 새 시험 계정 test-69-*
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY · ONDOLOG_028_APPLIED=1
 *
 * 사용 (저장소 루트에서, PowerShell 한 줄 - ref 는 supabase/.temp/project-ref 에서 읽는다):
 *   $ref = (Get-Content supabase/.temp/project-ref).Trim(); $env:ONDOLOG_028_APPLIED='1'; deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY,ONDOLOG_028_APPLIED --allow-net="$ref.supabase.co" --allow-read=supabase/.temp/linked-project.json,src,docs/ONDOLOG_MASTER.md,scripts/ops/out --allow-write=scripts/ops/out scripts/ops/verifyLabels69.ts
 *
 * 출력 원문: scripts/ops/out/69-labels.txt (키 · 토큰 · URL · 프로젝트 ref 없음, 추적 안 함)
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'
import { parseMasterLabels, type LabelRow } from './labelsMaster.ts'

// deno-lint-ignore no-explicit-any
type Db = any
// deno-lint-ignore no-explicit-any
type Err = { code?: string; message?: string } | null

async function main(): Promise<void> {
  if (Deno.env.get('ONDOLOG_028_APPLIED') !== '1') {
    throw new Error('028 적용 전에는 실행하지 않는다. 적용 · verify_028_privileges.sql 확인 뒤 ONDOLOG_028_APPLIED=1 로 실행')
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
  const done = new Set<string>()
  const failed = new Set<string>()
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

  // 대조 원본은 저장소의 MASTER (읽기 실패하면 아래 단계가 전부 SKIP)
  let master: LabelRow[] = []
  await step('①0', 'MASTER 10-5-2 에서 36행 읽기', [], async () => {
    master = parseMasterLabels(await Deno.readTextFile('docs/ONDOLOG_MASTER.md'))
    must(master.length === 36 && new Set(master.map((r) => r[0])).size === 36, `MASTER 에서 ${master.length}행을 읽음`)
    return `${master.length}행 (코드 고유 36)`
  })

  // ④ 새 시험 계정 test-69-*
  const run = Date.now().toString(36)
  const ids: Record<string, string> = {}
  const dbs: Record<string, Db> = {}
  async function makeUser(label: string): Promise<void> {
    const email = `test-69-${run}-${label}@example.com`
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
  // 앱 가입 INSERT(personalityCore)와 같은 칸. 사용자 세션.
  const signupProfile = (label: string) => {
    const now = new Date().toISOString()
    return dbs[label].from('profiles').insert({
      id: ids[label], display_name: `test-69-${label}`, gender: 'other', birth_date: '1995-01-01', mbti: 'INFJ',
      onboarding_step: 3, terms_agreed_at: now, privacy_agreed_at: now, ai_usage_agreed_at: now,
    })
  }
  const assessmentRow = (label: string, seq: number, core: number, attachment: string, mbti: string) => ({
    user_id: ids[label], seq, mbti, mbti_self_reported: true, q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A',
    enneagram_core: core, big_o: 50, big_c: 50, big_e: 50, big_a: 50, big_n: 50,
    stern_intimacy: 50, stern_passion: 50, stern_commitment: 50, attach_anxiety: 50, attach_avoidance: 50,
    attachment, engine_version: 'test-69',
  })
  const retestArgs = (core: number, attachment: string, mbti: string, loveType: string) => ({
    p_mbti: mbti, p_mbti_self_reported: true, p_q1: 'B', p_q2: 'B', p_q3: 'B', p_q4: 'B', p_q5: 'B',
    p_enneagram_core: core, p_big_o: 60, p_big_c: 60, p_big_e: 60, p_big_a: 60, p_big_n: 60,
    p_stern_intimacy: 60, p_stern_passion: 60, p_stern_commitment: 60, p_attach_anxiety: 60, p_attach_avoidance: 60,
    p_attachment: attachment, p_engine_version: 'test-69-retest', p_love_type_code: loveType,
  })
  const profileOf = async (l: string) => (await dbs[l].from('profiles').select('*').eq('id', ids[l]).single()).data

  await step('준비', '시험 계정 둘(f, g) 생성 · 로그인 · 프로필 · f 의 seq 1 · personality_profiles (가입 경로, 사용자 세션)', ['①0'], async () => {
    for (const l of ['f', 'g']) await makeUser(l)
    for (const l of ['f', 'g']) {
      const r = await signupProfile(l)
      if (r.error) throw new Error(`프로필 생성 실패(${l}): ${errText(r.error)}`)
    }
    const a = await dbs.f.from('personality_assessments').insert(assessmentRow('f', 1, 1, 'secure', 'INFJ')).select().single()
    if (a.error) throw new Error(`f seq 1 실패: ${errText(a.error)}`)
    const p = await dbs.f.from('personality_profiles').insert({
      user_id: ids.f, active_assessment_id: a.data.id, enneagram_inferred: 1, attachment: 'secure', love_type_code: 'KLE',
    })
    if (p.error) throw new Error(`f personality_profiles 실패: ${errText(p.error)}`)
    return `이메일 접두 test-69-${run}- (f: 가입 경로 seq 1 통과)`
  })

  // ① 라벨 36행
  await step('①', '라벨 36행 - 사용자 세션으로 읽어 MASTER 10-5-2 와 8칸 글자 단위 대조, 불일치 0', ['①0', '준비'], async () => {
    const r = await dbs.f.from('love_type_labels')
      .select('code, enneagram_core, attachment, core_en, suffix_en, label_en, label_ko, copy_ko').order('code')
    must(!r.error, `읽기 실패 ${errText(r.error)}`)
    const rows: LabelRow[] = r.data.map((x: Record<string, unknown>) => [
      x.code, x.enneagram_core, x.attachment, x.core_en, x.suffix_en, x.label_en, x.label_ko, x.copy_ko,
    ] as LabelRow)
    must(rows.length === 36, `원격 ${rows.length}행 (36이어야 함)`)
    const byCode = new Map(rows.map((x) => [x[0], x]))
    const diffs: string[] = []
    for (const m of master) {
      const x = byCode.get(m[0])
      if (!x) {
        diffs.push(`${m[0]}: 원격에 없음`)
        continue
      }
      if (JSON.stringify(x) !== JSON.stringify(m)) diffs.push(`${m[0]}: 원격 ${JSON.stringify(x)} / MASTER ${JSON.stringify(m)}`)
    }
    must(diffs.length === 0, `불일치 ${diffs.length}건: ${diffs.slice(0, 3).join(' ; ')}`)
    const en = new Map(rows.map((x) => [x[0], x[5]]))
    must(en.get('MSE') === 'MUSEMBER' && en.get('LRE') === 'LOREMBER', `엘리전 ${en.get('MSE')} / ${en.get('LRE')}`)
    must(![...en.values()].some((v) => v === 'MUSEEMBER' || v === 'LOREEMBER'), '엘리전 잘못된 철자가 있다')
    return '36행 · 불일치 0 · MSE = MUSEMBER · LRE = LOREMBER'
  })

  // ② ⑱ 재검사 복구
  await step('②', '⑱ 끊긴 상태 복구 - seq 2 준비(service_role) -> 복구 호출(사용자 세션) -> out_recovered true · 기존 seq 2 행 값', ['①', '준비'], async () => {
    const want = master.find((m) => m[1] === 7 && m[2] === 'avoidant')
    if (!want) throw new Error('MASTER 에서 (7, avoidant) 행을 못 찾음')
    // 준비(시험 준비 한정): 끊긴 상태 = seq 2 행만 있고 retest_used false. 사용자 세션은 028 뒤 seq 2 를 못 넣는다.
    const broken = await admin.from('personality_assessments').insert(assessmentRow('f', 2, 7, 'avoidant', 'ESFP')).select().single()
    must(!broken.error, `service_role 로 seq 2 준비 실패 ${errText(broken.error)}`)
    const before = (await dbs.f.from('personality_profiles').select('retest_used').eq('user_id', ids.f).single()).data
    must(before.retest_used === false, `준비 뒤 retest_used = ${before.retest_used}`)
    // 복구 호출: 사용자 세션. 인자는 일부러 다른 값(core 2 · secure · ISTP · KLE) - 복구 경로가 인자를 쓰면 아래 확인이 걸린다.
    const r = await dbs.f.rpc('fn_complete_retest', retestArgs(2, 'secure', 'ISTP', 'KLE'))
    must(!r.error, `복구 호출 실패 ${errText(r.error)}`)
    const row = Array.isArray(r.data) ? r.data[0] : r.data
    must(row.out_recovered === true && row.out_assessment_id === broken.data.id, `반환 이상 ${JSON.stringify(row)}`)
    const pp = (await dbs.f.from('personality_profiles').select('*').eq('user_id', ids.f).single()).data
    const prof = await profileOf('f')
    must(pp.retest_used === true && pp.active_assessment_id === broken.data.id, `pp 이상 ${JSON.stringify(pp)}`)
    must(pp.enneagram_inferred === 7 && pp.attachment === 'avoidant' && pp.enneagram_override === null, `기존 행의 값이 아님 ${JSON.stringify(pp)}`)
    must(pp.love_type_code === want[0], `love_type_code = ${pp.love_type_code} (MASTER 의 (7, avoidant) = ${want[0]} 여야 함)`)
    must(prof.mbti === 'ESFP', `profiles.mbti = ${prof.mbti} (기존 행의 ESFP 여야 함, 인자는 ISTP)`)
    const n = await dbs.f.from('personality_assessments').select('id', { count: 'exact', head: true }).eq('user_id', ids.f)
    must(n.count === 2, `assessment 행 ${n.count}`)
    const again = await dbs.f.rpc('fn_complete_retest', retestArgs(2, 'secure', 'ISTP', 'KLE'))
    must(code(again.error) === '23505', `복구 뒤 재호출: 기대 23505, 실제 ${errText(again.error)}`)
    return `out_recovered true · 기존 seq 2 행 값(7 · avoidant · ESFP)으로 끝남(인자 2 · secure · ISTP 는 쓰지 않음) · love_type_code ${pp.love_type_code} (MASTER 대조 일치) · mbti ESFP · 재호출 23505`
  })

  // ③ seq 2 직접 INSERT 거부 · seq 1 통과
  await step('③', '사용자 세션 seq = 2 직접 INSERT 거부(행 안 생김) · seq = 1 가입 경로는 통과', ['준비'], async () => {
    const bad = await dbs.g.from('personality_assessments').insert(assessmentRow('g', 2, 7, 'avoidant', 'ESFP')).select()
    must(denied(bad.error), `seq 2 INSERT 거부 안 됨 ${errText(bad.error)} data=${JSON.stringify(bad.data)}`)
    const none = await dbs.g.from('personality_assessments').select('id', { count: 'exact', head: true }).eq('user_id', ids.g)
    must(none.count === 0, `거부된 INSERT 가 행을 남김 ${none.count}`)
    const ok = await dbs.g.from('personality_assessments').insert(assessmentRow('g', 1, 1, 'secure', 'INFJ')).select().single()
    must(!ok.error, `seq 1 가입 INSERT 실패 ${errText(ok.error)}`)
    const other = await dbs.g.from('personality_assessments').insert({ ...assessmentRow('g', 1, 1, 'secure', 'INFJ'), user_id: ids.f }).select()
    must(denied(other.error), `남의 user_id 로 seq 1 INSERT 거부 안 됨 ${errText(other.error)}`)
    return `seq 2 ${bad.error?.code} (행 0) / seq 1 통과 / 남의 user_id ${other.error?.code}`
  })

  await Deno.mkdir('scripts/ops/out', { recursive: true })
  line(`\n실패 ${failures}건 · 통과하지 못한 단계 [${[...failed].join(',')}]`)
  line('시험 데이터는 이름에 test 가 들어간 계정(test-69-*)으로 남긴다(개발 프로젝트). 삭제하지 않는다.')
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/69-labels.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (import.meta.main) await main()
