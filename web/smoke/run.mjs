/**
 * `npm run smoke:webkit`(79-, 상시 게이트). 순서:
 *  1. 스모크 파일 타입 검사(`smoke/tsconfig.json`)
 *  2. 스모크 빌드(앱 설정 그대로 + 진입점 · 출력 · 환경 폴더만 다름) -> 저장소 밖 임시 폴더
 *  3. ② 새지 않음: 앱 시험 빌드(`--mode trial`)를 임시 폴더에 따로 내고 스모크 표지 0을 확인 · 스모크 결과물에는 표지가 있는지(검사가 살아 있는지)도 확인
 *  4. Playwright: WebKit(iPhone 14 Pro) + Chromium(Pixel 7)
 * 원격 0(시험이 127.0.0.1 밖 요청을 막고 센다). 결과물 · 스크린샷은 모두 `os.tmpdir()/ondolog-smoke`(저장소 밖).
 * `--only=webkit`이면 WebKit만 돈다.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanForMarkers } from './markers.mjs'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = process.env.ONDOLOG_SMOKE_ROOT ?? path.join(os.tmpdir(), 'ondolog-smoke')
const smokeOut = path.join(root, 'dist')
const trialOut = path.join(root, 'app-trial')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)

const started = Date.now()
const step = (label, cmd, args) => {
  const t = Date.now()
  process.stdout.write(`\n[smoke] ${label}\n`)
  const r = spawnSync(cmd, args, { cwd: webDir, stdio: 'inherit', shell: true, env: { ...process.env, ONDOLOG_SMOKE_OUT: smokeOut, ONDOLOG_SMOKE_ROOT: root } })
  if (r.status !== 0) { console.error(`[smoke] 실패: ${label}`); process.exit(r.status ?? 1) }
  console.log(`[smoke] ${label} - ${((Date.now() - t) / 1000).toFixed(1)}s`)
}

step('타입 검사', 'npx', ['tsc', '-p', 'smoke/tsconfig.json'])
step('스모크 빌드', 'npx', ['vite', 'build', '--config', 'smoke/vite.smoke.config.ts', '--mode', 'smoke', '--logLevel', 'warn'])
step('앱 시험 빌드(새지 않음 검사용 · 임시 폴더)', 'npx', ['vite', 'build', '--mode', 'trial', '--outDir', JSON.stringify(trialOut), '--emptyOutDir', '--logLevel', 'warn'])

const leaks = scanForMarkers(trialOut)
// 시험 빌드 사본은 원격 연결 값(web/.env)을 담을 수 있으니 검사 뒤 바로 지운다.
fs.rmSync(trialOut, { recursive: true, force: true })
if (leaks.length > 0) { console.error('[smoke] 앱 시험 빌드에 스모크 표지가 있어요:', leaks); process.exit(1) }
const alive = scanForMarkers(smokeOut)
if (!alive.some((h) => h.marker === '__ONDOLOG_SMOKE_ONLY__')) { console.error('[smoke] 스모크 결과물에서 표지를 못 찾았어요 - 검사가 죽었어요'); process.exit(1) }
console.log('[smoke] 새지 않음: 앱 시험 빌드 표지 0 · 스모크 결과물 표지 있음')

step('Playwright', 'npx', ['playwright', 'test', '-c', 'smoke/playwright.config.ts', ...(only ? [`--project=${only}`] : [])])
console.log(`\n[smoke] 전부 통과 - ${((Date.now() - started) / 1000).toFixed(1)}s (스크린샷: ${path.join(root, 'shots')})`)
