/**
 * 사진 고르기(E11 · E03 사진 더하기) - 웹 입력(`<input type="file" accept="image/*" multiple>`)으로 시스템 선택기를 연다.
 * RN `services/photoPicker.ts`(`expo-image-picker`)의 웹판. 라이브러리 스캔 · 얼굴 인식 없음(R13-2) - 사람이 고른 파일만 본다.
 *
 * - 원본을 그대로 쓴다: 리사이즈 · 재압축 없음. 올릴 때 읽는 바이트도 고른 파일 그대로다(`readLocalBytes`).
 * - EXIF는 허가된 라이브러리 하나(`exifr` lite)로 **촬영 시각만** 읽는다. 파일에서 필요한 칸(`DateTimeOriginal` · `DateTimeDigitized` · `DateTime` ·
 *   `OffsetTimeOriginal`과 가로세로 · 방향)만 고르고 `gps: false`로 위치 칸은 파서에 아예 요청하지 않는다. **위치 정보(GPS)는 읽지도 보내지도 않는다**
 *   (지도는 범위 밖). 그래서 `PickedPhoto.lat / lng`는 늘 null이다(RN은 읽어 `data_entries.lat/lng`에 넣었다 - 어디서도 쓰이지 않는 칸이라 뺌, HANDOFF 결정 기록).
 * - EXIF 값 -> `PickedPhoto`는 루트 `photoFromPickerAsset`(순수)을 그대로 쓴다: KST 기본 · `OffsetTimeOriginal`이 있으면 그것 · 읽을 수 없으면 null(지어내지 않음).
 *   파일의 수정 시각(`lastModified`)은 촬영 시각이 아니므로 쓰지 않는다(RN과 같음 - 시각이 없으면 오늘 날짜).
 */
import { parse as parseExif } from 'exifr/dist/lite.esm.mjs'
import { photoFromPickerAsset, type PickedPhoto } from '@/utils/dateRecord'

/** 한 번에 고를 수 있는 최대 장수(RN `PICK_LIMIT`과 같다). */
export const PICK_LIMIT = 30

/** 고른 사진 + 같은 파일을 두 번 더하지 않게 하는 열쇠(이름 · 크기 · 수정 시각). 올릴 때는 쓰이지 않는다. */
export interface WebPickedPhoto extends PickedPhoto {
  fileKey: string
}

export type ExifTags = Record<string, unknown>
/** 파일에서 필요한 EXIF 칸을 읽는다. 읽을 수 없으면 null. 시험은 가짜를 넣는다. */
export type ExifReader = (file: Blob) => Promise<ExifTags | null>
/** 사진의 가로 · 세로. 읽을 수 없으면 null. */
export type ImageSizeReader = (url: string) => Promise<{ width: number; height: number } | null>

// 태그 번호로 고른다(라이브러리의 이름 표기에 기대지 않는다 - 0x9004는 이름이 `CreateDate`다).
const TAG = { DateTime: 0x0132, Orientation: 0x0112, DateTimeOriginal: 0x9003, DateTimeDigitized: 0x9004, OffsetTimeOriginal: 0x9011, ExifImageWidth: 0xa002, ExifImageHeight: 0xa003 } as const
const IFD0_TAGS = [TAG.DateTime, TAG.Orientation]
const EXIF_TAGS = [TAG.DateTimeOriginal, TAG.DateTimeDigitized, TAG.OffsetTimeOriginal, TAG.ExifImageWidth, TAG.ExifImageHeight]

/**
 * 파일에서 필요한 칸만 읽어 **우리 이름의 작은 객체**로 돌려준다. 위치 칸은 파서에 요청하지 않고(`gps: false`), 돌려주는 객체에도 위치 이름이 없다.
 * (주의: `tiff: true`를 주면 라이브러리가 모든 IFD - 위치 포함 - 를 켜 버리므로 `tiff` 옵션은 쓰지 않고 블록마다 정한다.)
 */
export const readExifTags: ExifReader = async (file) => {
  try {
    const raw = await parseExif(file, {
      ifd0: IFD0_TAGS,
      exif: EXIF_TAGS,
      gps: false, // 위치 칸은 요청하지 않는다
      interop: false,
      ifd1: false,
      xmp: false,
      icc: false,
      iptc: false,
      jfif: false,
      ihdr: false,
      mergeOutput: true,
      translateKeys: false,
      translateValues: false,
      reviveValues: false, // 날짜를 글자("2026:10:03 14:20:11") 그대로 - 기기 시간대가 끼지 않게
      sanitize: false,
    })
    if (!raw) return null
    const out: ExifTags = {}
    for (const [name, code] of Object.entries(TAG)) {
      const v = (raw as Record<number, unknown>)[code]
      if (v !== undefined) out[name] = v
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

/** 이미지를 풀어 가로 · 세로를 읽는다(EXIF에 없을 때만). 4초 안에 못 읽으면 null. */
export const readImageSize: ImageSizeReader = (url) =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null)
      return
    }
    const img = new Image()
    const timer = window.setTimeout(() => resolve(null), 4000)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = url
  })

