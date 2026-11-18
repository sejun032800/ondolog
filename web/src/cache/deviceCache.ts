/**
 * 기기 저장(76-A1 · R98-1 · R99-2 P5/P3) - 마지막으로 받은 값을 이 기기에 남겨 두고, 오프라인 · 다시 그릴 때 **먼저** 보이는 데 쓴다. 서버 읽기가 오면 그것으로 바꾼다.
 *
 * - 값은 `localStorage`(동기)에 둔다: 첫 그림에서 바로 읽어야 "상대" 기본 글자 · 빈 채팅이 0.1초도 비치지 않는다(`@capacitor/preferences`는 비동기라 첫 그림에 늦다.
 *   Capacitor 웹뷰의 Preferences도 결국 같은 저장소다). 접근이 막히면(예외) 저장 없이 동작한다.
 * - 키에 **사용자 id**를 묶는다(`ondolog.dc1:{userId}:{kind}[:{scope}]`). 커플 id는 `scope`(채팅) 또는 값 안에 둔다. 다른 계정은 읽지 못한다(`readCache`는 현재 사용자 id를 받아 그 키만 본다).
 * - 지우는 때: 로그아웃 · 탈퇴 요청(`resetAccountMemory`) -> `clearAllDeviceCache`, 계정 전환(다른 id로 로그인) -> `purgeOtherUsers`, 해제 완료(커플이 더는 없음) -> `clearCoupleCache`.
 * - 사진 파일 · 서명 URL은 저장하지 않는다(메시지 행의 경로만). 얼굴 · 특징 벡터 같은 것은 이 저장소에 없다.
 */
import { clearAppErrorCounts, reportAppError } from '../errorLog/errorLog'
import { CACHE_VERSION, checkFor, queueKeepValue } from './cacheShapes'

const PREFIX = 'ondolog.dc1:'

/**
 * 저장 종류. `route` · `push`(78- 권한 안내를 보였음)는 커플 자료가 아니다(해제 완료 때 남는다).
 * `qkeep`(81-)은 변환하지 못한 대기열 원본을 보존하는 칸 - 로그아웃 · 탈퇴 요청 · 계정 전환 때 지워지고(사용자 키 규칙), 해제 완료 때는 대기열과 같이 남는다.
 */
export type CacheKind = 'chat' | 'main' | 'feed' | 'sky' | 'name' | 'route' | 'push' | 'qkeep'
/** 커플 자료 종류 - 로그아웃 · 탈퇴 요청 · 해제 요청(유예 진입) · 해제 완료 · 계정 전환에서 지워진다. 하늘('sky', 77-)도 여기에 든다. */
export const COUPLE_KINDS: readonly CacheKind[] = ['chat', 'main', 'feed', 'sky']

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

// ---------------------------------------------------------------------------
// 81-(R117-2) 모양 버전 + 읽을 때 검사. 저장 = `{ "__v": 버전, "d": 값 }`.
//  - 깨짐(JSON 아님 · 칸 빠짐 · 타입 다름) · 옛(또는 모르는) 버전 -> 그 키만 지우고 null(화면은 자리 표시 -> 서버 읽기로 다시 채움).
//  - `cache_fail`은 키마다 이 실행에서 1번(지운 뒤 다시 읽으면 없음 - 같은 원인 반복 기록 0).
//  - 버전 없는 값(81- 이전 앱이 쓴 것)은 지금 버전이 1이고 검사를 지나면 그대로 받는다(업데이트 첫 실행에 모든 화면이 비지 않게).
// ---------------------------------------------------------------------------

/** 이 실행에서 이미 `cache_fail`을 센 키. */
const reported = new Set<string>()

/** 키 하나에 대해 이 실행에서 `cache_fail`을 한 번만 센다(대기열 저장소도 같이 쓴다). */
export function reportCacheFailOnce(key: string): void {
  failOnce(key)
}

function failOnce(key: string): void {
  if (reported.has(key)) return
  reported.add(key)
  reportAppError('cache_fail')
}

