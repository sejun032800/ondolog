/// <reference types="jest" />
/**
 * `coeffLookup.ts` — `app_config` 조회가 허용되는 유일한 모듈(정적 규칙 D).
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 4부
 * + .claude/state/prompts/phase-7/33-corner-pipeline-skeleton-behavior.md (r40).
 *
 * 이 파일은 대상과 같은 트리(`supabase/functions/_shared/`)에 있고 `.ts` 확장자
 * 정적 import로 대상을 가져온다. 루트 tsc는 `exclude`로 이 파일을 보지 않고,
 * 전용 tsconfig(`supabase/functions/tsconfig.json`)가 타입 검사한다
 * (`__tests__/build/edgeFunctionsTypecheck.test.ts`). jest 전역은 위
 * `/// <reference types="jest" />`로 해소한다.
 *
 * ── r40: `buildCoeffBundle`은 비공개다 ──────────────────────────────────
 * `CoeffBundle`을 만드는 공개 경로는 `lookupCoeffBundle`(조회 → 브랜드) 하나뿐이다.
 * 그래서 `version` 검증과 결정론은 `AppConfigQueryClient` 가짜를 통해 정식 경로로
 * 시험한다. 비공개라는 사실 자체는 맨 아래 블록이 타입 층(`@ts-expect-error`)과
 * 런타임 export 목록 양쪽으로 증명한다.
 */

import { lookupCoeffBundle, type AppConfigQueryClient } from './coeffLookup.ts'
import * as CoeffLookupModule from './coeffLookup.ts'
// @ts-expect-error buildCoeffBundle은 coeffLookup.ts 밖으로 공개되지 않는다(r40) — 모듈은 "로컬 선언이지만 export되지 않았다"고 거부한다.
import { buildCoeffBundle } from './coeffLookup.ts'

function fakeClient(row: { key: string; value: unknown } | null, errorMessage?: string): AppConfigQueryClient {
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

  it('value가 version 없는 객체면(브랜드 조립 단계의 version 검증) 던진다', async () => {
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
// 정식 경로(`lookupCoeffBundle`)로 시험하는 `version` 검증과 결정론 — r40 이전에는
// `buildCoeffBundle`을 직접 불러 시험하던 블록이다(③ 공개 해제).
// ─────────────────────────────────────────────────────────────────────────

describe('lookupCoeffBundle — app_config에서 읽은 원시 값만 CoeffBundle이 된다', () => {
  it('version 필드가 있으면 CoeffBundle로 조립된다', async () => {
    const client = fakeClient({ key: 'k', value: { version: '1.0.0', someCoeff: 0.3 } })
    const bundle = await lookupCoeffBundle(client, 'k')
    expect(bundle.version).toBe('1.0.0')
  })

  it('version이 없으면 던진다', async () => {
    const client = fakeClient({ key: 'k', value: { someCoeff: 0.3 } })
    await expect(lookupCoeffBundle(client, 'k')).rejects.toThrow()
  })

  it('version이 문자열이 아니면 던진다', async () => {
    const client = fakeClient({ key: 'k', value: { version: 123 } })
    await expect(lookupCoeffBundle(client, 'k')).rejects.toThrow()
  })

  it('version이 빈 문자열이면 던진다', async () => {
    const client = fakeClient({ key: 'k', value: { version: '' } })
    await expect(lookupCoeffBundle(client, 'k')).rejects.toThrow()
  })
})

describe('결정론 — 동일 입력 100회 반복 → 100회 동일 결과 (정식 경로의 조립)', () => {
  it('같은 입력에 항상 같은 결과를 낸다', async () => {
    const client = fakeClient({ key: 'k', value: { version: '2.3.1', a: 1, b: 2 } })
    const results = await Promise.all(Array.from({ length: 100 }, () => lookupCoeffBundle(client, 'k')))
    for (const r of results) {
      expect(r.version).toBe('2.3.1')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// r40 — `buildCoeffBundle`은 모듈 밖에서 못 부른다.
// ─────────────────────────────────────────────────────────────────────────

describe('r40 — buildCoeffBundle은 coeffLookup.ts 밖으로 공개되지 않는다', () => {
  it('타입 층: import 시도가 컴파일 에러다 (위 @ts-expect-error가 실제로 에러를 억제 중 — 두 게이트 0이 증거)', () => {
    // 위 import 줄의 `@ts-expect-error`는 에러가 없으면 "사용되지 않은 지시어"로 tsc가 실패한다.
    // 여기서는 부르지 않는다 — 부를 수 없다는 것이 증명 대상이다.
    expect(typeof CoeffLookupModule.lookupCoeffBundle).toBe('function')
  })

  it('런타임 층: 모듈의 export 목록에 buildCoeffBundle이 없다', () => {
    expect(Object.keys(CoeffLookupModule)).not.toContain('buildCoeffBundle')
    expect(buildCoeffBundle).toBeUndefined()
  })
})
