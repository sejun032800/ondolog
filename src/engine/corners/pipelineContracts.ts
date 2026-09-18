/**
 * 코너 생성 파이프라인 — 실패 사유 4값과 저장 상태 매핑
 * (docs/ONDOLOG_MASTER.md Part 17-0-5, 17-0-5-A, 17-0-5-B).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 *
 * ── 왜 별도 파일인가 ──────────────────────────────────────────────────
 * `SkipReason`은 브랜드 타입(`ValidatedContent`/`CoeffBundle`)이 아니다
 * — 캐스트로 만드는 값이 아니라 그냥 문자열 리터럴 유니온이므로
 * `brandedTypes.ts`(정적 규칙 E의 대상)에 넣을 이유가 없다. 저장
 * 함수(`supabase/functions/_shared/saveCornerResult.ts`)와 파이프라인
 * 골격(`supabase/functions/_shared/cornerPipeline.ts`)이 모두 이 타입을
 * 참조하므로 `src/engine/corners/`에 두어 두 런타임(Deno/React
 * Native)이 공유한다 — `brandedTypes.ts`와 같은 배치 원칙
 * (Part 17-0-3-A "엔진 쪽에 두고 Edge Function이 가져다 쓴다").
 *
 * ── 4값을 유니온으로 강제하는 이유 ────────────────────────────────────
 * `corners.skip_reason`은 DB에서 자유 텍스트다(`CHECK` 제약은 마이그
 * 레이션이라 폰 복귀 후로 미뤄짐, Part 17-0-5-B). 저장 함수의 파라미터
 * 타입을 이 유니온으로 제한하면, DB가 막지 못하는 것을 컴파일 시점에
 * 대신 막는다.
 */

/**
 * 코너 생성 실패(또는 스킵) 사유 4값. Part 17-0-5가 정한 이름 그대로다
 * — 이름을 바꾸거나 합치지 않는다. 특히 `forbidden_content`를
 * `schema_invalid`와 분리한 것은 "`FORBIDDEN_KEYS` 위반율이 원칙 ①
 * 준수를 재는 유일한 지표"이기 때문이다(같은 절, r17).
 */
export type SkipReason =
  | 'insufficient_input'
  | 'generation_failed'
  | 'schema_invalid'
  | 'forbidden_content'

/**
 * `corners.status`로 매핑되는 두 값(Part 17-0-5-B). 나머지 enum 값
 * (`pending`/`generating`/`ready`/`published`)은 이 파이프라인이 직접
 * 쓰지 않는다 — `ready`/`published`는 성공 시 컬러 함수가 아니라
 * 호출부(발행 판정, Phase 8)가 다루는 상태다.
 */
export type CornerPersistStatus = 'skipped' | 'failed'

/**
 * Part 17-0-5-B 저장 매핑 표를 그대로 구현한다.
 * `insufficient_input` → `skipped`(정상 동작 — 재료가 없으면 만들지
 * 않는 것이 원칙 ②), 나머지 셋 → `failed`(운영 지표로 센다).
 */
export function statusForSkipReason(reason: SkipReason): CornerPersistStatus {
  return reason === 'insufficient_input' ? 'skipped' : 'failed'
}

/**
 * Part 17-0-5-A 재시도 정책 — 사유별로 파이프라인이 재시도를
 * "결정"하는지 여부. `generation_failed`는 표에는 "최대 2회, 지수
 * 백오프"로 나오지만 그 재시도는 17-0-5-C에 따라 `llmClient.ts`가
 * 예산 안에서 이미 수행한다 — 파이프라인이 이 사유를 보고 추가로
 * 재호출을 결정하지는 않는다(층이 섞이지 않는다). 그래서
 * `pipelineRetriesOnFailure`는 파이프라인 계층의 결정 여부만 표시한다.
 */
export const SKIP_REASON_RETRY_POLICY: Readonly<
  Record<SkipReason, { readonly pipelineRetriesOnFailure: boolean; readonly maxPipelineRetries: number }>
> = {
  insufficient_input: { pipelineRetriesOnFailure: false, maxPipelineRetries: 0 },
  generation_failed: { pipelineRetriesOnFailure: false, maxPipelineRetries: 0 },
  schema_invalid: { pipelineRetriesOnFailure: true, maxPipelineRetries: 1 },
  forbidden_content: { pipelineRetriesOnFailure: false, maxPipelineRetries: 0 },
}
