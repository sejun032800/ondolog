/**
 * 올리는 중인 사진 말풍선의 미리보기 주소.
 * 큐 항목의 `localUri`는 앱 데이터 폴더 안의 상대 경로(`chat-photo-queue/{id}.{ext}`)라 `<img>`가 바로 못 읽는다. 항목의 복사본 파일에서 바이트를 읽어
 * `blob:` 주소를 만들어 그린다(앱을 껐다 켠 뒤 복원된 항목도 같다). 만든 주소는 화면이 사라질 때 놓는다. 파일이 없으면 빈 면.
 */
import { useEffect, useRef, useState } from 'react'
import type { PhotoFs } from '@/services/chatPhotoCore'
import type { ChatMessage } from '@/utils/chatMessages'
import { webPhotoFs } from '../../photoQueue/webPhotoFs'

const TYPE_OF_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp' }

/** 큐에 든(`localUri`가 있는) 말풍선 -> 그릴 수 있는 주소. 못 만들면 빈 면. */
export function useQueuedPreviews(messages: readonly ChatMessage[], fs: PhotoFs = webPhotoFs): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const made = useRef(new Map<string, string>())
  const asked = useRef(new Set<string>())
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const key = messages.map((m) => m.localUri ?? '').filter(Boolean).join('|')
  useEffect(() => {
    for (const m of messages) {
      const local = m.localUri
      if (!local || asked.current.has(local)) continue
      asked.current.add(local)
      void (async () => {
        try {
          const bytes = await fs.readBytes(local)
          const ext = local.split('.').pop()?.toLowerCase() ?? 'jpg'
          const url = URL.createObjectURL(new Blob([bytes], { type: TYPE_OF_EXT[ext] ?? 'image/jpeg' }))
          made.current.set(local, url)
          if (mounted.current) setUrls((prev) => ({ ...prev, [local]: url }))
        } catch {
          // 파일이 없으면 빈 면(복사본이 사라진 항목은 큐가 따로 실패로 알린다).
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fs])

  useEffect(() => () => {
    for (const url of made.current.values()) {
      try { URL.revokeObjectURL(url) } catch { /* 이미 놓였으면 그만 */ }
    }
    made.current.clear()
  }, [])

  return urls
}
