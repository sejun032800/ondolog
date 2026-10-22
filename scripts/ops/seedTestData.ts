/**
 * 시험 데이터 준비 - 원격 **개발** DB·스토리지에 M2-b·M2-e용 시험 커플을 만든다 (Deno 전용, service_role).
 * 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * ── 규칙 ───────────────────────────────────────────────────────────────────
 * - **이름에 `test`를 넣는다**(R13-7): 계정 이메일·`profiles.display_name`·`couples.nickname`.
 * - **실제 사람의 대화를 쓰지 않는다.** 채팅·데이트·사진 원본은 `50-` 합성 데이터셋(`fixtures/m1-month`)이다.
 * - 개발 프로젝트가 아니면 접속 전에 멈춘다(`connectOps`).
 * - **만든 행·파일은 ID와 경로로 목록을 남긴다. 지우지 않는다.** 목록: `scripts/ops/out/seed-m2b.json`.
 * - 계정에는 비밀번호가 없다(로그인할 수 없다). 출력 어디에도 비밀값이 없다.
 *
 * 만드는 커플 넷
 *   A  full dataset, 활성 - 생성 명령의 시험 대상(초안으로 남긴다. 조판 `55-`의 입력)
 *   B  full dataset, 활성, magazine_theme = 'neon' - 생성 -> 발행 정상 흐름(M2-e)
 *   C  해제 유예(dissolving) - "커플 비활성" 예외용 초안 호
 *   F  활성 - 예외·동시 발행용 초안 호 넷(열린 경보 · ready 없음 · 동시 둘). 내용은 형식 검증용 자리표시다
 *
 * 사용 (저장소 루트에서):
 *   deno run --no-lock --config supabase/functions/deno.json \
 *     --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=<프로젝트 ref>.supabase.co \
 *     --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out \
 *     scripts/ops/seedTestData.ts run
 */

import { buildTables, COUPLE_ID, SEJUN_ID, SEOYOUNG_ID } from './fixtures/m1-month/dataset.ts'
import { printer, writeJson } from './opsCli.ts'
import { connectOps } from './supabaseOps.ts'

// ---------------------------------------------------------------------------
// PNG - 의존성 없이 단색 이미지를 만든다(원본 사진·그림 자리표시)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function solidPng(width: number, height: number, rgb: readonly [number, number, number]): Promise<Uint8Array> {
  const row = new Uint8Array(1 + width * 3)
  for (let x = 0; x < width; x += 1) row.set(rgb, 1 + x * 3)
  const raw = new Uint8Array(row.length * height)
  for (let y = 0; y < height; y += 1) raw.set(row, y * row.length)
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, width)
  v.setUint32(4, height)
  ihdr[8] = 8 // 비트 깊이
  ihdr[9] = 2 // RGB
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const PALETTE: readonly (readonly [number, number, number])[] = [
  [232, 168, 124],
  [133, 169, 190],
  [168, 196, 150],
  [196, 150, 168],
  [214, 196, 124],
  [150, 150, 196],
]

// ---------------------------------------------------------------------------
// 데이터
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

const NOW = new Date().toISOString()

interface SeedLog {
  users: { id: string; email: string; role: string }[]
  couples: { label: string; id: string; nickname: string; status: string }[]
  issues: { label: string; id: string; coupleLabel: string; periodStart: string }[]
  corners: { id: string; issueLabel: string; cornerType: string; status: string }[]
  alerts: { id: string; issueLabel: string }[]
  rowIds: Record<string, string[]>
  storage: { bucket: string; path: string }[]
}

const log: SeedLog = { users: [], couples: [], issues: [], corners: [], alerts: [], rowIds: {}, storage: [] }
const remember = (table: string, ids: string[]) => {
  log.rowIds[table] = [...(log.rowIds[table] ?? []), ...ids]
}

const { client, secrets, projectRef } = await connectOps()
const say = printer(secrets)
say(`접속 대상: 개발 프로젝트 ondolog (${projectRef}) - 확인됨`)

function must<T>(what: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error !== null || result.data === null) throw new Error(`${what}: ${result.error?.message ?? '결과 없음'}`)
  return result.data
}

async function createUser(role: string, displayName: string, gender: 'male' | 'female'): Promise<string> {
  const email = `test-m2b-${role}@example.com`
  let id: string
  const created = await client.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } })
  if (created.error) {
    // 앞선 실행이 도중에 멈춰 계정만 남았다면 그 계정을 이어 쓴다(이름이 test인 시험 계정만 찾는다).
    const listed = await client.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = listed.data?.users?.find((u: { email?: string }) => u.email === email)
    if (found === undefined) throw new Error(`계정 생성 실패 (${role}): ${created.error.message}`)
    id = found.id
  } else {
    id = created.data.user.id
  }
  log.users.push({ id, email, role })
  must(
    `profiles 삽입 (${role})`,
    await client
      .from('profiles')
      .insert({
        id,
        display_name: displayName,
        gender,
        birth_date: '1999-01-01',
        onboarding_step: 3,
        terms_agreed_at: NOW,
        privacy_agreed_at: NOW,
        ai_usage_agreed_at: NOW,
      })
      .select('id')
      .single(),
  )
  remember('profiles', [id])
  return id
}

