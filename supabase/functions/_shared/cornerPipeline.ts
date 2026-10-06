/**
 * 코너 생성 파이프라인 골격 — 코너 3종(#14)이 공유하는 공통 경로
 * (docs/ONDOLOG_MASTER.md Part 17-0-4, 17-0-4-B, 17-0-5, 17-0-5-A, 17-0-5-C).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 * + .claude/state/prompts/phase-7/21-engine-dev-brand-constructors.md
 * (r25 — 브랜드 생성자를 `brandedTypes.ts`에서 이 파일로 이전)
 * + .claude/state/prompts/phase-7/33-corner-pipeline-skeleton-behavior.md
 * (r38·r40 — 검사 순서, 호출 전 소속 단언, 생성자 비공개).
 * + .claude/state/prompts/phase-7/35-corner-pipeline-declarative-ids.md
 * (r43 — ID 해석·원문 채우기는 코너가 넘기는 선언(`ReferenceMapping`)을 골격이 처리한다).
 *
 * ── 이 파일이 만들지 않는 것 ──────────────────────────────────────────
 * 코너별 선행 검사 조건·프롬프트 생성 함수·Zod 스키마·4~6단계 훅(명시적 빈
 * 결과·ID 해석·원문 채우기)은 전부 호출부가 `CornerPipelineParams`로
 * 주입한다(코너 3종 단계가 채운다). 이 파일은 그것들을 "어떤 순서로, 어떤
 * 실패 사유로" 엮을지만 정한다.
 *
 * ── 순서 (Part 17-0-4, 17-0-4-B, 17-0-5) ──────────────────────────────
 * ⓪ 소속 단언      → 맥락 값이 틀렸거나 입력 레코드가 맥락의 커플·기간 밖이면
 *                     `CoupleMembershipError`로 멈춘다(실패 사유 기록 없음, 삼키지 않음)
 * ① 선행 검사      → 미달이면 insufficient_input, LLM 호출하지 않음
 * ② 계수 조회      → CoeffBundle (코너가 계수를 쓰지 않으면 생략)
 * ③ LLM 호출       → 실패 시 generation_failed
 * ④ `validateCornerResponse` (17-0-4의 순서 전체)
 *      JSON.parse → FORBIDDEN_KEYS(원본 객체, 중첩 재귀) → Zod → 명시적 빈 결과
 *      → ID 해석 → 원문 채우기 → 저장 스키마 → 브랜드
 * ⑤ ValidatedContent 반환 → 저장(호출부가 `saveCornerResult.ts`로)
 *
 * ── r40: `ValidatedContent`는 정식 경로로만 만들어진다 ──────────────────
 * 이 파일이 공개하는 생성 경로는 `validateCornerResponse` 하나뿐이다. 브랜드를
 * 붙이는 함수(`brandValidated`)는 비공개이고, `as ValidatedContent<T>` 캐스트는
 * 그 안 한 곳뿐이다. 정적 규칙 E의 승인 모듈 목록
 * (`cornerPipelineStaticRules.test.ts`의 `APPROVED_BRAND_CONSTRUCTOR_MODULES`)에
 * 이 파일 경로가 있고, 규칙 E는 승인 모듈 안에서 캐스트를 품은 함수가
 * `export`되면 걸린다. 검사를 건너뛰고 브랜드를 붙이는 공개 함수는 없다
 * (옛 `validateCornerContent`는 제거됐다).
 *
 * ── 재시도 책임 분리 (Part 17-0-5-C, 층이 섞이지 않는다) ───────────────
 * `llmClient.call()` 한 번은 "생성 시도 1사이클"이다 — 전송 오류가 나면
 * `llmClient` 자신이 예산 안에서 지수 백오프로 재시도하고, 그래도
 * 실패하면 `generation_failed`를 돌려준다. **이 파이프라인은
 * `generation_failed`를 보고 추가로 `llmClient.call()`을 다시 부르지
 * 않는다** — 그 재시도는 이미 `llmClient` 안에서 예산을 다 쓴 뒤의
 * 결과이기 때문이다. 이 파이프라인이 스스로 재호출을 "결정"하는 사유는
 * `schema_invalid` 하나뿐이다(최대 1회, `SKIP_REASON_RETRY_POLICY`).
 * `forbidden_content`는 재시도하지 않는다 — 같은 프롬프트면 같은
 * 판정이 다시 나온다(Part 17-0-5-A). 호출 후의 `insufficient_input`(LLM이
 * 명시적으로 빈 결과를 낸 경우)도 정책표대로 재시도하지 않는다.
 *
 * ── 계수 조회 실패는 이 4값에 없다 (명시적 한계) ──────────────────────
 * `lookupCoeffBundle`이 던지면 그대로 전파한다(catch하지 않는다). Part
 * 17-0-5의 4값 중 계수 조회 실패를 가리키는 값이 없다 — `coeffLookup.ts`
 * docblock에 같은 이유를 적어 두었다. MVP 3종은 계수를 쓰지 않아
 * (`lookupCoeffBundle`을 주입하지 않으면 ②는 통째로 생략된다) 지금은
 * 이 경로가 실전에서 실행되지 않는다.
 */

