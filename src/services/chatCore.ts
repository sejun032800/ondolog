/**
 * 채팅 서버 접근의 알맹이 - 저장소 클라이언트를 인자로 받는다(`ChatDb`).
 *
 * 앱은 `src/services/chatApi.ts`가 전역 `supabase`를 넣어 부르고, 원격 실증 스크립트(Deno)는 시험 계정의 사용자 세션
 * 클라이언트를 넣어 **같은 함수**를 부른다. 이 파일은 `supabase.ts`(앱 환경변수·AsyncStorage)를 가져오지 않는다.
 *
 * - `sendMessage`: 멱등 재전송(같은 `client_msg_id`, 23505 = 이미 전송됨) + **빈 본문 거부(R21-5)**.
 *   공백 제거 후 빈 본문은 사진이 없으면 서버에 가지 않고 `permanent` 실패로 돌려준다 - 화면의 막음과 같은 함수(`canSendBody`).
 *   DB 제약은 더하지 않는다(chk_message_payload는 그대로).
 * - 사진은 `messages`·`stories` 버킷의 `{couple_id}/{id}.{ext}` 경로(SCHEMA §12)로 올리고 서명 URL로 읽는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { canSendBody } from '../utils/chatMessages'
import { classifySendError, isDuplicateInsertError, type SendErrorClass } from '../utils/chatQueue'

export type ChatDb = Pick<SupabaseClient<Database>, 'from' | 'storage'>

export type MessageRow = Database['public']['Tables']['messages']['Row']
export type StoryRow = Database['public']['Tables']['stories']['Row']

/** 서버로 보낼 메시지. 텍스트는 `body`, 사진은 `mediaPath`(본문은 null). */
export interface SendInput {
  clientMsgId: string
  coupleId: string
  senderId: string
  body: string | null
  mediaPath?: string | null
}

export type SendMessageResult =
  | { status: 'sent'; row: MessageRow }
  | { status: 'already_sent'; row: MessageRow | null }
  | { status: 'failed'; errorClass: SendErrorClass; error: unknown }

export const EMPTY_BODY_ERROR = 'empty_body'

export async function fetchMessageByClientId(
  db: ChatDb,
  coupleId: string,
  clientMsgId: string,
): Promise<MessageRow | null> {
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('client_msg_id', clientMsgId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** 완료 기준 2 - 동일 client_msg_id로 재시도해도 중복 삽입되지 않는다. 빈 본문(사진 없음)은 서버에 가지 않는다. */
export async function sendMessage(db: ChatDb, input: SendInput): Promise<SendMessageResult> {
  const mediaPath = input.mediaPath ?? null
  if (!canSendBody(input.body, mediaPath !== null)) {
    return { status: 'failed', errorClass: 'permanent', error: new Error(EMPTY_BODY_ERROR) }
  }
  try {
    const { data, error } = await db
      .from('messages')
      .insert({
        couple_id: input.coupleId,
        sender_id: input.senderId,
        // 사진 메시지의 본문은 비운다(null). 공백뿐인 문자열을 본문으로 남기지 않는다.
        body: mediaPath !== null && !canSendBody(input.body) ? null : input.body,
        media_path: mediaPath,
        client_msg_id: input.clientMsgId,
      })
      .select()
      .single()

    if (!error && data) return { status: 'sent', row: data }

    if (error && isDuplicateInsertError(error)) {
      const existing = await fetchMessageByClientId(db, input.coupleId, input.clientMsgId)
      return { status: 'already_sent', row: existing }
    }

    return { status: 'failed', errorClass: classifySendError(error), error }
  } catch (error) {
    // fetch 자체가 던진 경우(네트워크 끊김 등) - code가 없어 classifySendError가 재시도 대상으로 분류한다.
    return { status: 'failed', errorClass: classifySendError(null), error }
  }
}

// ---------------------------------------------------------------------------
// 사진
// ---------------------------------------------------------------------------

export type ChatBucket = 'messages' | 'stories'

export const CHAT_SIGNED_URL_TTL_SECONDS = 60 * 60

/** 이미 같은 경로가 있으면(재시도에서 앞선 시도가 올렸다) 성공으로 본다 - 경로가 `client_msg_id`에서 정해져 같은 파일이다. */
function isAlreadyExists(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false
  return String(error.statusCode ?? '') === '409' || /already exists|duplicate/i.test(error.message ?? '')
}

export async function uploadChatMedia(
  db: ChatDb,
  bucket: ChatBucket,
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType, upsert: false })
    if (!error || isAlreadyExists(error as { message?: string; statusCode?: string | number })) return { ok: true }
    return { ok: false, error }
  } catch (error) {
    return { ok: false, error }
  }
}

/** 경로 -> 서명 URL. 못 만든 경로는 빠진다(화면은 빈 면으로 둔다). URL 값은 기록하지 않는다. */
export async function signChatMedia(
  db: ChatDb,
  bucket: ChatBucket,
  paths: readonly string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  const out: Record<string, string> = {}
  if (unique.length === 0) return out
  const { data, error } = await db.storage.from(bucket).createSignedUrls(unique, CHAT_SIGNED_URL_TTL_SECONDS)
  if (error || !data) return out
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl
  }
  return out
}

// ---------------------------------------------------------------------------
// 스토리
// ---------------------------------------------------------------------------

export interface CreateStoryInput {
  coupleId: string
  authorId: string
  /** `stories` 버킷에 이미 올린 사진 경로. */
  mediaPath: string
}

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

/** 고르면 바로 올린다(R13-11 #6) - 편집 화면이 없으니 캡션도 없다(null). */
export async function createStory(db: ChatDb, input: CreateStoryInput, now: Date = new Date()): Promise<StoryRow> {
  const { data, error } = await db
    .from('stories')
    .insert({
      couple_id: input.coupleId,
      author_id: input.authorId,
      media_path: input.mediaPath,
      caption: null,
      expires_at: new Date(now.getTime() + STORY_LIFETIME_MS).toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}
