// jest-expo의 expo-crypto 목은 해시를 0으로 돌려준다(네이티브 모듈 없음). 이 시험은 폴리필이
// 알고리즘 이름·데이터를 digest에 그대로 넘기고 결과를 그대로 돌려주는지를 본다. 실제 네이티브
// SHA-256은 기기 확인 몫이다.
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto')
  return {
    getRandomValues: (a: Uint8Array) => nodeCrypto.randomFillSync(a),
    digest: async (algorithm: string, data: Uint8Array) => {
      const name = algorithm.replace('-', '').toLowerCase()
      const buf = nodeCrypto.createHash(name).update(data).digest()
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    },
  }
})
import { createClient } from '@supabase/supabase-js'
import { installCryptoPolyfill } from '../../src/lib/cryptoPolyfill'

describe('cryptoPolyfill (PKCE s256, R63-5)', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'crypto', original)
    else delete (globalThis as Record<string, unknown>).crypto
  })

  it('digest가 원래 있으면 같은 함수를 그대로 둔다', () => {
    const digest = jest.fn()
    const getRandomValues = jest.fn()
    const target = { crypto: { subtle: { digest }, getRandomValues } } as Record<string, any>
    installCryptoPolyfill(target)
    expect(target.crypto.subtle.digest).toBe(digest)
    expect(target.crypto.getRandomValues).toBe(getRandomValues)
  })

  it('digest만 없으면 digest만 채우고 getRandomValues는 그대로 둔다', () => {
    const getRandomValues = jest.fn()
    const target = { crypto: { getRandomValues } } as Record<string, any>
    installCryptoPolyfill(target)
    expect(target.crypto.getRandomValues).toBe(getRandomValues)
    expect(typeof target.crypto.subtle.digest).toBe('function')
  })

  it('SHA-256 결과가 알려진 값과 같다(빈 문자열)', async () => {
    const target = {} as Record<string, any>
    installCryptoPolyfill(target)
    const out = await target.crypto.subtle.digest('SHA-256', new Uint8Array(0))
    const hex = Array.from(new Uint8Array(out)).map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('폴리필을 불러온 뒤 OAuth 시작 URL에 code_challenge_method=s256이 들어간다', async () => {
    // 이 환경의 암호 기능을 비워 두고(없는 기기와 같은 상태) 폴리필만으로 채운다.
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true })
    installCryptoPolyfill()
    const store: Record<string, string> = {}
    const client = createClient('https://example.supabase.co', 'anon-key-for-test', {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: async (k: string) => store[k] ?? null,
          setItem: async (k: string, v: string) => { store[k] = v },
          removeItem: async (k: string) => { delete store[k] },
        },
      },
    })
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: 'ondolog://auth/callback', skipBrowserRedirect: true },
    })
    expect(error).toBeNull()
    const params = new URL(data.url as string).searchParams
    expect(params.get('code_challenge_method')).toBe('s256')
    expect(params.get('code_challenge')).toBeTruthy()
  })
})
