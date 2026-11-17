/**
 * 81-(R117-2) 대기열 저장소 공통 - 글(`textQueueHub`) · 사진(`photoQueueStore`)이 같이 쓴다. **사용자가 쓴 것을 기기에서 잃지 않는다.**
 *
 * 읽기: 지금 모양 -> 그대로 / 옛 모양 -> 변환해 새 모양으로 다시 씀 / 변환 불가 -> 원본 글자를 보존 칸(`deviceCache` `qkeep`)에 그대로 넣고 `cache_fail` 1회,
 *       그 항목은 보내기에서 빠진다(사진 파일은 여기서 절대 지우지 않는다 - 지우는 길은 러너의 성공 · 취소 · 사라짐뿐).
 * 보존 칸에 쓰지 못하면(저장 막힘 · 로그인 전) 이 실행 동안 원래 키를 **덮어쓰지 않는다**(`held`) - 원본이 원래 자리에 남는다. 이번 실행의 새 항목은 메모리 큐로는 계속 간다.
 */
import { keepQueueOriginals, reportCacheFailOnce, type QueueName } from './deviceCache'
import { readQueue, writeQueue, type QueueCtx } from './queueShapes'

export interface PrefsLike {
  get: (o: { key: string }) => Promise<{ value: string | null }>
  set: (o: { key: string; value: string }) => Promise<void>
}

/** 덮어쓰지 않을 키(이 실행). */
const held = new Set<string>()
/** 읽는 중인 키 - 저장은 읽기가 끝난 뒤에(읽기 전에 덮어써 원본을 잃지 않게). */
const loading = new Map<string, Promise<unknown>>()

export async function loadQueue<T>(
  prefs: PrefsLike,
  key: string,
  queue: QueueName,
  ctx: QueueCtx,
  convert: (x: unknown, ctx: QueueCtx) => T | null,
): Promise<T[]> {
  const run = loadOnce(prefs, key, queue, ctx, convert)
  loading.set(key, run)
  try {
    return await run
  } finally {
    if (loading.get(key) === run) loading.delete(key)
  }
}

async function loadOnce<T>(
  prefs: PrefsLike,
  key: string,
  queue: QueueName,
  ctx: QueueCtx,
  convert: (x: unknown, ctx: QueueCtx) => T | null,
): Promise<T[]> {
  let raw: string | null = null
  try {
    raw = (await prefs.get({ key })).value
  } catch {
    // 읽지 못했다 - 무엇이 있는지 모르므로 이 실행에서는 덮어쓰지 않는다.
    held.add(key)
    return []
  }
  const r = readQueue(raw, convert, ctx)
  let hold = false
  if (r.originals.length > 0) {
    reportCacheFailOnce(key)
    const kept = ctx.userId ? keepQueueOriginals(ctx.userId, queue, ctx.coupleId, r.originals, ctx.now) : false
    if (!kept) hold = true
  }
  if (hold) {
    held.add(key)
    return r.items
  }
  held.delete(key)
  if (r.rewrite) {
    try {
      await prefs.set({ key, value: writeQueue(r.items) })
    } catch {
      // 다음 변경 때 다시 쓴다. 원본은 이미 보존 칸에 있다.
    }
  }
  return r.items
}

export async function saveQueue<T>(prefs: PrefsLike, key: string, items: readonly T[]): Promise<void> {
  const pending = loading.get(key)
  if (pending) await pending.catch(() => undefined)
  if (held.has(key)) return
  try {
    await prefs.set({ key, value: writeQueue(items) })
  } catch {
    // 저장이 안 돼도 이번 세션 메모리 큐는 계속 동작한다 - 다음 변경 때 다시 저장한다.
  }
}

/** 시험용. */
export function resetQueueHoldForTest(): void {
  held.clear()
  loading.clear()
}
