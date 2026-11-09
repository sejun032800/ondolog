/**
 * 채팅 서버 읽기 · 읽음 갱신(RN `services/chatApi.ts`의 웹판) - 클라이언트를 인자로 받는다(`ChatDb`). RN과 같은 테이블 · 같은 질의다.
 * 전송 · 사진 올리기 · 스토리 만들기 · 서명은 루트 `@/services/chatCore` · `chatPhotoCore`를 그대로 가져다 쓴다(사본 0).
 *
 * - `markMessagesRead`: 발신자가 나인 행은 갱신 대상에 넣지 않는다(`.neq('sender_id', me)`) - RLS `messages_update`가 발신자 제한을 두지 않아 앱이 지키는 계약.
 * - `stories`는 select / insert만(update 정책 없음). 화면에서는 만료분을 숨긴다(읽기 필터).
 * - `warmth_score` · `sentiment` · `analyzed_at`은 읽지도 쓰지도 않는다.
 */
import type { ChatDb, MessageRow, StoryRow } from '@/services/chatCore'

export async function fetchMessages(db: ChatDb, coupleId: string, limit = 200): Promise<MessageRow[]> {
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** 실시간 메우기(R37-3) - `afterSentAt` 이상(같은 시각 포함 - 같은 메시지는 병합이 하나로 만든다)의 메시지를 시간순으로. null이면 처음 로드와 같다. */
export async function fetchMessagesAfter(db: ChatDb, coupleId: string, afterSentAt: string | null, limit = 500): Promise<MessageRow[]> {
  let query = db.from('messages').select('*').eq('couple_id', coupleId).is('deleted_at', null)
  if (afterSentAt) query = query.gte('sent_at', afterSentAt)
  const { data, error } = await query.order('sent_at', { ascending: true }).limit(limit)
  if (error) throw error
  return data ?? []
}

/**
 * 발신자 자신의 메시지는 갱신 대상에서 제외한다. 돌려주는 행은 화면 상태에 합쳐지므로, 지워진 행(`deleted_at`)이 섞여 있어도 다시 나타나지 않게 걸러 낸다
 * (RN은 거르지 않았다 - 갱신 질의가 지운 행도 맞출 수 있어 지운 메시지가 되살아날 수 있는 틈이라 웹은 돌려받은 행만 거른다).
 */
export async function markMessagesRead(db: ChatDb, coupleId: string, currentUserId: string): Promise<MessageRow[]> {
  const { data, error } = await db
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('couple_id', coupleId)
    .neq('sender_id', currentUserId)
    .is('read_at', null)
    .select()
  if (error) throw error
  return (data ?? []).filter((row) => row.deleted_at === null || row.deleted_at === undefined)
}

/** 만료 배치가 처리하기 전이라도 화면에는 만료분을 숨긴다(읽기 전용 필터). */
export async function fetchStories(db: ChatDb, coupleId: string): Promise<StoryRow[]> {
  const { data, error } = await db
    .from('stories')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
