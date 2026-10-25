/**
 * 사진 영속 큐의 복사본 파일 접근 - `expo-file-system`의 현재 API(`File` · `Directory` · `Paths`)를 쓴다(`expo-file-system/legacy` 아님, R38-5).
 *
 * 고른 사진을 **앱 문서 폴더**(`Paths.document`, 시스템이 지우지 않는 곳)의 `chat-photo-queue/{clientId}.{ext}`로 복사한다. 선택 화면이 돌려준
 * 주소는 캐시 안이라 앱이 꺼진 사이 지워질 수 있기 때문이다. 항목이 끝나면(성공 · 취소 · 사라짐) 복사본을 지운다.
 */
import { Directory, File, Paths } from 'expo-file-system'
import type { PhotoFs } from './chatPhotoCore'

const QUEUE_DIR = 'chat-photo-queue'

export const photoQueueFs: PhotoFs = {
  async copyIn(sourceUri, clientId, ext) {
    const dir = new Directory(Paths.document, QUEUE_DIR)
    dir.create({ idempotent: true, intermediates: true })
    const destination = new File(dir, `${clientId}.${ext}`)
    await new File(sourceUri).copy(destination, { overwrite: true })
    return destination.uri
  },
  exists(uri) {
    return new File(uri).exists
  },
  readBytes(uri) {
    return new File(uri).arrayBuffer()
  },
  remove(uri) {
    try {
      const file = new File(uri)
      if (file.exists) file.delete()
    } catch {
      // 이미 없거나 지울 수 없어도 큐 동작에는 영향이 없다.
    }
  },
}
