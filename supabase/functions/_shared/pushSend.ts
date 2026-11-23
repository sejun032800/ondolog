/**
 * 78- 푸시 발송 핵심(R100-4 · R109-2) - Edge Function `push-send`가 부른다. 네트워크 · DB · 시계는 모두 주입한다(시험은 가짜 FCM).
 *
 * 흐름: 트리거(78-m1 `push_enqueue`)가 pg_net으로 부름 -> 비밀 헤더 없으면 401(앱 키만 든 요청 포함) ->
 *       `push_context`(DB가 Vault 비밀과 대조 + 받는 사람 다시 판정: 연결된 커플 · 탈퇴 유예 아님 · 그 알림 켬) -> 토큰마다 FCM V1 한 건.
 *       FCM이 "등록 안 된 토큰"(404 · UNREGISTERED · SENDER_ID_MISMATCH)이라 하면 그 토큰 행을 지운다(`push_drop_token`).
 * 본문 규칙(R100-4): "{상대}님이 메시지를 보냈어요" · 사진이면 "사진을 보냈어요" · 변경 안내 두 가지. **대화 원문 · 새 값은 받지도 싣지도 않는다.**
 * 쌓임 방지(R109-2): 메시지 알림은 커플 기준 고정 태그 + 같은 collapse key -> 알림 서랍에 하나로 갈아 끼운다(본문은 마지막 것).
 *   변경 안내는 메시지와 다른 태그(종류별)라 따로 보인다. iOS 확장 지점: 같은 태그를 `apns-collapse-id` · `thread-id`로 싣는다(APNs 키를 Firebase에 등록하면 같은 메시지가 간다).
 * 로그: 결과 코드 · 숫자만. 토큰 · 본문 · 이름 · id 0.
 * 87-(R148-3) 날짜별 숫자: 응답 직전에 `count(종류, 갈래, 건수)`로 87-m1 `push_daily`에 더한다(`PUSH_COUNT_STATUSES`). 보내기가 먼저 - 기록 실패는 삼키고 로그 한 줄.
 * 이 파일은 LLM을 부르지 않는다(규칙 C 경계 밖) - HTTP는 주입된 `transport`로만 나간다(Google OAuth · FCM).
 */

export type PushKind = 'message' | 'date' | 'nickname'

export interface PushToken {
  id: string
  token: string
  platform: 'android' | 'ios'
}

export interface PushContext {
  ok: boolean
  sender_name?: string | null
  tokens?: PushToken[]
}

export interface TransportResponse {
  status: number
  ok: boolean
  json(): Promise<unknown>
}
export type Transport = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<TransportResponse>

/** R99-1: 조사 판정 없이 "님이". 이름이 없으면 "상대". */
export const PUSH_COPY = {
  message: (name: string) => `${name}님이 메시지를 보냈어요`,
  photo: (name: string) => `${name}님이 사진을 보냈어요`,
  date: (name: string) => `${name}님이 사귄 날짜를 바꿨어요`,
  nickname: (name: string) => `${name}님이 커플 닉네임을 바꿨어요`,
} as const

/** 앱이 만드는 Android 알림 채널(같은 이름 - web/src/push). */
export const PUSH_CHANNEL = { message: 'ondolog_messages', change: 'ondolog_changes' } as const
/** 흰 실루엣 알림 아이콘(web/android/app/src/main/res/drawable). */
export const PUSH_ANDROID_ICON = 'ic_stat_ondolog'
/** 앱 쪽 데이터 키 - 누르면 어디로(메시지 = 채팅 탭, 변경 안내 = 메인). */
export const PUSH_ROUTE: Record<PushKind, 'chat' | 'main'> = { message: 'chat', date: 'main', nickname: 'main' }

export function isPushKind(k: unknown): k is PushKind {
  return k === 'message' || k === 'date' || k === 'nickname'
}

export function pushBody(kind: PushKind, senderName: string | null | undefined, photo: boolean): string {
  const name = (senderName ?? '').trim() || '상대'
  if (kind === 'message') return photo ? PUSH_COPY.photo(name) : PUSH_COPY.message(name)
  return kind === 'date' ? PUSH_COPY.date(name) : PUSH_COPY.nickname(name)
}

/** 커플 기준 고정 태그(묶음 이름). 메시지는 하나로 갈아 끼우고(R109-2), 변경 안내는 종류별로 따로. 64바이트 안(APNs collapse id 한도). */
export function pushTag(kind: PushKind, coupleId: string): string {
  return kind === 'message' ? `ondolog-m-${coupleId}` : `ondolog-c-${kind === 'date' ? 'd' : 'n'}-${coupleId}`
}

