/**
 * 뒤로 가기 규칙표(F1). **모든 경로(화면 이름)가 키**다. 하드웨어 뒤로 가기와 화면의 ← 가 같은 표를 쓴다.
 * 기본은 "앞 화면으로"(`previous`). 아무 일도 하지 않는 화면은 없다.
 *
 * 고정 규칙(`74-` §5-④)
 *  - 계정이 생긴 뒤에는 온보딩 화면에서 뒤로 가기 = 앱 종료(온보딩으로 돌아가는 길 0).
 *  - 메인 탭 = 앱 종료. 다른 탭 = 메인 탭으로. (RN `(tabs)/_layout.tsx`에 backBehavior 지정이 없어 React Navigation 기본 `firstRoute`와 같다.)
 *  - 시트 · 뷰어가 열려 있으면 그것만 닫는다 - `platform/backStack.ts`의 등록 함수가 먼저 받는다(표까지 오지 않는다).
 *  - 이동 직후 연타는 `navigation.tsx`의 연타 대기가 한 번만 받는다.
 * 규칙표에 없는 경로가 라우터에 있으면 `backRules.vitest.ts`가 실패한다. 새 화면을 더하면 여기에도 더한다.
 */
import { ALL_ROUTES, type ScreenName } from './routes'

export type BackRule =
  | { area: 'onboarding' | 'stack'; back: 'previous' | 'exit' }
  | { area: 'tab'; back: 'exit' | { to: ScreenName } }

export const BACK_RULES: Record<ScreenName, BackRule> = {
  // 온보딩(계정 없음): 앞 화면으로. 첫 화면은 깊이 1이라 종료.
  intro: { area: 'onboarding', back: 'exit' },
  basic: { area: 'onboarding', back: 'previous' },
  mbti: { area: 'onboarding', back: 'previous' },
  quiz: { area: 'onboarding', back: 'previous' },
  brief: { area: 'onboarding', back: 'previous' },
  consent: { area: 'onboarding', back: 'previous' },
  underage: { area: 'onboarding', back: 'previous' },
  auth: { area: 'onboarding', back: 'previous' },
  callback: { area: 'onboarding', back: 'previous' },
  // 계정 구간의 온보딩(서버 진행 단계 화면): 계정이 있으면 종료로 덮인다(`resolveBack`).
  detail: { area: 'onboarding', back: 'previous' },
  invite: { area: 'onboarding', back: 'previous' },
  'start-date': { area: 'onboarding', back: 'previous' },
  // 탭 위 스택(탭 바 가림). 뒤로 가면 앞 화면(탭)으로.
  'couple-invite': { area: 'stack', back: 'previous' },
  'start-date-recheck': { area: 'stack', back: 'previous' },
  'date-detail': { area: 'stack', back: 'previous' },
  'stop-edit': { area: 'stack', back: 'previous' },
  // 설정 하위 화면(74-7): 앞 화면(설정 탭 또는 위 화면)으로.
  'settings-profile': { area: 'stack', back: 'previous' },
  'settings-couple': { area: 'stack', back: 'previous' },
  'settings-unlink': { area: 'stack', back: 'previous' },
  'settings-personality': { area: 'stack', back: 'previous' },
  'settings-result': { area: 'stack', back: 'previous' },
  retest: { area: 'stack', back: 'previous' },
  'settings-privacy': { area: 'stack', back: 'previous' },
  'settings-about': { area: 'stack', back: 'previous' },
  'settings-withdraw': { area: 'stack', back: 'previous' },
  // 탈퇴 유예 화면(RN `/withdraw-cancel`): 로그인 직후 루트로 들어오는 화면이라 앞 화면이 없다 - 하드웨어 뒤로 = 앱 종료. 화면의 ← 는 로그아웃(화면이 직접 처리).
  'withdraw-cancel': { area: 'stack', back: 'exit' },
  // 키보드 시험(74-h2 ③, 시험 빌드 전용): 앞 화면(설정 탭)으로.
  'keyboard-test': { area: 'stack', back: 'previous' },
  // 탭
  main: { area: 'tab', back: 'exit' },
  chat: { area: 'tab', back: { to: 'main' } },
  feed: { area: 'tab', back: { to: 'main' } },
  magazine: { area: 'tab', back: { to: 'main' } },
  settings: { area: 'tab', back: { to: 'main' } },
}

export type BackAction = { kind: 'exit' } | { kind: 'previous' } | { kind: 'to'; route: ScreenName }

export interface BackContext {
  route: ScreenName | null
  /** `enterAccount`를 지난 뒤인가(계정이 생긴 뒤). */
  hasAccount: boolean
  /** 화면 깊이(첫 화면 = 1). */
  depth: number
}

export function resolveBack({ route, hasAccount, depth }: BackContext): BackAction {
  // 알 수 없는 경로(라우터의 `*` 안내 등): 앞 화면이 있으면 앞으로, 없으면 계정이 있으면 메인, 아니면 종료.
  const rule = route === null ? undefined : BACK_RULES[route]
  if (!rule) return depth > 1 ? { kind: 'previous' } : hasAccount ? { kind: 'to', route: 'main' } : { kind: 'exit' }
  if (rule.area === 'onboarding' && hasAccount) return { kind: 'exit' }
  if (rule.back === 'exit') return { kind: 'exit' }
  if (rule.back === 'previous') {
    if (depth > 1) return { kind: 'previous' }
    return hasAccount ? { kind: 'to', route: 'main' } : { kind: 'exit' }
  }
  return { kind: 'to', route: rule.back.to }
}

/** 시험용: 표의 모든 경로. */
export const BACK_RULE_ROUTES = Object.keys(BACK_RULES) as ScreenName[]
export { ALL_ROUTES }
