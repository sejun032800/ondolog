/**
 * A-21 공용 사진 시트 [앨범] -> `@capacitor/camera`(8.2.6) `chooseFromGallery`(여러 장)로 고르는 길.
 *
 * **스위치(R94-5): 시험 빌드(`npm run build:trial` = `--mode trial`, 개발 서버 포함)에서만 `'plugin'`, 운영 빌드(`npm run build`)는 `'input'`(웹 입력 `<input type=file>`).**
 * 판정은 `config/env.ts`의 `IS_TRIAL_BUILD`(빌드 때 정해지는 상수)를 따른다 - 이 파일 맨 아래 `GALLERY_MODE` 한 줄이 스위치다.
 * 끄는 법: `GALLERY_MODE`를 `'input'`으로 고정한다(`export const GALLERY_MODE: GalleryMode = 'input'`) 후 다시 빌드 + `npx cap sync`.
 * 이유(결정 기록): 이 플러그인의 갤러리 고르기가 돌려주는 파일에 EXIF 촬영 시각(DateTimeOriginal)이 남는지는 **기기 없이 확인할 수 없다**(플러그인은 닫힌 라이브러리
 *  `ioncamera-android`를 거친다). "촬영 시각이 빠지는 길은 내보내지 않는다"(A-21 조건)에 따라 운영 빌드는 `'input'`, 시험 빌드에서 `51-` B1 · B14로 폰 B 촬영 시각을 확인한 뒤 PM이 확정한다.
 *
 * 켜졌을 때도: 플러그인이 돌려준 **바이트는 지금과 같은 길**(`chooseFiles`의 HEIC 막기 -> `pickPhotos` · `pickFeedPhotos` -> 촬영 시각 읽기 -> `stripLocation`)을 탄다 - GPS 제거는 그대로 적용된다.
 * 플러그인이 쓸 수 없거나 실패하면(사용자 취소 제외) `null`을 돌려 호출한 쪽이 웹 입력으로 되돌아간다. 사용자 취소는 빈 배열.
 * 안드로이드 매니페스트 변경: **불필요**(플러그인 매니페스트가 `<queries>`만 더한다. 갤러리 고르기는 CAMERA 권한을 쓰지 않는다. 안드로이드 9 이하만 저장소 읽기 권한을 요청하며 선언돼 있을 때만).
 */
import { Capacitor } from '@capacitor/core'
import { Camera, MediaTypeSelection, type MediaResult } from '@capacitor/camera'
import { IS_TRIAL_BUILD } from '../config/env'

export type GalleryMode = 'input' | 'plugin'
/** 빌드 종류 -> 갤러리 길. 시험 빌드만 플러그인. */
export function galleryModeFor(trial: boolean): GalleryMode {
  return trial ? 'plugin' : 'input'
}

/** 스위치(R94-5). 운영 빌드는 `'input'`. 끄려면 `'input'`으로 고정. */
export const GALLERY_MODE: GalleryMode = galleryModeFor(IS_TRIAL_BUILD)

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
