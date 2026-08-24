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
