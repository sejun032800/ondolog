import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as BrandedTypes from '../../src/engine/corners/brandedTypes'
import type { ValidatedContent, CoeffBundle } from '../../src/engine/corners/brandedTypes'
import { stripComments } from '../../scripts/lib/stripComments'

/**
 * 코너 생성 파이프라인 정적 규칙 C·D·E — 새 스위트.
 *
 * 위임: .claude/state/prompts/phase-7/19-engine-dev-guardrails.md
 * 근거: docs/ONDOLOG_MASTER.md Part 17-0-3, 17-0-3-A.
 *
 * ── 기존 스위트에 얹지 않는 이유 ─────────────────────────────────────
 * `determinismStaticRules.test.ts`·`importBoundary.test.ts`는
 * `src/engine/`(재귀 또는 비재귀)을 수집한다. 이 스위트는
 * `supabase/functions/`·`src/services/`·`src/engine/corners/`를
 * 수집한다 — 수집 대상 자체가 다르므로 별도 스위트다(17-0-3).
 * 기존 두 스위트의 수집 범위·판정 로직은 이 파일에서 건드리지 않는다.
 *
 * ── `stripComments`를 공용 모듈에서 가져오는 이유 ────────────────────
 * 기존 스위트 4개가 각자 `stripComments`를 파일 로컬로 복제해 두고
 * 있었다(조사 결과, 1부 참조). 당시 위임은 "복제된 유틸을 공용
 * 모듈로 추출·통합하지 않는다"고 했다 — 검증 도구는 중복이 결합보다
 * 안전하다는 판단이었고, 고칠 일이 생기면 그때가 통합 시점이라는
 * 단서를 달았다. 지금 통합한 것은 그 판단이 바뀌어서가 아니라 단서가
 * 충족돼서다 — URL의 `://`를 줄 주석으로 오인해 뒤 코드가 지워지는
 * 미탐이 그 고칠 일이었고, 복제본마다 따로 고치면 하나만 고쳐지고
 * 나머지는 미탐이 남는다. 그래서 `scripts/lib/stripComments.ts`로
 * 합쳤다.
 *
 * ── 규칙 로직을 순수 함수로 분리한 이유 ──────────────────────────────
 * 기존 스위트들은 `expect(source).not.toMatch(pattern)`을 테스트
 * 본문에 인라인으로 둔다(조사 결과, 1부 참조). 이 작업 지시(4부)는
 * "각 규칙을 (파일경로, 소스문자열) => 위반목록 형태의 순수 함수로
 * 만든다"를 명시적으로 요구해, 이 스위트는 그 형태를 따른다 —
 * `ruleC*`/`ruleD*`/`ruleE*` 세 함수가 그것이고, 디렉터리 순회
 * (`scanDirectories`)는 그 함수를 호출하는 얇은 층이다.
 *
 * ── 검사 방식: 소스 문자열 읽기 (import 아님) ────────────────────────
 * `supabase/functions/`는 Deno 런타임이고 `tsconfig.json`의 컴파일
 * 대상 포함 여부와 무관하게 동작해야 한다(17-0-3-A). 그래서 파일을
 * import하지 않고 `fs.readFileSync`로 문자열만 읽어 정규식으로 검사한다.
 */

// ─────────────────────────────────────────────────────────────────────────
// 이번 작업이 확정하는 모듈 경로 (저장소 루트 기준, POSIX 슬래시)
// ─────────────────────────────────────────────────────────────────────────

/**
 * 규칙 E — 브랜드 값 승인 생성 모듈 목록 (r25 전면 개정).
 *
 * r18 시점에는 예외가 "브랜드 정의 모듈"(`brandedTypes.ts`) 단일 경로
 * 였다 — 생성 함수(`validateCornerContent`·`buildCoeffBundle`)가 그
 * 모듈 안의 공개 export였기 때문이다. 하지만 공개 export는 그
 * 모듈 밖 아무 코드나 `coeffLookup.ts`를 거치지 않고 리터럴 객체로
 * `buildCoeffBundle(...)`을 직접 호출해 유효한 `CoeffBundle`을 만들 수
 * 있게 했다(docs/ONDOLOG_MASTER.md Part 17-0-2 r25). 그래서 r25는
 * 생성자 자체를 "그 값을 만들 자격이 있는 모듈" 안으로 옮기라고
 * 요구했고, 예외도 그 두 모듈로 바뀐다 — 이제 `brandedTypes.ts`는 이
 * 목록에 **없다**(타입 선언만 남아 캐스트가 없으므로 예외가 필요 없다).
 *
 * 이 배열이 정적 규칙 E의 원본이다(r21 "정적 규칙의 상수가 원본").
 *
 * r40: 승인 모듈 안이라도 **캐스트를 품은 함수가 `export`되면 걸린다**(아래
 * `findBrandCastDeclarations`). 승인은 "캐스트가 거기 있어도 된다"이지 "그
 * 캐스트를 품은 함수를 모듈 밖에 공개해도 된다"가 아니다 — r25는 이 구분을 쓰지
 * 않았고, 생성자가 `export`된 채로 위치만 옮겨 구멍이 그대로 열려 있었다.
 */
const APPROVED_BRAND_CONSTRUCTOR_MODULES: readonly string[] = [
  // ValidatedContent<T> — Zod 파싱 + FORBIDDEN_KEYS 검사를 실제로 거치는 자리.
  'supabase/functions/_shared/cornerPipeline.ts',
  // CoeffBundle — app_config를 실제로 읽는 자리 (규칙 D 지정 모듈과 동일).
  'supabase/functions/_shared/coeffLookup.ts',
]

