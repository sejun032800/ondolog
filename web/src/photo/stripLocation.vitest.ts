import { describe, expect, it } from 'vitest'
import { stripLocation, stripJpegLocation, stripPngLocation } from './stripLocation'
import { pickPhotos } from '../features/feed/photoPicker'
import { stageFiles } from '../features/feed/feedPhotoStage'

/* ---------- 합성 JPEG ---------- */

const GPS_MARK = 0xab
const SCAN = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]

function u16(v: number, le: boolean): number[] { return le ? [v & 255, v >> 8] : [v >> 8, v & 255] }
function u32(v: number, le: boolean): number[] { return le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255] : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255] }
function ascii(s: string): number[] { return Array.from(s).map((c) => c.charCodeAt(0)) }

function buildTiff(le: boolean, withGps: boolean): number[] {
  // 배치: 헤더(8) | IFD0 | ExifIFD | 날짜 값 | GPS IFD | GPS 값
  const ifd0Entries = withGps ? 3 : 2
  const ifd0Len = 2 + ifd0Entries * 12 + 4
  const exifOff = 8 + ifd0Len
  const exifLen = 2 + 12 + 4
  const dateOff = exifOff + exifLen
  const date = ascii('2026:10:03 14:20:11').concat([0])
  const gpsOff = dateOff + date.length
  const gpsLen = 2 + 2 * 12 + 4
  const gpsValOff = gpsOff + gpsLen
  const entry = (tag: number, type: number, count: number, value: number[]) => [...u16(tag, le), ...u16(type, le), ...u32(count, le), ...value]
  const t: number[] = [...ascii(le ? 'II' : 'MM'), ...u16(0x2a, le), ...u32(8, le)]
  t.push(...u16(ifd0Entries, le))
  t.push(...entry(0x0112, 3, 1, [...u16(6, le), 0, 0]))
  t.push(...entry(0x8769, 4, 1, u32(exifOff, le)))
  if (withGps) t.push(...entry(0x8825, 4, 1, u32(gpsOff, le)))
  t.push(...u32(0, le))
  t.push(...u16(1, le), ...entry(0x9003, 2, date.length, u32(dateOff, le)), ...u32(0, le))
  t.push(...date)
  if (withGps) {
    t.push(...u16(2, le))
    t.push(...entry(0x0001, 2, 2, [78, 0, 0, 0])) // GPSLatitudeRef "N"
    t.push(...entry(0x0002, 5, 3, u32(gpsValOff, le)))
    t.push(...u32(0, le))
    t.push(...new Array(24).fill(GPS_MARK))
  }
  return t
}

function segment(marker: number, data: number[]): number[] { return [0xff, marker, ...u16(data.length + 2, false), ...data] }

function buildJpeg(opts: { le?: boolean; gps?: boolean; exif?: boolean; xmp?: string; width?: number; height?: number }): Uint8Array {
  const le = opts.le ?? true
  const w = opts.width ?? 640
  const h = opts.height ?? 480
  const out: number[] = [0xff, 0xd8]
  out.push(...segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]))
  if (opts.exif !== false) out.push(...segment(0xe1, [...ascii('Exif'), 0, 0, ...buildTiff(le, opts.gps ?? true)]))
  if (opts.xmp !== undefined) out.push(...segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii(opts.xmp)]))
  out.push(...segment(0xc0, [8, ...u16(h, false), ...u16(w, false), 1, 1, 0x11, 0]))
  out.push(...segment(0xda, [1, 1, 0, 0, 63, 0]), ...SCAN, 0xff, 0xd9)
  return new Uint8Array(out)
}

/* ---------- 합성 JPEG 읽기(시험용 작은 해석기) ---------- */

