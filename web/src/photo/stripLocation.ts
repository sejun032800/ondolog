/**
 * 사진 위치(GPS) 제거 - 순수 모듈 (R93-4).
 *
 * 고른 파일의 바이트를 처음 읽는 자리에서 한 번만 불러, 이후 모든 업로드 길(채팅 · 스토리 · 피드)이 위치 없는 바이트만 갖게 한다.
 * (촬영 시각은 호출하는 쪽이 원본 파일에서 먼저 읽는다 - 이 모듈은 그 뒤의 바이트만 다룬다.)
 *
 * 방법
 *  1. JPEG: 다시 인코딩하지 않는다. APP1 Exif의 IFD0에서 GPS 포인터(0x8825) 항목을 빼고(뒤 항목을 위로 당기고 개수 -1, 다음 IFD 오프셋 유지, 비는 12바이트 0),
 *     GPS IFD 바이트(항목 + 값)를 0으로 지운다. 방향 · 촬영 시각 태그는 그대로. 위치 키가 든 XMP APP1은 세그먼트째 뺀다. II / MM 둘 다.
 *  2. PNG: eXIf 청크와 위치 키가 든 XMP iTXt 청크를 청크째 뺀다(CRC는 건드리지 않는다).
 *     그 밖의 형식(WebP 등)이나 1·2번이 안전하게 해석하지 못한 입력은 디코드 -> 방향 적용 -> 캔버스로 다시 인코딩(가로세로 그대로, 메타데이터 전부 사라짐).
 *  3. HEIC/HEIF: 건드리지 않는다(바이트 그대로 통과) - PM 결정 대기(JPEG 변환 여부).
 *  GIF도 통과(사진 위치를 담는 일이 사실상 없고, 다시 인코딩하면 움직임이 사라진다).
 *
 * 깨진 입력은 던지지 않고 다음 방법으로 넘어간다. 마지막 방법(캔버스)까지 실패하면 던진다 - 위치가 남은 바이트를 몰래 올리지 않기 위해서다.
 */

export type StripMethod = 'jpeg-edit' | 'png-edit' | 'reencode' | 'passthrough-heic' | 'passthrough-gif' | 'unchanged'

export interface StripResult {
  bytes: ArrayBuffer
  mimeType: string
  method: StripMethod
}

export interface StripDeps {
  /** 캔버스 재인코딩(테스트가 가짜를 넣는다). */
  reencode?: (bytes: ArrayBuffer, mimeType: string) => Promise<{ bytes: ArrayBuffer; mimeType: string }>
}

class ParseError extends Error {}

const TAG_GPS_IFD = 0x8825
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8 }

/** 위치를 담을 수 있는 XMP 키. */
const XMP_LOCATION_KEYS = /exif:GPS|GPSLatitude|GPSLongitude|photoshop:(City|State|Country)|Iptc4xmpCore:Location|Iptc4xmpExt:Location(Shown|Created)/

const XMP_NS = 'http://ns.adobe.com/xap/1.0/\0'
const XMP_EXT_NS = 'http://ns.adobe.com/xmp/extension/\0'

function asciiAt(u8: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > u8.length) return false
  for (let i = 0; i < text.length; i += 1) if (u8[offset + i] !== text.charCodeAt(i)) return false
  return true
}

function latin1(u8: Uint8Array, start: number, end: number): string {
  let s = ''
  for (let i = start; i < end; i += 1) s += String.fromCharCode(u8[i])
  return s
}

export function sniffFormat(u8: Uint8Array): 'jpeg' | 'png' | 'heic' | 'gif' | 'other' {
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'jpeg'
  if (u8.length >= 8 && u8[0] === 0x89 && asciiAt(u8, 1, 'PNG\r\n\x1a\n')) return 'png'
  if (asciiAt(u8, 0, 'GIF8')) return 'gif'
  if (u8.length >= 12 && asciiAt(u8, 4, 'ftyp')) {
    const brand = latin1(u8, 8, 12)
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'heif'].includes(brand)) return 'heic'
  }
  return 'other'
}

/* ---------- JPEG ---------- */

interface Tiff {
  view: DataView
  le: boolean
  /** TIFF 블록 시작(배열 안 오프셋). */
  base: number
  /** TIFF 블록 끝(배타). */
  end: number
}

