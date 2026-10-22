/**
 * 발행 미디어의 목적지 경로 - **이 파일이 경로를 만드는 유일한 곳이다**
 * (docs/ONDOLOG_MASTER.md §17-0-10-D, r52).
 *
 * 입력 조립(`inputAssembly.ts`)이 `PhotoRef.path`를 처음부터 이 경로로 싣고, 발행의 미디어 복제(P7)가 같은 함수로
 * 복제 목적지를 정한다. **검증이 끝난 content를 나중에 고치지 않기 위해서다** - 경로를 사후에 치환하면 다시 검증하는
 * 두 번째 입구나 검증을 건너뛴 쓰기가 생긴다(r40이 막은 구멍).
 *
 * ```
 * magazine 버킷: {couple_id}/{issue_id}/{entry_id}.{ext}
 * ```
 *
 * - 첫 폴더가 `couple_id`라 버킷 정책(SCHEMA §12)과 맞는다.
 * - 결정론이다. 같은 입력이면 같은 경로다(시간·난수 없음).
 * - `ext`는 원본 `data_entries.storage_path`의 확장자다. 확장자가 없는 원본은 만들지 않고 던진다(값을 지어내지 않는다).
 * - 순수 함수다. 이 파일은 저장소에 접근하지 않는다.
 */

/** 복제 목적지 버킷 이름(015 `magazine`). */
export const MAGAZINE_BUCKET = 'magazine'

/** 원본(업로드) 버킷 이름(015 `entries`). */
export const ENTRIES_BUCKET = 'entries'

export interface MagazineMediaPathParts {
  readonly coupleId: string
  readonly issueId: string
  readonly entryId: string
  /** 원본 `data_entries.storage_path`. 확장자만 쓴다. */
  readonly sourcePath: string
}

const SEGMENT = /^[A-Za-z0-9_-]+$/
const EXTENSION = /^[A-Za-z0-9]{1,8}$/

/** 원본 경로의 확장자(소문자, 점 없음). 없으면 던진다. */
function extensionOf(sourcePath: string): string {
  const base = sourcePath.slice(sourcePath.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  const ext = dot < 0 ? '' : base.slice(dot + 1)
  if (!EXTENSION.test(ext)) {
    throw new Error(`mediaPath: 원본 경로에 쓸 수 있는 확장자가 없다 (${sourcePath})`)
  }
  return ext.toLowerCase()
}

/** 목적지 경로(`magazine` 버킷 안). 세 ID는 경로 한 칸이 되는 값이어야 한다. */
export function magazineMediaPath(parts: MagazineMediaPathParts): string {
  for (const [name, value] of [
    ['coupleId', parts.coupleId],
    ['issueId', parts.issueId],
    ['entryId', parts.entryId],
  ] as const) {
    if (!SEGMENT.test(value)) throw new Error(`mediaPath: ${name}가 경로 한 칸으로 쓸 수 없는 값이다 (${value})`)
  }
  return `${parts.coupleId}/${parts.issueId}/${parts.entryId}.${extensionOf(parts.sourcePath)}`
}

export interface ParsedMagazineMediaPath {
  readonly coupleId: string
  readonly issueId: string
  readonly entryId: string
  readonly ext: string
}

/** 목적지 경로를 나눈다. 이 모양이 아니면 null. 복제 목록(P7)이 content의 경로에서 항목 ID를 읽는 데 쓴다. */
export function parseMagazineMediaPath(path: string): ParsedMagazineMediaPath | null {
  const folders = path.split('/')
  if (folders.length !== 3) return null
  const [coupleId, issueId, file] = folders
  const dot = file.lastIndexOf('.')
  if (dot <= 0) return null
  const entryId = file.slice(0, dot)
  const ext = file.slice(dot + 1)
  if (!SEGMENT.test(coupleId) || !SEGMENT.test(issueId) || !SEGMENT.test(entryId) || !EXTENSION.test(ext)) return null
  return { coupleId, issueId, entryId, ext }
}
