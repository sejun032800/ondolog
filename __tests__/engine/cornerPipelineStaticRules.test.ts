import * as fs from 'fs'
import * as path from 'path'
import * as BrandedTypes from '../../src/engine/corners/brandedTypes'

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
 * ── `stripComments`를 다시 로컬로 정의하는 이유 ──────────────────────
 * 기존 스위트 4개가 이미 각자 `stripComments`를 파일 로컬로 복제해
 * 두고 있다(조사 결과, 1부 참조). 위임 프롬프트가 "복제된 유틸을
 * 공용 모듈로 추출·통합하지 않는다"고 명시해 이 파일도 같은 패턴을
 * 따른다 — 기존 파일을 import하지 않고 독립적으로 정의한다.
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
 * 규칙 E — 브랜드 정의 모듈. `ValidatedContent`/`CoeffBundle`이 여기서만
 * 정의되고, 캐스트도 여기서만 허용된다(17-0-3-A).
 */
const BRAND_DEFINITION_MODULE = 'src/engine/corners/brandedTypes.ts'

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
// 공용 유틸 (이 파일 로컬 — 기존 스위트의 복제본과 통합하지 않는다)
// ─────────────────────────────────────────────────────────────────────────

/**
 * 이 복제본은 기존 3개 파일의 `stripComments`와 **줄 주석 처리 하나가
 * 다르다** — 발견된 버그를 고쳤다(다른 파일은 손대지 않는다, 위 안내
 * 그대로 "통합하지 않는다"만 지킨다 — 이건 통합이 아니라 이 파일
 * 로컬 복제본의 수정이다).
 *
 * 기존 정규식 `/\/\/.*$/gm`은 `//`로 시작하는 줄 전체를 지운다. 그런데
 * `'https://api.anthropic.com/...'` 같은 URL 리터럴 안의 `://`도
 * `//`를 포함해 **URL의 나머지 전체가 주석으로 오인돼 지워진다** —
 * 규칙 C의 두 번째 검사("LLM 엔드포인트 호스트 문자열")가 바로 그
 * 지워진 부분(`api.anthropic.com`)을 찾아야 하므로 이 버그를 그대로
 * 두면 검사가 상시로 무력화된다(합성 입력 테스트에서 실제로 재현됨).
 * `//` 바로 앞이 `:`이면(=URL 스킴 구분자) 줄 주석으로 보지 않도록
 * 부정 후방탐색(negative lookbehind)으로 좁혔다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '')
}

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

/**
 * 규칙 E — 브랜드 캐스트 금지, 단 브랜드 정의 모듈 안은 예외(r18).
 * `as ValidatedContent`·`as CoeffBundle` 캐스트가 `BRAND_DEFINITION_MODULE`
 * 밖에서 나타나면 위반이다. 정의 모듈 안의 캐스트는 브랜드 값을 만드는
 * 유일한 합법적 경로이므로 예외로 둔다 — 예외가 없으면 `#13`이 브랜드
 * 값을 만들 수단이 아예 없어진다.
 */
