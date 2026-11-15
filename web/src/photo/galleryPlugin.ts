/**
 * A-21 공용 사진 시트 [앨범] -> `@capacitor/camera`(8.2.6) `chooseFromGallery`(여러 장)로 고르는 길.
 *
 * **지금 켜져 있는 방식 = `'input'`(웹 입력 `<input type=file>`)**. 이유(결정 기록):
 *  - 이 플러그인의 갤러리 고르기가 돌려주는 파일에 EXIF 촬영 시각(DateTimeOriginal)이 남는지는 **기기 없이 확인할 수 없다**(플러그인은 닫힌 라이브러리
 *    `ioncamera-android`를 거치고, 안드로이드 사진 선택기는 위치만 가리고 시각은 두는 것이 보통이지만 이 경로가 다시 인코딩하는지는 미확인).
 *    "촬영 시각이 빠지는 길은 내보내지 않는다"(A-21 조건)에 따라 확인 전에는 `'input'`을 유지한다.
 *  - 켜려면 폰에서 (1) 이 값을 `'plugin'`으로 (2) `npx cap sync` (3) 시험 빌드로 "10월에 찍은 사진 -> 피드 기록 날짜가 10월로 채워짐 · 같은 사진을 두 방식으로 골라 비교"를 확인한다.
 *
 * 켜졌을 때도: 플러그인이 돌려준 **바이트는 지금과 같은 길**(`pickPhotos` · `pickFeedPhotos` -> 촬영 시각 읽기 -> `stripLocation`)을 탄다 - GPS 제거는 그대로 적용된다.
 * 플러그인이 쓸 수 없거나 실패하면(사용자 취소 제외) `null`을 돌려 호출한 쪽이 웹 입력으로 되돌아간다. 사용자 취소는 빈 배열.
 * 안드로이드 매니페스트 변경: **불필요**(플러그인 매니페스트가 `<queries>`만 더한다. 갤러리 고르기는 CAMERA 권한을 쓰지 않는다. 안드로이드 9 이하만 저장소 읽기 권한을 요청하며 선언돼 있을 때만).
 */
import { Capacitor } from '@capacitor/core'
import { Camera, MediaTypeSelection, type MediaResult } from '@capacitor/camera'

export type GalleryMode = 'input' | 'plugin'
/** 스위치. 폰에서 촬영 시각이 남는 것을 확인하기 전에는 `'input'`. */
export const GALLERY_MODE: GalleryMode = 'input'

export interface GalleryDeps {
  mode?: GalleryMode
  isNative?: () => boolean
  choose?: (opts: { limit: number; multiple: boolean }) => Promise<{ results: Pick<MediaResult, 'webPath' | 'uri'>[] }>
  /** 플러그인이 준 주소의 바이트를 읽는다. */
  load?: (webPath: string) => Promise<Blob>
}

function isCancel(err: unknown): boolean {
  const text = `${(err as { message?: string } | null)?.message ?? ''} ${(err as { code?: string } | null)?.code ?? ''}`.toLowerCase()
  return text.includes('cancel') || text.includes('dismiss')
}

function nameFor(index: number, blob: Blob): string {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  return `gallery-${Date.now().toString(36)}-${index + 1}.${ext}`
}

/** `null` = 이 길을 쓸 수 없다(웹 입력으로 되돌아간다) · 빈 배열 = 사용자가 취소했다. */
export async function chooseViaGalleryPlugin(limit: number, deps: GalleryDeps = {}): Promise<File[] | null> {
  if ((deps.mode ?? GALLERY_MODE) !== 'plugin') return null
  if (!(deps.isNative ?? (() => Capacitor.isNativePlatform()))()) return null
  const multiple = limit !== 1
  try {
    const choose = deps.choose ?? ((o) => Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, allowMultipleSelection: o.multiple, limit: o.multiple ? o.limit : 1, includeMetadata: false, correctOrientation: false, quality: 100 }))
    const { results } = await choose({ limit, multiple })
    const load = deps.load ?? (async (p: string) => (await fetch(p)).blob())
    const files: File[] = []
    for (const [i, r] of results.slice(0, limit).entries()) {
      const src = r.webPath ?? r.uri
      if (!src) continue
      try {
        const blob = await load(src)
        files.push(new File([blob], nameFor(i, blob), { type: blob.type || 'image/jpeg' }))
      } catch {
        // 한 장이 안 읽혀도 나머지는 간다
      }
    }
    return files
  } catch (err) {
    return isCancel(err) ? [] : null
  }
}
