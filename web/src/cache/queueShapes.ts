/**
 * 81-(R117-2) 대기열(보내지 않은 글 · 사진) 저장 모양. **대기열은 버리지 않는다.**
 *
 * - 저장 = `{ "__v": QUEUE_VERSION, "items": [...] }`. 버전 없는 배열(81- 이전 앱이 쓴 것)은 옛 모양으로 보고 항목마다 변환한다.
 * - 항목 변환: 지금 모양이면 그대로, 옛 모양(빠진 칸)이면 채울 수 있는 칸만 채운다 - 기본값(재시도 0 · 대기) · 저장 키에서 알 수 있는 값(커플 · 사용자) · 파일 이름에서 알 수 있는 값(확장자 · 형식).
 *   **본문 · 메시지 id · 보낸 사람 · 사진 파일 경로처럼 지어낼 수 없는 칸이 없으면 변환 불가**(보존 칸으로 원본 그대로).
 * - JSON이 아님 · 모르는 버전 · 배열 아님 -> 전체 원본을 보존(변환 불가).
 * - **모양을 바꾸면 `QUEUE_VERSION`을 올리고, 옛 버전에서 새 버전으로 옮기는 변환을 이 파일에 함께 둔다.**
 * 순수 함수(저장소 · 시각은 인자로).
 */
import type { QueuedMessage } from '@/utils/chatQueue'
import type { QueuedPhoto } from '@/utils/chatPhotoQueue'

export const QUEUE_VERSION = 1

export interface QueueRead<T> {
  items: T[]
  /** 변환하지 못한 원본 글자(항목 하나 또는 전체). 보존 칸에 그대로 넣는다. */
  originals: string[]
  /** 저장된 글자가 지금 모양 그대로가 아니었다(옛 모양 · 변환 · 보존) - 새 모양으로 다시 써야 한다. */
  rewrite: boolean
}

export interface QueueCtx {
  coupleId: string
  userId: string | null
  now: Date
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0

function retryCountOf(v: unknown): number | null {
  if (v === undefined || v === null) return 0
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

function statusOf(v: unknown): 'pending' | 'failed' {
  return v === 'failed' ? 'failed' : 'pending'
}

function sentAtOf(v: unknown, now: Date): string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : now.toISOString()
}

/** 글 항목 하나 -> 지금 모양(못 하면 null). 같은 값이면 같은 결과(시각은 `now`로만). */
export function convertTextItem(x: unknown, ctx: QueueCtx): QueuedMessage | null {
  if (!isObj(x)) return null
  if (!nonEmpty(x.clientMsgId) || typeof x.body !== 'string' || x.body.trim() === '' || !nonEmpty(x.senderId)) return null
  if (x.coupleId !== undefined && !nonEmpty(x.coupleId)) return null
  const retryCount = retryCountOf(x.retryCount)
  if (retryCount === null) return null
  return {
    clientMsgId: x.clientMsgId,
    coupleId: (x.coupleId as string | undefined) ?? ctx.coupleId,
    senderId: x.senderId,
    body: x.body,
    sentAt: sentAtOf(x.sentAt, ctx.now),
    retryCount,
    status: statusOf(x.status),
  }
}

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp',
}

/** 사진 항목 하나 -> 지금 모양(못 하면 null). 파일은 건드리지 않는다. */
export function convertPhotoItem(x: unknown, ctx: QueueCtx): QueuedPhoto | null {
  if (!isObj(x)) return null
  if (!nonEmpty(x.clientId) || !nonEmpty(x.localUri) || (x.kind !== 'message' && x.kind !== 'story')) return null
  if (x.coupleId !== undefined && !nonEmpty(x.coupleId)) return null
  if (x.userId !== undefined && !nonEmpty(x.userId)) return null
  const userId = (x.userId as string | undefined) ?? ctx.userId
  if (!userId) return null
  const fromUri = /\.([A-Za-z0-9]{1,5})$/.exec(x.localUri)?.[1]?.toLowerCase()
  const ext = nonEmpty(x.ext) ? x.ext : fromUri
  if (!ext) return null
  const contentType = nonEmpty(x.contentType) ? x.contentType : (CONTENT_TYPE[ext.toLowerCase()] ?? 'image/jpeg')
  const retryCount = retryCountOf(x.retryCount)
  if (retryCount === null) return null
  return {
    clientId: x.clientId,
    kind: x.kind,
    coupleId: (x.coupleId as string | undefined) ?? ctx.coupleId,
    userId,
    localUri: x.localUri,
    ext,
    contentType,
    sentAt: sentAtOf(x.sentAt, ctx.now),
    retryCount,
    status: statusOf(x.status),
  }
}

/** 저장된 글자 -> 항목 · 보존할 원본. 던지지 않는다. */
export function readQueue<T>(raw: string | null | undefined, convert: (x: unknown, ctx: QueueCtx) => T | null, ctx: QueueCtx): QueueRead<T> {
  if (!raw) return { items: [], originals: [], rewrite: false }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { items: [], originals: [raw], rewrite: true }
  }
  let list: unknown[]
  let legacy = false
  if (Array.isArray(parsed)) {
    list = parsed
    legacy = true
  } else if (isObj(parsed) && parsed.__v === QUEUE_VERSION && Array.isArray(parsed.items)) {
    list = parsed.items
  } else {
    return { items: [], originals: [raw], rewrite: true }
  }
  const items: T[] = []
  const originals: string[] = []
  let changed = legacy
  for (const x of list) {
    let out: T | null = null
    try {
      out = convert(x, ctx)
    } catch {
      out = null
    }
    if (out === null) {
      originals.push(safeStringify(x))
      changed = true
      continue
    }
    if (!changed && JSON.stringify(out) !== JSON.stringify(x)) changed = true
    items.push(out)
  }
  return { items, originals, rewrite: changed }
}

function safeStringify(x: unknown): string {
  try {
    return JSON.stringify(x) ?? String(x)
  } catch {
    return String(x)
  }
}

/** 저장할 글자(지금 모양). */
export function writeQueue<T>(items: readonly T[]): string {
  return JSON.stringify({ __v: QUEUE_VERSION, items })
}
