import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { CALLBACK_URL, exchangeCodeOnce, hasExchanged, isCallbackUrl, parseCallback, resetCallbackStateForTest, startKakaoLogin, callbackInbox } from './callback'
import { createWebClient } from './client'
import { readRemoteEnv } from '../config/env'
import { makeFakeBridge, makeFakeClient } from '../testSupport'

beforeEach(() => resetCallbackStateForTest())

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => { m.set(k, v) },
    removeItem: async (k: string) => { m.delete(k) },
  }
}

describe('앱 링크 읽기', () => {
  it('콜백 주소만 받는다', () => {
    expect(isCallbackUrl('ondolog://auth/callback?code=x')).toBe(true)
    expect(isCallbackUrl('ondolog://auth/callback')).toBe(true)
    expect(isCallbackUrl('ondolog://auth/callbackx')).toBe(false)
    expect(isCallbackUrl('ondolog://other')).toBe(false)
  })

  it('code를 뽑고, 오류는 있었는지만 남긴다', () => {
    expect(parseCallback('ondolog://auth/callback?code=abc')).toEqual({ code: 'abc', failed: false })
    expect(parseCallback('ondolog://auth/callback')).toEqual({ code: null, failed: false })
    expect(parseCallback('ondolog://auth/callback?error=access_denied&error_description=x')).toEqual({ code: null, failed: true })
    expect(parseCallback('ondolog://auth/callback#error_code=500')).toEqual({ code: null, failed: true })
    expect(Object.keys(parseCallback('ondolog://auth/callback?error=a')).sort()).toEqual(['code', 'failed'])
  })

  it('받은 주소는 한 번 꺼내면 비워진다', () => {
    callbackInbox.put({ code: 'c', failed: false })
    expect(callbackInbox.take()).toEqual({ code: 'c', failed: false })
    expect(callbackInbox.take()).toBeNull()
  })
})

describe('코드 교환', () => {
  it('같은 코드를 두 번 교환하지 않는다(두 번째는 첫 결과를 그대로 받는다)', async () => {
    const { client, spies } = makeFakeClient()
    const [a, b] = await Promise.all([exchangeCodeOnce(client, 'code-1'), exchangeCodeOnce(client, 'code-1')])
    const c = await exchangeCodeOnce(client, 'code-1')
    expect(spies.exchange).toHaveBeenCalledTimes(1)
    expect(a).toEqual({ ok: true, userId: 'user-1' })
    expect(b).toEqual(a)
    expect(c).toEqual(a)
    expect(hasExchanged('code-1')).toBe(true)
    expect(hasExchanged('code-2')).toBe(false)
  })

  it('실패하면 ok: false만 돌려주고 오류 원문은 돌려주지 않는다', async () => {
    const { client } = makeFakeClient({ exchange: async () => ({ data: { session: null }, error: { message: 'secret detail' } }) })
    const r = await exchangeCodeOnce(client, 'bad')
    expect(r).toEqual({ ok: false, kind: 'unknown' })
    expect(JSON.stringify(r)).not.toContain('secret')
  })

  it('던져도 ok: false', async () => {
    const { client } = makeFakeClient({ exchange: async () => { throw new Error('network') } })
    expect(await exchangeCodeOnce(client, 'boom')).toEqual({ ok: false, kind: 'Error' })
  })
})

describe('로그인 시작 (PKCE s256)', () => {
  it('인증 주소에 code_challenge_method=s256이 들어 있고, 앱 링크를 돌아올 곳으로 보낸다', async () => {
    // WebCrypto는 보안 출처(https)에서만 열린다 - 시험에서는 Node의 것을 끼운다. 앱에서는 https://localhost 출처로 뜬다.
    vi.stubGlobal('crypto', webcrypto)
    try {
      const client = createWebClient({ url: 'http://supabase.invalid', anonKey: 'test-anon-key' }, memoryStorage())
      const bridge = makeFakeBridge()
      expect(await startKakaoLogin(client, bridge)).toBe(true)
      const opened = (bridge.openBrowser as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const url = new URL(opened)
      expect(url.searchParams.get('provider')).toBe('kakao')
      expect(url.searchParams.get('code_challenge_method')).toBe('s256')
      expect(url.searchParams.get('code_challenge')).toBeTruthy()
      expect(url.searchParams.get('redirect_to')).toBe(CALLBACK_URL)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('주소를 받지 못하면 false이고 브라우저를 열지 않는다', async () => {
    const { client, spies } = makeFakeClient()
    spies.signInWithOAuth.mockResolvedValueOnce({ data: { url: '' }, error: null } as never)
    const bridge = makeFakeBridge()
    expect(await startKakaoLogin(client, bridge)).toBe(false)
    expect(bridge.openBrowser).not.toHaveBeenCalled()
  })
})

describe('환경 변수', () => {
  it('둘 다 있어야 읽힌다', () => {
    expect(readRemoteEnv({})).toBeNull()
    expect(readRemoteEnv({ VITE_SUPABASE_URL: 'u' })).toBeNull()
    expect(readRemoteEnv({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
    expect(readRemoteEnv({ VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'u', anonKey: 'k' })
  })
})
