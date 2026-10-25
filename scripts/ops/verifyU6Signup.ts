/**
 * U6 온보딩 1부 실증 (`63-`) - 원격 **개발** DB에서 새 시험 계정이 자기 **사용자 권한**으로 앱과 같은 저장 함수를 부른다 (Deno 전용).
 *
 * 1. 새 시험 계정(이름에 test, 매번 새로 만든다)을 만든다 - 카카오는 원격에서 쓰지 않는다. 로그인은 관리자 매직링크 토큰을 사용자 세션으로 바꾼다.
 * 2. **저장 경로를 부르기 전**: 서버에 이 계정의 profiles 행이 없다 -> `terms_agreed_at`·`privacy_agreed_at`·`ai_usage_agreed_at` 세 칸에 값이 없다.
 *    동의 시각 없이 사용자 권한으로 profiles 행을 직접 넣어 보면 거부된다(017: NOT NULL, default 없음).
 * 3. **부른 뒤에만**: 앱이 로그인 직후 부르는 함수 그대로(`personalityCore.createProfileAndAssessment`, 앱은 `personalityApi`가 같은 알맹이를 부른다) ->
 *    세 칸이 찍히고, 마케팅은 체크하지 않았으므로 비어 있고, `onboarding_step`=0, personality_assessments 1행(seq 1).
 * 4. **이미 동의·답이 있는 계정으로 같은 함수를 다시 부르면**(r70 이후 - 없을 때만 넣기): 오류 없이 통과하고, profiles의 시각·이름·진행 단계와
 *    assessment는 그대로다. (r70 이전에는 upsert라 덮였고 assessment insert가 23505로 실패했다 - `64-`가 바꿨다. 자세한 실증은 `verifyExistingAccount.ts`.)
 *
 * service_role은 **계정 만들기·로그인 토큰·읽어 확인하기**에만 쓴다. 저장 호출은 사용자 세션(anon 키 + 로그인)이다. 토큰·키·URL은 출력·파일에 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyU6Signup.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { inferLoveType } from '../../src/engine/loveTypeInference.ts'
import { createProfileAndAssessment, type PersonalityDb } from '../../src/services/personalityCore.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

async function main(): Promise<void> {
  const ops = await connectOps()
  const admin: Db = ops.client
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
  const anon = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
  if (!anon) throw new Error('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
  const secrets = [...ops.secrets, anon]
  const say = printer(secrets)
  const out: string[] = []
  const line = (s: string) => {
    out.push(s)
    say(s)
  }
  let failures = 0
  const check = (ok: boolean, what: string) => {
    if (!ok) failures += 1
    line(`${ok ? 'OK  ' : 'FAIL'} ${what}`)
  }

  // ── 새 시험 계정 ────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const email = `test-63-signup-${stamp}@example.com`
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
  if (created.error) throw new Error(`계정 생성 실패: ${created.error.message}`)
  const userId = created.data.user.id as string
  line(`[준비] 새 시험 계정 ${email} (auth.users)`)

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
  const client: Db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
  if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
  secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
  line('로그인: 시험 계정의 사용자 세션(카카오 아님)')

  // ── 저장 경로를 부르기 전 ──────────────────────────────────────────────
  const before = await admin.from('profiles').select('terms_agreed_at, privacy_agreed_at, ai_usage_agreed_at, marketing_agreed_at, onboarding_step').eq('id', userId).maybeSingle()
  check(!before.error && before.data === null, '[부르기 전] profiles 행이 없다 -> 동의 시각 세 칸(terms·privacy·ai_usage) 값 없음')

  const direct = await client.from('profiles').insert({ id: userId, display_name: 'test-세준', gender: 'male', birth_date: '2000-01-01', mbti: 'INFJ', onboarding_step: 0 })
  check(!!direct.error, `[부르기 전] 동의 시각 없이 profiles 행을 직접 넣으면 거부된다 (${direct.error?.code ?? 'no-error'})`)
  const stillNone = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  check(stillNone.data === null, '[부르기 전] 거부 뒤에도 행이 없다')

  // ── 부른 뒤 ────────────────────────────────────────────────────────────
  const answers = { q1: 'A', q2: 'B', q3: 'C', q4: 'A', q5: 'B' } as const
  const result = inferLoveType({ mbti: 'INFJ', ...answers })
  const t0 = Date.now()
  const assessment = await createProfileAndAssessment(client as PersonalityDb, {
    userId,
    name: 'test-세준',
    gender: 'male',
    birthDate: '2000-01-01',
    mbti: 'INFJ',
    mbtiSelfReported: true,
    ...answers,
    result,
    marketingAgreed: false,
  })
  const t1 = Date.now()
  line(`createProfileAndAssessment -> assessment seq ${assessment?.seq}, enneagram_core ${assessment?.enneagram_core}`)

  const after = await admin
    .from('profiles')
    .select('terms_agreed_at, privacy_agreed_at, ai_usage_agreed_at, marketing_agreed_at, onboarding_step, display_name')
    .eq('id', userId)
    .single()
  const inWindow = (iso: string | null) => !!iso && new Date(iso).getTime() >= t0 - 2000 && new Date(iso).getTime() <= t1 + 2000
  check(inWindow(after.data.terms_agreed_at), `[부른 뒤] terms_agreed_at 찍힘 (${after.data.terms_agreed_at})`)
  check(inWindow(after.data.privacy_agreed_at), `[부른 뒤] privacy_agreed_at 찍힘 (${after.data.privacy_agreed_at})`)
  check(inWindow(after.data.ai_usage_agreed_at), `[부른 뒤] ai_usage_agreed_at 찍힘 (${after.data.ai_usage_agreed_at})`)
  check(after.data.marketing_agreed_at === null, '[부른 뒤] 마케팅은 체크하지 않아 marketing_agreed_at 비어 있음')
  check(after.data.onboarding_step === 0, `[부른 뒤] onboarding_step = ${after.data.onboarding_step} (가입 직후 0)`)
  const assessments = await admin.from('personality_assessments').select('seq, mbti, q1, q2, q3, q4, q5').eq('user_id', userId)
  check((assessments.data ?? []).length === 1 && assessments.data[0].seq === 1, `[부른 뒤] personality_assessments 1행(seq 1, 답 ${assessments.data?.[0]?.q1}${assessments.data?.[0]?.q2}${assessments.data?.[0]?.q3}${assessments.data?.[0]?.q4}${assessments.data?.[0]?.q5})`)

  // ── 이미 동의·답이 있는 계정으로 다시 부르면(코드가 하는 그대로) ──────────
  await admin.from('profiles').update({ onboarding_step: 3 }).eq('id', userId)
  const firstStamp = after.data.terms_agreed_at as string
  await new Promise((r) => setTimeout(r, 1100))
  let secondError = ''
  try {
    await createProfileAndAssessment(client as PersonalityDb, {
      userId,
      name: 'test-세준-다시',
      gender: 'male',
      birthDate: '2000-01-01',
      mbti: 'INFJ',
      mbtiSelfReported: true,
      ...answers,
      result,
      marketingAgreed: true,
    })
  } catch (e) {
    secondError = (e as { code?: string; message?: string }).code ?? (e as Error).message
  }
  const again = await admin
    .from('profiles')
    .select('terms_agreed_at, marketing_agreed_at, onboarding_step, display_name')
    .eq('id', userId)
    .single()
  line(`[다시 부름] profiles: display_name '${again.data.display_name}', onboarding_step ${again.data.onboarding_step}(부르기 전 3), terms_agreed_at ${again.data.terms_agreed_at === firstStamp ? '그대로' : '새 시각으로 덮임'}, marketing_agreed_at ${again.data.marketing_agreed_at ? '찍힘' : '비어 있음'}`)
  line(`[다시 부름] personality_assessments insert -> ${secondError ? `실패(${secondError})` : '성공'}`)
  check(again.data.onboarding_step === 3 && again.data.terms_agreed_at === firstStamp && again.data.display_name === 'test-세준', '[다시 부름] 없을 때만 넣기 - profiles가 덮이지 않고 세이브포인트도 그대로(3)')
  check(secondError === '', '[다시 부름] 두 번째 호출은 오류 없이 통과한다(assessment 23505는 성공으로 본다)')

  line(`\n실패 ${failures}건`)
  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/63-u6-signup.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyU6Signup.ts run')