function ruleE_brandCastViolations(relFilePath: string, rawSource: string): string[] {
  if (relFilePath === BRAND_DEFINITION_MODULE) return []
  const source = stripComments(rawSource)
  const violations: string[] = []
  for (const pattern of BRAND_CAST_PATTERNS) {
    if (pattern.test(source)) {
      violations.push(
        `${relFilePath}: 브랜드 캐스트(${pattern})가 정의 모듈(${BRAND_DEFINITION_MODULE}) 밖에서 발견됨`,
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

describe('규칙 E — 브랜드 캐스트 금지, 정의 모듈 예외 (합성 입력)', () => {
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

  it('정의 모듈 예외: 정의 모듈 안의 as ValidatedContent 캐스트는 안 걸린다', () => {
    const withinDefinitionModule = `
      export function validateCornerContent(raw: unknown) {
        return raw as ValidatedContent<CornerContent>
      }
    `
    expect(ruleE_brandCastViolations(BRAND_DEFINITION_MODULE, withinDefinitionModule)).toEqual([])
  })

  it('정의 모듈 예외: 정의 모듈 안의 as CoeffBundle 캐스트도 안 걸린다', () => {
    const withinDefinitionModule = `
      export function buildCoeffBundle(raw: unknown) {
        return { ...raw, version: '1.0.0' } as CoeffBundle
      }
    `
    expect(ruleE_brandCastViolations(BRAND_DEFINITION_MODULE, withinDefinitionModule)).toEqual([])
  })

  it('정의 모듈 예외는 경로 일치에만 적용된다 — 같은 캐스트라도 다른 경로면 걸린다', () => {
    const sameContentDifferentPath = `
      export function validateCornerContent(raw: unknown) {
        return raw as ValidatedContent<CornerContent>
      }
    `
    expect(
      ruleE_brandCastViolations('src/engine/corners/otherFile.ts', sameContentDifferentPath).length,
    ).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 5. 브랜드 정의 모듈 자체가 현재 세 규칙을 위반하지 않는다 (실사용 확인)
// ─────────────────────────────────────────────────────────────────────────

describe('src/engine/corners/brandedTypes.ts — 실제 파일이 규칙 C·D·E를 위반하지 않는다', () => {
  const absPath = path.join(REPO_ROOT, 'src/engine/corners/brandedTypes.ts')
  const source = fs.readFileSync(absPath, 'utf8')

  it('규칙 C 위반 없음 (LLM 호출 없음)', () => {
    expect(ruleC_llmCallBoundaryViolations(BRAND_DEFINITION_MODULE, source)).toEqual([])
  })

  it('규칙 D 위반 없음 (app_config 접근 없음)', () => {
    expect(ruleD_appConfigLookupBoundaryViolations(BRAND_DEFINITION_MODULE, source)).toEqual([])
  })

  it('규칙 E 위반 없음 (캐스트가 정의 모듈 안에 있어 예외 대상 — #13 이후 상태)', () => {
    // #13부터 이 파일은 `validateCornerContent`·`buildCoeffBundle` 안에
    // 캐스트를 정확히 두 곳 포함한다. 규칙 E는 "정의 모듈 안의 캐스트"를
    // 예외로 두므로(r18) 캐스트가 실재해도 위반 목록은 여전히 빈
    // 배열이어야 한다 — 이 테스트는 그 예외가 실파일에도 그대로
    // 적용되는지 확인한다(합성 입력 테스트만으로는 실파일의 실제 캐스트
    // 형태가 패턴과 맞는지 보장되지 않는다).
    expect(ruleE_brandCastViolations(BRAND_DEFINITION_MODULE, source)).toEqual([])
  })

  it('런타임 export는 생성 함수 둘뿐이다 (#13이 추가한 것과 정확히 일치)', () => {
    // #12 시점에는 `export type`만 있어 런타임 값이 하나도 없었고,
    // Babel CJS interop이 그런 모듈에 빈 `default` 객체를 자동으로
    // 합성해 붙였다(이 테스트의 이전 버전이 그 상태를 `['default']`로
    // 단언했었다). #13이 `validateCornerContent`·`buildCoeffBundle` 두
    // 함수를 **이 모듈 안에서만**(export 금지·규칙 E) 실제로
    // export하면서, 모듈에 실제 런타임 값이 생겨 그 synthetic default
    // 합성이 더 이상 일어나지 않는다(Babel은 실제 export가 하나라도
    // 있으면 default를 합성하지 않는다) — 그래서 `default`가 이제는
    // 목록에서 사라지는 것이 맞는 상태다. 그 밖의 키가 나타나면 생성
    // 함수가 다른 곳에도 있거나 의도치 않은 값이 export됐다는 뜻이다.
    expect(new Set(Object.keys(BrandedTypes))).toEqual(
      new Set(['validateCornerContent', 'buildCoeffBundle']),
    )
    expect(typeof BrandedTypes.validateCornerContent).toBe('function')
    expect(typeof BrandedTypes.buildCoeffBundle).toBe('function')
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

  it('cornerPipeline.ts·saveCornerResult.ts는 app_config·LLM 호출·브랜드 캐스트 중 어느 것도 직접 하지 않는다(전부 지정 모듈에 위임)', () => {
    for (const rel of [
      'supabase/functions/_shared/cornerPipeline.ts',
      'supabase/functions/_shared/saveCornerResult.ts',
    ]) {
      const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
      expect(ruleC_llmCallBoundaryViolations(rel, source)).toEqual([])
      expect(ruleD_appConfigLookupBoundaryViolations(rel, source)).toEqual([])
      expect(ruleE_brandCastViolations(rel, source)).toEqual([])
    }
  })
})
