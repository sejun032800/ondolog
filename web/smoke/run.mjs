/**
 * `npm run smoke:webkit`(79-, 상시 게이트). 순서:
 *  1. 스모크 파일 타입 검사(`smoke/tsconfig.json`)
 *  2. 스모크 빌드(앱 설정 그대로 + 진입점 · 출력 · 환경 폴더만 다름) -> 저장소 밖 임시 폴더
 *  2b. 84-h: 같은 스모크 빌드를 `--mode trial`로 한 벌 더(시험판 "유성 미리 보기" 스모크용 · 환경 폴더는 같은 빈 폴더 - 원격 값 0) -> `dist-trial`
 *  3. ② 새지 않음: 앱 시험 빌드(`--mode trial`)를 임시 폴더에 따로 내고 스모크 표지 0을 확인 · 스모크 결과물에는 표지가 있는지(검사가 살아 있는지)도 확인
 *  3b. 84-h(R145-2): 앱 출시 빌드(`vite build`, 가짜 연결 값 - 실제 값 0)를 임시 폴더에 내고 시험판 "유성 미리 보기" 표지 0 · 시험 빌드에는 표지 모두 있음
 *  3c. 92-(R154-5): 스모크 진입 파일(`smoke/entry.tsx`) 표지(`ENTRY_MARKERS`)가 앱 출시 빌드 · 앱 시험 빌드에 0 · 스모크 결과물에는 모두 있음(음성 대조)
 *  4. Playwright: WebKit(iPhone 14 Pro) + Chromium(Pixel 7)
 * 원격 0(시험이 127.0.0.1 밖 요청을 막고 센다). 결과물 · 스크린샷은 모두 `os.tmpdir()/ondolog-smoke`(저장소 밖).
 * `--only=webkit`이면 WebKit만 돈다.
 * 80- (79-덧붙임 1 · 2): 회차 이름(`ONDOLOG_SMOKE_RUN`)을 정해 실패 기록을 `runs/<회차>/failures.md`에 남기고(덮어쓰기 0),
 * 잠금 파일로 스모크가 겹쳐 돌지 않게 한다. 다른 시험과의 순서는 `npm run gate`(smoke/gate.mjs)가 맡는다.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENTRY_MARKERS, PREVIEW_MARKERS, scanForMarkers } from './markers.mjs'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = process.env.ONDOLOG_SMOKE_ROOT ?? path.join(os.tmpdir(), 'ondolog-smoke')
const smokeOut = path.join(root, 'dist')
const smokeTrialOut = path.join(root, 'dist-trial')
const trialOut = path.join(root, 'app-trial')
const releaseOut = path.join(root, 'app-release')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const run = new Date().toISOString().replace(/[:.]/g, '-')
const runDir = path.join(root, 'runs', run)

// 잠금: 다른 스모크가 돌고 있으면 시작하지 않는다(그 프로세스가 죽었으면 잠금을 치운다).
fs.mkdirSync(root, { recursive: true })
const lock = path.join(root, 'smoke.lock')
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
try {
  fs.writeFileSync(lock, String(process.pid), { flag: 'wx' })
} catch {
  const other = Number(fs.readFileSync(lock, 'utf8'))
  if (Number.isFinite(other) && other !== process.pid && pidAlive(other)) { console.error('[smoke] 다른 스모크가 돌고 있어요 - 끝난 뒤 다시'); process.exit(1) }
  fs.writeFileSync(lock, String(process.pid))
}
process.on('exit', () => { try { if (fs.readFileSync(lock, 'utf8') === String(process.pid)) fs.rmSync(lock) } catch { /* 없음 */ } })

const started = Date.now()
const step = (label, cmd, args, extraEnv = {}) => {
  const t = Date.now()
  process.stdout.write(`\n[smoke] ${label}\n`)
  const r = spawnSync(cmd, args, { cwd: webDir, stdio: 'inherit', shell: true, env: { ...process.env, ONDOLOG_SMOKE_OUT: smokeOut, ONDOLOG_SMOKE_ROOT: root, ONDOLOG_SMOKE_RUN: run, ...extraEnv } })
  if (r.status !== 0) {
    console.error(`[smoke] 실패: ${label}`)
    if (fs.existsSync(path.join(runDir, 'failures.md'))) console.error(`[smoke] 실패 기록: ${path.join(runDir, 'failures.md')}`)
    process.exit(r.status ?? 1)
  }
  console.log(`[smoke] ${label} - ${((Date.now() - t) / 1000).toFixed(1)}s`)
}

