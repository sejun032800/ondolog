/**
 * I02 띠 풀기 확인(`72b-` · `72c-`). 띠가 떠 있는 동안에만 일한다.
 *   - 앱이 앞으로 올 때(`visibilitychange` -> 보임)와 15초마다 확인 요청을 시도하되, 시도 사이는 15초 이상 둔다.
 *   - 브라우저 `online` 이벤트도 같은 시도를 부른다(사람이 연결을 되살린 순간). 이 경우만 15초 간격을 기다리지 않는다 - 단, 진행 중인 요청이 있으면 겹치지 않는다.
 *   - 응답을 받으면(상태 무관) 연결로 보고 띠를 내린다 -> 효과가 정리되며 타이머 · 구독이 멈춘다.
 *   - 확인 요청 한 번은 8초(`PROBE_TIMEOUT_MS`)를 넘으면 AbortController로 취소한다(이 요청에만). 취소 · 거부되면 띠를 그대로 두고 다음 시도를 기다린다(겹친 요청 없음).
 *   - 정리할 때 진행 중인 요청 · 제한 타이머 · 간격 타이머 · 구독을 모두 푼다(abort 정리).
 * 확인 요청은 `registerConnectionProbe`로 등록된 함수 하나이며, 사용자 토큰 · 키 헤더를 싣지 않는다.
 */
import { useEffect } from 'react'
import { getConnectionProbe, useConnectionStore } from './connectionMonitor'

export const PROBE_INTERVAL_MS = 15_000
/** 확인 요청 한 번의 제한(이 요청에만). 넘으면 취소 = 이번 시도 실패. */
export const PROBE_TIMEOUT_MS = 8_000

export function useOfflineProbe(): void {
  const offline = useConnectionStore((s) => s.offline)
  useEffect(() => {
    if (!offline) return
    let stopped = false
    let inFlight = false
    let controller: AbortController | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null
    const finish = () => {
      if (timeout) clearTimeout(timeout)
      timeout = null
      controller = null
      inFlight = false
    }
    let lastAt = Number.NEGATIVE_INFINITY
    const attempt = (force = false) => {
      const probe = getConnectionProbe()
      if (stopped || inFlight || !probe) return
      if (!force && Date.now() - lastAt < PROBE_INTERVAL_MS) return
      lastAt = Date.now()
      inFlight = true
      const own = new AbortController()
      controller = own
      timeout = setTimeout(() => own.abort(), PROBE_TIMEOUT_MS)
      probe(own.signal).then(
        () => {
          finish()
          if (!stopped) useConnectionStore.getState().report(true)
        },
        () => {
          finish()
        },
      )
    }
    const timer = setInterval(() => attempt(), PROBE_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') attempt()
    }
    const onOnline = () => attempt(true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      stopped = true
      controller?.abort()
      if (timeout) clearTimeout(timeout)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [offline])
}