import type { ZodType } from 'zod'
import type { ValidatedContent, CoeffBundle } from '../../../src/engine/corners/brandedTypes.ts'
import { findForbiddenKeys } from '../../../src/engine/corners/forbiddenKeys.ts'
import type { SkipReason } from '../../../src/engine/corners/pipelineContracts.ts'
import { SKIP_REASON_RETRY_POLICY } from '../../../src/engine/corners/pipelineContracts.ts'
import type { LlmClient } from './llmClient.ts'

/**
 * 코너 맥락의 기간 — `[start, end)`, 끝 배타(17-0-7 공통 "기간 경계"). 17-5처럼 재료가
 * 적어 기간을 넓히는 코너는 호출부가 넓힌 기간을 여기 넘긴다(17-0-4-A). 호 기간이 아니라
 * 이 값이 기준이다.
 */
export interface CornerPeriod {
  readonly start: Date
  readonly end: Date
}

/**
 * 호출자 맥락 — 커플 식별자와 기간은 **호출부가 corners/issues 행에서** 넘긴다. 입력
 * 레코드에서 읽지 않는다(입력이 오염됐다면 입력 안의 식별자도 믿을 수 없다, 17-0-4-B).
 * 두 값은 비어 있거나 틀리면 단언이 실패한다(r42, `assertCornerContextValues`).
 */
export interface CornerContext {
  readonly coupleId: string
  readonly period: CornerPeriod
}

/**
 * 입력 레코드가 반드시 싣는 필드(17-0-4-B): ID·시각·재소환 표시(+ 소속) + ID 해석용 종류·원문.
 * 소속은 `coupleId`로 읽는다. `recalled`는 입력 조립이 붙이는 표시로, 없으면 재소환이 아니다.
 *
 * `kind`는 이 레코드가 어떤 종류의 ID로 참조되는가(`IdFieldDeclaration.kind`와 같은 값, `RecordKind`)이고,
 * `source`는 입력 조립이 DB에서 가져온 원문 필드들이다. 골격이 선언된 이름으로 그대로 복사한다
 * (17-0-4-A).
 */
export interface ScopedRecord {
  readonly id: string
  readonly coupleId: string
  readonly occurredAt: Date
  readonly recalled?: boolean
  readonly kind: RecordKind
  readonly source: Readonly<Record<string, unknown>>
}

/**
 * 레코드 종류 — `'message'`·`'photo'`·`'date'` 유니온(MASTER 17-0-4 r44). 오타는 컴파일러가 잡는다.
 * 새 종류는 문서가 정한 뒤에 여기에 더한다.
 */
export type RecordKind = 'message' | 'photo' | 'date'

/** 기간·커플 판정에 필요한 필드만 - `isRecordInPeriod`·`resolveRecordReferences`가 받는 모양. */
type JudgedRecord = Pick<ScopedRecord, 'id' | 'coupleId' | 'occurredAt' | 'recalled'>

/**
 * **기간 판정 함수 — 이 파일에 정의된 유일한 곳(r42).** 호출 전 소속 단언(입력 쪽,
 * `assertRecordsBelongToCouple`)과 ID 해석(응답 쪽, `resolveRecordReferences`)이 둘 다 이
 * 함수를 부른다. 같은 규칙을 두 곳에 따로 짜지 않는다.
 *
 * - 일반 레코드: `start <= occurredAt < end` (끝 배타, 시작 포함 — 17-0-7)
 * - `recalled: true` 레코드(17-1 재소환): **기간 이전** — `occurredAt < start`
 * - 레코드 시각이 날짜가 아니면(비교가 성립하지 않으면) 통과시키지 않는다.
 *
 * 커플 조건은 이 함수의 일이 아니다. 재소환 표시는 이 함수의 결과만 바꾸며 커플 조건을
 * 풀지 못한다(호출하는 쪽이 커플 조건을 따로 항상 건다).
 */
