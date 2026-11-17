/**
 * `npm run gate`(80- · 79-덧붙임 2 · R115-4): web 상시 게이트를 **순서대로** 돈다 - 스모크는 다른 시험과 동시에 돌지 않는다.
 *   1. web tsc  2. Vitest  3. 법무 관문(LEGAL_CHECK=1, 법무 시험 파일)  4. `smoke:webkit`(스모크 실행기 - 자체 잠금으로 겹쳐 돌지 않음)
 * 하나라도 실패하면 거기서 멈춘다. 단계별 소요 시간을 찍는다(값 · 주소 0).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const started = Date.now()
const steps = [
  ['web tsc', 'npx', ['tsc', '--noEmit'], {}],
  ['Vitest', 'npx', ['vitest', 'run'], {}],
  ['법무 관문', 'npx', ['vitest', 'run', 'src/legal'], { LEGAL_CHECK: '1' }],
  ['smoke:webkit', 'node', ['smoke/run.mjs'], {}],
]
for (const [label, cmd, args, env] of steps) {
  const t = Date.now()
  console.log(`\n[gate] ${label}`)
  const r = spawnSync(cmd, args, { cwd: webDir, stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
  if (r.status !== 0) { console.error(`[gate] 실패: ${label}`); process.exit(r.status ?? 1) }
  console.log(`[gate] ${label} - ${((Date.now() - t) / 1000).toFixed(1)}s`)
}
console.log(`\n[gate] 전부 통과 - ${((Date.now() - started) / 1000).toFixed(1)}s`)
