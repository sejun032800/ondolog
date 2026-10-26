/**
 * 설정 경로 회귀 실증 (`68-` ui-builder 산출) - 027 칸 단위 권한 부여 **뒤에도** 기존 설정 쓰기가 사용자 세션으로 동작하는지 본다 (Deno 전용).
 *
 * **이 파일은 작성만 했고 실행하지 않는다(R42-4).** 027이 원격 개발 DB에 적용된 것을 확인한 뒤(`scripts/db/verify_027_privileges.sql` 전부 ok) 사람이 실행한다.
 * 적용 전에 돌리면 `ONDOLOG_027_APPLIED=1`이 없어 멈춘다. **재검사는 하지 않는다** - 재검사 · 해제 · 탈퇴 함수는 `verifyDissolution68.ts`가 본다.
 *
 * 대상: `test-66-` 두 계정 커플(active, 사귄 날짜 있음, 가장 최근 것). 쓸 만한 커플이나 사용자 세션을 얻지 못하면 **멈춘다**(대체 경로 없음 - 앞 단계가 실패하면
 * 그 단계에 기대는 뒤 단계는 SKIP으로 적는다, R40-5). service_role은 **계정 찾기 · 로그인 토큰 발급 · 읽어 확인하기**에만 쓰고, 저장은 각 계정의 사용자 세션(anon 키 + 로그인)이다.
 *
 * 흐름(앱과 같은 코어 함수를 부른다 - 각 단계 뒤 A · B의 `onboarding_step`이 처음 값과 같은지 확인한다):
 *   ① A가 이름 · 성별 수정(`updateProfileBasics`) -> 바뀐 칸은 display_name · gender 뿐(행 전체 비교, updated_at 제외)
 *   ② A가 사귄 날짜 수정(`updateStartDateByMe`) -> 날짜 · set_by = A · confirmed_by = null
 *   ③ B가 A20 확인(앱 미러: `setOrConfirmStartDate`) -> confirmed_by = B
 *   ④ A가 닉네임 수정(`updateCoupleNickname`)
 *   ⑤ A가 오버라이드(`overrideEnneagramCore`) -> enneagram_override · override_count + 1 · love_type_code 재계산, 추론값 그대로
 *   ⑥ A가 `onboarding_step`을 지금과 같은 값으로 올리기 시도(`advanceOnboardingStep`) -> 오류 없이 값 그대로(감소 거부 트리거가 걸리지 않는다)
 *   ⑦ A가 마케팅 수신 켜기 · 끄기(`updateMarketingConsent`) -> marketing_agreed_at 시각 · null, 끝에 처음 값으로 되돌린다
 *   ⑧ 마무리 - A · B 진행 단계 변화 없음
 *
 * 토큰 · 키 · URL은 출력 · 파일 어디에도 쓰지 않는다(`printer`가 비밀값을 가린다). 시험 데이터 이름에는 `test`가 들어 있다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY · ONDOLOG_027_APPLIED=1
 * 출력 파일: scripts/ops/out/68-regression.txt
 *
 * 사용 (저장소 루트, PowerShell 한 줄 - 프로젝트 ref는 supabase/.temp/project-ref에서 읽는다):
 *   $ref = (Get-Content supabase/.temp/project-ref).Trim(); deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY,ONDOLOG_027_APPLIED --allow-net="$ref.supabase.co" --allow-read=supabase/.temp/linked-project.json,src --allow-write=scripts/ops/out scripts/ops/verify68Regression.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { computeLoveTypeCode } from '../../src/engine/loveTypeInference.ts'
import { advanceOnboardingStep } from '../../src/services/onboardingStepCore.ts'
import { overrideEnneagramCore, type PersonalityDb } from '../../src/services/personalityCore.ts'
import {
  updateCoupleNickname,
  updateMarketingConsent,
  updateProfileBasics,
  updateStartDateByMe,
  type SettingsDb,
} from '../../src/services/settingsCore.ts'
import { addDays, kstToday } from '../../src/utils/magazine.ts'
import { needsStartDateConfirm } from '../../src/utils/settingsRules.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

interface Account {
  id: string
  email: string
  client: Db
}

/** 두 행을 칸별로 비교해 달라진 칸 이름을 돌려준다(`ignore`는 제외). */
function changedColumns(before: Record<string, unknown>, after: Record<string, unknown>, ignore: string[] = []): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((k) => !ignore.includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
}

