/**
 * 뷰어 덮개를 앱 틀(`Shell`)에 한 번 붙이는 곳. `app/viewerEntry.ts`의 입구(`openIssueViewer`)에 실제 이동을 꽂는다 - 메인 B06 [읽기] · 지난 호 다시 읽기 · 서재 표지가 모두 이 문을 지난다.
 * 열린 호는 `stores/viewerOpenStore`. 경로가 바뀌면(탭을 옮김 포함) 덮개를 닫는다 - 시트와 같다. 닫힌 뒤에는 `IssueViewer`가 통째로 사라져 호별 상태(속표지 <-> 뷰어)가 남지 않는다.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { setViewerEntry } from '../../app/viewerEntry'
import type { NativeBridge } from '../../platform/bridge'
import { useViewerOpenStore } from '../../stores/viewerOpenStore'
import { IssueViewer } from './IssueViewer'

export function ViewerHost({ bridge }: { bridge: NativeBridge }) {
  const issueId = useViewerOpenStore((s) => s.issueId)
  const location = useLocation()

  useEffect(() => {
    setViewerEntry((id) => useViewerOpenStore.getState().open(id))
    return () => setViewerEntry(null)
  }, [])
  useEffect(() => { useViewerOpenStore.getState().close() }, [location.pathname])

  if (!issueId) return null
  // 호가 바뀌면 새로 연다(key).
  return <IssueViewer key={issueId} issueId={issueId} bridge={bridge} onClose={() => useViewerOpenStore.getState().close()} />
}
