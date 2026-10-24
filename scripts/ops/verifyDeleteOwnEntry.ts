/**
 * 023 fn_delete_own_entry 실증 (`57-` A) - 원격 **개발** DB에서 시험 계정으로 확인한다 (Deno 전용).
 * **작성만 했다. 실행은 023을 원격에 적용한 뒤 메인 세션이 한다.**
 *
 * - RPC는 **사용자 세션**(anon 키 + 로그인)으로 부른다. service_role로 부르면 작성자 확인을 증명하지 못한다.
 * - service_role은 **계정·커플·시험 행 준비와 결과 대조 읽기**에만 쓴다.
 * - 이름에 `test`(R13-7). 만든 행은 지우지 않는다(R21-4). 실행할 때마다 새 데이트(다른 날짜)를 만든다.
 * - 비밀값은 어디에도 쓰지 않는다(redactSecrets).
 * - 사진 행은 `storage_path` 문자열만 있고 실제 파일은 올리지 않는다(함수는 저장소 파일을 건드리지 않는다).
 *
 * 다섯 경우 (+ 추가):
 *   ① A가 자기 사진 삭제 -> 성공(true) · dates 파생 칸 갱신 · A·B 모두 조회에서 사라짐
 *   ② A가 B의 사진 삭제 -> 거부 · 행 변화 없음
 *   ③ 다른 커플의 항목 -> 거부 · 행 변화 없음
 *   ④ 같은 항목 두 번 -> 두 번째는 false · 변화 없음
 *   ⑤ 비로그인(anon) -> 거부 · 행 변화 없음
 *   ⑥ 없는 id -> 거부 (메시지 구분 확인), ⑦ A가 자기 메모 삭제 -> has_user_note=false, ⑧ 사진 0장이 돼도 데이트 행은 남는다
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서, verifyU2Record.ts 와 같은 방식):
 *   deno run --no-check --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json \
 *     --allow-write=scripts/ops/out scripts/ops/verifyDeleteOwnEntry.ts run
 * 출력 원문: scripts/ops/out/57-delete-own-entry.txt (+ .json)
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { printer, writeJson } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

async function main(): Promise<void> {
  const ops = await connectOps()
  const say = printer(ops.secrets)
  const admin: Db = ops.client
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
  const anon = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
  if (!anon) throw new Error('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
  const secrets = [...ops.secrets, anon]
  const out: string[] = []
  const line = (s: string) => {
    out.push(s)
    say(s)
  }
  let failures = 0
  const verdict = (name: string, ok: boolean, detail: string) => {
    if (!ok) failures += 1
    line(`[${ok ? 'OK' : 'FAIL'}] ${name} - ${detail}`)
  }

  // ── 준비(service_role): 계정 4, 커플 2 ─────────────────────────────────
  const emails = { a: 'test-57-a@example.com', b: 'test-57-b@example.com', c: 'test-57-c@example.com', d: 'test-57-d@example.com' }
  const ids: Record<string, string> = {}
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  for (const [role, email] of Object.entries(emails)) {
    let id = listed.data?.users?.find((u: { email?: string }) => u.email === email)?.id as string | undefined
    if (!id) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
      if (created.error) throw new Error(`계정 생성 실패(${role}): ${created.error.message}`)
      id = created.data.user.id as string
    }
    ids[role] = id
    const { data: has } = await admin.from('profiles').select('id').eq('id', id).maybeSingle()
    if (!has) {
      const { error } = await admin.from('profiles').insert({
        id,
        display_name: `test-57-${role}`,
        gender: role === 'b' || role === 'd' ? 'female' : 'male',
        birth_date: '1999-01-01',
        onboarding_step: 3,
        terms_agreed_at: new Date().toISOString(),
        privacy_agreed_at: new Date().toISOString(),
        ai_usage_agreed_at: new Date().toISOString(),
      })
      if (error) throw new Error(`profiles 삽입 실패(${role}): ${error.message}`)
    }
  }
  async function ensureCouple(nickname: string, code: string, userA: string, userB: string): Promise<string> {
    const { data: existing } = await admin.from('couples').select('id').eq('nickname', nickname).maybeSingle()
    if (existing) return existing.id as string
    const { data, error } = await admin
      .from('couples')
      .insert({ user_a_id: userA, user_b_id: userB, invite_code: code, nickname, status: 'active', connected_at: new Date().toISOString() })
      .select('id')
      .single()
    if (error) throw new Error(`couples 삽입 실패(${nickname}): ${error.message}`)
    return data.id as string
  }
  const coupleAB = await ensureCouple('test-57-ab', 'TEST57AB', ids.a, ids.b)
  const coupleCD = await ensureCouple('test-57-cd', 'TEST57CD', ids.c, ids.d)

  // 사용자 세션 클라이언트(anon 키 + 로그인 - 비밀번호 없이 관리자 매직링크 토큰을 세션으로 바꾼다)
  async function userClient(email: string): Promise<Db> {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const client: Db = createClient(url, anon as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
    return client
  }
  const dbA = await userClient(emails.a)
  const dbB = await userClient(emails.b)
  const dbC = await userClient(emails.c)
  const dbAnon: Db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }) // 로그인 안 함

  // ── 시험 데이터: 커플 AB에 새 데이트 하나(실행마다 다른 날짜) ──────────────
  const { count: existingDates } = await admin.from('dates').select('id', { count: 'exact', head: true }).eq('couple_id', coupleAB)
  const dateOn = new Date(Date.UTC(2030, 0, 1 + (existingDates ?? 0))).toISOString().slice(0, 10)
  const { data: dateRow, error: dateErr } = await admin.from('dates').insert({ couple_id: coupleAB, date_on: dateOn }).select('id').single()
  if (dateErr) throw new Error(`dates 삽입 실패: ${dateErr.message}`)
  const dateId: string = dateRow.id

  // KST 시각으로 적는다. A: 14:00 · 15:00 · 16:30 사진 + 메모, B: 17:00 사진.
  const mk = async (author: string, type: 'photo' | 'memo', clock: string | null, tag: string): Promise<string> => {
    const row: Record<string, unknown> = { couple_id: coupleAB, author_id: author, date_id: dateId, entry_type: type }
    if (type === 'photo') {
      row.storage_path = `test-57/${dateId}/${tag}.png`
      row.byte_size = 1000
      row.captured_at = `${dateOn}T${clock}+09:00`
    } else {
      row.text_content = `test 57 메모 ${tag}`
    }
    const { data, error } = await admin.from('data_entries').insert(row).select('id').single()
    if (error) throw new Error(`data_entries 삽입 실패(${tag}): ${error.message}`)
    return data.id as string
  }
  const a1 = await mk(ids.a, 'photo', '14:00:00', 'a1')
  const a2 = await mk(ids.a, 'photo', '15:00:00', 'a2')
  const a3 = await mk(ids.a, 'photo', '16:30:00', 'a3')
  const b1 = await mk(ids.b, 'photo', '17:00:00', 'b1')
  const aMemo = await mk(ids.a, 'memo', null, 'a-memo')
  // 다른 커플(CD)의 항목 - C가 올린 사진
  const { data: otherDate, error: otherDateErr } = await admin
    .from('dates')
    .insert({ couple_id: coupleCD, date_on: dateOn })
    .select('id')
    .single()
  if (otherDateErr) throw new Error(`dates(CD) 삽입 실패: ${otherDateErr.message}`)
  const { data: cRow, error: cErr } = await admin
    .from('data_entries')
    .insert({ couple_id: coupleCD, author_id: ids.c, date_id: otherDate.id, entry_type: 'photo', storage_path: `test-57/${otherDate.id}/c1.png`, byte_size: 1000, captured_at: `${dateOn}T10:00:00+09:00` })
    .select('id')
    .single()
  if (cErr) throw new Error(`data_entries(CD) 삽입 실패: ${cErr.message}`)
  const c1: string = cRow.id

  // 준비 상태의 파생 칸을 앱 규칙대로 맞춰 둔다(사진 4 · 14:00~17:00 = 180분 · 메모 있음).
  await admin.from('dates').update({ photo_count: 4, duration_minutes: 180, has_user_note: true }).eq('id', dateId)

  const entryState = async (id: string) => {
    const { data } = await admin.from('data_entries').select('id, deleted_at, author_id, date_id').eq('id', id).single()
    return data as { id: string; deleted_at: string | null; author_id: string; date_id: string }
  }
  const dateState = async (id: string) => {
    const { data } = await admin.from('dates').select('id, deleted_at, photo_count, duration_minutes, has_user_note').eq('id', id).single()
    return data as { id: string; deleted_at: string | null; photo_count: number; duration_minutes: number | null; has_user_note: boolean }
  }
  const call = (db: Db, id: string) => db.rpc('fn_delete_own_entry', { p_entry_id: id })
  const visibleTo = async (db: Db, id: string): Promise<boolean> => {
    const { data } = await db.from('data_entries').select('id').eq('id', id)
    return (data?.length ?? 0) > 0
  }

  line(`[준비] 커플 AB=${coupleAB} · 커플 CD=${coupleCD} · 날짜=${dateOn} · dates=${dateId}`)
  line(`[준비] a1=${a1} a2=${a2} a3=${a3} b1=${b1} aMemo=${aMemo} c1(다른 커플)=${c1}`)
  line(`[준비] dates 파생 칸 = ${JSON.stringify(await dateState(dateId))}`)

  // ── ① A가 자기 사진(a1, 14:00) 삭제 ────────────────────────────────────
  const r1 = await call(dbA, a1)
  const e1 = await entryState(a1)
  const d1 = await dateState(dateId)
  verdict('① 성공 반환', !r1.error && r1.data === true, `error=${r1.error?.message ?? null} data=${JSON.stringify(r1.data)}`)
  verdict('① deleted_at 채워짐', e1.deleted_at !== null, `deleted_at=${e1.deleted_at}`)
  verdict('① 파생 칸 갱신(남은 사진 15:00·16:30·17:00 -> 3장 · 120분)', d1.photo_count === 3 && d1.duration_minutes === 120 && d1.has_user_note === true, JSON.stringify(d1))
  verdict('① A 조회에서 사라짐', !(await visibleTo(dbA, a1)), 'A 세션 select')
  verdict('① B 조회에서 사라짐', !(await visibleTo(dbB, a1)), 'B 세션 select')
  verdict('① 다른 항목은 그대로 보임(a2)', (await visibleTo(dbA, a2)) && (await visibleTo(dbB, a2)), 'A·B 세션 select')

  // ── ② A가 B의 사진(b1) 삭제 ────────────────────────────────────────────
  const beforeDate2 = await dateState(dateId)
  const r2 = await call(dbA, b1)
  const e2 = await entryState(b1)
  verdict('② 거부(오류)', !!r2.error, `code=${r2.error?.code} message=${r2.error?.message}`)
  verdict('② 행 변화 없음', e2.deleted_at === null && JSON.stringify(await dateState(dateId)) === JSON.stringify(beforeDate2), `b1.deleted_at=${e2.deleted_at}`)

  // ── ③ 다른 커플의 항목(c1)을 A가 삭제 ──────────────────────────────────
  const r3 = await call(dbA, c1)
  const e3 = await entryState(c1)
  verdict('③ 거부(오류)', !!r3.error, `code=${r3.error?.code} message=${r3.error?.message}`)
  verdict('③ 행 변화 없음', e3.deleted_at === null, `c1.deleted_at=${e3.deleted_at}`)
  // 같은 항목의 작성자 C가 부르면 성공해야 한다(거부가 커플 확인 때문임을 가른다).
  const r3b = await call(dbC, c1)
  verdict('③ 대조: 작성자 C 본인은 성공', !r3b.error && r3b.data === true, `error=${r3b.error?.message ?? null} data=${JSON.stringify(r3b.data)}`)

  // ── ④ 같은 항목 두 번(a2) ─────────────────────────────────────────────
  const r4a = await call(dbA, a2)
  const afterFirst = await entryState(a2)
  const dateAfterFirst = await dateState(dateId)
  const r4b = await call(dbA, a2)
  const afterSecond = await entryState(a2)
  const dateAfterSecond = await dateState(dateId)
  verdict('④ 첫 호출 성공(true)', !r4a.error && r4a.data === true, `error=${r4a.error?.message ?? null} data=${JSON.stringify(r4a.data)}`)
  verdict('④ 두 번째는 오류 없이 false', !r4b.error && r4b.data === false, `error=${r4b.error?.message ?? null} data=${JSON.stringify(r4b.data)}`)
  verdict('④ 두 번째 호출이 deleted_at을 바꾸지 않음', afterFirst.deleted_at === afterSecond.deleted_at && afterSecond.deleted_at !== null, `${afterFirst.deleted_at} -> ${afterSecond.deleted_at}`)
  verdict('④ 두 번째 호출이 파생 칸을 바꾸지 않음', JSON.stringify(dateAfterFirst) === JSON.stringify(dateAfterSecond), JSON.stringify(dateAfterSecond))

  // ── ⑤ 비로그인(anon) ──────────────────────────────────────────────────
  const r5 = await call(dbAnon, a3)
  const e5 = await entryState(a3)
  verdict('⑤ 거부(오류)', !!r5.error, `code=${r5.error?.code} message=${r5.error?.message}`)
  verdict('⑤ 행 변화 없음', e5.deleted_at === null, `a3.deleted_at=${e5.deleted_at}`)

  // ── ⑥ 없는 id: 메시지가 다른 경우와 구분되는가 ──────────────────────────
  const ghost = crypto.randomUUID()
  const r6 = await call(dbA, ghost)
  verdict('⑥ 없는 항목 거부', !!r6.error && r6.error.code === 'P0002', `code=${r6.error?.code} message=${r6.error?.message}`)
  line(`[메시지 대조] 없는 항목="${r6.error?.message}" · 작성자 아님="${r2.error?.message}" · 커플 아님="${r3.error?.message}" · 비로그인(anon)="${r5.error?.message}"`)

  // ── ⑦ A가 자기 메모 삭제 -> has_user_note=false ─────────────────────────
  const r7 = await call(dbA, aMemo)
  const d7 = await dateState(dateId)
  verdict('⑦ 메모 삭제 성공', !r7.error && r7.data === true, `error=${r7.error?.message ?? null}`)
  verdict('⑦ has_user_note=false', d7.has_user_note === false, JSON.stringify(d7))

  // ── ⑧ 남은 사진을 모두 지워 0장이 돼도 데이트 행은 남는다 ───────────────
  // 남은 것: a3(A) 와 b1(B). A는 a3만 지울 수 있고, b1은 B가 지운다. 파생 칸이 0·null이 되는지 본다.
  const r8a = await call(dbA, a3)
  const r8b = await call(dbB, b1)
  const d8 = await dateState(dateId)
  verdict('⑧ 두 항목 삭제 성공', !r8a.error && !r8b.error && r8a.data === true && r8b.data === true, `A=${r8a.error?.message ?? r8a.data} B=${r8b.error?.message ?? r8b.data}`)
  verdict('⑧ 사진 0장 · duration null · 데이트 행 남음(deleted_at null)', d8.photo_count === 0 && d8.duration_minutes === null && d8.deleted_at === null, JSON.stringify(d8))

  // ── 저장소 원본 파일을 건드리지 않았다는 점은 함수가 storage를 모른다는 것으로 충분하다(본문에 storage 참조 없음).
  line(`[요약] 실패 ${failures}건`)
  await writeJson('scripts/ops/out/57-delete-own-entry.json', { users: ids, coupleAB, coupleCD, dateId, entries: { a1, a2, a3, b1, aMemo, c1 }, failures }, secrets)
  await Deno.writeTextFile('scripts/ops/out/57-delete-own-entry.txt', out.join('\n') + '\n')
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyDeleteOwnEntry.ts run')
