/** R94-2 HEIC 막기 - 앞 바이트 판정 · 채팅/스토리/피드 공통 입구(chooseFiles) · 일부만 HEIC인 묶음. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chooseFiles } from '../features/feed/photoPicker'
import { dropHeic, guardPickedFiles, heicNoticeText, HEIC_NOTICE, isHeicBytes, isHeicFile } from './heicGuard'
import { sniffFormat, stripLocation } from './stripLocation'
import { useToastStore } from '../stores/toastStore'

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0))
/** ISO-BMFF ftyp 상자: 크기 + 'ftyp' + 주 브랜드 + 부 버전 + 호환 브랜드들. */
function ftyp(major: string, compat: string[] = []): Uint8Array {
  const size = 16 + compat.length * 4
  return new Uint8Array([0, 0, 0, size, ...ascii('ftyp'), ...ascii(major), 0, 0, 0, 0, ...compat.flatMap(ascii), ...Array(40).fill(0)])
}
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])
const file = (bytes: Uint8Array, name: string, type: string) => new File([bytes as BlobPart], name, { type })

afterEach(() => { vi.restoreAllMocks(); useToastStore.getState().hide() })

describe('isHeicBytes - 파일 앞 바이트', () => {
  it('HEIC 고유 브랜드(주 · 호환)는 HEIC', () => {
    for (const b of ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'heif']) expect(isHeicBytes(ftyp(b)), b).toBe(true)
    expect(isHeicBytes(ftyp('isom', ['iso2', 'heic']))).toBe(true)
  })
  it('범용 브랜드 mif1 · msf1은 AVIF 표시가 없으면 HEIC', () => {
    expect(isHeicBytes(ftyp('mif1'))).toBe(true)
    expect(isHeicBytes(ftyp('msf1', ['msf1']))).toBe(true)
    expect(isHeicBytes(ftyp('mif1', ['mif1', 'heic']))).toBe(true)
  })
  it('AVIF는 HEIC이 아니다(결정)', () => {
    expect(isHeicBytes(ftyp('avif', ['mif1', 'miaf']))).toBe(false)
    expect(isHeicBytes(ftyp('mif1', ['mif1', 'miaf', 'avif']))).toBe(false)
    expect(isHeicBytes(ftyp('avis'))).toBe(false)
  })
  it('JPEG · PNG · 짧은 입력 · MP4는 아니다', () => {
    expect(isHeicBytes(JPEG)).toBe(false)
    expect(isHeicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe(false)
    expect(isHeicBytes(new Uint8Array([0, 0, 0]))).toBe(false)
    expect(isHeicBytes(ftyp('isom', ['mp41']))).toBe(false)
  })
  it('stripLocation의 형식 판정과 같은 규칙', () => {
    expect(sniffFormat(ftyp('heic'))).toBe('heic')
    expect(sniffFormat(ftyp('avif'))).not.toBe('heic')
  })
})

describe('파일 판정은 확장자 · MIME을 믿지 않는다', () => {
  it('이름이 .jpg · 형식이 image/jpeg라고 적혀 있어도 속이 HEIC이면 막는다', async () => {
    expect(await isHeicFile(file(ftyp('heic'), 'IMG_1.jpg', 'image/jpeg'))).toBe(true)
  })
  it('이름이 .heic · 형식이 image/heic라고 적혀 있어도 속이 JPEG이면 통과', async () => {
    expect(await isHeicFile(file(JPEG, 'IMG_2.heic', 'image/heic'))).toBe(false)
  })
  it('섞인 묶음: HEIC만 빼고 나머지는 순서대로', async () => {
    const a = file(JPEG, 'a.jpg', 'image/jpeg')
    const b = file(ftyp('heic'), 'b.jpg', 'image/jpeg')
    const c = file(JPEG, 'c.jpg', 'image/jpeg')
    const d = file(ftyp('mif1'), 'd.heic', 'image/heic')
    const r = await dropHeic([a, b, c, d])
    expect(r.kept).toEqual([a, c])
    expect(r.dropped).toBe(2)
  })
})

describe('안내 문구', () => {
  it('한 장이면 정해진 문장 그대로', () => {
    expect(HEIC_NOTICE).toBe('이 사진은 아직 올릴 수 없는 형식이에요(HEIC). JPEG로 저장된 사진을 골라 주세요.')
    expect(heicNoticeText(1, 1)).toBe(HEIC_NOTICE)
  })
  it('여러 장이면 빠진 장 수를 덧붙인다', () => {
    expect(heicNoticeText(2, 5)).toBe(`${HEIC_NOTICE} 2장은 뺐어요.`)
  })
  it('guardPickedFiles: HEIC가 있을 때만 안내', async () => {
    const notify = vi.fn()
    const ok = file(JPEG, 'a.jpg', 'image/jpeg')
    expect(await guardPickedFiles([ok], notify)).toEqual([ok])
    expect(notify).not.toHaveBeenCalled()
    expect(await guardPickedFiles([ok, file(ftyp('heic'), 'b.jpg', 'image/jpeg')], notify)).toEqual([ok])
    expect(notify).toHaveBeenCalledWith(`${HEIC_NOTICE} 1장은 뺐어요.`)
  })
})

describe('공통 입구 chooseFiles(채팅 · 스토리 · 피드가 모두 지난다)', () => {
  const pickViaInput = (files: File[]) => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: files })
      this.dispatchEvent(new Event('change'))
    })
  }
  it('일부만 HEIC: 그 장만 빠지고 안내에 빠진 장 수', async () => {
    const ok = file(JPEG, 'a.jpg', 'image/jpeg')
    pickViaInput([ok, file(ftyp('heic'), 'b.jpg', 'image/jpeg'), file(ftyp('heix'), 'c.jpg', 'image/jpeg')])
    const out = await chooseFiles(30, false)
    expect(out).toEqual([ok])
    expect(useToastStore.getState().toast?.message).toBe(`${HEIC_NOTICE} 2장은 뺐어요.`)
  })
  it('한 장(스토리 · 카메라)이 HEIC: 빈 배열 + 정해진 문장', async () => {
    pickViaInput([file(ftyp('heic'), 'b.jpg', 'image/jpeg')])
    expect(await chooseFiles(1, true)).toEqual([])
    expect(useToastStore.getState().toast?.message).toBe(HEIC_NOTICE)
  })
  it('JPEG만이면 안내 없음', async () => {
    const ok = file(JPEG, 'a.jpg', 'image/jpeg')
    pickViaInput([ok])
    expect(await chooseFiles(30, false)).toEqual([ok])
    expect(useToastStore.getState().toast).toBeNull()
  })
})

describe('위치 제거 회귀 0', () => {
  it('JPEG는 이전처럼 stripLocation을 그대로 지난다(바이트 동일 또는 편집)', async () => {
    const r = await stripLocation(JPEG.buffer.slice(0) as ArrayBuffer, 'image/jpeg')
    expect(['unchanged', 'jpeg-edit']).toContain(r.method)
  })
})
