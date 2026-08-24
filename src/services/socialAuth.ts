/**
 * 화면 6(회원가입/로그인) 소셜 로그인 3종.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 6 —
 *   "소셜 로그인: 카카오/구글/애플 3종. 배치: 카카오 최상단(국내 2030
 *   전환율). 참고: 애플 로그인은 iOS 심사 요건, Private Relay 대응 필요."
 *
 * ── 구현 방식 선택 이유 ──
 * 카카오/구글 네이티브 SDK나 `expo-apple-authentication`을 각각 붙이지
 * 않고, Supabase Auth의 OAuth 리다이렉트(`signInWithOAuth` +
 * `expo-web-browser`)로 3종을 동일한 방식으로 처리한다.
 *   - Supabase가 각 프로바이더와의 실제 OAuth 통신을 서버에서 전담한다
 *     — 앱은 브라우저 세션을 열고 콜백을 받기만 하면 된다.
 *   - 네이티브 SDK(react-native-kakao-login, @react-native-google-signin,
 *     expo-apple-authentication)는 프로바이더별 개발자 콘솔 등록
 *     (앱 키, Redirect URI, 번들 ID 등)이 선행돼야 하는데 이번 세션에는
 *     그 자격 증명이 없다. Apple Developer 계정도 대기 중이다
 *     (`.claude/state/HANDOFF.md`).
 *   - `expo-web-browser`/`expo-auth-session`은 순수 JS 관리형 패키지라
 *     설치 위험이 낮다(CLAUDE.md "알려진 이슈"의 `expo install --fix`
 *     크래시는 네이티브 설정 파일을 건드리는 패키지에서 주로 발생).
 *
 * ⚠️ 실기기 검증 불가 사유(코드는 작성하되 아직 확인할 수 없음):
 *   1. `.env`의 anon key가 플레이스홀더라 Supabase 프로젝트에 실제로
 *      연결되지 않는다.
 *   2. Supabase 대시보드에 카카오/구글/애플 OAuth 프로바이더가
 *      설정돼 있는지 이 세션에서 확인하지 못했다(직접 대시보드 설정은
 *      권한 밖일 수 있음).
 *   3. iOS Dev Build가 아직 없다(Apple 로그인은 iOS 실기기 필요).
 */
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from './supabase'

export type SocialProvider = 'kakao' | 'google' | 'apple'

// 인앱 브라우저에서 돌아올 때 OS가 앱으로 리다이렉트할 수 있게 세션을 미리 연다.
WebBrowser.maybeCompleteAuthSession()

export interface SocialSignInResult {
  cancelled: boolean
}

/**
 * OAuth 인앱 브라우저를 열고, 콜백 URL의 토큰으로 Supabase 세션을 만든다.
 * 성공하면 `supabase.auth.onAuthStateChange`가 새 세션을 알려준다(이
 * 함수 자체는 세션 객체를 반환하지 않는다 — 화면은 `useSession` 훅으로
 * 세션 변화를 구독한다).
 */
export async function signInWithSocialProvider(
  provider: SocialProvider,
): Promise<SocialSignInResult> {
  const redirectTo = makeRedirectUri({ scheme: 'ondolog', path: 'auth/callback' })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (!data.url) throw new Error('OAuth URL을 받지 못했습니다.')

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

  if (result.type !== 'success' || !result.url) {
    return { cancelled: true }
  }

  const { params, errorCode } = QueryParams(result.url)
  if (errorCode) throw new Error(errorCode)

  if (params.access_token && params.refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    })
    if (sessionError) throw sessionError
  }

  return { cancelled: false }
}

/** 콜백 URL(프래그먼트 `#` 또는 쿼리 `?`)에서 토큰 파라미터를 뽑아낸다. */
function QueryParams(url: string): {
  params: Record<string, string>
  errorCode: string | null
} {
  const separator = url.includes('#') ? '#' : '?'
  const fragment = url.split(separator)[1] ?? ''
  const search = new URLSearchParams(fragment)
  const params: Record<string, string> = {}
  search.forEach((value, key) => {
    params[key] = value
  })
  return { params, errorCode: params.error_code ?? params.error ?? null }
}
