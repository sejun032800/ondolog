/**
 * 큐에 든 사진 한 장을 서버로 보내는 한 번의 시도 - 저장소 클라이언트와 파일 접근을 인자로 받는다(`ChatDb` · `PhotoFs`).
 *
 * 앱은 `chatApi.ts`가 전역 `supabase`와 `photoQueueFs`를 넣어 부르고, 원격 실증 스크립트(Deno)는 시험 계정의 사용자 세션 클라이언트와
 * 자체 파일 접근을 넣어 **같은 함수**를 부른다(`chatCore.ts`와 같은 방식). `supabase.ts`·`expo-file-system`은 가져오지 않는다.
 *
 * 다시 보내도 Storage 객체 하나 · DB 행 하나(R37-2):
 *   - 업로드 경로는 항목의 `clientId`에서 정해진다(`{couple_id}/{clientId}.{ext}`, SCHEMA §12). 업로드가 "이미 있음"(409)으로 실패하면
 *     앞선 시도가 올린 같은 파일이라 성공으로 본다(`uploadChatMedia`).
 *   - 메시지는 `client_msg_id = clientId`로 넣는다. 23505(이미 전송)는 `sendMessage`가 성공(`already_sent`)으로 돌려준다.
 *   - 스토리는 클라이언트 id 열이 없다(마이그레이션 없음). 대신 **같은 `media_path`를 가진 행이 이미 있으면 넣지 않는다** - 경로가 `clientId`에서
 *     정해지므로 같은 항목의 재시도는 늘 같은 경로다. 응답만 끊긴 삽입도 다음 시도에서 이 조회가 잡는다.
 * 복사본 파일이 사라졌으면(`lost`) 서버를 부르지 않는다.
 */
import { entryStoragePath } from '../utils/dateRecord'
import { classifySendError } from '../utils/chatQueue'
import { classifyUploadError, type QueuedPhoto } from '../utils/chatPhotoQueue'
import type { PhotoAttemptResult } from '../utils/chatPhotoQueueRunner'
import {
  createStory,
  sendMessage,
  uploadChatMedia,
  type ChatDb,
  type MessageRow,
  type StoryRow,
} from './chatCore'

/** 복사본 파일 접근. 앱은 `expo-file-system`(현재 API), 시험은 메모리. */
export interface PhotoFs {
  /** 고른 사진을 앱 문서 폴더에 복사하고 복사본 주소를 돌려준다. */
  copyIn(sourceUri: string, clientId: string, ext: string): Promise<string>
  exists(uri: string): Promise<boolean> | boolean
  readBytes(uri: string): Promise<ArrayBuffer>
  remove(uri: string): Promise<void> | void
}

export interface AttemptedPhoto extends PhotoAttemptResult {
  /** `done`일 때 서버의 행(이미 있던 것 포함) - 화면 반영용. */
  message?: MessageRow | null
  story?: StoryRow | null
}

/** 같은 경로의 스토리 행이 이미 있으면 그 행을, 없으면 넣어서 돌려준다. */
export async function createStoryOnce(
  db: ChatDb,
  input: { coupleId: string; authorId: string; mediaPath: string },
  now: Date = new Date(),
): Promise<StoryRow> {
  const { data, error } = await db
    .from('stories')
    .select('*')
    .eq('couple_id', input.coupleId)
    .eq('media_path', input.mediaPath)
    .limit(1)
  if (error) throw error
  if (data && data.length > 0) return data[0]
  return createStory(db, input, now)
}

export async function attemptQueuedPhoto(
  db: ChatDb,
  item: QueuedPhoto,
  fs: PhotoFs,
  now: Date = new Date(),
): Promise<AttemptedPhoto> {
  let exists: boolean
  try {
    exists = await fs.exists(item.localUri)
  } catch {
    exists = false
  }
  if (!exists) return { outcome: 'lost' }

  const path = entryStoragePath(item.coupleId, item.clientId, item.ext)
  const bucket = item.kind === 'message' ? 'messages' : 'stories'

  let bytes: ArrayBuffer
  try {
    bytes = await fs.readBytes(item.localUri)
  } catch {
    return { outcome: 'retry', errorClass: 'retryable' }
  }

  const uploaded = await uploadChatMedia(db, bucket, path, bytes, item.contentType)
  if (!uploaded.ok) {
    return classifyUploadError(uploaded.error) === 'permanent' ? { outcome: 'failed' } : { outcome: 'retry' }
  }

  if (item.kind === 'message') {
    const result = await sendMessage(db, {
      clientMsgId: item.clientId,
      coupleId: item.coupleId,
      senderId: item.userId,
      body: null,
      mediaPath: path,
    })
    if (result.status === 'failed') {
      return result.errorClass === 'permanent' ? { outcome: 'failed' } : { outcome: 'retry' }
    }
    return { outcome: 'done', message: result.row }
  }

  try {
    const story = await createStoryOnce(db, { coupleId: item.coupleId, authorId: item.userId, mediaPath: path }, now)
    return { outcome: 'done', story }
  } catch (error) {
    return classifySendError(error as { code?: string | null }) === 'permanent' ? { outcome: 'failed' } : { outcome: 'retry' }
  }
}
