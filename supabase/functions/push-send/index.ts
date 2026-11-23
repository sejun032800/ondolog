/**
 * Edge Function `push-send` (78- · R100-4) - 78-m1 트리거가 pg_net으로 부른다. 배포: `--no-verify-jwt`(인증은 비밀 헤더 + DB 대조, 앱 키로는 거부).
 *
 * 함수 비밀(사람이 `supabase secrets set --env-file`로 넣음 - 값은 코드 · 로그 0):
 *   ONDOLOG_PUSH_DB_KEY             - 이 함수 전용 secret key(sb_secret_). `push_context` · `push_drop_token`(service_role 전용 RPC)과
 *                                     81-b 다시 울림용 `messages.sent_at` 읽기(보낸 사람의 최근 시각만 - 본문 0)만 한다.
 *   ONDOLOG_FCM_SERVICE_ACCOUNT_B64 - Firebase 서비스 계정 JSON을 base64로 감싼 것.
 *   SUPABASE_URL                    - 플랫폼이 넣는 값.
 * 모든 판단은 `_shared/pushSend.ts`(시험됨). 여기는 연결만 한다. 로그 = 결과 코드 · 숫자.
 * 87-(R148-3): 날짜별 숫자 = 87-m1 `push_count`(service_role 전용 RPC - 같은 키). 보낸 뒤에 부르고 실패는 삼킨다.
 *   DB 키가 있으면 503(FCM 비밀 없음) · 500도 여기서 센다. DB 키부터 없으면 함수는 못 쓴다 - DB 예약(`push_net_collect`)이 pg_net 응답으로 센다.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  AccessTokenCache, BURST_LOOKBACK, handlePush, parseServiceAccount, recordPushCounts, type PushContext, type PushCountKind, type Transport,
} from '../_shared/pushSend.ts'

const transport: Transport = globalThis.fetch.bind(globalThis)
/** Deno 런타임 전역 - 함수 tsconfig(lib에 deno.ns 없음)와 `deno check` 양쪽에서 같은 타입으로 읽는다. */
const runtime = (globalThis as unknown as {
  Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): unknown }
}).Deno

const url = runtime.env.get('SUPABASE_URL')
const key = runtime.env.get('ONDOLOG_PUSH_DB_KEY')
const sa = parseServiceAccount(runtime.env.get('ONDOLOG_FCM_SERVICE_ACCOUNT_B64'))
const db = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
const tokens = sa ? new AccessTokenCache(sa, transport) : null
const log = (line: string) => console.log(line)
/** 87-: 날짜별 숫자 +n. 던지면 `recordPushCounts`가 삼킨다. */
const count = db
  ? async (kind: PushCountKind, status: string, n: number) => {
    const { error } = await db.rpc('push_count', { p_kind: kind, p_status: status, p_count: n })
    if (error) throw new Error('count')
  }
  : undefined

runtime.serve(async (req: Request) => {
  if (!db || !sa || !tokens) {
    console.log('push-send status=503 config')
    await recordPushCounts({ count, log }, 'unknown', new Map([['config', 1]]))
    return new Response(JSON.stringify({ error: 'config' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const result = await handlePush(
      { method: req.method, header: (n) => req.headers.get(n), json: () => req.json() },
      {
        context: async (secret, kind, coupleId, actorId) => {
          const { data, error } = await db.rpc('push_context', { p_secret: secret, p_kind: kind, p_couple: coupleId, p_actor: actorId })
          if (error) throw new Error('context')
          return data as PushContext
        },
        dropToken: async (secret, tokenId) => {
          const { error } = await db.rpc('push_drop_token', { p_secret: secret, p_token_id: tokenId })
          if (error) throw new Error('drop')
        },
        // 81-b 다시 울림: 보낸 사람의 최근 메시지 시각만(본문 · 다른 칸 0). 이미 있는 표 · 색인(couple_id, sent_at desc) - 마이그레이션 0.
        recentMessageTimes: async (coupleId, actorId) => {
          const { data, error } = await db
            .from('messages')
            .select('sent_at')
            .eq('couple_id', coupleId)
            .eq('sender_id', actorId)
            .order('sent_at', { ascending: false })
            .limit(BURST_LOOKBACK)
          if (error) throw new Error('times')
          return ((data ?? []) as { sent_at: string }[]).map((r) => r.sent_at)
        },
        nowMs: () => Date.now(),
        accessToken: () => tokens.get(),
        transport,
        projectId: sa.project_id,
        log,
        count,
      },
    )
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } })
  } catch {
    console.log('push-send status=500')
    await recordPushCounts({ count, log }, 'unknown', new Map([['internal', 1]]))
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
