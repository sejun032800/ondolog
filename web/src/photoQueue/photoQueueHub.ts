/**
 * 사진 영속 큐 허브(RN `services/chatQueueHub.ts`의 사진 쪽 웹판, R37-2 · R39-5). 채팅의 사진 메시지 · 24시간 스토리가 쓰는 **앱을 껐다 켜도 이어 보내는 큐**다.
 * 채팅 화면(74-5)은 이 허브의 `enqueue` · `subscribe` · `getQueue`를 쓴다(글 큐는 74-5가 같은 방식으로 옆에 둔다).
 *
 * 규칙은 RN 그대로이고 같은 파일을 가져다 쓴다 - 큐 러너 `@/utils/chatPhotoQueueRunner`(백오프 2s -> 32s · 5회 · 영구 실패는 즉시 멈춤 · 같은 항목 겹침 0),
 * 한 번의 시도 `@/services/chatPhotoCore`(`attemptQueuedPhoto`), 순수 규칙 `@/utils/chatPhotoQueue`:
 *  - 다시 보내도 Storage 객체 하나 · DB 행 하나: 업로드 경로 `{couple_id}/{clientId}.{ext}`는 항목의 `clientId`에서 정해지고, "이미 있음(409)"은 성공으로 본다.
 *    메시지는 `client_msg_id = clientId`(23505 = 이미 전송), 스토리는 같은 경로의 행이 있으면 넣지 않는다.
 *  - 복사본 파일이 사라졌으면(`lost`) 서버를 부르지 않고 큐에서 뺀다.
 *  - 커플이 아니거나 로그아웃이면 `detach` - 타이머만 멈춘다. **기기 저장은 지우지 않는다**(다음 로그인에 이어 간다).
 * 같은 (커플, 사용자)로 `attach`를 여러 번 불러도 큐는 하나다(같은 항목이 두 번 올라가지 않는다).
 */
import { attemptQueuedPhoto, type AttemptedPhoto, type PhotoFs } from '@/services/chatPhotoCore'
import type { ChatDb, MessageRow, StoryRow } from '@/services/chatCore'
import type { QueuedPhoto, QueuedPhotoKind } from '@/utils/chatPhotoQueue'
import { ChatPhotoQueue } from '@/utils/chatPhotoQueueRunner'
import { generateUuidV4 } from '@/utils/uuid'
import { getSupabase } from '../auth/client'
import { photoQueueStore, type PhotoQueueStore } from './photoQueueStore'
import { webPhotoFs } from './webPhotoFs'

export interface PhotoQueueListener {
  /** 서버가 확정한 메시지 행(사진 메시지). */
  onMessage?: (row: MessageRow) => void
  onStory?: (row: StoryRow) => void
  onPhotoQueue?: (items: QueuedPhoto[]) => void
  /** 복사본이 사라져 큐에서 빠진 사진. */
  onPhotoLost?: (item: QueuedPhoto) => void
}

export interface PhotoQueueHubDeps {
  /** 한 번의 시도. 던지지 않는 것이 규칙이지만 던져도 러너가 일시 실패로 본다. */
  attempt: (item: QueuedPhoto) => Promise<AttemptedPhoto>
  fs: PhotoFs
  store: PhotoQueueStore
  newId?: () => string
  now?: () => Date
}

/** 선택기가 준 사진 중 큐에 필요한 것만. */
export interface QueueablePhoto {
  uri: string
  ext: string
  mimeType: string | null
}

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp',
}

export function contentTypeOf(photo: Pick<QueueablePhoto, 'ext' | 'mimeType'>): string {
  return photo.mimeType ?? CONTENT_TYPE[photo.ext.toLowerCase()] ?? 'image/jpeg'
}

export class PhotoQueueHub {
  private key: string | null = null
  private photo: ChatPhotoQueue | null = null
  private generation = 0
  private readonly listeners = new Set<PhotoQueueListener>()

  constructor(private readonly deps: PhotoQueueHubDeps) {}

