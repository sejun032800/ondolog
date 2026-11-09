/**
 * 이미지 저장의 한 길(F2). 결과 공유 카드(`share/resultCard.ts`)와 채팅 사진 F06(`features/chat/chatPhotoActions.ts`)이 모두 이 함수를 지난다.
 *
 * - 저장할 때마다 파일 이름이 다르다: `ondolog-<종류>-<날짜>-<시각>-<밀리초>-<무작위 4자>.<확장자>`.
 *   같은 이름 덮어쓰기와 "이전 설치가 만든 파일이라 못 쓴다"를 피한다(이름이 매번 새것이라 겹칠 일이 없다).
 *   무작위 4자는 파일 이름에만 쓰인다(연애유형 채점과 무관).
 * - 실패하면 `failed`만 돌려준다. 원인 · 경로 · 파일 이름은 로그에 남기지 않는다(호출한 쪽이 사용자 안내 토스트를 띄운다).
 */
import type { ImageFile, NativeBridge, SaveResult } from './bridge'

export type SavedImageKind = 'result' | 'chat'

const EXT_OF_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }

const two = (n: number) => String(n).padStart(2, '0')

export function extOfDataUrl(dataUrl: string): string {
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? ''
  return EXT_OF_MIME[mime] ?? 'png'
}

export function savedImageFileName(kind: SavedImageKind, now: Date, ext: string, random: () => number = Math.random): string {
  const d = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`
  const t = `${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  const r = Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')
  return `ondolog-${kind}-${d}-${t}-${ms}-${r}.${ext}`
}

export interface SaveImageDeps {
  now?: () => Date
  random?: () => number
}

/** 이미지 하나를 폰에 저장한다. 이름은 여기서 새로 정한다(받은 `fileName`은 쓰지 않는다). */
export async function saveImageToDevice(bridge: NativeBridge, image: Pick<ImageFile, 'dataUrl'>, kind: SavedImageKind, deps: SaveImageDeps = {}): Promise<SaveResult> {
  try {
    const fileName = savedImageFileName(kind, (deps.now ?? (() => new Date()))(), extOfDataUrl(image.dataUrl), deps.random)
    return await bridge.saveImage({ dataUrl: image.dataUrl, fileName })
  } catch {
    return 'failed'
  }
}

/** 저장 결과에 맞는 안내 문장. 안내가 필요 없으면(공유 시트에서 닫음) null. */
export function saveNotice(result: SaveResult, okText: string, failText: string): string | null {
  if (result === 'saved') return okText
  if (result === 'failed') return failText
  return null
}
