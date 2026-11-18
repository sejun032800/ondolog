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
 * - 83-(R121-3): 사진 파일은 사용자별 폴더(`chat-photo-queue/{userId}/`)에 있다. 항목 정리 뒤 **지금 사용자가 아닌 폴더를 폴더째** 지운다 -
 *   저장값이 깨져 파일 경로를 몰라도 남지 않는다(82- 한계). 지금 사용자 폴더는 절대 건드리지 않는다.
 *   83- 이전 자리(`chat-photo-queue/{파일}` - 폴더 없이 바로 아래)의 파일은 주인을 파일로 알 수 없다 -> **지금 사용자 것이 아님이 확실할 때만** 지운다:
 *   남은 사진 대기열 저장값 전부(정리 뒤 = 지금 사용자 것)와 지금 사용자의 보존 칸 글자 어디에도 그 파일 이름이 없고, 그 글자들을 모두 읽었을 때.
 *   하나라도 못 읽거나 깨져 있으면 옛 자리 파일은 하나도 지우지 않는다(다음 로그인 때 다시). 지금 사용자 것은 읽을 때 사용자 폴더로 옮겨진다(`photoQueueStore`).
 * 던지지 않는다.
 */
import { Preferences } from '@capacitor/preferences'
import { photoQueueFiles, webPhotoFs, type PhotoQueueFiles } from '../photoQueue/webPhotoFs'
import { readQueueOriginalsStrict } from './deviceCache'

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
  /** 83-: 폴더 정리. 없으면 건너뜀(항목 정리만). */
  files?: Pick<PhotoQueueFiles, 'list' | 'removeUserDir' | 'remove'>
  /** 83-: 지금 사용자의 보존 칸 글자(못 읽으면 null). */
  originals?: (userId: string) => string[] | null
}

/** 83-: 정리 결과(시험 · 진단용 숫자). */
export interface FolderPurgeResult {
  /** 지운 다른 사용자 폴더 수. */
  dirs: number
  /** 지운 옛 자리 파일 수. */
  legacy: number
  /** 옛 자리 파일 판정을 못 해 남겨 둔 경우(모름). */
  legacyUnsure: boolean
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
  await purgePhotoFolders(userId, deps).catch(() => undefined)
  return removed
}

/** 83-: 다른 사용자 폴더째 + (확실할 때만) 옛 자리 파일. 항목 정리(`purgeOtherOwners`) 뒤에 부른다. 던지지 않는다. */
export async function purgePhotoFolders(userId: string, deps: OwnerPurgeDeps): Promise<FolderPurgeResult> {
  const result: FolderPurgeResult = { dirs: 0, legacy: 0, legacyUnsure: false }
  const files = deps.files
  if (!files || !userId) return result
  const entries = await files.list().catch(() => null)
  if (!entries) return { ...result, legacyUnsure: true }
  for (const e of entries) {
    if (e.type === 'directory' && e.name !== userId && (await files.removeUserDir(e.name).catch(() => false))) result.dirs += 1
  }
  const legacy = entries.filter((e) => e.type === 'file')
  if (legacy.length === 0) return result
  const refs = await referenceTexts(userId, deps)
  if (refs === null) return { ...result, legacyUnsure: true }
  for (const f of legacy) {
    if (refs.some((t) => t.includes(f.name))) continue // 지금 사용자 것일 수 있다 - 남김
    await files.remove(`${QUEUE_DIR_PREFIX}${f.name}`).catch(() => undefined)
    result.legacy += 1
  }
  return result
}

const QUEUE_DIR_PREFIX = 'chat-photo-queue/'

/** 정리 뒤 남은 사진 대기열 저장값 전부 + 지금 사용자의 보존 칸. 하나라도 못 읽으면 null. */
async function referenceTexts(userId: string, deps: OwnerPurgeDeps): Promise<string[] | null> {
  let keys: string[]
  try {
    keys = (await deps.prefs.keys()).keys
  } catch {
    return null
  }
  const out: string[] = []
  for (const key of keys) {
    if (!key.startsWith(PHOTO_QUEUE_PREFIX)) continue
    try {
      const v = (await deps.prefs.get({ key })).value
      if (!v) continue
      if (!listOf(v)) return null // 깨진 저장값 - 무엇을 가리키는지 모른다
      out.push(v)
    } catch {
      return null
    }
  }
  const kept = (deps.originals ?? readQueueOriginalsStrict)(userId)
  if (kept === null) return null
  return [...out, ...kept]
}

function defaultDeps(): OwnerPurgeDeps {
  return { prefs: Preferences as unknown as PrefsAllLike, removeFile: (uri) => webPhotoFs.remove(uri), files: photoQueueFiles }
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