export function isRecordInPeriod(
  record: Pick<JudgedRecord, 'occurredAt' | 'recalled'>,
  period: CornerPeriod,
): boolean {
  const t = record.occurredAt.getTime()
  const start = period.start.getTime()
  const end = period.end.getTime()
  if (Number.isNaN(t) || Number.isNaN(start) || Number.isNaN(end)) return false
  if (record.recalled === true) return t < start
  return t >= start && t < end
}

/**
 * 호출 전 소속 단언 실패 (17-0-4-B). 실패 사유 4값이 아니다 — 결과가 아니라
 * 입력 조립의 버그이기 때문이다. 파이프라인은 이 오류를 잡지 않고 위로 던진다.
 * 그 커플의 그 호 생성 전체를 멈추는 것은 호출자의 일이다.
 */
export class CoupleMembershipError extends Error {
  readonly expectedCoupleId: string
  readonly offendingRecordIds: readonly string[]

  constructor(expectedCoupleId: string, offendingRecordIds: readonly string[], message?: string) {
    super(
      message ??
        `코너 입력에 호출자 맥락의 커플·기간 밖인 레코드가 있다 (coupleId=${expectedCoupleId}, 레코드 ${offendingRecordIds.length}건: ${offendingRecordIds.join(', ')})`,
    )
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'CoupleMembershipError'
    this.expectedCoupleId = expectedCoupleId
    this.offendingRecordIds = offendingRecordIds
  }
}

/**
 * 맥락 값 자체가 틀렸다(r42) — 빈 커플 식별자, 날짜가 아닌 기간, 뒤집힌 기간. 판정 기준이
 * 없으면 판정할 수 없고, 그때 통과시키면 모든 레코드가 걸러지지 않은 채 나간다. 소속 단언과
 * 같은 방식으로 멈춘다(`CoupleMembershipError`의 하위 — 같은 곳에서 잡힌다).
 */
