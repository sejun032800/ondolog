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

/** 개발 서버(`npm run dev`) 또는 시험용 빌드(`--mode trial`)인가. 운영 빌드에서는 false - 개발용 안내만 이것으로 가른다. */
export function isDevBuild(env: { DEV: boolean; MODE: string } = import.meta.env): boolean {
  return env.DEV === true || env.MODE === 'trial'
}

/**
 * 시험 빌드 표시용 상수 - `isDevBuild`와 같은 판정이지만 **값이 빌드 때 정해지는 상수**라, 운영 빌드에서는 `if (IS_TRIAL_BUILD)` / `IS_TRIAL_BUILD ? <A/> : null` 쪽 코드가
 * 번들러가 통째로 걷어낸다(진단 표시 · 키보드 시험 화면의 문자열이 운영 번들에 0 - `dist` 검색으로 확인한다). 시험 빌드에만 보일 것은 이 상수로만 가른다.
 */
export const IS_TRIAL_BUILD: boolean = import.meta.env.DEV === true || import.meta.env.MODE === 'trial'
