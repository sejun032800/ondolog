/**
 * 기기 저장(76-A1 · R98-1 · R99-2 P5/P3) - 마지막으로 받은 값을 이 기기에 남겨 두고, 오프라인 · 다시 그릴 때 **먼저** 보이는 데 쓴다. 서버 읽기가 오면 그것으로 바꾼다.
 *
 * - 값은 `localStorage`(동기)에 둔다: 첫 그림에서 바로 읽어야 "상대" 기본 글자 · 빈 채팅이 0.1초도 비치지 않는다(`@capacitor/preferences`는 비동기라 첫 그림에 늦다.
 *   Capacitor 웹뷰의 Preferences도 결국 같은 저장소다). 접근이 막히면(예외) 저장 없이 동작한다.
 * - 키에 **사용자 id**를 묶는다(`ondolog.dc1:{userId}:{kind}[:{scope}]`). 커플 id는 `scope`(채팅) 또는 값 안에 둔다. 다른 계정은 읽지 못한다(`readCache`는 현재 사용자 id를 받아 그 키만 본다).
 * - 지우는 때: 로그아웃 · 탈퇴 요청(`resetAccountMemory`) -> `clearAllDeviceCache`, 계정 전환(다른 id로 로그인) -> `purgeOtherUsers`, 해제 완료(커플이 더는 없음) -> `clearCoupleCache`.
 * - 사진 파일 · 서명 URL은 저장하지 않는다(메시지 행의 경로만). 얼굴 · 특징 벡터 같은 것은 이 저장소에 없다.
 */
const PREFIX = 'ondolog.dc1:'

/** 저장 종류. `route`는 커플 자료가 아니다(해제 완료 때 남는다). */
export type CacheKind = 'chat' | 'main' | 'feed' | 'name' | 'route'
const COUPLE_KINDS: readonly CacheKind[] = ['chat', 'main', 'feed']

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function keyOf(userId: string, kind: CacheKind, scope?: string): string {
  return `${PREFIX}${userId}:${kind}${scope ? `:${scope}` : ''}`
}

export function readCache<T>(userId: string | null, kind: CacheKind, scope?: string): T | null {
  if (!userId) return null
  try {
    const raw = store()?.getItem(keyOf(userId, kind, scope))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache(userId: string | null, kind: CacheKind, value: unknown, scope?: string): void {
  if (!userId) return
  try {
    store()?.setItem(keyOf(userId, kind, scope), JSON.stringify(value))
  } catch {
    // 가득 참 · 막힘 - 저장 없이 계속한다.
  }
}

function removeWhere(match: (key: string) => boolean): void {
  const s = store()
  if (!s) return
  try {
    const keys: string[] = []
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i)
      if (k && k.startsWith(PREFIX) && match(k)) keys.push(k)
    }
    keys.forEach((k) => s.removeItem(k))
  } catch {
    // 같은 이유
  }
}

/** 로그아웃 · 탈퇴 요청: 이 기기의 모든 저장분. */
export function clearAllDeviceCache(): void {
  removeWhere(() => true)
}

/** 계정 전환: 지금 사용자 것이 아닌 저장분을 모두 지운다. */
export function purgeOtherUsers(userId: string): void {
  const mine = `${PREFIX}${userId}:`
  removeWhere((k) => !k.startsWith(mine))
}

/** 해제 완료(커플이 더는 없음): 그 사용자의 커플 자료(채팅 · 메인 요약 · 피드)만. 이름 · 마지막 경로는 남는다. */
export function clearCoupleCache(userId: string): void {
  removeWhere((k) => COUPLE_KINDS.some((kind) => k.startsWith(`${PREFIX}${userId}:${kind}`)))
}

// ---------------------------------------------------------------------------
// 마지막으로 있던 탭(0-2) - 카메라를 다녀오다 웹뷰가 다시 시작돼도 마지막 화면으로.
// ---------------------------------------------------------------------------

/** 이 시간 안에 다시 시작되면 마지막 탭으로 돌아간다(카메라 · 앨범을 다녀오는 길). 그보다 오래면 평소처럼 메인. */
export const ROUTE_RESTORE_WINDOW_MS = 10 * 60 * 1000

export interface SavedRoute {
  route: string
  at: number
}

export function saveLastTab(userId: string | null, route: string, now = Date.now()): void {
  writeCache(userId, 'route', { route, at: now } satisfies SavedRoute)
}

/** 탭 이름만(스택 화면은 저장하지 않는다). 기한이 지났거나 없으면 null. */
export function readLastTab(userId: string | null, isTab: (r: string) => boolean, now = Date.now()): string | null {
  const saved = readCache<SavedRoute>(userId, 'route')
  if (!saved || typeof saved.route !== 'string' || typeof saved.at !== 'number') return null
  if (now - saved.at > ROUTE_RESTORE_WINDOW_MS || now < saved.at) return null
  return isTab(saved.route) ? saved.route : null
}
