import { z } from 'zod'
import type { ValidatedContent, CoeffBundle } from '../../src/engine/corners/brandedTypes'
import type { SkipReason } from '../../src/engine/corners/pipelineContracts'

/**
 * `saveCornerResult.ts` — 저장 함수는 `ValidatedContent<T>`만 받는다
 * (Part 17-0-2), 실패 사유도 저장한다(Part 3-7-B, 17-0-5-B).
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 5부
 * + .claude/state/prompts/phase-7/21-engine-dev-brand-constructors.md
 * (r25 — 아래 참조).
 *
 * ── 왜 `saveCornerSuccess`/`saveCornerFailure`만 `require(경로변수)`인가 ─
 * `src/engine/corners/brandedTypes.ts`·`pipelineContracts.ts`는 루트
 * `tsconfig.json` 범위 안에서 안전하게 정적 import된다(다른 디렉터리를
 * 참조하지 않는다 — r25로 brandedTypes.ts는 아예 아무것도 import하지
 * 않는 순수 타입 모듈이 됐다). 반면 `saveCornerResult.ts`는 그 둘을
 * **`.ts` 확장자를 명시해** 상대경로로 import한다(Deno 표준). 정적으로
 * 가져오면 루트 tsc가 전이적으로 그 파일을 파싱해 `TS5097`을 낸다 —
 * `coeffLookup.test.ts`와 같은 이유(그 파일 docblock 참조).
 * `ValidatedContent`/`CoeffBundle`은 안전한 쪽에서 타입만 가져와 타입
 * 강제(브랜드)를 그대로 유지한다.
 *
 * ── r25: 이 파일의 테스트 픽스처를 만드는 방법이 바뀌었다 ────────────────
 * 이 테스트는 `saveCornerSuccess`/`saveCornerFailure`에 넘길
 * `ValidatedContent<T>`·`CoeffBundle` 값이 필요하다(저장 함수 자신은
 * 이 값을 만들지 않고 소비만 한다). r25 이전에는 `brandedTypes.ts`가
 * 두 생성자를 공개 export해서 안전하게 정적 import할 수 있었다. r25로
 * 생성자가 `cornerPipeline.ts`(`validateCornerContent`)·
 * `coeffLookup.ts`(`buildCoeffBundle`)로 옮겨가면서, 그 두 파일도
 * `.ts` 확장자 import를 갖게 됐다(`brandedTypes.ts`를 그렇게 가져온다).
 * 그래서 이 픽스처들도 `coeffLookup.test.ts`/`cornerPipeline.test.ts`와
 * 같은 이유로 `require(경로변수)`를 쓴다.
 */

// 픽스처 값이 실제로 `ValidatedContent<T>`/`CoeffBundle`(브랜드 타입,
// 위에서 `import type`)을 갖도록 선언한다 — 그래야 아래에서
// `saveCornerSuccess({ content: validated.content, coeffBundle, ... })`가
// 그 함수의 실제 시그니처(`ValidatedContent<T>`/`CoeffBundle` 요구)와
// 컴파일 시점에 맞는다. 런타임 함수 자체는 `cornerPipeline.ts`/
// `coeffLookup.ts`가 정확히 한 번 캐스트해 만든 진짜 브랜드 값을
// 돌려준다 — 이 타입 선언은 그 사실을 이 파일 안에서 다시 진술할
// 뿐이다(구조적으로 재선언하지 않고 실제 브랜드 타입을 그대로 쓴다).
type FixtureValidateResult<T> =
  | { readonly ok: true; readonly content: ValidatedContent<T> }
  | { readonly ok: false; readonly reason: 'schema_invalid' | 'forbidden_content'; readonly detail: string }

const cornerPipelineModulePath = '../../supabase/functions/_shared/cornerPipeline'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateCornerContent } = require(cornerPipelineModulePath) as {
  validateCornerContent: <T>(raw: unknown, schema: z.ZodType<T>) => FixtureValidateResult<T>
}

