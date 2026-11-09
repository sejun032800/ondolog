/**
 * 사진 영속 큐 항목의 기기 저장(RN `services/photoQueueStore.ts`의 웹판) - Preferences `chat_photo_queue:{coupleId}:{userId}`(`chatPhotoQueueKey`, RN과 같은 키).
 *
 * 로그인 이후 구간의 큐라서 영속 저장이 허용된다(온보딩 비로그인 구간의 "영속 저장 금지"는 그 화면들에만 적용). 읽기 · 쓰기 실패는 던지지 않는다
 * (저장이 안 돼도 이번 세션 메모리 큐는 계속 동작한다). 사용자 키 그대로라 로그아웃해도 지우지 않고 다음 로그인에 이어 간다.
 */
import { Preferences } from '@capacitor/preferences'
import { chatPhotoQueueKey, parseQueuedPhotos, type QueuedPhoto } from '@/utils/chatPhotoQueue'

export interface PhotoQueueStore {
  load: (coupleId: string, userId: string) => Promise<QueuedPhoto[]>
  save: (coupleId: string, userId: string, items: QueuedPhoto[]) => Promise<void>
}

export const photoQueueStore: PhotoQueueStore = {
  async load(coupleId, userId) {
    try {
      return parseQueuedPhotos((await Preferences.get({ key: chatPhotoQueueKey(coupleId, userId) })).value)
    } catch {
      return []
    }
  },
  async save(coupleId, userId, items) {
    try {
      await Preferences.set({ key: chatPhotoQueueKey(coupleId, userId), value: JSON.stringify(items) })
    } catch {
      // 다음 변경 때 다시 저장을 시도한다.
    }
  },
}
