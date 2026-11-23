/**
 * @jest-environment node
 */
/// <reference types="jest" />
/**
 * 78- 발송 핵심(`pushSend.ts`) 시험 - 가짜 FCM · 가짜 Google 토큰 끝점 · 가짜 DB(push_context / push_drop_token). 원격 0.
 * 본문 규칙 · 원문 0 · 설정 끔 0 · 유예 · 해제 0 · 잘못된 토큰 정리 · 인증 실패 거부 · 연속 메시지 3건 태그 · collapse key 같음 · 변경 안내 태그 다름 ·
 * 접근 토큰 발급 · 캐시 · 서명 검증 · 로그에 토큰 · 본문 · id 0.
 */
import {
  AccessTokenCache, GOOGLE_TOKEN_URL, PUSH_CHANNEL, REALERT_GAP_MS, burstStart, burstTag, fcmMessage, handlePush, parseServiceAccount, pushBody, pushTag, signServiceJwt,
  type PushContext, type PushDeps, type PushKind, type PushRequest, type Transport,
} from './pushSend.ts'

const COUPLE = '11111111-2222-4333-8444-555555555555'
const ACTOR = '66666666-7777-4888-9999-aaaaaaaaaaaa'
const SECRET = 'trigger-secret'

type Sent = { url: string; headers: Record<string, string>; body: any } // eslint-disable-line @typescript-eslint/no-explicit-any

function req(body: unknown, headers: Record<string, string> = { 'x-ondolog-push': SECRET }, method = 'POST'): PushRequest {
  return { method, header: (n) => headers[n.toLowerCase()] ?? null, json: async () => body }
}

/** 가짜 DB: 비밀이 맞을 때만 ctx. 받는 사람 판정은 ctxFor가 정한다(실제 판정은 PGlite 시험). */
function harness(ctxFor: (kind: PushKind) => PushContext = () => ({ ok: true, sender_name: '서영', tokens: [{ id: 't1', token: 'tok-1', platform: 'android' }] }), fcmStatus: (token: string) => { status: number; body?: unknown } = () => ({ status: 200 })) {
  const sent: Sent[] = []
  const dropped: string[] = []
  const logs: string[] = []
  const transport: Transport = async (url, init) => {
    const body = JSON.parse(init.body)
    sent.push({ url, headers: init.headers, body })
    const r = fcmStatus(body.message.token)
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body ?? {} }
  }
  const deps: PushDeps = {
    context: async (secret, kind) => (secret === SECRET ? ctxFor(kind) : { ok: false }),
    dropToken: async (secret, id) => {
      if (secret === SECRET) dropped.push(id)
    },
    accessToken: async () => 'access-1',
    transport,
    projectId: 'proj',
    log: (l) => logs.push(l),
  }
  return { deps, sent, dropped, logs }
}

/** Buffer 없이(함수 tsconfig에 node 타입 없음) base64 · base64url. */
const toB64 = (bytes: Uint8Array): string => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
const fromB64Url = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const msg = (extra: Record<string, unknown> = {}) => ({ kind: 'message', couple_id: COUPLE, actor_id: ACTOR, photo: false, ...extra })

