/**
 * 채팅(messages) + 스토리(stories) 서버 접근 함수.
 *
 * 근거: docs/ONDOLOG_SCHEMA.md §7, docs/ONDOLOG_MASTER.md Part 9-3.
 *
 * - `sendMessage`: 완료 기준 2(멱등 재전송). 매 시도마다 동일
 *   `client_msg_id`로 insert를 시도하고, `uq_messages_client_id` 유니크
 *   제약 위반(23505)이면 "이미 전송됨"으로 간주해 기존 행을 다시
 *   조회해 돌려준다(에러를 삼킨다 — 호출부가 실패로 오인해 사용자에게
 *   또 보여주지 않도록).
 * - `markMessagesRead`: `sender_id`가 나 자신인 행은 절대 갱신 대상에
 *   포함하지 않는다(`.neq('sender_id', currentUserId)`) — RLS
 *   `messages_update`가 발신자 제한을 두지 않으므로 앱 로직이 지켜야
 *   하는 계약(SCHEMA.md §7 원문 그대로).
 * - `warmth_score`/`sentiment`/`analyzed_at`은 이 파일 어디에서도 읽거나
 *   쓰지 않는다(Phase 7, AI 감정 태깅 담당 — 이번 범위 아님).
 * - `stories`는 select/insert만 한다. update 정책이 없어(SCHEMA.md §7)
 *   update 쿼리를 만들지 않는다(만료 처리는 배치 전용 `expire_stories()`).
 *   이미지 실제 업로드는 이번 범위 밖이라 `media_path`는 자리표시자
 *   경로(`{couple_id}/placeholder`)를 쓴다 — 실제 Storage 객체는 없다.
 */
import { supabase } from './supabase'
import { isDuplicateInsertError, type OutgoingMessage } from '../utils/chatQueue'
import type { Database } from '../types/database'

export type MessageRow = Database['public']['Tables']['messages']['Row']
export type StoryRow = Database['public']['Tables']['stories']['Row']

export type SendMessageResult =
  | { status: 'sent'; row: MessageRow }
  | { status: 'already_sent'; row: MessageRow | null }
  | { status: 'failed'; error: unknown }

/** 완료 기준 2 — 동일 client_msg_id로 재시도해도 중복 삽입되지 않는다. */
export async function sendMessage(input: OutgoingMessage): Promise<SendMessageResult> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      couple_id: input.coupleId,
      sender_id: input.senderId,
      body: input.body,
      client_msg_id: input.clientMsgId,
    })
    .select()
    .single()

  if (!error && data) return { status: 'sent', row: data }

  if (error && isDuplicateInsertError(error)) {
    const existing = await fetchMessageByClientId(input.coupleId, input.clientMsgId)
    return { status: 'already_sent', row: existing }
  }

  return { status: 'failed', error }
}

export async function fetchMessageByClientId(
  coupleId: string,
  clientMsgId: string,
): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('client_msg_id', clientMsgId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchMessages(coupleId: string, limit = 200): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** 완료 기준 3 — 발신자 자신의 메시지는 갱신 대상에서 제외한다. */
export async function markMessagesRead(
  coupleId: string,
  currentUserId: string,
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('couple_id', coupleId)
    .neq('sender_id', currentUserId)
    .is('read_at', null)
    .select()
  if (error) throw error
  return data ?? []
}

/** 만료 배치(expire_stories)가 처리하기 전이라도 화면에는 만료분을 숨긴다(읽기 전용 필터). */
export async function fetchStories(coupleId: string): Promise<StoryRow[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface CreateStoryInput {
  coupleId: string
  authorId: string
  caption: string | null
}

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

export async function createStory(input: CreateStoryInput): Promise<StoryRow> {
  const expiresAt = new Date(Date.now() + STORY_LIFETIME_MS).toISOString()
  const { data, error } = await supabase
    .from('stories')
    .insert({
      couple_id: input.coupleId,
      author_id: input.authorId,
      media_path: `${input.coupleId}/placeholder`,
      caption: input.caption,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
