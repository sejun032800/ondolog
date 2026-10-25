/**
 * U6 온보딩 2부 + 큐 재개 실증 (`65-` 산출 6) - 원격 **개발** DB에서 새 시험 커플 두 계정이 각자 **사용자 권한**으로 앱과 같은 함수를 부른다 (Deno 전용).
 *
 * 흐름(각 단계 뒤 `onboarding_step` · `couples` 값을 출력한다):
 *   0. 새 시험 계정 둘(A · B, 이름에 test)을 만들고 각자 로그인한다(관리자 매직링크 토큰 -> 사용자 세션).
 *   1. 가입: `createProfileAndAssessment`(앱과 같은 함수) -> 진행 단계 0.
 *   2. A14: 최신 검사 읽기 + `personality_profiles` 생성 + 진행 단계 RESULT(1).
 *   3. A16: `overrideEnneagramCore`(앱과 같은 함수)를 두 번 - `enneagram_inferred` · `enneagram_override` 두 값 모두 보관, 빅5 · 스턴버그 · 애착(assessment) 그대로.
 *   4. A17: A가 초대 코드 발급. 코드를 보여 둔 채 읽기만 하는 확인(`fetchExistingInvite` 쪽)은 아직 pending.
 *   5. A18: B가 코드 입력 -> 연결(active). 무효 경우(자기 코드 · 이미 연결된 코드 · 없는 코드)는 연결되지 않는다.
 *   6. 연결 뒤 양쪽 진행 단계 INVITE(2). A의 대기 확인이 connected를 본다.
 *   7. A19: A가 사귄 날짜 + 닉네임 저장 -> 진행 단계 COMPLETE(3). 입력 규칙(미래 날짜 · 닉네임 0자/21자)은 앱의 순수 함수와 서버 check로 모두 확인.
 *   8. A20: B가 상대(A)가 정한 날짜를 보고 확인 - 다른 날짜를 넣어도 먼저 입력한 값이 그대로, `start_date_confirmed_by`만 기록 -> 진행 단계 3.
 *   9. 재개 경로: 서버 진행 단계에서 `resumePathFor`가 고르는 경로를 단계마다 출력.
 *  10. 큐: **채팅 탭(훅)을 열지 않은 채** 앱 재시작을 흉내 낸다 - 기기 저장 JSON(텍스트 1 · 사진 1)을 새 러너가 읽어 이어 보낸다(`chatQueueHub.attach`가 하는 일).
 *      Storage 객체 1 · 메시지 행 각 1. 앱 복귀(`kick`)를 반복해도 그대로.
 *
 * 앱 코드와의 관계(중요): 가입 · 오버라이드 · 진행 단계 · 사진 한 번의 시도 · 텍스트 전송 · 두 큐 러너 · 순수 규칙은 **앱의 실제 코드**를 그대로 부른다.
 * `coupleApi.ts`(초대 발급 · 코드 입력 · 사귄 날짜 저장)와 `personalityApi.ensurePersonalityProfile`는 앱 전역 `supabase`(Expo 환경)에 묶여 있어 Deno에서
 * 가져올 수 없다 - 그 부분은 같은 질의를 이 파일에 **그대로 옮겨 적었다**(아래 "미러" 표시). 앱 쪽 질의를 고치면 이 파일도 함께 고쳐야 한다.
 * (알맹이를 `db` 인자를 받는 모듈로 빼면 미러가 필요 없다 - 앱 코드 변경이라 이번에는 하지 않았다.)
 *
 * service_role은 **계정 만들기 · 로그인 토큰 · 읽어 확인하기**에만 쓴다. 저장 · 전송은 각 계정의 사용자 세션(anon 키 + 로그인)이다.
 * 토큰 · 키 · URL은 출력 · 파일 어디에도 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 * 출력 파일: scripts/ops/out/65-u6-part2.txt
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
import {
  createProfileAndAssessment,
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
    const email = `test-65-${tag}-${stamp}@example.com`
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

  // ═══ 1. 가입 ═══════════════════════════════════════════════════════════
  line('═══ 1. 가입 (createProfileAndAssessment - 앱과 같은 함수) ═══')
  const answers = { q1: 'A', q2: 'B', q3: 'C', q4: 'A', q5: 'B' } as const
  const result = inferLoveType({ mbti: 'INFJ', ...answers })
  for (const [acc, name] of [[A, 'test-65-서영'], [B, 'test-65-세준']] as const) {
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
    check(!!saved && saved.seq === 1, `${who(acc.id)} 가입 저장: assessment seq ${saved?.seq}`)
  }
  await show('가입 직후')
  let st = await steps()
  check(st.a === ONBOARDING_STEP.AUTH && st.b === ONBOARDING_STEP.AUTH, `두 계정 진행 단계 0 (A=${st.a}, B=${st.b})`)

  // ═══ 2. A14: 상세 결과 (프로필 행 생성 + 진행 단계 RESULT) ═══════════════
  line('═══ 2. A14 상세 결과 ═══')
  const assessmentBefore: Record<string, Record<string, unknown>> = {}
  for (const acc of [A, B]) {
    const a = await acc.client.from('personality_assessments').select('*').eq('user_id', acc.id).order('seq', { ascending: false }).limit(1).maybeSingle()
    check(!a.error && !!a.data, `${who(acc.id)} 최신 검사 읽기(사용자 권한): 코어 ${a.data?.enneagram_core} · 애착 ${a.data?.attachment}`)
    assessmentBefore[acc.id] = a.data
    // 미러: personalityApi.ensurePersonalityProfile (이미 있으면 그대로, 없으면 insert 뒤 진행 단계 RESULT)
    const existing = await acc.client.from('personality_profiles').select('*').eq('user_id', acc.id).maybeSingle()
    if (!existing.data) {
      const base = {
        user_id: acc.id,
        active_assessment_id: a.data.id,
        enneagram_inferred: a.data.enneagram_core,
        attachment: a.data.attachment,
        love_type_code: computeLoveTypeCode(a.data.enneagram_core, a.data.attachment),
      }
      // 앱의 `ensurePersonalityProfile`과 같은 질의(enneagram_effective를 함께 넣는다). effective는 서버가 계산하는 생성 칸이라 거부될 수 있다 -
      // 그러면 FAIL로 드러내고(앱 코드 쪽 문제), 뒤 단계가 이어지도록 effective 없이 다시 넣는다.
      const appForm = await acc.client.from('personality_profiles').insert({ ...base, enneagram_effective: a.data.enneagram_core })
      check(!appForm.error, `${who(acc.id)} personality_profiles 생성(앱과 같은 질의, effective 포함)${appForm.error ? ' - 거부됨: ' + (appForm.error.code ?? '') + ' ' + appForm.error.message : ''}`)
      if (appForm.error) {
        const fallback = await acc.client.from('personality_profiles').insert(base)
        check(!fallback.error, `${who(acc.id)} personality_profiles 생성(effective 제외, 뒤 단계를 잇기 위한 대체)${fallback.error ? ' ' + fallback.error.message : ''}`)
      }
    }
    await advanceOnboardingStep(acc.client as never, acc.id, ONBOARDING_STEP.RESULT)
  }
  await show('A14 직후')
  st = await steps()
  check(st.a === ONBOARDING_STEP.RESULT && st.b === ONBOARDING_STEP.RESULT, `두 계정 진행 단계 1 (A=${st.a}, B=${st.b})`)

  // ═══ 3. A16: 코어 오버라이드 ═══════════════════════════════════════════
  line('═══ 3. A16 결과와 달라요 (overrideEnneagramCore - 앱과 같은 함수) ═══')
  const ppBefore = (await admin.from('personality_profiles').select('*').eq('user_id', A.id).single()).data
  const inferred = ppBefore.enneagram_inferred as number
  const core1 = ((inferred % 9) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  const core2 = ((core1 % 9) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  const o1 = await overrideEnneagramCore(A.client as PersonalityDb, A.id, core1)
  line(`  1회: inferred=${o1.enneagram_inferred} override=${o1.enneagram_override} effective=${o1.enneagram_effective} count=${o1.override_count}`)
  check(o1.enneagram_inferred === inferred && o1.enneagram_override === core1 && o1.enneagram_effective === core1, '두 값 모두 보관: 추론값 그대로 + 오버라이드 기록 + effective=override')
  const o2 = await overrideEnneagramCore(A.client as PersonalityDb, A.id, core2)
  line(`  2회: inferred=${o2.enneagram_inferred} override=${o2.enneagram_override} effective=${o2.enneagram_effective} count=${o2.override_count}`)
  check(o2.enneagram_inferred === inferred && o2.enneagram_override === core2 && o2.override_count === 2, '횟수 제한 없음: 두 번째도 통과, 추론값은 그대로, count 2')
  const assessmentAfter = (await admin.from('personality_assessments').select('*').eq('user_id', A.id).order('seq', { ascending: false }).limit(1).single()).data
  check(JSON.stringify(assessmentAfter) === JSON.stringify(assessmentBefore[A.id]), '빅5 · 스턴버그 · 애착(personality_assessments) 전후 같음 (행 전체 JSON 비교)')
  const ppAfter = (await admin.from('personality_profiles').select('*').eq('user_id', A.id).single()).data
  line(`  참고: love_type_code ${ppBefore.love_type_code} -> ${ppAfter.love_type_code} (004 주석은 "코어 변경 시 애플리케이션이 재계산"이라 적었으나 65-는 코어만 바꾼다), attachment ${ppBefore.attachment} -> ${ppAfter.attachment}`)
  check(ppAfter.attachment === ppBefore.attachment, '애착은 그대로(코어만 바뀐다)')
  await show('A16 직후')

  // ═══ 4. A17: A가 초대 코드 발급 ═════════════════════════════════════════
  line('═══ 4. A17 연인 초대 (미러: coupleApi.getOrCreateInvite) ═══')
  const noneYet = await A.client.from('couples').select('id').or(`user_a_id.eq.${A.id},user_b_id.eq.${A.id}`).in('status', ['pending', 'active']).maybeSingle()
  check(!noneYet.error && noneYet.data === null, '열기만 해서는 커플 행이 없다(읽기 전용 확인 = fetchExistingInvite)')
  let code = ''
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const c = generateInviteCode()
    const ins = await A.client.from('couples').insert({ user_a_id: A.id, invite_code: c }).select().single()
    if (!ins.error) code = ins.data.invite_code
    else if (ins.error.code !== '23505') throw new Error(`코드 발급 실패: ${ins.error.message}`)
  }
  check(code.length === 6, `A가 [초대 코드 만들기] -> pending 행 + 코드 ${code}`)
  await show('A17 발급 직후')
  const waiting = await A.client.from('couples').select('status').or(`user_a_id.eq.${A.id},user_b_id.eq.${A.id}`).in('status', ['pending', 'active']).maybeSingle()
  check(waiting.data?.status === 'pending', 'A의 대기 확인(4초 폴링과 같은 읽기): 아직 pending')

  // ═══ 5. A18: B가 코드 입력 ═════════════════════════════════════════════
  line('═══ 5. A18 초대 코드 입력 (미러: coupleApi.redeemInviteCode) ═══')
  async function redeem(acc: { id: string; client: Db }, c: string): Promise<{ error: { code?: string; message: string } | null; data: Record<string, unknown> | null }> {
    return await acc.client
      .from('couples')
      .update({ user_b_id: acc.id, status: 'active', connected_at: new Date().toISOString() })
      .eq('invite_code', c.toUpperCase())
      .eq('status', 'pending')
      .is('user_b_id', null)
      .neq('user_a_id', acc.id)
      .select()
      .maybeSingle()
  }
  const own = await redeem(A, code)
  check(!own.error && own.data === null, '자기 코드는 무효(연결되지 않음)')
  const bogus = await redeem(B, 'ZZZZZZ')
  check(!bogus.error && bogus.data === null, '없는 코드는 무효')
  let afterOwn = await coupleRow()
  check(afterOwn?.status === 'pending', '무효 시도 뒤에도 여전히 pending')
  const ok = await redeem(B, code)
  check(!ok.error && !!ok.data && ok.data.status === 'active', `B가 코드 입력 -> 연결(active)${ok.error ? ' 오류 ' + ok.error.message : ''}`)
  const again = await redeem(B, code)
  check(!again.error && again.data === null, '이미 연결된 코드는 무효')
  await show('A18 연결 직후')

  // ═══ 6. 연결 뒤 양쪽 진행 단계 INVITE ═════════════════════════════════════
  line('═══ 6. 연결 확인 -> 진행 단계 INVITE ═══')
  const seenByA = await A.client.from('couples').select('status').or(`user_a_id.eq.${A.id},user_b_id.eq.${A.id}`).in('status', ['pending', 'active']).maybeSingle()
  check(seenByA.data?.status === 'active', 'A의 대기 확인이 connected를 본다(상대가 입력한 것을 안다)')
  await advanceOnboardingStep(A.client as never, A.id, ONBOARDING_STEP.INVITE)
  await advanceOnboardingStep(B.client as never, B.id, ONBOARDING_STEP.INVITE)
  await show('연결 확인 뒤')
  st = await steps()
  check(st.a === ONBOARDING_STEP.INVITE && st.b === ONBOARDING_STEP.INVITE, `두 계정 진행 단계 2 (A=${st.a}, B=${st.b})`)
  const partnerName = await B.client.from('profiles').select('display_name').eq('id', A.id).maybeSingle()
  check(partnerName.data?.display_name === 'test-65-서영', 'B가 상대 이름을 읽는다(A19 "…과 연결됐어요"): 사용자 권한')

  // ═══ 7. A19: A가 날짜 + 닉네임 ═════════════════════════════════════════
  line('═══ 7. A19 사귄 날짜 + 커플 닉네임 (미러: coupleApi.saveStartDateAndNickname) ═══')
  const now = new Date()
  const kstTomorrow = new Date(now.getTime() + 9 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10)
  check(!isStartDateSelectable(kstTomorrow, now) && isStartDateSelectable('2025-12-27', now), `앱 규칙: 내일(KST ${kstTomorrow})은 고를 수 없고 2025-12-27은 고를 수 있다`)
  check(!isValidNickname('') && !isValidNickname('가'.repeat(21)) && isValidNickname('가') && isValidNickname('가'.repeat(20)), '앱 규칙: 닉네임 0자 · 21자 거부, 1자 · 20자 허용')
  const bad21 = await A.client.from('couples').update({ nickname: '가'.repeat(21) }).eq('id', afterOwn?.id).select().maybeSingle()
  check(!!bad21.error, `서버 check: 닉네임 21자 거부 (${bad21.error?.code ?? '오류 없음'})`)
  const bad0 = await A.client.from('couples').update({ nickname: '' }).eq('id', afterOwn?.id).select().maybeSingle()
  check(!!bad0.error, `서버 check: 닉네임 0자 거부 (${bad0.error?.code ?? '오류 없음'})`)

  const coupleId = (await coupleRow())?.id as string
  // 미러: setOrConfirmStartDate - 날짜가 비어 있으면 첫 입력이 확정
  async function setOrConfirm(acc: { id: string; client: Db }, date: string): Promise<Record<string, unknown>> {
    const cur = await acc.client.from('couples').select('*').eq('id', coupleId).single()
    if (!cur.data.relationship_start_date) {
      const r = await acc.client.from('couples').update({ relationship_start_date: date, start_date_set_by: acc.id }).eq('id', coupleId).select().single()
      if (r.error) throw new Error(`날짜 저장 실패: ${r.error.message}`)
      return r.data
    }
    const r = await acc.client.from('couples').update({ start_date_confirmed_by: acc.id }).eq('id', coupleId).select().single()
    if (r.error) throw new Error(`날짜 확인 실패: ${r.error.message}`)
    return r.data
  }
  const savedA = await setOrConfirm(A, '2025-12-27')
  let withNick = savedA
  if (savedA.start_date_set_by === A.id) {
    const n = await A.client.from('couples').update({ nickname: normalizeNickname('test-늘봄') }).eq('id', coupleId).select().single()
    if (n.error) throw new Error(`닉네임 저장 실패: ${n.error.message}`)
    withNick = n.data
  }
  check(withNick.relationship_start_date === '2025-12-27' && withNick.start_date_set_by === A.id && withNick.nickname === 'test-늘봄', 'A가 날짜 + 닉네임 저장: 날짜 확정, 정한이 A, 닉네임 저장')
  await advanceOnboardingStep(A.client as never, A.id, ONBOARDING_STEP.COMPLETE)
  await show('A19 직후')

  // ═══ 8. A20: B가 확인 ═══════════════════════════════════════════════════
  line('═══ 8. A20 상대가 정한 날짜 확인 (미러: coupleApi.setOrConfirmStartDate) ═══')
  const seenByB = await B.client.from('couples').select('relationship_start_date, start_date_set_by, nickname').eq('id', coupleId).single()
  check(seenByB.data.start_date_set_by === A.id && seenByB.data.relationship_start_date === '2025-12-27', `B가 열면 A20: 상대가 정한 날짜 ${seenByB.data.relationship_start_date} · 닉네임 ${seenByB.data.nickname}`)
  const confirmed = await setOrConfirm(B, '2024-01-01') // 다른 날짜를 넣어도 먼저 입력한 값이 적용된다
  check(confirmed.relationship_start_date === '2025-12-27' && confirmed.start_date_set_by === A.id && confirmed.start_date_confirmed_by === B.id, 'B의 [확인했어요]: 날짜는 먼저 입력한 값 그대로, 확인한이 B만 기록')
  await advanceOnboardingStep(B.client as never, B.id, ONBOARDING_STEP.COMPLETE)
  await show('A20 직후')
  st = await steps()
  check(st.a === ONBOARDING_STEP.COMPLETE && st.b === ONBOARDING_STEP.COMPLETE, `두 계정 진행 단계 3 (A=${st.a}, B=${st.b})`)
  await advanceOnboardingStep(A.client as never, A.id, ONBOARDING_STEP.INVITE as OnboardingStepValue)
  st = await steps()
  check(st.a === ONBOARDING_STEP.COMPLETE, `진행 단계는 되돌아가지 않는다 (3에서 2로 써도 ${st.a})`)

  // ═══ 9. 큐 - 채팅 탭을 열지 않은 채 앱 재시작 ════════════════════════════
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
    { clientMsgId: textId, coupleId, senderId: A.id, body: 'test-65 남은 글', sentAt: new Date().toISOString(), retryCount: 0, status: 'pending' },
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

  line(`\n실패 ${failures}건`)
  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/65-u6-part2.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyU6Part2.ts run')
