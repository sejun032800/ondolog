/**
 * 채팅 사진(메시지·스토리)의 서명 URL - 경로를 넘기면 아직 못 받은 것만 받아 둔다.
 *
 * 서명은 한 번에 묶어 받고(경로당 한 번), 못 만든 경로(예: 자리표시자 경로)는 다시 묻지 않는다. URL 값은 기록하지 않는다.
 * 만료(1시간)는 화면이 다시 열릴 때 새로 받는다 - 이 훅은 화면 수명 동안만 값을 쥔다.
 */
import { useEffect, useRef, useState } from 'react'
import { signChatMedia, type ChatBucket } from '../services/chatApi'

export function useSignedMedia(bucket: ChatBucket, paths: readonly string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const asked = useRef<Set<string>>(new Set())

  const key = paths.join('|')
  useEffect(() => {
    const missing = paths.filter((p) => !asked.current.has(p))
    if (missing.length === 0) return
    missing.forEach((p) => asked.current.add(p))
    let alive = true
    signChatMedia(bucket, missing)
      .then((signed) => {
        if (alive && Object.keys(signed).length > 0) setUrls((prev) => ({ ...prev, ...signed }))
      })
      .catch(() => {
        // 못 받으면 그 경로는 빈 면으로 둔다. 다음 화면 진입에서 다시 받는다.
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, key])

  return urls
}
