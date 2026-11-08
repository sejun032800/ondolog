/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 저장소 정본(src/engine · constants · data · store · utils)을 별칭 `@/`로 가져다 쓴다. web/ 안에 엔진 사본은 없다.
const canonicalSrc = fileURLToPath(new URL('../src', import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react()],
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
