/**
 * I02 띠 풀기 확인 (`72b-`, R58-2). 띠가 떠 있는 동안에만 일한다.
 *   - 앱이 앞으로 올 때(AppState `active`)와 15초마다 확인 요청을 시도하되, 시도 사이는 15초 이상 둔다.
 *   - 응답을 받으면(상태 무관) 연결로 보고 띠를 내린다 -> 효과가 정리되며 타이머 · AppState 구독이 멈춘다.
 *   - 거부되면 띠를 그대로 두고 다음 시도를 기다린다(겹친 요청 없음).
 * 확인 요청은 `registerConnectionProbe`로 등록된 함수 하나이며, 사용자 토큰을 싣지 않는다.
 */
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { getConnectionProbe, useConnectionStore } from '../services/connectionMonitor'

export const PROBE_INTERVAL_MS = 15_000

export function useOfflineProbe(): void {
  const offline = useConnectionStore((s) => s.offline)
  useEffect(() => {
    if (!offline) return
    let stopped = false
    let inFlight = false
    let lastAt = Number.NEGATIVE_INFINITY
    const attempt = () => {
      const probe = getConnectionProbe()
      if (stopped || inFlight || !probe) return
      if (Date.now() - lastAt < PROBE_INTERVAL_MS) return
      lastAt = Date.now()
      inFlight = true
      probe().then(
        () => {
          inFlight = false
          if (!stopped) useConnectionStore.getState().report(true)
        },
        () => {
          inFlight = false
        },
      )
    }
    const timer = setInterval(attempt, PROBE_INTERVAL_MS)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') attempt()
    })
    return () => {
      stopped = true
      clearInterval(timer)
      sub.remove()
    }
  }, [offline])
}
