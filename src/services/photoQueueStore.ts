/**
 * 사진 영속 큐 항목의 기기 저장 - AsyncStorage `chat_photo_queue:{coupleId}:{userId}`(`chatPhotoQueueKey`).
 *
 * 채팅 오프라인 큐(`chat_queue:{coupleId}`)와 같은 곳·같은 방식이다. 온보딩 비로그인 구간의 "영속 저장소 금지"(규칙 11)는 그 화면들에만
 * 적용되며 이 큐와 무관하다. 읽기·쓰기 실패는 던지지 않는다(저장이 안 돼도 이번 세션 메모리 큐는 계속 동작한다).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { chatPhotoQueueKey, parseQueuedPhotos, type QueuedPhoto } from '../utils/chatPhotoQueue'

export async function loadPhotoQueue(coupleId: string, userId: string): Promise<QueuedPhoto[]> {
  try {
    return parseQueuedPhotos(await AsyncStorage.getItem(chatPhotoQueueKey(coupleId, userId)))
  } catch {
    return []
  }
}

export async function savePhotoQueue(coupleId: string, userId: string, items: QueuedPhoto[]): Promise<void> {
  try {
    await AsyncStorage.setItem(chatPhotoQueueKey(coupleId, userId), JSON.stringify(items))
  } catch {
    // 다음 변경 때 다시 저장을 시도한다.
  }
}