// ── 다시 울림(81-b · R118-4) ───────────────────────────────────────────────────────────────────────
// 같은 묶음(받는 사람 · 커플 · 종류) 알림이 직전 알림 뒤 10분 **안**이면 같은 태그로 조용히 갈아 끼우고(R109-2 유지),
// 10분이 **넘은** 공백 뒤 첫 알림은 새 태그로 보내 소리 · 팝업으로 다시 울린다. 같은 태그 갈아 끼우기는 기기(삼성)가 울리지 않으므로 태그를 바꾸는 것이 확실한 길이다.
// 태그 = 묶음 이름 + "공백 뒤 첫 알림 시각"(초, 36진수). 메시지는 받는 사람이 상대 하나라 묶음 = (커플, 보낸 사람) - 직전 시각은 이미 있는 행
// `messages.sent_at`(보낸 사람의 최근 메시지)에서 얻는다(마이그레이션 0). 변경 안내는 직전 시각을 기존 행에서 얻을 수 없어 **매번 울림**(드물다).
// iOS: 같은 값을 `apns-collapse-id`에, 묶음 이름은 `thread-id`에(서랍에서 한 줄기로 모임).

/** 이 시간(포함) 안의 연타는 하나로 조용히. */
export const REALERT_GAP_MS = 10 * 60 * 1000
/** 공백을 찾을 때 거슬러 보는 최근 메시지 수. 이보다 긴 연타(10분 안 간격으로 계속)는 가장 오래 본 것을 시작으로 본다. */
export const BURST_LOOKBACK = 200

/**
 * 연타의 시작 시각(ms). `timesDesc` = 보낸 사람의 최근 메시지 시각(최신 먼저, 지금 메시지 포함).
 * 앞 메시지와의 간격이 `gapMs` 이하인 동안 거슬러 간다. 읽을 수 있는 시각이 없으면 null. 순수(시계 0).
 */
export function burstStart(timesDesc: readonly string[], gapMs: number = REALERT_GAP_MS): number | null {
  const ms = timesDesc.map((t) => Date.parse(t)).filter((n) => Number.isFinite(n))
  if (ms.length === 0) return null
  let start = ms[0]
  for (let i = 1; i < ms.length; i++) {
    if (start - ms[i] > gapMs) break
    start = ms[i]
  }
  return start
}

/** 다시 울림 태그 = 묶음 이름 + 시작 시각(초, 36진수). 64바이트 안. */
export function burstTag(kind: PushKind, coupleId: string, startMs: number): string {
  return `${pushTag(kind, coupleId)}-${Math.floor(startMs / 1000).toString(36)}`
}

/** FCM HTTP V1 메시지 하나. `alertTag`가 없으면 묶음 이름 그대로(78-). */
export function fcmMessage(token: string, kind: PushKind, body: string, coupleId: string, alertTag: string = pushTag(kind, coupleId)): Record<string, unknown> {
  const tag = alertTag
  return {
    message: {
      token,
      notification: { body },
      data: { kind, route: PUSH_ROUTE[kind] },
      android: {
        priority: 'HIGH',
        collapse_key: tag,
        notification: { tag, channel_id: kind === 'message' ? PUSH_CHANNEL.message : PUSH_CHANNEL.change, icon: PUSH_ANDROID_ICON },
      },
      apns: {
        headers: { 'apns-collapse-id': tag },
        payload: { aps: { 'thread-id': pushTag(kind, coupleId) } },
      },
    },
  }
}

// ── Google 서비스 계정 -> 접근 토큰(OAuth 2.0 JWT bearer) ─────────────────────────────────────────

export interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