function find(u8: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i + needle.length <= u8.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (u8[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}

function readTags(u8: Uint8Array) {
  const at = find(u8, [...ascii('Exif'), 0, 0])
  const base = at + 6
  const le = u8[base] === 0x49
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  const ifd0 = v.getUint32(base + 4, le)
  const n = v.getUint16(base + ifd0, le)
  const tags: Record<number, number> = {}
  for (let i = 0; i < n; i += 1) {
    const e = base + ifd0 + 2 + i * 12
    tags[v.getUint16(e, le)] = e
  }
  const next = v.getUint32(base + ifd0 + 2 + n * 12, le)
  const orientation = tags[0x0112] !== undefined ? v.getUint16(tags[0x0112] + 8, le) : null
  let date: string | null = null
  if (tags[0x8769] !== undefined) {
    const exifIfd = base + v.getUint32(tags[0x8769] + 8, le)
    const c = v.getUint16(exifIfd, le)
    for (let i = 0; i < c; i += 1) {
      const e = exifIfd + 2 + i * 12
      if (v.getUint16(e, le) === 0x9003) {
        const off = base + v.getUint32(e + 8, le)
        date = String.fromCharCode(...Array.from(u8.subarray(off, off + 19)))
      }
    }
  }
  return { count: n, tagIds: Object.keys(tags).map(Number), orientation, date, next }
}

function sofSize(u8: Uint8Array): [number, number] {
  const i = find(u8, [0xff, 0xc0])
  return [(u8[i + 7] << 8) | u8[i + 8], (u8[i + 5] << 8) | u8[i + 6]]
}

function tail(u8: Uint8Array): Uint8Array {
  const i = find(u8, [0xff, 0xda])
  return u8.slice(i)
}

const buf = (u8: Uint8Array): ArrayBuffer => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer

describe('stripLocation - JPEG(재인코딩 없음)', () => {
  for (const le of [true, false]) {
    it(`GPS IFD 포인터 · GPS 바이트가 사라지고 방향 · 촬영 시각 · 가로세로 · 이미지 데이터는 그대로 (${le ? 'II' : 'MM'})`, () => {
      const src = buildJpeg({ le, gps: true })
      expect(readTags(src).tagIds).toContain(0x8825)
      expect(find(src, new Array(24).fill(GPS_MARK))).toBeGreaterThan(0)
      const out = stripJpegLocation(src)
      const tags = readTags(out)
      expect(tags.tagIds).not.toContain(0x8825)
      expect(tags.count).toBe(2)
      expect(tags.next).toBe(0) // 다음 IFD 오프셋 유지
      expect(find(out, new Array(24).fill(GPS_MARK))).toBe(-1)
      expect(find(out, [0x00, 0x01, 0x00, 0x02, ...(le ? [5, 0] : [0, 5])])).toBe(-1) // GPS 항목(태그 1 · 2)
      expect(tags.orientation).toBe(6)
      expect(tags.date).toBe('2026:10:03 14:20:11')
      expect(sofSize(out)).toEqual([640, 480])
      expect(Array.from(tail(out))).toEqual(Array.from(tail(src)))
      expect(out.length).toBe(src.length) // 세그먼트 길이 그대로(편집은 제자리)
      expect(Array.from(src.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0]) // 입력은 바뀌지 않았다
      expect(readTags(src).tagIds).toContain(0x8825)
    })
  }

  it('위치 키가 든 XMP는 빼고, 위치 없는 XMP는 둔다', () => {
    const withGps = buildJpeg({ xmp: '<x:xmpmeta><rdf:Description exif:GPSLatitude="37,30N"/></x:xmpmeta>' })
    const out1 = stripJpegLocation(withGps)
    expect(find(out1, ascii('http://ns.adobe.com/xap/1.0/'))).toBe(-1)
    expect(find(out1, ascii('GPSLatitude'))).toBe(-1)
    expect(readTags(out1).orientation).toBe(6)
    const plain = buildJpeg({ gps: false, xmp: '<x:xmpmeta><rdf:Description xmp:Rating="3"/></x:xmpmeta>' })
    const out2 = stripJpegLocation(plain)
    expect(find(out2, ascii('http://ns.adobe.com/xap/1.0/'))).toBeGreaterThan(0)
    expect(out2.length).toBe(plain.length)
  })

  it('EXIF가 없는 JPEG는 그대로(같은 배열)', () => {
    const src = buildJpeg({ exif: false })
    expect(stripJpegLocation(src)).toBe(src)
  })

  it('GPS가 없는 EXIF는 바이트가 같다', async () => {
    const src = buildJpeg({ gps: false })
    const r = await stripLocation(buf(src), 'image/jpeg')
    expect(r.method).toBe('unchanged')
    expect(Array.from(new Uint8Array(r.bytes))).toEqual(Array.from(src))
  })

  it('깨진 입력은 던지지 않고 재인코딩 길로 간다 · 재인코딩도 실패하면 던진다(위치가 남은 바이트를 내보내지 않는다)', async () => {
    const src = buildJpeg({})
    const broken = src.slice(0, 40) // EXIF 세그먼트가 잘렸다
    let called = 0
    const r = await stripLocation(buf(broken), 'image/jpeg', { reencode: async (b, m) => { called += 1; return { bytes: new ArrayBuffer(4), mimeType: m } } })
    expect(called).toBe(1)
    expect(r.method).toBe('reencode')
    await expect(stripLocation(buf(broken), 'image/jpeg', { reencode: async () => { throw new Error('x') } })).rejects.toThrow()
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    await expect(stripLocation(buf(garbage), 'image/jpeg', { reencode: async (b, m) => ({ bytes: b, mimeType: m }) })).resolves.toBeTruthy()
    expect(() => stripJpegLocation(new Uint8Array([0xff, 0xd8, 0xff]))).not.toThrow(RangeError)
  })

  it('GPS IFD 오프셋이 범위 밖이면 던지지 않고 재인코딩으로 넘어간다', async () => {
    const src = buildJpeg({ le: true })
    const bad = src.slice()
    const at = find(bad, [0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00]) // GPS 포인터 항목
    bad[at + 8] = 0xff
    bad[at + 9] = 0xff
    let called = 0
    const r = await stripLocation(buf(bad), 'image/jpeg', { reencode: async (b, m) => { called += 1; return { bytes: b, mimeType: m } } })
    expect(r.method).toBe('reencode')
    expect(called).toBe(1)
  })

  it('HEIC는 건드리지 않고 그대로 통과한다(PM 결정 대기)', async () => {
    const heic = new Uint8Array([0, 0, 0, 24, ...ascii('ftypheic'), 0, 0, 0, 0, ...ascii('mif1heic'), 9, 9, 9])
    const r = await stripLocation(buf(heic), 'image/heic', { reencode: async () => { throw new Error('호출되면 안 된다') } })
    expect(r.method).toBe('passthrough-heic')
    expect(Array.from(new Uint8Array(r.bytes))).toEqual(Array.from(heic))
  })
})

/* ---------- PNG ---------- */

function chunk(type: string, data: number[]): number[] {
  return [...u32(data.length, false), ...ascii(type), ...data, 1, 2, 3, 4]
}
function buildPng(extra: number[][]): Uint8Array {
  return new Uint8Array([0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', [0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]), ...extra.flat(), ...chunk('IDAT', [9, 9, 9]), ...chunk('IEND', [])])
}

describe('stripLocation - PNG', () => {
  it('eXIf와 위치 키가 든 XMP iTXt는 청크째 빠지고, 위치 없는 iTXt는 남는다', () => {
    const xmpGps = chunk('iTXt', [...ascii('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...ascii('exif:GPSLatitude')])
    const xmpPlain = chunk('iTXt', [...ascii('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...ascii('xmp:Rating')])
    const src = buildPng([chunk('eXIf', [1, 2, 3]), xmpGps, xmpPlain])
    const out = stripPngLocation(src)
    expect(find(out, ascii('eXIf'))).toBe(-1)
    expect(find(out, ascii('GPSLatitude'))).toBe(-1)
    expect(find(out, ascii('xmp:Rating'))).toBeGreaterThan(0)
    expect(find(out, ascii('IDAT'))).toBeGreaterThan(0)
    expect(stripPngLocation(buildPng([]))).toBeInstanceOf(Uint8Array)
  })
})

/* ---------- 모든 업로드 길이 위치 없는 바이트를 받는다 ---------- */

function fileOf(bytes: Uint8Array, name = 'p.jpg', type = 'image/jpeg'): File {
  const f = new File([buf(bytes)], name, { type })
  if (typeof f.arrayBuffer !== 'function') Object.defineProperty(f, 'arrayBuffer', { value: async () => buf(bytes) })
  return f
}
async function bytesOfFile(f: Blob): Promise<Uint8Array> {
  if (typeof f.arrayBuffer === 'function') return new Uint8Array(await f.arrayBuffer())
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error)
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer))
    r.readAsArrayBuffer(f)
  })
}

describe('업로드 길 - 위치 없는 바이트만 받는다 (채팅 · 스토리 = pickPhotos, 피드 = stageFiles)', () => {
  const gpsJpeg = buildJpeg({ gps: true })

  it('채팅 · 스토리: pickPhotos가 만든 미리보기 주소(큐 복사의 출처)의 파일에 위치가 없고, EXIF는 원본에서 읽는다', async () => {
    let madeFrom: File | null = null
    let exifFrom: Blob | null = null
    const photos = await pickPhotos(5, {
      choose: async () => [fileOf(gpsJpeg)],
      makeUrl: (f) => { madeFrom = f; return 'blob:fake' },
      readExif: async (f) => { exifFrom = f; return { DateTimeOriginal: '2026:10:03 14:20:11', Orientation: 6 } },
      readSize: async () => ({ width: 640, height: 480 }),
    })
    expect(photos).toHaveLength(1)
    const out = await bytesOfFile(madeFrom as unknown as File)
    expect(readTags(out).tagIds).not.toContain(0x8825)
    expect(find(out, new Array(24).fill(GPS_MARK))).toBe(-1)
    expect(readTags(out).orientation).toBe(6)
    const orig = await bytesOfFile(exifFrom as unknown as Blob)
    expect(find(orig, new Array(24).fill(GPS_MARK))).toBeGreaterThan(0) // 촬영 시각은 원본에서
    expect(photos[0].capturedAt).not.toBeNull()
  })

  it('피드: stageFiles가 앱 캐시에 쓰는 복사본(업로드 출처)에 위치가 없다', async () => {
    const writes: string[] = []
    const fs = {
      writeFile: async (o: { path: string; data: string }) => { writes.push(o.data); return {} },
      readFile: async () => ({ data: '' }),
      deleteFile: async () => ({}),
      stat: async () => ({}),
    }
    const staged = await stageFiles([fileOf(gpsJpeg)], false, {
      fs: fs as never,
      makeUrl: () => 'blob:fake-feed',
      readExif: async () => ({ DateTimeOriginal: '2026:10:03 14:20:11' }),
      readSize: async () => ({ width: 640, height: 480 }),
      newId: () => 'id1',
    })
    expect(staged[0].failed).toBeUndefined()
    expect(writes).toHaveLength(1)
    const bin = atob(writes[0])
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
    expect(readTags(out).tagIds).not.toContain(0x8825)
    expect(find(out, new Array(24).fill(GPS_MARK))).toBe(-1)
    expect(readTags(out).date).toBe('2026:10:03 14:20:11')
    expect(Array.from(tail(out))).toEqual(Array.from(tail(gpsJpeg)))
  })

  it('피드: 위치를 지울 수 없는 사진(깨짐 + 재인코딩 실패)은 failed로 돌려주고 업로드 출처를 만들지 않는다', async () => {
    const writes: string[] = []
    const fs = { writeFile: async (o: { data: string }) => { writes.push(o.data); return {} }, readFile: async () => ({ data: '' }), deleteFile: async () => ({}), stat: async () => ({}) }
    const staged = await stageFiles([fileOf(gpsJpeg.slice(0, 40))], false, {
      fs: fs as never, makeUrl: () => 'blob:x', readExif: async () => null, readSize: async () => null, strip: { reencode: async () => { throw new Error('x') } },
    })
    expect(staged[0].failed).toBe(true)
    expect(writes).toHaveLength(0)
  })
})
