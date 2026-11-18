/**
 * 사진 영속 큐의 복사본 파일 접근(RN `services/photoQueueFs.ts`의 웹판) - `@capacitor/filesystem`(이미 있는 1차 플러그인)의 `Directory.Data`에 둔다.
 *
 * 고른 사진(`blob:` 주소 - 선택기가 준 파일)을 앱 데이터 폴더의 `chat-photo-queue/{userId}/{clientId}.{ext}`로 복사한다(83-: 사용자별 폴더). 선택기가 준 주소는 앱이 꺼지면 사라지기 때문이다.
 * 항목이 끝나면(성공 · 취소 · 사라짐) 복사본을 지운다. `localUri`는 이 폴더 안의 상대 경로 한 줄이다.
 * 83-(R121-3): 83- 이전 파일은 `chat-photo-queue/{clientId}.{ext}`(폴더 바로 아래 - "옛 자리"). 처음 읽을 때 주인 폴더로 옮긴다(`photoQueueStore`).
 *   계정 전환 때 이전 주인 폴더째 지운다(`cache/queueOwner` - 저장값이 깨져도 폴더 기준).
 * 왜 Filesystem인가(IndexedDB가 아니라): 안드로이드에서 앱 데이터 폴더의 실제 파일이라 웹뷰 저장소 정리에 휩쓸리지 않고(RN `Paths.document`와 같은 성격), 큐 항목 목록은
 * 이미 로그인 세션이 쓰는 Preferences(SharedPreferences)에 둔다 - 둘 다 RN 구조 그대로(파일 + 키 저장). 브라우저 개발 서버에서는 플러그인이 IndexedDB로 대신한다.
 */
import { Directory, Filesystem } from '@capacitor/filesystem'
import type { PhotoFs } from '@/services/chatPhotoCore'

export const QUEUE_DIR = 'chat-photo-queue'

/** 83-: 사용자 폴더(`chat-photo-queue/{userId}`). */
export function userQueueDir(userId: string): string {
  return `${QUEUE_DIR}/${userId}`
}
/** 83-: 83- 이전 자리(`chat-photo-queue/{파일}` - 사용자 폴더 없이 바로 아래)인가. */
export function isLegacyQueuePath(uri: string): boolean {
  if (!uri.startsWith(`${QUEUE_DIR}/`)) return false
  const rest = uri.slice(QUEUE_DIR.length + 1)
  return rest.length > 0 && !rest.includes('/')
}

/** 시험이 바꿔 끼우는 최소 모양(플러그인 중 쓰는 것만). */
export interface FilesystemLike {
  writeFile: (o: { path: string; data: string; directory: Directory; recursive?: boolean }) => Promise<unknown>
  readFile: (o: { path: string; directory: Directory }) => Promise<{ data: string | Blob }>
  stat: (o: { path: string; directory: Directory }) => Promise<unknown>
  deleteFile: (o: { path: string; directory: Directory }) => Promise<unknown>
  /** 83-(폴더 정리). 없는 가짜는 정리를 건너뛴다. */
  readdir?: (o: { path: string; directory: Directory }) => Promise<{ files: { name: string; type: 'file' | 'directory' }[] }>
  rmdir?: (o: { path: string; directory: Directory; recursive?: boolean }) => Promise<unknown>
}

