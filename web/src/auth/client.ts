/**
 * 웹 앱의 Supabase 클라이언트.
 * - `flowType: 'pkce'` · 세션은 Preferences에 저장(앱을 다시 켜도 유지) · 주소에서 세션을 읽지 않음(`detectSessionInUrl: false`)
 * - 환경 변수가 없으면 만들지 않는다(`null`) - 앱은 원격으로 가지 않는다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { readRemoteEnv, type RemoteEnv } from '../config/env'
import { registerConnectionProbe, trackConnection } from '../connection/connectionMonitor'
import { preferencesStorage, type AsyncAuthStorage } from './preferencesStorage'

export type WebSupabase = SupabaseClient<Database>

export function createWebClient(env: RemoteEnv, storage: AsyncAuthStorage = preferencesStorage): WebSupabase {
  // I02 띠 풀기 확인: 감싸기 전 원래 `fetch`로 보낸다. 헤더 없음(토큰 · 키 0) - 401이어도 응답이 오면 연결이다.
  registerConnectionProbe((signal) => fetch(`${env.url}/auth/v1/health`, { method: 'GET', signal }))
  return createClient<Database>(env.url, env.anonKey, {
    // I02 연결 끊김 판정: 요청 결과만 읽는다(새 요청 없음, `connection/connectionMonitor.ts`).
    global: { fetch: trackConnection((...args) => fetch(...args)) },
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  })
}

let cached: WebSupabase | null | undefined

/** 환경 변수가 있으면 클라이언트 하나를 돌려주고, 없으면 `null`. */
export function getSupabase(): WebSupabase | null {
  if (cached === undefined) {
    const env = readRemoteEnv()
    cached = env ? createWebClient(env) : null
  }
  return cached
}

/** 시험에서 클라이언트를 바꿔 끼운다. */
export function setSupabaseForTest(client: WebSupabase | null | undefined): void {
  cached = client
}
