/**
 * 코너 파이프라인 산출물 저장 — `corners` 테이블 갱신
 * (docs/ONDOLOG_MASTER.md Part 17-0-5-B, `ONDOLOG_SCHEMA.md` 9-2).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 *
 * ── 타입 층이 막는 것 ─────────────────────────────────────────────────
 * `saveCornerSuccess`는 `ValidatedContent<T>`만 받는다 — 검증(Zod +
 * `FORBIDDEN_KEYS`)을 건너뛴 값은 호출 자체가 컴파일되지 않는다
 * (17-0-2). `saveCornerFailure`는 `SkipReason` 유니온만 받는다 —
 * `corners.skip_reason`이 DB에서 자유 텍스트라 강제하지 못하는 4값
 * 제한을 여기서 대신한다(17-0-5-B).
 *
 * ── 마이그레이션 없음 ─────────────────────────────────────────────────
 * `corners` 테이블은 필요한 컬럼을 이미 갖추고 있다(`content`·`status`·
 * `skip_reason`·`generation_attempts`·`last_error`·`engine_version`).
 * 이 파일은 그 컬럼만 쓴다 — 새 컬럼을 요구하지 않는다.
 *
 * ── `@supabase/supabase-js` 타입을 직접 import하지 않는 이유 ──────────
 * `coeffLookup.ts`와 같은 이유(그 파일 docblock 참조) — 필요한 메서드
 * 체인만 담은 최소 구조 타입을 이 파일 안에서 정의한다.
 */

import type { ValidatedContent, CoeffBundle } from '../../../src/engine/corners/brandedTypes.ts'
import type { SkipReason } from '../../../src/engine/corners/pipelineContracts.ts'
import { statusForSkipReason } from '../../../src/engine/corners/pipelineContracts.ts'

/**
 * `corners` 테이블 갱신에 필요한 최소 메서드만 담은 구조 타입. 실제
 * `SupabaseClient`는 구조적으로 이 타입을 만족한다.
 */
export interface CornersTableClient {
  from(table: 'corners'): {
    update(patch: Record<string, unknown>): {
      eq(column: 'id', value: string): Promise<{ error: { message: string } | null }>
    }
  }
}

interface SaveCornerBase {
  readonly cornerId: string
  readonly engineVersion: string
}

export interface SaveCornerSuccessInput<T> extends SaveCornerBase {
  readonly content: ValidatedContent<T>
  readonly coeffBundle: CoeffBundle | undefined
  readonly generationAttempts: number
}

export interface SaveCornerFailureInput extends SaveCornerBase {
  readonly reason: SkipReason
  readonly detail: string
  readonly generationAttempts: number
}

/**
 * 검증을 통과한 산출물을 저장한다. `status='ready'`, `content`에
 * `coeffVersion`을 함께 기록한다(계수를 쓰지 않는 코너는 `coeffBundle`이
 * `undefined`라 `coeffVersion`도 기록하지 않는다 — 17-0-5-B는
 * "계수를 쓰는 코너"에 한정된 요건이다).
 *
 * **발행 판정은 이 함수의 책임이 아니다** — `status='ready'`까지만
 * 쓴다. `published`로의 전이는 Phase 8(발행 로직)의 몫이다(17-0-6).
 */
export async function saveCornerSuccess<T extends object>(
  client: CornersTableClient,
  input: SaveCornerSuccessInput<T>,
): Promise<void> {
  const content: Record<string, unknown> = { ...input.content }
  if (input.coeffBundle !== undefined) {
    content.coeffVersion = input.coeffBundle.version
  }

  const { error } = await client
    .from('corners')
    .update({
      status: 'ready',
      content,
      generation_attempts: input.generationAttempts,
      last_error: null,
      skip_reason: null,
      engine_version: input.engineVersion,
    })
    .eq('id', input.cornerId)

  if (error) {
    throw new Error(`saveCornerSuccess: corners 갱신 실패 (id=${input.cornerId}): ${error.message}`)
  }
}

/**
 * 실패(또는 스킵)를 저장한다. **토글이 "숨김"이어도 부재 사실과 사유는
 * 저장한다**(Part 3-7-B) — 이 함수는 표시 여부를 모르고, 그냥 사실을
 * 기록한다. `status`는 `statusForSkipReason`이 4값을 두 상태로 매핑한
 * 결과를 그대로 쓴다(17-0-5-B).
 */
export async function saveCornerFailure(
  client: CornersTableClient,
  input: SaveCornerFailureInput,
): Promise<void> {
  const { error } = await client
    .from('corners')
    .update({
      status: statusForSkipReason(input.reason),
      skip_reason: input.reason,
      last_error: input.detail,
      generation_attempts: input.generationAttempts,
      engine_version: input.engineVersion,
    })
    .eq('id', input.cornerId)

  if (error) {
    throw new Error(`saveCornerFailure: corners 갱신 실패 (id=${input.cornerId}): ${error.message}`)
  }
}