const coeffLookupModulePath = '../../supabase/functions/_shared/coeffLookup'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildCoeffBundle } = require(coeffLookupModulePath) as {
  buildCoeffBundle: (raw: Record<string, unknown>) => CoeffBundle
}

interface CornersTableClientShape {
  from(table: 'corners'): {
    update(patch: Record<string, unknown>): {
      eq(column: 'id', value: string): Promise<{ error: { message: string } | null }>
    }
  }
}

interface SaveCornerSuccessInputShape<T> {
  cornerId: string
  engineVersion: string
  content: ValidatedContent<T>
  coeffBundle: CoeffBundle | undefined
  generationAttempts: number
}

interface SaveCornerFailureInputShape {
  cornerId: string
  engineVersion: string
  reason: SkipReason
  detail: string
  generationAttempts: number
}

type SaveCornerSuccessFn = <T extends object>(
  client: CornersTableClientShape,
  input: SaveCornerSuccessInputShape<T>,
) => Promise<void>

type SaveCornerFailureFn = (client: CornersTableClientShape, input: SaveCornerFailureInputShape) => Promise<void>

const saveCornerResultModulePath = '../../supabase/functions/_shared/saveCornerResult'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { saveCornerSuccess, saveCornerFailure } = require(saveCornerResultModulePath) as {
  saveCornerSuccess: SaveCornerSuccessFn
  saveCornerFailure: SaveCornerFailureFn
}

const Schema = z.object({ title: z.string() })

function fakeClient(): CornersTableClientShape & { updates: Array<Record<string, unknown>> } {
  const updates: Array<Record<string, unknown>> = []
  return {
    updates,
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(patch)
          return { error: null }
        },
      }),
    }),
  }
}

function fakeErrorClient(message: string): CornersTableClientShape {
  return {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: { message } }),
      }),
    }),
  }
}

describe('saveCornerSuccess — 검증된 값만 받는다(타입 층)', () => {
  it('ValidatedContent<T>를 받아 status=ready로 갱신하고 coeffVersion을 content에 함께 기록한다', async () => {
    const validated = validateCornerContent({ title: 'x' }, Schema)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return

    const coeffBundle = buildCoeffBundle({ version: '1.0.0' })
    const client = fakeClient()

    await saveCornerSuccess(client, {
      cornerId: 'corner-1',
      engineVersion: 'pipeline-v1',
      content: validated.content,
      coeffBundle,
      generationAttempts: 1,
    })

    expect(client.updates).toHaveLength(1)
    const patch = client.updates[0]
    expect(patch.status).toBe('ready')
    expect(patch.engine_version).toBe('pipeline-v1')
    expect(patch.generation_attempts).toBe(1)
    expect(patch.skip_reason).toBeNull()
    expect(patch.last_error).toBeNull()
    expect((patch.content as Record<string, unknown>).title).toBe('x')
    expect((patch.content as Record<string, unknown>).coeffVersion).toBe('1.0.0')
  })

  it('coeffBundle이 없으면 content에 coeffVersion을 기록하지 않는다(계수를 쓰지 않는 MVP 3종)', async () => {
    const validated = validateCornerContent({ title: 'y' }, Schema)
    if (!validated.ok) throw new Error('unreachable')
    const client = fakeClient()

    await saveCornerSuccess(client, {
      cornerId: 'corner-2',
      engineVersion: 'v1',
      content: validated.content,
      coeffBundle: undefined,
      generationAttempts: 1,
    })

    const patch = client.updates[0]
    expect((patch.content as Record<string, unknown>).coeffVersion).toBeUndefined()
  })

  it('DB 오류면 던진다', async () => {
    const validated = validateCornerContent({ title: 'z' }, Schema)
    if (!validated.ok) throw new Error('unreachable')
    const client = fakeErrorClient('conflict')

    await expect(
      saveCornerSuccess(client, {
        cornerId: 'corner-3',
        engineVersion: 'v1',
        content: validated.content,
        coeffBundle: undefined,
        generationAttempts: 1,
      }),
    ).rejects.toThrow(/conflict/)
  })
})

