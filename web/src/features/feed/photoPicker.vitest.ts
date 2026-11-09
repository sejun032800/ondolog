/**
 * 사진 고르기 · EXIF 촬영일 시험(74-4) - 원본: `__tests__/utils/dateRecord.test.ts`(EXIF 날짜 규칙 `parseExifDateTime` · `defaultDateOn` - 순수 규칙은 웹이 `@/utils/dateRecord`를 그대로 쓰므로 루트 jest가 계속 지킨다).
 * 여기서는 **웹 입력으로 받은 파일**에서 실제 EXIF 라이브러리(`exifr`)가 촬영 시각을 읽는지, 위치(GPS)는 읽지도 담지도 않는지를 손으로 만든 JPEG(EXIF 블록)로 확인한다.
 */
import { describe, expect, it } from 'vitest'
import { exifDimensions, fileKeyOf, PICK_LIMIT, photoFromFile, pickPhotos, readExifTags } from './photoPicker'

// ── 손으로 만드는 EXIF JPEG(리틀 엔디언 TIFF) ─────────────────────────────────
type Entry = { tag: number; type: 1 | 2 | 3 | 4 | 5; count: number; value?: number; data?: Uint8Array; ptr?: 'exif' | 'gps' }
const ascii = (s: string): Entry['data'] => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(0))

function rationals(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 8)
  const dv = new DataView(out.buffer)
  values.forEach((v, i) => { dv.setUint32(i * 8, v, true); dv.setUint32(i * 8 + 4, 1, true) })
  return out
}

function buildJpeg(o: { ifd0?: Entry[]; exif?: Entry[]; gps?: Entry[] } = {}): Uint8Array {
  const exif = o.exif ?? []
  const gps = o.gps ?? null
  const ifd0: Entry[] = [...(o.ifd0 ?? []), { tag: 0x8769, type: 4, count: 1, ptr: 'exif' }, ...(gps ? [{ tag: 0x8825, type: 4 as const, count: 1, ptr: 'gps' as const }] : [])]
  const size = (n: number) => 2 + n * 12 + 4
  const ifd0Off = 8
  const exifOff = ifd0Off + size(ifd0.length)
  const gpsOff = exifOff + size(exif.length)
  let dataOff = gpsOff + (gps ? size(gps.length) : 0)
  const tiff = new Uint8Array(4096)
  const dv = new DataView(tiff.buffer)
  tiff.set([0x49, 0x49, 0x2a, 0x00]) // 'II' 42
  dv.setUint32(4, 8, true)
  const alloc = (n: number) => { const at = dataOff; dataOff += n; return at }
  const write = (off: number, entries: Entry[]) => {
    dv.setUint16(off, entries.length, true)
    entries.forEach((e, i) => {
      const p = off + 2 + i * 12
      dv.setUint16(p, e.tag, true); dv.setUint16(p + 2, e.type, true); dv.setUint32(p + 4, e.count, true)
      if (e.ptr) dv.setUint32(p + 8, e.ptr === 'exif' ? exifOff : gpsOff, true)
      else if (e.data) {
        if (e.data.length > 4) { const at = alloc(e.data.length); tiff.set(e.data, at); dv.setUint32(p + 8, at, true) } else tiff.set(e.data, p + 8)
      } else if (e.type === 3) dv.setUint16(p + 8, e.value ?? 0, true)
      else dv.setUint32(p + 8, e.value ?? 0, true)
    })
    dv.setUint32(off + 2 + entries.length * 12, 0, true)
  }
  write(ifd0Off, ifd0)
  write(exifOff, exif)
  if (gps) write(gpsOff, gps)
  const tiffBytes = tiff.slice(0, dataOff)
  const app1Len = 2 + 6 + tiffBytes.length
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, app1Len >> 8, app1Len & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiffBytes, 0xff, 0xd9])
}