export class InvalidCornerContextError extends CoupleMembershipError {
  constructor(expectedCoupleId: string, reason: string) {
    super(expectedCoupleId, [], `코너 맥락 값이 올바르지 않다: ${reason}`)
    this.name = 'InvalidCornerContextError'
  }
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function assertCornerContextValues(context: CornerContext): void {
  if (context.coupleId.length === 0) {
    throw new InvalidCornerContextError(context.coupleId, '커플 식별자가 빈 문자열')
  }
  const { start, end } = context.period
  if (!isValidDate(start) || !isValidDate(end)) {
    throw new InvalidCornerContextError(context.coupleId, '기간의 시작·끝이 날짜가 아님')
  }
  if (start.getTime() > end.getTime()) {
    throw new InvalidCornerContextError(context.coupleId, '기간의 시작이 끝보다 늦음')
  }
}

/** 호출 전 단언 — 커플과 기간을 함께 본다(r42). 기간 판정은 `isRecordInPeriod`. */
function assertRecordsBelongToCouple(records: readonly ScopedRecord[], context: CornerContext): void {
  assertCornerContextValues(context)
  const offending = records
    .filter((r) => r.coupleId !== context.coupleId || !isRecordInPeriod(r, context.period))
    .map((r) => r.id)
  if (offending.length > 0) {
    throw new CoupleMembershipError(context.coupleId, offending)
  }
}

/**
 * ID 해석(응답 쪽, 17-0-4-A) — 참조한 ID가 이번 입력 레코드에 있고, 그 커플의 것이고,
 * 코너 맥락의 기간 안(재소환은 기간 이전)인지 본다. 기간은 `isRecordInPeriod`를 부른다.
 * **골격이 선언된 ID 필드(`ReferenceMapping`)마다 부른다(r43).** 코너는 이 함수를 부르는 자리도,
 * 대신할 함수를 넘길 자리도 없다 — 코너가 넘기는 것은 매핑뿐이다. **비공개다(r44)** — 공개하면 코너가
 * 스키마의 `refine`이나 `scopedRecords` 안에서 미리 해석해 보는 식으로 판정을 따로 짤 길이 생긴다.
 * 시험은 정식 입구(`validateCornerResponse`, 선언 경로)로 한다.
 */
function resolveRecordReferences(
  ids: readonly string[],
  records: readonly JudgedRecord[],
  context: CornerContext,
): { readonly ok: true } | { readonly ok: false; readonly detail: string } {
  const byId = new Map(records.map((r) => [r.id, r] as const))
  for (const id of ids) {
    const record = byId.get(id)
    if (record === undefined) return { ok: false, detail: `존재하지 않는 ID: ${id}` }
    if (record.coupleId !== context.coupleId) return { ok: false, detail: `다른 커플의 레코드: ${id}` }
    if (!isRecordInPeriod(record, context.period)) return { ok: false, detail: `기간 밖의 레코드: ${id}` }
  }
  return { ok: true }
}

/**
 * `validateCornerResponse`의 실패 결과. 17-0-4 표의 실패 열과 그대로 대응한다.
 * `generation_failed`는 이 함수가 판정하지 않는다(LLM 호출 실패는 `llmClient`와
 * 이 파이프라인의 책임).
 */
export type CornerResponseFailureReason = 'schema_invalid' | 'forbidden_content' | 'insufficient_input'

export type CornerResponseResult<T> =
  | { readonly ok: true; readonly content: ValidatedContent<T> }
  | { readonly ok: false; readonly reason: CornerResponseFailureReason; readonly detail: string }

/**
 * ID 필드 하나의 선언(17-0-4 r43) — "출력의 어느 필드가 어떤 종류의 ID인가"와, 그 레코드의
 * 원문 필드를 어느 이름으로 옮겨 적을지. 판정에 쓸 수 있는 값은 없다.
 *
 * - `path`: LLM 출력 안의 ID 필드 위치. 점으로 잇고 배열은 `[]`를 붙인다(예: `turns[].messageId`).
 *   마지막 칸은 문자열 ID 하나를 가리키는 이름이다(`[]`로 끝나지 않는다). 그 위치의 값이 없으면
 *   (선택 필드) 건너뛰고, 문자열이 아니면 `schema_invalid`다.
 * - `kind`: 그 ID가 가리키는 레코드의 종류(`RecordKind`) — `ScopedRecord.kind`와 같은 값인 레코드에서만 찾는다.
 * - `copy`: `{ 저장 쪽 키: 레코드 source의 필드명 }`. 골격이 ID 필드와 **같은 객체**에 그 키로
 *   원문을 채운다(이미 있으면 덮어쓴다 — 원문이 우선이다, 17-0-4-A). source에 그 필드가 없으면
 *   `schema_invalid`.
 */
export interface IdFieldDeclaration {
  readonly path: string
  readonly kind: RecordKind
  readonly copy: Readonly<Record<string, string>>
}

/**
 * 코너가 ID 해석에 대해 넘기는 유일한 것(r43). 참조할 ID가 없는 코너도 "없다"를 명시한다 —
 * 단계를 빼는 것이 아니라 없음을 답하는 것이다(17-0-4).
 */
export type ReferenceMapping =
  | { readonly kind: 'none' }
  | { readonly kind: 'fields'; readonly fields: readonly [IdFieldDeclaration, ...IdFieldDeclaration[]] }

/** 참조할 ID가 없는 코너가 넘기는 값. */
export const NO_ID_REFERENCES: ReferenceMapping = { kind: 'none' }

/**
 * 17-0-4의 4~6단계에서 코너마다 달라지는 부분. 코너 3종 단계가 채운다 —
 * 이번에는 받는 자리와 순서만 있다. `isExplicitEmpty`만 함수이고, ID 해석·채우기는 선언이다.
 */
export interface CornerResponseSpec<TLlm, TStored> {
  /** 3단계의 Zod 스키마(LLM 출력 스키마). `.strict()`를 쓰지 않는다 — 모르는 키는 Zod가 지운다. */
  readonly llmSchema: ZodType<TLlm>
  /** 4단계 — 명시적 빈 결과(`kind: 'none'` 등)인가. true면 `insufficient_input`. */
  readonly isExplicitEmpty: (llm: TLlm) => boolean
  /**
   * 5·6단계 — ID 해석과 원문 채우기의 **선언**(r43). 함수가 아니라 매핑이다. 존재·커플·기간 판정과
   * 채우기는 골격이 하고, 실패 시 `schema_invalid`다. 참조할 ID가 없는 코너는 `NO_ID_REFERENCES`.
   */
  readonly references: ReferenceMapping
  /** 6단계 — 저장 스키마. 실패 시 `schema_invalid`. 통과해야 브랜드가 붙는다. */
  readonly storedSchema: ZodType<TStored>
}

interface FoundReference {
  readonly declaration: IdFieldDeclaration
  readonly record: ScopedRecord
  /** ID 필드를 품은 객체(채우기 대상) */
  readonly holder: Record<string, unknown>
}

const SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*(\[\])?$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 선언된 경로를 따라 ID 필드를 품은 객체를 모은다. 중간 값이 없으면(선택 필드) 그 갈래는 건너뛰고,
 * 모양이 선언과 다르면(객체여야 하는데 아님, 배열이어야 하는데 아님) 실패다.
 */
function collectHolders(
  root: unknown,
  segments: readonly string[],
  path: string,
): { ok: true; holders: Record<string, unknown>[] } | { ok: false; detail: string } {
  let level: unknown[] = [root]
  for (const segment of segments.slice(0, -1)) {
    const isArray = segment.endsWith('[]')
    const key = isArray ? segment.slice(0, -2) : segment
    const next: unknown[] = []
    for (const node of level) {
      if (!isPlainObject(node)) return { ok: false, detail: `ID 필드 경로가 출력 모양과 다르다: ${path}` }
      const child = node[key]
      if (child === undefined || child === null) continue
      if (isArray) {
        if (!Array.isArray(child)) return { ok: false, detail: `ID 필드 경로가 출력 모양과 다르다: ${path}` }
        next.push(...child)
      } else {
        next.push(child)
      }
    }
    level = next
  }
  const holders: Record<string, unknown>[] = []
  for (const node of level) {
    if (!isPlainObject(node)) return { ok: false, detail: `ID 필드 경로가 출력 모양과 다르다: ${path}` }
    holders.push(node)
  }
  return { ok: true, holders }
}

type SchemaDef = { readonly type?: string; readonly [key: string]: unknown }

function schemaDef(schema: unknown): SchemaDef | undefined {
  if (typeof schema !== 'object' || schema === null) return undefined
  const zod = (schema as { _zod?: { def?: SchemaDef } })._zod
  return zod?.def
}

/** 모양을 바꾸지 않고 감싼 래퍼를 벗겨 안쪽 스키마들을 돌려준다(유니온·교차는 갈래 전부). */
function unwrapSchema(schema: unknown, depth = 0): unknown[] {
  const def = schemaDef(schema)
  if (def === undefined || depth > 32) return []
  switch (def.type) {
    case 'optional':
    case 'nullable':
    case 'nonoptional':
    case 'default':
    case 'prefault':
    case 'readonly':
    case 'catch':
      return unwrapSchema(def.innerType, depth + 1)
    case 'pipe':
      return unwrapSchema(def.in, depth + 1)
    case 'lazy':
      return typeof def.getter === 'function' ? unwrapSchema((def.getter as () => unknown)(), depth + 1) : []
    case 'union':
      return Array.isArray(def.options) ? def.options.flatMap((o) => unwrapSchema(o, depth + 1)) : []
    case 'intersection':
      return [...unwrapSchema(def.left, depth + 1), ...unwrapSchema(def.right, depth + 1)]
    default:
      return [schema]
  }
}

function schemaHasPath(schema: unknown, segments: readonly string[]): boolean {
  if (segments.length === 0) return true
  const [segment, ...rest] = segments
  const isArray = segment.endsWith('[]')
  const key = isArray ? segment.slice(0, -2) : segment
  for (const candidate of unwrapSchema(schema)) {
    const def = schemaDef(candidate)
    if (def?.type !== 'object' || typeof def.shape !== 'object' || def.shape === null) continue
    const field = (def.shape as Record<string, unknown>)[key]
    if (field === undefined) continue
    if (!isArray) {
      if (schemaHasPath(field, rest)) return true
      continue
    }
    for (const arrayCandidate of unwrapSchema(field)) {
      const arrayDef = schemaDef(arrayCandidate)
      if (arrayDef?.type === 'array' && schemaHasPath(arrayDef.element, rest)) return true
    }
  }
  return false
}

/**
 * **`path` 존재 확인(r44)** — 선언된 `path`가 그 코너의 LLM 출력 스키마에 실제로 있는 자리인지를
 * 선언과 스키마만으로 판정한다(실제 응답을 기다리지 않는다). 문자열인 `path`의 오타는 컴파일러가
 * 못 잡으므로, 코너마다 테스트에서 이 함수를 불러 오타를 테스트 실패로 드러낸다.
 *
 * 스키마에 없는 선언의 `path`를 돌려준다 — 빈 배열이면 전부 있다. 경로 문법이 틀린 `path`도 "없는
 * 자리"로 센다(이 함수는 던지지 않는다). `kind: 'none'`은 확인할 것이 없어 빈 배열이다.
 */
export function findMissingReferencePaths(
  llmSchema: ZodType<unknown>,
  mapping: ReferenceMapping,
): readonly string[] {
  if (mapping.kind === 'none') return []
  return mapping.fields
    .map((f) => f.path)
    .filter((path) => {
      const segments = path.split('.')
      if (!segments.every((s) => SEGMENT.test(s)) || segments[segments.length - 1].endsWith('[]')) return true
      return !schemaHasPath(llmSchema, segments)
    })
}

/**
 * 5단계 — 선언된 ID 필드를 전부 찾아 해석한다(r43). 존재·커플·기간 판정은 `resolveRecordReferences`
 * (→ `isRecordInPeriod`) 하나다. 선언 자체가 틀렸으면(경로 문법) 프로그래밍 오류라 던진다.
 */
function resolveDeclaredReferences(
  output: unknown,
  mapping: ReferenceMapping,
  records: readonly ScopedRecord[],
  context: CornerContext,
): { ok: true; found: readonly FoundReference[] } | { ok: false; detail: string } {
  if (mapping.kind === 'none') return { ok: true, found: [] }
  const found: FoundReference[] = []
  for (const declaration of mapping.fields) {
    const segments = declaration.path.split('.')
    if (!segments.every((s) => SEGMENT.test(s)) || segments[segments.length - 1].endsWith('[]')) {
      throw new Error(`ID 필드 경로 문법이 올바르지 않다: ${declaration.path}`)
    }
    const idKey = segments[segments.length - 1]
    const collected = collectHolders(output, segments, declaration.path)
    if (!collected.ok) return collected
    const ofKind = records.filter((r) => r.kind === declaration.kind)
    for (const holder of collected.holders) {
      const id = holder[idKey]
      if (id === undefined || id === null) continue
      if (typeof id !== 'string') return { ok: false, detail: `ID 필드가 문자열이 아니다: ${declaration.path}` }
      const resolved = resolveRecordReferences([id], ofKind, context)
      if (!resolved.ok) return resolved
      const record = ofKind.find((r) => r.id === id)
      if (record === undefined) return { ok: false, detail: `존재하지 않는 ID: ${id}` }
      found.push({ declaration, record, holder })
    }
  }
  return { ok: true, found }
}

/** 6단계 — 해석을 통과한 레코드의 원문을 선언된 이름으로 옮겨 적는다(17-0-4-A). */
function fillDeclaredReferences(
  found: readonly FoundReference[],
): { readonly ok: true } | { readonly ok: false; readonly detail: string } {
  for (const { declaration, record, holder } of found) {
    for (const [destKey, sourceField] of Object.entries(declaration.copy)) {
      const value = record.source[sourceField]
      if (value === undefined) {
        return { ok: false, detail: `레코드 ${record.id}의 원문에 ${sourceField} 필드가 없다` }
      }
      holder[destKey] = value
    }
  }
  return { ok: true }
}

/** 브랜드를 붙이는 유일한 곳 — 비공개(r40). 검증을 모두 마친 값만 여기로 온다. */
function brandValidated<T>(value: T): ValidatedContent<T> {
  return value as ValidatedContent<T>
}

/**
 * LLM 응답 문자열을 17-0-4의 순서 전체로 검증해 `ValidatedContent<TStored>`를
 * 만드는 **유일한 공개 경로**(r38·r40).
 *
 *   1. `JSON.parse`                           → 실패 `schema_invalid`
 *   2. `FORBIDDEN_KEYS` — **원본 객체**에, 중첩까지 재귀 → `forbidden_content`
 *   3. Zod 파싱(LLM 출력 스키마)                → `schema_invalid`
 *   4. 명시적 빈 결과                            → `insufficient_input`
 *   5. ID 해석                                  → `schema_invalid`
 *   6. 원문 채우기 → 저장 스키마 → 브랜드
 *
 * 2가 3보다 앞인 이유: Zod는 스키마에 없는 키를 지운다. LLM이 시키지 않은 판정을
 * 담으려고 스스로 만든 키는 Zod를 거치면 사라져 영원히 걸리지 않는다(r38). 그렇다고
 * `.strict()`로 막으면 모르는 키가 `schema_invalid`로 떨어져 `forbidden_content`와
 * 섞인다 — 금지 목록 밖의 모르는 키는 Zod가 조용히 지우게 둔다.
 */
export function validateCornerResponse<TLlm, TStored>(
  rawText: string,
  spec: CornerResponseSpec<TLlm, TStored>,
  context: CornerContext,
  records: readonly ScopedRecord[],
): CornerResponseResult<TStored> {
  // 1. JSON.parse
  let rawObject: unknown
  try {
    rawObject = JSON.parse(rawText)
  } catch (err) {
    return {
      ok: false,
      reason: 'schema_invalid',
      detail: `LLM 출력이 JSON이 아님: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // 2. FORBIDDEN_KEYS — Zod가 키를 지우기 전의 원본 객체에.
  const violations = findForbiddenKeys(rawObject)
  if (violations.length > 0) {
    return { ok: false, reason: 'forbidden_content', detail: `금지 키 발견: ${violations.join(', ')}` }
  }

  // 3. Zod 파싱
  const parsed = spec.llmSchema.safeParse(rawObject)
  if (!parsed.success) {
    return { ok: false, reason: 'schema_invalid', detail: parsed.error.message }
  }
  const llm = parsed.data

  // 4. 명시적 빈 결과 — Zod 파싱이 성공한 뒤에만 도달한다(파싱 실패와 섞이지 않는다).
  if (spec.isExplicitEmpty(llm)) {
    return { ok: false, reason: 'insufficient_input', detail: 'LLM이 명시적으로 빈 결과를 반환함' }
  }

  // 5. ID 해석 — 선언된 필드마다 존재·커플·기간(`isRecordInPeriod`)을 골격이 판정한다.
  const working: unknown = JSON.parse(JSON.stringify(llm)) // 채우기 대상 복사본 — 파싱 결과는 건드리지 않는다.
  const resolved = resolveDeclaredReferences(working, spec.references, records, context)
  if (!resolved.ok) {
    return { ok: false, reason: 'schema_invalid', detail: resolved.detail }
  }

  // 6. 원문 채우기(골격) → 저장 스키마 → 브랜드
  const filled = fillDeclaredReferences(resolved.found)
  if (!filled.ok) {
    return { ok: false, reason: 'schema_invalid', detail: filled.detail }
  }
  const stored = spec.storedSchema.safeParse(working)
  if (!stored.success) {
    return { ok: false, reason: 'schema_invalid', detail: stored.error.message }
  }

  return { ok: true, content: brandValidated(stored.data) }
}

/**
 * `runCornerPipeline`의 4~6단계 훅. **전부 필수다(r42)** — 기본값(통과형)이 없고, 빠지면
 * 컴파일 오류다. 참조할 ID가 없는 코너도 "ID가 없다"고 답하는 함수를 넘긴다(단계를 빼는 것이
 * 아니라 "없다"고 답하는 것 — 17-0-4). 이 단계의 골격은 LLM 출력 타입과 저장 타입이 같은
 * 경우(`TPayload`)만 다룬다 — 둘이 달라지는 코너 3종의 시그니처는 3단계에서 정한다.
 */
export interface CornerResponseHooks<TPayload> {
  readonly isExplicitEmpty: CornerResponseSpec<TPayload, TPayload>['isExplicitEmpty']
  readonly references: ReferenceMapping
  readonly storedSchema: ZodType<TPayload>
}

export interface CornerPipelineParams<TInput, TPayload> {
  readonly input: TInput
  /**
   * 호출자 맥락. 커플 식별자는 입력이 아니라 호출자에게서 온다(17-0-4-B).
   * 생략할 수 없다 — 생략 가능하면 소속 단언을 건너뛰는 길이 된다.
   */
  readonly context: CornerContext
  /** 입력이 싣고 있는 레코드 전부(소속 단언 대상). 레코드의 커플은 `coupleId`로 읽는다. */
  readonly scopedRecords: (input: TInput) => readonly ScopedRecord[]
  /** 코너별 선행 검사 조건. `#14`가 채운다 — 이 작업은 내용을 만들지 않는다. */
  readonly preconditionCheck: (input: TInput) => boolean
  /** 코너별 프롬프트 생성 함수. `#14`가 채운다. */
  readonly buildPrompt: (input: TInput) => string
  /** 코너별 Zod 스키마. `#14`가 채운다. */
  readonly schema: ZodType<TPayload>
  /** 17-0-4 4~6단계의 코너별 훅. 전부 필수 — 기본값 없음(r42). */
  readonly hooks: CornerResponseHooks<TPayload>
  /** 코너 1건에 묶인 LLM 클라이언트 — 호출부가 `createLlmClient()`로 만들어 넘긴다. */
  readonly llmClient: LlmClient
  /**
   * 계수가 필요한 코너만 넘긴다. 넘기지 않으면 ②는 생략되고
   * `coeffBundle`은 결과에 없다(MVP 3종의 실제 상태).
   */
  readonly lookupCoeffBundle?: () => Promise<CoeffBundle>
}

export interface CornerPipelineSuccess<TPayload> {
  readonly outcome: 'success'
  readonly content: ValidatedContent<TPayload>
  readonly coeffBundle: CoeffBundle | undefined
  /** 이번 실행에서 실제로 이뤄진 `llmClient.call()` 횟수(재시도 포함). */
  readonly llmCallAttempts: number
}

export interface CornerPipelineFailure {
  readonly outcome: 'failure'
  readonly reason: SkipReason
  readonly detail: string
  readonly llmCallAttempts: number
}

export type CornerPipelineResult<TPayload> = CornerPipelineSuccess<TPayload> | CornerPipelineFailure

/**
 * 코너 생성 파이프라인 골격을 한 코너 1건에 대해 실행한다. 코너별
 * 부분(선행 검사·프롬프트·스키마)은 전부 `params`로 주입받는다 — 이
 * 함수 자신은 어떤 코너인지 모른다.
 *
 * 맥락 값이 틀렸거나 입력 레코드가 호출자 맥락의 커플·기간 밖이면 `CoupleMembershipError`(또는 하위 `InvalidCornerContextError`)를 던진다 —
 * LLM은 한 번도 불리지 않고, 실패 사유도 기록되지 않는다.
 */
export async function runCornerPipeline<TInput, TPayload>(
  params: CornerPipelineParams<TInput, TPayload>,
): Promise<CornerPipelineResult<TPayload>> {
  const { input, context, scopedRecords, preconditionCheck, buildPrompt, schema, hooks, llmClient, lookupCoeffBundle } =
    params

  // ⓪ 맥락 값 검증 + 소속(커플·기간) 단언 — 어떤 LLM 호출보다 앞. 오염된 입력이 "재료 부족"으로 가려지지 않도록
  // 선행 검사보다도 먼저 본다. 던진 오류는 잡지 않는다(호 전체 중단은 호출자의 일).
  // `scopedRecords`는 여기서 한 번만 부른다 — 이 결과를 단언과 ID 해석에 같이 쓴다(r44).
  const records = scopedRecords(input)
  assertRecordsBelongToCouple(records, context)

  // ① 선행 검사 — 미달이면 LLM을 호출하지 않는다(비용 없음, 사유는 사실).
  if (!preconditionCheck(input)) {
    return { outcome: 'failure', reason: 'insufficient_input', detail: '선행 검사 미달', llmCallAttempts: 0 }
  }

  // ② 계수 조회 — 코너가 계수를 쓰지 않으면 생략(coeffLookup.ts docblock 참조).
  const coeffBundle = lookupCoeffBundle ? await lookupCoeffBundle() : undefined

  const prompt = buildPrompt(input)

  const spec: CornerResponseSpec<TPayload, TPayload> = {
    llmSchema: schema,
    isExplicitEmpty: hooks.isExplicitEmpty,
    references: hooks.references,
    storedSchema: hooks.storedSchema,
  }

  let llmCallAttempts = 0
  let schemaRetryUsed = false

  for (;;) {
    llmCallAttempts += 1

    // ③ LLM 호출 — 전송 재시도는 llmClient 내부 책임(위 docblock).
    const callResult = await llmClient.call(prompt)
    if (!callResult.ok) {
      // generation_failed — 파이프라인은 이 사유로 추가 재호출을 결정하지 않는다.
      return { outcome: 'failure', reason: 'generation_failed', detail: callResult.detail, llmCallAttempts }
    }

    // ④ JSON.parse → FORBIDDEN_KEYS → Zod → 빈 결과 → ID 해석 → 채우기 → 저장 스키마 → 브랜드.
    const validation = validateCornerResponse(callResult.text, spec, context, records)
    if (validation.ok) {
      // ⑤ ValidatedContent 반환 — 저장은 호출부가 saveCornerResult.ts로 한다.
      return { outcome: 'success', content: validation.content, coeffBundle, llmCallAttempts }
    }

    // 재시도 여부는 사유별 정책표가 정한다(17-0-5-A) — `schema_invalid`만 최대 1회.
    const retryPolicy = SKIP_REASON_RETRY_POLICY[validation.reason]
    if (retryPolicy.pipelineRetriesOnFailure && !schemaRetryUsed) {
      schemaRetryUsed = true
      continue
    }
    return { outcome: 'failure', reason: validation.reason, detail: validation.detail, llmCallAttempts }
  }
}
