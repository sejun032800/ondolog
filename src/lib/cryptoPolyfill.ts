/**
 * PKCE s256용 최소 폴리필(R63-5).
 *
 * Supabase 인증 라이브러리는 `crypto.subtle.digest`와 `crypto.getRandomValues`가 없으면
 * 코드 챌린지를 `plain`으로 보낸다. 이 파일은 그 둘이 **없을 때만** `expo-crypto`로 채운다.
 * 이미 있으면 아무것도 바꾸지 않는다. 다른 암호 기능·다른 전역 객체는 건드리지 않는다.
 *
 * `src/services/supabase.ts`가 클라이언트를 만들기 전에 이 파일을 불러온다.
 * `expo-crypto`는 채울 때에만 불러온다(이미 있으면 그 모듈을 읽지도 않는다).
 */
type CryptoLike = {
  getRandomValues?: unknown
  subtle?: { digest?: unknown }
}

export function installCryptoPolyfill(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
  const current = target.crypto as CryptoLike | undefined
  const hasDigest = typeof current?.subtle?.digest === 'function'
  const hasRandom = typeof current?.getRandomValues === 'function'
  if (hasDigest && hasRandom) return

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { digest, getRandomValues } = require('expo-crypto') as typeof import('expo-crypto')
  const holder = (current ?? {}) as Record<string, unknown>
  if (!hasRandom) holder.getRandomValues = getRandomValues
  if (!hasDigest) {
    const subtle = ((holder.subtle as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
    subtle.digest = (algorithm: string | { name: string }, data: BufferSource) =>
      digest((typeof algorithm === 'string' ? algorithm : algorithm.name) as never, data)
    holder.subtle = subtle
  }
  if (!current) target.crypto = holder
}

installCryptoPolyfill()