const dtOriginal = (v: string): Entry => ({ tag: 0x9003, type: 2, count: v.length + 1, data: ascii(v) })
const dtDigitized = (v: string): Entry => ({ tag: 0x9004, type: 2, count: v.length + 1, data: ascii(v) })
const offsetTime = (v: string): Entry => ({ tag: 0x9011, type: 2, count: v.length + 1, data: ascii(v) })
const pixelW = (n: number): Entry => ({ tag: 0xa002, type: 4, count: 1, value: n })
const pixelH = (n: number): Entry => ({ tag: 0xa003, type: 4, count: 1, value: n })
const dateTimeIfd0 = (v: string): Entry => ({ tag: 0x0132, type: 2, count: v.length + 1, data: ascii(v) })
const orientation = (n: number): Entry => ({ tag: 0x0112, type: 3, count: 1, value: n })
const GPS: Entry[] = [
  { tag: 1, type: 2, count: 2, data: ascii('N') }, { tag: 2, type: 5, count: 3, data: rationals([37, 33, 36]) },
  { tag: 3, type: 2, count: 2, data: ascii('E') }, { tag: 4, type: 5, count: 3, data: rationals([126, 55, 12]) },
]

const jpegFile = (bytes: Uint8Array, name = 'IMG_0001.jpg', type = 'image/jpeg', lastModified = Date.UTC(2026, 10, 9)) =>
  new File([bytes as BlobPart], name, { type, lastModified })

const deps = { makeUrl: () => 'blob:test', readSize: async () => null }

describe('웹 입력으로 받은 파일의 EXIF - 촬영 시각만 읽는다', () => {
  it('DateTimeOriginal을 KST(+09:00) 촬영 시각으로 바꾼다 · 가로세로는 EXIF에서 · 크기를 줄이지 않는다', async () => {
    const file = jpegFile(buildJpeg({ exif: [dtOriginal('2026:10:03 14:20:11'), pixelW(4000), pixelH(3000)] }))
    const p = await photoFromFile(file, deps)
    expect(p.capturedAt).toBe('2026-10-03T14:20:11+09:00')
    expect(p).toMatchObject({ width: 4000, height: 3000, byteSize: file.size, mimeType: 'image/jpeg', ext: 'jpg', uri: 'blob:test' })
  })

  it('OffsetTimeOriginal이 있으면 그 시간대로 읽는다', async () => {
    const file = jpegFile(buildJpeg({ exif: [dtOriginal('2026:10:03 14:20:11'), offsetTime('-05:00')] }))
    expect((await photoFromFile(file, deps)).capturedAt).toBe('2026-10-03T14:20:11-05:00')
  })

  it('DateTimeOriginal이 없으면 DateTimeDigitized, 그것도 없으면 DateTime(IFD0) 순으로 쓴다', async () => {
    const digitized = jpegFile(buildJpeg({ exif: [dtDigitized('2026:10:04 09:00:00')], ifd0: [dateTimeIfd0('2026:10:05 10:00:00')] }))
    expect((await photoFromFile(digitized, deps)).capturedAt).toBe('2026-10-04T09:00:00+09:00')
    const plain = jpegFile(buildJpeg({ ifd0: [dateTimeIfd0('2026:10:05 10:00:00')] }))
    expect((await photoFromFile(plain, deps)).capturedAt).toBe('2026-10-05T10:00:00+09:00')
  })

  it('EXIF가 없는 사진은 촬영 시각 null - 파일 수정 시각(lastModified)을 촬영 시각으로 지어내지 않는다', async () => {
    const noExif = jpegFile(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), 'screenshot.png', 'image/png', Date.UTC(2026, 9, 3))
    const p = await photoFromFile(noExif, deps)
    expect(p.capturedAt).toBeNull()
    expect(p.ext).toBe('png')
    expect(p.width).toBeNull() // 읽을 수 없으면 null(지어내지 않는다)
  })

  it('깨진 파일은 던지지 않고 시각 없음으로 본다 · 형식이 틀린 날짜 글자도 null', async () => {
    const garbage = jpegFile(Uint8Array.from([1, 2, 3, 4, 5]), 'x.jpg')
    expect(await readExifTags(garbage)).toBeNull()
    expect((await photoFromFile(garbage, deps)).capturedAt).toBeNull()
    const badDate = jpegFile(buildJpeg({ exif: [dtOriginal('0000:00:00 00:00:00')] }))
    expect((await photoFromFile(badDate, deps)).capturedAt).toBeNull()
  })

  it('위치(GPS)는 읽지도 담지도 않는다 - 파일에 위치가 있어도 lat · lng는 null이고, 읽은 태그에 GPS 칸이 없다', async () => {
    const file = jpegFile(buildJpeg({ exif: [dtOriginal('2026:10:03 14:20:11')], gps: GPS }))
    const tags = await readExifTags(file)
    expect(tags?.DateTimeOriginal).toBe('2026:10:03 14:20:11')
    expect(Object.keys(tags ?? {}).filter((k) => /gps/i.test(k))).toEqual([])
    const p = await photoFromFile(file, deps)
    expect(p.lat).toBeNull()
    expect(p.lng).toBeNull()
    expect(JSON.stringify(p)).not.toMatch(/gps|latitude|longitude/i)
  })

  it('EXIF에 가로세로가 없으면 이미지를 풀어 읽은 값을 쓴다 · 그것도 안 되면 null', async () => {
    const file = jpegFile(buildJpeg({ exif: [dtOriginal('2026:10:03 14:20:11')] }))
    const p = await photoFromFile(file, { ...deps, readSize: async () => ({ width: 1170, height: 1560 }) })
    expect(p).toMatchObject({ width: 1170, height: 1560 })
    expect(await photoFromFile(file, deps)).toMatchObject({ width: null, height: null })
  })

  it('방향이 세로(5~8)이면 EXIF 가로세로를 맞바꾼다', () => {
    expect(exifDimensions({ ExifImageWidth: 4000, ExifImageHeight: 3000, Orientation: 6 })).toEqual({ width: 3000, height: 4000 })
    expect(exifDimensions({ ExifImageWidth: 4000, ExifImageHeight: 3000, Orientation: 1 })).toEqual({ width: 4000, height: 3000 })
    expect(exifDimensions({ ExifImageWidth: 4000 })).toBeNull()
    expect(exifDimensions(null)).toBeNull()
  })

  it('확장자는 mime을 먼저, 없으면 파일 이름에서(HEIC 포함) · 없으면 jpg', async () => {
    expect((await photoFromFile(jpegFile(Uint8Array.from([0]), 'a.HEIC', 'image/heic'), deps)).ext).toBe('heic')
    expect((await photoFromFile(jpegFile(Uint8Array.from([0]), 'a.webp', ''), deps)).ext).toBe('webp')
    expect((await photoFromFile(jpegFile(Uint8Array.from([0]), 'noext', ''), deps)).ext).toBe('jpg')
  })
})

