/**
 * U2 기록 실증 (`56-`) - 원격 **개발** DB·스토리지에서 시험 계정 둘로 확인한다 (Deno 전용).
 *
 *   A가 사진 5장 + 장소 2곳 + 메모로 데이트를 기록한다 -> B가 같은 기록을 본다(B의 사용자 권한으로 조회).
 *
 * - 쓰기·읽기는 **앱과 같은 함수**(`src/services/dateRecordApi.ts`)를 지난다. 클라이언트만 사용자 세션으로 바꿔 넘긴다.
 * - service_role은 **계정·커플 준비에만** 쓴다. A의 기록과 B의 조회는 각자의 세션(anon 키 + 로그인)이다 - RLS를 증명하려면 필요하다.
 * - 로그인은 비밀번호 없이 관리자 매직링크 토큰을 사용자 세션으로 바꾼다. 계정에는 비밀번호가 없다.
 * - 이름에 `test`(R13-7). 만든 행·파일은 ID와 경로로 남기고 지우지 않는다. 비밀값은 어디에도 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-check --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyU2Record.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  fetchDate,
  fetchDates,
  fetchEntriesOfDates,
  fetchStopsOfDate,
  findRecordingCouple,
  recordDate,
  signPhotoPaths,
} from '../../src/services/dateRecordApi.ts'
import { photoFromPickerAsset } from '../../src/utils/dateRecord.ts'
import { printer, writeJson } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const v = new DataView(out.buffer)
  v.setUint32(0, data.length)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}
async function solidPng(w: number, h: number, rgb: [number, number, number]): Promise<Uint8Array> {
  const row = new Uint8Array(1 + w * 3)
  for (let x = 0; x < w; x += 1) row.set(rgb, 1 + x * 3)
  const raw = new Uint8Array(row.length * h)
  for (let y = 0; y < h; y += 1) raw.set(row, y * row.length)
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
  const idat = new Uint8Array(await new Response(stream).arrayBuffer())
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, w)
  v.setUint32(4, h)
  ihdr[8] = 8
  ihdr[9] = 2
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

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

  // ── 준비(service_role) ────────────────────────────────────────────────
  const emails = { a: 'test-u2-a@example.com', b: 'test-u2-b@example.com', solo: 'test-u2-solo@example.com' }
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
        display_name: `test-u2-${role}`,
        gender: role === 'b' ? 'female' : 'male',
        birth_date: '1999-01-01',
        onboarding_step: 3,
        terms_agreed_at: new Date().toISOString(),
        privacy_agreed_at: new Date().toISOString(),
        ai_usage_agreed_at: new Date().toISOString(),
      })
      if (error) throw new Error(`profiles 삽입 실패(${role}): ${error.message}`)
    }
  }
  let coupleId: string
  const { data: existingCouple } = await admin.from('couples').select('id').eq('nickname', 'test-u2').maybeSingle()
  if (existingCouple) {
    coupleId = existingCouple.id
  } else {
    const { data, error } = await admin
      .from('couples')
      .insert({ user_a_id: ids.a, user_b_id: ids.b, invite_code: 'TESTU2', nickname: 'test-u2', status: 'active', connected_at: new Date().toISOString() })
      .select('id')
      .single()
    if (error) throw new Error(`couples 삽입 실패: ${error.message}`)
    coupleId = data.id
  }

  // 사용자 세션 클라이언트(anon 키 + 로그인)
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
  const dbSolo = await userClient(emails.solo)

  // ── 규칙 6 - 커플 행이 없는 유저는 null, 만들지 않는다 ─────────────────────
  const soloCouple = await findRecordingCouple(dbSolo, ids.solo)
  const { count: soloRows } = await admin.from('couples').select('id', { count: 'exact', head: true }).or(`user_a_id.eq.${ids.solo},user_b_id.eq.${ids.solo}`)
  line(`[규칙 6] 커플 행 없는 유저: findRecordingCouple = ${JSON.stringify(soloCouple)}, couples 행 수 = ${soloRows}`)

  // ── A가 기록 ──────────────────────────────────────────────────────────
  const colors: [number, number, number][] = [[120, 40, 60], [90, 70, 130], [190, 150, 100], [60, 70, 120], [150, 90, 130]]
  const bytes = new Map<string, ArrayBuffer>()
  const times = ['14:20:11', '15:10:42', '16:50:05', '18:30:30', '20:05:59']
  const assets = []
  for (let i = 0; i < 5; i += 1) {
    const uri = `file:///test-u2/photo${i + 1}.png`
    const png = await solidPng(64 + i, 48 + i, colors[i])
    bytes.set(uri, png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer)
    assets.push({
      uri,
      width: 4032,
      height: 3024,
      fileSize: png.byteLength,
      mimeType: 'image/png',
      exif: { DateTimeOriginal: `2026:10:03 ${times[i]}`, GPSLatitude: 37.5563 + i / 1000, GPSLatitudeRef: 'N', GPSLongitude: 126.9236, GPSLongitudeRef: 'E' },
    })
  }
  const photos = assets.map((a) => photoFromPickerAsset(a))

  const result = await recordDate(
    dbA,
    { readBytes: (uri: string) => Promise.resolve(bytes.get(uri) as ArrayBuffer), newId: () => crypto.randomUUID() },
    {
      coupleId,
      userId: ids.a,
      dateOn: '2026-10-03',
      places: [
        { name: 'test 홍대 CGV', arrivalClock: '14:20' },
        { name: 'test 연남동 디저트 카페', arrivalClock: '16:40' },
      ],
      photos,
      memo: 'test 스파이더맨 봤다. 서영이는 중간에 졸았음',
    },
  )
  line(`[A 기록] ${JSON.stringify(result)}`)

  // ── B가 B의 사용자 권한으로 조회 ───────────────────────────────────────
  const dates = await fetchDates(dbB)
  line(`[B 조회] dates = ${JSON.stringify(dates)}`)
  const date = await fetchDate(dbB, result.dateId)
  const stops = await fetchStopsOfDate(dbB, result.dateId)
  line(`[B 조회] date_stops = ${JSON.stringify(stops)}`)
  const entries = await fetchEntriesOfDates(dbB, [result.dateId])
  for (const e of entries) {
    line(
      `[B 조회] ${e.entry_type} id=${e.id} author=${e.author_id === ids.a ? 'A' : '?'} stop=${e.date_stop_id} width=${e.width} height=${e.height} captured_at=${e.captured_at} path=${e.storage_path} text=${e.text_content}`,
    )
  }
  const signed = await signPhotoPaths(dbB, entries.flatMap((e) => (e.storage_path ? [e.storage_path] : [])))
  line(`[B 조회] 서명 URL 발급 = ${Object.keys(signed).length}/5`)
  const head = await fetch(Object.values(signed)[0] as string)
  line(`[B 조회] 서명 URL로 원본 받기 = HTTP ${head.status}, ${(await head.arrayBuffer()).byteLength} bytes`)

  // 관리자 시점의 원본 행(같은 값인지 대조 - 칸 전체)
  const { data: raw } = await admin
    .from('data_entries')
    .select('id, entry_type, width, height, captured_at, lat, lng, byte_size, thumb_path, date_stop_id')
    .eq('date_id', result.dateId)
    .order('captured_at', { ascending: true })
  line(`[원본 행] ${JSON.stringify(raw)}`)
  const { data: rawDate } = await admin.from('dates').select('*').eq('id', result.dateId).single()
  line(`[원본 dates] ${JSON.stringify(rawDate)}`)

  // 다른 커플의 사용자(solo)는 이 기록을 못 본다
  const soloSees = await fetchDates(dbSolo)
  line(`[solo 조회] dates = ${soloSees.length}건 (다른 커플)`)

  line(`[요약] date=${date?.id} stops=${stops.length} entries=${entries.length} (사진 ${entries.filter((e) => e.entry_type === 'photo').length}, 메모 ${entries.filter((e) => e.entry_type === 'memo').length})`)

  await writeJson(
    'scripts/ops/out/56-u2-record.json',
    { users: ids, coupleId, dateId: result.dateId, entryIds: [...result.photoEntryIds, result.memoEntryId], stops: stops.map((s: { id: string }) => s.id), paths: entries.map((e) => e.storage_path).filter(Boolean) },
    secrets,
  )
  await Deno.writeTextFile('scripts/ops/out/56-u2-record.txt', out.join('\n') + '\n')
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyU2Record.ts run')