function isEnvelope(v: unknown): v is { __v: unknown; d: unknown } {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && '__v' in v
}

type Verdict = { ok: true; value: unknown } | { ok: false }

/** 저장된 글자 하나를 판정한다(순수). */
export function judgeStored(raw: string, kind: CacheKind, scope?: string): Verdict {
  const check = checkFor(kind, scope)
  if (!check) return { ok: false }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false }
  }
  const version = CACHE_VERSION[kind]
  let value: unknown
  if (isEnvelope(parsed)) {
    if (parsed.__v !== version) return { ok: false }
    value = parsed.d
  } else {
    if (version !== 1) return { ok: false }
    value = parsed
  }
  try {
    return check(value) ? { ok: true, value } : { ok: false }
  } catch {
    return { ok: false }
  }
}

function discard(key: string): void {
  try {
    store()?.removeItem(key)
  } catch {
    // 막힘 - 읽는 쪽은 이미 null을 받았다.
  }
  failOnce(key)
}

export function readCache<T>(userId: string | null, kind: CacheKind, scope?: string): T | null {
  if (!userId) return null
  const key = keyOf(userId, kind, scope)
  let raw: string | null | undefined
  try {
    raw = store()?.getItem(key)
  } catch {
    return null
  }
  if (!raw) return null
  if (kind === 'qkeep') {
    // 보존 칸은 버리지 않는다 - 읽는 곳(`readQueueKeep`)이 따로 다룬다.
    const v = judgeStored(raw, kind, scope)
    return v.ok ? (v.value as T) : null
  }
  const verdict = judgeStored(raw, kind, scope)
  if (verdict.ok) return verdict.value as T
  discard(key)
  return null
}

export function writeCache(userId: string | null, kind: CacheKind, value: unknown, scope?: string): void {
  if (!userId) return
  try {
    store()?.setItem(keyOf(userId, kind, scope), JSON.stringify({ __v: CACHE_VERSION[kind], d: value }))
  } catch {
    // 가득 참 · 막힘 - 저장 없이 계속한다. 80-: 건수만 센다.
    reportAppError('cache_fail')
  }
}

function removeWhere(match: (key: string) => boolean): number {
  const s = store()
  if (!s) return 0
  try {
    const keys: string[] = []
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i)
      if (k && k.startsWith(PREFIX) && match(k)) keys.push(k)
    }
    keys.forEach((k) => s.removeItem(k))
    return keys.length
  } catch {
    // 같은 이유
    return 0
  }
}

/** 로그아웃 · 탈퇴 요청: 이 기기의 모든 저장분. */
export function clearAllDeviceCache(): void {
  removeWhere(() => true)
  clearAppErrorCounts() // 80-: 오류 건수(사용자에 묶이지 않은 키)도 같은 규칙으로
}

/** 계정 전환: 지금 사용자 것이 아닌 저장분을 모두 지운다. */
/** 지운 수를 돌려준다 - 0보다 크면 이 기기에 다른 사람의 저장분이 있었다(계정 전환, 76-i 서랍 알림 지우기의 신호). */
export function purgeOtherUsers(userId: string): number {
  const mine = `${PREFIX}${userId}:`
  const removed = removeWhere((k) => !k.startsWith(mine))
  if (removed > 0) clearAppErrorCounts() // 80-: 계정 전환 때만(같은 사람의 앱 시작에서는 남김)
  return removed
}

/** 해제 완료(커플이 더는 없음): 그 사용자의 커플 자료(채팅 · 메인 요약 · 피드 · 하늘)만. 이름 · 마지막 경로는 남는다. */
export function clearCoupleCache(userId: string): void {
  removeWhere((k) => COUPLE_KINDS.some((kind) => k.startsWith(`${PREFIX}${userId}:${kind}`)))
}

// ---------------------------------------------------------------------------
// 81- 앱 시작 때 훑기 · [다시 시도] 때 비우기 · 대기열 원본 보존
// ---------------------------------------------------------------------------

const ALL_KINDS = Object.keys(CACHE_VERSION) as CacheKind[]

