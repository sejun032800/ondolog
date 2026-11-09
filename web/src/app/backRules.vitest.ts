import { describe, expect, it } from 'vitest'
import { BACK_RULES, resolveBack, type BackAction } from './backRules'
import { ROUTE_ELEMENTS } from './routeTable'
import { ALL_ROUTES, ONBOARDING_ROUTES, STACK_ROUTES, TAB_ROUTES, isAccountRoute, isTabRoute, routeOfPathname, type ScreenName } from './routes'

const sorted = (xs: readonly string[]) => [...xs].sort()

describe('뒤로 가기 규칙표(F1) - 모든 경로가 키', () => {
  it('라우터가 그리는 경로 = 경로 목록 = 규칙표의 키. 규칙표에 없는 경로가 라우터에 있으면 여기서 실패한다', () => {
    expect(sorted(Object.keys(ROUTE_ELEMENTS))).toEqual(sorted(ALL_ROUTES))
    expect(sorted(Object.keys(BACK_RULES))).toEqual(sorted(ALL_ROUTES))
    for (const route of Object.keys(ROUTE_ELEMENTS)) {
      expect(BACK_RULES[route as ScreenName], `${route}에 뒤로 가기 규칙이 없다`).toBeDefined()
    }
  })

  it('경로 목록은 온보딩 · 탭 · 스택의 합이고 겹치지 않는다', () => {
    expect(ALL_ROUTES.length).toBe(ONBOARDING_ROUTES.length + TAB_ROUTES.length + STACK_ROUTES.length)
    expect(new Set(ALL_ROUTES).size).toBe(ALL_ROUTES.length)
    expect([...TAB_ROUTES]).toEqual(['main', 'chat', 'feed', 'magazine', 'settings'])
  })

  it('규칙의 영역이 경로 종류와 맞는다', () => {
    for (const r of ONBOARDING_ROUTES) expect(BACK_RULES[r].area).toBe('onboarding')
    for (const r of TAB_ROUTES) expect(BACK_RULES[r].area).toBe('tab')
    for (const r of STACK_ROUTES as readonly ScreenName[]) expect(BACK_RULES[r].area).toBe('stack')
  })

  it('"to" 규칙의 도착지는 라우터에 있는 경로다', () => {
    for (const rule of Object.values(BACK_RULES)) {
      if (typeof rule.back === 'object') expect(ALL_ROUTES).toContain(rule.back.to)
    }
  })

  it('경로 이름 판별', () => {
    expect(routeOfPathname('/main')).toBe('main')
    expect(routeOfPathname('/nope')).toBeNull()
    expect(isTabRoute('chat')).toBe(true)
    expect(isTabRoute('intro')).toBe(false)
    expect(isAccountRoute('feed')).toBe(true)
    expect(isAccountRoute('basic')).toBe(false)
  })
})

