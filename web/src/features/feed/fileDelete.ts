/**
 * 76-g P1(R105-4) 앱에서 지운 순간 내 파일도 지운다 - 사진 하나 지우기(023 `fn_delete_own_entry`) · 하루 지우기(76-m3 `fn_delete_my_day`)의 **행 삭제가 성공한 뒤**에만.
 *
 * - 저장소: `entries` 버킷의 내 파일. 76-g-m2 정책이 "올린 사람 본인 파일만"을 지게 한다(상대 파일은 저장소가 거부 - 앱은 내 행의 경로만 넘긴다).
 * - 행 삭제가 실패하면 파일은 건드리지 않는다(부르는 쪽이 성공 뒤에만 부른다).
 * - 파일 삭제가 실패하면(오프라인 · 오류) **기기 대기열**에 넣고 앱 복귀 · 다시 연결 · 앱 시작 때 다시 지운다.
 *   대기열은 76- 기기 저장 장치(`cache/deviceCache`)의 `feed` 범주 scope `trash` - 새 범주가 아니라 커플 자료 삭제 규칙(로그아웃 · 탈퇴 요청 ·
 *   해제 요청 · 해제 완료 · 계정 전환)이 그대로 지운다. 그때 남은 파일은 행이 이미 지워져 있으므로 월요일 정리(`sweepOrphanFiles`)가 받는다.
 * - 경로는 화면 · 로그에 내지 않는다.
 */
import { useEffect } from 'react'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { readCache, writeCache } from '../../cache/deviceCache'
import { onAppResume } from '../../platform/appResume'

export const ENTRY_FILE_BUCKET = 'entries'
const QUEUE_SCOPE = 'trash'
/** 한 번에 지우는 수(저장소 API 묶음). */
const CHUNK = 100

type StorageDb = {
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ data: unknown; error: unknown }> } }
}
type RowsDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { is: (c: string, v: null) => PromiseLike<{ data: unknown; error: unknown }> } }
    }
  }
}

const me = (): string | null => useAuthStore.getState().userId

export function readFileQueue(userId: string | null = me()): string[] {
  const v = readCache<{ paths: string[] }>(userId, 'feed', QUEUE_SCOPE)
  return v && Array.isArray(v.paths) ? v.paths.filter((p) => typeof p === 'string' && p.length > 0) : []
}

function writeFileQueue(paths: readonly string[], userId: string | null = me()): void {
  writeCache(userId, 'feed', { paths: [...new Set(paths)] }, QUEUE_SCOPE)
}

/** 저장소에서 한 번 지운다. 실패한 경로를 돌려준다(던지지 않는다). */
async function removeOnce(paths: readonly string[], db: StorageDb | null): Promise<string[]> {
  if (paths.length === 0) return []
  if (!db) return [...paths]
  const failed: string[] = []
  for (let i = 0; i < paths.length; i += CHUNK) {
    const part = paths.slice(i, i + CHUNK)
    try {
      const { error } = await db.storage.from(ENTRY_FILE_BUCKET).remove(part)
      if (error) failed.push(...part)
    } catch {
      failed.push(...part)
    }
  }
  return failed
}

/** 행 삭제 성공 뒤 부른다. 실패한 파일은 기기 대기열로. */
export async function deleteMyFiles(paths: readonly (string | null | undefined)[], db: StorageDb | null = getSupabase() as unknown as StorageDb | null): Promise<void> {
  const list = [...new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))]
  if (list.length === 0) return
  const failed = await removeOnce(list, db)
  if (failed.length > 0) writeFileQueue([...readFileQueue(), ...failed])
}

/** 대기열을 한 번 비운다(성공한 것만 뺀다). */
export async function flushFileQueue(db: StorageDb | null = getSupabase() as unknown as StorageDb | null): Promise<void> {
  const userId = me()
  const queued = readFileQueue(userId)
  if (queued.length === 0) return
  const failed = await removeOnce(queued, db)
  // 그 사이 계정이 바뀌었으면 쓰지 않는다(다른 사용자 대기열에 섞지 않게).
  if (me() === userId) writeFileQueue(failed, userId)
}

/**
 * 하루 지우기 전에 그날 **내** 항목의 파일 경로를 읽어 둔다(76-m3 RPC는 경로를 돌려주지 않는다 - 새 마이그레이션 없이).
 * 읽기 실패면 빈 목록(행 삭제는 그대로 하고, 파일은 월요일 정리가 받는다).
 */
export async function readMyDayFilePaths(dateId: string, userId: string | null, db: RowsDb | null = getSupabase() as unknown as RowsDb | null): Promise<string[]> {
  if (!db || !userId) return []
  try {
    const { data, error } = await db.from('data_entries').select('storage_path, thumb_path, drawing_path').eq('date_id', dateId).eq('author_id', userId).is('deleted_at', null)
    if (error) return []
    const rows = (data ?? []) as { storage_path: string | null; thumb_path: string | null; drawing_path: string | null }[]
    return rows.flatMap((r) => [r.storage_path, r.thumb_path, r.drawing_path]).filter((p): p is string => !!p)
  } catch {
    return []
  }
}

/** Shell에 한 번: 앱 시작(로그인) · 앱 복귀 · 다시 연결 때 대기열을 비운다. */
export function useFileQueueResume(): void {
  const userId = useAuthStore((s) => s.userId)
  useEffect(() => {
    if (!userId) return
    const flush = () => { void flushFileQueue() }
    flush()
    const off = onAppResume(flush)
    window.addEventListener('online', flush)
    return () => {
      off()
      window.removeEventListener('online', flush)
    }
  }, [userId])
}
