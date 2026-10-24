/**
 * U2 본인 기록 삭제 · stop 시각 규칙 실증 (`57-` C) - 원격 **개발** DB에서 시험 계정 둘로 확인한다 (Deno 전용).
 *
 * 1. stop 시각(R30-2): A가 장소 하나·시각 없음·사진 있음으로 기록 -> stop 도착 시각 = 가장 이른 촬영 시각(실제 시각).
 *    둘째 장소 시각 없음 -> 저장 거부(업로드·행 0).
 * 2. 삭제(R30-1): A가 자기 사진을 `deleteOwnEntry`(= `fn_delete_own_entry` RPC)로 지운다 -> A·B 조회에서 사라짐.
 *    B의 사진에는 삭제 진입(`canDeleteEntry`)이 없고, A가 RPC로 B의 사진을 지우려 하면 거부된다.
 * 3. 시험 데이터에 KST 00:00 "표시 값"으로 저장된 stop이 남았는지 조회한다(없으면 "없음", 있으면 시험 계정으로 다시 기록해 바꾼다).
 *
 * - 쓰기·읽기는 **앱과 같은 함수**(`src/services/dateRecordApi.ts`)를 지난다. 클라이언트만 사용자 세션으로 바꿔 넘긴다.
 * - service_role은 계정 준비와 읽기 대조에만 쓴다. 이름에 `test`. 만든 행·파일은 지우지 않는다. 비밀값은 어디에도 쓰지 않는다.
 *
 * 환경변수: ONDOLOG_SUPABASE_URL · ONDOLOG_SUPABASE_SERVICE_ROLE_KEY · ONDOLOG_SUPABASE_ANON_KEY
 *
 * 사용 (저장소 루트에서, **--no-lock 필수** - deno.lock이 생기면 안 된다):
 *   deno run --no-lock --no-check --unstable-sloppy-imports --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_SUPABASE_ANON_KEY \
 *     --allow-net=<프로젝트 ref>.supabase.co --allow-read=supabase/.temp/linked-project.json,src \
 *     --allow-write=scripts/ops/out scripts/ops/verifyU2Delete.ts run
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  StopTimeInputError,
  canDeleteEntry,
  deleteOwnEntry,
  fetchDate,
  fetchEntriesOfDates,
  fetchStopsOfDate,
  recordDate,
  updateStop,
} from '../../src/services/dateRecordApi.ts'
import { kstTimeOf, photoFromPickerAsset } from '../../src/utils/dateRecord.ts'
import { printer } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// deno-lint-ignore no-explicit-any
type Db = any

// 1x1 투명 PNG
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

async function main(): Promise<void> {
  const ops = await connectOps()
  const say = printer(ops.secrets)
  const admin: Db = ops.client
  const url = Deno.env.get('ONDOLOG_SUPABASE_URL') as string
  const anon = Deno.env.get('ONDOLOG_SUPABASE_ANON_KEY')
  if (!anon) throw new Error('환경변수 ONDOLOG_SUPABASE_ANON_KEY가 없다')
  const out: string[] = []
  const line = (s: string) => {
    out.push(s)
    say(s)
  }
  let failures = 0
  const verdict = (name: string, ok: boolean, detail: string) => {
    if (!ok) failures += 1
    line(`${ok ? 'OK  ' : 'FAIL'} ${name} - ${detail}`)
  }

  // ── 준비(service_role) - 56-의 시험 계정·커플을 그대로 쓴다 ───────────────
  const emails = { a: 'test-u2-a@example.com', b: 'test-u2-b@example.com' }
  const ids: Record<string, string> = {}
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  for (const [role, email] of Object.entries(emails)) {
    const id = listed.data?.users?.find((u: { email?: string }) => u.email === email)?.id as string | undefined
    if (!id) throw new Error(`시험 계정이 없다(${email}) - verifyU2Record.ts를 먼저 실행한다`)
    ids[role] = id
  }
  const { data: couple } = await admin.from('couples').select('id').eq('nickname', 'test-u2').maybeSingle()
  if (!couple) throw new Error('시험 커플(test-u2)이 없다')
  const coupleId: string = couple.id

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

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
  // 날짜는 실행마다 다르게(unique (couple, date_on)) - 2027년 안에서 stamp로 고른다.
  const day = 1 + (Number(stamp.slice(-6)) % 27)
  const month = 1 + (Number(stamp.slice(-8, -6)) % 12)
  const dateOn = `2027-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const exif = (t: string) => ({
    DateTimeOriginal: `${dateOn.replace(/-/g, ':')} ${t}`,
  })
  const asset = (n: number, t: string) => ({
    uri: `file:///test-57c/${stamp}-${n}.png`,
    width: 1,
    height: 1,
    fileSize: PNG.byteLength,
    mimeType: 'image/png',
    exif: exif(t),
  })
  const deps = {
    readBytes: () => Promise.resolve(PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength) as ArrayBuffer),
    newId: () => crypto.randomUUID(),
  }
  line(`[준비] 커플=${coupleId} · 날짜=${dateOn} · A=${ids.a} · B=${ids.b}`)

  // ── 1. stop 시각 규칙 ────────────────────────────────────────────────────
  // 둘째 장소 시각 없음 -> 거부, 업로드·행 0
  const { count: datesBefore } = await admin.from('dates').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('date_on', dateOn)
  let rejected: unknown = null
  try {
    await recordDate(dbA, deps, {
      coupleId,
      userId: ids.a,
      dateOn,
      places: [{ name: 'test 첫 장소', arrivalClock: '10:00' }, { name: 'test 둘째 장소' }],
      photos: [photoFromPickerAsset(asset(0, '11:00:00'))],
      memo: '',
    })
  } catch (e) {
    rejected = e
  }
  const { count: datesAfterReject } = await admin.from('dates').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('date_on', dateOn)
  verdict(
    '시험 2: 장소 2 · 둘째 시각 없음 -> 저장 불가',
    rejected instanceof StopTimeInputError && datesBefore === datesAfterReject,
    `error=${rejected instanceof Error ? rejected.message : rejected} · 데이트 행 ${datesBefore} -> ${datesAfterReject}`,
  )

  // 장소 1 · 시각 없음 · 사진 있음(촬영 시각 14:05:40, 15:30:10) -> 가장 이른 촬영 시각
  const photosA = [photoFromPickerAsset(asset(1, '15:30:10')), photoFromPickerAsset(asset(2, '14:05:40'))]
  const rec = await recordDate(dbA, deps, {
    coupleId,
    userId: ids.a,
    dateOn,
    places: [{ name: 'test 홍대 카페' }],
    photos: photosA,
    memo: 'test 57-C 메모 (A)',
  })
  const stops = await fetchStopsOfDate(dbB, rec.dateId)
  verdict(
    '시험 1: 장소 1 · 시각 없음 · 사진 있음 -> 가장 이른 촬영 시각',
    stops.length === 1 && stops[0].arrived_at.startsWith(dateOn) && kstTimeOf(stops[0].arrived_at) === '14:05',
    `stops=${JSON.stringify(stops)}`,
  )

  // B도 같은 날에 사진 하나를 올린다(삭제 진입 확인용)
  const recB = await recordDate(dbB, deps, {
    coupleId,
    userId: ids.b,
    dateOn,
    places: [],
    photos: [photoFromPickerAsset(asset(3, '16:00:00'))],
    memo: '',
  })

  // 시험 4: 실제 00:00 입력 -> 00:00으로 저장·표시
  const stop = stops[0]
  await updateStop(dbA, {
    stopId: stop.id,
    dateId: rec.dateId,
    dateOn,
    userId: ids.a,
    placeName: 'test 홍대 카페',
    arrivalClock: '00:00',
  })
  const midnight = (await fetchStopsOfDate(dbA, rec.dateId))[0]
  verdict(
    '시험 4: 실제 00:00 입력 -> 00:00으로 표시',
    kstTimeOf(midnight.arrived_at) === '00:00',
    `arrived_at=${midnight.arrived_at} -> 표시 ${kstTimeOf(midnight.arrived_at)}`,
  )
  // 되돌림: 시각을 비워 가장 이른 촬영 시각으로 (첫 stop은 비울 수 있다)
  await updateStop(dbA, { stopId: stop.id, dateId: rec.dateId, dateOn, userId: ids.a, placeName: 'test 홍대 카페', arrivalClock: null })
  const restored = (await fetchStopsOfDate(dbA, rec.dateId))[0]
  verdict('E15: 첫 stop 시각을 비우면 가장 이른 촬영 시각', kstTimeOf(restored.arrived_at) === '14:05', `arrived_at=${restored.arrived_at}`)

  // ── 2. 본인 기록 삭제 ────────────────────────────────────────────────────
  const beforeA = await fetchEntriesOfDates(dbA, [rec.dateId])
  const beforeB = await fetchEntriesOfDates(dbB, [rec.dateId])
  const target = rec.photoEntryIds[0]
  const bPhoto = recB.photoEntryIds[0]
  line(`[삭제 전] A 조회 ${beforeA.length}건 · B 조회 ${beforeB.length}건 (사진 ${beforeA.filter((e) => e.entry_type === 'photo').length}, 메모 ${beforeA.filter((e) => e.entry_type === 'memo').length})`)

  // 삭제 진입: A가 보는 화면에서 A의 사진에는 있고 B의 사진에는 없다
  const viewA = beforeA.map((e) => ({ id: e.id, author: e.author_id === ids.a ? 'A' : 'B', canDelete: canDeleteEntry(e, ids.a) }))
  line(`[A 화면의 삭제 진입] ${JSON.stringify(viewA)}`)
  verdict(
    'A 화면: A의 항목에는 삭제 진입이 있고 B의 항목에는 없다',
    viewA.every((v) => v.canDelete === (v.author === 'A')) && viewA.some((v) => v.author === 'B'),
    `A의 항목 ${viewA.filter((v) => v.author === 'A').length}건 진입 있음 · B의 항목 ${viewA.filter((v) => v.author === 'B').length}건 진입 없음`,
  )
  const viewB = beforeB.map((e) => ({ id: e.id, author: e.author_id === ids.a ? 'A' : 'B', canDelete: canDeleteEntry(e, ids.b) }))
  verdict('B 화면: A의 항목에는 삭제 진입이 없다', viewB.filter((v) => v.author === 'A').every((v) => !v.canDelete), JSON.stringify(viewB))

  // A가 B의 사진을 RPC로 지우려 하면 거부(진입이 없다는 것과 별개로 서버가 막는다)
  const denied = await deleteOwnEntry(dbA, bPhoto).then(
    () => 'no-error',
    (e: Error) => e.message,
  )
  verdict('A가 B의 사진을 RPC로 지우려 함 -> 거부', denied !== 'no-error', denied)

  // A가 자기 사진 삭제 - 앱과 같은 함수(RPC)
  const deleted = await deleteOwnEntry(dbA, target)
  verdict('A가 자기 사진 삭제 -> 성공', deleted === true, `fn_delete_own_entry 반환 ${deleted}`)
  const afterA = await fetchEntriesOfDates(dbA, [rec.dateId])
  const afterB = await fetchEntriesOfDates(dbB, [rec.dateId])
  verdict('A 화면(조회)에서 사라짐', !afterA.some((e) => e.id === target) && afterA.length === beforeA.length - 1, `A 조회 ${beforeA.length} -> ${afterA.length}`)
  verdict('B 화면(조회)에서 사라짐', !afterB.some((e) => e.id === target) && afterB.length === beforeB.length - 1, `B 조회 ${beforeB.length} -> ${afterB.length}`)
  verdict('B의 사진은 남아 있다', afterA.some((e) => e.id === bPhoto), `bPhoto=${bPhoto}`)
  const date = await fetchDate(dbB, rec.dateId)
  const { data: rawRow } = await admin.from('data_entries').select('id, deleted_at, storage_path').eq('id', target).single()
  verdict('행은 지우지 않고 deleted_at만 채운다(소프트 삭제)', rawRow?.deleted_at !== null && rawRow?.storage_path !== null, JSON.stringify(rawRow))
  const photosLeft = afterA.filter((e) => e.entry_type === 'photo').length
  verdict('데이트 파생 칸이 맞춰짐(photo_count)', date?.photo_count === photosLeft, `photo_count=${date?.photo_count} · 남은 사진=${photosLeft}`)

  // ── 3. KST 00:00 표시 값으로 저장된 stop 조회 ───────────────────────────
  const { data: allStops } = await admin.from('date_stops').select('id, date_id, couple_id, seq, arrived_at, place_name')
  const midnightStops = ((allStops ?? []) as { id: string; date_id: string; couple_id: string; seq: number; arrived_at: string; place_name: string | null }[]).filter(
    (s) => {
      const t = new Date(Date.parse(s.arrived_at) + 9 * 3600_000).toISOString().slice(11, 19)
      return t === '00:00:00'
    },
  )
  line(`[항목 11] 전체 stop ${allStops?.length ?? 0}건 중 KST 00:00:00 = ${midnightStops.length}건`)
  for (const s of midnightStops) line(`[항목 11] 00:00 stop: ${JSON.stringify(s)}`)
  if (midnightStops.length === 0) line('[항목 11] 결과: 없음')

  line(`[요약] 실패 ${failures}건`)
  await Deno.writeTextFile('scripts/ops/out/57-c-delete-and-stop-time.txt', out.join('\n') + '\n')
  if (failures > 0) Deno.exit(1)
}

if (Deno.args[0] === 'run') await main()
else console.log('사용: verifyU2Delete.ts run')
