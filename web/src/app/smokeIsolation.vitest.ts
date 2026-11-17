/**
 * 79- ② 새지 않음(정적): 스모크 진입점 · 가짜 클라이언트 · 만든 데이터는 앱 빌드(`build` · `build:trial`)에 들어갈 길이 없다.
 *  - 앱 빌드의 입구는 `index.html` -> `./src/main.tsx` 하나이고, `src/` 안 어떤 앱 파일도 `smoke/`를 가져오지 않는다(시험 파일 제외).
 *  - 앱 설정(`vite.config.ts`)은 스모크를 모른다(스모크 설정이 앱 설정을 가져다 쓰는 한 방향만).
 *  - `web/dist`가 있으면(마지막 `build` 또는 `build:trial` 결과) 스모크 표지가 0이다. 실제 번들 검색은 `npm run smoke:webkit`이 시험 빌드를 따로 내서 한 번 더 한다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// @ts-expect-error - 일반 JS 모듈(스모크 실행기와 같은 표지 목록 한 벌)
import { SMOKE_MARKERS, scanForMarkers } from '../../smoke/markers.mjs'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function appSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...appSourceFiles(p))
    else if (/\.(ts|tsx|css)$/.test(e.name) && !/\.vitest\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

describe('79- 스모크 격리(새지 않음)', () => {
  it('앱 입구는 index.html -> ./src/main.tsx 하나 · smoke 언급 0', () => {
    const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8')
    expect(html).toContain('src="./src/main.tsx"')
    expect(html).not.toMatch(/smoke/i)
    expect(fs.readFileSync(path.join(webDir, 'vite.config.ts'), 'utf8')).not.toMatch(/smoke/i)
  })

  it('src/ 앱 파일은 smoke/를 가져오지 않고 표지 글자도 없다', () => {
    const files = appSourceFiles(path.join(webDir, 'src'))
    expect(files.length).toBeGreaterThan(50)
    const bad = files.filter((f) => {
      const t = fs.readFileSync(f, 'utf8')
      return /from\s+['"][^'"]*smoke\//.test(t) || /import\(\s*['"][^'"]*smoke\//.test(t) || (SMOKE_MARKERS as string[]).some((m) => t.includes(m))
    })
    expect(bad.map((f) => path.relative(webDir, f))).toEqual([])
  })

  it('web/dist(마지막 앱 빌드)에 스모크 표지 0', () => {
    const dist = path.join(webDir, 'dist')
    if (!fs.existsSync(path.join(dist, 'index.html'))) return // 아직 빌드 전(새로 받은 저장소) - smoke:webkit이 따로 확인한다
    expect(scanForMarkers(dist)).toEqual([])
  })
})
