/**
 * 피드 사진 고르기 -> 읽기 -> 앱 소유 복사본(74-h4 F1).
 *
 * 왜: 웹 피드는 선택기가 준 파일 참조(`blob:` 주소)를 저장 순간까지 들고 있다가 그때 읽었다. WebView에서 그 참조가 읽히지 않아 업로드가 네트워크에 닿기도 전에 실패했다.
 * (채팅은 고른 직후 앱 데이터 폴더로 복사하고 복사본만 읽어서 성공한다 - RN 피드도 `expo-image-picker`가 앱 캐시에 복사한 file://만 읽는다.)
 *
 * 고치는 방향: **선택기 `File`은 고르는 단계에서 한 번만, `File` 자체로(`arrayBuffer()` / FileReader) 읽는다 - 선택기 `blob:` 주소를 `fetch`하지 않는다.**
 * 읽은 바이트로
 *  (a) 앱 소유 미리보기 `blob:`(새 Blob에서 만든 주소) - 썸네일 · 가로세로 읽기에 쓴다.
 *  (b) 업로드용 출처 - `@capacitor/filesystem` 앱 캐시 폴더의 복사본(`feed-photo-picks/{id}.{ext}`, 채팅 큐 폴더와 분리). 큰 사진 여러 장을 메모리에 쥐지 않는다.
 *      복사에 실패하면 그 사진만 메모리에 바이트를 둔다(읽기 실패로 버리지 않는다).
 * 업로드 때 `readStagedBytes(uri)`가 복사본(또는 메모리 바이트)을 읽는다. 저장 성공 / 시트 닫힘 / 사진 빼기 때 `releaseStaged`가 복사본과 미리보기 주소를 정리한다.
 * EXIF는 같은 읽은 바이트에서 - `photoFromFile` 규칙 그대로(촬영 시각만, 위치는 읽지 않는다 - R76-4).
 * 읽기에 실패한 사진은 `failed: true` 자리표시로 돌려준다(화면이 "다시 고르기"를 그린다). 저장 대상에서는 빠진다.
 */
import { Directory, Filesystem } from '@capacitor/filesystem'
import { IS_TRIAL_BUILD } from '../../config/env'
import { safeKind, useTrialDiag } from '../../platform/trialDiag'
import type { FilesystemLike } from '../../photoQueue/webPhotoFs'
import { chooseFiles, fileKeyOf, PICK_LIMIT, photoFromFile, readExifTags, readImageSize, type ExifReader, type ImageSizeReader, type WebPickedPhoto } from './photoPicker'

export const FEED_PICK_DIR = 'feed-photo-picks'

/** 고른 사진 한 장 - 읽기에 실패했으면 `failed`(저장 대상 아님, 미리보기 없음). */
export type StagedPhoto = WebPickedPhoto & { failed?: boolean }

export interface StageDeps {
  fs?: FilesystemLike
  readExif?: ExifReader
  readSize?: ImageSizeReader
  newId?: () => string
  /** 앱 소유 Blob -> 미리보기 주소. */
  makeUrl?: (blob: Blob) => string
  revokeUrl?: (url: string) => void
  now?: () => Date
}

type Source = { path: string } | { bytes: ArrayBuffer }
/** 미리보기 주소 -> 업로드용 출처. */
const sources = new Map<string, Source>()

