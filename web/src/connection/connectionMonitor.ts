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

/** 확인 요청 한 번의 제한(ms). `useOfflineProbe`의 제한과 같은 값. */
export const CONFIRM_TIMEOUT_MS = 8_000

/** 기기가 스스로 "네트워크 없음"이라 한다(비행기 모드 등) - 확실한 신호. 그 밖에는 모른다(`onLine: true`는 풀림의 증거가 아니다). */
export function deviceSaysOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** 지금 하는 중인 올리기(본문이 큰 쓰기) 요청 수. 올리는 동안은 회선이 꽉 차 확인 요청이 늦는 것이 정상이라 그것만으로 끊김으로 보지 않는다. */
let uploadsInFlight = 0
export function getUploadsInFlight(): number {
  return uploadsInFlight
}

/**
 * 올리기 요청인가 - 본문이 파일 덩어리(Blob · ArrayBuffer · FormData · 스트림)이거나 저장소 객체 경로(`/storage/v1/object/`)로 가는 쓰기.
 * 이런 요청은 오래 걸리고, 서버 · 중간 장치가 큰 본문을 끊어도 브라우저에는 "연결 실패"와 똑같은 거부로 보인다(A-17).
 */
export function isUploadRequest(input: unknown, init?: { method?: string; body?: unknown } | null): boolean {
  const method = (init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (method === 'GET' || method === 'HEAD') return false
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as { url?: string } | null)?.url ?? ''
  if (url.includes('/storage/v1/object/')) return true
  const body = init?.body
  return (
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
  )
}

export interface TrackDeps {
  /** 거부된 올리기 요청을 끊김으로 말하기 전의 확인 요청. 기본은 등록된 확인 함수. */
  probe?: () => ConnectionProbe | null
  confirmTimeoutMs?: number
}

/**
 * 올리기 요청이 거부됐을 때: 바로 끊김이라 하지 않고 확인 요청을 보낸다. 응답이 오면 연결이다(큰 본문이 끊긴 것일 뿐).
 * 확인 요청이 거부되면 끊김, **제한 시간에 걸렸는데 다른 올리기가 아직 진행 중이면 모른다**(회선이 올리기로 찬 것) - 판정하지 않는다.
 */
async function confirmAfterUploadFailure(report: (ok: boolean) => void, deps: TrackDeps): Promise<void> {
  const probe = (deps.probe ?? getConnectionProbe)()
  if (!probe) {
    report(false)
    return
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.confirmTimeoutMs ?? CONFIRM_TIMEOUT_MS)
  try {
    await probe(controller.signal)
    report(true)
  } catch (error) {
    // 76-A2: 확인 요청이 제한에 걸린 것만으로는 끊김이 아니다 - 다른 올리기가 도는 중이거나, 기기가 네트워크 있음이라면 회선이 느린 것일 뿐이다(올리는 시간을 판정에서 뺀다).
    // 확인 요청이 **거부**(연결 실패)되거나 기기가 "네트워크 없음"이라 할 때만 끊김.
    if (isAbort(error) && !deviceSaysOffline()) return
    report(false)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * `fetch`를 감싸 결과를 알린다. 인자는 그대로 넘기고, 응답은 읽지 않고 돌려주며, 거부는 같은 오류 객체를 다시 던진다.
 * 올리기 요청의 거부(와 올리기가 도는 중의 다른 요청의 거부)만 확인 요청을 거친다(A-17 · 76-A2) - 그 밖의 일반 요청의 거부는 바로 끊김이다.
 */
export function trackConnection(
  base: typeof fetch,
  report: (ok: boolean) => void = (ok) => useConnectionStore.getState().report(ok),
  deps: TrackDeps = {},
): typeof fetch {
  return ((...args: Parameters<typeof fetch>) => {
    const upload = isUploadRequest(args[0], args[1] as { method?: string; body?: unknown } | undefined)
    if (upload) uploadsInFlight += 1
    return base(...args).then(
      (response) => {
        if (upload) uploadsInFlight -= 1
        report(true)
        return response
      },
      (error: unknown) => {
        if (upload) uploadsInFlight -= 1
        if (!isAbort(error)) {
          // 기기가 "네트워크 없음"이면 바로 끊김. 아니면 올리기 요청의 거부(또는 올리기가 도는 중의 다른 요청 거부)는 확인 요청으로만 판정한다(A-17).
          if (deviceSaysOffline()) report(false)
          else if (upload || uploadsInFlight > 0) void confirmAfterUploadFailure(report, deps)
          else report(false)
        }
        throw error
      },
    )
  }) as typeof fetch
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
