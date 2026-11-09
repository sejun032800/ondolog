/**
 * 화면 이동 - 웹 라우터(react-router, MemoryRouter) 위의 얇은 층.
 * - 주소창 · 브라우저 기록이 없다(앱 안에서만 이동). 콜백 주소 같은 것이 기록에 남지 않는다.
 * - 깊이를 직접 센다: 첫 화면(깊이 1). `reset` · `enterAccount`는 깊이를 1로 되돌린다.
 * - 뒤로 가기 = `app/backRules.ts`의 규칙표(모든 경로 한 곳). 계정이 만들어진 뒤(`enterAccount`)에는 온보딩 화면에서 뒤로 가기 = 앱 종료(R71-4).
 *   탭끼리는 `replace`로 옮겨 깊이가 늘지 않는다. 탭 위로 쌓이는 스택 화면은 `push` · 뒤로 가기로 탭에 돌아온다.
 * - 연타: 한 번 이동한 뒤 짧은 시간(`NAV_COOLDOWN_MS`) 안의 `push` · `back`은 무시한다 - 같은 입력이 두 번 처리되거나
 *   중간 화면을 건너뛰지 않게. 프로그램이 부르는 `reset` · `replace` · `enterAccount`와 `urgent` 이동은 막지 않는다.
 */
import { useMemo, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { resolveBack } from './app/backRules'
import { routeOfPathname, type ScreenName } from './app/routes'

export type { ScreenName }

export interface Nav {
  /**
   * `urgent`: 연타 방지 대기 없이 바로(앱 링크로 돌아온 로그인 콜백처럼 사람 입력이 아닌 이동).
   * `params`: 화면이 읽는 값(예: 데이트 id). 주소 끝의 `?key=value`로 실려 뒤로 갔다 돌아와도 그대로다(`useRouteParams`).
   */
  push: (s: ScreenName, opts?: { urgent?: boolean; params?: Record<string, string> }) => void
  back: () => void
  /** 깊이를 1로 되돌리며 바꾼다. */
  reset: (s: ScreenName) => void
  /** 깊이를 그대로 두고 현재 화면을 바꾼다(탭 옮기기도 이것). */
  replace: (s: ScreenName) => void
  /** 계정이 생긴 뒤의 첫 화면. 이후 뒤로 가기로 온보딩에 다시 들어갈 수 없다(앱 종료). */
  enterAccount: (s: ScreenName) => void
}

/** 화면 전환 연출(rise 260ms)이 끝날 때까지는 다음 이동을 받지 않는다. */
export const NAV_COOLDOWN_MS = 350

export function useAppNav(): { nav: Nav; canGoBack: () => boolean } {
  const navigate = useNavigate()
  const location = useLocation()
  const routeRef = useRef<ScreenName | null>(null)
  routeRef.current = routeOfPathname(location.pathname)
  const depth = useRef(1)
  const accountLocked = useRef(false)
  const lastAt = useRef(Number.NEGATIVE_INFINITY)
  return useMemo(() => {
    const cooling = () => Date.now() - lastAt.current < NAV_COOLDOWN_MS
    const stamp = () => {
      lastAt.current = Date.now()
    }
    const action = () => resolveBack({ route: routeRef.current, hasAccount: accountLocked.current, depth: depth.current })
    return {
      nav: {
        push: (s, opts) => {
          if (!opts?.urgent && cooling()) return
          stamp()
          depth.current += 1
          const search = opts?.params ? `?${new URLSearchParams(opts.params).toString()}` : ''
          navigate(`/${s}${search}`)
        },
        back: () => {
          const a = action()
          if (a.kind === 'exit' || cooling()) return
          stamp()
          if (a.kind === 'previous') {
            depth.current -= 1
            navigate(-1)
          } else {
            navigate(`/${a.route}`, { replace: true })
          }
        },
        reset: (s) => {
          stamp()
          // 첫 화면(intro)으로 되돌리는 것 = 계정 구간을 떠남(로그아웃). 다시 가입 · 로그인하는 온보딩에서 뒤로 가기가 앱 종료로 막히지 않게 푼다.
          if (s === 'intro') accountLocked.current = false
          depth.current = 1
          navigate(`/${s}`, { replace: true })
        },
        replace: (s) => {
          stamp()
          navigate(`/${s}`, { replace: true })
        },
        enterAccount: (s) => {
          stamp()
          accountLocked.current = true
          depth.current = 1
          navigate(`/${s}`, { replace: true })
        },
      },
      // 뒤로 가기가 앱 종료가 아닌가(하드웨어 뒤로 가기가 종료할지 가른다).
      canGoBack: () => action().kind !== 'exit',
    }
  }, [navigate])
}

/** 현재 화면에 실려 온 값(`nav.push(name, { params })`). 없는 키는 빈 글자. */
export function useRouteParams(): (key: string) => string {
  const [params] = useSearchParams()
  return (key) => params.get(key) ?? ''
}