/**
 * 규칙 C — LLM 호출(fetch/LLM SDK)이 허용되는 유일한 모듈 경로.
 * `#13`은 이 경로에 실제 파일을 만들어야 한다 — 다른 경로에 만들면
 * 규칙 C에 걸린다. Edge Function 실행 주체(17-0-0)에 따라
 * `supabase/functions/` 아래에 둔다. 여러 코너 생성 함수가 공유해
 * 쓰도록 `_shared/`(Supabase Edge Function 관례 — 여러 함수 배포판이
 * 공통 코드를 상대 경로로 가져다 쓰는 디렉터리) 아래에 둔다.
 */
const LLM_CALL_MODULE = 'supabase/functions/_shared/llmClient.ts'

/**
 * 규칙 D — `app_config` 조회가 허용되는 유일한 모듈 경로. 위와 같은
 * 이유로 `supabase/functions/_shared/` 아래에 둔다.
 */
const APP_CONFIG_LOOKUP_MODULE = 'supabase/functions/_shared/coeffLookup.ts'

// ─────────────────────────────────────────────────────────────────────────
// 공용 유틸 (`scripts/lib/stripComments.ts`에서 가져와 쓴다 — 기존 스위트와 같은 모듈)
// ─────────────────────────────────────────────────────────────────────────

/** `stripComments`는 `scripts/lib/stripComments.ts`에 있다. */
/**
 * `supabase/functions/`·`src/services/`·`src/engine/corners/` 재귀 수집.
 * `.ts`만 수집, `.test.ts` 제외. 디렉터리가 없으면 빈 배열을 반환한다
 * (throw하지 않는다) — 세 디렉터리 중 어느 것이 비어 있거나 아직 없어도
 * 스위트가 깨지지 않아야 한다는 요건 때문이다.
 */
function collectFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let results: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(collectFilesRecursive(fullPath))
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

function toRepoRelativePosix(repoRoot: string, absFilePath: string): string {
  return path.relative(repoRoot, absFilePath).split(path.sep).join('/')
}

// ─────────────────────────────────────────────────────────────────────────
// 규칙 로직 — 순수 함수: (파일경로, 소스문자열) => 위반목록
// ─────────────────────────────────────────────────────────────────────────

/**
 * 규칙 C 판정 기준 (r19 교정, `#13`이 실제로 적용). 둘로 좁힌다 —
 * `fetch` 전반은 잡지 않는다(`fetch`는 앱의 정상 동작이고
 * `src/services/referencePhotoApi.ts`가 참조 사진 업로드에 이미 쓰고
 * 있다. 전반을 잡으면 정당한 네트워크 계층이 매번 걸려 오탐이
 * 반복된다). 대신:
 *
 *   1. LLM SDK 모듈 import — `@anthropic-ai/sdk`·`openai` import,
 *      `new Anthropic(`·`new OpenAI(` 생성자.
 *   2. LLM 엔드포인트 호스트 문자열 — `llmClient.ts`가 실제로 쓰는
 *      호스트(`api.anthropic.com`). SDK 없이 `fetch`로 직접 호출하는
 *      우회를 막는다. 방어적으로 `api.openai.com`도 함께 판정한다
 *      (SDK 패턴이 이미 OpenAI도 다루고 있어 대칭을 맞춘 것 — 이
 *      프로젝트의 확정 프로바이더는 Anthropic이다, Part 6-7).
 */