let idSeq = 0
function defaultId(): string {
  idSeq += 1
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${idSeq}`
  return rand.replace(/[^A-Za-z0-9_-]/g, '')
}

/** `File` 자체를 읽는다(선택기 주소를 fetch하지 않는다). `arrayBuffer()`가 없거나 던지면 FileReader로 한 번 더. */
export async function readFileBytes(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    try {
      return await file.arrayBuffer()
    } catch {
      // FileReader로 다시
    }
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read'))
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.readAsArrayBuffer(file)
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read'))
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

function failedPlaceholder(file: File): StagedPhoto {
  return { uri: '', width: null, height: null, byteSize: null, mimeType: file.type || null, ext: 'jpg', capturedAt: null, lat: null, lng: null, fileKey: fileKeyOf(file), failed: true }
}

/** 고른 파일들을 앱이 가진 바이트/복사본으로 옮긴다. 한 장씩(큰 사진을 한꺼번에 풀지 않는다). 한 장이 안 읽혀도 나머지는 간다. */
export async function stageFiles(files: readonly File[], capture: boolean, deps: StageDeps = {}): Promise<StagedPhoto[]> {
  const fs = deps.fs ?? (Filesystem as unknown as FilesystemLike)
  const readExif = deps.readExif ?? readExifTags
  const makeUrl = deps.makeUrl ?? ((b: Blob) => URL.createObjectURL(b))
  const newId = deps.newId ?? defaultId
  const now = deps.now ?? (() => new Date())
  const out: StagedPhoto[] = []
  for (const file of files) {
    let previewUrl: string | null = null
    try {
      const bytes = await readFileBytes(file)
      if (bytes.byteLength === 0) throw new Error('empty')
      const own = new Blob([bytes], { type: file.type })
      const url = makeUrl(own)
      previewUrl = url
      const photo = await photoFromFile(file, { readExif: () => readExif(own), readSize: deps.readSize ?? readImageSize, makeUrl: () => url })
      // 카메라로 찍은 사진은 EXIF 촬영 시각이 없으면 지금 시각으로(웹 입력 capture는 EXIF를 안 남기는 기기가 있다).
      const stamped: StagedPhoto = capture && photo.capturedAt === null ? { ...photo, capturedAt: now().toISOString() } : photo
      let source: Source
      try {
        const path = `${FEED_PICK_DIR}/${newId()}.${stamped.ext}`
        await fs.writeFile({ path, data: await blobToBase64(own), directory: Directory.Cache, recursive: true })
        source = { path }
      } catch {
        source = { bytes } // 복사하지 못한 사진만 메모리에 둔다
      }
      sources.set(url, source)
      out.push(stamped)
    } catch (e) {
      if (previewUrl) {
        try { (deps.revokeUrl ?? ((u: string) => URL.revokeObjectURL(u)))(previewUrl) } catch { /* 이미 놓였으면 그만 */ }
      }
      if (IS_TRIAL_BUILD) useTrialDiag.getState().recordPhoto('read', safeKind(e))
      out.push(failedPlaceholder(file))
    }
  }
  return out
}

/** 입구 시트에서 고른 길(앨범 / 카메라)로 선택기를 열어 앱 소유 복사본까지 만든다. */
export async function pickFeedPhotos(capture: boolean, deps: StageDeps & { choose?: (limit: number, capture: boolean) => Promise<File[]> } = {}): Promise<StagedPhoto[]> {
  let files: File[]
  try {
    files = await (deps.choose ?? chooseFiles)(capture ? 1 : PICK_LIMIT, capture)
  } catch (e) {
    if (IS_TRIAL_BUILD) useTrialDiag.getState().recordPhoto('pick', safeKind(e))
    throw e
  }
  return stageFiles(files, capture, deps)
}

/** 업로드 때의 바이트 읽기(`recordDate`의 `readBytes`). 선택기 주소는 건드리지 않고 앱이 가진 복사본만 읽는다. */
export async function readStagedBytes(uri: string, fs: FilesystemLike = Filesystem as unknown as FilesystemLike): Promise<ArrayBuffer> {
  const source = sources.get(uri)
  if (!source) throw new Error('not_staged')
  if ('bytes' in source) return source.bytes
  const { data } = await fs.readFile({ path: source.path, directory: Directory.Cache })
  return typeof data === 'string' ? base64ToBuffer(data) : data.arrayBuffer()
}

/** 복사본을 지우고 미리보기 주소를 놓는다(여러 번 불러도 된다). */
export function releaseStaged(photos: readonly { uri: string }[], fs: FilesystemLike = Filesystem as unknown as FilesystemLike, revoke: (url: string) => void = (u) => URL.revokeObjectURL(u)): void {
  for (const p of photos) {
    if (!p.uri) continue
    const source = sources.get(p.uri)
    if (!source) continue // 이미 정리했거나 이 부품이 만든 사진이 아니다
    sources.delete(p.uri)
    try { revoke(p.uri) } catch { /* 이미 놓였으면 그만 */ }
    if ('path' in source) {
      void Promise.resolve()
        .then(() => fs.deleteFile({ path: source.path, directory: Directory.Cache }))
        .catch(() => { /* 이미 없거나 지울 수 없어도 저장에는 영향이 없다 */ })
    }
  }
}

/** 시험 · 점검용: 지금 쥐고 있는 출처 수. */
export function stagedCount(): number {
  return sources.size
}
