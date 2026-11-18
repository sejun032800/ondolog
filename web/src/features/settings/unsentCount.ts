/**
 * 81-b(R118-3 · R119-1 · R119-2) 로그아웃 확인 창의 한 줄 더 - 동작은 그대로(R39-5 b: 로그아웃은 대기열을 지우지 않는다).
 *  - 대기열(글 + 사진 - 사진 메시지 · 이야기 모두 "메시지"로 셈) n개: 같은 계정으로 다시 로그인하면 이어서 보낸다.
 *  - 81- 보존 원본(변환 못 한 것) m개: 로그아웃 때 지워진다(R118-2 ①).
 *  - 82-(R120-4 ③ · R119-2): 대기열이 있을 때만 "다른 계정으로 로그인하면 이 폰에서 사라져요." 줄을 대기열 줄 바로 뒤에 - 이제 동작과 맞다
 *    (다른 계정 로그인 때 이전 주인의 대기열을 지움: `cache/queueOwner.ts` `purgeOtherOwners` · `useAccountData` · 시험 `accountSwitch82`).
 *  - 대기열 수는 이 사용자가 주인인 항목만(글 키 `chat_queue:{커플}`는 사용자로 나뉘지 않는다).
 * 기기 저장 + (83-) 허브 메모리(`unsentSource.ts` - 방금 보낸 글 · 저장 전 큐)를 읽는다(서버 0 · 쓰기 0 - 변환 · 보존 · 다시 쓰기를 하지 않는 읽기 전용 해석). 던지지 않는다.
 */
import { Preferences } from '@capacitor/preferences'
import { chatQueueStorageKey } from '@/utils/chatQueue'
import { chatPhotoQueueKey } from '@/utils/chatPhotoQueue'
import { listQueueOriginals } from '../../cache/deviceCache'
import { convertPhotoItem, convertTextItem, readQueue, type QueueCtx } from '../../cache/queueShapes'
import type { PrefsLike } from '../../cache/queueStorage'
import type { UnsentRef } from '../chat/textQueueHub'
import type { UnsentSource } from './unsentSource'

/** R119-2 문구 그대로. */
export const LOGOUT_QUEUED_NOTE = (n: number): string => `아직 보내지 못한 메시지 ${n}개가 있어요. 같은 계정으로 다시 로그인하면 이어서 보내요.`
export const LOGOUT_KEPT_NOTE = (m: number): string => `보내지 못한 메시지 ${m}개는 로그아웃하면 이 폰에서 사라져요.`
export const LOGOUT_SWITCH_NOTE = '다른 계정으로 로그인하면 이 폰에서 사라져요.'

export interface UnsentCounts {
  /** 대기열(다시 로그인하면 이어서 보냄). */
  queued: number
  /** 81- 보존 원본(로그아웃 때 지워짐). */
  kept: number
}

/** 확인 창에 더할 줄(없으면 빈 목록 - 지금 문장 그대로). */
export function logoutNotes(c: UnsentCounts): string[] {
  const out: string[] = []
  if (c.queued > 0) out.push(LOGOUT_QUEUED_NOTE(c.queued), LOGOUT_SWITCH_NOTE)
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

/**
 * 대기열 수 = 기기 저장 + 메모리(83-: `live` - 허브가 지금 갖고 있는 것 · 첫 시도 진행 중인 글)를 id로 합쳐 한 번씩. 주인이 이 사용자인 것만.
 * 메모리는 저장을 읽은 **뒤에** 본다 - 그 사이 첫 시도가 실패해 큐로 옮겨 가도 놓치지 않게.
 */
export async function countUnsentMessages(
  userId: string | null,
  coupleId: string | null,
  prefs: PrefsLike = Preferences,
  live?: Pick<UnsentSource, 'text' | 'photo'>,
): Promise<UnsentCounts> {
  if (!userId) return { queued: 0, kept: 0 }
  const originals = new Set(listQueueOriginals(userId))
  const textIds = new Set<string>()
  const photoIds = new Set<string>()
  if (coupleId) {
    const ctx: QueueCtx = { coupleId, userId, now: new Date(0) }
    const text = readQueue(await rawOf(prefs, chatQueueStorageKey(coupleId)), convertTextItem, ctx)
    const photo = readQueue(await rawOf(prefs, chatPhotoQueueKey(coupleId, userId)), convertPhotoItem, ctx)
    for (const i of text.items) if (i.senderId === userId) textIds.add(i.clientMsgId)
    for (const i of photo.items) if (i.userId === userId) photoIds.add(i.clientId)
    for (const raw of [...text.originals, ...photo.originals]) originals.add(raw)
  }
  if (live) {
    const mine = (r: UnsentRef) => r.ownerId === userId && (coupleId === null || r.coupleId === coupleId)
    try {
      for (const r of live.text()) if (mine(r)) textIds.add(r.id)
      for (const r of live.photo()) if (mine(r)) photoIds.add(r.id)
    } catch {
      // 메모리를 못 읽으면 저장값만
    }
  }
  return { queued: textIds.size + photoIds.size, kept: originals.size }
}