/** 키에서 (범주, scope)를 읽는다. 이 사용자 것이 아니거나 모르는 범주면 null. */
function parseKey(key: string, userId: string): { kind: CacheKind; scope?: string } | null {
  const mine = `${PREFIX}${userId}:`
  if (!key.startsWith(mine)) return null
  const rest = key.slice(mine.length)
  const at = rest.indexOf(':')
  const kind = (at < 0 ? rest : rest.slice(0, at)) as CacheKind
  if (!ALL_KINDS.includes(kind)) return null
  return at < 0 ? { kind } : { kind, scope: rest.slice(at + 1) }
}

/**
 * 앱 시작(로그인 확인 뒤): 이 사용자의 범주를 한 번 훑어 깨진 · 옛 버전 값을 미리 버린다. 모르는 scope와 보존 칸(`qkeep`)은 건드리지 않는다.
 * 어떤 실패도 던지지 않는다(시작이 멈추지 않게). 버린 수를 돌려준다.
 */
export function sweepDeviceCache(userId: string | null): number {
  if (!userId) return 0
  const s = store()
  if (!s) return 0
  let dropped = 0
  try {
    const keys: string[] = []
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i)
      if (k) keys.push(k)
    }
    for (const k of keys) {
      const parsed = parseKey(k, userId)
      if (!parsed || parsed.kind === 'qkeep' || !checkFor(parsed.kind, parsed.scope)) continue
      const raw = s.getItem(k)
      if (raw === null || judgeStored(raw, parsed.kind, parsed.scope).ok) continue
      discard(k)
      dropped += 1
    }
  } catch {
    // 시작은 그대로 진행
  }
  return dropped
}

/** 화면 이름(라우트) -> 그 화면이 첫 그림에 쓰는 일반 범주. 대기열 · 보존 칸 · 삭제 대기열(`feed:trash`) · 안내 표시는 들지 않는다. */
const SCREEN_KINDS: Record<string, CacheKind[]> = {
  main: ['main', 'name'],
  chat: ['chat', 'name'],
  feed: ['feed', 'name'],
  'date-detail': ['feed', 'sky'],
  sky: ['sky', 'name'],
  magazine: ['main'],
  'push-permission': ['name'],
  'nickname-recheck': ['name'],
  'start-date-recheck': ['name'],
}
/** 비우지 않는 scope(사용자가 이미 본 안내 · 지우기 대기열). */
const KEEP_SCOPES = new Set(['nickNotice', 'dateNotice', 'asked', 'trash'])

/**
 * RenderGuard [다시 시도](81-): 그 화면이 쓰는 일반 범주를 비운 뒤 다시 그린다(깨진 값이 있으면 그것도 함께 빠진다 -> 자리 표시 -> 서버 읽기).
 * 대기열(Preferences)과 보존 칸은 건드리지 않는다. 모르는 화면이면 0. 지운 수를 돌려준다.
 */
export function clearScreenCache(userId: string | null, screen: string | null): number {
  if (!userId || !screen) return 0
  const kinds = SCREEN_KINDS[screen]
  if (!kinds) return 0
  return removeWhere((k) => {
    const p = parseKey(k, userId)
    return !!p && kinds.includes(p.kind) && !(p.scope !== undefined && KEEP_SCOPES.has(p.scope))
  })
}

/** 대기열 종류(보존 칸 scope 앞머리). */
export type QueueName = 'text' | 'photo'

/**
 * 변환하지 못한 대기열 원본을 그대로 보존한다(81- · R117-2). 같은 원본은 한 번만 넣는다. 기존 보존 칸이 깨져 있으면 그 글자도 원본으로 함께 남긴다(보존 칸은 버리지 않는다).
 * 저장에 성공하면 true - 실패면 부르는 쪽이 원래 대기열 키를 덮어쓰지 않는다.
 */
