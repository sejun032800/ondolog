/**
 * 86-(R128-4 · 분류 C) Vitest 공용 정리 - 시험마다 끝에 전역 상태를 되돌린다(파일의 afterEach가 먼저 돌고 이것이 마지막 - hooks 'stack').
 * 시험이 아니라 설정 파일이다(이름이 `*.vitest.ts`가 아니라 시험으로 줍히지 않는다). 앱 코드는 이 파일을 모른다.
 *  - DOM: testing-library `cleanup`(여러 번 불러도 됨)
 *  - 시계: 가짜 타이머를 켠 채 끝난 시험이 다음 시험을 멈추지 않게 실제 타이머로
 *  - 전역 바꿔치기(`vi.stubGlobal`) · 감시(`vi.spyOn`) 되돌림
 *  - 기기 저장(localStorage · sessionStorage) 비움 - 앞 시험의 저장분이 다음 시험의 첫 그림을 바꾸지 않게
 *  - 오류 기록(80-) 모듈의 모아 둔 건수 · 보내기 타이머 - 앞 시험이 센 오류가 뒤 시험의 가짜 서버로 `log_app_error`를 보내지 않게
 *    (순서를 섞으면 피드 E03 "[취소]는 아무것도 지우지 않는다"가 RPC 1건을 봤다)
 * 87-(R148-4): **시험은 원격 0.** Vite가 시험에도 `web/.env`를 읽어 `import.meta.env`에 실제 접속 값이 들어온다 -> `setSupabaseForTest(undefined)` 뒤
 *  `getSupabase()`가 실제 클라이언트를 만들고, 오류 기록 보내기(2초 · 5초 타이머)가 실제 `log_app_error`를 부를 수 있었다(11/18 `unknown · upload_fail · web` 17).
 *  - 시험마다 두 접속 값을 빈 값으로(`vi.stubEnv`) -> `readRemoteEnv()` = null -> 실제 클라이언트 0. 값이 필요한 시험은 자기 안에서 다시 stubEnv.
 *  - 그물: 전역 `fetch`를 막는 함수로 바꿔 둔다(data: · blob:만 통과). 막힌 요청은 수만 센다(`vitestBlockedFetches`) - 주소 · 값은 남기지 않는다.
 *    시험이 `vi.stubGlobal('fetch', …)`로 바꾸면 그 시험 동안은 그 가짜가 쓰이고, 끝나면 이 그물로 돌아온다.
 * 파일마다 처음에 한 번(분류 E): Capacitor 플러그인의 웹 구현은 처음 쓸 때 동적 `import()`로 읽힌다(실제 디스크 읽기). 가짜 타이머로 도는 시험에서는
 *  그 읽기가 가짜 시간과 따로 놀아, 부하에서 첫 화면이 `settle()` 뒤에야 나왔다(hotfix74h1 "카카오로 시작하기" 못 찾음). 미리 읽어 두면 첫 사용이 마이크로태스크로 끝난다.
 */
import { afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { clearAppErrorCounts, resetErrorLogForTest } from './errorLog/errorLog'

let blocked = 0
/** 87-: 이 워커에서 그물에 막힌 바깥 요청 수(시험이 0인지 본다). */
export function vitestBlockedFetches(): number {
  return blocked
}
const passFetch = globalThis.fetch?.bind(globalThis)
const netGuard = ((input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if ((raw.startsWith('data:') || raw.startsWith('blob:')) && passFetch) return passFetch(input, init)
  blocked += 1
  return Promise.reject(new TypeError('vitest: network blocked (87-)'))
}) as typeof fetch
globalThis.fetch = netGuard

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
})

beforeAll(async () => {
  await Promise.all([
    import('@capacitor/app/dist/esm/web.js'),
    import('@capacitor/browser/dist/esm/web.js'),
    import('@capacitor/camera/dist/esm/web.js'),
    import('@capacitor/filesystem/dist/esm/web.js'),
    import('@capacitor/preferences/dist/esm/web.js'),
    import('@capacitor/share/dist/esm/web.js'),
    import('@capacitor/splash-screen/dist/esm/web.js'),
  ])
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  globalThis.fetch = netGuard
  vi.restoreAllMocks()
  resetErrorLogForTest()
  clearAppErrorCounts()
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // 저장소가 막힌 시험 환경 - 지울 것이 없다
  }
})
