/// <reference types="jest" />
import { z } from 'zod'
import type { ValidatedContent, CoeffBundle } from '../../../src/engine/corners/brandedTypes'
import type { SkipReason } from '../../../src/engine/corners/pipelineContracts'

/**
 * `saveCornerResult.ts` — 저장 함수는 `ValidatedContent<T>`만 받는다
 * (Part 17-0-2), 실패 사유도 저장한다(Part 3-7-B, 17-0-5-B).
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 5부
 * + .claude/state/prompts/phase-7/21-engine-dev-brand-constructors.md (r25)
 * + .claude/state/prompts/phase-7/33-corner-pipeline-skeleton-behavior.md (r40).
 *
 * 이 파일은 대상과 같은 트리에 있고 `.ts` 확장자 정적 import로 대상을 가져온다.
 * 루트 tsc는 `exclude`로 이 파일을 보지 않고, 전용 tsconfig가 타입 검사한다
 * (`__tests__/build/edgeFunctionsTypecheck.test.ts`).
 *
 * ── 픽스처는 정식 경로로만 만든다 (r40) ───────────────────────────────────
 * 저장 함수에 넘길 `ValidatedContent<T>`·`CoeffBundle`은 이 테스트가 만들 수 없다 —
 * 브랜드를 붙이는 함수와 `buildCoeffBundle`은 승인 모듈 안의 비공개 함수다.
 * 그래서 `ValidatedContent`는 `validateCornerResponse`(LLM 응답 문자열 → 17-0-4의
 * 순서 전체), `CoeffBundle`은 `lookupCoeffBundle`(`AppConfigQueryClient` 가짜 → 조회)
 * 로만 얻는다. 이 파일에는 브랜드 캐스트도, `buildCoeffBundle` 호출도 없다.
 */

import {
  validateCornerResponse,
  type CornerContext,
  NO_ID_REFERENCES,
  type CornerResponseSpec,
  type ScopedRecord,
} from './cornerPipeline.ts'
import { lookupCoeffBundle, type AppConfigQueryClient } from './coeffLookup.ts'

const CONTEXT: CornerContext = {
  coupleId: 'couple-a',
  period: { start: new Date('2026-10-01T00:00:00.000Z'), end: new Date('2026-11-01T00:00:00.000Z') },
  cadence: 'monthly',
}

const NO_REFERENCE_RECORDS: readonly ScopedRecord[] = []

/** 4~6단계가 비어 있는 합성 스펙 — 픽스처를 정식 경로로 만들기 위한 것. */
function passThroughSpec<T>(schema: z.ZodType<T>): CornerResponseSpec<T, T> {
  return {
    llmSchema: schema,
    isExplicitEmpty: () => false,
    references: NO_ID_REFERENCES,
    derive: (filled) => ({ ok: true, value: filled }),
    storedSchema: schema,
  }
}

/** 정식 경로로 `ValidatedContent<{ title: string }>`를 얻는다. */
function validatedFixture(title: string) {
  return validateCornerResponse(JSON.stringify({ title }), passThroughSpec(Schema), CONTEXT, NO_REFERENCE_RECORDS)
}

/** 정식 경로로 `CoeffBundle`을 얻는다 — `app_config` 가짜 → `lookupCoeffBundle`. */
function coeffBundleFixture(version: string) {
  const client: AppConfigQueryClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { key: 'corner_coeffs', value: { version } }, error: null }),
        }),
      }),
    }),
  }
  return lookupCoeffBundle(client, 'corner_coeffs')
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

import { saveCornerSuccess, saveCornerFailure } from './saveCornerResult.ts'

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
    const validated = validatedFixture('x')
    expect(validated.ok).toBe(true)
    if (!validated.ok) return

    const coeffBundle = await coeffBundleFixture('1.0.0')
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
    const validated = validatedFixture('y')
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
    const validated = validatedFixture('z')
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
    const validated = validatedFixture('stable')
    if (!validated.ok) throw new Error('unreachable')
    const coeffBundle = await coeffBundleFixture('1.0.0')

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
