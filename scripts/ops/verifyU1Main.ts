/**
 * U1 메인 탭 실증 (`61-`) - 원격 **개발** DB에서 시험 계정의 **사용자 권한**으로 메인 화면이 읽는 조회를 그대로 돌린다 (Deno 전용).
 *
 * 상태 네 가지: 연결·기록 없음 / 연결·기록 있음·온도 없음 / 미연결 / 발행 호 있음·안 열어 봄.
 *
 * - 화면이 읽는 조회는 **앱과 같은 함수**(`src/services/mainApi.ts`·`magazineApi.ts`)를 지난다. 클라이언트만 사용자 세션으로 바꿔 넘긴다.
 *   `coupleStore.refresh`·`useLoveTypeSummary`의 조회는 앱 전역 `supabase`를 쓰므로 같은 질의를 여기서 되풀이한다.
 * - 상태 판단은 앱과 같은 순수 함수(`src/utils/mainScreen.ts`)를 지난다. **온도를 계산하지 않는다** - 저장값 읽기만.
 * - service_role은 **계정 찾기와 시험 데이터 준비(이름에 test)** 에만 쓴다. 화면 조회는 각자의 세션(anon 키 + 로그인)이다.
 * - 로그인은 비밀번호 없이 관리자 매직링크 토큰을 사용자 세션으로 바꾼다. 토큰·키는 출력·파일 어디에도 쓰지 않는다.
 * - "안 열어 봄"은 기기 저장(AsyncStorage)이라 서버에서 볼 수 없다 - 새 기기(빈 집합)와 연 뒤(그 호 id 포함)를 순수 함수로 비교한다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서): survey = 읽기 전용 조사, run = 준비 + 실증
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyU1Main.ts survey|run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { fetchIssueProgressRows, fetchPublishedIssues } from '../../src/services/magazineApi.ts'
import { fetchHasActivity, fetchProfilesComplete } from '../../src/services/mainApi.ts'
import { layoutMain, pickNewIssueId, temperatureDisplay } from '../../src/utils/mainScreen.ts'
import { kstToday, pickDraftIssue } from '../../src/utils/magazine.ts'
import { computeDaysTogetherKst, getMilestoneStatus } from '../../src/utils/relationshipDays.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const NOW_ISO = new Date().toISOString()

async function main(mode: 'survey' | 'run'): Promise<void> {
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

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 500 })
  const users: { id: string; email?: string }[] = listed.data?.users ?? []
  const idOfEmail = (email: string) => users.find((u) => u.email === email)?.id

  if (mode === 'survey') {
    const testUsers = users.filter((u) => (u.email ?? '').startsWith('test'))
    line(`[조사] 시험 계정 ${testUsers.length}개`)
    const { data: couples } = await admin
      .from('couples')
      .select('id, status, nickname, user_a_id, user_b_id, relationship_start_date')
    for (const c of couples ?? []) {
      const [msgs, entries, dates, temps, issues] = await Promise.all([
        admin.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', c.id).is('deleted_at', null),
        admin.from('data_entries').select('id', { count: 'exact', head: true }).eq('couple_id', c.id).is('deleted_at', null),
        admin.from('dates').select('id', { count: 'exact', head: true }).eq('couple_id', c.id).is('deleted_at', null),
        admin.from('daily_temperature').select('date_on, temperature').eq('couple_id', c.id).order('date_on', { ascending: false }).limit(1),
        admin.from('issues').select('id, issue_number, published_at').eq('couple_id', c.id),
      ])
      const emailOf = (id: string | null) => users.find((u) => u.id === id)?.email ?? '(없음)'
      line(
        `[커플] ${c.nickname} status=${c.status} start=${c.relationship_start_date} a=${emailOf(c.user_a_id)} b=${emailOf(c.user_b_id)} | 대화 ${msgs.count} 기록 ${entries.count} 데이트 ${dates.count} | 온도행 ${temps.data?.length ?? 0} | 호 ${(issues.data ?? []).map((i: { id: string; issue_number: number | null; published_at: string | null }) => `${i.id.slice(0, 8)}#${i.issue_number ?? '-'}${i.published_at ? '(발행)' : '(초안)'}`).join(',')}`,
      )
    }
    const { data: pp } = await admin.from('personality_profiles').select('user_id, love_type_code')
    const have = new Set((pp ?? []).map((r: { user_id: string }) => r.user_id))
    line(`[성격 프로파일 있는 시험 계정] ${testUsers.filter((u) => have.has(u.id)).map((u) => u.email).join(', ') || '(없음)'}`)
    return
  }

  // ── 준비(service_role, 이름에 test) ───────────────────────────────────────
  const prepared: string[] = []
  async function ensureUser(email: string, displayName: string, gender: 'male' | 'female'): Promise<string> {
    let id = idOfEmail(email)
    if (!id) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
      if (created.error) throw new Error(`계정 생성 실패(${email}): ${created.error.message}`)
      id = created.data.user.id as string
      prepared.push(`auth.users ${email} ${id}`)
    }
    const { data: has } = await admin.from('profiles').select('id').eq('id', id).maybeSingle()
    if (!has) {
      const { error } = await admin.from('profiles').insert({
        id,
        display_name: displayName,
        gender,
        birth_date: '1999-01-01',
        onboarding_step: 3,
        terms_agreed_at: NOW_ISO,
        privacy_agreed_at: NOW_ISO,
        ai_usage_agreed_at: NOW_ISO,
      })
      if (error) throw new Error(`profiles 삽입 실패(${email}): ${error.message}`)
      prepared.push(`profiles ${id}`)
    }
    return id
  }
  async function ensurePersonality(userId: string, label: string): Promise<void> {
    const { data: has } = await admin.from('personality_profiles').select('user_id').eq('user_id', userId).maybeSingle()
    if (has) return
    const { data: assessment, error } = await admin
      .from('personality_assessments')
      .insert({
        user_id: userId,
        seq: 1,
        mbti: 'ISTJ',
        q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A',
        enneagram_core: 1,
        big_o: 50, big_c: 50, big_e: 50, big_a: 50, big_n: 50,
        stern_intimacy: 50, stern_passion: 50, stern_commitment: 50,
        attach_anxiety: 20, attach_avoidance: 20,
        attachment: 'secure',
        engine_version: `test-61-${label}`,
      })
      .select('id')
      .single()
    if (error) throw new Error(`personality_assessments 삽입 실패(${label}): ${error.message}`)
    const { error: pErr } = await admin.from('personality_profiles').insert({
      user_id: userId,
      active_assessment_id: assessment.id,
      enneagram_inferred: 1,
      attachment: 'secure',
      love_type_code: 'KLE',
    })
    if (pErr) throw new Error(`personality_profiles 삽입 실패(${label}): ${pErr.message}`)
    prepared.push(`personality ${label} ${userId}`)
  }
  async function ensureCouple(nickname: string, invite: string, a: string, b: string, startDate: string): Promise<string> {
    const { data: existing } = await admin.from('couples').select('id').eq('nickname', nickname).maybeSingle()
    if (existing) return existing.id
    const { data, error } = await admin
      .from('couples')
      .insert({ user_a_id: a, user_b_id: b, invite_code: invite, nickname, status: 'active', connected_at: NOW_ISO, relationship_start_date: startDate, start_date_set_by: a, start_date_confirmed_by: b })
      .select('id')
      .single()
    if (error) throw new Error(`couples 삽입 실패(${nickname}): ${error.message}`)
    prepared.push(`couples ${nickname} ${data.id}`)
    return data.id
  }

  const todayKst = kstToday(new Date())
  const emails = {
    emptyA: 'test-61-empty-a@example.com',
    emptyB: 'test-61-empty-b@example.com',
    activeA: 'test-61-active-a@example.com',
    activeB: 'test-61-active-b@example.com',
    pubA: 'test-55-2-photo-a@example.com',
    pubB: 'test-55-2-photo-b@example.com',
    solo: 'test-u2-solo@example.com',
  }
  const ids: Record<string, string> = {}
  ids.emptyA = await ensureUser(emails.emptyA, 'test-세준', 'male')
  ids.emptyB = await ensureUser(emails.emptyB, 'test-서영', 'female')
  ids.activeA = await ensureUser(emails.activeA, 'test-세준', 'male')
  ids.activeB = await ensureUser(emails.activeB, 'test-서영', 'female')
  for (const key of ['pubA', 'pubB', 'solo'] as const) {
    const id = idOfEmail(emails[key])
    if (!id) throw new Error(`기존 시험 계정이 없다: ${emails[key]}`)
    ids[key] = id
  }
  for (const key of Object.keys(ids)) await ensurePersonality(ids[key], key)

  const emptyCouple = await ensureCouple('test-61-empty', 'TEST61E', ids.emptyA, ids.emptyB, todayKst)
  const activeCouple = await ensureCouple('test-61-active', 'TEST61A', ids.activeA, ids.activeB, '2025-12-28')
  const { count: msgCount } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', activeCouple)
  if (!msgCount) {
    const { error } = await admin.from('messages').insert({ couple_id: activeCouple, sender_id: ids.activeA, body: 'test-61 안녕', client_msg_id: crypto.randomUUID() })
    if (error) throw new Error(`messages 삽입 실패: ${error.message}`)
    prepared.push(`messages test-61 ${activeCouple}`)
  }
  line(`[준비] 새로 만든 시험 데이터 ${prepared.length}건${prepared.length ? ': ' + prepared.join(' | ') : ' (이미 있음)'}`)

  // ── 사용자 세션 클라이언트(anon 키 + 로그인) ─────────────────────────────
  async function userClient(email: string): Promise<Db> {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const client: Db = createClient(url, anon as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
    secrets.push(verified.data.session?.access_token ?? '', verified.data.session?.refresh_token ?? '')
    return client
  }

  /** 메인 화면이 읽는 조회를 그대로 돌리고, 같은 순수 함수로 상태를 정한다. 조회 결과를 그대로 적는다. */
  async function readMain(label: string, email: string, userId: string, opened: ReadonlySet<string> = new Set()) {
    const db = await userClient(email)
    line(`── ${label} (${email}) ──`)
    // coupleStore.refresh와 같은 질의
    const { data: couple, error: couplesErr } = await db
      .from('couples')
      .select('id, relationship_start_date, nickname, user_a_id, user_b_id, reference_photo_path')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .eq('status', 'active')
      .maybeSingle()
    line(`couples 조회: ${couplesErr ? `오류 ${couplesErr.message}` : couple ? JSON.stringify({ id: couple.id, nickname: couple.nickname, relationship_start_date: couple.relationship_start_date, partner: couple.user_a_id === userId ? couple.user_b_id : couple.user_a_id }) : 'null (미연결)'}`)
    const connected = !!couple
    const partnerId: string | null = couple ? (couple.user_a_id === userId ? couple.user_b_id : couple.user_a_id) : null
    let storedTemperature: number | null = null
    let hasActivity = false
    let profilesComplete = false
    let issues: Awaited<ReturnType<typeof fetchPublishedIssues>> = []
    let draftCount = 0
    if (couple && partnerId) {
      const { data: tempRow, error: tempErr } = await db
        .from('daily_temperature')
        .select('temperature, date_on')
        .eq('couple_id', couple.id)
        .order('date_on', { ascending: false })
        .limit(1)
        .maybeSingle()
      line(`daily_temperature 조회: ${tempErr ? `오류 ${tempErr.message}` : JSON.stringify(tempRow)}`)
      storedTemperature = tempRow?.temperature ?? null
      hasActivity = await fetchHasActivity(db, couple.id)
      profilesComplete = await fetchProfilesComplete(db, userId, partnerId)
      line(`fetchHasActivity = ${hasActivity} / fetchProfilesComplete = ${profilesComplete}`)
      issues = await fetchPublishedIssues(db)
      line(`issues_public(발행된 호) ${issues.length}권: ${JSON.stringify(issues.map((i) => ({ id: i.id.slice(0, 8), issue_number: i.issueNumber, published_at: i.publishedAt, period_start: i.periodStart })))}`)
      const rows = await fetchIssueProgressRows(db)
      draftCount = pickDraftIssue(rows) ? 1 : 0
      line(`fn_issue_progress 행 ${rows.length}개, 초안 호 ${draftCount}개`)
    } else {
      // useLoveTypeSummary와 같은 질의(본인 최신 assessment + profile)
      const { data: assess } = await db.from('personality_assessments').select('mbti, seq').eq('user_id', userId).order('seq', { ascending: false }).limit(1).maybeSingle()
      const { data: prof } = await db.from('personality_profiles').select('love_type_code, enneagram_effective').eq('user_id', userId).maybeSingle()
      line(`온보딩 결과 요약 조회: assessment=${JSON.stringify(assess)} profile=${JSON.stringify(prof)}`)
    }
    const now = new Date()
    const days = connected && couple.relationship_start_date ? computeDaysTogetherKst(couple.relationship_start_date, now) : null
    const milestone = days !== null ? getMilestoneStatus(days) : null
    const display = temperatureDisplay({ connected, profilesComplete, hasActivity, storedTemperature })
    const newIssueId = pickNewIssueId(issues, opened, now)
    const layout = layoutMain({
      connected,
      temperature: display,
      milestoneToday: milestone?.isToday ?? false,
      milestoneUpcoming: milestone?.isUpcoming ?? false,
      hasNewIssue: newIssueId !== null,
      publishedCount: issues.length,
      hasDraft: draftCount > 0,
      hasLastIssueCard: issues.length > 0,
    })
    line(`=> 온도 표시 ${JSON.stringify(display)} · D+${days ?? '(시작일 없음)'} · 열어 본 호 ${JSON.stringify([...opened].map((i) => i.slice(0, 8)))} · 새 호 ${newIssueId ? newIssueId.slice(0, 8) : '없음'}`)
    line(`=> 화면 상태 ${layout.state} · 히어로 ${layout.hero} · 칸 ${JSON.stringify(layout.blocks)} · 초대 버튼 ${layout.showInvite}`)
    return { issues, layout }
  }

  await readMain('연결 · 기록 없음', emails.emptyA, ids.emptyA)
  await readMain('연결 · 기록 있음 · 저장된 온도 없음', emails.activeA, ids.activeA)
  await readMain('미연결', emails.solo, ids.solo)
  const published = await readMain('발행 호 있음 · 안 열어 봄(새 기기)', emails.pubA, ids.pubA)
  if (published.issues[0]) {
    await readMain('발행 호 있음 · 열어 본 뒤(그 호 id가 기기 저장에 있음)', emails.pubA, ids.pubA, new Set([published.issues[0].id]))
  }

  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/61-u1-main.txt', text)
}

const mode = Deno.args[0]
if (mode === 'survey' || mode === 'run') await main(mode)
else console.log('사용: verifyU1Main.ts survey|run')
