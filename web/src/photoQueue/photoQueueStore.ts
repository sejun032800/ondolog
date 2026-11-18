/**
 * 사진 영속 큐 항목의 기기 저장(RN `services/photoQueueStore.ts`의 웹판) - Preferences `chat_photo_queue:{coupleId}:{userId}`(`chatPhotoQueueKey`, RN과 같은 키).
 *
 * 로그인 이후 구간의 큐라서 영속 저장이 허용된다(온보딩 비로그인 구간의 "영속 저장 금지"는 그 화면들에만 적용). 읽기 · 쓰기 실패는 던지지 않는다
 * (저장이 안 돼도 이번 세션 메모리 큐는 계속 동작한다). 사용자 키 그대로라 로그아웃해도 지우지 않고 다음 로그인에 이어 간다.
 * 82-(R120-4): 주인(`userId` - 없으면 처음 읽을 때의 세션 주인으로 채움)이 `userId`인 항목만 읽는다.
 * 81-(R117-2): 저장 모양 버전 · 옛 모양 변환 · 변환 불가 원본 보존(`cache/queueStorage`). 항목도 **사진 파일도 지우지 않는다**(보내기에서만 빠진다).
 * 83-(R121-3): 읽을 때 이 사용자 항목 중 옛 자리(`chat-photo-queue/{파일}`)의 파일을 사용자 폴더로 옮긴다 - 복사 -> 저장값 경로 갱신 -> 그 뒤에 원본 지움.
 *   복사 실패 항목은 옛 경로 그대로(원본으로 보냄 · 다음 읽기 때 다시). 저장값을 못 쓰면 새 복사본을 지우고 전부 옛 경로 그대로. 남의 항목은 옮기지 않는다(계정 전환 정리가 지움).
 *   "옮긴다" = 같은 파일이 두 자리에 잠깐 있을 뿐, 어느 순간에도 저장값이 가리키는 파일은 있다(사진 0건 손실).
 */
import { Preferences } from '@capacitor/preferences'
import { chatPhotoQueueKey, type QueuedPhoto } from '@/utils/chatPhotoQueue'
import { loadQueue, saveQueue, type PrefsLike } from '../cache/queueStorage'
import { convertPhotoItem } from '../cache/queueShapes'
import { photoOwnerOf } from '../cache/queueOwner'
import type { QueueMigrate } from '../cache/queueStorage'
import { isLegacyQueuePath, photoQueueFiles, type PhotoQueueFiles } from './webPhotoFs'

export interface PhotoQueueStore {
  load: (coupleId: string, userId: string) => Promise<QueuedPhoto[]>
  save: (coupleId: string, userId: string, items: QueuedPhoto[]) => Promise<void>
}

/** 83-: 이 사용자 항목의 옛 자리 파일을 사용자 폴더로. 옮길 것이 없으면 null. */
export function legacyPhotoMover(files: Pick<PhotoQueueFiles, 'moveToUser' | 'remove'>, userId: string): QueueMigrate<QueuedPhoto> {
  return async (items) => {
    const moved: { from: string; to: string }[] = []
    const next: QueuedPhoto[] = []
    for (const it of items) {
      if (it.userId === userId && isLegacyQueuePath(it.localUri)) {
        try {
          const to = await files.moveToUser(it.localUri, userId)
          moved.push({ from: it.localUri, to })
          next.push({ ...it, localUri: to })
          continue
        } catch {
          // 복사 실패 - 이 항목은 옛 경로 그대로(원본 남음 · 다음 읽기 때 다시)
        }
      }
      next.push(it)
    }
    if (moved.length === 0) return null
    return {
      items: next,
      settle: async (saved) => {
        for (const m of moved) await files.remove(saved ? m.from : m.to)
      },
    }
  }
}

export function createPhotoQueueStore(
  prefs: PrefsLike = Preferences,
  now: () => Date = () => new Date(),
  files: Pick<PhotoQueueFiles, 'moveToUser' | 'remove'> | null = photoQueueFiles,
): PhotoQueueStore {
  return {
    load: (coupleId, userId) =>
      loadQueue(prefs, chatPhotoQueueKey(coupleId, userId), 'photo', { coupleId, userId, now: now() }, convertPhotoItem, photoOwnerOf, files && userId ? legacyPhotoMover(files, userId) : undefined),
    save: (coupleId, userId, items) => saveQueue(prefs, chatPhotoQueueKey(coupleId, userId), items),
  }
}

export const photoQueueStore: PhotoQueueStore = createPhotoQueueStore()