describe('본문 규칙(R100-4 · R99-1)', () => {
  it('네 가지 문장 · 이름이 없으면 "상대"', () => {
    expect(pushBody('message', '서영', false)).toBe('서영님이 메시지를 보냈어요')
    expect(pushBody('message', '서영', true)).toBe('서영님이 사진을 보냈어요')
    expect(pushBody('date', '서영', false)).toBe('서영님이 사귄 날짜를 바꿨어요')
    expect(pushBody('nickname', '서영', true)).toBe('서영님이 커플 닉네임을 바꿨어요')
    expect(pushBody('message', '  ', false)).toBe('상대님이 메시지를 보냈어요')
    expect(pushBody('message', null, false)).toBe('상대님이 메시지를 보냈어요')
  })

  it('FCM으로 가는 것은 정해진 문장뿐 - 요청에 원문 · 새 값이 섞여 와도 싣지 않는다', async () => {
    const h = harness()
    const r = await handlePush(req(msg({ body: '퇴근하고 전화할게', nickname: '새벽' })), h.deps)
    expect(r.status).toBe(200)
    expect(h.sent).toHaveLength(1)
    const wire = JSON.stringify(h.sent[0].body)
    expect(wire).not.toContain('퇴근')
    expect(wire).not.toContain('새벽')
    expect(h.sent[0].body.message.notification).toEqual({ body: '서영님이 메시지를 보냈어요' })
    expect(h.sent[0].body.message.data).toEqual({ kind: 'message', route: 'chat' })
    expect(h.sent[0].url).toBe('https://fcm.googleapis.com/v1/projects/proj/messages:send')
    expect(h.sent[0].headers.Authorization).toBe('Bearer access-1')
  })

  it('사진 메시지 · 변경 안내 두 가지(누르면 메인)', async () => {
    const h = harness()
    await handlePush(req(msg({ photo: true })), h.deps)
    await handlePush(req(msg({ kind: 'date', photo: true })), h.deps)
    await handlePush(req(msg({ kind: 'nickname' })), h.deps)
    expect(h.sent.map((s) => s.body.message.notification.body)).toEqual(['서영님이 사진을 보냈어요', '서영님이 사귄 날짜를 바꿨어요', '서영님이 커플 닉네임을 바꿨어요'])
    expect(h.sent.map((s) => s.body.message.data.route)).toEqual(['chat', 'main', 'main'])
  })
})

describe('쌓임 방지(R109-2)', () => {
  it('연속 메시지 3건 -> 태그 · collapse key 같음 · 변경 안내 태그는 다름 · 채널 다름', async () => {
    const h = harness()
    for (let i = 0; i < 3; i++) await handlePush(req(msg({ photo: i === 1 })), h.deps)
    await handlePush(req(msg({ kind: 'date' })), h.deps)
    await handlePush(req(msg({ kind: 'nickname' })), h.deps)
    const a = h.sent.map((s) => s.body.message.android)
    expect(new Set(a.slice(0, 3).map((x) => x.notification.tag)).size).toBe(1)
    expect(new Set(a.slice(0, 3).map((x) => x.collapse_key)).size).toBe(1)
    expect(a[0].collapse_key).toBe(a[0].notification.tag)
    expect(a[0].notification.tag).toBe(pushTag('message', COUPLE))
    expect(a[3].notification.tag).not.toBe(a[0].notification.tag)
    expect(a[4].notification.tag).not.toBe(a[0].notification.tag)
    expect(a[3].notification.tag).not.toBe(a[4].notification.tag)
    expect(a[0].notification.channel_id).toBe(PUSH_CHANNEL.message)
    expect(a[3].notification.channel_id).toBe(PUSH_CHANNEL.change)
    // iOS 확장 지점: 같은 태그를 APNs 묶음 키로
    expect(h.sent[0].body.message.apns.headers['apns-collapse-id']).toBe(a[0].notification.tag)
  })

  it('태그는 64바이트 안(APNs collapse id 한도)', () => {
    for (const k of ['message', 'date', 'nickname'] as PushKind[]) expect(new TextEncoder().encode(pushTag(k, COUPLE)).length).toBeLessThanOrEqual(64)
    expect(fcmMessage('t', 'message', 'b', COUPLE)).toHaveProperty('message.android.priority', 'HIGH')
  })
})