export function keepQueueOriginals(userId: string, queue: QueueName, coupleId: string, raws: readonly string[], now: Date = new Date()): boolean {
  if (raws.length === 0) return true
  const s = store()
  if (!s) return false
  const key = keyOf(userId, 'qkeep', `${queue}:${coupleId}`)
  try {
    const prevRaw = s.getItem(key)
    let entries: { at: string; raw: string }[] = []
    if (prevRaw) {
      const v = judgeStored(prevRaw, 'qkeep', `${queue}:${coupleId}`)
      entries = v.ok ? [...(v.value as { entries: { at: string; raw: string }[] }).entries] : [{ at: now.toISOString(), raw: prevRaw }]
    }
    const have = new Set(entries.map((e) => e.raw))
    for (const raw of raws) {
      if (have.has(raw)) continue
      have.add(raw)
      entries.push({ at: now.toISOString(), raw })
    }
    const value = { entries }
    if (!queueKeepValue(value)) return false
    s.setItem(key, JSON.stringify({ __v: CACHE_VERSION.qkeep, d: value }))
    return true
  } catch {
    return false
  }
}

/** 보존한 원본 수(시험 · 진단용). 깨진 보존 칸도 1로 센다. */
export function countQueueOriginals(userId: string, queue: QueueName, coupleId: string): number {
  try {
    const raw = store()?.getItem(keyOf(userId, 'qkeep', `${queue}:${coupleId}`))
    if (!raw) return 0
    const v = judgeStored(raw, 'qkeep', `${queue}:${coupleId}`)
    return v.ok ? (v.value as { entries: unknown[] }).entries.length : 1
  } catch {
    return 0
  }
}

/** 시험용: 이 실행의 "이미 센 키" 기록을 비운다. */
export function resetCacheFailMemoryForTest(): void {
  reported.clear()
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

// ---------------------------------------------------------------------------
// 81-b 부팅 화면 - 저장된 로그인이 있는데 서버를 못 읽을 때(오프라인) 들어갈 계정 화면. 서버가 정해 준 마지막 화면을 남긴다.
// ---------------------------------------------------------------------------

export function saveBootRoute(userId: string | null, route: string): void {
  writeCache(userId, 'route', { route }, 'boot')
}

export function readBootRoute(userId: string | null): string | null {
  return readCache<{ route: string }>(userId, 'route', 'boot')?.route ?? null
}

/** 81-b: 이 사용자의 보존 칸 원본 글자 전부(모든 커플 · 글 · 사진). 로그아웃 경고의 수를 셀 때. 던지지 않는다. */
export function listQueueOriginals(userId: string | null): string[] {
  if (!userId) return []
  const s = store()
  if (!s) return []
  const out: string[] = []
  try {
    const mine = `${PREFIX}${userId}:qkeep:`
    const keys: string[] = []
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i)
      if (k && k.startsWith(mine)) keys.push(k)
    }
    for (const k of keys) {
      const raw = s.getItem(k)
      if (!raw) continue
      const v = judgeStored(raw, 'qkeep', k.slice(mine.length))
      if (v.ok) out.push(...(v.value as { entries: { raw: string }[] }).entries.map((e) => e.raw))
      else out.push(raw) // 깨진 보존 칸도 원본 한 건
    }
  } catch {
    // 셀 수 없으면 센 만큼
  }
  return out
}

/**
 * 83-(R121-3): 이 사용자의 보존 칸에 든 글자 전부(깨진 칸은 칸 글자 그대로). **읽지 못하면 null**(모름) - 옛 자리 사진 파일이 이 사용자 것인지 판정할 때
 * "모르면 지우지 않는다"를 지키려고 `listQueueOriginals`(셀 수 없으면 센 만큼)와 따로 둔다. 던지지 않는다.
 */
export function readQueueOriginalsStrict(userId: string): string[] | null {
  const s = store()
  if (!s) return null
  try {
    const mine = `${PREFIX}${userId}:qkeep:`
    const out: string[] = []
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i)
      if (!k || !k.startsWith(mine)) continue
      const raw = s.getItem(k)
      if (raw) out.push(raw)
    }
    return out
  } catch {
    return null
  }
}
