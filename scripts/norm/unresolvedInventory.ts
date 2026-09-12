/**
 * UNRESOLVED 집계 스크립트 — 정의 지점(레지스트리 키)과 소비 지점(실제
 * 호출부)을 `src/engine/` 하위 재귀 순회로 열거해 stdout에 출력한다.
 *
 * 근거: .claude/state/prompts/phase-7/17-engine-dev-static-rules.md 3부,
 * docs/ONDOLOG_MASTER.md Part 16-2 ("`UNRESOLVED` 키는 이 목록과 1:1로
 * 대응한다").
 *
 * ── 이것은 테스트가 아니다 ──────────────────────────────────────────
 * 소비 지점 수는 정상 작업(새 엔진 함수가 미해결 계수를 만나 UNRESOLVED를
 * 호출하기 시작하는 것)으로 늘어난다. 고정된 수를 assert하는 테스트로
 * 만들면 정상적인 작업이 매번 실패한다. 이 스크립트는 차단이 아니라
 * 관측이 목적이다 — `__tests__/`에 두지 않고 `scripts/`에 둔다.
 *
 * ── 재귀로 순회하는 이유 ─────────────────────────────────────────────
 * 정의 지점(`UNRESOLVED_REGISTRY`)이 있는 `src/engine/constants/unresolved.ts`는
 * `src/engine/` 루트가 아니라 하위 디렉터리에 있다. 디렉터리를 재귀로
 * 순회하지 않으면 정의 지점 자체를 놓친다.
 *
 * ── 주석 처리 ────────────────────────────────────────────────────────
 * 주석을 제거한 뒤 센다 — 이 저장소의 여러 엔진 파일이 "UNRESOLVED를
 * 이렇게 소비한다"는 설명을 TSDoc 주석에 예시로 인용하기 때문이다(예:
 * `src/engine/dnaScore.ts`·`src/engine/temperature.ts`의 docblock). 그
 * 예시를 실제 호출부로 잘못 세면 소비 지점 수가 부풀려진다. 블록 주석은
 * 줄번호가 밀리지 않도록 개행만 남기고 내용을 지우며, 줄 주석은 같은 줄
 * 내용만 지운다 — 그래서 보고하는 줄번호가 원본 파일과 그대로 대응한다.
 *
 * ── 파일 I/O 없음 ────────────────────────────────────────────────────
 * stdout에만 출력한다. `src/engine/` 아래 어떤 파일도 만들거나 고치지
 * 않는다.
 *
 * ── 실행 방법 (Windows / PowerShell, 저장소 루트에서 실행) ────────────
 * 프로젝트에 TS 러너(ts-node/tsx)가 없고 Node 네이티브 TS 실행은 확장자
 * 없는 상대 import를 해석하지 못하므로, `scripts/generate-norm.ts`·
 * `scripts/norm/attachment-diagnostic.ts`와 같이 1회용으로 컴파일 후
 * 실행한다 (의존성·설정 파일 변경 없음, 임시 산출물은 build 디렉터리).
 * 이 스크립트는 다른 로컬 모듈을 import하지 않아 tsc가 공통 루트를
 * 추론할 다른 입력 파일이 없으므로, `--rootDir .`를 명시해 저장소 루트
 * 기준 경로(`scripts/norm/unresolvedInventory.js`)로 산출되게 한다:
 *
 *   npx tsc scripts/norm/unresolvedInventory.ts --ignoreConfig --ignoreDeprecations "6.0" \
 *     --outDir .norm-build --rootDir . --module commonjs --moduleResolution node \
 *     --target es2022 --esModuleInterop --skipLibCheck --resolveJsonModule --types node
 *   node .norm-build/scripts/norm/unresolvedInventory.js
 *   rm -rf .norm-build
 *
 * `.norm-build/`는 임시 산출물이다(커밋 금지).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * 집계 대상 루트 — src/engine/ 하위 전체(재귀).
 *
 * `__dirname` 대신 `process.cwd()`로 잡는다 — `scripts/generate-norm.ts`와
 * 같은 이유다. 이 스크립트는 실행 방법대로 tsc로 컴파일한 뒤
 * `.norm-build/scripts/norm/unresolvedInventory.js`로 실행되므로,
 * `__dirname`은 컴파일된 파일의 위치(`.norm-build/scripts/norm`)를
 * 가리켜 소스 트리 기준 상대 경로(`../../src/engine`)가 어긋난다.
 * 저장소 루트에서 실행한다는 전제로 `process.cwd()`를 쓴다.
 */