async function createCouple(
  label: string,
  inviteCode: string,
  userA: string,
  userB: string,
  status: 'active' | 'dissolving',
  extra: Row = {},
): Promise<string> {
  const nickname = `test-m2b-${label}`
  const data = must(
    `couples 삽입 (${label})`,
    await client
      .from('couples')
      .insert({ user_a_id: userA, user_b_id: userB, invite_code: inviteCode, nickname, status, connected_at: NOW, ...extra })
      .select('id')
      .single(),
  ) as { id: string }
  log.couples.push({ label, id: data.id, nickname, status })
  remember('couples', [data.id])
  return data.id
}

async function upload(bucket: string, path: string, bytes: Uint8Array): Promise<void> {
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(`storage 업로드 실패 (${bucket}/${path}): ${error.message}`)
  log.storage.push({ bucket, path })
}

async function insertRows(table: string, rows: Row[], chunkSize = 100): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const { error } = await client.from(table).insert(rows.slice(i, i + chunkSize))
    if (error) throw new Error(`${table} 삽입 실패: ${error.message}`)
  }
  remember(table, rows.map((r) => String(r.id)))
}

/** 50- 합성 데이터셋을 한 커플에게 심는다. 사진·그림 원본은 `entries` 버킷에 올린다. */
async function loadDataset(coupleId: string, sejunId: string, seoyoungId: string): Promise<void> {
  const t = buildTables()
  const uuid = new Map<string, string>()
  const idOf = (key: string): string => {
    const v = uuid.get(key) ?? crypto.randomUUID()
    uuid.set(key, v)
    return v
  }
  const user = (key: unknown) => (key === SEJUN_ID ? sejunId : key === SEOYOUNG_ID ? seoyoungId : String(key))
  const orNull = (v: unknown) => (typeof v === 'string' ? idOf(v) : null)

  await insertRows(
    'dates',
    t.dates.map((d) => ({
      id: idOf(String(d.id)),
      couple_id: coupleId,
      date_on: d.date_on,
      region: d.region,
      photo_count: d.photo_count,
      last_featured_at: null,
    })),
  )
  await insertRows(
    'date_stops',
    t.date_stops.map((s) => ({
      id: idOf(String(s.id)),
      date_id: idOf(String(s.date_id)),
      couple_id: coupleId,
      seq: s.seq,
      arrived_at: s.arrived_at,
      place_name: s.place_name,
      lat: s.lat,
      lng: s.lng,
    })),
  )

  const entries: Row[] = []
  let n = 0
  for (const e of t.data_entries) {
    const id = idOf(String(e.id))
    n += 1
    const row: Row = {
      id,
      couple_id: coupleId,
      author_id: user(e.author_id),
      date_id: orNull(e.date_id),
      date_stop_id: orNull(e.date_stop_id),
      entry_type: e.entry_type,
      storage_path: null,
      thumb_path: null,
      width: null,
      height: null,
      text_content: e.text_content,
      drawing_path: null,
      captured_at: e.captured_at,
      created_at: e.created_at,
      access_locked: false,
    }
    if (e.entry_type === 'photo') {
      const landscape = Number(e.width) > Number(e.height)
      const [w, h] = landscape ? [400, 300] : [300, 400]
      const path = `${coupleId}/${id}.png`
      await upload('entries', path, await solidPng(w, h, PALETTE[n % PALETTE.length]))
      row.storage_path = path
      row.width = w
      row.height = h
    } else if (e.entry_type === 'drawing') {
      const path = `${coupleId}/${id}.png`
      await upload('entries', path, await solidPng(300, 300, PALETTE[n % PALETTE.length]))
      row.drawing_path = path
    }
    entries.push(row)
  }
  await insertRows('data_entries', entries)

  await insertRows(
    'messages',
    t.messages.map((m) => ({
      id: crypto.randomUUID(),
      couple_id: coupleId,
      sender_id: user(m.sender_id),
      body: m.body,
      sent_at: m.sent_at,
    })),
  )
}

async function createIssue(
  label: string,
  coupleLabel: string,
  coupleId: string,
  periodStart: string,
  periodEnd: string,
): Promise<string> {
  const data = must(
    `issues 삽입 (${label})`,
    await client
      .from('issues')
      .insert({ couple_id: coupleId, issue_type: 'monthly', period_start: periodStart, period_end: periodEnd, publish_mode: 'compressed' })
      .select('id')
      .single(),
  ) as { id: string }
  log.issues.push({ label, id: data.id, coupleLabel, periodStart })
  remember('issues', [data.id])
  return data.id
}