function openTiff(u8: Uint8Array, base: number, end: number): Tiff {
  if (end - base < 8) throw new ParseError('tiff short')
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  const order = String.fromCharCode(u8[base], u8[base + 1])
  if (order !== 'II' && order !== 'MM') throw new ParseError('byte order')
  const le = order === 'II'
  if (view.getUint16(base + 2, le) !== 0x2a) throw new ParseError('magic')
  return { view, le, base, end }
}

/** TIFF 안 [off, off+len)이 블록 안인지 확인하고 배열 안 절대 위치를 돌려준다. */
function span(t: Tiff, off: number, len: number): number {
  if (off < 0 || len < 0 || t.base + off + len > t.end) throw new ParseError('out of range')
  return t.base + off
}

/** IFD0에서 GPS 포인터를 빼고 GPS IFD를 0으로 지운다. GPS 포인터가 없으면 false. */
function stripGpsFromTiff(u8: Uint8Array, base: number, end: number): boolean {
  const t = openTiff(u8, base, end)
  const ifd0 = t.view.getUint32(base + 4, t.le)
  const countPos = span(t, ifd0, 2)
  const count = t.view.getUint16(countPos, t.le)
  const entriesPos = countPos + 2
  span(t, ifd0 + 2, count * 12 + 4)
  let gpsIdx = -1
  for (let i = 0; i < count; i += 1) {
    if (t.view.getUint16(entriesPos + i * 12, t.le) === TAG_GPS_IFD) {
      gpsIdx = i
      break
    }
  }
  if (gpsIdx < 0) return false
  const gpsOffset = t.view.getUint32(entriesPos + gpsIdx * 12 + 8, t.le)

  // 1) GPS IFD를 먼저 지운다(IFD0 위치를 바꾸기 전에).
  const gCount = t.view.getUint16(span(t, gpsOffset, 2), t.le)
  const gEntries = span(t, gpsOffset + 2, gCount * 12 + 4)
  for (let i = 0; i < gCount; i += 1) {
    const e = gEntries + i * 12
    const type = t.view.getUint16(e + 2, t.le)
    const n = t.view.getUint32(e + 4, t.le)
    const size = (TYPE_SIZE[type] ?? 1) * n
    if (size > 4) {
      const valOff = t.view.getUint32(e + 8, t.le)
      const valPos = span(t, valOff, size)
      u8.fill(0, valPos, valPos + size)
    }
  }
  u8.fill(0, t.base + gpsOffset, t.base + gpsOffset + 2 + gCount * 12 + 4)

  // 2) IFD0에서 포인터 항목을 뺀다: 뒤 항목 + 다음 IFD 오프셋을 12바이트 위로 당기고, 비는 12바이트를 0으로.
  const entryPos = entriesPos + gpsIdx * 12
  const tailEnd = entriesPos + count * 12 + 4
  u8.copyWithin(entryPos, entryPos + 12, tailEnd)
  u8.fill(0, tailEnd - 12, tailEnd)
  t.view.setUint16(countPos, count - 1, t.le)
  return true
}

function stripJpeg(u8: Uint8Array): Uint8Array {
  const out = new Uint8Array(u8) // 복사본에서 편집한다(원본은 그대로)
  let pos = 2
  let changed = false
  let removedMainXmp = false
  const removeRanges: Array<[number, number]> = []
  const extXmp: Array<[number, number]> = []
  while (pos < out.length) {
    if (out[pos] !== 0xff) throw new ParseError('marker')
    while (pos < out.length && out[pos] === 0xff) pos += 1 // 채움 바이트
    if (pos >= out.length) throw new ParseError('eof')
    const marker = out[pos]
    pos += 1
    const segStart = pos - 2
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (marker === 0xd9) break
    if (pos + 2 > out.length) throw new ParseError('len')
    const len = (out[pos] << 8) | out[pos + 1]
    if (len < 2 || pos + len > out.length) throw new ParseError('seg')
    const dataStart = pos + 2
    const segEnd = pos + len
    if (marker === 0xe1) {
      if (asciiAt(out, dataStart, 'Exif\0\0')) {
        if (stripGpsFromTiff(out, dataStart + 6, segEnd)) changed = true
      } else if (asciiAt(out, dataStart, XMP_NS)) {
        if (XMP_LOCATION_KEYS.test(latin1(out, dataStart + XMP_NS.length, segEnd))) {
          removeRanges.push([segStart, segEnd])
          removedMainXmp = true
        }
      } else if (asciiAt(out, dataStart, XMP_EXT_NS)) {
        extXmp.push([segStart, segEnd])
      }
    }
    pos = segEnd
    if (marker === 0xda) break // 이미지 데이터 시작 - 나머지는 그대로
  }
  for (const r of extXmp) {
    if (removedMainXmp || XMP_LOCATION_KEYS.test(latin1(out, r[0], r[1]))) removeRanges.push(r)
  }
  if (removeRanges.length === 0) return changed ? out : u8
  removeRanges.sort((a, b) => a[0] - b[0])
  const parts: Uint8Array[] = []
  let cursor = 0
  for (const [s, e] of removeRanges) {
    parts.push(out.subarray(cursor, s))
    cursor = e
  }
  parts.push(out.subarray(cursor))
  const joined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    joined.set(p, at)
    at += p.length
  }
  return joined
}

