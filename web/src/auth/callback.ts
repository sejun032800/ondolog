/**
 * 카카오 로그인 왕복의 앱 쪽 마디들. 코드 · 주소는 **메모리 한 칸**(`callbackInbox`)에만 잠깐 있고, 화면 · 로그 · 라우터 이력에 남기지 않는다.
 */
import type { WebSupabase } from './client'
import type { NativeBridge } from '../platform/bridge'
import { IS_TRIAL_BUILD } from '../config/env'
import { safeKind } from '../platform/trialDiag'

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
/** 이 실행에서 받아들인 코드(메모리뿐). 같은 앱 링크가 한 번 더 들어오면 두 번째 콜백 화면이 빈 칸을 보고 "로그인하지 못했어요"가 되는 일을 막는다. */
const accepted = new Set<string>()

export const callbackInbox = {
  put(params: CallbackParams): void {
    inbox = params
  },
  /**
   * 앱 링크가 들어왔을 때의 접수. 이미 접수한 코드면 false(무시), 아니면 칸에 넣고 true.
   * 코드가 없는 링크(오류 등)는 매번 접수한다 - 실패 화면을 보여 줘야 하기 때문이다.
   */
  accept(params: CallbackParams): boolean {
    if (params.code) {
      if (accepted.has(params.code)) return false
      accepted.add(params.code)
    }
    inbox = params
    return true
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

/** `kind`: 실패 분류(짧은 코드 문자열, 오류 원문 아님) - 시험 빌드 진단 표시에만 쓰인다. */
export type ExchangeOutcome = { ok: true; userId: string } | { ok: false; kind: string }

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
      if (error) return { ok: false, kind: IS_TRIAL_BUILD ? safeKind(error) : '' }
      if (!data?.session) return { ok: false, kind: IS_TRIAL_BUILD ? 'no_session' : '' }
      return { ok: true, userId: data.session.user.id }
    } catch (e) {
      return { ok: false, kind: IS_TRIAL_BUILD ? safeKind(e) : '' }
    }
  })()
  exchanges.set(code, run)
  return run
}

/**
 * 로그인 왕복이 남긴 메모리 표시를 모두 비운다: 콜백 코드 칸 · 접수한 코드 · 코드 교환 기록("처리함" 표시).
 * 로그아웃 · 탈퇴 요청이 부른다 - 안 비우면 다음 로그인이 이전 로그인의 표시를 물려받는다.
 */
export function resetCallbackState(): void {
  exchanges.clear()
  accepted.clear()
  inbox = null
}

/** 시험용(이름만 남긴 별칭). */
export const resetCallbackStateForTest = resetCallbackState