function positive(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

/** EXIF의 가로 · 세로(방향 5~8이면 가로세로를 맞바꾼다). 둘 다 없으면 null. */
export function exifDimensions(tags: ExifTags | null): { width: number; height: number } | null {
  if (!tags) return null
  const w = positive(tags.ExifImageWidth)
  const h = positive(tags.ExifImageHeight)
  if (w === null || h === null) return null
  const o = typeof tags.Orientation === 'number' ? tags.Orientation : 1
  return o >= 5 && o <= 8 ? { width: h, height: w } : { width: w, height: h }
}

export function fileKeyOf(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`
}

export interface PickDeps {
  readExif?: ExifReader
  readSize?: ImageSizeReader
  /** 고른 파일을 가리키는 주소를 만든다(미리보기 · 올리기 때 바이트 읽기). */
  makeUrl?: (file: File) => string
}

/** 파일 하나를 `PickedPhoto`로. 촬영 시각만 EXIF에서 가져오고 위치는 담지 않는다. */
export async function photoFromFile(file: File, deps: PickDeps = {}): Promise<WebPickedPhoto> {
  const readExif = deps.readExif ?? readExifTags
  const readSize = deps.readSize ?? readImageSize
  const url = (deps.makeUrl ?? ((f: File) => URL.createObjectURL(f)))(file)
  const tags = await readExif(file)
  const size = exifDimensions(tags) ?? (await readSize(url))
  const photo = photoFromPickerAsset({
    uri: url,
    width: size?.width ?? null,
    height: size?.height ?? null,
    fileSize: file.size,
    mimeType: file.type || null,
    fileName: file.name,
    // 시각 칸만 넘긴다 - 위치 칸은 이 객체에 없다.
    exif: tags
      ? { DateTimeOriginal: tags.DateTimeOriginal, DateTimeDigitized: tags.DateTimeDigitized, DateTime: tags.DateTime, OffsetTimeOriginal: tags.OffsetTimeOriginal }
      : null,
  })
  return { ...photo, fileKey: fileKeyOf(file) }
}

/** 시스템 사진 선택기를 연다. 고르지 않고 닫으면 빈 배열(`cancel` 이벤트를 주지 않는 웹뷰에서는 끝내 답이 없을 수 있다 - 화면은 기다리지 않는다). */
export function chooseFiles(limit: number = PICK_LIMIT, capture = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    // 카메라(채팅 F04 [카메라]): 입력의 `capture` 속성으로 시스템 카메라를 연다(한 장). 새 플러그인 · 네이티브 수정 0.
    if (capture) input.setAttribute('capture', 'environment')
    input.multiple = limit !== 1 && !capture
    input.style.display = 'none'
    const finish = (files: File[]) => {
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish(Array.from(input.files ?? []).slice(0, limit)))
    input.addEventListener('cancel', () => finish([]))
    document.body.appendChild(input)
    input.click()
  })
}

export async function pickPhotos(limit: number = PICK_LIMIT, deps: PickDeps & { choose?: (limit: number, capture: boolean) => Promise<File[]>; capture?: boolean } = {}): Promise<WebPickedPhoto[]> {
  const files = await (deps.choose ?? chooseFiles)(limit, deps.capture ?? false)
  const out: WebPickedPhoto[] = []
  // 한 장씩(큰 사진을 한꺼번에 풀지 않는다). 한 장이 읽히지 않아도 나머지는 간다.
  for (const file of files) {
    try {
      out.push(await photoFromFile(file, deps))
    } catch {
      // 읽을 수 없는 파일은 건너뛴다.
    }
  }
  return out
}

/** 올릴 때의 바이트 읽기 - 고른 파일 그대로(`blob:` 주소). RN `readLocalBytes`의 웹판. */
export async function readLocalBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri)
  return response.arrayBuffer()
}

/** 미리보기 주소를 놓아 준다. */
export function releasePhotoUrls(photos: readonly { uri: string }[]): void {
  for (const p of photos) {
    try {
      URL.revokeObjectURL(p.uri)
    } catch {
      // 이미 놓였으면 그만
    }
  }
}
