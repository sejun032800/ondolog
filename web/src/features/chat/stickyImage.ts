/**
 * A-26: 보낸 사진 말풍선이 미리보기(기기) -> 서버 주소로 바뀌는 사이 비지 않게 한다.
 * 새 주소가 아직 없거나(서명 주소를 읽는 중) 아직 내려받는 중이면 **앞에 보이던 그림을 그대로 둔다**. 새 그림이 다 불러와진 뒤에야 바꾼다.
 * 새 그림이 오류로 끝나거나 `STICKY_IMAGE_MAX_WAIT_MS`가 지나도 바꾼다(낡은 그림에 멈춰 있지 않게).
 */
import { useEffect, useState } from 'react'

export const STICKY_IMAGE_MAX_WAIT_MS = 4000

export function useStickyImage(uri: string | undefined): string | undefined {
  const [shown, setShown] = useState<string | undefined>(uri)
  useEffect(() => {
    if (uri === undefined || uri === shown) return
    if (shown === undefined) { setShown(uri); return } // 지킬 앞 그림이 없다
    let cancelled = false
    const swap = () => { if (!cancelled) setShown(uri) }
    const img = new Image()
    img.onload = swap
    img.onerror = swap
    img.src = uri
    const timer = window.setTimeout(swap, STICKY_IMAGE_MAX_WAIT_MS)
    return () => { cancelled = true; window.clearTimeout(timer); img.onload = null; img.onerror = null }
  }, [uri, shown])
  return shown
}
