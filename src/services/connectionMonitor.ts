/**
 * I02 연결 끊김 판정 - 새 의존성 없이, **감싼 `fetch` 호출 자체의 거부로 판정한다**(`72b-`, R58-2).
 *
 * 저장소에는 네트워크 상태를 읽는 수단(NetInfo 등)이 없다. 그래서 서버 클라이언트가 보내는 모든 요청(`supabase.ts`의 `global.fetch`)을 이 함수로 감싼다:
 *   - 그 `fetch` 호출이 **거부(reject)되면** 끊김이다. 판정은 오류 종류를 짐작하지 않고 호출 바로 그 자리에서 한다.
 *   - 응답이 오면 상태 코드와 무관하게(4xx · 5xx 포함) 연결은 된 것이다. 응답 뒤의 파싱 오류 · 앱 코드 오류는 이 호출 밖이라 끊김이 아니다.
 *   - 호출자가 중단한 요청(`AbortError`)은 끊김이 아니다.
 * 띠 풀기: 요청이 없는 화면에서도 풀리도록 `useOfflineProbe`가 띠가 떠 있을 때만 상태 확인 하나를 보낸다(감싸기를 지나지 않는 원래 `fetch`).
 */
import { create } from 'zustand'

interface ConnectionState {
  /** 마지막 요청이 거부로 끝났으면 true. 아직 요청이 없으면 false. */
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

/**
 * `fetch`를 감싸 결과를 `useConnectionStore`에 알린다.
 * 인자는 받은 그대로 넘기고, 응답은 읽지 않고 그대로 돌려주며, 거부는 같은 오류 객체를 다시 던진다.
 */
export function trackConnection(base: typeof fetch, report: (ok: boolean) => void = (ok) => useConnectionStore.getState().report(ok)): typeof fetch {
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
