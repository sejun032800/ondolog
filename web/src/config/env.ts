/**
 * 원격(Supabase) 연결 값. 웹 앱은 `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` 두 이름만 읽는다(`web/.env`, git 밖).
 * 값은 어디에도 출력하지 않는다. 둘 중 하나라도 비면 `null` - 앱은 원격으로 가지 않는다.
 */
export interface RemoteEnv {
  url: string
  anonKey: string
}

type EnvLike = Record<string, unknown>

export function readRemoteEnv(env: EnvLike = import.meta.env as EnvLike): RemoteEnv | null {
  const pick = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const url = pick(env.VITE_SUPABASE_URL)
  const anonKey = pick(env.VITE_SUPABASE_ANON_KEY)
  if (!url || !anonKey) return null
  return { url, anonKey }
}