async function main(): Promise<void> {
  if (Deno.env.get('ONDOLOG_027_APPLIED') !== '1') {
    console.log('멈춤: 027이 원격 개발 DB에 적용되고 verify_027_privileges.sql이 전부 ok인 것을 확인한 뒤 ONDOLOG_027_APPLIED=1로 실행한다.')
    Deno.exit(2)
  }
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

  async function sessionFor(email: string, id: string): Promise<Account | null> {
    try {
      const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
      if (link.error) return null
      const client: Db = createClient(url, anon as string, { auth: { persistSession: false, autoRefreshToken: false } })
      const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
      if (verified.error) return null
      secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
      return { id, email, client }
    } catch {
      return null
    }
  }

  async function findTest66(): Promise<{ coupleId: string; A: Account; B: Account } | null> {
    const { data: couples } = await admin
      .from('couples')
      .select('id, user_a_id, user_b_id, connected_at, relationship_start_date')
      .eq('status', 'active')
      .order('connected_at', { ascending: false })
      .limit(40)
    for (const c of couples ?? []) {
      if (!c.relationship_start_date || !c.user_a_id || !c.user_b_id) continue
      const users = []
      for (const id of [c.user_a_id, c.user_b_id]) users.push((await admin.auth.admin.getUserById(id)).data?.user ?? null)
      if (!users.every((u) => u && /^test-66-.+@example\.com$/.test(u.email ?? ''))) continue
      const A = await sessionFor(users[0]!.email as string, c.user_a_id)
      const B = await sessionFor(users[1]!.email as string, c.user_b_id)
      if (!A || !B) continue
      return { coupleId: c.id, A, B }
    }
    return null
  }

  let target: { coupleId: string; A: Account; B: Account } | null = null
  try {
    target = await findTest66()
  } catch (e) {
    line(`[준비] test-66 커플 찾기 실패: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!target) {
    check(false, '쓸 만한 test-66 커플(active · 사귄 날짜 있음 · 두 계정 사용자 세션 발급)이 없다 - 대체 경로 없이 멈춘다')
    await finish()
    return
  }
  const { A, B, coupleId } = target
  line(`[준비] 대상 커플: test-66 (A ${A.email} · B ${B.email}) - 각자 사용자 세션`)

  const who = (id: string | null | undefined) => (id === A.id ? 'A' : id === B.id ? 'B' : id ? '?' : '-')
  async function steps(): Promise<{ a: number | null; b: number | null }> {
    const rows = await admin.from('profiles').select('id, onboarding_step').in('id', [A.id, B.id])
    const get = (id: string) => (rows.data ?? []).find((r: { id: string }) => r.id === id)?.onboarding_step ?? null
    return { a: get(A.id), b: get(B.id) }
  }
  const profileRow = async (id: string): Promise<Record<string, unknown> | null> =>
    (await admin.from('profiles').select('*').eq('id', id).maybeSingle()).data
  const coupleRow = async (): Promise<Record<string, unknown> | null> =>
    (await admin.from('couples').select('*').eq('id', coupleId).maybeSingle()).data
  const ppRow = async (id: string): Promise<Record<string, unknown> | null> =>
    (await admin.from('personality_profiles').select('*').eq('user_id', id).maybeSingle()).data

  const step0 = await steps()
  line(`[처음] onboarding_step A=${step0.a} B=${step0.b}`)
  async function stepsUnchanged(label: string): Promise<void> {
    const s = await steps()
    check(s.a === step0.a && s.b === step0.b && s.a !== null && s.b !== null, `${label} 뒤 onboarding_step 변화 없음 (A=${s.a}, B=${s.b})`)
  }

  const notOk = new Set<string>()
  async function stage(id: string, needs: string[], fn: () => Promise<void>): Promise<void> {
    const blocked = needs.filter((n) => notOk.has(n))
    if (blocked.length > 0) {
      notOk.add(id)
      line(`SKIP ${id} - 앞 단계(${blocked.join(', ')})가 실패해 멈춘다`)
      return
    }
    const before = failures
    try {
      await fn()
    } catch (e) {
      failures += 1
      line(`FAIL ${id} 예외: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (failures > before) notOk.add(id)
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

  await stage('s1', [], async () => {
    line('═══ ① A가 이름 · 성별 수정 (updateProfileBasics) ═══')
    const before = await profileRow(A.id)
    if (!before) {
      check(false, 'A의 profiles 행을 읽지 못했다')
      return
    }
    const newName = `test-68-이름-${stamp.slice(8)}`
    const newGender = before.gender === 'other' ? 'male' : 'other'
    const row = await updateProfileBasics(A.client as SettingsDb, A.id, { displayName: newName, gender: newGender })
    check(row.display_name === newName && row.gender === newGender, `이름 · 성별 바뀜: ${before.display_name}/${before.gender} -> ${row.display_name}/${row.gender}`)
    const after = await profileRow(A.id)
    const changed = after ? changedColumns(before, after, ['updated_at']) : ['(읽기 실패)']
    check(changed.every((c) => c === 'display_name' || c === 'gender') && changed.length > 0, `행 전체 비교(updated_at 제외): 바뀐 칸 = [${changed.join(', ')}]`)
    await stepsUnchanged('①')
  })

  let editedDate = ''
  await stage('s2', [], async () => {
    line('═══ ② A가 사귄 날짜 수정 (updateStartDateByMe) ═══')
    const before = await coupleRow()
    if (!before) {
      check(false, '커플 행을 읽지 못했다')
      return
    }
    editedDate = addDays(kstToday(new Date()), -45)
    if (editedDate === before.relationship_start_date) editedDate = addDays(kstToday(new Date()), -46)
    const row = await updateStartDateByMe(A.client as SettingsDb, coupleId, A.id, editedDate)
    const after = await coupleRow()
    check(row.relationship_start_date === editedDate, `날짜 바뀜: ${before.relationship_start_date} -> ${row.relationship_start_date}`)
    check(after?.start_date_set_by === A.id && after?.start_date_confirmed_by === null, `set_by = ${who(after?.start_date_set_by as string)} · confirmed_by = ${who(after?.start_date_confirmed_by as string)} (같은 UPDATE)`)
    await stepsUnchanged('②')
  })

  await stage('s3', ['s2'], async () => {
    line('═══ ③ B가 A20 확인 ═══')
    const read = await B.client.from('couples').select('*').or(`user_a_id.eq.${B.id},user_b_id.eq.${B.id}`).eq('status', 'active').maybeSingle()
    if (read.error || !read.data) {
      check(false, `B가 커플 행을 읽지 못했다: ${read.error?.message ?? '0행'}`)
      return
    }
    check(needsStartDateConfirm(read.data, B.id) === true, '판정 = A20 표시')
    const conf = await B.client.from('couples').update({ start_date_confirmed_by: B.id }).eq('id', coupleId).select().maybeSingle()
    check(!conf.error && !!conf.data, `B가 확인: ${conf.error?.message ?? 'ok'}`)
    const after = await coupleRow()
    check(after?.start_date_confirmed_by === B.id && after?.relationship_start_date === editedDate, '확인자 = B · 날짜 그대로')
    await stepsUnchanged('③')
  })

  await stage('s4', [], async () => {
    line('═══ ④ A가 커플 닉네임 수정 (updateCoupleNickname) ═══')
    const nick = `test-68-${stamp.slice(10)}`
    const row = await updateCoupleNickname(A.client as SettingsDb, coupleId, nick)
    check(row.nickname === nick && (await coupleRow())?.nickname === nick, `닉네임 바뀜: ${row.nickname}`)
    await stepsUnchanged('④')
  })

  await stage('s5', [], async () => {
    line('═══ ⑤ A가 오버라이드 (overrideEnneagramCore) ═══')
    const before = await ppRow(A.id)
    if (!before) {
      check(false, 'A의 personality_profiles 행을 읽지 못했다')
      return
    }
    const newCore = ((before.enneagram_effective as number) % 9) + 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
    const row = await overrideEnneagramCore(A.client as PersonalityDb, A.id, newCore)
    const after = await ppRow(A.id)
    check(row.enneagram_override === newCore && after?.enneagram_override === newCore, `enneagram_override = ${newCore}`)
    check(after?.override_count === (before.override_count as number) + 1, `override_count ${before.override_count} -> ${after?.override_count}`)
    check(after?.love_type_code === computeLoveTypeCode(newCore, before.attachment as never), `love_type_code 재계산: ${before.love_type_code} -> ${after?.love_type_code}`)
    check(after?.enneagram_inferred === before.enneagram_inferred && after?.attachment === before.attachment && after?.retest_used === before.retest_used, '추론값 · 애착 · retest_used 그대로')
    await stepsUnchanged('⑤')
  })

  await stage('s6', [], async () => {
    line('═══ ⑥ A가 onboarding_step을 지금과 같은 값으로 올리기 (advanceOnboardingStep) ═══')
    const cur = (await profileRow(A.id))?.onboarding_step as number | undefined
    if (cur === undefined || cur < 0 || cur > 3) {
      check(false, `A의 onboarding_step을 읽지 못했다 (${cur})`)
      return
    }
    await advanceOnboardingStep(A.client as never, A.id, cur as never)
    check((await profileRow(A.id))?.onboarding_step === cur, `오류 없이 값 그대로 (${cur})`)
    await stepsUnchanged('⑥')
  })

  await stage('s7', [], async () => {
    line('═══ ⑦ A가 마케팅 수신 켜기 · 끄기 (updateMarketingConsent) ═══')
    const original = (await profileRow(A.id))?.marketing_agreed_at ?? null
    const on = await updateMarketingConsent(A.client as SettingsDb, A.id, true)
    check(typeof on === 'string' && (await profileRow(A.id))?.marketing_agreed_at !== null, '켜기: marketing_agreed_at에 시각')
    const off = await updateMarketingConsent(A.client as SettingsDb, A.id, false)
    check(off === null && (await profileRow(A.id))?.marketing_agreed_at === null, '끄기: marketing_agreed_at = null')
    if (original !== null) {
      // 처음에 켜져 있었으면 되돌려 둔다(원래 시각 그대로는 앱 경로가 없어 지금 시각으로 켠다).
      await updateMarketingConsent(A.client as SettingsDb, A.id, true)
      line('[정리] 처음에 켜져 있던 마케팅 수신을 다시 켰다(시각은 지금)')
    }
    await stepsUnchanged('⑦')
  })

  await stage('s8', [], async () => {
    line('═══ ⑧ 마무리 ═══')
    await stepsUnchanged('전체')
  })

  line(`\n실패 ${failures}건`)
  await finish()

  async function finish(): Promise<void> {
    await Deno.mkdir('scripts/ops/out', { recursive: true })
    let text = out.join('\n') + '\n'
    for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
    await Deno.writeTextFile('scripts/ops/out/68-regression.txt', text)
    if (failures > 0) Deno.exit(1)
  }
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verify68Regression.ts run')