async function createCorner(
  issueLabel: string,
  coupleId: string,
  issueId: string,
  periodStart: string,
  periodEnd: string,
  cornerType: string,
  seq: number,
  status: string,
  sourceDateIds: string[] = [],
): Promise<void> {
  const data = must(
    `corners 삽입 (${issueLabel}/${cornerType})`,
    await client
      .from('corners')
      .insert({
        couple_id: coupleId,
        issue_id: issueId,
        corner_type: cornerType,
        seq,
        period_start: periodStart,
        period_end: periodEnd,
        status,
        content: status === 'ready' ? { fixture: 'm2e-verify' } : {},
        source_date_ids: sourceDateIds,
        engine_version: 'fixture-m2e',
      })
      .select('id')
      .single(),
  ) as { id: string }
  log.corners.push({ id: data.id, issueLabel, cornerType, status })
  remember('corners', [data.id])
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

if (Deno.args[0] !== 'run') throw new Error('사용: run')

// 도중에 실패해도 그때까지 만든 행·파일의 목록은 남긴다(지우지 않는다 - 목록이 있어야 정리할 수 있다).
try {
  // A·B: 합성 데이터셋 한 달(2026-09). 생성 명령이 초안을 만든다.
  const a1 = await createUser('a1', 'test-세준', 'male')
  const a2 = await createUser('a2', 'test-서영', 'female')
  const coupleA = await createCouple('A', 'TESTA001', a1, a2, 'active')
  await loadDataset(coupleA, a1, a2)

  const b1 = await createUser('b1', 'test-세준', 'male')
  const b2 = await createUser('b2', 'test-서영', 'female')
  const coupleB = await createCouple('B', 'TESTB001', b1, b2, 'active', { magazine_theme: 'neon' })
  await loadDataset(coupleB, b1, b2)

  // C: 해제 유예 - 비활성 예외용
  const c1 = await createUser('c1', 'test-c1', 'male')
  const c2 = await createUser('c2', 'test-c2', 'female')
  const coupleC = await createCouple('C', 'TESTC001', c1, c2, 'dissolving')
  const issueC = await createIssue('C-inactive', 'C', coupleC, '2026-07-01', '2026-07-31')
  await createCorner('C-inactive', coupleC, issueC, '2026-07-01', '2026-07-31', 'date_archive', 1, 'ready')

  // F: 예외·동시 발행용
  const f1 = await createUser('f1', 'test-f1', 'male')
  const f2 = await createUser('f2', 'test-f2', 'female')
  const coupleF = await createCouple('F', 'TESTF001', f1, f2, 'active')
  const dateF = must(
    'dates 삽입 (F)',
    await client
      .from('dates')
      .insert({ couple_id: coupleF, date_on: '2026-04-10', region: 'test-region', photo_count: 0 })
      .select('id')
      .single(),
  ) as { id: string }
  remember('dates', [dateF.id])

  const issueAlert = await createIssue('F-open-alert', 'F', coupleF, '2026-05-01', '2026-05-31')
  await createCorner('F-open-alert', coupleF, issueAlert, '2026-05-01', '2026-05-31', 'date_archive', 1, 'ready', [dateF.id])
  const alert = must(
    'ops_alerts 삽입 (F)',
    await client
      .from('ops_alerts')
      .insert({
        kind: 'usage_over',
        couple_id: coupleF,
        issue_id: issueAlert,
        detail: { stage: 'input_halt', cornerType: 'this_month', estimatedInputTokens: 41000, limit: 40000, fixture: true },
      })
      .select('id')
      .single(),
  ) as { id: string }
  log.alerts.push({ id: alert.id, issueLabel: 'F-open-alert' })
  remember('ops_alerts', [alert.id])

  const issueNoReady = await createIssue('F-no-ready', 'F', coupleF, '2026-06-01', '2026-06-30')
  await createCorner('F-no-ready', coupleF, issueNoReady, '2026-06-01', '2026-06-30', 'date_archive', 1, 'failed')
  await createCorner('F-no-ready', coupleF, issueNoReady, '2026-06-01', '2026-06-30', 'sweet_words', 2, 'pending')

  for (const [label, start, end] of [
    ['F-concurrent-1', '2026-07-01', '2026-07-31'],
    ['F-concurrent-2', '2026-08-01', '2026-08-31'],
  ] as const) {
    const id = await createIssue(label, 'F', coupleF, start, end)
    await createCorner(label, coupleF, id, start, end, 'date_archive', 1, 'ready', [dateF.id])
  }

  say(`계정 ${log.users.length} · 커플 ${log.couples.length} · 호 ${log.issues.length} · 코너 ${log.corners.length} · 경보 ${log.alerts.length} · 스토리지 객체 ${log.storage.length}`)
  for (const c of log.couples) say(`커플 ${c.label}: ${c.id} (${c.nickname}, ${c.status})`)
  for (const i of log.issues) say(`호 ${i.label}: ${i.id}`)
  say('목록 파일: scripts/ops/out/seed-m2b.json')
} finally {
  await writeJson('scripts/ops/out/seed-m2b.json', log, secrets)
}
