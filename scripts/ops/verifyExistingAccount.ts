/**
 * 기존 계정 · 사진 영속 큐 실증 (`64-`) - 원격 **개발** DB에서 시험 계정이 자기 **사용자 권한**으로 앱과 같은 함수를 부른다 (Deno 전용).
 *
 * A. 기존 시험 계정(`test-63-signup-*`, 커플이 있으면 `test-61-*`)으로 **다시 로그인을 흉내** 낸다.
 *    - 로그인 직후 분기 `decideAfterLogin`이 'existing'이 되는지(메모리에 다른 이름 · 다른 답이 있어도), 저장 경로를 부르지 않는지.
 *    - 전후 같음: profiles 한 행 전체 · personality_assessments · personality_profiles · couples(있으면).
 *    - 덧붙임(앱은 이 호출을 하지 않는다): 같은 저장 함수를 다른 값으로 불러도, 진행 단계를 낮춰 불러도 전후가 같다.
 * B. 새 시험 계정(`test-64-*`)에서 저장 경로 2회 -> 행 수 그대로 · 오류 없음 · 첫 저장 값이 그대로. 진행 단계는 올라가기만 한다.
 *    프로필만 들어간 상태(일부만 저장)에서 다시 부르면 검사 행까지 끝까지 간다.
 * C. 사진 영속 큐: 시험 커플(`test-62-chat`)의 A 계정이 `attemptQueuedPhoto`(앱과 같은 함수)를 부른다.
 *    메시지와 스토리 각각 - 업로드는 됐는데 행을 넣기 전에 끊김 / 행은 들어갔는데 응답이 끊김 -> 다시 보내기 -> Storage 객체 1 · 행 1,
 *    한 번 더 보내도 1 · 1. (앱 재시작: 러너 인스턴스를 버리고 저장된 큐 JSON으로 새 러너가 이어 보낸다.)
 *
 * - service_role은 **계정 찾기 · 시험 데이터 준비 · 읽어 확인하기**에만 쓴다. 저장 · 전송은 각 계정의 사용자 세션(anon 키 + 로그인)이다.
 * - 로그인은 비밀번호 없이 관리자 매직링크 토큰을 사용자 세션으로 바꾼다. 토큰 · 키 · URL은 출력 · 파일 어디에도 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyExistingAccount.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { inferLoveType } from '../../src/engine/loveTypeInference.ts'
import { attemptQueuedPhoto, type PhotoFs } from '../../src/services/chatPhotoCore.ts'
import type { ChatDb } from '../../src/services/chatCore.ts'
import { advanceOnboardingStep } from '../../src/services/onboardingStepCore.ts'
import { createProfileAndAssessment, type PersonalityDb } from '../../src/services/personalityCore.ts'
import { parseQueuedPhotos, type QueuedPhoto } from '../../src/utils/chatPhotoQueue.ts'
import { ChatPhotoQueue } from '../../src/utils/chatPhotoQueueRunner.ts'
import { decideAfterLogin } from '../../src/utils/onboardingRules.ts'
import { resumePathFor } from '../../src/utils/onboardingResume.ts'
import { entryStoragePath } from '../../src/utils/dateRecord.ts'
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

  async function userClient(email: string): Promise<Db> {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const client: Db = createClient(url, anon as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
    secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
    return client
  }

  const answers = { q1: 'A', q2: 'B', q3: 'C', q4: 'A', q5: 'B' } as const
  const baseInput = (userId: string, over: Record<string, unknown> = {}) => ({
    userId,
    name: 'test-세준',
    gender: 'male' as const,
    birthDate: '2000-01-01',
    mbti: 'INFJ' as const,
    mbtiSelfReported: true,
    ...answers,
    result: inferLoveType({ mbti: 'INFJ', ...answers }),
    marketingAgreed: false,
    ...over,
  })

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 500 })
  const users: { id: string; email?: string }[] = listed.data?.users ?? []

  // ═════════════════════════════════════════════════════════════════════════
  // A. 기존 시험 계정으로 다시 로그인 흉내
  // ═════════════════════════════════════════════════════════════════════════
  line('═══ A. 기존 계정 재로그인 흉내 ═══')

  async function snapshot(id: string): Promise<string> {
    const profile = await admin.from('profiles').select('*').eq('id', id).maybeSingle()
    const assessments = await admin.from('personality_assessments').select('*').eq('user_id', id).order('seq')
    const pp = await admin.from('personality_profiles').select('*').eq('user_id', id).maybeSingle()
    const couples = await admin.from('couples').select('*').or(`user_a_id.eq.${id},user_b_id.eq.${id}`).order('id')
    return JSON.stringify({ profile: profile.data, assessments: assessments.data, pp: pp.data, couples: couples.data })
  }

  const signupAccounts = users
    .filter((u) => u.email?.startsWith('test-63-signup-'))
    .sort((a, b) => (b.email ?? '').localeCompare(a.email ?? ''))
  const u61 = users.filter((u) => u.email?.startsWith('test-61-'))
  const withCouple: { id: string; email?: string }[] = []
  for (const u of u61) {
    const c = await admin.from('couples').select('id').or(`user_a_id.eq.${u.id},user_b_id.eq.${u.id}`).limit(1)
    if ((c.data ?? []).length > 0) withCouple.push(u)
  }
  const targets: { id: string; email: string; label: string }[] = []
  if (signupAccounts[0]) targets.push({ id: signupAccounts[0].id, email: signupAccounts[0].email as string, label: 'test-63-signup' })
  if (withCouple[0]) targets.push({ id: withCouple[0].id, email: withCouple[0].email as string, label: 'test-61 (커플 연결)' })
  check(targets.length >= 1, `기존 시험 계정 ${targets.length}개를 찾음: ${targets.map((t) => t.label).join(', ')}`)

  for (const t of targets) {
    line(`── ${t.label}: ${t.email} ──`)
    const before = await snapshot(t.id)
    const client = await userClient(t.email)
    const b = JSON.parse(before)
    line(`[전] profiles: onboarding_step ${b.profile?.onboarding_step}, display_name '${b.profile?.display_name}' / assessments ${b.assessments?.length}행 / personality_profiles ${b.pp ? '있음' : '없음'} / couples ${b.couples?.length}행`)

    // 앱의 로그인 직후 분기: profiles 조회(사용자 세션) -> 순수 규칙. 메모리에는 일부러 다른 이름 · 다른 답이 있다(새 기기에서 다시 입력했다고 가정).
    const profile = await client.from('profiles').select('*').eq('id', t.id).maybeSingle()
    check(!profile.error && !!profile.data, '로그인 직후 profiles 조회(사용자 권한) -> 행 있음')
    const assess = await client.from('personality_assessments').select('seq').eq('user_id', t.id).order('seq', { ascending: false }).limit(1).maybeSingle()
    const action = decideAfterLogin({
      hasProfile: !!profile.data,
      hasAssessment: !!assess.data,
      answersComplete: true,
      consentComplete: true,
    })
    check(action === 'existing', `decideAfterLogin(프로필 있음 · 검사 있음 · 메모리 답 · 동의 있음) = '${action}' -> 저장 경로를 부르지 않는다`)
    line(`서버 진행 단계 ${profile.data?.onboarding_step} -> 앱이 들어갈 경로(커플 연결 상태는 커플 행 유무로 가정): ${resumePathFor(profile.data?.onboarding_step ?? 0, { connectedWithoutStartDate: false })}`)

    // 앱은 부르지 않는 호출을 덧붙인다: 기존 값이 덮이지 않는지(저장 함수) · 진행 단계가 내려가지 않는지(갱신 함수).
    let threw = ''
    try {
      await createProfileAndAssessment(client as PersonalityDb, baseInput(t.id, { name: 'test-덮어쓰기-시도', marketingAgreed: true, mbti: 'ENFP' }))
    } catch (e) {
      threw = (e as { code?: string; message?: string }).code ?? (e as Error).message
    }
    check(threw === '', `[덧붙임] 기존 계정에 저장 함수를 다른 값으로 불러도 오류 없음${threw ? ' (' + threw + ')' : ''}`)
    // 지금 값 이하(같은 값 포함)로 쓰려는 호출 - 올리는 호출이 아니라서 아무것도 바뀌지 않아야 한다.
    const current = profile.data?.onboarding_step as number
    for (let low = 0; low <= current; low++) {
      await advanceOnboardingStep(client as never, t.id, low as 0 | 1 | 2 | 3)
    }
    const after = await snapshot(t.id)
    check(after === before, '[후] profiles · personality_assessments · personality_profiles · couples 전후 같음 (JSON 전체 비교)')
  }

  // ═════════════════════════════════════════════════════════════════════════
  // B. 새 시험 계정 - 저장 경로 2회 · 일부만 저장
  // ═════════════════════════════════════════════════════════════════════════
  line('═══ B. 저장 경로 2회 · 일부만 저장 ═══')
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

  async function newAccount(tag: string): Promise<{ id: string; email: string; client: Db }> {
    const email = `test-64-${tag}-${stamp}@example.com`
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
    if (created.error) throw new Error(`계정 생성 실패: ${created.error.message}`)
    return { id: created.data.user.id as string, email, client: await userClient(email) }
  }

  const f1 = await newAccount('save')
  line(`[준비] 새 시험 계정 ${f1.email}`)
  const none = await f1.client.from('profiles').select('id').eq('id', f1.id).maybeSingle()
  check(none.data === null, '[로그인 직후] profiles 없음')
  check(
    decideAfterLogin({ hasProfile: false, hasAssessment: false, answersComplete: false, consentComplete: false }) === 'answers',
    "메모리가 비어 있으면 'answers' (로그인한 채 A03부터)",
  )
  check(
    decideAfterLogin({ hasProfile: false, hasAssessment: false, answersComplete: true, consentComplete: true }) === 'save',
    "메모리에 답과 동의가 있으면 'save'",
  )

  const first = await createProfileAndAssessment(f1.client as PersonalityDb, baseInput(f1.id))
  const afterFirst = await admin.from('profiles').select('*').eq('id', f1.id).single()
  check(afterFirst.data.onboarding_step === 0 && !!first, `[저장 1회] profiles 1행(onboarding_step ${afterFirst.data.onboarding_step}) + assessment seq ${first?.seq}`)

  let secondError = ''
  let second = null
  try {
    second = await createProfileAndAssessment(f1.client as PersonalityDb, baseInput(f1.id, { name: 'test-두번째', marketingAgreed: true, mbti: 'ENFP' }))
  } catch (e) {
    secondError = (e as { code?: string; message?: string }).code ?? (e as Error).message
  }
  check(secondError === '', `[저장 2회] 오류 없이 통과${secondError ? ' (' + secondError + ')' : ''}`)
  const profRows = await admin.from('profiles').select('id').eq('id', f1.id)
  const assRows = await admin.from('personality_assessments').select('seq, mbti').eq('user_id', f1.id)
  check((profRows.data ?? []).length === 1 && (assRows.data ?? []).length === 1, `[저장 2회] 행 수 그대로: profiles ${(profRows.data ?? []).length} · assessments ${(assRows.data ?? []).length}`)
  const afterSecond = await admin.from('profiles').select('*').eq('id', f1.id).single()
  check(JSON.stringify(afterSecond.data) === JSON.stringify(afterFirst.data), '[저장 2회] 첫 저장의 profiles 행이 그대로다(이름 · 동의 시각 · 마케팅 · 진행 단계)')
  check(assRows.data?.[0]?.mbti === 'INFJ' && second?.mbti === 'INFJ', '[저장 2회] assessment는 첫 값이고, 돌려받은 것도 첫 값이다')

  // 진행 단계는 올라가기만 한다.
  await admin.from('profiles').update({ onboarding_step: 2 }).eq('id', f1.id)
  await advanceOnboardingStep(f1.client as never, f1.id, 1)
  await advanceOnboardingStep(f1.client as never, f1.id, 0)
  let step = (await admin.from('profiles').select('onboarding_step').eq('id', f1.id).single()).data.onboarding_step
  check(step === 2, `[진행 단계] 2에서 1 · 0으로 쓰려 해도 ${step}`)
  await advanceOnboardingStep(f1.client as never, f1.id, 3)
  step = (await admin.from('profiles').select('onboarding_step').eq('id', f1.id).single()).data.onboarding_step
  check(step === 3, `[진행 단계] 3으로 올리면 ${step}`)
  await advanceOnboardingStep(f1.client as never, f1.id, 3)
  await advanceOnboardingStep(f1.client as never, f1.id, 2)
  step = (await admin.from('profiles').select('onboarding_step').eq('id', f1.id).single()).data.onboarding_step
  check(step === 3, `[진행 단계] 같은 값 · 더 작은 값 뒤에도 ${step}`)

  // 일부만 저장: 프로필만 있고 검사는 없다.
  const f2 = await newAccount('partial')
  const now = new Date().toISOString()
  const ins = await admin.from('profiles').insert({
    id: f2.id,
    display_name: 'test-일부만',
    gender: 'male',
    birth_date: '2000-01-01',
    mbti: 'INFJ',
    onboarding_step: 0,
    terms_agreed_at: now,
    privacy_agreed_at: now,
    ai_usage_agreed_at: now,
  })
  check(!ins.error, `[준비] 프로필만 있는 계정 ${f2.email}`)
  const profBefore = await admin.from('profiles').select('*').eq('id', f2.id).single()
  const noAssess = await f2.client.from('personality_assessments').select('seq').eq('user_id', f2.id).limit(1).maybeSingle()
  check(
    decideAfterLogin({ hasProfile: true, hasAssessment: !!noAssess.data, answersComplete: true, consentComplete: true }) === 'save',
    "프로필만 있고 검사는 없고 메모리가 온전하면 'save'",
  )
  let partialError = ''
  try {
    await createProfileAndAssessment(f2.client as PersonalityDb, baseInput(f2.id, { name: 'test-일부만-다시' }))
  } catch (e) {
    partialError = (e as { code?: string; message?: string }).code ?? (e as Error).message
  }
  const partialAss = await admin.from('personality_assessments').select('seq').eq('user_id', f2.id)
  const profAfter = await admin.from('profiles').select('*').eq('id', f2.id).single()
  check(partialError === '' && (partialAss.data ?? []).length === 1, `[일부만] 다시 불러 끝까지 감: 오류 ${partialError || '없음'} · assessments ${(partialAss.data ?? []).length}행`)
  check(JSON.stringify(profAfter.data) === JSON.stringify(profBefore.data), '[일부만] 이미 있던 프로필 행은 그대로')

  // ═════════════════════════════════════════════════════════════════════════
  // C. 사진 영속 큐 - 메시지 · 스토리
  // ═════════════════════════════════════════════════════════════════════════
  line('═══ C. 사진 영속 큐 ═══')
  const emailA = 'test-62-chat-a@example.com'
  const idA = users.find((u) => u.email === emailA)?.id
  const coupleRow = await admin.from('couples').select('id').eq('nickname', 'test-62-chat').maybeSingle()
  if (!idA || !coupleRow.data) throw new Error('시험 커플 test-62-chat이 없다 - verifyU4Chat.ts를 먼저 실행해야 한다')
  const coupleId = coupleRow.data.id as string
  const clientA = await userClient(emailA)
  line('로그인: A(test-세준) 사용자 세션, 시험 커플 test-62-chat')

  // 파일은 메모리 가짜(앱은 expo-file-system의 앱 문서 폴더 복사본).
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

  /** 다음 삽입 한 번을 끊는다. 'before' = 서버에 닿기 전, 'after' = 서버에 들어간 뒤 응답이 끊김. */
  function flaky(real: Db, table: 'messages' | 'stories', mode: { when: 'before' | 'after' | null }): ChatDb {
    return {
      storage: real.storage,
      from(name: string) {
        const builder = real.from(name)
        if (name !== table) return builder
        return new Proxy(builder, {
          get(target, prop) {
            if (prop !== 'insert') return target[prop].bind(target)
            return (row: unknown) => {
              const when = mode.when
              mode.when = null // 한 번만
              if (!when) return target.insert(row)
              const api = {
                select: () => api,
                single: () => api,
                then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
                  (async () => {
                    if (when === 'after') await target.insert(row).select().single()
                    throw new TypeError('Network request failed')
                  })().then(resolve, reject),
              }
              return api
            }
          },
        })
      },
    } as unknown as ChatDb
  }

  async function countObjects(bucket: 'messages' | 'stories', clientId: string): Promise<number> {
    const listing = await admin.storage.from(bucket).list(coupleId, { search: clientId })
    return (listing.data ?? []).filter((o: { name: string }) => o.name === `${clientId}.png`).length
  }
  async function countRows(kind: 'message' | 'story', clientId: string): Promise<number> {
    if (kind === 'message') {
      const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('client_msg_id', clientId)
      return count ?? 0
    }
    const { count } = await admin
      .from('stories')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
      .eq('media_path', entryStoragePath(coupleId, clientId, 'png'))
    return count ?? 0
  }

  function newItem(kind: 'message' | 'story'): QueuedPhoto {
    const clientId = crypto.randomUUID()
    const localUri = `mem://${clientId}.png`
    files.set(localUri, pngBytes())
    return {
      clientId,
      kind,
      coupleId,
      userId: idA as string,
      localUri,
      ext: 'png',
      contentType: 'image/png',
      sentAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    }
  }

  for (const kind of ['message', 'story'] as const) {
    const table = kind === 'message' ? 'messages' : 'stories'
    const bucket = kind === 'message' ? 'messages' : 'stories'
    const label = kind === 'message' ? '사진 메시지' : '스토리'

    // C1. 업로드는 됐는데 행을 넣기 전에 끊김 -> 앱 재시작(새 러너) -> 이어 보내기
    {
      line(`── ${label} (1) 업로드는 됐는데 행을 넣기 전에 끊김 -> 앱 재시작 -> 이어 보내기 ──`)
      const item = newItem(kind)
      const mode = { when: 'before' as 'before' | 'after' | null }
      let saved: QueuedPhoto[] = []
      const runner1 = new ChatPhotoQueue({
        attempt: (it) => attemptQueuedPhoto(flaky(clientA, table, mode), it, fs),
        onChange: (q) => {
          saved = q
        },
        discard: (it) => fs.remove(it.localUri),
      })
      const outcome1 = await runner1.add(item)
      runner1.dispose() // 앱 종료 - 메모리의 러너와 타이머가 사라진다
      const objs1 = await countObjects(bucket, item.clientId)
      const rows1 = await countRows(kind, item.clientId)
      check(outcome1 === 'retry' && objs1 === 1 && rows1 === 0, `첫 시도: 결과 ${outcome1} · Storage 객체 ${objs1} · 행 ${rows1} (큐에 ${saved.length}항목, 복사본 ${files.has(item.localUri) ? '남음' : '없음'})`)

      const persisted = parseQueuedPhotos(JSON.stringify(saved)) // 기기에 저장된 JSON을 읽은 것
      let restarted: QueuedPhoto[] = persisted
      const runner2 = new ChatPhotoQueue({
        attempt: (it) => attemptQueuedPhoto(clientA as ChatDb, it, fs),
        onChange: (q) => {
          restarted = q
        },
        discard: (it) => fs.remove(it.localUri),
      })
      runner2.hydrate(persisted)
      for (let i = 0; i < 100 && runner2.getQueue().length > 0; i++) await new Promise((r) => setTimeout(r, 100))
      runner2.dispose()
      const objs2 = await countObjects(bucket, item.clientId)
      const rows2 = await countRows(kind, item.clientId)
      check(restarted.length === 0 && objs2 === 1 && rows2 === 1 && !files.has(item.localUri), `재시작 뒤 이어 보냄: 큐 ${restarted.length}항목 · Storage 객체 ${objs2} · 행 ${rows2} · 복사본 지워짐`)

      files.set(item.localUri, pngBytes()) // 큐 항목이 지워지기 전에 앱이 죽었던 것처럼 한 번 더
      const again = await attemptQueuedPhoto(clientA as ChatDb, item, fs)
      const objs3 = await countObjects(bucket, item.clientId)
      const rows3 = await countRows(kind, item.clientId)
      check(again.outcome === 'done' && objs3 === 1 && rows3 === 1, `한 번 더 보냄: 결과 ${again.outcome} · Storage 객체 ${objs3} · 행 ${rows3}`)
    }

    // C2. 행은 들어갔는데 응답이 끊김
    {
      line(`── ${label} (2) 행은 들어갔는데 응답이 끊김 -> 다시 보내기 ──`)
      const item = newItem(kind)
      const mode = { when: 'after' as 'before' | 'after' | null }
      const r1 = await attemptQueuedPhoto(flaky(clientA, table, mode), item, fs)
      const objs1 = await countObjects(bucket, item.clientId)
      const rows1 = await countRows(kind, item.clientId)
      check(r1.outcome === 'retry' && objs1 === 1 && rows1 === 1, `첫 시도: 결과 ${r1.outcome} (앱은 모른다) · Storage 객체 ${objs1} · 행 ${rows1}`)
      const r2 = await attemptQueuedPhoto(clientA as ChatDb, item, fs)
      const objs2 = await countObjects(bucket, item.clientId)
      const rows2 = await countRows(kind, item.clientId)
      check(r2.outcome === 'done' && objs2 === 1 && rows2 === 1, `다시 보내기: 결과 ${r2.outcome} · Storage 객체 ${objs2} · 행 ${rows2}`)
      const r3 = await attemptQueuedPhoto(clientA as ChatDb, item, fs)
      const objs3 = await countObjects(bucket, item.clientId)
      const rows3 = await countRows(kind, item.clientId)
      check(r3.outcome === 'done' && objs3 === 1 && rows3 === 1, `한 번 더: 결과 ${r3.outcome} · Storage 객체 ${objs3} · 행 ${rows3}`)
    }
  }

  // C3. 복사본이 사라진 항목
  {
    line('── 복사본이 사라진 항목 ──')
    const item = newItem('message')
    files.delete(item.localUri)
    const r = await attemptQueuedPhoto(clientA as ChatDb, item, fs)
    check(r.outcome === 'lost' && (await countObjects('messages', item.clientId)) === 0 && (await countRows('message', item.clientId)) === 0, `결과 ${r.outcome} - 서버에 아무것도 가지 않았다(객체 0 · 행 0)`)
  }

  line(`\n실패 ${failures}건`)
  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/64-existing-account.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyExistingAccount.ts run')