/** 함수 비밀(base64로 감싼 서비스 계정 JSON)을 읽는다. 값은 어디에도 찍지 않는다. */
export function parseServiceAccount(b64: string | undefined | null): ServiceAccount | null {
  if (!b64) return null
  try {
    const json = JSON.parse(new TextDecoder().decode(base64ToBytes(b64.trim()))) as Partial<ServiceAccount>
    if (typeof json.client_email !== 'string' || typeof json.private_key !== 'string' || typeof json.project_id !== 'string') return null
    return { client_email: json.client_email, private_key: json.private_key, project_id: json.project_id }
  } catch {
    return null
  }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64Url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  let bin = ''
  for (let i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

/** RS256으로 서명한 JWT(구글 토큰 교환용). */
export async function signServiceJwt(sa: ServiceAccount, nowSec: number, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(JSON.stringify({ iss: sa.client_email, scope: FCM_SCOPE, aud: GOOGLE_TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }))
  const pem = sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const key = await subtle.importKey('pkcs8', base64ToBytes(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)))
  return `${header}.${claims}.${base64Url(sig)}`
}

/** 접근 토큰을 함수 안에서 발급하고 만료 1분 전까지 다시 쓴다(같은 인스턴스가 연달아 받는 메시지). */
export class AccessTokenCache {
  private cached: { token: string; until: number } | null = null
  constructor(
    private readonly sa: ServiceAccount,
    private readonly transport: Transport,
    private readonly nowMs: () => number = () => Date.now(),
    private readonly sign: (sa: ServiceAccount, nowSec: number) => Promise<string> = (sa, nowSec) => signServiceJwt(sa, nowSec),
  ) {}

  async get(): Promise<string> {
    const now = this.nowMs()
    if (this.cached && now < this.cached.until) return this.cached.token
    const assertion = await this.sign(this.sa, Math.floor(now / 1000))
    const res = await this.transport(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
    })
    if (!res.ok) throw new PushError(`oauth ${res.status}`)
    const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown }
    if (typeof json.access_token !== 'string') throw new PushError('oauth no token')
    const ttl = typeof json.expires_in === 'number' ? json.expires_in : 3600
    this.cached = { token: json.access_token, until: now + Math.max(0, ttl - 60) * 1000 }
    return json.access_token
  }
}

export class PushError extends Error {}

// ── 요청 처리 ───────────────────────────────────────────────────────────────────────────────────

export const PUSH_SECRET_HEADER = 'x-ondolog-push'

export interface PushRequest {
  method: string
  header(name: string): string | null
  json(): Promise<unknown>
}

/**
 * 87-: 날짜별 숫자 갈래(87-m1 `push_status_name` 목록과 같은 이름). 토큰마다 하나: sent · dropped · fcm_NNN · send_error.
 * 요청마다: no_tokens · ring(새 태그 - 울림) · collapse(같은 태그 - 조용히 갈아 끼움) · realert_err · unauthorized · bad_request · method.
 * 함수 입구(index.ts): config(503) · internal(500). 함수가 돌지 못한 경우(503 · 게이트웨이 401 · 시간 초과)는 DB 쪽 `push_net_collect`가 센다.
 */
export const PUSH_COUNT_STATUSES = [
  'sent', 'dropped', 'send_error', 'no_tokens', 'ring', 'collapse', 'realert_err', 'unauthorized', 'bad_request', 'method', 'internal', 'config',
] as const
export type PushCountKind = PushKind | 'unknown'

export interface PushDeps {
  /** 78-m1 `push_context` - 비밀 대조 + 받는 사람 다시 판정. */
  context(secret: string, kind: PushKind, coupleId: string, actorId: string): Promise<PushContext>
  /** 78-m1 `push_drop_token`. */
  dropToken(secret: string, tokenId: string): Promise<void>
  accessToken(): Promise<string>
  /** 81-b: 보낸 사람의 이 커플 최근 메시지 시각(최신 먼저, 최대 `BURST_LOOKBACK`). 없으면 다시 울림 없이 78- 그대로. */
  recentMessageTimes?(coupleId: string, actorId: string): Promise<string[]>
  /** 81-b: 지금 시각(ms) - 변경 안내 태그. 시험은 고정 시계. 없으면 78- 그대로. */
  nowMs?(): number
  transport: Transport
  projectId: string
  /** 한 줄 - 결과 코드 · 숫자만. */
  log(line: string): void
  /** 87-: 날짜별 숫자 +n(87-m1 `push_count`). 없으면 세지 않는다. 던져도 발송 결과는 그대로. */
  count?(kind: PushCountKind, status: string, n: number): Promise<void>
}