/** JPEG에서 위치를 제거한다(재인코딩 없음). 해석하지 못하면 던진다. */
export function stripJpegLocation(input: Uint8Array): Uint8Array {
  return stripJpeg(input)
}

/* ---------- PNG ---------- */

export function stripPngLocation(u8: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [u8.subarray(0, 8)]
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let pos = 8
  let dropped = false
  while (pos < u8.length) {
    if (pos + 12 > u8.length) throw new ParseError('chunk')
    const len = view.getUint32(pos)
    const total = 12 + len
    if (len > 0x7fffffff || pos + total > u8.length) throw new ParseError('chunk len')
    const type = latin1(u8, pos + 4, pos + 8)
    let drop = false
    if (type === 'eXIf') drop = true
    else if (type === 'iTXt' && asciiAt(u8, pos + 8, 'XML:com.adobe.xmp\0')) {
      drop = XMP_LOCATION_KEYS.test(latin1(u8, pos + 8, pos + 8 + len))
    }
    if (drop) dropped = true
    else parts.push(u8.subarray(pos, pos + total))
    pos += total
    if (type === 'IEND') break
  }
  if (!dropped) return u8
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/* ---------- 캔버스 재인코딩 ---------- */

/** 디코드 -> 방향 적용 -> 같은 가로세로로 다시 인코딩. 메타데이터는 전부 사라진다. */
export async function reencodeViaCanvas(bytes: ArrayBuffer, mimeType: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const wanted = mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg'
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }), { imageOrientation: 'from-image' } as ImageBitmapOptions)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, wanted, 0.92))
    if (!blob || blob.size === 0) throw new Error('encode')
    return { bytes: await blob.arrayBuffer(), mimeType: blob.type || wanted }
  } finally {
    bitmap.close?.()
  }
}

/* ---------- 진입점 ---------- */

function toBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

export async function stripLocation(input: ArrayBuffer, mimeType: string, deps: StripDeps = {}): Promise<StripResult> {
  const u8 = new Uint8Array(input)
  const kind = sniffFormat(u8)
  if (kind === 'heic') return { bytes: input, mimeType, method: 'passthrough-heic' }
  if (kind === 'gif') return { bytes: input, mimeType, method: 'passthrough-gif' }
  if (kind === 'jpeg') {
    try {
      const out = stripJpegLocation(u8)
      return out === u8 ? { bytes: input, mimeType, method: 'unchanged' } : { bytes: toBuffer(out), mimeType, method: 'jpeg-edit' }
    } catch {
      // 안전하게 해석하지 못했다 - 재인코딩으로
    }
  } else if (kind === 'png') {
    try {
      const out = stripPngLocation(u8)
      return out === u8 ? { bytes: input, mimeType, method: 'unchanged' } : { bytes: toBuffer(out), mimeType, method: 'png-edit' }
    } catch {
      // 재인코딩으로
    }
  }
  const re = await (deps.reencode ?? reencodeViaCanvas)(input, mimeType)
  return { bytes: re.bytes, mimeType: re.mimeType, method: 'reencode' }
}

/** 고른 `File`을 위치 없는 `File`로. 바뀐 것이 없거나 통과 형식이면 같은 File을 돌려준다. */
export async function stripLocationFromFile(file: File, readBytes: (f: Blob) => Promise<ArrayBuffer>, deps: StripDeps = {}): Promise<File> {
  const bytes = await readBytes(file)
  const result = await stripLocation(bytes, file.type, deps)
  if (result.method === 'unchanged' || result.method.startsWith('passthrough')) return file
  return new File([result.bytes], file.name, { type: result.mimeType, lastModified: file.lastModified })
}
