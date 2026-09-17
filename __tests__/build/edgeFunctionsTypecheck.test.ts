import { spawnSync } from 'child_process'
import * as path from 'path'

/**
 * 게이트 2 — 루트 tsconfig.json의 `exclude: ["supabase/functions"]`는
 * 그 디렉터리를 루트 타입 검사에서 뺀다. 전용 tsconfig
 * (supabase/functions/tsconfig.json)가 그 디렉터리를 실제로 커버하고
 * 있어야만 이 exclude가 안전하다 — 전용 tsconfig가 지워지거나
 * `-p` 인자가 빠지면 그 디렉터리는 아무 검사도 받지 않게 된다.
 * 이 테스트가 그 빈틈을 상시로 막는다: 전용 tsconfig가 없어지거나
 * 깨지면 tsc가 0이 아닌 코드로 종료해 이 테스트가 실패한다.
 *
 * 별도 파일로 둔 이유: 외부 프로세스(tsc)를 실행해 다른 정적 규칙
 * 테스트보다 수십 배 느리다 — 빠른 스위트의 실행 시간에 섞이면 안 된다.
 * `src/engine/`·`src/services/`·`src/engine/corners/`·
 * `supabase/functions/` 재귀 스캔 대상 밖에 둔다.
 */
describe('supabase/functions 전용 tsconfig — 게이트 2 (외부 프로세스)', () => {
  it(
    'npx tsc --noEmit -p supabase/functions/tsconfig.json 이 0으로 종료한다',
    () => {
      const repoRoot = path.join(__dirname, '..', '..')
      const result = spawnSync(
        'npx',
        ['tsc', '--noEmit', '-p', 'supabase/functions/tsconfig.json'],
        { cwd: repoRoot, encoding: 'utf8', shell: true },
      )

      if (result.status !== 0) {
        throw new Error(
          `tsc exited with ${result.status}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
        )
      }

      expect(result.status).toBe(0)
    },
    60000,
  )
})