const LLM_CALL_PATTERNS: readonly RegExp[] = [
  /from\s+['"]@anthropic-ai\/sdk['"]/,
  /from\s+['"]openai['"]/,
  /new\s+Anthropic\s*\(/,
  /new\s+OpenAI\s*\(/,
  /api\.anthropic\.com/,
  /api\.openai\.com/,
]

/**
 * 규칙 C — LLM 호출 경계. `LLM_CALL_MODULE` 밖에서 LLM SDK import 또는
 * LLM 엔드포인트 호스트 문자열이 나타나면 위반이다. 지정 모듈 자신은
 * 예외(그 안에서의 호출이 정상 동작이다 — "금지가 아니라 위치 제약").
 *
 * 문서에 없는 값을 지어내지 않기 위한 명시적 한계: 이 함수가 잡는
 * "LLM 호출"은 위 SDK import/생성자 패턴과 두 호스트 문자열뿐이다.
 * `#13`이 다른 방식(예: 알려지지 않은 SDK, 다른 프로바이더 호스트)으로
 * LLM을 호출하면 이 규칙이 놓칠 수 있다 — 그 경우는 이 작업 범위 밖이라
 * 확장하지 않는다. **`fetch(` 자체는 더 이상 판정 기준이 아니다** —
 * 엔진의 네트워크 금지는 규칙 B가 담당하고, 규칙 C는 "LLM 호출 경로가
 * 하나뿐인가"만 본다.
 */
function ruleC_llmCallBoundaryViolations(relFilePath: string, rawSource: string): string[] {
  if (relFilePath === LLM_CALL_MODULE) return []
  const source = stripComments(rawSource)
  const violations: string[] = []
  for (const pattern of LLM_CALL_PATTERNS) {
    if (pattern.test(source)) {
      violations.push(
        `${relFilePath}: LLM 호출 패턴(${pattern})이 지정 모듈(${LLM_CALL_MODULE}) 밖에서 발견됨`,
      )
    }
  }
  return violations
}

const APP_CONFIG_ACCESS_PATTERNS: readonly RegExp[] = [
  /\.from\(\s*['"]app_config['"]\s*\)/,
]

/**
 * 규칙 D — 계수 조회 경계. `APP_CONFIG_LOOKUP_MODULE` 밖에서
 * `app_config` 테이블 접근 패턴(`.from('app_config')`)이 나타나면
 * 위반이다. 지정 모듈 자신은 예외.
 *
 * 명시적 한계: 이 함수는 Supabase 클라이언트의 `.from('app_config')`
 * 호출 형태만 판정한다. 원시 SQL 문자열 등 다른 접근 경로는 이
 * 작업 범위 밖이라 다루지 않는다(규칙 D 재정의 r16 — 리터럴 계수
 * 값 자체를 잡지 않고 "조회가 여러 곳에서 일어나는 것"만 위치로 판정).
 */
function ruleD_appConfigLookupBoundaryViolations(relFilePath: string, rawSource: string): string[] {
  if (relFilePath === APP_CONFIG_LOOKUP_MODULE) return []
  const source = stripComments(rawSource)
  const violations: string[] = []
  for (const pattern of APP_CONFIG_ACCESS_PATTERNS) {
    if (pattern.test(source)) {
      violations.push(
        `${relFilePath}: app_config 접근 패턴(${pattern})이 지정 모듈(${APP_CONFIG_LOOKUP_MODULE}) 밖에서 발견됨`,
      )
    }
  }
  return violations
}

const BRAND_CAST_PATTERNS: readonly RegExp[] = [
  /\bas\s+ValidatedContent\b/,
  /\bas\s+CoeffBundle\b/,
]

const BRAND_TYPE_NAMES: readonly string[] = ['ValidatedContent', 'CoeffBundle']

/** `as T`·`<T>x`의 T가 브랜드 타입 이름인가(`ns.CoeffBundle` 같은 한정 이름도 마지막 식별자로 본다). */
function isBrandTypeNode(typeNode: ts.TypeNode): boolean {
  if (!ts.isTypeReferenceNode(typeNode)) return false
  const name = typeNode.typeName
  const identifier = ts.isIdentifier(name) ? name.text : name.right.text
  return BRAND_TYPE_NAMES.includes(identifier)
}

/** 노드 안(중첩 함수 포함)에 브랜드 캐스트가 하나라도 있는가. */
function containsBrandCast(root: ts.Node): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && isBrandTypeNode(node.type)) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/**
 * 브랜드 캐스트를 품은 모듈 최상위 선언(함수 선언·`const` 화살표/함수 표현식·그 밖의
 * 변수 초기화식·클래스)과 그 선언이 모듈 밖에 공개되는지를 돌려준다 (r40).
 *
 * **TypeScript 컴파일러 API로 판정한다.** 문자열 검색은 `export` 키워드의 위치,
 * 화살표 함수, `export { f }` 재-export, 주석·문자열 속 `export`를 정확히 가리지
 * 못한다. 공개로 보는 경우:
 *   - 선언 자체에 `export` 수식어 (`export function f`, `export const f = () => ...`)
 *   - 비공개 선언을 `export { f }` / `export { f as g }`로 내보냄 (`from` 없는 형태만)
 *   - `export default f` / `export default <캐스트를 품은 식>`
 * `export { f } from './x'`는 이 모듈의 선언이 아니므로 대상이 아니다.
 */
function findBrandCastDeclarations(rawSource: string): Array<{ name: string; exported: boolean }> {
  const sourceFile = ts.createSourceFile('module.ts', rawSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const declarations = new Map<string, boolean>() // 로컬 이름 → 공개 여부

  for (const statement of sourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && containsBrandCast(statement)) {
      const name = statement.name?.text ?? 'default'
      declarations.set(name, hasExportModifier(statement))
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer && ts.isIdentifier(declaration.name) && containsBrandCast(declaration.initializer)) {
          declarations.set(declaration.name.text, hasExportModifier(statement))
        }
      }
    }
  }

  // 선언 뒤에 오는 `export { ... }`·`export default ...`를 반영한다(선언을 전부 모은 뒤에 본다).
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        const localName = (element.propertyName ?? element.name).text
        if (declarations.has(localName)) declarations.set(localName, true)
      }
    } else if (ts.isExportAssignment(statement)) {
      if (ts.isIdentifier(statement.expression) && declarations.has(statement.expression.text)) {
        declarations.set(statement.expression.text, true)
      } else if (containsBrandCast(statement.expression)) {
        declarations.set('default', true)
      }
    }
  }

  return Array.from(declarations, ([name, exported]) => ({ name, exported }))
}

/**
 * 규칙 E — 브랜드 캐스트 금지, 단 승인된 생성 모듈 목록 안은 예외(r25).
 * `as ValidatedContent`·`as CoeffBundle` 캐스트가
 * `APPROVED_BRAND_CONSTRUCTOR_MODULES` 목록 밖에서 나타나면 위반이다.
 * 목록 안의 캐스트는 각 브랜드 값을 만드는 유일한 합법적 경로이므로
 * 예외로 둔다 — 예외가 없으면 생성자가 브랜드 값을 만들 수단이 아예
 * 없어진다.
 *
 * **r40 확장 — 공개 여부.** 승인 모듈 안에서도 캐스트를 품은 함수가 `export`되어
 * 있으면 위반이다. 위치 검사(목록 밖 캐스트 금지)는 그대로이고, 공개 여부는
 * `findBrandCastDeclarations`가 컴파일러 API로 판정한다.
 */
function ruleE_brandCastViolations(relFilePath: string, rawSource: string): string[] {
  if (APPROVED_BRAND_CONSTRUCTOR_MODULES.includes(relFilePath)) {
    return findBrandCastDeclarations(rawSource)
      .filter((declaration) => declaration.exported)
      .map(
        (declaration) =>
          `${relFilePath}: 브랜드 캐스트를 품은 '${declaration.name}'이 승인 모듈 밖으로 export됨 — 생성자는 비공개여야 한다(r40)`,
      )
  }
  const source = stripComments(rawSource)
  const violations: string[] = []
  for (const pattern of BRAND_CAST_PATTERNS) {
    if (pattern.test(source)) {
      violations.push(
        `${relFilePath}: 브랜드 캐스트(${pattern})가 승인된 생성 모듈 목록(${APPROVED_BRAND_CONSTRUCTOR_MODULES.join(', ')}) 밖에서 발견됨`,
      )
    }
  }
  return violations
}