describe('다시 울림(81-b · R118-4) - 10분 안 연타는 조용히, 10분 넘은 공백 뒤 첫 알림은 새 태그(울림)', () => {
  const T0 = Date.parse('2026-11-17T09:00:00Z')
  const iso = (ms: number) => new Date(ms).toISOString()
  /** 보낸 사람의 메시지 시각(서버 행) - 함수가 읽는 것은 이것뿐. 시계는 주입(실제 시계 0). */
  function realertHarness(clock = T0) {
    const h = harness()
    const sentTimes: number[] = []
    let now = clock
    h.deps.recentMessageTimes = async (coupleId, actorId) => {
      expect([coupleId, actorId]).toEqual([COUPLE, ACTOR])
      return [...sentTimes].sort((a, b) => b - a).map(iso)
    }
    h.deps.nowMs = () => now
    const send = async (atMs: number, extra: Record<string, unknown> = {}) => {
      sentTimes.push(atMs)
      now = atMs
      await handlePush(req(msg(extra)), h.deps)
      return h.sent[h.sent.length - 1].body.message
    }
    const change = async (kind: 'date' | 'nickname', atMs: number) => {
      now = atMs
      await handlePush(req(msg({ kind })), h.deps)
      return h.sent[h.sent.length - 1].body.message
    }
    return { h, send, change }
  }
  const tagOf = (m: { android: { notification: { tag: string }; collapse_key: string } }) => m.android.notification.tag

  it('10분 안 연타 3건 -> 같은 태그(조용히 갈아 끼움) · collapse key · APNs collapse id 같음 · 다시 울림 표시 0', async () => {
    const r = realertHarness()
    const a = await r.send(T0)
    const b = await r.send(T0 + 60_000)
    const c = await r.send(T0 + 9 * 60_000)
    expect(new Set([a, b, c].map(tagOf)).size).toBe(1)
    expect(new Set([a, b, c].map((m) => m.android.collapse_key)).size).toBe(1)
    expect(new Set([a, b, c].map((m) => m.apns.headers['apns-collapse-id'])).size).toBe(1)
    expect(tagOf(a)).toBe(burstTag('message', COUPLE, T0))
    for (const m of [a, b, c]) expect(JSON.stringify(m)).not.toMatch(/realert|sound|notification_count/)
  })

  it('직전 알림 뒤 10분 1초 -> 새 태그(울림) · 그 뒤 10분 안은 다시 그 태그', async () => {
    const r = realertHarness()
    const a = await r.send(T0)
    const b = await r.send(T0 + REALERT_GAP_MS + 1000)
    const c = await r.send(T0 + REALERT_GAP_MS + 1000 + 5 * 60_000)
    expect(tagOf(b)).not.toBe(tagOf(a))
    expect(tagOf(b)).toBe(burstTag('message', COUPLE, T0 + REALERT_GAP_MS + 1000))
    expect(tagOf(c)).toBe(tagOf(b))
    // 서랍 한 줄기(iOS thread-id)는 같은 묶음 이름
    expect(b.apns.payload.aps['thread-id']).toBe(pushTag('message', COUPLE))
    expect(b.apns.headers['apns-collapse-id']).toBe(tagOf(b))
  })

  it('정확히 10분 경계 -> 같은 태그(조용히) · 10분 + 1ms -> 새 태그', async () => {
    expect(burstStart([iso(T0 + REALERT_GAP_MS), iso(T0)])).toBe(T0)
    expect(burstStart([iso(T0 + REALERT_GAP_MS + 1), iso(T0)])).toBe(T0 + REALERT_GAP_MS + 1)
    const r = realertHarness()
    const a = await r.send(T0)
    const b = await r.send(T0 + REALERT_GAP_MS)
    expect(tagOf(b)).toBe(tagOf(a))
  })

  it('긴 대화(10분 안 간격으로 계속)는 처음 시각 하나로 · 공백 계산은 서버 행 시각만(순서 섞여 와도 같음)', () => {
    const times = [0, 9, 18, 27, 36].map((m) => iso(T0 + m * 60_000)).reverse()
    expect(burstStart(times)).toBe(T0)
    expect(burstStart([])).toBeNull()
    expect(burstStart(['깨진 시각'])).toBeNull()
  })

  it('메시지와 변경 안내 묶음은 서로 영향 0 · 변경 안내는 매번 새 태그(울림)', async () => {
    const r = realertHarness()
    const a = await r.send(T0)
    const d1 = await r.change('date', T0 + 60_000)
    const b = await r.send(T0 + 2 * 60_000)
    const d2 = await r.change('date', T0 + 3 * 60_000)
    const n1 = await r.change('nickname', T0 + 3 * 60_000)
    expect(tagOf(b)).toBe(tagOf(a)) // 변경 안내가 끼어도 메시지 연타는 그대로 조용히
    expect(tagOf(d1)).not.toBe(tagOf(d2))
    expect(tagOf(d1).startsWith(pushTag('date', COUPLE))).toBe(true)
    expect(tagOf(n1).startsWith(pushTag('nickname', COUPLE))).toBe(true)
    expect(tagOf(n1)).not.toBe(tagOf(d2))
    for (const m of [d1, d2, n1]) expect(m.android.notification.channel_id).toBe(PUSH_CHANNEL.change)
  })

  it('시각을 못 읽으면 78- 묶음 이름 그대로 보내고(발송은 막지 않음) 로그에 realert=err만', async () => {
    const h = harness()
    h.deps.recentMessageTimes = async () => { throw new Error('db') }
    const r = await handlePush(req(msg()), h.deps)
    expect(r.body).toEqual({ sent: 1, dropped: 0, failed: 0 })
    expect(h.sent[0].body.message.android.notification.tag).toBe(pushTag('message', COUPLE))
    expect(h.logs).toEqual(['push-send status=200 sent=1 dropped=0 failed=0 realert=err'])
  })

  it('다시 울림 태그도 64바이트 안 · 받지 않는 요청(401 · 설정 끔)에서는 시각을 읽지 않음', async () => {
    for (const k of ['message', 'date', 'nickname'] as PushKind[]) {
      expect(new TextEncoder().encode(burstTag(k, COUPLE, Date.parse('2099-12-31T23:59:59Z'))).length).toBeLessThanOrEqual(64)
    }
    let reads = 0
    const off = harness(() => ({ ok: true, tokens: [] }))
    off.deps.recentMessageTimes = async () => { reads += 1; return [] }
    await handlePush(req(msg()), off.deps)
    await handlePush(req(msg(), { 'x-ondolog-push': 'wrong' }), off.deps)
    expect(reads).toBe(0)
  })
})

