/**
 * HEIC 막기 (R94-2) - 채팅 · 스토리 · 피드가 모두 지나는 사진 고르기 입구(`chooseFiles`)에서 한 번만 건다.
 *
 * 판정은 **파일 앞 바이트**로만 한다. 확장자 · MIME 문자열은 믿지 않는다(이름이 `.jpg`이고 형식이 `image/jpeg`라고 적혀 있어도 속이 HEIC일 수 있다).
 * 형식: ISO-BMFF 파일 맨 앞 `ftyp` 상자(바이트 4~8이 `ftyp`, 8~12가 주 브랜드, 16부터 호환 브랜드 4바이트씩).
 *
 * 결정(문서화):
 *  - HEIC 고유 브랜드(`heic` `heix` `hevc` `hevx` `heim` `heis` `hevm` `hevs` `heif`)가 주 브랜드나 호환 브랜드에 하나라도 있으면 HEIC.
 *  - 범용 브랜드(`mif1` `msf1`)는 HEIC · AVIF가 함께 쓴다. 주 브랜드가 이것이고 AVIF 브랜드(`avif` `avis`)가 없으면 HEIC으로 본다(애플 · 안드로이드 HEIC의 흔한 꼴).
 *  - AVIF(`avif` `avis`)는 HEIC이 아니다 - 막지 않는다(브라우저가 풀 수 있어 `stripLocation`이 다시 인코딩한다).
 */
import { showToast } from '../stores/toastStore'

export const HEIC_NOTICE = '이 사진은 아직 올릴 수 없는 형식이에요(HEIC). JPEG로 저장된 사진을 골라 주세요.'

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'heif']
const GENERIC_BRANDS = ['mif1', 'msf1']
const AVIF_BRANDS = ['avif', 'avis']
/** 읽는 앞 바이트 수(ftyp 상자는 보통 수십 바이트). */
const HEAD_BYTES = 256

function brandAt(u8: Uint8Array, at: number): string {
  return String.fromCharCode(u8[at], u8[at + 1], u8[at + 2], u8[at + 3])
}

/** 앞 바이트가 HEIC/HEIF 이미지인가. */
export function isHeicBytes(u8: Uint8Array): boolean {
  if (u8.length < 12 || brandAt(u8, 4) !== 'ftyp') return false
  const major = brandAt(u8, 8)
  const size = (u8[0] * 0x1000000) + (u8[1] << 16) + (u8[2] << 8) + u8[3]
  // 상자 크기가 이상하면(0 · 1 · 너무 작음) 주 브랜드만 본다. 아니면 호환 브랜드(16부터)까지 본다.
  const end = size >= 16 && size <= u8.length ? size : 12
  const brands = [major]
  for (let at = 16; at + 4 <= end; at += 4) brands.push(brandAt(u8, at))
  if (brands.some((b) => HEIC_BRANDS.includes(b))) return true
  return GENERIC_BRANDS.includes(major) && !brands.some((b) => AVIF_BRANDS.includes(b))
}

function readHead(file: Blob): Promise<Uint8Array> {
  const head = file.slice(0, HEAD_BYTES)
  if (typeof head.arrayBuffer === 'function') return head.arrayBuffer().then((b) => new Uint8Array(b))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read'))
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(head)
  })
}

/** 파일이 HEIC인가(앞 바이트). 읽을 수 없으면 false - 뒤 단계가 어차피 못 읽은 사진으로 다룬다. */
export async function isHeicFile(file: Blob): Promise<boolean> {
  try {
    return isHeicBytes(await readHead(file))
  } catch {
    return false
  }
}

/** 안내 문구. 한 장만 골랐으면 정해진 문장 그대로, 여러 장이면 빠진 장 수를 덧붙인다. */
export function heicNoticeText(dropped: number, total: number): string {
  return total <= 1 ? HEIC_NOTICE : `${HEIC_NOTICE} ${dropped}장은 뺐어요.`
}

/** HEIC만 빼고 나머지를 돌려준다(순서 유지). */
export async function dropHeic<T extends Blob>(files: readonly T[]): Promise<{ kept: T[]; dropped: number }> {
  const kept: T[] = []
  for (const f of files) if (!(await isHeicFile(f))) kept.push(f)
  return { kept, dropped: files.length - kept.length }
}

/** 고른 파일에서 HEIC를 빼고, 뺐으면 안내를 띄운다. 채팅 · 스토리 · 피드 공통 입구. */
export async function guardPickedFiles<T extends Blob>(files: readonly T[], notify: (message: string) => void = showToast): Promise<T[]> {
  const { kept, dropped } = await dropHeic(files)
  if (dropped > 0) notify(heicNoticeText(dropped, files.length))
  return kept
}
