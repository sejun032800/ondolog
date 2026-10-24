/**
 * 025 함수 실행 권한 실증 (`60-` 1부 산출) - 원격 **개발** DB, anon 키 + 시험 계정 로그인 + service_role (Deno 전용).
 * **작성만 했고 실행하지 않았다.** 025를 원격에 적용한 뒤 메인 세션이 실행한다.
 *
 * 먼저 `scripts/db/verify_025_privileges.sql`이 모두 ok 인지 본다. 이 스크립트는 **적용된 뒤에만** 돌린다:
 * 적용 전에 돌리면 batch 함수 호출이 실제로 실행될 수 있어서, 환경변수 ONDOLOG_025_APPLIED=1 이 없으면 멈춘다.
 *
 *   ① anon 키로 배치 함수 셋(expire_stories · apply_retention_policy · execute_dissolution)을 /rpc 로 호출 -> 거부(42501) · 데이터 변화 없음
 *   ② 로그인한 시험 계정으로 같은 호출 -> 거부 · 변화 없음
 *   ⑤ fn_issue_progress · fn_delete_own_entry: authenticated 는 함수에 닿는다(오류가 권한이 아니다) / anon 은 거부.
 *      RLS 헬퍼 is_couple_member: authenticated 동작 / anon 거부
 *   ⑥ service_role: fn_publish_issue 에 존재하지 않는 호 id 를 준다 -> 권한 오류가 아니라 함수 안의 오류(데이터 변화 없음).
 *      authenticated 의 fn_publish_issue -> 거부. service_role 의 배치 함수 -> 거부(025 가 service_role 도 회수)
 *   ⑦ issues_public: anon SELECT 거부 · authenticated INSERT 거부 · authenticated SELECT 동작
 *
 * ③(소유자 실행)·⑧(기본 권한)·⑨(보안 점검 비교)는 SQL/도구로 한다: scripts/db/verify_025_owner_run.sql · verify_025_privileges.sql · get_advisors.
 * ④ RLS 회귀는 기존 스크립트를 다시 돌린다: verifyIssuesGrant.ts(59- B) · verifyU2Delete.ts(57-) + 채팅·피드 읽기 각 1회 (사용법은 각 파일 머리).
 *
 * - **execute_dissolution 은 어떤 권한으로도 실제 실행하지 않는다.** 존재하지 않는 id(영 uuid)로 부르고, 거부 확인만 한다.
 *   (거부되지 않았다면 영 uuid 라 아무 것도 지우지 않지만 FAIL 로 기록한다.) expire_stories · apply_retention_policy 는 거부돼야 정상이다.
 * - 변화 없음 확인: 호출 전후 stories(미처리) · couples · couple_dissolutions(미실행) · data_entries 행 수를 service_role 로 센다.
 * - 비밀값은 어디에도 쓰지 않는다. 시험 계정은 59- 와 같다(test-55-2-*).
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY · ONDOLOG_025_APPLIED=1
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY,ONDOLOG_025_APPLIED \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyFunctionGrants.ts run
 *
 * 출력 원문: scripts/ops/out/60-function-grants.txt (추적 안 함)
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const RANDOM_UUID = '11111111-2222-4333-8444-555555555555'

async function main(): Promise<void> {
  if (Deno.env.get('ONDOLOG_025_APPLIED') !== '1') {
    throw new Error('025 적용 전에는 실행하지 않는다. 적용·verify_025_privileges.sql 확인 뒤 ONDOLOG_025_APPLIED=1 로 실행')
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
  const check = (label: string, ok: boolean, detail: string) => {
    if (!ok) failures += 1
    line(`${ok ? 'OK  ' : 'FAIL'} ${label} - ${detail}`)
  }

  const email = 'test-55-2-photo-a@example.com'
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (!listed.data?.users?.find((u: { email?: string }) => u.email === email)) throw new Error('시험 계정이 없다')
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
  const dbUser: Db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const verified = await dbUser.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
  if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
  secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
  const dbAnon: Db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  /** 호출 전후 비교용 행 수 (service_role 로만 센다). */
  async function snapshot(): Promise<string> {
    const nowIso = new Date().toISOString()
    const q = async (b: Promise<{ count: number | null; error: { message: string } | null }>) => {
      const r = await b
      if (r.error) throw new Error(`스냅숏 실패: ${r.error.message}`)
      return r.count
    }
    const stories = await q(admin.from('stories').select('id', { count: 'exact', head: true }).is('resolved_at', null).lte('expires_at', nowIso))
    const storiesAll = await q(admin.from('stories').select('id', { count: 'exact', head: true }))
    const couples = await q(admin.from('couples').select('id', { count: 'exact', head: true }))
    const diss = await q(admin.from('couple_dissolutions').select('id', { count: 'exact', head: true }).is('executed_at', null))
    const entries = await q(admin.from('data_entries').select('id', { count: 'exact', head: true }))
    return `stories(만료·미처리)=${stories} stories(전체)=${storiesAll} couples=${couples} dissolutions(미실행)=${diss} data_entries=${entries}`
  }

  const denied = (e: { code?: string; message?: string } | null): boolean =>
    !!e && (e.code === '42501' || /permission denied/i.test(e.message ?? ''))

  const before = await snapshot()
  line(`[기준 행 수] ${before}`)

  // ① anon -> 배치 함수 셋
  const batchCalls: Array<[string, (db: Db) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>]> = [
    ['expire_stories', (db) => db.rpc('expire_stories')],
    ['apply_retention_policy', (db) => db.rpc('apply_retention_policy')],
    ['execute_dissolution(영 uuid)', (db) => db.rpc('execute_dissolution', { p_dissolution_id: ZERO_UUID })],
  ]
  for (const [name, call] of batchCalls) {
    const r = await call(dbAnon)
    check(`① anon: ${name} -> 거부`, denied(r.error), r.error ? `${r.error.code} ${r.error.message}` : `실행됨(!) data=${JSON.stringify(r.data)}`)
  }
  // ② authenticated -> 같은 셋
  for (const [name, call] of batchCalls) {
    const r = await call(dbUser)
    check(`② 로그인 계정: ${name} -> 거부`, denied(r.error), r.error ? `${r.error.code} ${r.error.message}` : `실행됨(!) data=${JSON.stringify(r.data)}`)
  }
  const afterBatch = await snapshot()
  check('①② 데이터 변화 없음', afterBatch === before, afterBatch === before ? '행 수 같음' : `전 ${before} / 후 ${afterBatch}`)

  // ⑤ 클라이언트 RPC · RLS 헬퍼
  const progress = await dbUser.rpc('fn_issue_progress')
  check('⑤ authenticated: fn_issue_progress 동작', !progress.error, progress.error ? `${progress.error.code} ${progress.error.message}` : `${progress.data.length}행`)
  const progressAnon = await dbAnon.rpc('fn_issue_progress')
  check('⑤ anon: fn_issue_progress -> 거부', denied(progressAnon.error), progressAnon.error ? `${progressAnon.error.code}` : '실행됨(!)')
  const del = await dbUser.rpc('fn_delete_own_entry', { p_entry_id: RANDOM_UUID })
  check('⑤ authenticated: fn_delete_own_entry 에 닿는다(없는 id -> P0002, 권한 오류 아님)', !!del.error && del.error.code === 'P0002', del.error ? `${del.error.code} ${del.error.message}` : '성공(!)')
  const delAnon = await dbAnon.rpc('fn_delete_own_entry', { p_entry_id: RANDOM_UUID })
  check('⑤ anon: fn_delete_own_entry -> 거부', denied(delAnon.error), delAnon.error ? `${delAnon.error.code}` : '실행됨(!)')
  const helper = await dbUser.rpc('is_couple_member', { p_couple_id: RANDOM_UUID })
  check('⑤ authenticated: is_couple_member 동작(없는 커플 -> false)', !helper.error && helper.data === false, helper.error ? `${helper.error.code} ${helper.error.message}` : `data=${helper.data}`)
  const helperAnon = await dbAnon.rpc('is_couple_member', { p_couple_id: RANDOM_UUID })
  check('⑤ anon: is_couple_member -> 거부', denied(helperAnon.error), helperAnon.error ? `${helperAnon.error.code}` : '실행됨(!)')

  // ⑥ service_role
  const pub = await admin.rpc('fn_publish_issue', { p_issue_id: ZERO_UUID })
  check('⑥ service_role: fn_publish_issue 에 닿는다(없는 호 -> 함수 안의 오류, 권한 오류 아님)', !!pub.error && !denied(pub.error), pub.error ? `${pub.error.code} ${pub.error.message}` : '성공(!)')
  const pubUser = await dbUser.rpc('fn_publish_issue', { p_issue_id: ZERO_UUID })
  check('⑥ authenticated: fn_publish_issue -> 거부', denied(pubUser.error), pubUser.error ? `${pubUser.error.code}` : '실행됨(!)')
  const svcBatch = await admin.rpc('expire_stories')
  check('⑥ service_role: expire_stories -> 거부 (025 가 service_role 도 회수)', denied(svcBatch.error), svcBatch.error ? `${svcBatch.error.code}` : `실행됨(!) data=${JSON.stringify(svcBatch.data)}`)

  // ⑦ issues_public
  const viewAnon = await dbAnon.from('issues_public').select('id').limit(1)
  check('⑦ anon: issues_public SELECT -> 거부', denied(viewAnon.error), viewAnon.error ? `${viewAnon.error.code}` : `조회됨(!) ${viewAnon.data.length}행`)
  const viewIns = await dbUser.from('issues_public').insert({ title: 'test-60-should-be-denied' })
  check('⑦ authenticated: issues_public INSERT -> 거부', denied(viewIns.error), viewIns.error ? `${viewIns.error.code} ${viewIns.error.message}` : '삽입됨(!)')
  const viewSel = await dbUser.from('issues_public').select('id, title').limit(1)
  check('⑦ authenticated: issues_public SELECT 동작', !viewSel.error, viewSel.error ? `${viewSel.error.code} ${viewSel.error.message}` : `${viewSel.data.length}행`)

  const after = await snapshot()
  check('전체 데이터 변화 없음', after === before, after === before ? '행 수 같음' : `전 ${before} / 후 ${after}`)

  line(`\n실패 ${failures}건`)
  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/60-function-grants.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyFunctionGrants.ts run')
