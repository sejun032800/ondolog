/**
 * 앱 경로(화면 이름) 한 곳. 라우터(`routeTable.tsx`) · 뒤로 가기 규칙표(`backRules.ts`) · 화면 이름 타입이 모두 여기서 나온다.
 *
 * 새 화면을 더할 때(이후 묶음): 이 배열에 이름을 더하고 -> `routeTable.tsx`에 그리는 법 -> `backRules.ts`에 뒤로 가기 규칙.
 * 셋 중 하나라도 빠지면 타입 검사와 `backRules.vitest.ts`가 실패한다.
 *
 *  - 온보딩: 계정이 없을 때의 길(앱 `(onboarding)`). 계정이 생긴 뒤에는 서버 진행 단계 화면(`detail` · `invite` · `start-date`)까지만 본다.
 *  - 탭: 로그인 뒤 메인 5개(앱 `(tabs)`). 탭 바가 보인다. 탭끼리는 `replace`로 옮긴다(쌓이지 않는다).
 *  - 스택: 탭 위로 쌓이는 하위 화면(앱 루트 스택). 탭 바가 가려진다. 74-2가 둘(`couple-invite` · `start-date-recheck`)을 더했고 74-3~74-7이 이어서 더한다.
 * 시트 · 모달은 경로가 아니다(`sheets.tsx`, 열려 있는 동안 뒤로 가기는 그것만 닫는다).
 */
export const ONBOARDING_ROUTES = [
  'intro', 'basic', 'mbti', 'quiz', 'brief', 'consent', 'underage', 'auth', 'callback', 'detail', 'invite', 'start-date',
] as const

/** RN `app/(tabs)/_layout.tsx` 순서. */
export const TAB_ROUTES = ['main', 'chat', 'feed', 'magazine', 'settings'] as const

/**
 * 탭 위로 쌓이는 하위 화면. 이후 묶음이 더한다(예: 'settings-profile').
 *  - `couple-invite`(74-2): I01에서 여는 초대 · 코드 입력(RN `couple-gate` 모달). 뒤로 가면 탭으로.
 *  - `start-date-recheck`(74-2): 상대가 고친 사귄 날짜 확인(A20 재표시, RN `/start-date?recheck=1`).
 *  - `date-detail`(74-4): E03 데이트 상세(`?id=`). `stop-edit`(74-4): E15 장소 고치기(`?id=&stop=`). 둘 다 뒤로 = 앞 화면.
 *  - 설정(74-7, 모두 뒤로 = 앞 화면): `settings-profile`(H03) · `settings-couple`(H04, 해제 유예 중이면 H14 유예 모습) · `settings-unlink`(H14 문구 입력) ·
 *    `settings-personality`(H05) · `settings-result`(A14 · A15 설정 모드, `?view=override`면 A16부터) · `retest`(H06 뒤 A04~A07, 한 경로 안의 두 단계) ·
 *    `settings-privacy`(H11) · `settings-about`(H19) · `settings-withdraw`(H16 문구 입력).
 *  - `withdraw-cancel`(74-7): 탈퇴 유예 중인 계정이 로그인하거나 앱을 열면 단계보다 먼저 오는 화면(RN `/withdraw-cancel`). 뒤로 가기 = 앱 종료(RN: 루트 화면이라 하드웨어 뒤로 = 종료), 화면의 ← 는 로그아웃(RN `onBack={logout}`).
 */
export const STACK_ROUTES = [
  'couple-invite', 'start-date-recheck', 'date-detail', 'stop-edit',
  'settings-profile', 'settings-couple', 'settings-unlink', 'settings-personality', 'settings-result', 'retest',
  'settings-privacy', 'settings-about', 'settings-withdraw', 'withdraw-cancel',
] as const

export type OnboardingRoute = (typeof ONBOARDING_ROUTES)[number]
export type TabRoute = (typeof TAB_ROUTES)[number]
export type StackRoute = (typeof STACK_ROUTES)[number]
export type ScreenName = OnboardingRoute | TabRoute | StackRoute

export const ALL_ROUTES: readonly ScreenName[] = [...ONBOARDING_ROUTES, ...TAB_ROUTES, ...STACK_ROUTES]

export const TAB_LABEL: Record<TabRoute, string> = {
  main: '메인',
  chat: '채팅',
  feed: '피드',
  magazine: '매거진',
  settings: '설정',
}

export function isTabRoute(name: string | null): name is TabRoute {
  return name !== null && (TAB_ROUTES as readonly string[]).includes(name)
}

export function isStackRoute(name: string | null): boolean {
  return name !== null && (STACK_ROUTES as readonly string[]).includes(name)
}

/** 로그인 뒤 구간(탭 · 스택)인가. */
export function isAccountRoute(name: string | null): boolean {
  return isTabRoute(name) || isStackRoute(name)
}

export function routeOfPathname(pathname: string): ScreenName | null {
  const name = pathname.replace(/^\//, '')
  return (ALL_ROUTES as readonly string[]).includes(name) ? (name as ScreenName) : null
}
