/**
 * 79- ② 새지 않음: 스모크 코드 · 가짜 데이터에만 있는 글자들. `build` · `build:trial` 결과물에 하나라도 있으면 실패한다.
 * (스모크 결과물에는 있어야 한다 - 검사 자체가 살아 있는지 확인용.) 쓰는 곳: `smoke/run.mjs` · `src/app/smokeIsolation.vitest.ts`.
 */
import fs from 'node:fs'
import path from 'node:path'

export const SMOKE_MARKERS = [
  '__ONDOLOG_SMOKE_ONLY__', // fakeClient.ts SMOKE_MARK
  'smoke-media/', // 자리 그림 경로
  'smoke-user-', // 만든 사용자 id
  'smoke-couple', // 만든 커플 id
  'ondolog-smoke-entry', // 스모크 빌드 플러그인 이름
  '가온', '나래', '솜사탕', // 만든 이름 · 별칭
]

/** 폴더 안 글 파일(.js · .css · .html · .json · .map)에서 표지를 찾는다. 돌려주는 값: [{ file, marker }]. */
export function scanForMarkers(dir) {
  const hits = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(m?js|css|html|json|map|svg|txt)$/i.test(e.name)) {
        const text = fs.readFileSync(p, 'utf8')
        for (const m of SMOKE_MARKERS) if (text.includes(m)) hits.push({ file: path.relative(dir, p), marker: m })
      }
    }
  }
  walk(dir)
  return hits
}