describe('인증 · 받는 사람', () => {
  it('비밀 헤더 없음(앱 키만 든 요청) · 틀린 비밀 -> 401 · 발송 0', async () => {
    const h = harness()
    expect((await handlePush(req(msg(), { authorization: 'Bearer app-user-jwt', apikey: 'sb_publishable_x' }), h.deps)).status).toBe(401)
    expect((await handlePush(req(msg(), { 'x-ondolog-push': 'wrong' }), h.deps)).status).toBe(401)
    expect((await handlePush(req(msg(), undefined, 'GET'), h.deps)).status).toBe(405)
    expect((await handlePush(req({ kind: 'other', couple_id: COUPLE, actor_id: ACTOR }), h.deps)).status).toBe(400)
    expect((await handlePush(req({ kind: 'message', couple_id: 'x', actor_id: ACTOR }), h.deps)).status).toBe(400)
    expect(h.sent).toHaveLength(0)
  })

  it('설정 끔 · 해제 유예 · 해제 · 탈퇴 유예 · 연결 전(= push_context 빈 목록) -> 발송 0 · 200', async () => {
    const h = harness(() => ({ ok: true, tokens: [] }))
    const r = await handlePush(req(msg()), h.deps)
    expect(r).toEqual({ status: 200, body: { sent: 0, dropped: 0, failed: 0 } })
    expect(h.sent).toHaveLength(0)
  })

  it('잘못된 토큰 정리: 404 · UNREGISTERED · SENDER_ID_MISMATCH -> 그 행 삭제, 다른 오류(500 · 400)는 남김', async () => {
    const tokens = [
      { id: 'ok', token: 'tok-ok', platform: 'android' as const },
      { id: 'gone', token: 'tok-404', platform: 'android' as const },
      { id: 'unreg', token: 'tok-unreg', platform: 'android' as const },
      { id: 'mismatch', token: 'tok-mismatch', platform: 'android' as const },
      { id: 'busy', token: 'tok-500', platform: 'android' as const },
      { id: 'bad', token: 'tok-400', platform: 'android' as const },
    ]
    const h = harness(() => ({ ok: true, sender_name: '서영', tokens }), (t) => {
      if (t === 'tok-404') return { status: 404 }
      if (t === 'tok-unreg') return { status: 400, body: { error: { details: [{ errorCode: 'UNREGISTERED' }] } } }
      if (t === 'tok-mismatch') return { status: 403, body: { error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } } }
      if (t === 'tok-500') return { status: 500 }
      if (t === 'tok-400') return { status: 400, body: { error: { details: [{ errorCode: 'INVALID_ARGUMENT' }] } } }
      return { status: 200 }
    })
    const r = await handlePush(req(msg()), h.deps)
    expect(r.body).toEqual({ sent: 1, dropped: 3, failed: 2 })
    expect(h.dropped).toEqual(['gone', 'unreg', 'mismatch'])
  })

  it('로그는 결과 코드 · 숫자만 - 토큰 · 본문 · 이름 · id · 비밀 0', async () => {
    const h = harness(() => ({ ok: true, sender_name: '서영', tokens: [{ id: 'row-id-1', token: 'tok-secret-xyz', platform: 'android' }] }), () => ({ status: 404 }))
    await handlePush(req(msg()), h.deps)
    await handlePush(req(msg(), { 'x-ondolog-push': 'wrong' }), h.deps)
    const all = h.logs.join('\n')
    expect(h.logs).toEqual(['push-send status=200 sent=0 dropped=1 failed=0 fcm=404', 'push-send status=401'])
    for (const bad of ['tok-secret', 'row-id', '서영', '메시지', COUPLE, ACTOR, SECRET, 'access-1']) expect(all).not.toContain(bad)
  })
})

