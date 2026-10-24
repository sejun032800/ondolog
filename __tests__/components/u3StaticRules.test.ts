/**
 * U3(`58-`) 정적 확인 - 새로 만든 서재·뷰어 파일이 지켜야 할 것을 파일 내용으로 확인한다.
 *
 * - 인쇄용 PDF 경로를 클라이언트가 참조하지 않는다(CLAUDE.md 절대 규칙 3). `issues` 테이블을 직접 읽지 않는다.
 * - 서명 URL·토큰을 로그에 남기지 않는다.
 * - 영속 저장소를 쓰지 않는다(보던 쪽은 메모리).
 * - 색 리터럴 0 · `fontWeight` 0 · `textFaint`는 비활성 컨트롤 글자에만 · `lilac` 12pt 이하 글자 0 (완료 보고 확인 항목).
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

const U3_FILES = [
  ...listFiles(join(ROOT, 'src', 'components', 'magazine')),
  join(ROOT, 'app', '(tabs)', 'magazine.tsx'),
  join(ROOT, 'app', '(modals)', 'magazine-viewer.tsx'),
  join(ROOT, 'src', 'services', 'magazineApi.ts'),
  join(ROOT, 'src', 'services', 'issueManifest.ts'),
  join(ROOT, 'src', 'hooks', 'useLibrary.ts'),
  join(ROOT, 'src', 'hooks', 'useIssueViewer.ts'),
  join(ROOT, 'src', 'store', 'viewerStore.ts'),
  join(ROOT, 'src', 'utils', 'magazine.ts'),
  join(ROOT, 'src', 'constants', 'magazineCopy.ts'),
]

/** 주석을 지운 코드(문자열은 남긴다). */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

describe('U3 파일 목록', () => {
  it('찾는 파일이 모두 있다(검사가 비어서 통과하지 않는다)', () => {
    expect(U3_FILES.length).toBeGreaterThanOrEqual(15)
    for (const f of U3_FILES) expect(readFileSync(f, 'utf8').length).toBeGreaterThan(0)
  })
})

describe('절대 규칙 3 - 인쇄용 PDF 비노출', () => {
  it('인쇄 경로 칸 이름이 코드에 없다', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/pdf_print_path|pdfPrintPath|print_path/i)
  })

  it('issues 테이블을 직접 읽지 않는다 - issues_public만', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/from\(\s*['"]issues['"]\s*\)/)
    expect(code(join(ROOT, 'src', 'services', 'magazineApi.ts'))).toContain("from('issues_public')")
  })
})

describe('서명 URL·저장소', () => {
  it('콘솔 출력이 없다', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/console\.(log|info|warn|error|debug)/)
  })

  it('영속 저장소를 쓰지 않는다', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/AsyncStorage|SecureStore|persist\(|localStorage|MMKV/)
  })

  it('service_role을 모른다', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/service_role|SERVICE_ROLE/)
  })

  it('새 의존성이 없다 - 파일 저장·공유·PDF 뷰어 라이브러리를 부르지 않는다', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/expo-file-system|expo-sharing|expo-media-library|react-native-pdf|react-native-share|expo-image['"]/)
  })
})

describe('색·서체 확인 항목', () => {
  const visual = U3_FILES.filter((f) => /\.tsx$/.test(f))

  it('색 리터럴 0(#hex·rgb())', () => {
    for (const f of visual) {
      const c = code(f)
      expect(c).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(c).not.toMatch(/rgba?\(/)
    }
  })

  it('fontWeight 0', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/fontWeight/)
  })

  it('textFaint는 비활성 컨트롤 글자에만 - 이 파일들에서는 쓰지 않는다', () => {
    for (const f of U3_FILES) expect(code(f)).not.toContain('textFaint')
  })

  it('lilac은 글자 색으로 쓰지 않는다', () => {
    for (const f of visual) expect(code(f)).not.toMatch(/color:\s*nocturne\.lilac\b/)
  })

  it('moon은 Vol 라벨(서재)에서만 쓴다', () => {
    const users = U3_FILES.filter((f) => /nocturne\.moon\b/.test(code(f))).map((f) => f.split(/[\\/]/).pop())
    expect(users).toEqual(['LibraryShelf.tsx'])
  })

  it('금지 모션 없음 - 스피너·카운트업', () => {
    for (const f of U3_FILES) expect(code(f)).not.toMatch(/ActivityIndicator|withSpring|countUp|CountUp/)
  })
})
