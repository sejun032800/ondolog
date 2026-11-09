/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// 저장소 정본(src/engine · constants · data · store · utils)을 별칭 `@/`로 가져다 쓴다. web/ 안에 엔진 사본은 없다.
const canonicalSrc = fileURLToPath(new URL('../src', import.meta.url))

// 운영 빌드(`vite build`, mode = production)는 원격 연결 값이 없으면 실패한다 - 로그인이 안 되는 앱이 나가지 않게.
// 시험 빌드(`--mode trial`)와 개발 서버는 값이 없어도 되고, 앱이 원격으로 가지 않으며 로그인 화면에 개발용 안내만 뜬다. 값은 출력하지 않는다.
function requireRemoteEnvForProduction(): Plugin {
  return {
    name: 'require-remote-env-for-production',
    apply: 'build',
    configResolved(config) {
      if (config.mode !== 'production') return
      const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !String(config.env[k] ?? '').trim())
      if (missing.length > 0) throw new Error(`운영 빌드에 필요한 환경 변수가 비어 있어요: ${missing.join(', ')} (web/.env)`)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), requireRemoteEnvForProduction()],
  resolve: {
    alias: { '@': canonicalSrc },
    // 정본(../src)이 루트 node_modules의 react · zustand를 따로 끌어오지 않게, 한 벌만 쓴다.
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  build: { assetsInlineLimit: 0 },
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    // 시험 파일 이름은 *.vitest.ts(x)만(루트 jest가 줍지 않게 - R70-3).
    include: ['src/**/*.vitest.{ts,tsx}'],
    css: false,
  },
})
