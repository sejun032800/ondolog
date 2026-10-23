/**
 * P7 미디어 복제 (MASTER §17-0-10-B·D) - 원본(`entries`) -> `magazine` 버킷 목적지 경로.
 * 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * - **복제 목록은 content에 실린 사진 경로에서 항목 ID를 읽고, `data_entries.storage_path`를 다시 읽어** 만든다(D).
 * - 목적지 경로는 `mediaPath.ts`의 같은 함수로 **다시 계산해 content의 경로와 대조**한다. 다르면 던진다 -
 *   content를 고치는 길은 없다("검증된 content를 나중에 고치지 않는다").
 * - **멱등.** 목적지에 이미 있으면 건너뛴다.
 * - **원본이 사라졌으면 복제하지 않고**(지워진 항목·없는 객체), 그 사진을 참조한 코너를 `pending`으로 되돌린다
 *   (`last_error = 'source_media_missing'`). 실패 사유 4값은 늘리지 않는다. 호출부는 "다시 준비 중"으로 답한다.
 * - 원본은 지우지 않는다.
 * - 대상은 **사진 경로**(`PhotoRef.path`, 17-5 `photoPath`)뿐이다. 썸네일·그림 경로는 문서가 정하지 않았다.
 */

import { ENTRIES_BUCKET, MAGAZINE_BUCKET, magazineMediaPath, parseMagazineMediaPath } from '../../supabase/functions/_shared/mediaPath.ts'
import type { CornerRow, MediaStore, OpsStore } from './opsStore.ts'

export const SOURCE_MEDIA_MISSING = 'source_media_missing'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** 저장된 코너 content가 싣고 있는 사진 경로. 코너 종류별 저장 스키마(CORNER_CONTENT §2·§7)를 따른다. */
export function mediaPathsOf(cornerType: string, content: unknown): string[] {
  if (!isRecord(content) || !isRecord(content.payload)) return []
  const payload = content.payload
  const paths: string[] = []
  if (cornerType === 'date_archive') {
    for (const article of arrayOf(payload.articles)) {
      if (!isRecord(article)) continue
      for (const stop of arrayOf(article.stops)) {
        if (!isRecord(stop)) continue
        for (const photo of arrayOf(stop.photos)) {
          if (isRecord(photo) && typeof photo.path === 'string') paths.push(photo.path)
        }
      }
    }
  } else if (cornerType === 'this_month') {
    for (const article of arrayOf(payload.articles)) {
      if (!isRecord(article)) continue
      for (const evidence of arrayOf(article.evidence)) {
        if (isRecord(evidence) && evidence.type === 'photo' && typeof evidence.photoPath === 'string') {
          paths.push(evidence.photoPath)
        }
      }
    }
  }
  return paths
}

export interface MediaCopyReport {
  readonly copied: number
  readonly alreadyPresent: number
  /** 원본이 사라진 사진의 목적지 경로. */
  readonly missingSources: readonly string[]
  /** `pending`으로 되돌린 코너 ID. */
  readonly resetCornerIds: readonly string[]
}

export interface CopyIssueMediaParams {
  readonly store: OpsStore
  readonly media: MediaStore
  readonly coupleId: string
  readonly issueId: string
  /** `ready` 코너(content를 싣고 있다). */
  readonly corners: readonly CornerRow[]
}

export async function copyIssueMedia(params: CopyIssueMediaParams): Promise<MediaCopyReport> {
  const { store, media, coupleId, issueId, corners } = params

  // 목적지 경로 -> 그 경로를 싣고 있는 코너들
  const owners = new Map<string, Set<string>>()
  for (const corner of corners) {
    for (const path of mediaPathsOf(corner.corner_type, corner.content)) {
      const set = owners.get(path) ?? new Set<string>()
      set.add(corner.id)
      owners.set(path, set)
    }
  }

  const entryIdOf = new Map<string, string>()
  for (const path of owners.keys()) {
    const parsed = parseMagazineMediaPath(path)
    if (parsed === null || parsed.coupleId !== coupleId || parsed.issueId !== issueId) {
      throw new Error(`mediaCopy: content의 사진 경로가 이 호의 목적지 경로가 아니다 (${path})`)
    }
    entryIdOf.set(path, parsed.entryId)
  }

  const sources = await store.entrySourcePaths(coupleId, [...new Set(entryIdOf.values())].sort())

  let copied = 0
  let alreadyPresent = 0
  const missingSources: string[] = []
  const resetIds = new Set<string>()

  for (const [destPath, cornerIds] of [...owners.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const entryId = entryIdOf.get(destPath) as string
    const sourcePath = sources.get(entryId)
    const sourceExists = sourcePath !== undefined && (await media.exists(ENTRIES_BUCKET, sourcePath))
    if (sourcePath === undefined || !sourceExists) {
      // 이미 복제된 사본이 있어도 원본이 지워졌으면 발행하지 않는다 - 지운 사진이 잡지에 남으면 안 된다(D).
      missingSources.push(destPath)
      for (const id of cornerIds) resetIds.add(id)
      continue
    }
    const expected = magazineMediaPath({ coupleId, issueId, entryId, sourcePath })
    if (expected !== destPath) {
      throw new Error(`mediaCopy: 원본 경로의 확장자가 content의 목적지 경로와 다르다 (${destPath})`)
    }
    if (await media.exists(MAGAZINE_BUCKET, destPath)) {
      alreadyPresent += 1
      continue
    }
    await media.copy(ENTRIES_BUCKET, sourcePath, MAGAZINE_BUCKET, destPath)
    copied += 1
  }

  for (const id of [...resetIds].sort()) await store.resetCornerPending(id, SOURCE_MEDIA_MISSING)
  // 발행 가드 ②(R23-3): 코너가 pending으로 돌아가면 그 호의 렌더 결과는 낡았다 - 다시 렌더해야 발행된다.
  if (resetIds.size > 0) await store.clearRender(issueId)

  return { copied, alreadyPresent, missingSources, resetCornerIds: [...resetIds].sort() }
}

/** 목적지에 전부 있는가(발행 직전 확인 - 17-0-10-E). 없는 경로를 돌려준다. */
export async function findMissingDestinations(
  media: MediaStore,
  corners: readonly CornerRow[],
): Promise<readonly string[]> {
  const paths = new Set<string>()
  for (const corner of corners) for (const p of mediaPathsOf(corner.corner_type, corner.content)) paths.add(p)
  const missing: string[] = []
  for (const path of [...paths].sort()) {
    if (!(await media.exists(MAGAZINE_BUCKET, path))) missing.push(path)
  }
  return missing
}