  /** 지금 큐가 도는 (커플, 사용자). 없으면 null. */
  current(): { coupleId: string; userId: string } | null {
    if (!this.key) return null
    const [coupleId, userId] = this.key.split(':')
    return { coupleId, userId }
  }

  getPhotoQueue(): ChatPhotoQueue | null {
    return this.photo
  }

  subscribe(listener: PhotoQueueListener): () => void {
    this.listeners.add(listener)
    // 늦게 붙은 화면이 이미 있는 큐 상태를 따라잡는다.
    if (this.photo) listener.onPhotoQueue?.(this.photo.getQueue())
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 큐를 만들고 기기에서 읽은 항목을 이어서 보낸다. 같은 (커플, 사용자)이면 아무것도 하지 않는다. */
  attach(coupleId: string, userId: string): void {
    const key = `${coupleId}:${userId}`
    if (this.key === key) return
    this.detach()
    this.key = key
    const generation = ++this.generation

    const photo = new ChatPhotoQueue({
      attempt: async (item) => {
        const result = await this.deps.attempt(item)
        if (result.outcome === 'done') {
          if (result.message) for (const l of this.listeners) l.onMessage?.(result.message)
          if (result.story) for (const l of this.listeners) l.onStory?.(result.story)
        }
        return result
      },
      onChange: (items) => {
        void this.deps.store.save(coupleId, userId, items)
        for (const l of this.listeners) l.onPhotoQueue?.(items)
      },
      discard: (item) => {
        void this.deps.fs.remove(item.localUri)
      },
      onLost: (item) => {
        for (const l of this.listeners) l.onPhotoLost?.(item)
      },
    })
    this.photo = photo
    void this.deps.store.load(coupleId, userId).then((items) => {
      if (generation === this.generation) photo.hydrate(items)
    })
  }

  /** 큐를 멈춘다(타이머 정리). **기기 저장은 지우지 않는다.** */
  detach(): void {
    this.generation += 1
    this.photo?.dispose()
    const had = this.photo !== null
    this.photo = null
    this.key = null
    if (had) for (const l of this.listeners) l.onPhotoQueue?.([])
  }

  /** 앱 복귀 신호 - 남은 항목을 바로 이어서 보낸다. 큐가 없으면(커플 아님 · 로그아웃) 아무 일도 없다. 진행 중 항목은 건드리지 않는다. */
  kick(): void {
    this.photo?.kick()
  }

  /**
   * 고른 사진을 앱 데이터 폴더에 복사해 큐 항목으로 만들고 **바로 한 번 시도**한다. 큐가 없거나(커플 아님) 복사하지 못하면 null.
   * 시도가 실패해도 항목은 큐에 남아 이어서 시도한다 - 반환값 `outcome`은 첫 시도의 결과.
   */
  async enqueue(photo: QueueablePhoto, kind: QueuedPhotoKind): Promise<{ item: QueuedPhoto; outcome: Awaited<ReturnType<ChatPhotoQueue['add']>> } | null> {
    const queue = this.photo
    const target = this.current()
    if (!queue || !target) return null
    const clientId = (this.deps.newId ?? generateUuidV4)()
    let localUri: string
    try {
      localUri = await this.deps.fs.copyIn(photo.uri, clientId, photo.ext)
    } catch {
      return null
    }
    const item: QueuedPhoto = {
      clientId,
      kind,
      coupleId: target.coupleId,
      userId: target.userId,
      localUri,
      ext: photo.ext,
      contentType: contentTypeOf(photo),
      sentAt: (this.deps.now ?? (() => new Date()))().toISOString(),
      retryCount: 0,
      status: 'pending',
    }
    return { item, outcome: await queue.add(item) }
  }
}

/** 앱의 허브 하나. 서버는 웹 클라이언트, 파일은 Filesystem, 저장은 Preferences. */
export const photoQueueHub = new PhotoQueueHub({
  attempt: async (item) => {
    const db = getSupabase()
    if (!db) return { outcome: 'retry' }
    return attemptQueuedPhoto(db as unknown as ChatDb, item, webPhotoFs)
  },
  fs: webPhotoFs,
  store: photoQueueStore,
})
