/**
 * 스모크 빌드 설정(79- 안 A ①). **앱 설정(`../vite.config.ts`)을 그대로 불러** 그 위에 세 가지만 바꾼다:
 *  1. 진입: 같은 `index.html`에서 `./src/main.tsx` 한 줄만 `./smoke/entry.tsx`로(머리 · 뷰포트 · 글꼴 미리 읽기는 앱과 같다)
 *  2. 출력: 저장소 밖 임시 폴더(④) · 자리 그림 몇 장을 함께 낸다(만든 그림 - ③)
 *  3. 환경 변수 폴더: 비어 있는 이 폴더 - `web/.env`의 원격 값이 스모크 번들에 들어가지 않는다(원격 0)
 * build.target · 별칭 · console 제거 · base는 앱 설정 그대로다. mode는 `smoke`(운영과 같이 시험 빌드 표시 0 · 원격 값 검사는 운영 mode에서만).
 */
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig, type Plugin, type UserConfig } from 'vite'
import appConfig from '../vite.config'

const smokeDir = path.dirname(fileURLToPath(import.meta.url))
export const SMOKE_OUT = process.env.ONDOLOG_SMOKE_OUT ?? path.join(os.tmpdir(), 'ondolog-smoke', 'dist')

const svg = (w: number, h: number, a: string, b: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.12}" fill="#fff" fill-opacity=".35"/></svg>`

// 한 쪽짜리 빈 PDF(손으로 쓴 최소 구조).
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 280]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'

function smokeEntry(): Plugin {
  return {
    name: 'ondolog-smoke-entry',
    transformIndexHtml: { order: 'pre', handler(html) {
      if (!html.includes('./src/main.tsx')) throw new Error('index.html의 앱 진입 줄을 찾지 못했어요')
      return html.replace('./src/main.tsx', './smoke/entry.tsx')
    } },
    generateBundle() {
      const files: Record<string, string> = {
        'smoke-media/ph-0.svg': svg(1200, 900, '#6b5b95', '#f7cac9'),
        'smoke-media/ph-1.svg': svg(900, 1200, '#355c7d', '#f8b195'),
        'smoke-media/ph-2.svg': svg(1000, 1000, '#2a363b', '#99b898'),
        'smoke-media/sample.pdf': PDF,
      }
      for (const [fileName, source] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source })
    },
  }
}

export default defineConfig((env) => {
  const base = (typeof appConfig === 'function' ? appConfig(env) : appConfig) as UserConfig
  return mergeConfig(base, {
    envDir: smokeDir,
    plugins: [smokeEntry()],
    build: { outDir: SMOKE_OUT, emptyOutDir: true },
  } satisfies UserConfig)
})
