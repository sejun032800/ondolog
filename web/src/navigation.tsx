/**
 * 화면 이동 - 웹 라우터(react-router, MemoryRouter) 위의 얇은 층.
 * - 주소창 · 브라우저 기록이 없다(앱 안에서만 이동). 콜백 주소 같은 것이 기록에 남지 않는다.
 * - 깊이를 직접 센다: 첫 화면(깊이 1)에서 뒤로 가기 = 앱 종료. `reset`은 깊이를 1로 되돌린다.
 * - 계정이 만들어진 뒤(`enterAccount`)에는 뒤로 가기로 온보딩에 다시 들어갈 수 없다: 뒤로 가기 = 앱 종료(R71-4).
 * - 연타: 한 번 이동한 뒤 짧은 시간(`NAV_COOLDOWN_MS`) 안의 `push` · `back`은 무시한다 - 같은 입력이 두 번 처리되거나
 *   중간 화면을 건너뛰지 않게. 프로그램이 부르는 `reset` · `replace` · `enterAccount`와 `urgent` 이동은 막지 않는다.
 */
import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Nav, ScreenName } from './screens'

/** 화면 전환 연출(rise 260ms)이 끝날 때까지는 다음 이동을 받지 않는다. */
export const NAV_COOLDOWN_MS = 350

export function useAppNav(): { nav: Nav; canGoBack: () => boolean } {
  const navigate = useNavigate()
  const depth = useRef(1)
  const accountLocked = useRef(false)
  const lastAt = useRef(Number.NEGATIVE_INFINITY)
  return useMemo(() => {
    const cooling = () => Date.now() - lastAt.current < NAV_COOLDOWN_MS
    const stamp = () => {
      lastAt.current = Date.now()
    }
    return {
      nav: {
        push: (s: ScreenName, opts?: { urgent?: boolean }) => {
          if (!opts?.urgent && cooling()) return
          stamp()
          depth.current += 1
          navigate(`/${s}`)
        },
        back: () => {
          if (accountLocked.current || depth.current <= 1 || cooling()) return
          stamp()
          depth.current -= 1
          navigate(-1)
        },
        reset: (s: ScreenName) => {
          stamp()
          depth.current = 1
          navigate(`/${s}`, { replace: true })
        },
        replace: (s: ScreenName) => {
          stamp()
          navigate(`/${s}`, { replace: true })
        },
        enterAccount: (s: ScreenName) => {
          stamp()
          accountLocked.current = true
          depth.current = 1
          navigate(`/${s}`, { replace: true })
        },
      },
      canGoBack: () => !accountLocked.current && depth.current > 1,
    }
  }, [navigate])
}