export interface PushResult {
  status: number
  body: { sent: number; dropped: number; failed: number } | { error: string }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** FCM이 "이 토큰은 더 쓸 수 없다"고 한 경우(행을 지울 때). */
export function isDeadToken(status: number, error: unknown): boolean {
  if (status === 404) return true
  const details = (error as { error?: { details?: { errorCode?: unknown }[] } })?.error?.details ?? []
  return details.some((d) => d?.errorCode === 'UNREGISTERED' || d?.errorCode === 'SENDER_ID_MISMATCH')
}

/** 87-: 모은 갈래를 날짜별 숫자로 보낸다. 실패는 삼키고 로그 한 줄(`push-count=err`) - 발송 결과에 영향 0. */
export async function recordPushCounts(deps: Pick<PushDeps, 'count' | 'log'>, kind: PushCountKind, tally: ReadonlyMap<string, number>): Promise<void> {
  const count = deps.count
  if (!count || tally.size === 0) return
  const results = await Promise.allSettled([...tally].map(async ([status, n]) => { await count(kind, status, n) }))
  if (results.some((r) => r.status === 'rejected')) deps.log('push-count=err')
}

export async function handlePush(req: PushRequest, deps: PushDeps): Promise<PushResult> {
  let realertNote = ''
  let countKind: PushCountKind = 'unknown'
  const tally = new Map<string, number>()
  const add = (status: string, n = 1) => { if (n > 0) tally.set(status, (tally.get(status) ?? 0) + n) }
  const done = async (r: PushResult, codes: number[] = [], status?: string): Promise<PushResult> => {
    const counts = 'sent' in r.body ? ` sent=${r.body.sent} dropped=${r.body.dropped} failed=${r.body.failed}` : ''
    deps.log(`push-send status=${r.status}${counts}${codes.length ? ` fcm=${codes.join(',')}` : ''}${realertNote}`)
    if (status) add(status)
    // 87-: 보낸 뒤에 센다 - 기록은 삼킨다.
    try {
      await recordPushCounts(deps, countKind, tally)
    } catch {
      deps.log('push-count=err')
    }
    return r
  }
  if (req.method !== 'POST') return done({ status: 405, body: { error: 'method' } }, [], 'method')
  const secret = req.header(PUSH_SECRET_HEADER)
  if (!secret) return done({ status: 401, body: { error: 'unauthorized' } }, [], 'unauthorized')
  let payload: { kind?: unknown; couple_id?: unknown; actor_id?: unknown; photo?: unknown }
  try {
    payload = ((await req.json()) ?? {}) as typeof payload
  } catch {
    return done({ status: 400, body: { error: 'body' } }, [], 'bad_request')
  }
  const { kind, couple_id: coupleId, actor_id: actorId } = payload
  if (isPushKind(kind)) countKind = kind
  if (!isPushKind(kind) || typeof coupleId !== 'string' || !UUID.test(coupleId) || typeof actorId !== 'string' || !UUID.test(actorId)) {
    return done({ status: 400, body: { error: 'body' } }, [], 'bad_request')
  }
  const ctx = await deps.context(secret, kind, coupleId, actorId)
  if (!ctx.ok) return done({ status: 401, body: { error: 'unauthorized' } }, [], 'unauthorized')
  const tokens = ctx.tokens ?? []
  if (tokens.length === 0) return done({ status: 200, body: { sent: 0, dropped: 0, failed: 0 } }, [], 'no_tokens')

  const body = pushBody(kind, ctx.sender_name, kind === 'message' && payload.photo === true)
  // 81-b 다시 울림 태그. 시각을 못 읽으면 78- 묶음 이름 그대로(조용히 갈아 끼움 - 발송은 막지 않는다).
  let alertTag = pushTag(kind, coupleId)
  let realertFailed = false
  if (kind === 'message') {
    if (deps.recentMessageTimes) {
      try {
        const times = await deps.recentMessageTimes(coupleId, actorId)
        const start = burstStart(times)
        if (start !== null) {
          alertTag = burstTag(kind, coupleId, start)
          // 87-: 이 메시지가 공백 뒤 첫 알림이면 울림, 아니면 같은 태그로 조용히(접힘).
          add(start === Date.parse(times.find((t) => Number.isFinite(Date.parse(t))) ?? '') ? 'ring' : 'collapse')
        }
      } catch {
        realertFailed = true
      }
    }
  } else if (deps.nowMs) {
    alertTag = burstTag(kind, coupleId, deps.nowMs())
    add('ring')
  }
  const access = await deps.accessToken()
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(deps.projectId)}/messages:send`
  let sent = 0
  let dropped = 0
  let failed = 0
  const codes: number[] = []
  for (const t of tokens) {
    try {
      const res = await deps.transport(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fcmMessage(t.token, kind, body, coupleId, alertTag)),
      })
      if (res.ok) {
        sent += 1
        add('sent')
        continue
      }
      codes.push(res.status)
      const err = await res.json().catch(() => null)
      if (isDeadToken(res.status, err)) {
        await deps.dropToken(secret, t.id)
        dropped += 1
        add('dropped')
      } else {
        failed += 1
        add(`fcm_${String(Math.max(0, Math.min(999, Math.trunc(res.status)))).padStart(3, '0')}`)
      }
    } catch {
      failed += 1
      add('send_error')
    }
  }
  if (realertFailed) {
    realertNote = ' realert=err'
    add('realert_err')
  }
  return done({ status: 200, body: { sent, dropped, failed } }, codes)
}
