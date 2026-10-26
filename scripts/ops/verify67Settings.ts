/**
 * U7 설정 필수 1부 실증 (`67-`) - 원격 **개발** DB에서 두 시험 계정이 각자 **사용자 권한**으로 설정 탭의 쓰기 경로를 앱과 같은 함수로 부른다 (Deno 전용).
 *
 * `68-` 주: 재검사(⑤ · ⑥)는 027 `fn_complete_retest` 함수 호출로 바뀌어 **027 적용 뒤에만** 맞다(적용 전 원격에는 함수가 없다). 나머지 단계는 `verify68Regression.ts`가 027 뒤 기준으로 따로 본다.
 *
 * **이 파일은 쓰기만 하고 실행하지 않는다(R42-4).** 실행은 사람이 한다 - 에이전트는 원격에 아무것도 쓰지 않았다.
 *
 * 대상 커플: `test-66-` 두 계정 커플(`66-` 실증이 A20까지 끝낸 active 커플, 가장 최근 것). 사용자 세션을 얻지 못하거나 쓸 만한 커플이 없으면
 * 새 `test-67-` 커플을 **앱 경로로**(가입 -> A14 프로필 -> 초대 코드 -> `fn_connect_couple` -> 사귄 날짜 -> A20 확인) 만든다. 어느 쪽을 썼는지 출력 첫머리에 남긴다.
 *
 * 흐름(각 단계 뒤 A · B의 `onboarding_step`이 처음 값과 같은지 확인한다 - 내려가지도 오르지도 않는다):
 *   ① A가 이름 수정(`updateProfileBasics`) -> `profiles` 이름만 바뀐다(행 전체 비교, `updated_at` 제외). 빈 이름은 서버로 가지 않는다.
 *   ② A가 사귄 날짜 수정(`updateStartDateByMe`) -> 날짜 바뀜 · `start_date_set_by` = A · `start_date_confirmed_by` = null. 미래 날짜는 서버로 가지 않는다.
 *   ③ B 쪽에서 A20 조건을 판정(`needsStartDateConfirm`) -> 참 -> B가 확인(미러: `setOrConfirmStartDate`) -> `confirmed_by` = B · 날짜 그대로 · 판정이 거짓으로 바뀐다.
 *   ④ A가 닉네임 수정(`updateCoupleNickname`) -> 바뀜. 0자 · 21자는 앱 함수가 막고, 서버 check(`23514`)도 거부한다(직접 UPDATE로 확인).
 *   ⑤ A가 재검사(`retestPersonality`, 앱과 같은 함수) -> assessment 2행(이전 행 JSON 그대로) · `active_assessment_id` = 새 행 · `enneagram_override` null ·
 *      `love_type_code` = 새 결과 기준 · `retest_used` true. (A의 `retest_used`가 이미 true면 이 계정은 고르지 않는다 - 커플의 다른 쪽이 A가 된다.)
 *   ⑥ A가 두 번째 재검사 시도 -> 화면 판정 함수 `canRetest`가 차단한다(버튼 비활성 조건). 서버로 보내지 않는다 - assessment 행 수 그대로.
 *   ⑦ 각 단계 뒤 A · B `onboarding_step` 변화 없음.
 *
 * 단계 규칙(R40-4/5): 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 SKIP, null은 FAIL로 드러낸다. 대체 경로는 없다.
 * service_role은 **계정 찾기 · 로그인 토큰 · 읽어 확인하기**(와 fallback 계정 만들기)에만 쓴다. 저장은 각 계정의 사용자 세션(anon 키 + 로그인)이다.
 * 토큰 · 키 · URL은 출력 · 파일 어디에도 쓰지 않는다. 시험 데이터 이름에 `test`가 들어간다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY (값은 터미널에서 이미 설정돼 있다고 가정)
 * 출력 파일: scripts/ops/out/67-settings.txt
 *
 * 사용 (저장소 루트, PowerShell 한 줄 - 프로젝트 ref는 supabase/.temp/project-ref에서 읽는다):
 *   $ref = (Get-Content supabase/.temp/project-ref).Trim(); deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY --allow-net="$ref.supabase.co" --allow-read=supabase/.temp/linked-project.json,src --allow-write=scripts/ops/out scripts/ops/verify67Settings.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { ONBOARDING_STEP } from '../../src/constants/onboardingStep.ts'
import { computeLoveTypeCode, inferLoveType } from '../../src/engine/loveTypeInference.ts'
import { ConnectCoupleError, connectCouple, type ConnectDb } from '../../src/services/coupleConnectCore.ts'
import { advanceOnboardingStep } from '../../src/services/onboardingStepCore.ts'
import { createProfileAndAssessment, ensurePersonalityProfileCore, type PersonalityDb } from '../../src/services/personalityCore.ts'
import {
  RetestError,
  retestPersonality,
  updateCoupleNickname,
  updateProfileBasics,
  updateStartDateByMe,
  type RetestDb,
  type SettingsDb,
} from '../../src/services/settingsCore.ts'
import { addDays, kstToday } from '../../src/utils/magazine.ts'
import { canRetest, needsStartDateConfirm } from '../../src/utils/settingsRules.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

interface Account {
  id: string
  email: string
  client: Db
}

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]
  return code
}

/** 두 행을 칸별로 비교해 달라진 칸 이름을 돌려준다(`ignore`는 제외). */
function changedColumns(before: Record<string, unknown>, after: Record<string, unknown>, ignore: string[] = []): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((k) => !ignore.includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
}

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

  // 관리자 매직링크 토큰 -> 그 계정의 사용자 세션. 실패하면 null(호출한 쪽이 다음 후보 · fallback으로 간다).
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

  // ── 대상 커플 찾기: test-66- 두 계정 active 커플 ───────────────────────────
  interface Target {
    source: 'test-66' | 'test-67'
    coupleId: string
    A: Account
    B: Account
  }

  async function findTest66(): Promise<Target | null> {
    const { data: couples } = await admin
      .from('couples')
      .select('id, user_a_id, user_b_id, connected_at, relationship_start_date')
      .eq('status', 'active')
      .order('connected_at', { ascending: false })
      .limit(40)
    for (const c of couples ?? []) {
      if (!c.relationship_start_date || !c.user_a_id || !c.user_b_id) continue
      const users = []
      for (const id of [c.user_a_id, c.user_b_id]) {
        const u = await admin.auth.admin.getUserById(id)
        users.push(u.data?.user ?? null)
      }
      if (!users.every((u) => u && /^test-66-.+@example\.com$/.test(u.email ?? ''))) continue
      const pps = await admin.from('personality_profiles').select('user_id, retest_used').in('user_id', [c.user_a_id, c.user_b_id])
      const rows: { user_id: string; retest_used: boolean }[] = pps.data ?? []
      if (rows.length !== 2) continue
      // 재검사를 아직 안 쓴 쪽이 A다(⑤ · ⑥은 한 계정에 한 번뿐이라 이미 쓴 계정은 쓸 수 없다).
      const aId = rows.find((r) => r.retest_used === false)?.user_id
      if (!aId) continue
      const bId = aId === c.user_a_id ? c.user_b_id : c.user_a_id
      const A = await sessionFor(users[aId === c.user_a_id ? 0 : 1]!.email as string, aId)
      const B = await sessionFor(users[aId === c.user_a_id ? 1 : 0]!.email as string, bId)
      if (!A || !B) continue
      return { source: 'test-66', coupleId: c.id, A, B }
    }
    return null
  }

  // fallback: 새 test-67- 커플을 앱 경로로 만든다. 어느 단계든 실패하면 예외 -> 이 실증은 거기서 멈춘다.
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  async function newAccount(tag: string): Promise<Account> {
    const email = `test-67-${tag}-${stamp}@example.com`
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
    if (created.error) throw new Error(`계정 생성 실패: ${created.error.message}`)
    const acc = await sessionFor(email, created.data.user.id as string)
    if (!acc) throw new Error('새 계정 로그인 실패')
    return acc
  }
  async function createTest67(): Promise<Target> {
    const A = await newAccount('a')
    const B = await newAccount('b')
    const answers = { q1: 'A', q2: 'B', q3: 'C', q4: 'A', q5: 'B' } as const
    const result = inferLoveType({ mbti: 'INFJ', ...answers })
    for (const [acc, name] of [[A, 'test-67-서영'], [B, 'test-67-세준']] as const) {
      const saved = await createProfileAndAssessment(acc.client as PersonalityDb, {
        userId: acc.id,
        name,
        gender: 'male',
        birthDate: '2000-01-01',
        mbti: 'INFJ',
        mbtiSelfReported: true,
        ...answers,
        result,
        marketingAgreed: false,
      })
      if (!saved) throw new Error('가입 저장 실패')
      const made = await ensurePersonalityProfileCore(acc.client as PersonalityDb, acc.id, saved)
      if (!made.row) throw new Error('프로필 생성 실패')
      await advanceOnboardingStep(acc.client as never, acc.id, ONBOARDING_STEP.RESULT)
    }
    let code = ''
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const c = generateInviteCode()
      const ins = await A.client.from('couples').insert({ user_a_id: A.id, invite_code: c }).select().maybeSingle()
      if (!ins.error && ins.data) code = ins.data.invite_code
      else if (ins.error && ins.error.code !== '23505') throw new Error(`코드 발급 실패: ${ins.error.message}`)
    }
    if (!code) throw new Error('코드 발급 실패')
    let coupleId: string
    try {
      coupleId = await connectCouple(B.client as ConnectDb, code)
    } catch (e) {
      throw new Error(`연결 실패: ${e instanceof ConnectCoupleError ? e.message : String(e)}`)
    }
    for (const acc of [A, B]) await advanceOnboardingStep(acc.client as never, acc.id, ONBOARDING_STEP.INVITE)
    // A19(미러: saveStartDateAndNickname) - A가 날짜 + 닉네임, A20(미러: setOrConfirmStartDate) - B가 확인.
    const date = addDays(kstToday(new Date()), -100)
    const set = await A.client.from('couples').update({ relationship_start_date: date, start_date_set_by: A.id }).eq('id', coupleId).select().maybeSingle()
    if (set.error || !set.data) throw new Error('A19 날짜 저장 실패')
    const nick = await A.client.from('couples').update({ nickname: 'test-67-닉' }).eq('id', coupleId).select().maybeSingle()
    if (nick.error || !nick.data) throw new Error('A19 닉네임 저장 실패')
    const conf = await B.client.from('couples').update({ start_date_confirmed_by: B.id }).eq('id', coupleId).select().maybeSingle()
    if (conf.error || !conf.data) throw new Error('A20 확인 실패')
    for (const acc of [A, B]) await advanceOnboardingStep(acc.client as never, acc.id, ONBOARDING_STEP.COMPLETE)
    return { source: 'test-67', coupleId, A, B }
  }

  let target: Target | null = null
  try {
    target = await findTest66()
  } catch (e) {
    line(`[준비] test-66 커플 찾기 실패: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!target) {
    line('[준비] 쓸 만한 test-66 커플(사용자 세션 발급 + 재검사 미사용)이 없다 -> 새 test-67 커플을 앱 경로로 만든다')
    try {
      target = await createTest67()
    } catch (e) {
      check(false, `test-67 커플 만들기 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (!target) {
    line(`\n실패 ${failures}건 - 대상 커플이 없어 단계를 시작하지 못했다`)
    await finish()
    return
  }
  const { A, B, coupleId } = target
  line(`[준비] 대상 커플: ${target.source} (A ${A.email} · B ${B.email}) - 각자 사용자 세션`)

  const who = (id: string | null | undefined) => (id === A.id ? 'A' : id === B.id ? 'B' : id ? '?' : '-')
  async function steps(): Promise<{ a: number | null; b: number | null }> {
    const rows = await admin.from('profiles').select('id, onboarding_step').in('id', [A.id, B.id])
    const get = (id: string) => (rows.data ?? []).find((r: { id: string }) => r.id === id)?.onboarding_step ?? null
    return { a: get(A.id), b: get(B.id) }
  }
  async function profileRow(id: string): Promise<Record<string, unknown> | null> {
    return (await admin.from('profiles').select('*').eq('id', id).maybeSingle()).data
  }
  async function coupleRow(): Promise<Record<string, unknown> | null> {
    return (await admin.from('couples').select('*').eq('id', coupleId).maybeSingle()).data
  }
  async function ppRow(id: string): Promise<Record<string, unknown> | null> {
    return (await admin.from('personality_profiles').select('*').eq('user_id', id).maybeSingle()).data
  }
  async function assessments(id: string): Promise<Record<string, unknown>[]> {
    const { data } = await admin.from('personality_assessments').select('*').eq('user_id', id).order('seq', { ascending: true })
    return data ?? []
  }

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

  // ═══ ① 이름 수정 ═══════════════════════════════════════════════════════
  await stage('s1', [], async () => {
    line('═══ ① A가 이름 수정 (updateProfileBasics - 앱과 같은 함수) ═══')
    const before = await profileRow(A.id)
    if (!before) {
      check(false, 'A의 profiles 행을 읽지 못했다')
      return
    }
    const newName = `test-67-이름-${stamp.slice(8)}`
    const row = await updateProfileBasics(A.client as SettingsDb, A.id, { displayName: newName, gender: before.gender as 'male' | 'female' | 'other' })
    check(row.display_name === newName, `이름 바뀜: ${before.display_name} -> ${row.display_name}`)
    const after = await profileRow(A.id)
    const changed = after ? changedColumns(before, after, ['updated_at']) : ['(읽기 실패)']
    check(changed.length === 1 && changed[0] === 'display_name', `행 전체 비교(updated_at 제외): 바뀐 칸 = [${changed.join(', ')}]`)
    let blocked = false
    try {
      await updateProfileBasics(A.client as SettingsDb, A.id, { displayName: '   ', gender: before.gender as 'male' })
    } catch {
      blocked = true
    }
    check(blocked && (await profileRow(A.id))?.display_name === newName, '빈 이름은 서버로 가지 않고 이름이 그대로다')
    await stepsUnchanged('①')
  })

  // ═══ ② 사귄 날짜 수정 ═══════════════════════════════════════════════════
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
    const changed = after ? changedColumns(before, after, ['updated_at']) : []
    check(changed.every((c) => ['relationship_start_date', 'start_date_set_by', 'start_date_confirmed_by'].includes(c)), `바뀐 칸은 세 칸 안: [${changed.join(', ')}]`)
    let blocked = false
    try {
      await updateStartDateByMe(A.client as SettingsDb, coupleId, A.id, addDays(kstToday(new Date()), 3))
    } catch {
      blocked = true
    }
    check(blocked && (await coupleRow())?.relationship_start_date === editedDate, '미래 날짜는 서버로 가지 않고 날짜가 그대로다')
    await stepsUnchanged('②')
  })

  // ═══ ③ B 쪽 A20 ════════════════════════════════════════════════════════
  await stage('s3', ['s2'], async () => {
    line('═══ ③ B 쪽에서 A20 조건 판정 -> 확인 ═══')
    // 미러: fetchMyActiveCouple(앱 `settingsApi`) - B의 사용자 권한으로 읽는다.
    const read = await B.client.from('couples').select('*').or(`user_a_id.eq.${B.id},user_b_id.eq.${B.id}`).eq('status', 'active').maybeSingle()
    if (read.error || !read.data) {
      check(false, `B가 커플 행을 읽지 못했다: ${read.error?.message ?? '0행'}`)
      return
    }
    check(needsStartDateConfirm(read.data, B.id) === true, `판정 = A20 표시 (정한이 ${who(read.data.start_date_set_by)} · 확인한이 ${who(read.data.start_date_confirmed_by)})`)
    check(needsStartDateConfirm(read.data, A.id) === false, 'A 쪽 판정은 거짓(내가 정했다)')
    // 미러: setOrConfirmStartDate - 날짜가 이미 있으면 확인만 기록한다.
    const conf = await B.client.from('couples').update({ start_date_confirmed_by: B.id }).eq('id', coupleId).select().maybeSingle()
    check(!conf.error && !!conf.data, `B가 확인: ${conf.error?.message ?? 'ok'}`)
    if (conf.error || !conf.data) return
    const after = await coupleRow()
    check(after?.start_date_confirmed_by === B.id && after?.relationship_start_date === editedDate && after?.start_date_set_by === A.id, '확인자 = B · 날짜 그대로 · 정한이 = A 그대로')
    check(needsStartDateConfirm(after as never, B.id) === false, '확인 뒤 판정이 거짓으로 바뀐다')
    await stepsUnchanged('③')
  })

  // ═══ ④ 닉네임 수정 ═════════════════════════════════════════════════════
  await stage('s4', [], async () => {
    line('═══ ④ A가 커플 닉네임 수정 (updateCoupleNickname) ═══')
    const before = await coupleRow()
    const nick = `test-67-${stamp.slice(10)}`
    const row = await updateCoupleNickname(A.client as SettingsDb, coupleId, nick)
    check(row.nickname === nick, `닉네임 바뀜: ${before?.nickname ?? '-'} -> ${row.nickname}`)
    for (const bad of ['', '가'.repeat(21)]) {
      let blockedByApp = false
      try {
        await updateCoupleNickname(A.client as SettingsDb, coupleId, bad)
      } catch {
        blockedByApp = true
      }
      check(blockedByApp, `${[...bad].length}자는 앱 함수가 서버로 보내지 않는다`)
      // 서버 check(couples.nickname 1~20자) - 앱 함수를 건너뛴 직접 UPDATE가 거부된다.
      const direct = await A.client.from('couples').update({ nickname: bad }).eq('id', coupleId).select().maybeSingle()
      check(direct.error?.code === '23514', `${[...bad].length}자 직접 UPDATE -> 서버 check 거부 (code ${direct.error?.code ?? 'null'})`)
    }
    check((await coupleRow())?.nickname === nick, '거부된 시도 뒤에도 닉네임이 그대로다')
    await stepsUnchanged('④')
  })

  // ═══ ⑤ 재검사 ═══════════════════════════════════════════════════════════
  await stage('s5', [], async () => {
    line('═══ ⑤ A가 재검사 (retestPersonality - 앱과 같은 함수) ═══')
    const ppBefore = await ppRow(A.id)
    const asBefore = await assessments(A.id)
    if (!ppBefore || asBefore.length !== 1) {
      check(false, `재검사 전 상태가 맞지 않는다: 프로필 ${ppBefore ? '있음' : '없음'} · assessment ${asBefore.length}행(1행이어야 한다)`)
      return
    }
    check(ppBefore.retest_used === false, '재검사 전 retest_used = false')
    const input = { mbti: 'ENFP' as const, mbtiSelfReported: true, q1: 'C' as const, q2: 'C' as const, q3: 'A' as const, q4: 'C' as const, q5: 'A' as const }
    const result = inferLoveType(input)
    const { assessmentId } = await retestPersonality(A.client as unknown as RetestDb, A.id, { ...input, result }) // 68-: 027 fn_complete_retest 호출 하나
    const asAfter = await assessments(A.id)
    check(asAfter.length === 2 && asAfter[1].seq === 2 && asAfter[1].id === assessmentId, `assessment ${asAfter.length}행, 새 행 seq ${asAfter[1]?.seq ?? '-'}`)
    check(JSON.stringify(asAfter[0]) === JSON.stringify(asBefore[0]), '이전 assessment 행이 JSON 그대로(지워지지도 고쳐지지도 않았다)')
    const ppAfter = await ppRow(A.id)
    check(ppAfter?.active_assessment_id === assessmentId, 'active_assessment_id = 새 행')
    check(ppAfter?.enneagram_override === null, `enneagram_override = null (이전 ${ppBefore.enneagram_override ?? 'null'})`)
    check(ppAfter?.enneagram_inferred === result.enneagramCore && ppAfter?.attachment === result.attachment, `추론 코어 ${result.enneagramCore} · 애착 ${result.attachment} = 새 결과`)
    check(ppAfter?.enneagram_effective === result.enneagramCore, `실효 코어(서버 생성 칸) = 새 추론값 ${ppAfter?.enneagram_effective ?? '-'}`)
    check(ppAfter?.love_type_code === computeLoveTypeCode(result.enneagramCore, result.attachment), `love_type_code = 새 결과 기준: ${ppBefore.love_type_code} -> ${ppAfter?.love_type_code}`)
    check(ppAfter?.retest_used === true, 'retest_used = true')
    const changed = ppAfter ? changedColumns(ppBefore, ppAfter, ['updated_at', 'enneagram_effective']) : ['(읽기 실패)']
    const allowed = ['active_assessment_id', 'enneagram_inferred', 'attachment', 'enneagram_override', 'love_type_code', 'retest_used']
    check(changed.every((c) => allowed.includes(c)), `바뀐 칸은 표 안: [${changed.join(', ')}]`)
    check(ppAfter?.override_count === ppBefore.override_count, 'override_count 그대로(이전 오버라이드 이력 보존)')
    await stepsUnchanged('⑤')
  })

  // ═══ ⑥ 두 번째 재검사 ═══════════════════════════════════════════════════
  await stage('s6', ['s5'], async () => {
    line('═══ ⑥ A가 두 번째 재검사 시도 (화면 판정 canRetest) ═══')
    // 앱 화면과 같은 읽기: A의 사용자 권한으로 프로필을 읽어 `canRetest`에 넘긴다.
    const read = await A.client.from('personality_profiles').select('*').eq('user_id', A.id).maybeSingle()
    check(!read.error && !!read.data, `A가 프로필을 읽었다: ${read.error?.message ?? 'ok'}`)
    if (read.error || !read.data) return
    const countBefore = (await assessments(A.id)).length
    check(canRetest(read.data) === false, '화면 판정 canRetest = false (버튼 비활성) - 서버로 보내지 않는다')
    // 앱 쓰기 함수도 같은 판정으로 서버에 아무것도 보내기 전에 거절한다.
    let kind = ''
    try {
      await retestPersonality(A.client as unknown as RetestDb, A.id, {
        mbti: 'INFJ',
        mbtiSelfReported: true,
        q1: 'A',
        q2: 'A',
        q3: 'A',
        q4: 'A',
        q5: 'A',
        result: inferLoveType({ mbti: 'INFJ', q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A' }),
      })
    } catch (e) {
      kind = e instanceof RetestError ? e.kind : 'other'
    }
    check(kind === 'already-used', `쓰기 함수 거절: ${kind || '(거절 안 됨)'}`)
    check((await assessments(A.id)).length === countBefore, `assessment 행 수 그대로 (${countBefore})`)
    await stepsUnchanged('⑥')
  })

  // ═══ ⑦ B 쪽 영향 없음 ═══════════════════════════════════════════════════
  await stage('s7', [], async () => {
    line('═══ ⑦ 마무리 - B의 프로필 · 성격 데이터는 건드리지 않았다 ═══')
    const bProfile = await profileRow(B.id)
    const bAssess = await assessments(B.id)
    check(!!bProfile && bAssess.length === 1, `B: profiles 있음 · assessment ${bAssess.length}행`)
    await stepsUnchanged('전체')
  })

  line(`\n실패 ${failures}건`)
  await finish()

  async function finish(): Promise<void> {
    await Deno.mkdir('scripts/ops/out', { recursive: true })
    let text = out.join('\n') + '\n'
    for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
    await Deno.writeTextFile('scripts/ops/out/67-settings.txt', text)
    if (failures > 0) Deno.exit(1)
  }
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verify67Settings.ts run')
