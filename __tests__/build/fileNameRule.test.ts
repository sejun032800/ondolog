import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 정적 규칙 F - 파일명 경계 (docs/ONDOLOG_MASTER.md §17-0-3 규칙 F, r33. CLAUDE.md 절대 규칙 4의 집행 장치).
 * 위임: .claude/state/prompts/phase-7/40-corner-pipeline-followups.md 범위 4.
 *
 * 저장소에 커밋되는 모든 파일의 **이름(basename)**이 ASCII 영문·숫자·`-`·`_`·`.`만 쓴다. 공백·괄호·한글 금지.
 * **디렉터리명은 보지 않는다** - Expo Router 라우트 그룹 `app/(tabs)`·`app/(modals)`는 괄호가 정당하고, 전체 경로를
 * 검사하면 규칙이 첫 실행에서 실패한다. 그 안의 파일(`index.tsx` 등)의 basename은 규칙을 지킨다.
 *
 * 수집(1부 설계 B-8): `git ls-files --cached --others --exclude-standard -z` 중 아래 범위 안. "커밋될 파일"과 같은
 * 집합이고, 아직 `git add` 전인 새 파일(위반이 처음 생기는 자리)도 잡힌다. `.gitignore`가 `node_modules/`·`.expo/`
 * 같은 비추적 경로를 이미 제외하므로 별도 제외 목록이 필요 없다. `-z`는 한글 경로가 따옴표로 이스케이프되는 것을
 * 피하려는 것이다. git을 쓸 수 없는 환경에서는 파일시스템 재귀로 되돌아간다(비추적 디렉터리는 이름으로 뺀다).
 *
 * 위치가 `__tests__/build/`인 이유: 저장소 전체 위생 검사라 `engine/`이 아니고, 외부 프로세스(git)를 부르기 때문이다.
 */

const REPO_ROOT = path.join(__dirname, '..', '..')

/** 수집 범위 - 이 디렉터리들 아래만. 루트 파일(`CLAUDE.md`·`package.json` 등)은 범위 밖이다. */
const FILE_NAME_RULE_ROOTS: readonly string[] = ['docs', 'src', 'app', 'scripts', '__tests__', 'supabase', '.claude', 'assets']

const ALLOWED_BASENAME = /^[A-Za-z0-9._-]+$/

/** 규칙 F: 경로의 **basename만** 검사한다. 위반이면 사유를, 아니면 null. */
function fileNameViolation(relPath: string): string | null {
  const base = relPath.split('/').pop() ?? ''
  if (base.length === 0) return `${relPath}: 파일명이 비어 있다`
  if (ALLOWED_BASENAME.test(base)) return null
  return `${relPath}: 파일명 "${base}"에 ASCII 영문·숫자·-·_·. 밖의 문자가 있다(공백·괄호·한글 등)`
}

function fileNameViolations(relPaths: readonly string[]): string[] {
  return relPaths.map(fileNameViolation).filter((v): v is string => v !== null)
}

function inScope(relPath: string): boolean {
  return FILE_NAME_RULE_ROOTS.some((root) => relPath.startsWith(`${root}/`))
}

const UNTRACKED_DIRS = new Set(['node_modules', '.git', '.expo', '.norm-build'])

function collectByFileSystem(): string[] {
  const out: string[] = []
  const walk = (dirRel: string): void => {
    for (const entry of fs.readdirSync(path.join(REPO_ROOT, dirRel), { withFileTypes: true })) {
      if (UNTRACKED_DIRS.has(entry.name)) continue
      const rel = `${dirRel}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else out.push(rel)
    }
  }
  for (const root of FILE_NAME_RULE_ROOTS) {
    if (fs.existsSync(path.join(REPO_ROOT, root))) walk(root)
  }
  return out
}

/** 커밋될 파일 전부(추적 + 아직 추가 전인 새 파일, `.gitignore` 제외) 중 수집 범위 안. */
function collectRepositoryFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) return collectByFileSystem()
  return result.stdout
    .split('\0')
    .filter((p) => p.length > 0)
    .filter(inScope)
}

describe('규칙 F - 합성 입력 (위반)', () => {
  it.each([
    ['공백', 'docs/a b.md'],
    ['괄호 접미사 (OneDrive 중복 반입)', 'docs/file (1).md'],
    ['붙은 괄호', 'src/a(1).ts'],
    ['한글', 'docs/한글.md'],
    ['+ 기호', 'src/x+y.ts'],
    ['중복 접미사의 공백', '.claude/state/prompts/phase-7/40-x (2).md'],
    ['대괄호', 'src/[id].tsx'],
    ['탭', 'src/a\tb.ts'],
  ])('%s: %s', (_name, relPath) => {
    expect(fileNameViolations([relPath]).length).toBe(1)
  })

  it('위반 사유에 어느 파일인지 실린다', () => {
    const [v] = fileNameViolations(['docs/file (1).md'])
    expect(v).toContain('docs/file (1).md')
  })
})

describe('규칙 F - 합성 입력 (정상)', () => {
  it.each([
    ['index.tsx'],
    ['.gitkeep'],
    ['a-b_c.d.ts'],
    ['app/(tabs)/index.tsx'],
    ['app/(modals)/x.tsx'],
    ['app/(onboarding)/basic-info.tsx'],
    ['docs/ONDOLOG_MASTER.md'],
    ['supabase/migrations/019_avatars_storage_policies.sql'],
  ])('%s', (relPath) => {
    expect(fileNameViolations([relPath])).toEqual([])
  })

  it('디렉터리명은 보지 않는다 - 괄호·공백이 있는 디렉터리 안의 정상 파일은 통과한다', () => {
    expect(fileNameViolations(['app/(tabs)/index.tsx', 'docs/some dir/ok.md'])).toEqual([])
  })

  it('수집 범위: 범위 밖의 루트 파일은 보지 않는다', () => {
    expect(inScope('CLAUDE.md')).toBe(false)
    expect(inScope('package.json')).toBe(false)
    expect(inScope('docs/a.md')).toBe(true)
    expect(inScope('.claude/state/PROGRESS.md')).toBe(true)
    expect(inScope('assets/fonts/MaruBuri-Light.ttf')).toBe(true)
    expect(inScope('node_modules/x/a.js')).toBe(false)
  })
})

describe('규칙 F - 저장소 실제 파일', () => {
  const files = collectRepositoryFiles()

  it('수집이 비어 있지 않다 - 수집이 깨져서 통과하는 일이 없다', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files).toContain('docs/ONDOLOG_MASTER.md')
    expect(files.some((f) => f.startsWith('app/(tabs)/'))).toBe(true) // 라우트 그룹 안의 파일이 수집된다
    expect(files.every(inScope)).toBe(true)
  })

  it('커밋되는 모든 파일의 이름이 규칙을 지킨다', () => {
    expect(fileNameViolations(files)).toEqual([])
  })

  it('파일시스템 대체 수집도 같은 결과로 통과한다', () => {
    expect(fileNameViolations(collectByFileSystem())).toEqual([])
  })
})
