import * as fs from 'fs'
import * as path from 'path'
import { stripComments } from '../../scripts/lib/stripComments'

/**
 * 정적 규칙 G — 코너 코드의 전송 무관성 (docs/ONDOLOG_MASTER.md §17-0-3 규칙 G, r38).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md (범위 1 "코너 코드는 전송 방식을 모른다").
 *
 * `supabase/functions/_shared/corners/` 아래 실행 코드에 `async`·`await`·`fetch`·`Promise`가 없다. 17-0-5-F(코너 코드는
 * 전송 방식을 모른다)의 집행 장치다 - 코너가 "부르고 기다리는" 코드를 품으면 배치 전환 때 코너 셋을 전부 다시 짜야 한다.
 *
 * 기존 정적 규칙 스위트(`cornerPipelineStaticRules.test.ts`)는 C·D·E를 판정하며 이 파일은 그것을 건드리지 않는다.
 * 규칙 로직은 같은 형태의 순수 함수 `(파일경로, 소스문자열) => 위반목록`이고, 소스를 문자열로 읽는다(import하지 않는다 -
 * Deno 쪽 코드는 tsconfig와 무관하게 검사되어야 한다, 17-0-3-A).
 *
 * ── 이 규칙에 더한 인접 검사 (MASTER 규칙 표에는 없다) ────────────────────
 * 같은 취지(코너는 전송 방식·전송 형식을 모른다)로 두 가지를 더 건다. 원본 규칙 G의 문구가 아니라 `#14` 1부 설계(B-2)의
 * 제안이다 - 규칙 번호를 올릴지는 마스터 PM이 정한다.
 *   - `cache_control` 문자열 금지: 캐시 표시를 전송 형식으로 옮기는 것은 `llmClient.ts` 한 곳뿐이다(코너는 `cacheBreakpoint`로 표시만).
 *   - `llmClient` 모듈 import 금지: 코너는 클라이언트를 모른다.
 */

const REPO_ROOT = path.join(__dirname, '..', '..')
const CORNERS_DIR = 'supabase/functions/_shared/corners'

/** 규칙 G가 찾는 식별자 - 단어 경계로 센다. */
const TRANSPORT_PATTERNS: readonly RegExp[] = [/\basync\b/, /\bawait\b/, /\bfetch\b/, /\bPromise\b/]

