/**
 * `coeffLookup.ts` — `app_config` 조회가 허용되는 유일한 모듈(정적 규칙 D).
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 4부.
 *
 * ── 왜 `import` 대신 `require(경로변수)`인가 ────────────────────────────
 * `coeffLookup.ts`는 Deno 실행을 위해 `src/engine/corners/brandedTypes.ts`를
 * **`.ts` 확장자를 명시해** 상대경로로 import한다(Deno 표준 동작,
 * `supabase/functions/tsconfig.json`의 `allowImportingTsExtensions`가
 * 그것을 허용한다). 이 테스트 파일은 루트 `tsconfig.json` 범위 안이고,
 * 루트 설정에는 그 옵션이 없다. **정적 `import`로 `coeffLookup.ts`를
 * 가져오면 tsc가 그 파일을 전이적으로 파싱하면서 내부의 `.ts` 확장자
 * import에 `TS5097`을 낸다** — `exclude: ["supabase/functions"]`는
 * "루트에서 시작하는 파일"만 걸러낼 뿐, 루트 파일이 참조해 들어간 파일은
 * 그대로 타입 검사 대상이 되기 때문이다(실측 확인, 이 파일 작성 중
 * 발견). 변수에 담은 경로로 `require()`하면 TS가 그 문자열을 정적으로
 * 해석하지 않아(리터럴이 아니므로) 대상 파일을 파싱하지 않는다 — 그래서
 * 이 우회를 쓴다. `lookupCoeffBundle`/`AppConfigQueryClient`의 타입은
 * 이 파일 안에서 구조적으로 다시 선언한다(가져오지 않는다).
 *
 * ── `buildCoeffBundle`을 여기서도 테스트하는 이유 (r25) ──────────────────
 * `.claude/state/prompts/phase-7/21-engine-dev-brand-constructors.md`
 * (브랜드 생성자 이전)에서 `buildCoeffBundle`이
 * `src/engine/corners/brandedTypes.ts`에서 이 파일(`coeffLookup.ts`)로
 * 옮겨왔다 — `app_config`를 실제로 읽는 자리이기 때문이다(마스터 문서
 * 17-0-2 r25). 아래 `buildCoeffBundle — app_config에서 읽은 원시 값만
 * CoeffBundle이 된다` 블록은 이전에
 * `__tests__/engine/corners/brandedTypesGenerators.test.ts`에 있던 것과
 * **assertion이 완전히 동일하다** — 옮긴 것은 import 경로와 파일
 * 위치뿐이다(그 파일은 이번 이전으로 삭제됐다, HANDOFF.md 참조).
 */

interface FakeCoeffBundle {
  readonly version: string
  readonly [key: string]: unknown
}

interface AppConfigQueryClientShape {
  from(table: 'app_config'): {
    select(columns: string): {
      eq(
        column: 'key',
        value: string,
      ): {
        maybeSingle(): Promise<{
          data: { key: string; value: unknown } | null
          error: { message: string } | null
        }>
      }
    }
  }
}

type LookupCoeffBundleFn = (client: AppConfigQueryClientShape, configKey: string) => Promise<FakeCoeffBundle>
type BuildCoeffBundleFn = (raw: Record<string, unknown>) => FakeCoeffBundle

const coeffLookupModulePath = '../../supabase/functions/_shared/coeffLookup'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { lookupCoeffBundle, buildCoeffBundle } = require(coeffLookupModulePath) as {
  lookupCoeffBundle: LookupCoeffBundleFn
  buildCoeffBundle: BuildCoeffBundleFn
}

function fakeClient(
  row: { key: string; value: unknown } | null,
  errorMessage?: string,
): AppConfigQueryClientShape {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: errorMessage ? null : row,
            error: errorMessage ? { message: errorMessage } : null,
          }),
        }),
      }),
    }),
  }
}

describe('lookupCoeffBundle — 성공', () => {
  it('value가 version을 포함한 객체면 CoeffBundle로 조립한다', async () => {
    const client = fakeClient({ key: 'corner_coeffs', value: { version: '1.2.0', weight: 0.5 } })
    const bundle = await lookupCoeffBundle(client, 'corner_coeffs')
    expect(bundle.version).toBe('1.2.0')
  })
})

describe('lookupCoeffBundle — 실패 (4값 어디에도 속하지 않아 그대로 던진다)', () => {
  it('조회 오류면 던진다', async () => {
    const client = fakeClient(null, 'connection reset')
    await expect(lookupCoeffBundle(client, 'x')).rejects.toThrow(/connection reset/)
  })

  it('행이 없으면 던진다', async () => {
    const client = fakeClient(null)
    await expect(lookupCoeffBundle(client, 'missing_key')).rejects.toThrow(/missing_key/)
  })

  it('value가 객체가 아니면 던진다', async () => {
    const client = fakeClient({ key: 'x', value: 'not-an-object' })
    await expect(lookupCoeffBundle(client, 'x')).rejects.toThrow()
  })

  it('value가 배열이면 던진다(Array.isArray 가드)', async () => {
    const client = fakeClient({ key: 'x', value: [1, 2, 3] })
    await expect(lookupCoeffBundle(client, 'x')).rejects.toThrow()
  })

  it('value가 version 없는 객체면(buildCoeffBundle 내부 검증) 던진다', async () => {
    const client = fakeClient({ key: 'x', value: { weight: 0.5 } })
    await expect(lookupCoeffBundle(client, 'x')).rejects.toThrow()
  })
})

describe('결정론 — 동일 입력 100회 반복 → 100회 동일 결과', () => {
  it('같은 fake client + 같은 key로 100회 호출해도 같은 CoeffBundle이 나온다', async () => {
    const client = fakeClient({ key: 'k', value: { version: '9.9.9', a: 1 } })
    for (let i = 0; i < 100; i++) {
      const bundle = await lookupCoeffBundle(client, 'k')
      expect(bundle.version).toBe('9.9.9')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// buildCoeffBundle — r25로 brandedTypes.ts에서 이 파일로 이전. 아래
// 블록은 __tests__/engine/corners/brandedTypesGenerators.test.ts에 있던
// 것과 assertion이 완전히 동일하다(옮긴 것은 import 경로뿐. 그 파일은
// 이번 이전으로 삭제됨 — HANDOFF.md 참조).
// ─────────────────────────────────────────────────────────────────────────

describe('buildCoeffBundle — app_config에서 읽은 원시 값만 CoeffBundle이 된다', () => {
  it('version 필드가 있으면 CoeffBundle로 조립된다', () => {
    const bundle = buildCoeffBundle({ version: '1.0.0', someCoeff: 0.3 })
    expect(bundle.version).toBe('1.0.0')
  })

  it('version이 없으면 던진다', () => {
    expect(() => buildCoeffBundle({ someCoeff: 0.3 })).toThrow()
  })

  it('version이 문자열이 아니면 던진다', () => {
    expect(() => buildCoeffBundle({ version: 123 as unknown as string })).toThrow()
  })

  it('version이 빈 문자열이면 던진다', () => {
    expect(() => buildCoeffBundle({ version: '' })).toThrow()
  })
})

describe('결정론 — 동일 입력 100회 반복 → 100회 동일 결과 (buildCoeffBundle)', () => {
  it('buildCoeffBundle은 같은 입력에 항상 같은 결과를 낸다', () => {
    const raw = { version: '2.3.1', a: 1, b: 2 }
    const results = Array.from({ length: 100 }, () => buildCoeffBundle(raw))
    for (const r of results) {
      expect(r.version).toBe('2.3.1')
    }
  })
})
