/**
 * 목차(D12)가 쓸 쪽 번호 목록을 읽을 자리(U3, `58-`, R31-8).
 *
 * 쪽 번호 목록은 렌더러만 안다. `55-3`이 렌더 결과 옆에 매니페스트로 남기면 이 함수가 그것을 읽는다.
 * **지금은 매니페스트가 없어 `null`을 돌려주고, 목차(D12)는 진입 버튼도 없이 숨겨져 있다.**
 * 매니페스트 형태와 경로 규칙은 `55-3`이 정하면 이 파일의 타입과 함수 한 곳만 채운다.
 */
import type { PublishedIssue } from './magazineApi'

export interface IssueManifestEntry {
  /** 목차 줄 이름(지면 제목). */
  title: string
  /** 이 코너가 시작하는 쪽(1부터). */
  page: number
}

export interface IssueManifest {
  entries: readonly IssueManifestEntry[]
}

/** 목차를 쓸 수 있는가: 매니페스트가 있어야 한다. 지금은 항상 false(진입 버튼을 그리지 않는다). */
export function tocAvailable(manifest: IssueManifest | null): boolean {
  return manifest !== null && manifest.entries.length > 0
}

/** 매니페스트를 읽는다. `55-3` 전에는 없다. */
export async function loadIssueManifest(_issue: Pick<PublishedIssue, 'id' | 'coupleId'>): Promise<IssueManifest | null> {
  return null
}