const ENGINE_DIR = path.resolve(process.cwd(), 'src', 'engine')

/** stdout 표기용 — 저장소 루트 기준 상대 경로, 슬래시로 통일. */
const REPO_ROOT = process.cwd()

/**
 * 블록 주석은 줄번호를 보존하도록 개행만 남기고 지우고, 줄 주석은 같은
 * 줄의 내용만 지운다. 그래서 반환된 문자열을 줄 단위로 나누면 원본
 * 파일의 줄번호와 정확히 대응한다.
 */
function stripCommentsPreservingLines(source: string): string {
  const blockStripped = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, ''),
  )
  return blockStripped.replace(/\/\/.*$/gm, '')
}

/** `src/engine/` 하위를 재귀로 순회해 `.ts`(테스트 제외)만 모은다. */
function collectEngineFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let results: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(collectEngineFilesRecursive(fullPath))
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts')
    ) {
      results.push(fullPath)
    }
  }
  return results
}

interface UnresolvedSite {
  readonly file: string
  readonly line: number
  readonly key: string
}

/** 키 정의 선언 파일명 — Part 16-2: "키 목록 선언은 이 파일에만 존재한다". */
const REGISTRY_FILE_NAME = 'unresolved.ts'

/** `UNRESOLVED_REGISTRY` 리터럴 안에서 `'key': {` 형태의 항목 시작 줄. */
const KEY_DEFINITION_LINE_PATTERN = /^\s*['"]([a-zA-Z0-9_.]+)['"]\s*:\s*\{/

/** 레지스트리 리터럴 시작/종료 표식. */
const REGISTRY_START_PATTERN = /UNRESOLVED_REGISTRY\s*=/
const REGISTRY_END_PATTERN = /^\}\s*as\s+const/

/** 실제 호출부: `UNRESOLVED({ key: '...' })` 형태만 소비로 센다. */
const CONSUMPTION_LINE_PATTERN =
  /UNRESOLVED\s*\(\s*\{\s*key\s*:\s*['"]([a-zA-Z0-9_.]+)['"]/

/** 정의 지점 — `UNRESOLVED_REGISTRY`에 등록된 각 키의 선언 줄. */
function findDefinitionSites(files: readonly string[]): UnresolvedSite[] {
  const sites: UnresolvedSite[] = []
  for (const file of files) {
    if (path.basename(file) !== REGISTRY_FILE_NAME) continue
    const lines = stripCommentsPreservingLines(fs.readFileSync(file, 'utf8')).split(
      '\n',
    )
    let inRegistry = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!inRegistry) {
        if (REGISTRY_START_PATTERN.test(line)) inRegistry = true
        continue
      }
      if (REGISTRY_END_PATTERN.test(line)) {
        inRegistry = false
        continue
      }
      const m = line.match(KEY_DEFINITION_LINE_PATTERN)
      if (m) sites.push({ file, line: i + 1, key: m[1] })
    }
  }
  return sites
}

/** 소비 지점 — `src/engine/` 하위 어디서든 `UNRESOLVED({ key: ... })`를 호출하는 실행 코드 줄. */
function findConsumptionSites(files: readonly string[]): UnresolvedSite[] {
  const sites: UnresolvedSite[] = []
  for (const file of files) {
    const lines = stripCommentsPreservingLines(fs.readFileSync(file, 'utf8')).split(
      '\n',
    )
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(CONSUMPTION_LINE_PATTERN)
      if (m) sites.push({ file, line: i + 1, key: m[1] })
    }
  }
  return sites
}

function toRelPath(file: string): string {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/')
}

function formatSite(site: UnresolvedSite): string {
  return `  ${toRelPath(site.file)}:${site.line}  key="${site.key}"`
}

function main(): void {
  const files = collectEngineFilesRecursive(ENGINE_DIR)
  const definitions = findDefinitionSites(files)
  const consumptions = findConsumptionSites(files)

  console.log('=== UNRESOLVED 집계 (src/engine/ 재귀 순회, 주석 제거 후) ===')
  console.log('')
  console.log(`정의 지점 (${definitions.length}개)`)
  for (const d of definitions) console.log(formatSite(d))
  console.log('')
  console.log(`소비 지점 (${consumptions.length}개)`)
  if (consumptions.length === 0) console.log('  (없음)')
  for (const c of consumptions) console.log(formatSite(c))
  console.log('')
  console.log(
    `합계        : 정의 ${definitions.length} + 소비 ${consumptions.length} = ${
      definitions.length + consumptions.length
    }`,
  )
}

main()
