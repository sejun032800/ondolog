import * as fs from 'fs'
import * as path from 'path'

/**
 * TSDoc 주석이 계약을 설명하려고 금지 패턴 자체를 인용하는 경우(이
 * 파일들 스스로 "Math.random을 쓰지 않는다"고 문서화하는 문장 등)가
 * 있어, 주석을 제거한 실행 코드만 검사한다. 이 저장소의 엔진 소스는
 * 문자열 리터럴 안에 `//`나 블록 주석 구분자가 들어가지 않는다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/**
 * 결정론 계약의 정적 검사: src/engine/ 하위 어디에도
 * Math.random / Date.now() / new Date() / process.env가 없어야 한다
 * (CLAUDE.md 절대 규칙 2, ROADMAP §2 Phase 2 완료 기준).
 */
describe('src/engine/ 정적 검사 — 랜덤·시간·환경변수 금지', () => {
  const engineDir = path.join(__dirname, '../../src/engine')
  const files = fs
    .readdirSync(engineDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  const FORBIDDEN_PATTERNS: readonly RegExp[] = [
    /Math\.random/,
    /Date\.now\s*\(/,
    /new\s+Date\s*\(/,
    /process\.env/,
  ]

  it('엔진 디렉터리에서 최소 한 개 이상의 .ts 파일을 스캔했다', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      it(`${file}에 ${pattern} 패턴이 없다`, () => {
        const source = stripComments(
          fs.readFileSync(path.join(engineDir, file), 'utf8'),
        )
        expect(source).not.toMatch(pattern)
      })
    }
  }

  it('패턴 자체는 실제로 위반 코드를 잡아낸다 (자체 검증)', () => {
    const contaminated = 'const x = Math.random() + Date.now() + new Date().getTime() + process.env.FOO'
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(contaminated).toMatch(pattern)
    }
  })
})

/**
 * 위 스위트는 src/engine/ **루트**의 .ts만 훑는다(`fs.readdirSync`가
 * 재귀하지 않는다). 앞으로 코너 생성 코드 등이 하위 디렉터리
 * (`src/engine/corners/` 등)에 생기면 이 검증망 밖에 남는다.
 *
 * 아래 두 스위트(규칙 A·B)만 재귀 수집을 적용한다. 위 기존 스위트의
 * 수집 범위는 건드리지 않는다 — 별도 판단이고, 넓히면 기존 통과 상태가
 * 깨질 수 있다.
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/17-engine-dev-static-rules.md
 */
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

/**
 * 규칙 A — 결정론 금지 식별자 (재귀 수집).
 *
 * 근거: CLAUDE.md 절대 규칙 2, docs/ONDOLOG_MASTER.md Part 10 (5문항
 * 채점)·Part 17-3 (6각 스탯) — 엔진 함수는 동일 입력에 동일 출력을
 * 낸다. 위 기존 스위트와 검사 패턴은 같지만(Math.random / Date.now() /
 * new Date()), 수집 범위가 `src/engine/` 하위 전체(재귀)라는 점이 다르다.
 * 주석은 위반이 아니다(stripComments로 제거 후 검사).
 */
describe('src/engine/ 정적 검사 — 규칙 A: 결정론 금지 식별자 (재귀 수집)', () => {
  const engineDir = path.join(__dirname, '../../src/engine')
  const files = collectEngineFilesRecursive(engineDir)

  const RULE_A_PATTERNS: readonly RegExp[] = [
    /Math\.random/,
    /Date\.now\s*\(/,
    /new\s+Date\s*\(/,
  ]

  it('재귀 수집으로 최소 한 개 이상의 .ts 파일을 스캔했다', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const rel = path.relative(engineDir, file)
    for (const pattern of RULE_A_PATTERNS) {
      it(`${rel}에 ${pattern} 패턴이 없다 (실행 코드, 주석 제외)`, () => {
        const source = stripComments(fs.readFileSync(file, 'utf8'))
        expect(source).not.toMatch(pattern)
      })
    }
  }

  it('패턴 자체는 실제로 위반 코드를 잡아낸다 (자체 검증)', () => {
    const contaminated = 'const x = Math.random() + Date.now() + new Date().getTime()'
    for (const pattern of RULE_A_PATTERNS) {
      expect(contaminated).toMatch(pattern)
    }
  })
})

/**
 * 규칙 B — 엔진의 외부 상태 접근 금지 (재귀 수집).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-7-5, 10-8-3 — 엔진은 계수와
 * 데이터를 인자로만 받는다. DB·네트워크·환경변수 조회는 호출부의
 * 책임이다.
 *
 * 예외: src/engine/data/ 아래 커밋된 JSON의 정적 import는 DB·네트워크·
 * 환경변수 어디에도 해당하지 않는다(이 스위트는 .ts만 수집하므로 그
 * JSON은 애초에 대상이 아니다). 규준집단 파일(norm-synthetic-*.json)을
 * 엔진이 직접 import하는 것은 Part 10-8-3이 별도로 금지하지만, 현재
 * 기존 스위트 어디에도 그 전용 검사가 없다(1부 조사 결과) — 이 규칙 B는
 * "supabase 클라이언트 import / fetch 호출 / process.env 접근" 세 가지만
 * 검사하고, 그 규준 파일 import 금지는 이번 작업 범위 밖이라 추가하지
 * 않는다.
 */
describe('src/engine/ 정적 검사 — 규칙 B: 외부 상태 접근 금지 (재귀 수집)', () => {
  const engineDir = path.join(__dirname, '../../src/engine')
  const files = collectEngineFilesRecursive(engineDir)

  const RULE_B_PATTERNS: readonly RegExp[] = [
    /from\s+['"][^'"]*supabase[^'"]*['"]/i,
    /require\(\s*['"][^'"]*supabase[^'"]*['"]\s*\)/i,
    /\bfetch\s*\(/,
    /process\.env/,
  ]

  it('재귀 수집으로 최소 한 개 이상의 .ts 파일을 스캔했다', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const rel = path.relative(engineDir, file)
    for (const pattern of RULE_B_PATTERNS) {
      it(`${rel}에 ${pattern} 패턴이 없다 (실행 코드, 주석 제외)`, () => {
        const source = stripComments(fs.readFileSync(file, 'utf8'))
        expect(source).not.toMatch(pattern)
      })
    }
  }

  it('패턴 자체는 실제로 위반 코드를 잡아낸다 (자체 검증)', () => {
    const contaminated = `
      import { createClient } from '@supabase/supabase-js'
      const supabase = require('./supabaseClient')
      fetch('https://example.com')
      const key = process.env.SECRET
    `
    for (const pattern of RULE_B_PATTERNS) {
      expect(contaminated).toMatch(pattern)
    }
  })
})
