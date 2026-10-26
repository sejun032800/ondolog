/**
 * U6 온보딩 2부 + 큐 재개 실증 (`65-` 산출 6, `66-` 결함 수정) - 원격 **개발** DB에서 새 시험 커플 두 계정이 각자 **사용자 권한**으로 앱과 같은 함수를 부른다 (Deno 전용).
 *
 * 흐름(각 단계 뒤 `onboarding_step` · `couples` 값을 출력한다):
 *   0. 새 시험 계정 둘(A · B, 이름에 test)을 만들고 각자 로그인한다(관리자 매직링크 토큰 -> 사용자 세션).
 *   1. 가입: `createProfileAndAssessment`(앱과 같은 함수) -> 진행 단계 0.
 *   2. A14: 최신 검사 읽기 + `personality_profiles` 생성 + 진행 단계 RESULT(1).
 *   3. A16(+ `love_type_code`가 실효 코어로 다시 쓰이는지): `overrideEnneagramCore`(앱과 같은 함수)를 두 번 - `enneagram_inferred` · `enneagram_override` 두 값 모두 보관, 빅5 · 스턴버그 · 애착(assessment) 그대로.
 *   4. A17: A가 초대 코드 발급. 코드를 보여 둔 채 읽기만 하는 확인(`fetchExistingInvite` 쪽)은 아직 pending.
 *   5. A18: B가 **026 RPC(`fn_connect_couple`)를 B의 사용자 세션으로** 부른다(앱 `redeemInviteCode`와 같은 `connectCouple`) -> 연결(active). 자기 코드 22023 · 없는 코드 P0002 · 이미 커플 23505 · 같은 코드 재호출 같은 id.
 *   6. 연결 뒤 양쪽 진행 단계 INVITE(2). A의 대기 확인이 connected를 본다.
 *   7. A19: A가 사귄 날짜 + 닉네임 저장 -> 진행 단계 COMPLETE(3). 입력 규칙(미래 날짜 · 닉네임 0자/21자)은 앱의 순수 함수와 서버 check로 모두 확인.
 *   8. A20: B가 상대(A)가 정한 날짜를 보고 확인 - 다른 날짜를 넣어도 먼저 입력한 값이 그대로, `start_date_confirmed_by`만 기록 -> 진행 단계 3.
 *   9. 재개 경로: 서버 진행 단계에서 `resumePathFor`가 고르는 경로를 단계마다 출력.
 *  10. 큐: **채팅 탭(훅)을 열지 않은 채** 앱 재시작을 흉내 낸다 - 기기 저장 JSON(텍스트 1 · 사진 1)을 새 러너가 읽어 이어 보낸다(`chatQueueHub.attach`가 하는 일).
 *      Storage 객체 1 · 메시지 행 각 1. 앱 복귀(`kick`)를 반복해도 그대로.
 *
 * 앱 코드와의 관계(중요): 가입 · A14 프로필 생성(`ensurePersonalityProfileCore`) · 오버라이드 · 연결(`connectCouple`) · 진행 단계 · 사진 한 번의 시도 · 텍스트 전송 ·
 * 두 큐 러너 · 순수 규칙은 **앱의 실제 코드**를 그대로 부른다. 초대 발급 · 사귄 날짜 저장(`coupleApi.ts`)만 앱 전역 `supabase`(Expo 환경)에 묶여 Deno에서
 * 가져올 수 없어 같은 질의를 이 파일에 옮겨 적었다("미러" 표시). 앱 쪽 질의를 고치면 이 파일도 함께 고쳐야 한다.
 * 단계 규칙(R40-5): 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 SKIP, 진행 단계는 성공을 확인한 뒤에만 올리고, null은 FAIL로 드러낸다. 대체 경로는 없다.
 *
 * service_role은 **계정 만들기 · 로그인 토큰 · 읽어 확인하기**에만 쓴다. 저장 · 전송은 각 계정의 사용자 세션(anon 키 + 로그인)이다.
 * 토큰 · 키 · URL은 출력 · 파일 어디에도 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 * 출력 파일: scripts/ops/out/66-u6-part2.txt
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyU6Part2.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { ONBOARDING_STEP, type OnboardingStepValue } from '../../src/constants/onboardingStep.ts'
import { computeLoveTypeCode, inferLoveType } from '../../src/engine/loveTypeInference.ts'
import type { ChatDb } from '../../src/services/chatCore.ts'
import { sendMessage } from '../../src/services/chatCore.ts'
import { attemptQueuedPhoto, type PhotoFs } from '../../src/services/chatPhotoCore.ts'
import { advanceOnboardingStep } from '../../src/services/onboardingStepCore.ts'
import { ConnectCoupleError, connectCouple, type ConnectDb } from '../../src/services/coupleConnectCore.ts'
import {
  createProfileAndAssessment,
  ensurePersonalityProfileCore,
  overrideEnneagramCore,
  type PersonalityDb,
} from '../../src/services/personalityCore.ts'
import { parseQueuedMessages, type OutgoingMessage, type QueuedMessage } from '../../src/utils/chatQueue.ts'
import { parseQueuedPhotos, type QueuedPhoto } from '../../src/utils/chatPhotoQueue.ts'
import { ChatPhotoQueue } from '../../src/utils/chatPhotoQueueRunner.ts'
import { resolveChatQueueTarget } from '../../src/utils/chatQueueResume.ts'
import { ChatRetryQueue, type AttemptOutcome } from '../../src/utils/chatRetryQueue.ts'
import { isStartDateSelectable, isValidNickname, normalizeNickname } from '../../src/utils/coupleStart.ts'
import { entryStoragePath } from '../../src/utils/dateRecord.ts'
import { resumePathFor } from '../../src/utils/onboardingResume.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function pngBytes(): ArrayBuffer {
  const bin = atob(PNG_BASE64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]
  return code
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

  // ── 새 시험 계정 둘 ─────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  async function newAccount(tag: string): Promise<{ id: string; email: string; client: Db }> {
    const email = `test-66-${tag}-${stamp}@example.com`
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
    if (created.error) throw new Error(`계정 생성 실패: ${created.error.message}`)
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const client: Db = createClient(url, anon as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
    secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
    return { id: created.data.user.id as string, email, client }
  }
  const A = await newAccount('a')
  const B = await newAccount('b')
  line(`[준비] 새 시험 계정 A ${A.email} · B ${B.email} (각자 사용자 세션)`)

  const who = (id: string | null | undefined) => (id === A.id ? 'A' : id === B.id ? 'B' : id ? '?' : '-')
  async function steps(): Promise<{ a: number | null; b: number | null }> {
    const rows = await admin.from('profiles').select('id, onboarding_step').in('id', [A.id, B.id])
    const get = (id: string) => (rows.data ?? []).find((r: { id: string }) => r.id === id)?.onboarding_step ?? null
    return { a: get(A.id), b: get(B.id) }
  }
  async function coupleRow(): Promise<Record<string, unknown> | null> {
    const { data } = await admin
      .from('couples')
      .select('id, status, invite_code, user_a_id, user_b_id, relationship_start_date, start_date_set_by, start_date_confirmed_by, nickname, connected_at')
      .or(`user_a_id.eq.${A.id},user_b_id.eq.${A.id},user_a_id.eq.${B.id},user_b_id.eq.${B.id}`)
      .maybeSingle()
    return data
  }
  async function show(stage: string): Promise<void> {
    const s = await steps()
    const c = await coupleRow()
    const cs = c
      ? `couples: status=${c.status} · user_b=${c.user_b_id ? who(c.user_b_id as string) : '-'} · 날짜=${c.relationship_start_date ?? '-'} · 정한이=${who(c.start_date_set_by as string)} · 확인한이=${who(c.start_date_confirmed_by as string)} · 닉네임=${c.nickname ?? '-'}`
      : 'couples: 행 없음'
    line(`  [${stage}] onboarding_step A=${s.a} B=${s.b} -> 재개 경로 A ${resumePathFor(s.a ?? 0, { connectedWithoutStartDate: !!c && c.status === 'active' && !c.relationship_start_date })} · B ${resumePathFor(s.b ?? 0, { connectedWithoutStartDate: !!c && c.status === 'active' && !c.relationship_start_date })} | ${cs}`)
  }

  // ── 단계 실행기 (R40-5): 앞 단계가 실패하면 그 단계에 기대는 뒤 단계는 멈춘다 ──────────
  // 단계가 실패했다 = 그 단계 안에서 FAIL이 하나라도 났거나 예외가 났다. 진행 단계(onboarding_step)는 각 단계 안에서 **성공 확인 뒤에만** 올린다.
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
  type Core = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  let st = { a: null as number | null, b: null as number | null }
  let code = ''
  let coupleId = ''
  const assessmentBefore: Record<string, Record<string, unknown> | null> = {}

  // 미러: setOrConfirmStartDate - 날짜가 비어 있으면 첫 입력이 확정. 실패는 null(호출한 쪽이 FAIL로 드러낸다).
  async function setOrConfirm(acc: { id: string; client: Db }, date: string): Promise<Record<string, unknown> | null> {
    const cur = await acc.client.from('couples').select('*').eq('id', coupleId).maybeSingle()
    if (cur.error || !cur.data) {
      check(false, `${who(acc.id)} 커플 행을 읽지 못했다: ${cur.error?.message ?? '0행'}`)
      return null
    }
    const first = !cur.data.relationship_start_date
    const patch = first ? { relationship_start_date: date, start_date_set_by: acc.id } : { start_date_confirmed_by: acc.id }
    const r = await acc.client.from('couples').update(patch).eq('id', coupleId).select().maybeSingle()
    if (r.error || !r.data) {
      check(false, `${who(acc.id)} 날짜 ${first ? '저장' : '확인'} 실패: ${r.error?.message ?? '0행'}`)
      return null
    }
    return r.data
  }

  // ═══ 1. 가입 ═══════════════════════════════════════════════════════════
  await stage('s1', [], async () => {
    line('═══ 1. 가입 (createProfileAndAssessment - 앱과 같은 함수) ═══')
    const answers = { q1: 'A', q2: 'B', q3: 'C', q4: 'A', q5: 'B' } as const
    const result = inferLoveType({ mbti: 'INFJ', ...answers })
    for (const [acc, name] of [[A, 'test-66-서영'], [B, 'test-66-세준']] as const) {
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
      check(!!saved && saved.seq === 1, `${who(acc.id)} 가입 저장: assessment seq ${saved?.seq ?? '-'}`)
    }
    await show('가입 직후')
    st = await steps()
    check(st.a === ONBOARDING_STEP.AUTH && st.b === ONBOARDING_STEP.AUTH, `두 계정 진행 단계 0 (A=${st.a}, B=${st.b})`)
  })

  // ═══ 2. A14: 상세 결과 (프로필 행 생성 + 진행 단계 RESULT) ═══════════════
  await stage('s2', ['s1'], async () => {
    line('═══ 2. A14 상세 결과 (ensurePersonalityProfileCore - 앱과 같은 함수, enneagram_effective 없이) ═══')
    for (const acc of [A, B]) {
      const a = await acc.client.from('personality_assessments').select('*').eq('user_id', acc.id).order('seq', { ascending: false }).limit(1).maybeSingle()
      check(!a.error && !!a.data, `${who(acc.id)} 최신 검사 읽기(사용자 권한): 코어 ${a.data?.enneagram_core ?? '-'} · 애착 ${a.data?.attachment ?? '-'}`)
      assessmentBefore[acc.id] = a.data ?? null
      if (!a.data) continue // 검사를 못 읽었으면 이 계정의 프로필 생성 · 진행 단계는 건드리지 않는다
      let made: { created: boolean } | null = null
      try {
        made = await ensurePersonalityProfileCore(acc.client as PersonalityDb, acc.id, a.data)
      } catch (e) {
        const err = e as { code?: string; message?: string }
        line(`  거부됨: ${err.code ?? ''} ${err.message ?? String(e)}`)
      }
      check(!!made, `${who(acc.id)} personality_profiles 생성(앱과 같은 질의)`)
      if (!made) continue // 생성 실패 -> 진행 단계를 올리지 않는다(대체 경로 없음)
      await advanceOnboardingStep(acc.client as never, acc.id, ONBOARDING_STEP.RESULT)
    }
    await show('A14 직후')
    st = await steps()
    check(st.a === ONBOARDING_STEP.RESULT && st.b === ONBOARDING_STEP.RESULT, `두 계정 진행 단계 1 (A=${st.a}, B=${st.b})`)
  })

  // ═══ 3. A16: 코어 오버라이드 + love_type_code 재계산 ════════════════════
  await stage('s3', ['s2'], async () => {
    line('═══ 3. A16 결과와 달라요 (overrideEnneagramCore - 앱과 같은 함수) ═══')
    const ppBefore = (await admin.from('personality_profiles').select('*').eq('user_id', A.id).maybeSingle()).data
    if (!ppBefore) {
      check(false, 'A의 personality_profiles 행을 읽지 못했다')
      return
    }
    const inferred = ppBefore.enneagram_inferred as number
    const core1 = ((inferred % 9) + 1) as Core
    const core2 = ((core1 % 9) + 1) as Core
    line(`  처음 love_type_code=${ppBefore.love_type_code} (코어 ${inferred} · 애착 ${ppBefore.attachment})`)
    const o1 = await overrideEnneagramCore(A.client as PersonalityDb, A.id, core1)
    line(`  1회: inferred=${o1.enneagram_inferred} override=${o1.enneagram_override} effective=${o1.enneagram_effective} count=${o1.override_count} love_type_code=${o1.love_type_code}`)
    check(o1.enneagram_inferred === inferred && o1.enneagram_override === core1 && o1.enneagram_effective === core1, '두 값 모두 보관: 추론값 그대로 + 오버라이드 기록 + effective=override')
    check(o1.love_type_code === computeLoveTypeCode(core1, o1.attachment), `love_type_code가 실효 코어로 다시 쓰였다: ${ppBefore.love_type_code} -> ${o1.love_type_code}`)
    const o2 = await overrideEnneagramCore(A.client as PersonalityDb, A.id, core2)
    line(`  2회: inferred=${o2.enneagram_inferred} override=${o2.enneagram_override} effective=${o2.enneagram_effective} count=${o2.override_count} love_type_code=${o2.love_type_code}`)
    check(o2.enneagram_inferred === inferred && o2.enneagram_override === core2 && o2.override_count === 2, '횟수 제한 없음: 두 번째도 통과, 추론값은 그대로, count 2')
    check(o2.love_type_code === computeLoveTypeCode(core2, o2.attachment), `두 번째도 love_type_code가 따라간다: ${o2.love_type_code}`)
    const assessmentAfter = (await admin.from('personality_assessments').select('*').eq('user_id', A.id).order('seq', { ascending: false }).limit(1).maybeSingle()).data
    check(!!assessmentAfter && JSON.stringify(assessmentAfter) === JSON.stringify(assessmentBefore[A.id]), '빅5 · 스턴버그 · 애착(personality_assessments) 전후 같음 (행 전체 JSON 비교)')
    const ppAfter = (await admin.from('personality_profiles').select('*').eq('user_id', A.id).maybeSingle()).data
    check(!!ppAfter && ppAfter.attachment === ppBefore.attachment, '애착은 그대로(코어만 바뀐다)')
    line(`  참고: 이 시험의 추론 코어는 ${inferred}라 오버라이드는 ${core1} -> ${core2}다. (추론 7 · 애착 같음 -> 오버라이드 9에서 RHF -> LLF는 단위 시험이 확인한다)`)
    await show('A16 직후')
  })

  // ═══ 4. A17: A가 초대 코드 발급 ═════════════════════════════════════════
  await stage('s4', ['s1'], async () => {
    line('═══ 4. A17 연인 초대 (미러: coupleApi.getOrCreateInvite) ═══')
    const noneYet = await A.client.from('couples').select('id').or(`user_a_id.eq.${A.id},user_b_id.eq.${A.id}`).in('status', ['pending', 'active']).maybeSingle()
    check(!noneYet.error && noneYet.data === null, '열기만 해서는 커플 행이 없다(읽기 전용 확인 = fetchExistingInvite)')
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const c = generateInviteCode()
      const ins = await A.client.from('couples').insert({ user_a_id: A.id, invite_code: c }).select().maybeSingle()
      if (!ins.error && ins.data) code = ins.data.invite_code
      else if (ins.error && ins.error.code !== '23505') {
        check(false, `코드 발급 실패: ${ins.error.message}`)
        return
      }
    }
    check(code.length === 6, `A가 [초대 코드 만들기] -> pending 행 + 코드 ${code || '-'}`)
    if (code.length !== 6) return
    await show('A17 발급 직후')
    const waiting = await A.client.from('couples').select('status').or(`user_a_id.eq.${A.id},user_b_id.eq.${A.id}`).in('status', ['pending', 'active']).maybeSingle()
    check(waiting.data?.status === 'pending', 'A의 대기 확인(4초 폴링과 같은 읽기): 아직 pending')
  })

  async function redeem(acc: { id: string; client: Db }, c: string): Promise<{ id: string | null; kind: string | null; code: string | null }> {
    try {
      return { id: await connectCouple(acc.client as ConnectDb, c), kind: null, code: null }
    } catch (e) {
      if (e instanceof ConnectCoupleError) return { id: null, kind: e.kind, code: e.code }
      throw e
    }
  }

  // ═══ 5. A18: B가 코드 입력 (026 RPC, B의 사용자 세션) ═════════════════════
  await stage('s5', ['s4'], async () => {
    line('═══ 5. A18 초대 코드 입력 (connectCouple = redeemInviteCode가 부르는 함수, 사용자 세션) ═══')
    const own = await redeem(A, code)
    check(own.kind === 'own' && own.code === '22023', `자기 코드 -> 22023 own (${own.code ?? own.id})`)
    const bogus = await redeem(B, 'ZZZZZZ')
    check(bogus.kind === 'invalid' && bogus.code === 'P0002', `없는 코드 -> P0002 invalid (${bogus.code ?? bogus.id})`)
    const stillPending = await coupleRow()
    check(stillPending?.status === 'pending', '무효 시도 뒤에도 여전히 pending')
    const ok = await redeem(B, code)
    check(!!ok.id, `B가 코드 입력 -> 연결 (id ${ok.id ?? '-'}, 오류 ${ok.code ?? '-'})`)
    if (!ok.id) return // 연결 실패 -> 이 단계에 기대는 뒤 단계는 멈춘다
    coupleId = ok.id
    const afterConnect = await coupleRow()
    check(afterConnect?.status === 'active' && afterConnect?.user_b_id === B.id && !!afterConnect?.connected_at && afterConnect?.id === coupleId, 'couples: active · user_b=B · connected_at 있음 · 함수가 돌려준 id와 같다')
    const again = await redeem(B, code)
    check(again.id === coupleId, `같은 사람이 같은 코드를 다시 넣으면 같은 id(멱등): ${again.id ?? again.code}`)
    await show('A18 연결 직후')
  })

  // ═══ 5-C. 이미 커플인 B가 다른 사람의 코드를 쓰면 23505 ═══════════════════════
  // 하위 확인: 실패는 세지만(FAIL) 6~9단계는 막지 않는다 - 그 단계들은 s5(B 연결 성공)에만 기댄다. 이 단계는 s6~s9의 needs에 없다.
  await stage('s5c', ['s5'], async () => {
    line('═══ 5-C. 이미 커플인 B가 다른 코드 -> 23505 (하위 확인) ═══')
    const C = await newAccount('c')
    // C도 앱 가입 경로(createProfileAndAssessment)로 프로필을 만든 뒤 초대 코드를 발급한다.
    const answers = { q1: 'A', q2: 'B', q3: 'C', q4: 'A', q5: 'B' } as const
    const saved = await createProfileAndAssessment(C.client as PersonalityDb, {
      userId: C.id,
      name: 'test-66-세번째',
      gender: 'male',
      birthDate: '2000-01-01',
      mbti: 'INFJ',
      mbtiSelfReported: true,
      ...answers,
      result: inferLoveType({ mbti: 'INFJ', ...answers }),
      marketingAgreed: false,
    })
    check(!!saved && saved.seq === 1, `C 가입 저장: assessment seq ${saved?.seq ?? '-'}`)
    let codeC = ''
    for (let attempt = 0; attempt < 5 && !codeC; attempt++) {
      const ins = await C.client.from('couples').insert({ user_a_id: C.id, invite_code: generateInviteCode() }).select().maybeSingle()
      if (!ins.error && ins.data) codeC = ins.data.invite_code
      else if (ins.error?.code === '23505') line(`  C 코드 발급 재시도(코드 충돌) ${attempt + 1}`)
      else {
        // 원인을 남긴다. 출력은 line()을 거쳐 기존 가림 목록(secrets)을 지난다.
        line(`  C 초대 코드 발급 오류: code=${ins.error?.code ?? '-'} message=${ins.error?.message ?? '0행(오류 없이 행이 안 돌아옴)'}`)
        break
      }
    }
    if (!codeC) {
      check(false, '시험 계정 C의 초대 코드를 만들지 못했다 - 23505 확인 불가')
      return
    }
    const taken = await redeem(B, codeC)
    check(taken.kind === 'already' && taken.code === '23505', `이미 커플인 B가 다른 코드 -> 23505 already (${taken.code ?? taken.id})`)
  })

  // ═══ 6. 연결 뒤 양쪽 진행 단계 INVITE ═════════════════════════════════════
  await stage('s6', ['s5'], async () => {
    line('═══ 6. 연결 확인 -> 진행 단계 INVITE ═══')
    const seenByA = await A.client.from('couples').select('status').or(`user_a_id.eq.${A.id},user_b_id.eq.${A.id}`).in('status', ['pending', 'active']).maybeSingle()
    check(seenByA.data?.status === 'active', 'A의 대기 확인이 connected를 본다(상대가 입력한 것을 안다)')
    if (seenByA.data?.status !== 'active') return // 연결이 보이지 않으면 진행 단계를 올리지 않는다
    await advanceOnboardingStep(A.client as never, A.id, ONBOARDING_STEP.INVITE)
    await advanceOnboardingStep(B.client as never, B.id, ONBOARDING_STEP.INVITE)
    await show('연결 확인 뒤')
    st = await steps()
    check(st.a === ONBOARDING_STEP.INVITE && st.b === ONBOARDING_STEP.INVITE, `두 계정 진행 단계 2 (A=${st.a}, B=${st.b})`)
    const partnerName = await B.client.from('profiles').select('display_name').eq('id', A.id).maybeSingle()
    check(partnerName.data?.display_name === 'test-66-서영', 'B가 상대 이름을 읽는다(A19 "…과 연결됐어요"): 사용자 권한')
  })

  // ═══ 7. A19: A가 날짜 + 닉네임 ═════════════════════════════════════════
  await stage('s7', ['s6'], async () => {
    line('═══ 7. A19 사귄 날짜 + 커플 닉네임 (미러: coupleApi.saveStartDateAndNickname) ═══')
    const now = new Date()
    const kstTomorrow = new Date(now.getTime() + 9 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10)
    check(!isStartDateSelectable(kstTomorrow, now) && isStartDateSelectable('2025-12-27', now), `앱 규칙: 내일(KST ${kstTomorrow})은 고를 수 없고 2025-12-27은 고를 수 있다`)
    check(!isValidNickname('') && !isValidNickname('가'.repeat(21)) && isValidNickname('가') && isValidNickname('가'.repeat(20)), '앱 규칙: 닉네임 0자 · 21자 거부, 1자 · 20자 허용')
    const bad21 = await A.client.from('couples').update({ nickname: '가'.repeat(21) }).eq('id', coupleId).select().maybeSingle()
    check(!!bad21.error, `서버 check: 닉네임 21자 거부 (${bad21.error?.code ?? '오류 없음'})`)
    const bad0 = await A.client.from('couples').update({ nickname: '' }).eq('id', coupleId).select().maybeSingle()
    check(!!bad0.error, `서버 check: 닉네임 0자 거부 (${bad0.error?.code ?? '오류 없음'})`)

    const savedA = await setOrConfirm(A, '2025-12-27')
    let withNick = savedA
    if (savedA && savedA.start_date_set_by === A.id) {
      const n = await A.client.from('couples').update({ nickname: normalizeNickname('test-늘봄') }).eq('id', coupleId).select().maybeSingle()
      if (n.error || !n.data) {
        check(false, `닉네임 저장 실패: ${n.error?.message ?? '0행'}`)
        return
      }
      withNick = n.data
    }
    const saveOk = !!withNick && withNick.relationship_start_date === '2025-12-27' && withNick.start_date_set_by === A.id && withNick.nickname === 'test-늘봄'
    check(saveOk, 'A가 날짜 + 닉네임 저장: 날짜 확정, 정한이 A, 닉네임 저장')
    if (!saveOk) return // 저장이 확인되지 않으면 진행 단계를 올리지 않는다
    await advanceOnboardingStep(A.client as never, A.id, ONBOARDING_STEP.COMPLETE)
    await show('A19 직후')
  })

  // ═══ 8. A20: B가 확인 ═══════════════════════════════════════════════════
  await stage('s8', ['s7'], async () => {
    line('═══ 8. A20 상대가 정한 날짜 확인 (미러: coupleApi.setOrConfirmStartDate) ═══')
    const seenByB = await B.client.from('couples').select('relationship_start_date, start_date_set_by, nickname').eq('id', coupleId).maybeSingle()
    const seen = seenByB.data
    check(!!seen && seen.start_date_set_by === A.id && seen.relationship_start_date === '2025-12-27', `B가 열면 A20: 상대가 정한 날짜 ${seen?.relationship_start_date ?? '-'} · 닉네임 ${seen?.nickname ?? '-'}`)
    if (!seen) return
    const confirmed = await setOrConfirm(B, '2024-01-01') // 다른 날짜를 넣어도 먼저 입력한 값이 적용된다
    const confirmOk = !!confirmed && confirmed.relationship_start_date === '2025-12-27' && confirmed.start_date_set_by === A.id && confirmed.start_date_confirmed_by === B.id
    check(confirmOk, 'B의 [확인했어요]: 날짜는 먼저 입력한 값 그대로, 확인한이 B만 기록')
    if (!confirmOk) return
    await advanceOnboardingStep(B.client as never, B.id, ONBOARDING_STEP.COMPLETE)
    await show('A20 직후')
    st = await steps()
    check(st.a === ONBOARDING_STEP.COMPLETE && st.b === ONBOARDING_STEP.COMPLETE, `두 계정 진행 단계 3 (A=${st.a}, B=${st.b})`)
    await advanceOnboardingStep(A.client as never, A.id, ONBOARDING_STEP.INVITE as OnboardingStepValue)
    st = await steps()
    check(st.a === ONBOARDING_STEP.COMPLETE, `진행 단계는 되돌아가지 않는다 (3에서 2로 써도 ${st.a})`)
  })

  // ═══ 9. 큐 - 채팅 탭을 열지 않은 채 앱 재시작 ════════════════════════════
  await stage('s9', ['s5'], async () => {
  line('═══ 9. 큐 재개 (채팅 탭 훅 없음 - chatQueueHub.attach가 하는 일을 새 러너로 흉내) ═══')
  const target = resolveChatQueueTarget({ userId: A.id, coupleStatus: 'connected', coupleId })
  check(target?.coupleId === coupleId && target?.userId === A.id, '로그인 + 커플 연결 -> 큐를 돌릴 대상이 정해진다')
  check(resolveChatQueueTarget({ userId: null, coupleStatus: 'connected', coupleId }) === null, '로그아웃이면 대상 없음(돌지 않는다)')
  check(resolveChatQueueTarget({ userId: A.id, coupleStatus: 'disconnected', coupleId: null }) === null, '커플이 아니면 대상 없음(돌지 않는다)')

  const files = new Map<string, ArrayBuffer>()
  const fs: PhotoFs = {
    copyIn: (_s, id, ext) => {
      const uri = `mem://${id}.${ext}`
      files.set(uri, pngBytes())
      return Promise.resolve(uri)
    },
    exists: (uri) => files.has(uri),
    readBytes: (uri) => Promise.resolve(files.get(uri) as ArrayBuffer),
    remove: (uri) => {
      files.delete(uri)
    },
  }

  // 앱이 꺼지기 전 기기에 남은 것 - 저장 JSON(텍스트 1 · 사진 1). 보내진 적이 없다.
  const textId = crypto.randomUUID()
  const photoId = crypto.randomUUID()
  const photoUri = `mem://${photoId}.png`
  files.set(photoUri, pngBytes())
  const storedText = JSON.stringify([
    { clientMsgId: textId, coupleId, senderId: A.id, body: 'test-66 남은 글', sentAt: new Date().toISOString(), retryCount: 0, status: 'pending' },
  ] satisfies QueuedMessage[])
  const storedPhoto = JSON.stringify([
    { clientId: photoId, kind: 'message', coupleId, userId: A.id, localUri: photoUri, ext: 'png', contentType: 'image/png', sentAt: new Date().toISOString(), retryCount: 0, status: 'pending' },
  ] satisfies QueuedPhoto[])
  async function countObjects(): Promise<number> {
    const listing = await admin.storage.from('messages').list(coupleId, { search: photoId })
    return (listing.data ?? []).filter((o: { name: string }) => o.name === `${photoId}.png`).length
  }
  async function countRows(match: { client_msg_id: string }): Promise<number> {
    const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('client_msg_id', match.client_msg_id)
    return count ?? 0
  }
  check((await countObjects()) === 0 && (await countRows({ client_msg_id: textId })) === 0 && (await countRows({ client_msg_id: photoId })) === 0, '재시작 전: 서버에 객체 0 · 행 0 (아직 아무것도 안 갔다)')

  // 앱 재시작: 새 러너가 기기 저장 JSON을 읽어 이어 보낸다. 채팅 탭은 열지 않았다.
  let textLeft: QueuedMessage[] = parseQueuedMessages(storedText)
  let photoLeft: QueuedPhoto[] = parseQueuedPhotos(storedPhoto)
  const textQueue = new ChatRetryQueue(
    {
      attemptSend: async (item: OutgoingMessage): Promise<AttemptOutcome> => {
        const r = await sendMessage(A.client as ChatDb, { clientMsgId: item.clientMsgId, coupleId: item.coupleId, senderId: item.senderId, body: item.body })
        if (r.status === 'failed') return { outcome: 'failed', errorClass: r.errorClass }
        return { outcome: r.status }
      },
      onQueueChange: (q) => {
        textLeft = q
      },
    },
    parseQueuedMessages(storedText),
  )
  const photoQueue = new ChatPhotoQueue({
    attempt: (it) => attemptQueuedPhoto(A.client as ChatDb, it, fs),
    onChange: (q) => {
      photoLeft = q
    },
    discard: (it) => fs.remove(it.localUri),
  })
  photoQueue.hydrate(parseQueuedPhotos(storedPhoto))
  // 앱 복귀 신호를 반복해도 같은 항목은 겹쳐 올라가지 않는다.
  for (let i = 0; i < 3; i++) {
    textQueue.kick()
    photoQueue.kick()
  }
  for (let i = 0; i < 100 && (textQueue.getQueue().length > 0 || photoQueue.getQueue().length > 0); i++) await sleep(100)
  textQueue.dispose()
  photoQueue.dispose()
  const objs = await countObjects()
  const textRows = await countRows({ client_msg_id: textId })
  const photoRows = await countRows({ client_msg_id: photoId })
  check(textLeft.length === 0 && photoLeft.length === 0, `큐가 비었다: 텍스트 ${textLeft.length} · 사진 ${photoLeft.length}`)
  check(objs === 1 && photoRows === 1, `사진: Storage 객체 ${objs} · 메시지 행 ${photoRows}`)
  check(textRows === 1, `글: 메시지 행 ${textRows}`)
  check(!files.has(photoUri), '사진 복사본이 지워졌다')
  // 앱 복귀를 한 번 더 - 이미 갔으므로 아무것도 늘지 않는다(새 러너에 같은 JSON을 다시 먹여도 멱등).
  const textQueue2 = new ChatRetryQueue(
    {
      attemptSend: async (item: OutgoingMessage): Promise<AttemptOutcome> => {
        const r = await sendMessage(A.client as ChatDb, { clientMsgId: item.clientMsgId, coupleId: item.coupleId, senderId: item.senderId, body: item.body })
        if (r.status === 'failed') return { outcome: 'failed', errorClass: r.errorClass }
        return { outcome: r.status }
      },
      onQueueChange: () => {},
    },
    parseQueuedMessages(storedText),
  )
  files.set(photoUri, pngBytes())
  const photoQueue2 = new ChatPhotoQueue({ attempt: (it) => attemptQueuedPhoto(A.client as ChatDb, it, fs), onChange: () => {}, discard: (it) => fs.remove(it.localUri) })
  photoQueue2.hydrate(parseQueuedPhotos(storedPhoto))
  await sleep(2500)
  textQueue2.dispose()
  photoQueue2.dispose()
  check((await countObjects()) === 1 && (await countRows({ client_msg_id: textId })) === 1 && (await countRows({ client_msg_id: photoId })) === 1, '같은 저장 JSON으로 한 번 더 재개해도 객체 1 · 행 각 1 (중복 없음)')

  })

  line(`\n실패 ${failures}건`)
  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/66-u6-part2.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyU6Part2.ts run')
