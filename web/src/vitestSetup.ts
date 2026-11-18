/**
 * 86-(R128-4 · 분류 C) Vitest 공용 정리 - 시험마다 끝에 전역 상태를 되돌린다(파일의 afterEach가 먼저 돌고 이것이 마지막 - hooks 'stack').
 * 시험이 아니라 설정 파일이다(이름이 `*.vitest.ts`가 아니라 시험으로 줍히지 않는다). 앱 코드는 이 파일을 모른다.
 *  - DOM: testing-library `cleanup`(여러 번 불러도 됨)
 *  - 시계: 가짜 타이머를 켠 채 끝난 시험이 다음 시험을 멈추지 않게 실제 타이머로
 *  - 전역 바꿔치기(`vi.stubGlobal`) · 감시(`vi.spyOn`) 되돌림
 *  - 기기 저장(localStorage · sessionStorage) 비움 - 앞 시험의 저장분이 다음 시험의 첫 그림을 바꾸지 않게
 *  - 오류 기록(80-) 모듈의 모아 둔 건수 · 보내기 타이머 - 앞 시험이 센 오류가 뒤 시험의 가짜 서버로 `log_app_error`를 보내지 않게
 *    (순서를 섞으면 피드 E03 "[취소]는 아무것도 지우지 않는다"가 RPC 1건을 봤다)
 * 파일마다 처음에 한 번(분류 E): Capacitor 플러그인의 웹 구현은 처음 쓸 때 동적 `import()`로 읽힌다(실제 디스크 읽기). 가짜 타이머로 도는 시험에서는
 *  그 읽기가 가짜 시간과 따로 놀아, 부하에서 첫 화면이 `settle()` 뒤에야 나왔다(hotfix74h1 "카카오로 시작하기" 못 찾음). 미리 읽어 두면 첫 사용이 마이크로태스크로 끝난다.
 */
import { afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { clearAppErrorCounts, resetErrorLogForTest } from './errorLog/errorLog'

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