describe('접근 토큰(서비스 계정 -> OAuth)', () => {
  async function fakeAccount() {
    const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
    const pem = `-----BEGIN PRIVATE KEY-----\n${toB64(pkcs8)}\n-----END PRIVATE KEY-----\n`
    const json = JSON.stringify({ type: 'service_account', project_id: 'proj', client_email: 'svc@proj.iam.example', private_key: pem })
    return { b64: toB64(new TextEncoder().encode(json)), publicKey: pair.publicKey }
  }

  it('base64 서비스 계정을 읽고 RS256 JWT를 서명한다(공개키로 검증)', async () => {
    const { b64, publicKey } = await fakeAccount()
    const sa = parseServiceAccount(b64)!
    expect(sa.project_id).toBe('proj')
    const jwt = await signServiceJwt(sa, 1_800_000_000)
    const [h, c, s] = jwt.split('.')
    const claims = JSON.parse(new TextDecoder().decode(fromB64Url(c)))
    expect(claims).toMatchObject({ iss: 'svc@proj.iam.example', aud: GOOGLE_TOKEN_URL, iat: 1_800_000_000, exp: 1_800_003_600 })
    expect(claims.scope).toBe('https://www.googleapis.com/auth/firebase.messaging')
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, fromB64Url(s), new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
    expect(parseServiceAccount('not-base64-json')).toBeNull()
    expect(parseServiceAccount(undefined)).toBeNull()
  })

  it('한 번 발급해 만료 1분 전까지 다시 쓰고, 지나면 새로 발급', async () => {
    let now = 1_000_000
    let calls = 0
    const transport: Transport = async (url) => {
      calls += 1
      expect(url).toBe(GOOGLE_TOKEN_URL)
      return { status: 200, ok: true, json: async () => ({ access_token: `a${calls}`, expires_in: 3600 }) }
    }
    const cache = new AccessTokenCache({ client_email: 'e', private_key: 'k', project_id: 'p' }, transport, () => now, async () => 'signed')
    expect(await cache.get()).toBe('a1')
    now += 3500 * 1000
    expect(await cache.get()).toBe('a1')
    now += 100 * 1000
    expect(await cache.get()).toBe('a2')
    expect(calls).toBe(2)
  })
})

