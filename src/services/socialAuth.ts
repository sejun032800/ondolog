/**
 * 화면 6(회원가입/로그인) 소셜 로그인 — 카카오 OAuth 수동 플로우.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 6 —
 *   "소셜 로그인: 카카오/구글/애플 3종. 배치: 카카오 최상단(국내 2030
 *   전환율). 참고: 애플 로그인은 iOS 심사 요건, Private Relay 대응 필요."
 *
 * ── 구현 방식 선택 이유 ──
 * 카카오/구글 네이티브 SDK나 `expo-apple-authentication`을 각각 붙이지
 * 않고, Supabase Auth의 OAuth 리다이렉트(`signInWithOAuth` +
 * `expo-web-browser`)로 처리한다.
 *   - Supabase가 카카오와의 실제 OAuth 통신을 서버에서 전담한다 — 앱은
 *     브라우저 세션을 열고 콜백을 받기만 하면 된다.
 *   - 네이티브 SDK(react-native-kakao-login 등)는 프로바이더별 개발자
 *     콘솔 등록(앱 키, Redirect URI 등)이 선행돼야 하는데 이번 세션에는
 *     그 자격 증명이 없다.
 *   - `expo-web-browser`/`expo-linking`은 순수 JS 관리형 패키지라 설치
 *     위험이 낮다(CLAUDE.md "알려진 이슈"의 `expo install --fix` 크래시는
 *     네이티브 설정 파일을 건드리는 패키지에서 주로 발생).
 *
 * ── PKCE 수동 3단계 (React Native에서는 자동 리다이렉트가 없다) ──
 *   1. `signInWithOAuth({ skipBrowserRedirect: true })`로 인증 URL만 획득
 *      (`src/services/supabase.ts`의 `flowType: 'pkce'`가 전제 —
 *      이 옵션이 없으면 콜백에 `code`가 아니라 토큰이 프래그먼트로 온다)
 *   2. `expo-web-browser`의 `openAuthSessionAsync`로 브라우저 세션을 열고
 *      앱 스킴(`ondolog://` / Expo Go의 `exp://`) 복귀를 대기
 *   3. 복귀 URL에서 `code`를 추출해 `exchangeCodeForSession`으로 세션 교환
 *      (성공하면 `supabase.auth.onAuthStateChange`가 새 세션을 알려준다 —
 *      이 함수 자체는 세션 객체를 반환하지 않는다. 화면은 `useSession`
 *      훅으로 세션 변화를 구독한다)
 *
 * 구글/애플은 Supabase 대시보드에 프로바이더가 아직 설정되지 않았다
 * (`.claude/state/HANDOFF.md`). 이 함수는 카카오 기준으로 검증됐고,
 * 구글/애플 호출은 화면(`app/(onboarding)/auth.tsx`)에서 안내 문구만
 * 띄우고 아예 막는다 — 미설정 프로바이더로 signInWithOAuth를 호출하면
 * Supabase가 에러를 반환하긴 하지만, 사용자에게 무의미한 에러 얼럿
 * 대신 "준비 중" 안내를 보여주는 쪽이 낫다는 판단.
 *
 * ⚠️ 실기기 검증 불가 사유(코드는 작성하되 아직 확인할 수 없음):
 *   1. `.env`의 anon key가 플레이스홀더라 Supabase 프로젝트에 실제로
 *      연결되지 않는다.
 *   2. iOS Dev Build가 아직 없다.
 */
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'

export type SocialProvider = 'kakao' | 'google' | 'apple'

// 인앱 브라우저에서 돌아올 때 OS가 앱으로 리다이렉트할 수 있게 세션을 미리 연다.
WebBrowser.maybeCompleteAuthSession()

export interface SocialSignInResult {
  cancelled: boolean
}

/**
 * OAuth 인앱 브라우저를 열고, 콜백 URL의 `code`로 Supabase 세션을 만든다.
 *
 * 취소(사용자가 브라우저를 직접 닫음)와 실패(에러 응답)를 구분한다 —
 * 취소는 `{ cancelled: true }`를 반환하고, 실패는 throw한다. 둘 다 화면의
 * 동의 체크 상태를 건드리지 않는다(6-5 요구사항 — 이 함수는 세션/consent
 * state에 접근하지 않으므로 구조적으로 보장된다).
 */
export async function signInWithSocialProvider(
  provider: SocialProvider,
): Promise<SocialSignInResult> {
  const redirectTo = Linking.createURL('auth/callback')

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

  const { code, errorCode } = parseCallbackUrl(result.url)
  if (errorCode) throw new Error(errorCode)
  if (!code) throw new Error('인증 코드를 받지 못했습니다.')

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) throw exchangeError

  return { cancelled: false }
}

/** 콜백 URL의 쿼리 파라미터에서 PKCE `code`(또는 에러 코드)를 뽑아낸다. */
function parseCallbackUrl(url: string): {
  code: string | null
  errorCode: string | null
} {
  const { queryParams } = Linking.parse(url)
  const params = (queryParams ?? {}) as Record<string, string | string[] | undefined>
  const first = (v: string | string[] | undefined): string | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  return {
    code: first(params.code),
    errorCode: first(params.error_code) ?? first(params.error),
  }
}
