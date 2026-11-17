/**
 * 사진 영속 큐 항목의 기기 저장(RN `services/photoQueueStore.ts`의 웹판) - Preferences `chat_photo_queue:{coupleId}:{userId}`(`chatPhotoQueueKey`, RN과 같은 키).
 *
 * 로그인 이후 구간의 큐라서 영속 저장이 허용된다(온보딩 비로그인 구간의 "영속 저장 금지"는 그 화면들에만 적용). 읽기 · 쓰기 실패는 던지지 않는다
 * (저장이 안 돼도 이번 세션 메모리 큐는 계속 동작한다). 사용자 키 그대로라 로그아웃해도 지우지 않고 다음 로그인에 이어 간다.
 * 81-(R117-2): 저장 모양 버전 · 옛 모양 변환 · 변환 불가 원본 보존(`cache/queueStorage`). 항목도 **사진 파일도 지우지 않는다**(보내기에서만 빠진다).
 */
import { Preferences } from '@capacitor/preferences'
import { chatPhotoQueueKey, type QueuedPhoto } from '@/utils/chatPhotoQueue'
import { loadQueue, saveQueue, type PrefsLike } from '../cache/queueStorage'
import { convertPhotoItem } from '../cache/queueShapes'

export interface PhotoQueueStore {
  load: (coupleId: string, userId: string) => Promise<QueuedPhoto[]>
  save: (coupleId: string, userId: string, items: QueuedPhoto[]) => Promise<void>
}

export function createPhotoQueueStore(prefs: PrefsLike = Preferences, now: () => Date = () => new Date()): PhotoQueueStore {
  return {
    load: (coupleId, userId) => loadQueue(prefs, chatPhotoQueueKey(coupleId, userId), 'photo', { coupleId, userId, now: now() }, convertPhotoItem),
    save: (coupleId, userId, items) => saveQueue(prefs, chatPhotoQueueKey(coupleId, userId), items),
  }
}

export const photoQueueStore: PhotoQueueStore = createPhotoQueueStore()