step('타입 검사', 'npx', ['tsc', '-p', 'smoke/tsconfig.json'])
step('스모크 빌드', 'npx', ['vite', 'build', '--config', 'smoke/vite.smoke.config.ts', '--mode', 'smoke', '--logLevel', 'warn'])
step('스모크 시험판 빌드(84-h 미리 보기)', 'npx', ['vite', 'build', '--config', 'smoke/vite.smoke.config.ts', '--mode', 'trial', '--logLevel', 'warn'], { ONDOLOG_SMOKE_OUT: smokeTrialOut })
step('앱 시험 빌드(새지 않음 검사용 · 임시 폴더)', 'npx', ['vite', 'build', '--mode', 'trial', '--outDir', JSON.stringify(trialOut), '--emptyOutDir', '--logLevel', 'warn'])

const leaks = scanForMarkers(trialOut)
const entryInTrial = scanForMarkers(trialOut, ENTRY_MARKERS)
const previewInTrial = new Set(scanForMarkers(trialOut, PREVIEW_MARKERS).map((h) => h.marker))
// 시험 빌드 사본은 원격 연결 값(web/.env)을 담을 수 있으니 검사 뒤 바로 지운다.
fs.rmSync(trialOut, { recursive: true, force: true })
if (leaks.length > 0) { console.error('[smoke] 앱 시험 빌드에 스모크 표지가 있어요:', leaks); process.exit(1) }
if (entryInTrial.length > 0) { console.error('[smoke] 앱 시험 빌드에 스모크 진입 파일(entry.tsx)이 들어 있어요:', entryInTrial); process.exit(1) }
const alive = scanForMarkers(smokeOut)
if (!alive.some((h) => h.marker === '__ONDOLOG_SMOKE_ONLY__')) { console.error('[smoke] 스모크 결과물에서 표지를 못 찾았어요 - 검사가 죽었어요'); process.exit(1) }
// 92- 음성 대조: 진입 파일이 실제로 든 번들(스모크 결과물)에서는 표지가 모두 잡혀야 한다 - 못 잡으면 표지 · 검사가 죽은 것
const entryAlive = new Set(scanForMarkers(smokeOut, ENTRY_MARKERS).map((h) => h.marker))
const entryMissing = ENTRY_MARKERS.filter((m) => !entryAlive.has(m))
if (entryMissing.length > 0) { console.error('[smoke] 스모크 결과물에서 진입 파일 표지를 못 찾았어요 - 검사가 죽었어요:', entryMissing); process.exit(1) }
console.log('[smoke] 새지 않음: 앱 시험 빌드 표지 · 진입 파일 0 · 스모크 결과물 표지 · 진입 파일 있음')

// 84-h: 출시 빌드에 시험판 미리 보기 0. 운영 빌드는 연결 값이 없으면 멈추므로(vite.config) 가짜 값을 넣는다 - 실제 값 · 주소가 결과물에 들어가지 않는다.
step('앱 출시 빌드(미리 보기 새지 않음 검사용 · 임시 폴더)', 'npx', ['vite', 'build', '--outDir', JSON.stringify(releaseOut), '--emptyOutDir', '--logLevel', 'warn'],
  { VITE_SUPABASE_URL: 'https://release-check.invalid', VITE_SUPABASE_ANON_KEY: 'release-check-only' })
const previewLeaks = scanForMarkers(releaseOut, PREVIEW_MARKERS)
const releaseSmokeLeaks = scanForMarkers(releaseOut, [...ENTRY_MARKERS])   // 92-(R154-5) - 스모크 진입 파일이 운영 번들에 없다
fs.rmSync(releaseOut, { recursive: true, force: true })
if (previewLeaks.length > 0) { console.error('[smoke] 앱 출시 빌드에 시험판 미리 보기가 있어요:', previewLeaks); process.exit(1) }
if (releaseSmokeLeaks.length > 0) { console.error('[smoke] 앱 출시 빌드에 스모크 진입 파일(entry.tsx)이 들어 있어요:', releaseSmokeLeaks); process.exit(1) }
const previewMissing = PREVIEW_MARKERS.filter((m) => !previewInTrial.has(m))
if (previewMissing.length > 0) { console.error('[smoke] 시험 빌드에서 미리 보기 표지를 못 찾았어요 - 검사가 죽었어요:', previewMissing); process.exit(1) }
console.log('[smoke] 미리 보기: 앱 출시 빌드 표지 0 · 앱 시험 빌드 표지 모두 있음 / 진입 파일: 앱 출시 빌드 0')

step('Playwright', 'npx', ['playwright', 'test', '-c', 'smoke/playwright.config.ts', ...(only ? [`--project=${only}`] : [])])
console.log(`\n[smoke] 전부 통과 - ${((Date.now() - started) / 1000).toFixed(1)}s (스크린샷: ${path.join(root, 'shots')})`)
