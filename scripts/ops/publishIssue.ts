/**
 * 운영자 경로 - 발행 (M2-b). 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * `fn_publish_issue` 한 번(MASTER §17-0-10-E). **정상 흐름에서는 조판(`55-`) 뒤에 부른다** - 이번에는 M2-e 실증에만 쓴다.
 *
 * 함수를 부르기 **전에** 이 명령이 확인한다(SQL 함수는 content 안의 경로를 읽지 않는다):
 *   1. 시험 커플의 호인가(샘플 출력으로 만든 호가 시험 밖으로 나가지 않게).
 *   2. 초안인가(없는 호·이미 발행된 호는 함수도 거부한다).
 *   3. 열린 운영 경보가 없는가 - 안전 정지(R20-2)가 남긴 경보가 있으면 **함수를 부르지 않고** 거부한다.
 *   4. 미디어: 원본이 그 사이 지워졌으면 복제하지 않고 그 코너를 `pending`으로 되돌린 뒤 "다시 준비 중"으로 거부한다(D).
 *      그렇지 않으면 목적지에 전부 있는지 확인한다.
 *   5. (55-1, R23-3) 렌더 세 필드(`pdf_digital_path`·`page_count`·`cover_path`)가 모두 있는가 - 렌더되지 않은 호는 거부한다.
 *      4번이 코너를 `pending`으로 되돌리면 같은 순간 세 필드가 비워지므로(가드 ②, `mediaCopy.ts`), 5번은 4번 뒤의 값을 읽는다.
 * 위 확인은 함수의 검사를 **대신하지 않는다** - 함수도 같은 이유로 스스로 거부한다(예외 5종은 `verifyPublishPath.ts`가 함수를
 * 직접 불러 보인다).
 */

import { copyIssueMedia, findMissingDestinations } from './mediaCopy.ts'
import { OpsStopError, assertTestCouple } from './opsGuards.ts'
import type { IssueRow, MediaStore, OpsStore } from './opsStore.ts'

export interface PublishReport {
  readonly issueId: string
  readonly issue: IssueRow
  readonly media: { readonly copied: number; readonly alreadyPresent: number }
}

/** 렌더 세 필드가 모두 채워졌는가(R23-3). */
export function isRendered(issue: IssueRow): boolean {
  return (
    typeof issue.pdf_digital_path === 'string' &&
    issue.pdf_digital_path.length > 0 &&
    typeof issue.page_count === 'number' &&
    issue.page_count > 0 &&
    typeof issue.cover_path === 'string' &&
    issue.cover_path.length > 0
  )
}

export async function publishIssue(
  deps: { readonly store: OpsStore; readonly media: MediaStore },
  issueId: string,
): Promise<PublishReport> {
  const { store, media } = deps

  const issue = await store.getIssue(issueId)
  if (issue === null) throw new OpsStopError(`없는 호다 (${issueId})`)
  const couple = await store.getCouple(issue.couple_id)
  if (couple === null) throw new OpsStopError(`호의 커플이 없다 (${issue.couple_id})`)
  assertTestCouple(couple)
  if (issue.published_at !== null) throw new OpsStopError(`이미 발행된 호다 (${issueId})`)

  const alerts = await store.openAlerts(issueId)
  if (alerts.length > 0) {
    throw new OpsStopError(`이 호에 열린 운영 경보가 ${alerts.length}건 있다 - 처리(resolved_at) 전에는 발행하지 않는다 (${issueId})`)
  }

  const corners = await store.listCorners(issueId)
  const ready = corners.filter((c) => c.status === 'ready')
  if (ready.length === 0) throw new OpsStopError(`발행할 ready 코너가 없다 (${issueId})`)

  // 미디어 복제 완료를 함수 호출 전에 확인한다(멱등 - 이미 있으면 건너뛴다).
  const copy = await copyIssueMedia({ store, media, coupleId: issue.couple_id, issueId, corners: ready })
  if (copy.missingSources.length > 0) {
    throw new OpsStopError(
      `다시 준비 중이다 - 원본이 사라진 사진 ${copy.missingSources.length}장, 코너 ${copy.resetCornerIds.length}개를 pending으로 되돌렸다 (${issueId})`,
    )
  }
  const stillMissing = await findMissingDestinations(media, ready)
  if (stillMissing.length > 0) {
    throw new OpsStopError(`미디어 복제가 끝나지 않았다 - 목적지에 없는 사진 ${stillMissing.length}장 (${issueId})`)
  }

  // 발행 가드 ①(R23-3, MASTER 9-5 r65): 렌더되지 않은 호는 발행하지 않는다. 위 원본 재확인이 렌더 필드를 비울 수 있으므로
  // (가드 ②) 그 뒤의 값을 다시 읽어 판정한다. 페이지 이미지 없이 발행되면 서재에 열리지 않는 호가 꽂힌다.
  const current = await store.getIssue(issueId)
  if (current === null) throw new OpsStopError(`없는 호다 (${issueId})`)
  if (!isRendered(current)) {
    throw new OpsStopError(`렌더되지 않은 호다 - pdf_digital_path·page_count·cover_path가 모두 있어야 발행한다 (${issueId})`)
  }

  await store.callPublish(issueId)

  const after = await store.getIssue(issueId)
  if (after === null) throw new Error(`발행 뒤 호를 읽을 수 없다 (${issueId})`)
  return { issueId, issue: after, media: { copied: copy.copied, alreadyPresent: copy.alreadyPresent } }
}
