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

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react(), requireRemoteEnvForProduction()],
  resolve: {
    alias: { '@': canonicalSrc },
    // 정본(../src)이 루트 node_modules의 react · zustand를 따로 끌어오지 않게, 한 벌만 쓴다.
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  // 79- R114: 빌드 대상 = iOS 16.4 이상(iPhone 14 Pro · 15 Pro 기본 지원 범위 안). 나머지는 Vite 7 기본값(baseline-widely-available)과 같다 - Android 웹뷰 기준 그대로.
  build: { assetsInlineLimit: 0, target: ['chrome107', 'edge107', 'firefox104', 'safari16.4'] },
  // A-7: 빌드 결과(운영 · 시험 공통)에서 console 호출을 뺀다 - 우리 코드는 부르지 않지만 라이브러리가 세션 · 주소를 찍는 일을 원천 차단한다.
  // (개발 서버 · 시험에서는 빼지 않는다 - 시험이 console 감시를 실제로 하도록)
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : undefined,
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    // 시험 파일 이름은 *.vitest.ts(x)만(루트 jest가 줍지 않게 - R70-3).
    include: ['src/**/*.vitest.{ts,tsx}'],
    css: false,
  },
}))
