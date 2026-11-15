import { describe, expect, it, vi } from 'vitest'
import { chooseViaGalleryPlugin, GALLERY_MODE } from './galleryPlugin'

const jpeg = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })
const pick = (n: number) => async () => ({ results: Array.from({ length: n }, (_, i) => ({ webPath: `w${i}` })) })

describe('A-21 갤러리 플러그인 길', () => {
  it('기본값은 웹 입력(촬영 시각 보존을 기기에서 확인하기 전)', () => {
    expect(GALLERY_MODE).toBe('input')
  })

  it('꺼져 있으면 null(웹 입력으로) · 플러그인을 부르지 않는다', async () => {
    const choose = vi.fn(pick(1))
    expect(await chooseViaGalleryPlugin(30, { mode: 'input', isNative: () => true, choose })).toBeNull()
    expect(choose).not.toHaveBeenCalled()
  })

  it('웹(앱 아님)이면 null', async () => {
    expect(await chooseViaGalleryPlugin(30, { mode: 'plugin', isNative: () => false, choose: pick(1) })).toBeNull()
  })

  it('여러 장 - 받은 바이트가 그대로 File이 된다(재인코딩 없음) · 장수 상한', async () => {
    const choose = vi.fn(pick(3))
    const files = await chooseViaGalleryPlugin(2, {
      mode: 'plugin', isNative: () => true, choose,
      load: async (p) => jpeg([0xff, 0xd8, p === 'w0' ? 1 : 2]),
    })
    expect(choose).toHaveBeenCalledWith({ limit: 2, multiple: true })
    expect(files).toHaveLength(2)
    const read = (f: Blob) => new Promise<number[]>((ok) => { const r = new FileReader(); r.onload = () => ok(Array.from(new Uint8Array(r.result as ArrayBuffer))); r.readAsArrayBuffer(f) })
    expect(await read(files![0])).toEqual([0xff, 0xd8, 1])
    expect(files![0].type).toBe('image/jpeg')
  })

  it('한 장이 안 읽혀도 나머지는 온다 · 사용자 취소는 빈 배열 · 그 밖의 실패는 null(웹 입력으로)', async () => {
    const some = await chooseViaGalleryPlugin(30, {
      mode: 'plugin', isNative: () => true, choose: pick(2),
      load: async (p) => { if (p === 'w0') throw new Error('x'); return jpeg([1]) },
    })
    expect(some).toHaveLength(1)
    const cancelled = await chooseViaGalleryPlugin(30, { mode: 'plugin', isNative: () => true, choose: async () => { throw new Error('User cancelled photos app') } })
    expect(cancelled).toEqual([])
    const broken = await chooseViaGalleryPlugin(30, { mode: 'plugin', isNative: () => true, choose: async () => { throw new Error('boom') } })
    expect(broken).toBeNull()
  })
})