describe('경로별 뒤로 가기 결과표', () => {
  const exit: BackAction = { kind: 'exit' }
  const previous: BackAction = { kind: 'previous' }
  const toMain: BackAction = { kind: 'to', route: 'main' }

  // [경로, 계정 없음 · 깊이 1, 계정 없음 · 깊이 2, 계정 있음 · 깊이 1, 계정 있음 · 깊이 2]
  const table: Array<[ScreenName, BackAction, BackAction, BackAction, BackAction]> = [
    ['intro', exit, exit, exit, exit],
    ['basic', exit, previous, exit, exit],
    ['mbti', exit, previous, exit, exit],
    ['quiz', exit, previous, exit, exit],
    ['brief', exit, previous, exit, exit],
    ['consent', exit, previous, exit, exit],
    ['underage', exit, previous, exit, exit],
    ['auth', exit, previous, exit, exit],
    ['callback', exit, previous, exit, exit],
    ['detail', exit, previous, exit, exit],
    ['invite', exit, previous, exit, exit],
    ['start-date', exit, previous, exit, exit],
    ['couple-invite', exit, previous, toMain, previous],
    ['start-date-recheck', exit, previous, toMain, previous],
    ['date-detail', exit, previous, toMain, previous],
    ['stop-edit', exit, previous, toMain, previous],
    ['settings-profile', exit, previous, toMain, previous],
    ['settings-couple', exit, previous, toMain, previous],
    ['settings-unlink', exit, previous, toMain, previous],
    ['settings-personality', exit, previous, toMain, previous],
    ['settings-result', exit, previous, toMain, previous],
    ['retest', exit, previous, toMain, previous],
    ['settings-privacy', exit, previous, toMain, previous],
    ['settings-about', exit, previous, toMain, previous],
    ['settings-withdraw', exit, previous, toMain, previous],
    // 탈퇴 유예 화면: 루트로 들어오는 화면이라 하드웨어 뒤로 = 앱 종료(RN 동작). 화면의 ← 는 로그아웃(`settings.vitest.tsx`).
    ['withdraw-cancel', exit, exit, exit, exit],
    ['main', exit, exit, exit, exit],
    ['chat', toMain, toMain, toMain, toMain],
    ['feed', toMain, toMain, toMain, toMain],
    ['magazine', toMain, toMain, toMain, toMain],
    ['settings', toMain, toMain, toMain, toMain],
  ]

  it('표가 모든 경로를 덮는다', () => {
    expect(sorted(table.map((r) => r[0]))).toEqual(sorted(ALL_ROUTES))
  })

  for (const [route, g1, g2, a1, a2] of table) {
    it(`${route}: 계정 없음 ${g1.kind}/${g2.kind}, 계정 있음 ${a1.kind}/${a2.kind}`, () => {
      expect(resolveBack({ route, hasAccount: false, depth: 1 })).toEqual(g1)
      expect(resolveBack({ route, hasAccount: false, depth: 2 })).toEqual(g2)
      expect(resolveBack({ route, hasAccount: true, depth: 1 })).toEqual(a1)
      expect(resolveBack({ route, hasAccount: true, depth: 2 })).toEqual(a2)
    })
  }

  it('메인 탭 첫 화면 = 앱 종료, 다른 탭 = 메인 탭으로', () => {
    expect(resolveBack({ route: 'main', hasAccount: true, depth: 1 })).toEqual(exit)
    for (const tab of ['chat', 'feed', 'magazine', 'settings'] as const) {
      expect(resolveBack({ route: tab, hasAccount: true, depth: 1 })).toEqual(toMain)
    }
  })

  it('계정이 생긴 뒤에는 온보딩 어디서도 앞 화면(온보딩)으로 못 돌아간다', () => {
    for (const r of ONBOARDING_ROUTES) {
      for (const depth of [1, 2, 5]) expect(resolveBack({ route: r, hasAccount: true, depth })).toEqual(exit)
    }
  })

  it('알 수 없는 경로 · 앞 화면 없음: 아무 일도 안 하는 일이 없다(앞으로 / 메인 / 종료)', () => {
    expect(resolveBack({ route: null, hasAccount: false, depth: 3 })).toEqual(previous)
    expect(resolveBack({ route: null, hasAccount: true, depth: 1 })).toEqual(toMain)
    expect(resolveBack({ route: null, hasAccount: false, depth: 1 })).toEqual(exit)
  })

  it('규칙표에 없는 스택 화면의 기본은 앞 화면으로(깊이가 있을 때), 앞이 없으면 계정이면 메인', () => {
    // 이후 묶음이 스택 화면을 더하면 `previous` 규칙을 쓴다 - 같은 해석을 직접 확인한다.
    const fake = 'later-stack' as ScreenName
    expect(resolveBack({ route: fake, hasAccount: true, depth: 2 })).toEqual(previous)
    expect(resolveBack({ route: fake, hasAccount: true, depth: 1 })).toEqual(toMain)
  })
})
