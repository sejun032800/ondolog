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

/**
 * 84-h(R145-2): 시험판 전용 "유성 미리 보기"에만 있는 글자(줄 이름 · 줄 설명 · 견본 문장 · 견본 id - `src/features/sky/meteorPreview.tsx`).
 * 출시 빌드(`build`)에는 하나도 없어야 하고, 시험 빌드(`build:trial`)에는 모두 있어야 한다(검사가 살아 있는지). 값이 그 파일과 맞는지는 `meteorPreview84h.vitest.tsx`가 본다.
 */
export const PREVIEW_MARKERS = [
  '유성 미리 보기 · 시험판',
  '견본 말 하나를 바로 떨어뜨려요',
  '오늘 하루도 고생 많았어. 집에 가면 따뜻하게 자',
  '오늘 퇴근길에 비가 와서 우산을 펴고 걷는데',
  'preview-sender-a',
  'settings-row-sky-meteor-preview',
]

/**
 * 92-(R154-5): 스모크 전용 진입 파일(`smoke/entry.tsx` - 가짜 서버 표 · RPC 기록을 창에 여는 파일)에만 있는 이름.
 * 앱 출시 빌드(`build`)와 시험 빌드(`build:trial`)에는 하나도 없어야 하고, 스모크 결과물에는 모두 있어야 한다(검사가 살아 있는지 - 음성 대조).
 * 이 이름이 `smoke/entry.tsx` 밖 앱 코드에 없다는 것은 `src/app/smokeIsolation.vitest.ts`가 본다.
 */
export const ENTRY_MARKERS = [
  '__ONDOLOG_SMOKE_TABLES__', // entry.tsx - 가짜 서버 표(90-)
  '__ONDOLOG_SMOKE_RPC__', // entry.tsx - RPC 기록(80-)
]

/** 폴더 안 글 파일(.js · .css · .html · .json · .map)에서 표지를 찾는다. 돌려주는 값: [{ file, marker }]. */
export function scanForMarkers(dir, markers = SMOKE_MARKERS) {
  const hits = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(m?js|css|html|json|map|svg|txt)$/i.test(e.name)) {
        const text = fs.readFileSync(p, 'utf8')
        for (const m of markers) if (text.includes(m)) hits.push({ file: path.relative(dir, p), marker: m })
      }
    }
  }
  walk(dir)
  return hits
}
