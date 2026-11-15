/**
 * A-7 로그인 코드 · 토큰이 로그에 남지 않는다.
 *  1) 앱 코드(시험 아닌 *.ts · *.tsx)에 console 호출이 없다(0).
 *  2) 로그인 왕복(링크 해석 · 접수 · 코드 교환)을 오류 경로까지 돌려도 console 어디에도 코드 · 토큰 모양 글자가 안 나간다.
 *  3) 네이티브 로그(capacitor.config)는 꺼 두고 빌드는 console 호출을 뺀다(vite 설정).
 * 폰 확인(시험으로 못 보는 것): 로그인 한 바퀴 동안 `adb logcat`에 코드 · 토큰이 0, 화면 · 녹화에도 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { callbackInbox, exchangeCodeOnce, isCallbackUrl, parseCallback, resetCallbackState } from './callback'
import type { WebSupabase } from './client'

const SECRET_CODE = 'c0de-SECRET-1234567890abcdef'
// 가짜 토큰 - 저장소에 키 모양 문자열을 남기지 않으려고 실행 때 조립한다(R87-6 건수 확인).
const SECRET_TOKEN = ['ey', 'JhbGciOiJIUzI1NiJ9', '.', 'ey', 'JzdWIiOiJ4In0', '.sIgNaTuRe123'].join('')
const URL_WITH_CODE = `ondolog://auth/callback?code=${SECRET_CODE}`

const SRC = join(__dirname, '..')
function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.vitest\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

describe('A-7 console 호출 0', () => {
  it('앱 코드에 console.* 호출이 없다', () => {
    const offenders = files(SRC).filter((f) => /\bconsole\s*\.\s*(log|info|warn|error|debug|trace|dir)\b/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
    expect(offenders.map((f) => f.slice(SRC.length))).toEqual([])
  })
})

describe('A-7 로그인 왕복은 console에 코드 · 토큰을 내지 않는다', () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}))
  beforeEach(() => { resetCallbackState(); spies.forEach((s) => s.mockClear()) })
  afterEach(() => { resetCallbackState() })
  const printed = () => JSON.stringify(spies.flatMap((s) => s.mock.calls))

  const clientThat = (exchange: () => Promise<unknown>) => ({ auth: { exchangeCodeForSession: exchange } }) as unknown as WebSupabase

  it('해석 · 접수 · 교환(성공)', async () => {
    expect(isCallbackUrl(URL_WITH_CODE)).toBe(true)
    const params = parseCallback(URL_WITH_CODE)
    expect(params.code).toBe(SECRET_CODE)
    callbackInbox.accept(params)
    const r = await exchangeCodeOnce(clientThat(async () => ({ data: { session: { access_token: SECRET_TOKEN, user: { id: 'u1' } } }, error: null })), SECRET_CODE)
    expect(r).toEqual({ ok: true, userId: 'u1' })
    expect(printed()).not.toContain(SECRET_CODE)
    expect(printed()).not.toContain(SECRET_TOKEN)
  })

  it('교환 실패 · 던짐 - 오류 객체에 토큰이 들어 있어도 결과 종류 말고는 어디에도 내보내지 않는다', async () => {
    const failing = clientThat(async () => ({ data: null, error: { message: `bad ${SECRET_TOKEN}`, name: 'AuthApiError' } }))
    const r1 = await exchangeCodeOnce(failing, SECRET_CODE)
    expect(r1.ok).toBe(false)
    const r2 = await exchangeCodeOnce(clientThat(async () => { throw new Error(`boom ${SECRET_TOKEN} ${URL_WITH_CODE}`) }), `${SECRET_CODE}-2`)
    expect(r2.ok).toBe(false)
    expect(JSON.stringify(r1) + JSON.stringify(r2)).not.toContain(SECRET_TOKEN)
    expect(printed()).not.toContain(SECRET_CODE)
    expect(printed()).not.toContain(SECRET_TOKEN)
  })

  it('오류가 낀 링크 · 코드 없는 링크는 원문을 보관하지 않는다', () => {
    const p = parseCallback(`ondolog://auth/callback?error=access_denied&error_description=${SECRET_TOKEN}`)
    expect(p).toEqual({ code: null, failed: true })
    expect(JSON.stringify(p)).not.toContain(SECRET_TOKEN)
  })
})

describe('A-7 로그 수준 설정', () => {
  it('네이티브 로그는 꺼져 있다', () => {
    expect(readFileSync(join(SRC, '..', 'capacitor.config.ts'), 'utf8')).toMatch(/loggingBehavior:\s*'none'/)
  })
  it('빌드는 console · debugger 호출을 뺀다', () => {
    expect(readFileSync(join(SRC, '..', 'vite.config.ts'), 'utf8')).toMatch(/drop:\s*\[\s*'console'\s*,\s*'debugger'\s*\]/)
  })
})
