/**
 * 86-(R128-4) 부하 상태 Vitest 반복 - 흔들리는 시험 찾기 · 20회 연속 확인. Node 기본 기능만(새 패키지 0).
 *
 * 부하 조건: 측정 회차는 Vitest 워커를 최대(논리 코어 수)로 돌리고, **같은 시각에 Vitest 전체를 한 벌 더**(같은 워커 수) 돌린다.
 * 기록(JSON · 요약)은 저장소 밖 `os.tmpdir()/ondolog-stress/<회차>`에만. 화면에는 숫자와 시험 이름만.
 *
 * 사용(web/에서): node scripts/stress-vitest.mjs [--runs 20] [--stop-on-fail] [--no-load] [--sequence-shuffle]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d }
const runs = Number(value('--runs', '20'))
const cores = os.availableParallelism ? os.availableParallelism() : os.cpus().length
const outDir = path.join(os.tmpdir(), 'ondolog-stress', new Date().toISOString().replace(/[:.]/g, '-'))
fs.mkdirSync(outDir, { recursive: true })

function vitest(extra, reportFile) {
  const a = ['vitest', 'run', `--maxWorkers=${cores}`, '--reporter=json', `--outputFile=${JSON.stringify(reportFile)}`, ...extra]
  return new Promise((resolve) => {
    const child = spawn('npx', a, { cwd: webDir, shell: true, stdio: ['ignore', 'ignore', 'ignore'] })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

function failuresOf(reportFile) {
  try {
    const r = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
    const out = []
    for (const file of r.testResults ?? []) {
      for (const t of file.assertionResults ?? []) {
        if (t.status === 'failed') {
          const msg = String((t.failureMessages ?? [])[0] ?? '').split('\n')[0].slice(0, 160)
          out.push({ file: path.relative(webDir, file.name).replace(/\\/g, '/'), name: t.fullName, msg })
        }
      }
      if ((file.assertionResults ?? []).length === 0 && file.status === 'failed') {
        out.push({ file: path.relative(webDir, file.name).replace(/\\/g, '/'), name: '(파일 실패)', msg: String(file.message ?? '').split('\n')[0].slice(0, 160) })
      }
    }
    return { total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: (r.numPendingTests ?? 0) + (r.numTodoTests ?? 0), list: out }
  } catch (e) {
    return { total: 0, passed: 0, failed: -1, skipped: 0, list: [{ file: '(보고 없음)', name: String(e), msg: '' }] }
  }
}

const tally = new Map()
let streak = 0
let best = 0
console.log(`[stress] 코어 ${cores} · 회차 ${runs} · 부하 ${flag('--no-load') ? '없음' : 'Vitest 한 벌 동시'} · 기록 ${outDir}`)
for (let i = 1; i <= runs; i += 1) {
  const t = Date.now()
  const report = path.join(outDir, `run-${i}.json`)
  const extra = flag('--sequence-shuffle') ? ['--sequence.shuffle'] : []
  const jobs = [vitest(extra, report)]
  if (!flag('--no-load')) jobs.push(vitest([], path.join(outDir, `load-${i}.json`)))
  await Promise.all(jobs)
  const f = failuresOf(report)
  for (const x of f.list) {
    const key = `${x.file} :: ${x.name}`
    const prev = tally.get(key) ?? { n: 0, msg: x.msg }
    tally.set(key, { n: prev.n + 1, msg: prev.msg })
  }
  streak = f.failed === 0 ? streak + 1 : 0
  best = Math.max(best, streak)
  console.log(`[stress] ${i}/${runs} ${((Date.now() - t) / 1000).toFixed(1)}s · 시험 ${f.total} 통과 ${f.passed} 실패 ${f.failed} 건너뜀 ${f.skipped} · 연속 ${streak}`)
  for (const x of f.list) console.log(`         x ${x.file} :: ${x.name} -- ${x.msg}`)
  if (f.failed !== 0 && flag('--stop-on-fail')) break
}
const summary = [...tally.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${v.n}/${runs}  ${k}  -- ${v.msg}`)
fs.writeFileSync(path.join(outDir, 'summary.txt'), summary.join('\n'))
console.log(`[stress] 끝 · 가장 긴 연속 통과 ${best} · 실패한 시험 ${tally.size}`)
for (const s of summary) console.log(`  ${s}`)