describe('사진 고르기', () => {
  const files = (n: number) => Array.from({ length: n }, (_, i) => jpegFile(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), `p${i}.jpg`, 'image/jpeg', i))

  it('한 번에 최대 30장 · 고른 순서를 지킨다', async () => {
    expect(PICK_LIMIT).toBe(30)
    const out = await pickPhotos(PICK_LIMIT, { ...deps, choose: async (limit) => files(35).slice(0, limit) })
    expect(out).toHaveLength(30)
    expect(out.map((p) => p.fileKey)).toEqual(files(30).map(fileKeyOf))
  })

  it('읽을 수 없는 파일 하나는 건너뛰고 나머지는 간다 · 고르지 않으면 빈 배열', async () => {
    let n = 0
    const out = await pickPhotos(30, { ...deps, choose: async () => files(3), readExif: async () => { n += 1; if (n === 2) throw new Error('깨진 파일'); return null } })
    expect(out.map((p) => p.fileKey)).toEqual([fileKeyOf(files(3)[0]), fileKeyOf(files(3)[2])])
    expect(await pickPhotos(30, { ...deps, choose: async () => [] })).toEqual([])
  })

  it('같은 파일은 같은 열쇠 - 이름 · 크기 · 수정 시각', () => {
    expect(fileKeyOf(files(1)[0])).toBe(fileKeyOf(files(1)[0]))
    expect(fileKeyOf(files(2)[0])).not.toBe(fileKeyOf(files(2)[1]))
  })
})
