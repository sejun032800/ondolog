/**
 * 운영자 경로가 저장소(DB·Storage)에 요구하는 최소 인터페이스 (위임: 54-corner-pipeline-operator-path.md).
 *
 * 실제 구현은 `supabaseOps.ts`(service_role, Deno로 실행)이고, 시험은 `opsMemoryStore.ts`의 메모리 구현을 쓴다.
 * 로직(`generateIssue.ts`·`publishIssue.ts`·`mediaCopy.ts`)은 이 인터페이스만 안다 - supabase-js·Deno를 import하지 않으므로
 * jest에서 그대로 돈다.
 */

import type { InputAssemblyClient } from '../../supabase/functions/_shared/inputAssembly.ts'
import type { CornersTableClient } from '../../supabase/functions/_shared/saveCornerResult.ts'

export type IssueType = 'daily' | 'weekly' | 'monthly'

export interface IssueRow {
  readonly id: string
  readonly couple_id: string
  readonly issue_type: IssueType
  /** `YYYY-MM-DD` */
  readonly period_start: string
  /** `YYYY-MM-DD`(포함) */
  readonly period_end: string
  readonly issue_number: number | null
  readonly is_trial: boolean
  readonly published_at: string | null
  readonly theme: string | null
  readonly publish_mode: string
  /** 렌더 결과 세 필드(MASTER 9-5, R23-3) - 하나라도 비면 렌더되지 않은 호다. */
  readonly pdf_digital_path: string | null
  readonly page_count: number | null
  readonly cover_path: string | null
}

export interface CornerRow {
  readonly id: string
  readonly couple_id: string
  readonly issue_id: string
  readonly corner_type: string
  readonly seq: number | null
  readonly status: string
  readonly skip_reason: string | null
  readonly last_error: string | null
  readonly generation_attempts: number
  readonly engine_version: string | null
  readonly content: unknown
  readonly source_date_ids: readonly string[]
}

export interface AlertRow {
  readonly id: string
  readonly kind: 'couple_membership' | 'usage_over'
  readonly couple_id: string | null
  readonly issue_id: string | null
  readonly detail: Readonly<Record<string, unknown>>
  readonly resolved_at: string | null
}

export interface CoupleInfo {
  readonly id: string
  readonly status: string
  readonly nickname: string | null
  readonly members: readonly { readonly id: string; readonly ai_usage_agreed_at: string | null }[]
}

export interface NewIssue {
  readonly couple_id: string
  readonly issue_type: IssueType
  readonly period_start: string
  readonly period_end: string
  readonly publish_mode: 'compressed'
}

export interface NewCorner {
  readonly couple_id: string
  readonly issue_id: string
  readonly corner_type: string
  readonly seq: number
  readonly period_start: string
  readonly period_end: string
}

export interface NewAlert {
  readonly kind: 'couple_membership' | 'usage_over'
  readonly couple_id: string
  readonly issue_id: string
  readonly detail: Readonly<Record<string, unknown>>
}

export interface OpsStore {
  /** 입력 조립이 읽는 클라이언트(service_role, 조회만). */
  readonly assemblyClient: InputAssemblyClient
  /** 기존 저장 함수(`saveCornerResult.ts`)가 쓰는 클라이언트. */
  readonly cornersTable: CornersTableClient

  getCouple(coupleId: string): Promise<CoupleInfo | null>
  getIssue(issueId: string): Promise<IssueRow | null>
  findIssue(q: { coupleId: string; issueType: IssueType; periodStart: string }): Promise<IssueRow | null>
  insertIssue(row: NewIssue): Promise<IssueRow>
  listCorners(issueId: string): Promise<readonly CornerRow[]>
  insertCorner(row: NewCorner): Promise<CornerRow>
  /** 열린(`resolved_at is null`) 경보. */
  openAlerts(issueId: string): Promise<readonly AlertRow[]>
  insertAlert(row: NewAlert): Promise<AlertRow>
  /** 17-0-10-E: `fn_publish_issue`가 읽는 "실린 데이트" - 17-1 코너의 `source_date_ids`. */
  setCornerSourceDates(cornerId: string, dateIds: readonly string[]): Promise<void>
  /**
   * 발행 가드 ②(R23-3): 그 호의 렌더 세 필드를 비운다. 코너가 다시 생성되거나 `pending`으로 돌아갈 때마다 부른다 -
   * 낡은 렌더가 새 content와 함께 발행되지 않게 한다. 발행된 호는 건드리지 않는다.
   */
  clearRender(issueId: string): Promise<void>
  /** 17-0-10-D: 원본이 사라진 코너를 `pending`으로 되돌린다(`last_error = 'source_media_missing'`). 실패 사유 4값은 늘리지 않는다. */
  resetCornerPending(cornerId: string, lastError: string): Promise<void>
  /** 사진 항목 ID -> 원본 `storage_path`. 소속 커플의 지워지지 않은 항목만 돌려준다. */
  entrySourcePaths(coupleId: string, entryIds: readonly string[]): Promise<ReadonlyMap<string, string>>
  /** `fn_publish_issue` 한 번(17-0-10-E). 예외는 그대로 던진다. */
  callPublish(issueId: string): Promise<void>
}

export interface MediaStore {
  exists(bucket: string, path: string): Promise<boolean>
  /** 버킷 사이 복사. 목적지가 이미 있으면 호출하지 않는다(멱등은 호출부가 보장). */
  copy(fromBucket: string, fromPath: string, toBucket: string, toPath: string): Promise<void>
}
