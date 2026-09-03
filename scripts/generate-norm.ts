/**
 * 규준집단 데이터 파일 생성기 — `src/engine/data/norm-synthetic-v1.json`을 쓴다.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-8-1 / 10-8-3.
 *
 * 이 파일의 유일한 책임은 **파일 쓰기**다. 열거 로직은
 * `scripts/norm/enumerate.ts`(순수 함수, 파일 I/O 없음)에 있고, 직렬화는
 * `scripts/norm/serialize.ts`에 있다. 셋을 분리해야 드리프트 감지
 * 테스트가 열거를 다시 부를 수 있다.
 *
 * ── 실행 방법 (Windows / PowerShell) ─────────────────────────────
 * 프로젝트에 TS 러너(ts-node/tsx)가 없고 Node 네이티브 TS 실행은
 * 확장자 없는 상대 import를 해석하지 못하므로, 1회용으로 컴파일 후
 * 실행한다 (의존성·설정 파일 변경 없음, 임시 산출물은 build 디렉터리):
 *
 *   npx tsc scripts/generate-norm.ts --ignoreConfig --ignoreDeprecations "6.0" \
 *     --outDir .norm-build --module commonjs --moduleResolution node \
 *     --target es2022 --esModuleInterop --skipLibCheck --resolveJsonModule --types node
 *   node .norm-build/scripts/generate-norm.js
 *   rm -rf .norm-build
 *
 * `.norm-build/`는 임시 산출물이다(커밋 금지). 커밋되는 것은
 * `src/engine/data/norm-synthetic-v1.json` 하나뿐이다.
 *
 * 결정론 보장은 `__tests__/engine/normDrift.test.ts`가 매 CI 실행마다
 * 열거를 재호출해 커밋된 파일과 대조하는 것으로 성립한다 — 이 스크립트를
 * 다시 돌릴 필요 없이 테스트가 드리프트를 잡는다.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { NORM_VERSION, enumerateNormData } from './norm/enumerate'
import { serializeNormData } from './norm/serialize'

/** 커밋되는 규준 파일 경로 (Part 10-8-3: `src/engine/data/norm-{version}.json`). */
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'src',
  'engine',
  'data',
  `norm-${NORM_VERSION}.json`,
)

function main(): void {
  const data = enumerateNormData()
  const serialized = serializeNormData(data)

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, serialized, 'utf8')

  const stats = fs.statSync(OUTPUT_PATH)
  process.stdout.write(
    `wrote ${OUTPUT_PATH}\n` +
      `  version=${data.version} sampleSize=${data.sampleSize} bytes=${stats.size}\n` +
      `  engineVersions=${JSON.stringify(data.engineVersions)}\n`,
  )
}

main()
