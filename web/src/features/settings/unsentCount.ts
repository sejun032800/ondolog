/**
 * 81-b(R118-3 · R119-1 · R119-2) 로그아웃 확인 창의 한 줄 더 - 동작은 그대로(R39-5 b: 로그아웃은 대기열을 지우지 않는다).
 *  - 대기열(글 + 사진 - 사진 메시지 · 이야기 모두 "메시지"로 셈) n개: 같은 계정으로 다시 로그인하면 이어서 보낸다.
 *  - 81- 보존 원본(변환 못 한 것) m개: 로그아웃 때 지워진다(R118-2 ①).
 *  - "다른 계정으로 로그인하면 이 폰에서 사라져요." 줄은 넣지 않는다 - 계정 전환이 대기열을 지우는 코드가 없다(결정 기록 근거).
 * 기기 저장만 읽는다(서버 0 · 쓰기 0 - 변환 · 보존 · 다시 쓰기를 하지 않는 읽기 전용 해석). 던지지 않는다.
 */
import { Preferences } from '@capacitor/preferences'
import { chatQueueStorageKey } from '@/utils/chatQueue'
import { chatPhotoQueueKey } from '@/utils/chatPhotoQueue'
import { listQueueOriginals } from '../../cache/deviceCache'
import { convertPhotoItem, convertTextItem, readQueue, type QueueCtx } from '../../cache/queueShapes'
import type { PrefsLike } from '../../cache/queueStorage'

/** R119-2 문구 그대로. */
export const LOGOUT_QUEUED_NOTE = (n: number): string => `아직 보내지 못한 메시지 ${n}개가 있어요. 같은 계정으로 다시 로그인하면 이어서 보내요.`
export const LOGOUT_KEPT_NOTE = (m: number): string => `보내지 못한 메시지 ${m}개는 로그아웃하면 이 폰에서 사라져요.`

export interface UnsentCounts {
  /** 대기열(다시 로그인하면 이어서 보냄). */
  queued: number
  /** 81- 보존 원본(로그아웃 때 지워짐). */
  kept: number
}

/** 확인 창에 더할 줄(없으면 빈 목록 - 지금 문장 그대로). */
export function logoutNotes(c: UnsentCounts): string[] {
  const out: string[] = []
  if (c.queued > 0) out.push(LOGOUT_QUEUED_NOTE(c.queued))
  if (c.kept > 0) out.push(LOGOUT_KEPT_NOTE(c.kept))
  return out
}

async function rawOf(prefs: PrefsLike, key: string): Promise<string | null> {
  try {
    return (await prefs.get({ key })).value
  } catch {
    return null
  }
}

export async function countUnsentMessages(userId: string | null, coupleId: string | null, prefs: PrefsLike = Preferences): Promise<UnsentCounts> {
  if (!userId) return { queued: 0, kept: 0 }
  const originals = new Set(listQueueOriginals(userId))
  let items = 0
  if (coupleId) {
    const ctx: QueueCtx = { coupleId, userId, now: new Date(0) }
    const text = readQueue(await rawOf(prefs, chatQueueStorageKey(coupleId)), convertTextItem, ctx)
    const photo = readQueue(await rawOf(prefs, chatPhotoQueueKey(coupleId, userId)), convertPhotoItem, ctx)
    items = text.items.length + photo.items.length
    for (const raw of [...text.originals, ...photo.originals]) originals.add(raw)
  }
  return { queued: items, kept: originals.size }
}
