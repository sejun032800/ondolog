/**
 * 카카오 로그인 왕복의 앱 쪽 마디들. 코드 · 주소는 **메모리 한 칸**(`callbackInbox`)에만 잠깐 있고, 화면 · 로그 · 라우터 이력에 남기지 않는다.
 */
import type { WebSupabase } from './client'
import type { NativeBridge } from '../platform/bridge'

/** 앱 링크. Android 매니페스트의 `ondolog` scheme intent-filter와 짝이다. Supabase 대시보드의 Redirect URL에도 등록돼 있어야 한다. */
export const CALLBACK_URL = 'ondolog://auth/callback'

export function isCallbackUrl(url: string): boolean {
  return url === CALLBACK_URL || url.startsWith(`${CALLBACK_URL}?`) || url.startsWith(`${CALLBACK_URL}#`)
}

export interface CallbackParams {
  code: string | null
  /** 서비스가 오류를 돌려줬다(내용은 보관하지 않는다). */
  failed: boolean
}

/** 앱 링크에서 코드만 뽑는다. 오류는 있었는지만 남긴다(원문 보관 0). */
export function parseCallback(url: string): CallbackParams {
  const q = url.indexOf('?')
  const h = url.indexOf('#')
  const query = q >= 0 ? url.slice(q + 1, h > q ? h : undefined) : ''
  const fragment = h >= 0 ? url.slice(h + 1) : ''
  const params = new URLSearchParams(query)
  const frag = new URLSearchParams(fragment)
  const code = params.get('code')
  const failed = params.has('error') || params.has('error_code') || frag.has('error') || frag.has('error_code')
  return { code: code && code.length > 0 ? code : null, failed }
}

let inbox: CallbackParams | null = null

export const callbackInbox = {
  put(params: CallbackParams): void {
    inbox = params
  },
  /** 한 번 꺼내면 비운다. */
  take(): CallbackParams | null {
    const v = inbox
    inbox = null
    return v
  },
}

/** 카카오 로그인을 시작한다: 인증 주소를 받아(브라우저 자동 이동 끔) 앱 안 브라우저로 연다. 실패하면 false(원인은 내지 않는다). */
export async function startKakaoLogin(client: WebSupabase, bridge: NativeBridge): Promise<boolean> {
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: CALLBACK_URL, skipBrowserRedirect: true },
    })
    if (error || !data?.url) return false
    await bridge.openBrowser(data.url)
    return true
  } catch {
    return false
  }
}

export type ExchangeOutcome = { ok: true; userId: string } | { ok: false }

const exchanges = new Map<string, Promise<ExchangeOutcome>>()

/** 이 코드는 이미 교환을 시작했는가(같은 앱 링크가 두 번 들어오는 경우를 걸러낸다). */
export function hasExchanged(code: string): boolean {
  return exchanges.has(code)
}

/** 같은 코드를 두 번 교환하지 않는다. 두 번째 호출은 첫 번째 결과를 그대로 받는다. */
export function exchangeCodeOnce(client: WebSupabase, code: string): Promise<ExchangeOutcome> {
  const known = exchanges.get(code)
  if (known) return known
  const run = (async (): Promise<ExchangeOutcome> => {
    try {
      const { data, error } = await client.auth.exchangeCodeForSession(code)
      if (error || !data?.session) return { ok: false }
      return { ok: true, userId: data.session.user.id }
    } catch {
      return { ok: false }
    }
  })()
  exchanges.set(code, run)
  return run
}

/** 시험용. */
export function resetCallbackStateForTest(): void {
  exchanges.clear()
  inbox = null
}