describe('saveCornerFailure — 실패 사유도 저장한다(Part 3-7-B "부재 사실과 사유는 저장한다")', () => {
  it('insufficient_input → status=skipped', async () => {
    const client = fakeClient()
    await saveCornerFailure(client, {
      cornerId: 'c1',
      engineVersion: 'v1',
      reason: 'insufficient_input',
      detail: '재료 부족',
      generationAttempts: 0,
    })
    expect(client.updates[0].status).toBe('skipped')
    expect(client.updates[0].skip_reason).toBe('insufficient_input')
  })

  it.each([
    ['generation_failed'] as const,
    ['schema_invalid'] as const,
    ['forbidden_content'] as const,
  ])('%s → status=failed', async (reason) => {
    const client = fakeClient()
    await saveCornerFailure(client, {
      cornerId: 'c2',
      engineVersion: 'v1',
      reason,
      detail: 'detail',
      generationAttempts: 3,
    })
    expect(client.updates[0].status).toBe('failed')
    expect(client.updates[0].skip_reason).toBe(reason)
  })

  it('DB 오류면 던진다', async () => {
    const client = fakeErrorClient('timeout')
    await expect(
      saveCornerFailure(client, {
        cornerId: 'c3',
        engineVersion: 'v1',
        reason: 'generation_failed',
        detail: 'x',
        generationAttempts: 3,
      }),
    ).rejects.toThrow(/timeout/)
  })
})

describe('타입 층 강제 — 완료 기준 "저장 함수는 ValidatedContent<T>만 받는다"/"SkipReason 밖의 값은 저장 함수에 못 들어간다"', () => {
  it('검증을 건너뛴 평범한 객체는 saveCornerSuccess에 컴파일되지 않는다', async () => {
    const client = fakeClient()
    const unvalidated = { title: '검증 안 됨' }
    await saveCornerSuccess(client, {
      cornerId: 'x',
      engineVersion: 'v1',
      // @ts-expect-error content는 ValidatedContent<T>만 받는다 — 평범한 객체는 막힌다(Part 17-0-2).
      content: unvalidated,
      coeffBundle: undefined,
      generationAttempts: 1,
    })
    // 컴파일이 막혔다는 사실 자체가 이 테스트의 목적이다. 런타임에서는
    // 캐스트 없이 통과했다는 뜻이므로 실제로 저장은 일어난다 — 확인만.
    expect(client.updates).toHaveLength(1)
  })

  it("4값 밖의 문자열은 saveCornerFailure의 reason에 컴파일되지 않는다", async () => {
    const client = fakeClient()
    await saveCornerFailure(client, {
      cornerId: 'x',
      engineVersion: 'v1',
      // @ts-expect-error 'validation_failed'는 SkipReason 4값이 아니다.
      reason: 'validation_failed',
      detail: 'd',
      generationAttempts: 1,
    })
    expect(client.updates).toHaveLength(1)
  })
})

describe('결정론 — 동일 입력 100회 반복 → 100회 동일 결과(패치 내용 기준)', () => {
  it('같은 입력으로 100회 저장해도 patch 내용이 항상 같다', async () => {
    const validated = validateCornerContent({ title: 'stable' }, Schema)
    if (!validated.ok) throw new Error('unreachable')
    const coeffBundle = buildCoeffBundle({ version: '1.0.0' })

    let firstPatchJson = ''
    for (let i = 0; i < 100; i++) {
      const client = fakeClient()
      await saveCornerSuccess(client, {
        cornerId: 'stable-id',
        engineVersion: 'v1',
        content: validated.content,
        coeffBundle,
        generationAttempts: 1,
      })
      const json = JSON.stringify(client.updates[0])
      if (i === 0) firstPatchJson = json
      expect(json).toBe(firstPatchJson)
    }
  })
})
