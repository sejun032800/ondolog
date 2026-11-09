/**
 * 채팅 사진(메시지 · 스토리)의 서명 URL(RN `hooks/useSignedMedia.ts`의 웹판) - 경로를 넘기면 아직 못 받은 것만 받아 둔다.
 * 서명은 한 번에 묶어 받고(경로당 한 번), 못 만든 경로는 다시 묻지 않는다. URL 값은 기록하지 않는다. 만료(1시간)는 화면이 다시 열릴 때 새로 받는다.
 */
import { useEffect, useRef, useState } from 'react'
import { signChatMedia, type ChatBucket, type ChatDb } from '@/services/chatCore'
import { getSupabase } from '../../auth/client'

export function useSignedMedia(bucket: ChatBucket, paths: readonly string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const asked = useRef<Set<string>>(new Set())
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const key = paths.join('|')
  useEffect(() => {
    const db = getSupabase()
    const missing = paths.filter((p) => !asked.current.has(p))
    if (!db || missing.length === 0) return
    missing.forEach((p) => asked.current.add(p))
    signChatMedia(db as unknown as ChatDb, bucket, missing)
      .then((signed) => {
        if (mounted.current && Object.keys(signed).length > 0) setUrls((prev) => ({ ...prev, ...signed }))
      })
      .catch(() => {
        // 못 받으면 그 경로는 빈 면으로 둔다. 다음 화면 진입에서 다시 받는다.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, key])

  return urls
}
