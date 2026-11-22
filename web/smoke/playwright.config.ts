/**
 * 79- WebKit 스모크(R114-3). 같은 시험을 두 엔진으로: `webkit` = iPhone 14 Pro 기기 설정(뷰포트 · 배율 3 · 터치 · 모바일 UA),
 * `chromium` = Pixel 7(“WebKit에서만 실패”를 가르는 짝). 화면은 `smoke/vite.smoke.config.ts`로 따로 빌드한 결과물을 `vite preview`로 띄운다.
 * 결과물 · 스크린샷 · 실패 기록은 모두 저장소 밖 임시 폴더(④). 원격 0 - 시험이 127.0.0.1 밖 요청을 모두 막고 센다.
 * Playwright WebKit은 iOS Safari · WKWebView와 같은 엔진 계열이지만 같은 것이 아니다(키보드 · 안전 영역 실제 값 · 사진 선택기 · 푸시 · 스크롤 관성은 못 본다).
 */
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const smokeDir = path.dirname(fileURLToPath(import.meta.url))
const outRoot = process.env.ONDOLOG_SMOKE_ROOT ?? path.join(os.tmpdir(), 'ondolog-smoke')
const PORT = 4179
/** 84-h: 시험판 모드 스모크 빌드(`smoke/run.mjs` 2b)를 띄우는 두 번째 자리 - 시험판 "유성 미리 보기" 스모크만 쓴다(`TRIAL_BASE`). */
const TRIAL_PORT = 4180
const trialOut = path.join(outRoot, 'dist-trial')
// 80- (79-덧붙임 1): 회차 이름 - 실패 기록 · 스크린샷을 회차별 폴더에 남긴다(덮어쓰기 0). 워커는 이 값을 물려받는다.
process.env.ONDOLOG_SMOKE_RUN ??= new Date().toISOString().replace(/[:.]/g, '-')

export default defineConfig({
  testDir: smokeDir,
  // 루트 jest(`*.spec` · `*.test`)가 줍지 않게 이름은 `*.smoke.ts`.
  testMatch: /.*\.smoke\.ts$/,
  outputDir: path.join(outRoot, 'results'),
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}/`, trace: 'off', screenshot: 'off', video: 'off', locale: 'ko-KR', timezoneId: 'Asia/Seoul' },
  webServer: [
    {
      command: `npx vite preview --config smoke/vite.smoke.config.ts --mode smoke --host 127.0.0.1 --port ${PORT} --strictPort`,
      cwd: path.resolve(smokeDir, '..'),
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite preview --config smoke/vite.smoke.config.ts --mode trial --host 127.0.0.1 --port ${TRIAL_PORT} --strictPort`,
      cwd: path.resolve(smokeDir, '..'),
      url: `http://127.0.0.1:${TRIAL_PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...(process.env as Record<string, string>), ONDOLOG_SMOKE_OUT: trialOut },
    },
  ],
  projects: [
    { name: 'webkit', use: { ...devices['iPhone 14 Pro'] } },
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
  ],
})
