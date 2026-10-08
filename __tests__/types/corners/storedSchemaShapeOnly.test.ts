import * as fs from 'fs'
import * as path from 'path'
import { stripComments } from '../../../scripts/lib/stripComments'

/**
 * 저장 스키마는 모양만 본다 - 계산이 없다 (docs/ONDOLOG_MASTER.md §17-0-8, r46).
 * 위임: .claude/state/prompts/phase-7/40-corner-pipeline-followups.md 범위 1.
 *
 * 저장 스키마(`src/types/corners/`)는 앱도 읽을 때 쓴다. 거기에 계산이 있으면 앱이 읽을 때마다 다시 계산하는데,
 * 앱에는 입력 레코드가 없으니 계산이 깨지거나 다른 값을 낸다. 계산은 서버에서 한 번 하고 결과를 저장한다.
 * 파생값은 골격의 별도 단계(`derive`)가 만든다.
 *
 * 검사는 소스 문자열이다(주석 제외). Zod가 값을 **바꾸거나 채우는** 호출을 찾는다. `refine`·`superRefine`은
 * 값을 바꾸지 않는 모양 검사라 허용한다. 코너 코드(`supabase/functions/_shared/corners/`)에서도 `transform`·`pipe`를
 * 찾는다 - 저장 스키마의 계산이 코너 쪽 스키마로 옮겨 앉는 우회를 막는다.
 */

const REPO_ROOT = path.join(__dirname, '..', '..', '..')
const STORED_DIR = 'src/types/corners'
const CORNERS_DIR = 'supabase/functions/_shared/corners'

/** 값을 바꾸거나 채우는 Zod 호출. 파생값은 이런 자리가 아니라 `derive`에서 만든다. */
const COMPUTING_PATTERNS: readonly RegExp[] = [
  /\.transform\s*\(/,
  /\.pipe\s*\(/,
  /\.preprocess\s*\(/,
  /\bpreprocess\s*\(/,
  /\.default\s*\(/,
  /\.prefault\s*\(/,
  /\.catch\s*\(/,
  /\.overwrite\s*\(/,
  /\bcodec\s*\(/,
  /\bz\.coerce\b/,
]

/** 코너 코드에서는 변환·연결만 찾는다(코너 쪽 LLM 출력 스키마에는 기본값 따위가 정당할 수 있다). */
const CORNER_PATTERNS: readonly RegExp[] = [/\.transform\s*\(/, /\.pipe\s*\(/]

function violations(relPath: string, source: string, patterns: readonly RegExp[]): string[] {
  const code = stripComments(source)
  return patterns.filter((p) => p.test(code)).map((p) => `${relPath}: 저장 스키마에 계산이 있다(${p}) - 파생값은 derive 단계에서 만든다(17-0-8)`)
}

function tsFiles(relDir: string): string[] {
  const dir = path.join(REPO_ROOT, relDir)
  const out: string[] = []
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        out.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'))
      }
    }
  }
  walk(dir)
  return out
}

describe('저장 스키마 계산 금지 - 합성 입력 (위반)', () => {
  it.each([
    ['transform', "const S = z.object({ a: z.number() }).transform((v) => ({ ...v, b: 1 }))"],
    ['pipe', 'const S = A.pipe(B)'],
    ['preprocess', 'const S = z.preprocess((v) => v, z.string())'],
    ['default', 'const S = z.string().default("x")'],
    ['prefault', 'const S = z.string().prefault("x")'],
    ['catch', 'const S = z.string().catch("x")'],
    ['overwrite', 'const S = z.string().overwrite((s) => s.trim())'],
    ['codec', 'const S = z.codec(A, B, { decode: (a) => a, encode: (b) => b })'],
    ['coerce', 'const S = z.coerce.number()'],
  ])('%s 는 위반이다', (_name, source) => {
    expect(violations('src/types/corners/synthetic.ts', source, COMPUTING_PATTERNS).length).toBeGreaterThan(0)
  })
})

describe('저장 스키마 계산 금지 - 합성 입력 (정상)', () => {
  it('모양만 보는 스키마는 통과한다 - refine·superRefine·min·max·enum', () => {
    const source = `
      const S = z.object({ a: z.number().int().min(0), b: z.enum(['x', 'y']) })
        .refine((v) => v.a > 0, { message: 'm' })
        .superRefine((v, ctx) => { if (v.a === 3) ctx.addIssue({ code: 'custom', message: 'm' }) })
    `
    expect(violations('src/types/corners/synthetic.ts', source, COMPUTING_PATTERNS)).toEqual([])
  })

  it('주석 안의 말은 위반이 아니다', () => {
    const source = '// transform으로 계산하지 않는다\n/* .pipe( 도 쓰지 않는다 */\nconst S = z.string()'
    expect(violations('src/types/corners/synthetic.ts', source, COMPUTING_PATTERNS)).toEqual([])
  })
})

describe('저장 스키마 계산 금지 - 저장소 실제 파일', () => {
  it('src/types/corners/ 의 저장 스키마에 계산이 없다', () => {
    const files = tsFiles(STORED_DIR)
    expect(files.length).toBeGreaterThan(0)
    const found = files.flatMap((f) => violations(f, fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), COMPUTING_PATTERNS))
    expect(found).toEqual([])
  })

  it('코너 코드(supabase/functions/_shared/corners/)에도 transform·pipe가 없다 - 계산이 코너 쪽 스키마로 옮겨 앉지 않는다', () => {
    const files = tsFiles(CORNERS_DIR)
    expect(files.length).toBeGreaterThan(0)
    const found = files.flatMap((f) => violations(f, fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), CORNER_PATTERNS))
    expect(found).toEqual([])
  })
})
