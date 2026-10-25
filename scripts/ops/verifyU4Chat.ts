/**
 * U4 채팅 실증 (`62-`) - 원격 **개발** DB에서 시험 커플 두 계정이 각자의 **사용자 권한**으로 앱과 같은 함수를 부른다 (Deno 전용).
 *
 * 1. A 텍스트 전송(`chatCore.sendMessage`) -> B가 **실시간 구독**으로 받는다(수신 지연 ms).
 * 2. A 사진 메시지(올리기 + `sendMessage(mediaPath)`) -> B가 구독으로 받고 서명 URL로 읽는다(HTTP 상태만 적는다).
 * 3. B 읽음(앱 `markMessagesRead`와 같은 질의) -> A가 구독으로 `read_at`을 받는다(화면의 숫자 1이 사라지는 근거).
 * 4. **빈 본문 API 호출 거부**: 빈 문자열·공백·개행·전각 공백·null - 모두 서버에 가지 않고 `permanent` 실패, DB 행 수 그대로.
 * 5. 스토리: A가 올리고(`uploadChatMedia('stories')` + `createStory`) B가 앱과 같은 질의로 읽는다.
 *
 * - 앱과 **같은 함수**(`src/services/chatCore.ts`)를 부른다. 클라이언트만 사용자 세션으로 넘긴다(`chatApi.ts`는 앱 환경변수가 필요해 Deno에서 못 부른다 -
 *   같은 거부는 jest `chatCore.test.ts`가 `chatApi.sendMessage`로도 확인한다).
 * - service_role은 **계정 찾기와 시험 데이터 준비(이름에 test)** 에만 쓴다. 전송·구독·읽기는 각자의 세션(anon 키 + 로그인)이다.
 * - 로그인은 비밀번호 없이 관리자 매직링크 토큰을 사용자 세션으로 바꾼다. 토큰·키·URL은 출력·파일 어디에도 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyU4Chat.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  createStory,
  sendMessage,
  signChatMedia,
  uploadChatMedia,
  type ChatDb,
  type SendMessageResult,
} from '../../src/services/chatCore.ts'
import { entryStoragePath } from '../../src/utils/dateRecord.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const NOW_ISO = new Date().toISOString()
// 1x1 PNG
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

  // ── 준비(service_role, 이름에 test) ───────────────────────────────────────
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 500 })
  const users: { id: string; email?: string }[] = listed.data?.users ?? []
  const prepared: string[] = []
  async function ensureUser(email: string, displayName: string, gender: 'male' | 'female'): Promise<string> {
    let id = users.find((u) => u.email === email)?.id
    if (!id) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
      if (created.error) throw new Error(`계정 생성 실패(${email}): ${created.error.message}`)
      id = created.data.user.id as string
      prepared.push(`auth.users ${email}`)
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
      prepared.push(`profiles ${email}`)
    }
    return id
  }
  const emailA = 'test-62-chat-a@example.com'
  const emailB = 'test-62-chat-b@example.com'
  const idA = await ensureUser(emailA, 'test-세준', 'male')
  const idB = await ensureUser(emailB, 'test-서영', 'female')
  let coupleId: string
  {
    const { data: existing } = await admin.from('couples').select('id').eq('nickname', 'test-62-chat').maybeSingle()
    if (existing) {
      coupleId = existing.id
    } else {
      const { data, error } = await admin
        .from('couples')
        .insert({
          user_a_id: idA,
          user_b_id: idB,
          invite_code: 'TEST62C',
          nickname: 'test-62-chat',
          status: 'active',
          connected_at: NOW_ISO,
          relationship_start_date: '2025-12-28',
          start_date_set_by: idA,
          start_date_confirmed_by: idB,
        })
        .select('id')
        .single()
      if (error) throw new Error(`couples 삽입 실패: ${error.message}`)
      coupleId = data.id
      prepared.push('couples test-62-chat')
    }
  }
  line(`[준비] 새로 만든 시험 데이터 ${prepared.length}건${prepared.length ? ': ' + prepared.join(' | ') : ' (이미 있음)'} / 커플 test-62-chat`)

  // ── 사용자 세션 클라이언트(anon 키 + 로그인) ─────────────────────────────
  async function userClient(email: string): Promise<Db> {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw new Error(`링크 생성 실패: ${link.error.message}`)
    const client: Db = createClient(url, anon as string, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    if (verified.error) throw new Error(`로그인 실패: ${verified.error.message}`)
    const token = verified.data.session?.access_token ?? ''
    secrets.push(token, verified.data.session?.refresh_token ?? '')
    client.realtime.setAuth(token)
    return client
  }
  const clientA = await userClient(emailA)
  const clientB = await userClient(emailB)
  line('로그인: A(test-세준) · B(test-서영) 각자의 사용자 세션')

  // ── B의 실시간 구독(앱 `useRealtimeMessages`와 같은 채널 조건) ────────────
  type Row = { id: string; client_msg_id: string | null; body: string | null; media_path: string | null; sender_id: string; read_at: string | null }
  const seenByB = new Map<string, { row: Row; at: number; event: string }>()
  const seenByA = new Map<string, { row: Row; at: number; event: string }>()
  function watch(client: Db, name: string, sink: Map<string, { row: Row; at: number; event: string }>): Promise<void> {
    return new Promise((resolve, reject) => {
      const channel = client
        .channel(`${name}:${coupleId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` }, (payload: { eventType: string; new: Row }) => {
          const row = payload.new
          if (!row?.id) return
          sink.set(`${payload.eventType}:${row.client_msg_id ?? row.id}`, { row, at: Date.now(), event: payload.eventType })
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') resolve()
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`구독 실패(${name}): ${status}`))
        })
    })
  }
  await watch(clientB, 'b', seenByB)
  await watch(clientA, 'a', seenByA)
  line('구독: A·B 모두 SUBSCRIBED (messages, couple_id 필터)')

  async function waitFor<T>(find: () => T | undefined, ms = 8000): Promise<T | undefined> {
    const end = Date.now() + ms
    while (Date.now() < end) {
      const hit = find()
      if (hit !== undefined) return hit
      await new Promise((r) => setTimeout(r, 100))
    }
    return undefined
  }
  const countMessages = async () => {
    const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId)
    return count ?? 0
  }

  // ── 1. A 텍스트 -> B 실시간 수신 ──────────────────────────────────────────
  line('── 1. A 전송 -> B 수신(실시간 구독) ──')
  const textId = crypto.randomUUID()
  const sentAt1 = Date.now()
  const r1: SendMessageResult = await sendMessage(clientA as ChatDb, { clientMsgId: textId, coupleId, senderId: idA, body: 'test-62 안녕, 비 온대' })
  line(`A sendMessage -> status=${r1.status}`)
  check(r1.status === 'sent', 'A 전송 성공')
  const got1 = await waitFor(() => seenByB.get(`INSERT:${textId}`))
  check(!!got1, `B가 구독으로 받음 (지연 ${got1 ? got1.at - sentAt1 : '-'}ms, 이벤트 ${got1?.event}) 본문=${JSON.stringify(got1?.row.body)}`)
  check((got1 ? got1.at - sentAt1 : 99999) <= 3000, '수신 지연 3초 이내(MASTER 12-2)')

  // ── 멱등 재전송: 같은 client_msg_id ──────────────────────────────────────
  const dup = await sendMessage(clientA as ChatDb, { clientMsgId: textId, coupleId, senderId: idA, body: 'test-62 안녕, 비 온대' })
  check(dup.status === 'already_sent', `같은 client_msg_id 재전송 -> ${dup.status} (중복 삽입 없음)`)

  // ── 2. 사진 메시지 ───────────────────────────────────────────────────────
  line('── 2. 사진 메시지 ──')
  const photoId = crypto.randomUUID()
  const photoPath = entryStoragePath(coupleId, photoId, 'png')
  const up = await uploadChatMedia(clientA as ChatDb, 'messages', photoPath, pngBytes(), 'image/png')
  check(up.ok, `A 사진 올리기 messages/{couple}/{id}.png -> ok=${up.ok}`)
  const upAgain = await uploadChatMedia(clientA as ChatDb, 'messages', photoPath, pngBytes(), 'image/png')
  check(upAgain.ok, `같은 경로 다시 올리기(재시도) -> ok=${upAgain.ok} (이미 있음은 성공으로 본다)`)
  const sentAt2 = Date.now()
  const r2 = await sendMessage(clientA as ChatDb, { clientMsgId: photoId, coupleId, senderId: idA, body: null, mediaPath: photoPath })
  check(r2.status === 'sent', `A 사진 메시지 전송 -> ${r2.status}`)
  const got2 = await waitFor(() => seenByB.get(`INSERT:${photoId}`))
  check(!!got2 && got2.row.media_path === photoPath && got2.row.body === null, `B가 구독으로 받음 (지연 ${got2 ? got2.at - sentAt2 : '-'}ms) media_path=경로 일치 body=null`)
  const signedB = await signChatMedia(clientB as ChatDb, 'messages', [photoPath])
  const signedUrl = signedB[photoPath]
  check(!!signedUrl, 'B가 서명 URL을 받음(상대의 사진을 읽기)')
  if (signedUrl) {
    secrets.push(signedUrl)
    const res = await fetch(signedUrl)
    const bytes = new Uint8Array(await res.arrayBuffer())
    check(res.status === 200 && bytes.length > 0, `서명 URL 읽기 HTTP ${res.status}, ${bytes.length}바이트`)
  }
  // 다른 커플은 못 읽는다는 것은 RLS(015)가 지킨다 - 이 실증 범위 밖.

  // ── 3. 읽음 ─────────────────────────────────────────────────────────────
  line('── 3. B 읽음 -> A 수신 ──')
  const beforeUnread = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('sender_id', idA).is('read_at', null)
  const upd = await clientB
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('couple_id', coupleId)
    .neq('sender_id', idB)
    .is('read_at', null)
    .select()
  check(!upd.error && (upd.data?.length ?? 0) >= 2, `B 읽음 갱신(앱 markMessagesRead와 같은 질의) -> ${upd.error ? upd.error.message : (upd.data?.length ?? 0) + '건'} (읽기 전 안 읽은 A의 글 ${beforeUnread.count}건)`)
  const readEvt = await waitFor(() => seenByA.get(`UPDATE:${textId}`))
  check(!!readEvt && readEvt.row.read_at !== null, 'A가 구독으로 read_at을 받음 -> 화면의 숫자 1이 사라짐')

  // ── 4. 빈 본문 API 호출 거부 ────────────────────────────────────────────
  line('── 4. 빈 본문 API 호출 거부(R21-5) ──')
  const before = await countMessages()
  const cases: [string, string | null][] = [
    ['빈 문자열', ''],
    ['공백', '   '],
    ['개행·탭', '\n\t '],
    ['전각 공백', '　'],
    ['null', null],
  ]
  for (const [label, body] of cases) {
    const id = crypto.randomUUID()
    const result = await sendMessage(clientA as ChatDb, { clientMsgId: id, coupleId, senderId: idA, body })
    const errMsg = result.status === 'failed' ? (result.error as Error).message : '-'
    check(result.status === 'failed' && result.errorClass === 'permanent' && errMsg === 'empty_body', `${label} -> status=${result.status} errorClass=${result.status === 'failed' ? result.errorClass : '-'} error=${errMsg}`)
    const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('client_msg_id', id)
    check(count === 0, `${label}: DB에 그 client_msg_id 행 ${count}건`)
  }
  check((await countMessages()) === before, `거부 전후 messages 행 수 같음 (${before})`)
  // 대조: 같은 클라이언트로 DB에 직접 공백 본문을 넣으면 DB는 막지 않는다(R21-5 - DB 제약은 더하지 않았다).
  line('(DB 제약은 더하지 않았다 - 막음은 API 함수에 있다. 우회 경로의 빈 본문은 R20-1이 생성 단계에서 뺀다.)')

  // ── 5. 스토리 ───────────────────────────────────────────────────────────
  line('── 5. 스토리: A 올리기 -> B 읽기 ──')
  const storyPath = entryStoragePath(coupleId, crypto.randomUUID(), 'png')
  const upStory = await uploadChatMedia(clientA as ChatDb, 'stories', storyPath, pngBytes(), 'image/png')
  check(upStory.ok, 'A 스토리 사진 올리기 stories/{couple}/{id}.png')
  const story = await createStory(clientA as ChatDb, { coupleId, authorId: idA, mediaPath: storyPath })
  line(`A createStory -> id ${story.id.slice(0, 8)} expires_at=${story.expires_at}`)
  const hours = (new Date(story.expires_at).getTime() - new Date(story.created_at).getTime()) / 3600000
  check(Math.abs(hours - 24) < 0.01, `만료는 올린 뒤 ${hours.toFixed(2)}시간(24시간)`)
  const { data: storiesSeenByB, error: storyErr } = await clientB
    .from('stories')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  check(!storyErr && (storiesSeenByB ?? []).some((s: { id: string }) => s.id === story.id), `B가 앱과 같은 질의로 A의 스토리를 읽음 (보이는 스토리 ${(storiesSeenByB ?? []).length}개)`)
  const storySigned = await signChatMedia(clientB as ChatDb, 'stories', [storyPath])
  check(!!storySigned[storyPath], 'B가 스토리 사진 서명 URL을 받음')
  if (storySigned[storyPath]) secrets.push(storySigned[storyPath])

  await clientA.removeAllChannels()
  await clientB.removeAllChannels()

  line(`\n실패 ${failures}건`)
  await Deno.mkdir('scripts/ops/out', { recursive: true })
  let text = out.join('\n') + '\n'
  for (const s of secrets) if (s) text = text.split(s).join('<비밀값>')
  await Deno.writeTextFile('scripts/ops/out/62-u4-chat.txt', text)
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyU4Chat.ts run')
