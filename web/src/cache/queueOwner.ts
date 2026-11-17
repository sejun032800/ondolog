/**
 * 82-(R120-4) 대기열 항목의 주인 계정 - **남의 이름으로 글이 나가는 경로 0**(서버 거부에 기대지 않는다).
 *
 * - 주인 표시 = 항목에 이미 있는 칸: 글 `senderId` · 사진 `userId`(새 칸 0 · `QUEUE_VERSION` 그대로).
 *   사진 항목에 `userId`가 없으면 그 항목이 든 저장 키의 사용자(`chat_photo_queue:{커플}:{사용자}` - 81- 변환 `convertPhotoItem`이 처음 읽을 때의 세션 주인으로 채우는 것과 같은 값).
 *   글 항목은 `senderId`가 없으면 변환 불가(81- 보존 원본)라 보내지 않는다 - 주인 없는 항목이 보내지는 길이 없다.
 * - 보존 원본(81- `qkeep`)은 키가 이미 사용자 id로 묶여 있고(`ondolog.dc1:{사용자}:qkeep:…`) 보내지지 않는다 - 계정 전환 때 `purgeOtherUsers`, 로그아웃 때 `clearAllDeviceCache`가 지운다.
 * - 다른 계정이 로그인하는 순간(`startQueueOwnerPurge` - `useAccountData`): 이 기기의 모든 글 · 사진 대기열 키에서 주인이 지금 사용자가 아닌 항목을 지우고,
 *   그 사진 항목의 파일도 지운다(R118-2와 같은 원칙). 같은 계정이면 지울 것이 없다(R39-5 b - 이어서 보냄). 지운 건수만 돌려준다(오류 기록 대상 아님).
 * - 대기열 읽기(`loadQueue`)는 이 정리가 끝난 뒤에 읽는다(정리와 저장이 겹쳐 새 항목을 잃지 않게).
 * 던지지 않는다.
 */
import { Preferences } from '@capacitor/preferences'
import { webPhotoFs } from '../photoQueue/webPhotoFs'

export const TEXT_QUEUE_PREFIX = 'chat_queue:'
export const PHOTO_QUEUE_PREFIX = 'chat_photo_queue:'

export interface PrefsAllLike {
  get: (o: { key: string }) => Promise<{ value: string | null }>
  set: (o: { key: string; value: string }) => Promise<void>
  remove: (o: { key: string }) => Promise<void>
  keys: () => Promise<{ keys: string[] }>
}

export interface OwnerPurgeDeps {
  prefs: PrefsAllLike
  removeFile: (uri: string) => Promise<void> | void
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/** 글 항목의 주인. */
export function textOwnerOf(item: { senderId: string }): string {
  return item.senderId
}
/** 사진 항목의 주인. */
export function photoOwnerOf(item: { userId: string }): string {
  return item.userId
}

/** `chat_photo_queue:{커플}:{사용자}` -> 사용자(없으면 null). */
export function photoKeyUser(key: string): string | null {
  if (!key.startsWith(PHOTO_QUEUE_PREFIX)) return null
  const rest = key.slice(PHOTO_QUEUE_PREFIX.length)
  const at = rest.lastIndexOf(':')
  return at > 0 && at < rest.length - 1 ? rest.slice(at + 1) : null
}

/** 저장 글자의 항목 목록(지금 모양 `{__v,items}` · 81- 이전 배열). 못 읽으면 null(손대지 않음). */
function listOf(raw: string): { list: unknown[]; rebuild: (kept: unknown[]) => string } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (Array.isArray(parsed)) return { list: parsed, rebuild: (kept) => JSON.stringify(kept) }
  if (isObj(parsed) && Array.isArray(parsed.items)) return { list: parsed.items, rebuild: (kept) => JSON.stringify({ ...parsed, items: kept }) }
  return null
}

/** 한 키에서 주인이 `userId`가 아닌 항목을 지운다. 지운 항목 수. */
async function purgeKey(
  deps: OwnerPurgeDeps,
  key: string,
  userId: string,
  ownerOf: (x: Record<string, unknown>) => string | null,
  keyOwner: string | null,
): Promise<number> {
  let raw: string | null = null
  try {
    raw = (await deps.prefs.get({ key })).value
  } catch {
    return 0
  }
  if (!raw) return 0
  const parsed = listOf(raw)
  if (!parsed) {
    // 읽을 수 없는 글자: 키가 다른 사용자 것(사진)이면 그 사람 것이므로 지운다. 주인을 알 수 없으면(글) 그대로 - 보내지 않는 원본으로 남는다(81-).
    if (keyOwner !== null && keyOwner !== userId) {
      await deps.prefs.remove({ key }).catch(() => undefined)
      return 1
    }
    return 0
  }
  const kept: unknown[] = []
  const files: string[] = []
  for (const x of parsed.list) {
    const owner = isObj(x) ? (ownerOf(x) ?? keyOwner) : keyOwner
    if (owner !== null && owner !== userId) {
      if (isObj(x) && nonEmpty(x.localUri)) files.push(x.localUri)
      continue
    }
    kept.push(x)
  }
  const removed = parsed.list.length - kept.length
  if (removed === 0) return 0
  try {
    if (kept.length === 0) await deps.prefs.remove({ key })
    else await deps.prefs.set({ key, value: parsed.rebuild(kept) })
  } catch {
    return 0 // 못 지웠다 - 보내기 막음(`loadQueue` · 허브)이 그대로 지킨다. 다음 로그인 때 다시.
  }
  for (const uri of files) {
    try {
      await deps.removeFile(uri)
    } catch {
      // 파일 지우기 실패는 조용히(항목은 이미 빠졌다)
    }
  }
  return removed
}

/** 이 기기의 모든 대기열에서 주인이 `userId`가 아닌 항목(+ 사진 파일)을 지운다. 지운 항목 수(오류 기록 0). */
export async function purgeOtherOwners(userId: string, deps: OwnerPurgeDeps = defaultDeps()): Promise<number> {
  let keys: string[] = []
  try {
    keys = (await deps.prefs.keys()).keys
  } catch {
    return 0
  }
  let removed = 0
  for (const key of keys) {
    if (key.startsWith(TEXT_QUEUE_PREFIX)) {
      removed += await purgeKey(deps, key, userId, (x) => (nonEmpty(x.senderId) ? x.senderId : null), null)
    } else if (key.startsWith(PHOTO_QUEUE_PREFIX)) {
      removed += await purgeKey(deps, key, userId, (x) => (nonEmpty(x.userId) ? x.userId : null), photoKeyUser(key))
    }
  }
  return removed
}

function defaultDeps(): OwnerPurgeDeps {
  return { prefs: Preferences as unknown as PrefsAllLike, removeFile: (uri) => webPhotoFs.remove(uri) }
}

let gate: Promise<unknown> = Promise.resolve()

/** 로그인 확인 직후(`useAccountData`) - 다른 계정의 대기열 항목을 지운다. 대기열 읽기는 이것이 끝난 뒤에 읽는다. */
export function startQueueOwnerPurge(userId: string, deps?: OwnerPurgeDeps): Promise<number> {
  const run = purgeOtherOwners(userId, deps).catch(() => 0)
  gate = run
  return run
}

/** 진행 중인 정리가 끝날 때까지(없으면 바로). 던지지 않는다. */
export function queueOwnerPurgeDone(): Promise<unknown> {
  return gate.catch(() => undefined)
}

/** 시험용. */
export function resetQueueOwnerGateForTest(): void {
  gate = Promise.resolve()
}
