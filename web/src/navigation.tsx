/**
 * 화면 이동 - 웹 라우터(react-router, MemoryRouter) 위의 얇은 층.
 * - 주소창 · 브라우저 기록이 없다(앱 안에서만 이동). 콜백 주소 같은 것이 기록에 남지 않는다.
 * - 깊이를 직접 센다: 첫 화면(깊이 1)에서 뒤로 가기 = 앱 종료. `reset`은 깊이를 1로 되돌린다.
 */
import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Nav, ScreenName } from './screens'

export function useAppNav(): { nav: Nav; canGoBack: () => boolean } {
  const navigate = useNavigate()
  const depth = useRef(1)
  return useMemo(() => ({
    nav: {
      push: (s: ScreenName) => { depth.current += 1; navigate(`/${s}`) },
      back: () => {
        if (depth.current <= 1) return
        depth.current -= 1
        navigate(-1)
      },
      reset: (s: ScreenName) => { depth.current = 1; navigate(`/${s}`, { replace: true }) },
    },
    canGoBack: () => depth.current > 1,
  }), [navigate])
}
