/**
 * 사진 영속 큐의 복사본 파일 접근(RN `services/photoQueueFs.ts`의 웹판) - `@capacitor/filesystem`(이미 있는 1차 플러그인)의 `Directory.Data`에 둔다.
 *
 * 고른 사진(`blob:` 주소 - 선택기가 준 파일)을 앱 데이터 폴더의 `chat-photo-queue/{clientId}.{ext}`로 복사한다. 선택기가 준 주소는 앱이 꺼지면 사라지기 때문이다.
 * 항목이 끝나면(성공 · 취소 · 사라짐) 복사본을 지운다. `localUri`는 이 폴더 안의 상대 경로 한 줄이다.
 * 왜 Filesystem인가(IndexedDB가 아니라): 안드로이드에서 앱 데이터 폴더의 실제 파일이라 웹뷰 저장소 정리에 휩쓸리지 않고(RN `Paths.document`와 같은 성격), 큐 항목 목록은
 * 이미 로그인 세션이 쓰는 Preferences(SharedPreferences)에 둔다 - 둘 다 RN 구조 그대로(파일 + 키 저장). 브라우저 개발 서버에서는 플러그인이 IndexedDB로 대신한다.
 */
import { Directory, Filesystem } from '@capacitor/filesystem'
import type { PhotoFs } from '@/services/chatPhotoCore'

export const QUEUE_DIR = 'chat-photo-queue'

/** 시험이 바꿔 끼우는 최소 모양(플러그인 중 쓰는 것만). */
export interface FilesystemLike {
  writeFile: (o: { path: string; data: string; directory: Directory; recursive?: boolean }) => Promise<unknown>
  readFile: (o: { path: string; directory: Directory }) => Promise<{ data: string | Blob }>
  stat: (o: { path: string; directory: Directory }) => Promise<unknown>
  deleteFile: (o: { path: string; directory: Directory }) => Promise<unknown>
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

export function createWebPhotoFs(fs: FilesystemLike = Filesystem as unknown as FilesystemLike): PhotoFs {
  return {
    async copyIn(sourceUri, clientId, ext) {
      const blob = await (await fetch(sourceUri)).blob()
      const path = `${QUEUE_DIR}/${clientId}.${ext}`
      await fs.writeFile({ path, data: await blobToBase64(blob), directory: Directory.Data, recursive: true })
      return path
    },
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

export const webPhotoFs: PhotoFs = createWebPhotoFs()
