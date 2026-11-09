/**
 * I02 연결 끊김 판정(웹판, RN `connectionMonitor`와 같은 규칙 - `72b-` · `72c-`).
 *
 * 웹 클라이언트가 보내는 모든 요청(`auth/client.ts`의 `global.fetch`)을 `trackConnection`으로 감싼다:
 *   - 그 `fetch` 호출이 **거부(reject)되면** 끊김이다. 오류 종류를 짐작하지 않고 호출 바로 그 자리에서 판정한다.
 *   - 응답이 오면 상태 코드와 무관하게(4xx · 5xx 포함) 연결은 된 것이다.
 *   - 호출자가 중단한 요청(`AbortError`)은 끊김이 아니다.
 * 웹에서 더해진 신호: 브라우저의 `offline` 이벤트(= `navigator.onLine === false`)는 연결이 없다는 확실한 신호라 바로 끊김으로 본다.
 * 반대(`online` 이벤트 · `navigator.onLine === true`)는 풀림의 증거가 아니다(연결 없는 Wi-Fi 등) - 풀기는 확인 요청(`useOfflineProbe`)만 한다.
 * `@capacitor/network`는 쓰지 않는다(웹 이벤트 + 확인 요청으로 충분).
 */
import { create } from 'zustand'

interface ConnectionState {
  /** 마지막 요청이 거부로 끝났거나 브라우저가 오프라인이라 했으면 true. */
  offline: boolean
  report: (ok: boolean) => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  offline: false,
  report: (ok) => {
    const offline = !ok
    if (get().offline !== offline) set({ offline })
  },
}))

function isAbort(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
}

/** `fetch`를 감싸 결과를 알린다. 인자는 그대로 넘기고, 응답은 읽지 않고 돌려주며, 거부는 같은 오류 객체를 다시 던진다. */
export function trackConnection(
  base: typeof fetch,
  report: (ok: boolean) => void = (ok) => useConnectionStore.getState().report(ok),
): typeof fetch {
  return ((...args: Parameters<typeof fetch>) =>
    base(...args).then(
      (response) => {
        report(true)
        return response
      },
      (error: unknown) => {
        if (!isAbort(error)) report(false)
        throw error
      },
    )) as typeof fetch
}

/** 띠 풀기 확인 요청. 응답이 오면(상태 무관) resolve, 거부되면 reject. 감싸기를 지나지 않는다. */
export type ConnectionProbe = (signal?: AbortSignal) => Promise<unknown>
let probe: ConnectionProbe | null = null
export function registerConnectionProbe(next: ConnectionProbe | null): void {
  probe = next
}
export function getConnectionProbe(): ConnectionProbe | null {
  return probe
}

/** 브라우저 `offline` 이벤트를 끊김으로 알린다. 돌려준 함수로 푼다. */
export function listenBrowserOffline(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  report: (ok: boolean) => void = (ok) => useConnectionStore.getState().report(ok),
): () => void {
  const onOffline = () => report(false)
  target.addEventListener('offline', onOffline)
  return () => target.removeEventListener('offline', onOffline)
}