/** 인접 검사 - 전송 형식·클라이언트를 아는 흔적. */
const ADJACENT_PATTERNS: readonly RegExp[] = [/cache_control/, /from\s+['"][^'"]*llmClient[^'"]*['"]/]

function isCornerCodeFile(relFilePath: string): boolean {
  return relFilePath.startsWith(`${CORNERS_DIR}/`) && relFilePath.endsWith('.ts') && !relFilePath.endsWith('.test.ts')
}

/** 규칙 G: 코너 디렉터리의 실행 코드(주석 제외)에 부르고 기다리는 코드가 없다. */
function ruleG_transportViolations(relFilePath: string, source: string): string[] {
  if (!isCornerCodeFile(relFilePath)) return []
  const code = stripComments(source)
  return TRANSPORT_PATTERNS.filter((p) => p.test(code)).map(
    (p) => `${relFilePath}: 코너 코드에 전송·대기 코드(${p})가 있다 - 코너는 전송 방식을 모른다(규칙 G)`,
  )
}

function adjacent_transportFormatViolations(relFilePath: string, source: string): string[] {
  if (!isCornerCodeFile(relFilePath)) return []
  const code = stripComments(source)
  return ADJACENT_PATTERNS.filter((p) => p.test(code)).map(
    (p) => `${relFilePath}: 코너 코드가 전송 형식·클라이언트를 안다(${p})`,
  )
}

function collectCornerFiles(): string[] {
  const dir = path.join(REPO_ROOT, CORNERS_DIR)
  const out: string[] = []
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.ts')) {
        out.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'))
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir)
  return out
}

describe('규칙 G - 합성 입력 (위반)', () => {
  const file = `${CORNERS_DIR}/synthetic.ts`

  it('async 함수는 위반이다', () => {
    expect(ruleG_transportViolations(file, 'export async function f() { return 1 }').length).toBe(1)
  })

  it('await는 위반이다', () => {
    expect(ruleG_transportViolations(file, 'const x = await y').length).toBe(1)
  })

  it('fetch 호출은 위반이다', () => {
    expect(ruleG_transportViolations(file, "const r = fetch('https://example.com')").length).toBe(1)
  })

  it('Promise는 위반이다', () => {
    expect(ruleG_transportViolations(file, 'const p: Promise<number> = g()').length).toBe(1)
    expect(ruleG_transportViolations(file, 'new Promise((r) => r(1))').length).toBe(1)
  })

  it('하위 디렉터리의 코너 코드도 같다', () => {
    expect(ruleG_transportViolations(`${CORNERS_DIR}/sub/deep.ts`, 'await x').length).toBe(1)
  })

  it('여러 개가 섞이면 종류마다 하나씩 센다', () => {
    expect(ruleG_transportViolations(file, 'async function f() { await fetch(u) }').length).toBe(3)
  })
})

describe('규칙 G - 합성 입력 (정상)', () => {
  const file = `${CORNERS_DIR}/synthetic.ts`

  it('동기 순수 함수는 위반이 아니다', () => {
    expect(ruleG_transportViolations(file, 'export function build(input: string) { return input.trim() }')).toEqual([])
  })

  it('주석 안의 단어는 위반이 아니다(줄·블록)', () => {
    expect(ruleG_transportViolations(file, '// await fetch Promise async\nconst a = 1')).toEqual([])
    expect(ruleG_transportViolations(file, '/* async await fetch Promise */\nconst a = 1')).toEqual([])
  })

  it('다른 식별자의 일부는 위반이 아니다(단어 경계)', () => {
    expect(ruleG_transportViolations(file, 'const asyncMode = 1; const prefetchHint = 2; const awaiting = 3')).toEqual([])
  })

  it('코너 디렉터리 밖은 대상이 아니다 - 골격은 async를 쓴다', () => {
    expect(ruleG_transportViolations('supabase/functions/_shared/cornerPipeline.ts', 'export async function run() { await x }')).toEqual([])
    expect(ruleG_transportViolations('supabase/functions/_shared/llmClient.ts', 'await fetch(u)')).toEqual([])
  })

  it('테스트 파일은 대상이 아니다 - 코너 테스트가 골격을 await로 부른다', () => {
    expect(ruleG_transportViolations(`${CORNERS_DIR}/sweetWords.test.ts`, 'await run()')).toEqual([])
  })
})

describe('인접 검사 - 전송 형식·클라이언트를 모른다 (합성 입력)', () => {
  const file = `${CORNERS_DIR}/synthetic.ts`

  it('cache_control 문자열은 위반이다', () => {
    expect(adjacent_transportFormatViolations(file, "const c = { cache_control: { type: 'x' } }").length).toBe(1)
  })

  it('llmClient 모듈 import는 위반이다', () => {
    expect(adjacent_transportFormatViolations(file, "import { createLlmClient } from '../llmClient.ts'").length).toBe(1)
  })

  it('cacheBreakpoint 표시와 llmRequest 타입 import는 정상이다', () => {
    expect(
      adjacent_transportFormatViolations(file, "import type { LlmRequest } from '../llmRequest.ts'\nconst b = { text: 't', cacheBreakpoint: true }"),
    ).toEqual([])
  })
})

describe('실제 저장소 - 코너 디렉터리가 규칙 G를 지킨다', () => {
  const files = collectCornerFiles()

  it('수집이 비어 있지 않다 - 코너 3종과 공통 파일이 있다(빈 수집으로 통과하지 않는다)', () => {
    const names = files.map((f) => path.posix.basename(f))
    for (const expected of ['dateArchive.ts', 'sweetWords.ts', 'thisMonth.ts', 'cornerCommon.ts']) {
      expect(names).toContain(expected)
    }
  })

  it('실행 코드에 async·await·fetch·Promise가 없다', () => {
    const violations = files.flatMap((rel) =>
      ruleG_transportViolations(rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')),
    )
    expect(violations).toEqual([])
  })

  it('전송 형식(cache_control)·llmClient import가 없다', () => {
    const violations = files.flatMap((rel) =>
      adjacent_transportFormatViolations(rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')),
    )
    expect(violations).toEqual([])
  })
})
