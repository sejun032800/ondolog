/**
 * 채팅 사진(메시지 · 스토리)의 서명 URL(RN `hooks/useSignedMedia.ts`의 웹판) - 경로를 넘기면 아직 못 받은 것만 받아 둔다.
 * 서명은 한 번에 묶어 받고(경로당 한 번), 못 만든 경로는 다시 묻지 않는다. URL 값은 기록하지 않는다. 만료(1시간)는 화면이 다시 열릴 때 새로 받는다.
 * 76-B3: 이미 받은 서명은 이 실행의 메모리(`cache/signedUrlCache`)에서 먼저 돌려준다 - 화면을 다시 그릴 때 같은 사진의 빈칸 · 재서명 0.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { signChatMedia, type ChatBucket, type ChatDb } from '@/services/chatCore'
import { getSupabase } from '../../auth/client'
import { getSignedUrl, putSignedUrls } from '../../cache/signedUrlCache'

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
    const missing = paths.filter((p) => !asked.current.has(p) && getSignedUrl(bucket, p) === undefined)
    if (!db || missing.length === 0) return
    missing.forEach((p) => asked.current.add(p))
    signChatMedia(db as unknown as ChatDb, bucket, missing)
      .then((signed) => {
        putSignedUrls(bucket, signed)
        if (mounted.current && Object.keys(signed).length > 0) setUrls((prev) => ({ ...prev, ...signed }))
      })
      .catch(() => {
        // 못 받으면 그 경로는 빈 면으로 둔다. 다음 화면 진입에서 다시 받는다.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, key])

  // 메모리에 있는 것(앞서 받은 서명)을 함께 돌려준다 - 첫 그림부터 바로 보인다.
  return useMemo(() => {
    const out: Record<string, string> = {}
    for (const p of paths) {
      const url = urls[p] ?? getSignedUrl(bucket, p)
      if (url) out[p] = url
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls, bucket, key])
}