describe('87- 날짜별 숫자(R148-3) - 먼저 보내고, 기록은 실패해도 삼킴', () => {
  type Counted = { kind: string; status: string; n: number }
  function counting(h: ReturnType<typeof harness>, fail: false | 'reject' | 'throw' = false) {
    const counted: Counted[] = []
    const order: string[] = []
    const transport = h.deps.transport
    h.deps.transport = async (url, init) => { order.push('fcm'); return transport(url, init) }
    h.deps.count = (kind, status, n) => {
      order.push('count')
      if (fail === 'throw') throw new Error('db down')
      if (fail === 'reject') return Promise.reject(new Error('db down'))
      counted.push({ kind, status, n })
      return Promise.resolve()
    }
    const tally = () => Object.fromEntries(counted.map((c) => [`${c.kind}|${c.status}`, c.n]))
    return { counted, order, tally }
  }
  const three = () => ({ ok: true, sender_name: '서영', tokens: [
    { id: 't1', token: 'ok', platform: 'android' as const },
    { id: 't2', token: 'dead', platform: 'android' as const },
    { id: 't3', token: 'busy', platform: 'android' as const },
  ] })
  const fcm = (t: string) => (t === 'ok' ? { status: 200 } : t === 'dead' ? { status: 404 } : { status: 500 })

  it('토큰마다 한 갈래(sent · dropped · fcm_NNN) · 종류별 · 보낸 뒤에 센다', async () => {
    const h = harness(three, fcm)
    const c = counting(h)
    const r = await handlePush(req(msg()), h.deps)
    expect(r.body).toEqual({ sent: 1, dropped: 1, failed: 1 })
    expect(c.tally()).toEqual({ 'message|sent': 1, 'message|dropped': 1, 'message|fcm_500': 1 })
    expect(c.order.indexOf('count')).toBeGreaterThan(c.order.lastIndexOf('fcm'))
  })

  it('기록이 거부 · 던짐이어도 발송 결과 그대로 · 로그 한 줄(push-count=err)만', async () => {
    for (const fail of ['reject', 'throw'] as const) {
      const h = harness(three, fcm)
      counting(h, fail)
      const r = await handlePush(req(msg()), h.deps)
      expect(r.status).toBe(200)
      expect(r.body).toEqual({ sent: 1, dropped: 1, failed: 1 })
      expect(h.sent).toHaveLength(3)
      expect(h.logs).toContain('push-count=err')
    }
  })

  it('요청 갈래: 비밀 없음 · 틀린 비밀 unauthorized · 형식 bad_request(종류 unknown) · 받는 사람 없음 no_tokens · GET method', async () => {
    const run = async (r: PushRequest, ctx?: () => PushContext) => {
      const h = harness(ctx)
      const c = counting(h)
      await handlePush(r, h.deps)
      return c.tally()
    }
    expect(await run(req(msg(), {}))).toEqual({ 'unknown|unauthorized': 1 })
    expect(await run(req(msg(), { 'x-ondolog-push': 'wrong' }))).toEqual({ 'message|unauthorized': 1 })
    expect(await run(req({ kind: 'spam', couple_id: COUPLE, actor_id: ACTOR }))).toEqual({ 'unknown|bad_request': 1 })
    expect(await run(req(msg({ kind: 'date' })), () => ({ ok: true, tokens: [] }))).toEqual({ 'date|no_tokens': 1 })
    expect(await run(req(msg(), undefined, 'GET'))).toEqual({ 'unknown|method': 1 })
  })

  it('FCM 연결 실패 send_error · 다시 울림: 공백 뒤 첫 알림 ring · 10분 안 다음 알림 collapse · 변경 안내 ring · 시각 못 읽음 realert_err', async () => {
    const h = harness(undefined, () => { throw new TypeError('net') })
    const c = counting(h)
    await handlePush(req(msg()), h.deps)
    expect(c.tally()).toEqual({ 'message|send_error': 1 })

    const T = Date.parse('2026-11-23T09:00:00Z')
    const iso = (ms: number) => new Date(ms).toISOString()
    const tagRun = async (times: number[], kind = 'message', broken = false) => {
      const g = harness()
      const k = counting(g)
      g.deps.recentMessageTimes = async () => { if (broken) throw new Error('x'); return times.map(iso) }
      g.deps.nowMs = () => T
      await handlePush(req(msg({ kind })), g.deps)
      return k.tally()
    }
    expect(await tagRun([T, T - REALERT_GAP_MS - 1])).toEqual({ 'message|sent': 1, 'message|ring': 1 })
    expect(await tagRun([T, T - 60_000])).toEqual({ 'message|sent': 1, 'message|collapse': 1 })
    expect(await tagRun([], 'nickname')).toEqual({ 'nickname|sent': 1, 'nickname|ring': 1 })
    expect(await tagRun([T], 'message', true)).toEqual({ 'message|sent': 1, 'message|realert_err': 1 })
  })

  it('세는 의존성이 없으면(78- 그대로) 아무 일 0 · 로그에 갈래 줄 0', async () => {
    const h = harness()
    const r = await handlePush(req(msg()), h.deps)
    expect(r.status).toBe(200)
    expect(h.logs.some((l) => l.includes('push-count'))).toBe(false)
  })
})