/** 83-: 사진 대기열 폴더 다루기(옮기기 · 폴더 정리). 던지는 것은 `moveToUser`뿐(실패 = 원본 그대로). */
export interface PhotoQueueFiles {
  /** 옛 자리 파일을 `userId` 폴더로 **복사**하고 새 경로를 돌려준다(원본은 지우지 않음 - 저장값을 바꾼 뒤 `remove`). 실패하면 던진다. */
  moveToUser: (uri: string, userId: string) => Promise<string>
  remove: (uri: string) => Promise<void>
  /** 대기열 폴더 바로 아래 항목. 못 읽으면 null(모름 - 아무것도 지우지 않는다). 폴더가 없으면 빈 목록. */
  list: () => Promise<{ name: string; type: 'file' | 'directory' }[] | null>
  /** 사용자 폴더째 지운다. 지웠으면 true. */
  removeUserDir: (userId: string) => Promise<boolean>
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했어요'))
    reader.onload = () => {
      const text = String(reader.result ?? '')
      resolve(text.slice(text.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

/** 웹 쪽 파일 접근 - 공통 `PhotoFs`(RN과 같은 모양) + 83- 사용자 폴더에 복사(`copyInFor`). */
export interface WebPhotoFs extends PhotoFs {
  copyInFor: (userId: string, sourceUri: string, clientId: string, ext: string) => Promise<string>
}

export function createWebPhotoFs(fs: FilesystemLike = Filesystem as unknown as FilesystemLike): WebPhotoFs {
  const write = async (dir: string, sourceUri: string, clientId: string, ext: string) => {
    const blob = await (await fetch(sourceUri)).blob()
    const path = `${dir}/${clientId}.${ext}`
    await fs.writeFile({ path, data: await blobToBase64(blob), directory: Directory.Data, recursive: true })
    return path
  }
  return {
    /** 공통 모양(사용자 모름) - 웹 허브는 `copyInFor`를 쓴다. */
    copyIn: (sourceUri, clientId, ext) => write(QUEUE_DIR, sourceUri, clientId, ext),
    copyInFor: (userId, sourceUri, clientId, ext) => write(userQueueDir(userId), sourceUri, clientId, ext),
    async exists(uri) {
      try {
        await fs.stat({ path: uri, directory: Directory.Data })
        return true
      } catch {
        return false
      }
    },
    async readBytes(uri) {
      const { data } = await fs.readFile({ path: uri, directory: Directory.Data })
      return typeof data === 'string' ? base64ToBuffer(data) : data.arrayBuffer()
    },
    async remove(uri) {
      try {
        await fs.deleteFile({ path: uri, directory: Directory.Data })
      } catch {
        // 이미 없거나 지울 수 없어도 큐 동작에는 영향이 없다.
      }
    },
  }
}

/** 83-: 옮기기(읽어서 같은 방식으로 씀 - `copyIn`이 이미 쓰는 길) · 폴더 목록 · 폴더째 지우기. */
export function createPhotoQueueFiles(fs: FilesystemLike = Filesystem as unknown as FilesystemLike): PhotoQueueFiles {
  return {
    async moveToUser(uri, userId) {
      const name = uri.slice(uri.lastIndexOf('/') + 1)
      const to = `${userQueueDir(userId)}/${name}`
      const { data } = await fs.readFile({ path: uri, directory: Directory.Data })
      const base64 = typeof data === 'string' ? data : await blobToBase64(data)
      await fs.writeFile({ path: to, data: base64, directory: Directory.Data, recursive: true })
      await fs.stat({ path: to, directory: Directory.Data }) // 실제로 생겼는지
      return to
    },
    async remove(uri) {
      try {
        await fs.deleteFile({ path: uri, directory: Directory.Data })
      } catch {
        // 이미 없거나 지울 수 없음
      }
    },
    async list() {
      if (!fs.readdir) return null
      try {
        await fs.stat({ path: QUEUE_DIR, directory: Directory.Data })
      } catch {
        return [] // 폴더가 아직 없다(사진을 보낸 적 없음)
      }
      try {
        const { files } = await fs.readdir({ path: QUEUE_DIR, directory: Directory.Data })
        return files.map((f) => ({ name: f.name, type: f.type }))
      } catch {
        return null
      }
    },
    async removeUserDir(userId) {
      if (!fs.rmdir || !userId || userId.includes('/') || userId === '.' || userId === '..') return false
      try {
        await fs.rmdir({ path: userQueueDir(userId), directory: Directory.Data, recursive: true })
        return true
      } catch {
        return false
      }
    },
  }
}

export const webPhotoFs: WebPhotoFs = createWebPhotoFs()
export const photoQueueFiles: PhotoQueueFiles = createPhotoQueueFiles()
