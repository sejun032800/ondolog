/**
 * 채팅(messages) + 스토리(stories) 서버 접근 함수.
 *
 * 근거: docs/ONDOLOG_SCHEMA.md §7, docs/ONDOLOG_MASTER.md Part 9-3.
 *
 * - `sendMessage`: 완료 기준 2(멱등 재전송). 매 시도마다 동일
 *   `client_msg_id`로 insert를 시도하고, `uq_messages_client_id` 유니크
 *   제약 위반(23505)이면 "이미 전송됨"으로 간주해 기존 행을 다시
 *   조회해 돌려준다(에러를 삼킨다 — 호출부가 실패로 오인해 사용자에게
 *   또 보여주지 않도록). 그 외 실패는 `classifySendError`(`chatQueue.ts`)로
 *   재시도 가능 여부를 분류해 함께 반환한다 — 네트워크 실패(fetch 자체가
 *   던지는 경우 포함, try/catch로 감쌌다)는 재시도, RLS 거부/제약
 *   위반은 즉시 실패로 큐가 판단할 수 있게 한다.
 * - `markMessagesRead`: `sender_id`가 나 자신인 행은 절대 갱신 대상에
 *   포함하지 않는다(`.neq('sender_id', currentUserId)`) — RLS
 *   `messages_update`가 발신자 제한을 두지 않으므로 앱 로직이 지켜야
 *   하는 계약(SCHEMA.md §7 원문 그대로).
 * - `warmth_score`/`sentiment`/`analyzed_at`은 이 파일 어디에서도 읽거나
 *   쓰지 않는다(Phase 7, AI 감정 태깅 담당 — 이번 범위 아님).
 * - `stories`는 select/insert만 한다. update 정책이 없어(SCHEMA.md §7)
 *   update 쿼리를 만들지 않는다(만료 처리는 배치 전용 `expire_stories()`).
 * - 전송·스토리 생성·사진 업로드/서명의 알맹이는 `chatCore.ts`(저장소 클라이언트를 인자로 받음)에 있고, 여기서는 앱 전역
 *   `supabase`를 넣어 부른다. 빈 본문 거부(R21-5)는 알맹이 안에 있어 어느 쪽으로 불러도 같다.
 */
import { supabase } from './supabase'
import {
  createStory as createStoryCore,
  fetchMessageByClientId as fetchMessageByClientIdCore,
  sendMessage as sendMessageCore,
  signChatMedia as signChatMediaCore,
  uploadChatMedia as uploadChatMediaCore,
  type ChatBucket,
  type CreateStoryInput,
  type MessageRow,
  type SendInput,
  type SendMessageResult,
  type StoryRow,
} from './chatCore'

export type { ChatBucket, CreateStoryInput, MessageRow, SendInput, SendMessageResult, StoryRow }

/** 완료 기준 2 - 동일 client_msg_id로 재시도해도 중복 삽입되지 않는다. 공백뿐인 본문(사진 없음)은 거부한다(R21-5). */
export function sendMessage(input: SendInput): Promise<SendMessageResult> {
  return sendMessageCore(supabase, input)
}

export function fetchMessageByClientId(coupleId: string, clientMsgId: string): Promise<MessageRow | null> {
  return fetchMessageByClientIdCore(supabase, coupleId, clientMsgId)
}

export function uploadChatMedia(bucket: ChatBucket, path: string, bytes: ArrayBuffer, contentType: string) {
  return uploadChatMediaCore(supabase, bucket, path, bytes, contentType)
}

export function signChatMedia(bucket: ChatBucket, paths: readonly string[]) {
  return signChatMediaCore(supabase, bucket, paths)
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

/**
 * 실시간 메우기(R37-3) - `afterSentAt` 이상의 메시지를 시간순으로 읽는다(같은 시각 포함 - 같은 메시지는 병합이 하나로 만든다).
 * null이면 처음 로드와 같다.
 */
export async function fetchMessagesAfter(
  coupleId: string,
  afterSentAt: string | null,
  limit = 500,
): Promise<MessageRow[]> {
  let query = supabase.from('messages').select('*').eq('couple_id', coupleId).is('deleted_at', null)
  if (afterSentAt) query = query.gte('sent_at', afterSentAt)
  const { data, error } = await query.order('sent_at', { ascending: true }).limit(limit)
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

export function createStory(input: CreateStoryInput): Promise<StoryRow> {
  return createStoryCore(supabase, input)
}
