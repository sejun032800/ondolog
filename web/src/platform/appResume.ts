/**
 * 앱이 앞으로 돌아온 신호 한 곳(A-19) - Capacitor `App`의 `resume`과 문서의 `visibilitychange`(보임) 둘 다 듣고, 한 번의 복귀로 두 신호가 함께 와도 한 번만 부른다.
 * (WebView는 복귀 때 둘 중 하나만 줄 때가 있어 둘 다 듣는다. 웹의 Capacitor 구현은 `visibilitychange`로 `resume`도 내보내므로 겹침을 막는다.)
 * 커플 상태 다시 읽기(`couple/useCoupleRefresh`)와 채팅 메우기(`useChatMessages`)가 쓴다.
 */
import { App } from '@capacitor/app'

/** 같은 복귀로 본다: 이 안에 온 두 번째 신호는 무시한다. */
export const RESUME_DEDUPE_MS = 400

export function onAppResume(cb: () => void): () => void {
  let last = Number.NEGATIVE_INFINITY
  const fire = () => {
    const now = Date.now()
    if (now - last < RESUME_DEDUPE_MS) return
    last = now
    cb()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') fire()
  }
  document.addEventListener('visibilitychange', onVisible)
  let removed = false
  let handle: { remove: () => Promise<void> | void } | null = null
  try {
    void Promise.resolve(App.addListener('resume', fire))
      .then((h) => {
        if (removed) void h.remove()
        else handle = h
      })
      .catch(() => { /* 플러그인이 없으면 visibilitychange만 쓴다 */ })
  } catch {
    // 같은 이유
  }
  return () => {
    removed = true
    document.removeEventListener('visibilitychange', onVisible)
    if (handle) void handle.remove()
  }
}
