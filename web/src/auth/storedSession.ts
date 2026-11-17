/**
 * 81-b(보충 2 · "네트워크 실패"와 "계정 없음"을 같은 흐름으로 보내지 않는다): 이 기기에 **저장된 로그인**이 있는지를 네트워크 없이 본다.
 *
 * `auth.getSession()`은 접근 토큰이 만료됐으면 새로 받으려 네트워크를 쓴다. 오프라인이면 그 갱신이 실패해 **세션 없음(null) + 오류**를 돌려준다 -
 * 그것을 "로그인 없음"으로 읽으면 시작 화면 → 온보딩 → 로그인으로 떨어진다(81- 덮어 설치 직후 비행기 모드 녹화). supabase-js는 이때 저장분을 지우지 않는다.
 * 그래서 저장소(Preferences, 클라이언트와 같은 키)에 남은 세션 글자에서 사용자 id만 읽는다. 토큰 · 값은 돌려주지도 남기지도 않는다.
 */
import { preferencesStorage, type AsyncAuthStorage } from './preferencesStorage'

/** 클라이언트가 세션을 두는 저장 키(supabase-js 내부 값 - 클라이언트마다 정해진다). 없으면 null. */
function storageKeyOf(db: unknown): string | null {
  const key = (db as { auth?: { storageKey?: unknown } } | null)?.auth?.storageKey
  return typeof key === 'string' && key.length > 0 ? key : null
}

/** 저장된 세션의 사용자 id. 저장분이 없거나 읽을 수 없으면 null. 던지지 않는다. */
export async function readStoredSessionUserId(db: unknown, storage: AsyncAuthStorage = preferencesStorage): Promise<string | null> {
  const key = storageKeyOf(db)
  if (!key) return null
  try {
    const raw = await storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { user?: { id?: unknown }; refresh_token?: unknown } | null
    const id = parsed?.user?.id
    // 갱신 토큰이 없으면 다시 이어 갈 수 없는 저장분 - 로그인 없음으로 본다.
    return typeof id === 'string' && id.length > 0 && typeof parsed?.refresh_token === 'string' ? id : null
  } catch {
    return null
  }
}