// ─────────────────────────────────────────────────────────────────────────
// 디렉터리 순회 — 순수 함수를 호출하는 얇은 층
// ─────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.join(__dirname, '../..')
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'supabase/functions'),
  path.join(REPO_ROOT, 'src/services'),
  path.join(REPO_ROOT, 'src/engine/corners'),
]

function scanRepository(
  ruleFn: (relFilePath: string, rawSource: string) => string[],
): string[] {
  let violations: string[] = []
  for (const root of SCAN_ROOTS) {
    for (const absFile of collectFilesRecursive(root)) {
      const rel = toRepoRelativePosix(REPO_ROOT, absFile)
      const source = fs.readFileSync(absFile, 'utf8')
      violations = violations.concat(ruleFn(rel, source))
    }
  }
  return violations
}

// ─────────────────────────────────────────────────────────────────────────
// 1. 수집 — 디렉터리가 없거나 비어 있어도 깨지지 않는다
// ─────────────────────────────────────────────────────────────────────────

describe('코너 파이프라인 정적 규칙 — 수집 (재귀, 없거나 비어 있어도 안전)', () => {
  it('supabase/functions/ 재귀 수집이 예외 없이 동작한다', () => {
    expect(() => collectFilesRecursive(path.join(REPO_ROOT, 'supabase/functions'))).not.toThrow()
  })

  it('src/services/ 재귀 수집이 예외 없이 동작한다', () => {
    expect(() => collectFilesRecursive(path.join(REPO_ROOT, 'src/services'))).not.toThrow()
  })

  it('src/engine/corners/ 재귀 수집이 예외 없이 동작한다', () => {
    expect(() => collectFilesRecursive(path.join(REPO_ROOT, 'src/engine/corners'))).not.toThrow()
  })

  it('존재하지 않는 디렉터리는 빈 배열을 반환한다 (throw 없음)', () => {
    const nonExistent = path.join(REPO_ROOT, 'this/path/does/not/exist')
    expect(collectFilesRecursive(nonExistent)).toEqual([])
  })

  it('세 디렉터리를 스캔해도 예외 없이 위반 배열(빈 배열 포함)을 반환한다 (규칙 C 기준)', () => {
    expect(() => scanRepository(ruleC_llmCallBoundaryViolations)).not.toThrow()
  })

  it('세 디렉터리를 스캔해도 예외 없이 위반 배열(빈 배열 포함)을 반환한다 (규칙 D 기준)', () => {
    expect(() => scanRepository(ruleD_appConfigLookupBoundaryViolations)).not.toThrow()
  })

  it('세 디렉터리를 스캔해도 예외 없이 위반 배열(빈 배열 포함)을 반환한다 (규칙 E 기준)', () => {
    expect(() => scanRepository(ruleE_brandCastViolations)).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 2. 규칙 C — 합성 입력 (위반 / 정상 / 주석전용)
// ─────────────────────────────────────────────────────────────────────────

describe('규칙 C — LLM 호출 경계 (합성 입력)', () => {
  const nonDesignatedPath = 'supabase/functions/generate-monthly-issue/index.ts'

  it('위반: 지정 모듈 밖에서 fetch() 호출 → 걸린다', () => {
    const violating = `
      export async function callLlm(prompt: string) {
        return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: prompt })
      }
    `
    const violations = ruleC_llmCallBoundaryViolations(nonDesignatedPath, violating)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('정상: LLM 호출이 없는 소스 → 안 걸린다', () => {
    const clean = `
      export function buildPrompt(entries: string[]): string {
        return entries.join('\\n')
      }
    `
    expect(ruleC_llmCallBoundaryViolations(nonDesignatedPath, clean)).toEqual([])
  })

  it('주석전용: fetch() 언급이 주석 안에만 있음 → 안 걸린다', () => {
    const commentOnly = `
      // 이 함수는 fetch(...)를 호출하지 않는다. LLM 호출은 _shared/llmClient.ts에서만 한다.
      /* new Anthropic()도 여기 없다 */
      export function noop(): void {}
    `
    expect(ruleC_llmCallBoundaryViolations(nonDesignatedPath, commentOnly)).toEqual([])
  })

  it('지정 모듈 자신은 fetch() 호출이 있어도 안 걸린다 (위치 제약이지 금지가 아니다)', () => {
    const designatedModuleSource = `
      export async function callLlm(prompt: string) {
        return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: prompt })
      }
    `
    expect(ruleC_llmCallBoundaryViolations(LLM_CALL_MODULE, designatedModuleSource)).toEqual([])
  })

  // ── r3 2부 보강: 규칙 C 판정 기준 교정(fetch 전반 → SDK import·엔드포인트 호스트)에 대한 합성 입력 ──

  it('위반(신규): SDK import가 지정 모듈 밖에 있음 → 걸린다 (fetch 없이 import만)', () => {
    const violating = `
      import Anthropic from '@anthropic-ai/sdk'
      export const client = new Anthropic({ apiKey: 'x' })
    `
    const violations = ruleC_llmCallBoundaryViolations(nonDesignatedPath, violating)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('위반(신규): LLM 엔드포인트 호스트 문자열이 지정 모듈 밖에 있음 → 걸린다 (SDK 없이 fetch 우회)', () => {
    const violating = `
      export async function shortcut(prompt: string) {
        return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: prompt })
      }
    `
    const violations = ruleC_llmCallBoundaryViolations(nonDesignatedPath, violating)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('정상(신규): fetch만 있고 LLM과 무관한 소스 → 안 걸린다 (r19 교정의 핵심 — fetch 전반을 잡지 않는다)', () => {
    const unrelatedFetch = `
      export async function uploadReferencePhoto(localUri: string) {
        const response = await fetch(localUri)
        return response.blob()
      }
    `
    expect(ruleC_llmCallBoundaryViolations(nonDesignatedPath, unrelatedFetch)).toEqual([])
  })

  it('실증: src/services/referencePhotoApi.ts 실제 파일이 규칙 C에 걸리지 않는다 (정당한 fetch 오탐 없음)', () => {
    const absPath = path.join(REPO_ROOT, 'src/services/referencePhotoApi.ts')
    const source = fs.readFileSync(absPath, 'utf8')
    expect(ruleC_llmCallBoundaryViolations('src/services/referencePhotoApi.ts', source)).toEqual([])
  })

  it('실증: llmClient.ts 자신이 규칙 C에 걸리지 않는다 (지정 모듈 자기 자신 예외의 실파일 버전)', () => {
    const absPath = path.join(REPO_ROOT, LLM_CALL_MODULE)
    const source = fs.readFileSync(absPath, 'utf8')
    expect(ruleC_llmCallBoundaryViolations(LLM_CALL_MODULE, source)).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 3. 규칙 D — 합성 입력 (위반 / 정상 / 주석전용)
// ─────────────────────────────────────────────────────────────────────────

describe('규칙 D — app_config 조회 경계 (합성 입력)', () => {
  const nonDesignatedPath = 'src/services/someCornerHelper.ts'

  it("위반: 지정 모듈 밖에서 .from('app_config') 호출 → 걸린다", () => {
    const violating = `
      export async function readCoefficients(client: SupabaseClient) {
        return client.from('app_config').select('*').eq('key', 'corner_llm_model')
      }
    `
    const violations = ruleD_appConfigLookupBoundaryViolations(nonDesignatedPath, violating)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('정상: app_config 접근이 없는 소스 → 안 걸린다', () => {
    const clean = `
      export function formatCornerTitle(month: string): string {
        return \`\${month} 코너\`
      }
    `
    expect(ruleD_appConfigLookupBoundaryViolations(nonDesignatedPath, clean)).toEqual([])
  })

  it("주석전용: .from('app_config') 언급이 주석 안에만 있음 → 안 걸린다", () => {
    const commentOnly = `
      // app_config 조회는 이 파일이 하지 않는다. client.from('app_config')는 예시일 뿐이다.
      export function noop(): void {}
    `
    expect(ruleD_appConfigLookupBoundaryViolations(nonDesignatedPath, commentOnly)).toEqual([])
  })

  it("지정 모듈 자신은 .from('app_config') 호출이 있어도 안 걸린다 (위치 제약이지 금지가 아니다)", () => {
    const designatedModuleSource = `
      export async function readCoefficients(client: SupabaseClient) {
        return client.from('app_config').select('*').eq('key', 'corner_llm_model')
      }
    `
    expect(
      ruleD_appConfigLookupBoundaryViolations(APP_CONFIG_LOOKUP_MODULE, designatedModuleSource),
    ).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 4. 규칙 E — 합성 입력 (위반 / 정상 / 주석전용 / 정의 모듈 예외)
// ─────────────────────────────────────────────────────────────────────────

describe('규칙 E — 브랜드 캐스트 금지, 승인된 생성 모듈 목록 예외 (합성 입력)', () => {
  const nonDefinitionPath = 'supabase/functions/generate-monthly-issue/index.ts'

  it('위반: 정의 모듈 밖에서 as ValidatedContent 캐스트 → 걸린다', () => {
    const violating = `
      export function shortcut(raw: unknown) {
        return raw as ValidatedContent<CornerContent>
      }
    `
    const violations = ruleE_brandCastViolations(nonDefinitionPath, violating)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('위반: 정의 모듈 밖에서 as CoeffBundle 캐스트 → 걸린다', () => {
    const violating = `
      export function shortcut(raw: unknown) {
        return raw as CoeffBundle
      }
    `
    const violations = ruleE_brandCastViolations(nonDefinitionPath, violating)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('정상: 브랜드 캐스트가 없는 소스 → 안 걸린다', () => {
    const clean = `
      export function saveCorner(content: ValidatedContent<CornerContent>) {
        return content
      }
    `
    expect(ruleE_brandCastViolations(nonDefinitionPath, clean)).toEqual([])
  })

  it('주석전용: as ValidatedContent 언급이 주석 안에만 있음 → 안 걸린다', () => {
    const commentOnly = `
      // 여기서는 'as ValidatedContent<T>'로 캐스트하지 않는다. 캐스트는 정의 모듈 안에서만.
      export function noop(): void {}
    `
    expect(ruleE_brandCastViolations(nonDefinitionPath, commentOnly)).toEqual([])
  })

  it('승인 모듈 예외: cornerPipeline.ts(ValidatedContent 승인 모듈) 안의 비공개 캐스트는 안 걸린다', () => {
    const withinApprovedModule = `
      function brandValidated(raw: unknown) {
        return raw as ValidatedContent<CornerContent>
      }
      export function validateCornerResponse(raw: unknown) {
        return brandValidated(raw)
      }
    `
    expect(
      ruleE_brandCastViolations('supabase/functions/_shared/cornerPipeline.ts', withinApprovedModule),
    ).toEqual([])
  })

  it('승인 모듈 예외: coeffLookup.ts(CoeffBundle 승인 모듈) 안의 비공개 캐스트는 안 걸린다', () => {
    const withinApprovedModule = `
      function buildCoeffBundle(raw: unknown) {
        return { ...raw, version: '1.0.0' } as CoeffBundle
      }
      export async function lookupCoeffBundle() {
        return buildCoeffBundle({})
      }
    `
    expect(
      ruleE_brandCastViolations('supabase/functions/_shared/coeffLookup.ts', withinApprovedModule),
    ).toEqual([])
  })

  it('승인 모듈 예외는 경로 일치에만 적용된다 — 같은 캐스트라도 다른 경로면 걸린다', () => {
    const sameContentDifferentPath = `
      export function validateCornerContent(raw: unknown) {
        return raw as ValidatedContent<CornerContent>
      }
    `
    expect(
      ruleE_brandCastViolations('src/engine/corners/otherFile.ts', sameContentDifferentPath).length,
    ).toBeGreaterThan(0)
  })

  it('r25: brandedTypes.ts는 이제 승인 목록 밖이다 — 그 경로의 캐스트도 걸린다', () => {
    const castInDefinitionModule = `
      export function shortcut(raw: unknown) {
        return raw as CoeffBundle
      }
    `
    expect(
      ruleE_brandCastViolations('src/engine/corners/brandedTypes.ts', castInDefinitionModule).length,
    ).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 4-A. 규칙 E 확장 (r40) — 승인 모듈 안에서 캐스트를 품은 함수가 export되면 걸린다.
//      판정은 TypeScript 컴파일러 API다. 합성 입력은 승인 모듈 경로를 쓴다.
// ─────────────────────────────────────────────────────────────────────────

describe('규칙 E 확장 (r40) — 승인 모듈 안의 생성자 공개 여부 (합성 입력, 컴파일러 API 판정)', () => {
  const approvedPath = 'supabase/functions/_shared/coeffLookup.ts'

  it('위반: 캐스트를 품은 함수 선언이 export되어 있다', () => {
    const exposed = `
      export function buildCoeffBundle(raw: Record<string, unknown>) {
        return raw as CoeffBundle
      }
    `
    const violations = ruleE_brandCastViolations(approvedPath, exposed)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('buildCoeffBundle')
  })

  it('정상: 같은 함수가 비공개다', () => {
    const hidden = `
      function buildCoeffBundle(raw: Record<string, unknown>) {
        return raw as CoeffBundle
      }
      export function lookupCoeffBundle() {
        return buildCoeffBundle({ version: '1' })
      }
    `
    expect(ruleE_brandCastViolations(approvedPath, hidden)).toEqual([])
  })

  it('위반: export const + 화살표 함수', () => {
    const exposed = `
      export const f = (x: unknown) => x as CoeffBundle
    `
    expect(ruleE_brandCastViolations(approvedPath, exposed)).toHaveLength(1)
  })

  it('위반: 비공개 함수를 export { f }로 내보냈다 (선언보다 export가 앞에 와도)', () => {
    const reExported = `
      export { f }
      function f(x: unknown) {
        return x as CoeffBundle
      }
    `
    expect(ruleE_brandCastViolations(approvedPath, reExported)).toHaveLength(1)
  })

  it('위반: 비공개 const 화살표 함수 + export { f }', () => {
    const reExported = `
      const f = (x: unknown) => x as ValidatedContent<unknown>
      export { f }
    `
    expect(ruleE_brandCastViolations(approvedPath, reExported)).toHaveLength(1)
  })

  it('위반: 이름을 바꿔 내보내도(export { f as g }) 걸린다', () => {
    const renamed = `
      function f(x: unknown) {
        return x as CoeffBundle
      }
      export { f as publicBuilder }
    `
    expect(ruleE_brandCastViolations(approvedPath, renamed)).toHaveLength(1)
  })

  it('위반: export default f', () => {
    const exposed = `
      function f(x: unknown) {
        return x as CoeffBundle
      }
      export default f
    `
    expect(ruleE_brandCastViolations(approvedPath, exposed)).toHaveLength(1)
  })

  it('위반: export된 함수 안의 중첩 함수에 캐스트가 있어도 그 함수가 캐스트를 품은 것이다', () => {
    const nested = `
      export function outer() {
        const inner = (x: unknown) => x as CoeffBundle
        return inner
      }
    `
    expect(ruleE_brandCastViolations(approvedPath, nested)).toHaveLength(1)
  })

  it('위반: 캐스트를 품은 값(함수 아님)을 export const로 내보내도 걸린다', () => {
    const value = `
      export const bundle = { version: '1' } as CoeffBundle
    `
    expect(ruleE_brandCastViolations(approvedPath, value)).toHaveLength(1)
  })

  it('정상: export된 함수가 캐스트를 품지 않으면 걸리지 않는다 (비공개 생성자를 부르기만 함)', () => {
    const callerOnly = `
      function hidden(x: unknown) {
        return x as CoeffBundle
      }
      export function publicPath(x: unknown) {
        return hidden(x)
      }
    `
    expect(ruleE_brandCastViolations(approvedPath, callerOnly)).toEqual([])
  })

  it('정상: 다른 모듈의 재-export(export { f } from ...)는 이 모듈의 선언이 아니다', () => {
    const foreign = `
      function hidden(x: unknown) {
        return x as CoeffBundle
      }
      export { hidden2 } from './other'
    `
    expect(ruleE_brandCastViolations(approvedPath, foreign)).toEqual([])
  })

  it('정상: 주석·문자열 안의 export 문구는 판정하지 않는다 (문자열 검색이 아니라 구문 분석)', () => {
    const textOnly = `
      // export function buildCoeffBundle(raw) { return raw as CoeffBundle }
      /* export const f = (x) => x as CoeffBundle */
      const note = 'export function f() { return x as CoeffBundle }'
      function hidden(x: unknown) {
        return x as CoeffBundle
      }
      export const label = note
    `
    expect(ruleE_brandCastViolations(approvedPath, textOnly)).toEqual([])
  })

  it('승인 모듈 밖에서는 공개 여부와 무관하게 캐스트 자체가 위반이다 (위치 검사 유지)', () => {
    const hiddenButOutside = `
      function f(x: unknown) {
        return x as CoeffBundle
      }
    `
    expect(ruleE_brandCastViolations('supabase/functions/_shared/other.ts', hiddenButOutside).length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 5. 브랜드 정의 모듈 자체가 현재 세 규칙을 위반하지 않는다 (실사용 확인)
// ─────────────────────────────────────────────────────────────────────────

describe('src/engine/corners/brandedTypes.ts — 실제 파일이 규칙 C·D·E를 위반하지 않는다', () => {
  const brandedTypesRelPath = 'src/engine/corners/brandedTypes.ts'
  const absPath = path.join(REPO_ROOT, brandedTypesRelPath)
  const source = fs.readFileSync(absPath, 'utf8')

  it('규칙 C 위반 없음 (LLM 호출 없음)', () => {
    expect(ruleC_llmCallBoundaryViolations(brandedTypesRelPath, source)).toEqual([])
  })

  it('규칙 D 위반 없음 (app_config 접근 없음)', () => {
    expect(ruleD_appConfigLookupBoundaryViolations(brandedTypesRelPath, source)).toEqual([])
  })

  it('규칙 E 위반 없음 — r25부터는 예외가 아니라 캐스트가 실제로 0건이기 때문이다', () => {
    // r18~r24까지는 이 파일이 규칙 E의 예외 대상(정의 모듈)이라 캐스트가
    // 있어도 위반 목록이 비었다. r25는 생성자를 승인 모듈(cornerPipeline.ts·
    // coeffLookup.ts)로 옮기면서 이 파일을 예외 목록에서 뺐다(위
    // APPROVED_BRAND_CONSTRUCTOR_MODULES 참조) — 그래서 이 테스트가
    // 여전히 빈 배열을 기대하는 근거가 바뀌었다: 이제는 "예외라서"가
    // 아니라 "이 파일에 `as ValidatedContent`·`as CoeffBundle` 캐스트가
    // 정말 하나도 없어서"다. 아래 두 번째 단언이 그 전제 자체를 직접
    // 검증한다 — 예외가 사라졌는데 캐스트가 실수로 남아 있으면 이
    // describe 블록의 첫 두 단언과 달리 이 자리에서 곧바로 드러난다.
    expect(ruleE_brandCastViolations(brandedTypesRelPath, source)).toEqual([])
    // 주석(문서화용 백틱 인용 포함)을 제거한 뒤에도 캐스트가 없어야
    // "진짜로 0건"이 증명된다 — 원문 그대로 검사하면 위 docblock 안의
    // `as ValidatedContent`/`as CoeffBundle` 문구(코드가 아니라 산문
    // 인용)에 오탐한다.
    const codeOnly = stripComments(source)
    expect(codeOnly).not.toMatch(/\bas\s+ValidatedContent\b/)
    expect(codeOnly).not.toMatch(/\bas\s+CoeffBundle\b/)
  })

  it('r25: brandedTypes.ts는 이제 승인된 생성 모듈 목록에 없다', () => {
    expect(APPROVED_BRAND_CONSTRUCTOR_MODULES).not.toContain(brandedTypesRelPath)
  })

  it('런타임 export가 없다 (r25 — 생성 함수 둘 다 승인 모듈로 이전됨)', () => {
    // r25 이전(#13)에는 `validateCornerContent`·`buildCoeffBundle` 두
    // 함수가 실제 런타임 값으로 export돼 있어 Babel이 synthetic default를
    // 합성하지 않았다. 이제 이 파일은 다시 `export type`만 남은
    // type-only 모듈이다 — #12 시점과 같은 상태로 되돌아갔으므로, Babel
    // CJS interop이 빈 `default`를 합성해 붙인다(그 원래 근거는 #12
    // 시점 조사, 이 파일의 이전 버전 주석 참조). 어떤 형태로든
    // `validateCornerContent`/`buildCoeffBundle`이라는 이름의 런타임
    // 값이 다시 나타나면 생성자가 이 파일로 되돌아왔다는 뜻이므로
    // 명시적으로 걸러낸다.
    expect(Object.keys(BrandedTypes)).not.toContain('validateCornerContent')
    expect(Object.keys(BrandedTypes)).not.toContain('buildCoeffBundle')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 6. `#13`이 만든 실제 파일 전부를 세 규칙으로 실사 — 완료 기준
//    "규칙 C·D·E가 #13 완료 후에도 전부 통과한다"의 직접 증거.
// ─────────────────────────────────────────────────────────────────────────

describe('#13이 만든 실제 파일 전체 — 세 규칙(C·D·E) 실사, 위반 0건', () => {
  it('세 디렉터리 전체를 규칙 C·D·E로 스캔하면 위반이 하나도 없다', () => {
    expect(scanRepository(ruleC_llmCallBoundaryViolations)).toEqual([])
    expect(scanRepository(ruleD_appConfigLookupBoundaryViolations)).toEqual([])
    expect(scanRepository(ruleE_brandCastViolations)).toEqual([])
  })

  it('coeffLookup.ts는 app_config 접근이 있어도(지정 모듈 자신) 규칙 D에 안 걸린다', () => {
    const absPath = path.join(REPO_ROOT, APP_CONFIG_LOOKUP_MODULE)
    const source = fs.readFileSync(absPath, 'utf8')
    expect(ruleD_appConfigLookupBoundaryViolations(APP_CONFIG_LOOKUP_MODULE, source)).toEqual([])
    // 실제로 app_config에 접근하고 있다는 것도 함께 확인 — "지정 모듈 자신은
    // 예외"라는 exemption이 아무 의미 없는 빈 파일을 봐준 게 아님을 보장.
    expect(source).toMatch(/\.from\(\s*['"]app_config['"]\s*\)/)
  })

  it('saveCornerResult.ts는 app_config·LLM 호출·브랜드 캐스트 중 어느 것도 직접 하지 않는다(전부 지정/승인 모듈에 위임)', () => {
    // saveCornerResult.ts는 r25 이후에도 ValidatedContent/CoeffBundle을
    // 타입으로만 소비한다 — 생성자 이전의 영향을 받지 않는 파일이다
    // (r25 조사 결과, HANDOFF.md 참조).
    const rel = 'supabase/functions/_shared/saveCornerResult.ts'
    const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
    expect(ruleC_llmCallBoundaryViolations(rel, source)).toEqual([])
    expect(ruleD_appConfigLookupBoundaryViolations(rel, source)).toEqual([])
    expect(ruleE_brandCastViolations(rel, source)).toEqual([])
  })

  it('cornerPipeline.ts는 app_config·LLM 호출을 직접 하지 않는다(둘 다 지정 모듈에 위임)', () => {
    // r25 이후 cornerPipeline.ts는 ValidatedContent의 승인된 생성
    // 모듈이 됐으므로 브랜드 캐스트(규칙 E)는 이 파일에서 더 이상
    // "안 한다"가 아니라 "이 파일이 승인 모듈이라 안 걸린다"로 바뀐다
    // — 그 확인은 바로 아래 테스트가 맡는다.
    const rel = 'supabase/functions/_shared/cornerPipeline.ts'
    const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
    expect(ruleC_llmCallBoundaryViolations(rel, source)).toEqual([])
    expect(ruleD_appConfigLookupBoundaryViolations(rel, source)).toEqual([])
  })

  it('r25: cornerPipeline.ts는 as ValidatedContent 캐스트를 실제로 담고 있어도(승인 모듈 자신) 규칙 E에 안 걸린다', () => {
    const rel = 'supabase/functions/_shared/cornerPipeline.ts'
    const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
    expect(ruleE_brandCastViolations(rel, source)).toEqual([])
    // "승인 모듈이라 안 걸린다"는 exemption이 캐스트 자체가 없는 파일을
    // 우연히 봐준 게 아님을 함께 보장 — coeffLookup.ts의 app_config 자기
    // 확인 테스트와 같은 패턴(위 참조).
    expect(source).toMatch(/\bas\s+ValidatedContent\b/)
  })

  it('r40: 승인 모듈 둘 다 캐스트를 품은 함수가 실제로 있고, 그 함수는 export되지 않는다', () => {
    const expectations: Array<[string, string]> = [
      ['supabase/functions/_shared/cornerPipeline.ts', 'brandValidated'],
      ['supabase/functions/_shared/coeffLookup.ts', 'buildCoeffBundle'],
    ]
    for (const [rel, castFunctionName] of expectations) {
      const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
      const declarations = findBrandCastDeclarations(source)
      // 판정 도구가 빈 결과로 통과하는 게 아니라 실제 캐스트 함수를 찾아내고 있음을 함께 보인다.
      expect(declarations).toEqual([{ name: castFunctionName, exported: false }])
      expect(ruleE_brandCastViolations(rel, source)).toEqual([])
    }
  })

  it('r25: coeffLookup.ts는 as CoeffBundle 캐스트를 실제로 담고 있어도(승인 모듈 자신) 규칙 E에 안 걸린다', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, APP_CONFIG_LOOKUP_MODULE), 'utf8')
    expect(ruleE_brandCastViolations(APP_CONFIG_LOOKUP_MODULE, source)).toEqual([])
    expect(source).toMatch(/\bas\s+CoeffBundle\b/)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 7. 우회 차단 증명 — 타입 층: 승인 모듈 밖에서 리터럴로 브랜드 값을
//    만들 수 없다 (r25 3부, `@ts-expect-error`로 작동 확인).
//
//    이 describe 블록은 정적 규칙(문자열 스캔)이 아니라 타입 층 자체를
//    증명한다 — `npx tsc --noEmit -p .`가 이 파일을 검사할 때, 아래
//    `@ts-expect-error` 다음 줄이 실제로 타입 에러를 내지 않으면
//    "사용되지 않은 @ts-expect-error 지시어"로 tsc 자신이 실패한다
//    (TypeScript 내장 동작). 즉 이 테스트가 통과한다는 것은 "존재 확인"이
//    아니라 "그 우회가 실제로 컴파일 에러를 낸다는 작동 확인"이다.
// ─────────────────────────────────────────────────────────────────────────

describe('우회 차단 증명 — 브랜드 값은 리터럴 객체로 만들 수 없다 (타입 층, @ts-expect-error)', () => {
  it('ValidatedContent<T>는 검증을 거치지 않은 리터럴 객체를 대입할 수 없다', () => {
    // @ts-expect-error ValidatedContent<T>는 __validated(unique symbol) 브랜드가 없는 리터럴을 거부한다 — cornerPipeline.ts의 validateCornerResponse만이 이 타입을 만들 수 있다.
    const fake: ValidatedContent<{ title: string }> = { title: '우회 시도' }
    // 컴파일이 막혔다는 사실 자체가 이 테스트의 목적이다. 런타임 값은
    // (JS는 타입 소거 언어라) 그대로 존재한다 — 확인만 한다.
    expect(fake.title).toBe('우회 시도')
  })

  it('CoeffBundle은 version 필드를 갖춘 리터럴 객체라도 대입할 수 없다', () => {
    // @ts-expect-error CoeffBundle은 __fromConfig(unique symbol) 브랜드가 없는 리터럴을 거부한다 — coeffLookup.ts의 lookupCoeffBundle(안의 비공개 생성자)만이 이 타입을 만들 수 있다.
    const fake: CoeffBundle = { version: '1.0.0' }
    expect(fake.version).toBe('1.0.0')
  })
})
