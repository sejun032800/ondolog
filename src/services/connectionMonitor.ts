/**
 * I02 연결 끊김 판정 - 새 의존성 없이, **요청 실패로 판정한다**(`72-`).
 *
 * 저장소에는 네트워크 상태를 읽는 수단(NetInfo 등)이 없다. 그래서 서버 클라이언트가 보내는 모든 요청(`supabase.ts`의 `global.fetch`)을 이 함수로 감싼다:
 *   - 요청이 **네트워크 오류로 던지면**(RN `TypeError: Network request failed` · 웹 `Failed to fetch`) 끊김으로 본다.
 *   - 응답이 오면 상태 코드와 무관하게(4xx · 5xx 포함) 연결은 된 것이다 - 끊김을 풀고 이어 간다.
 *   - 호출자가 중단한 요청(`AbortError`)은 끊김이 아니다.
 * 이 모듈은 새 요청을 만들지 않는다 - 이미 나가는 요청의 결과만 읽는다. 풀리는 시점은 다음 요청이 성공할 때다
 * (앱 복귀 때의 읽기 · 채팅 큐의 재시도가 그 요청이다).
 */
import { create } from 'zustand'

interface ConnectionState {
  /** 마지막 요청이 네트워크 오류로 끝났으면 true. 아직 요청이 없으면 false. */
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

/** 네트워크가 닿지 않아 던진 오류인가. 중단(`AbortError`)과 코드 오류는 아니다. */
export function isNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: unknown; message?: unknown }
  if (e.name === 'AbortError') return false
  if (error instanceof TypeError) return true
  const message = typeof e.message === 'string' ? e.message : ''
  return /network request (failed|timed out)|failed to fetch/i.test(message)
}

type FetchFn = (input: never, init?: never) => Promise<Response>

/** `fetch`를 감싸 결과를 `useConnectionStore`에 알린다. 요청 · 응답 · 오류는 그대로 지나간다. */
export function trackConnection<F extends FetchFn>(base: F, report: (ok: boolean) => void = (ok) => useConnectionStore.getState().report(ok)): F {
  const tracked = async (input: never, init?: never) => {
    try {
      const response = await base(input, init)
      report(true)
      return response
    } catch (error) {
      if (isNetworkFailure(error)) report(false)
      throw error
    }
  }
  return tracked as unknown as F
}
