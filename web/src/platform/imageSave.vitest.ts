import { afterEach, describe, expect, it, vi } from 'vitest'

const writeFile = vi.fn()
const share = vi.fn()
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile: (...a: unknown[]) => writeFile(...a) }, Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS' } }))
vi.mock('@capacitor/share', () => ({ Share: { share: (...a: unknown[]) => share(...a) } }))

import { capacitorBridge } from './bridge'
import { extOfDataUrl, saveImageToDevice, saveNotice, savedImageFileName } from './imageSave'
import { makeFakeBridge } from '../testSupport'

afterEach(() => { writeFile.mockReset(); share.mockReset(); vi.restoreAllMocks() })

const PNG = 'data:image/png;base64,AAAA'

describe('이미지 저장 한 길 (F2)', () => {
  it('저장할 때마다 이름이 다르다(같은 밀리초여도 무작위 칸이 다르다) - 종류 · 확장자도 따른다', () => {
    const at = new Date(2026, 10, 9, 1, 2, 3, 4)
    const names = new Set<string>()
    for (let i = 0; i < 50; i++) names.add(savedImageFileName('result', at, 'png'))
    expect(names.size).toBeGreaterThan(40)
    expect(savedImageFileName('result', at, 'png', () => 0)).toBe('ondolog-result-20261109-010203-004-0000.png')
    expect(extOfDataUrl('data:image/jpeg;base64,AA')).toBe('jpg')
    expect(extOfDataUrl('data:image/webp;base64,AA')).toBe('webp')
    expect(extOfDataUrl('이상한 값')).toBe('png')
    expect(savedImageFileName('chat', at, 'jpg', () => 0.999999)).toMatch(/^ondolog-chat-\d{8}-\d{6}-\d{3}-[0-9a-z]{4}\.jpg$/)
  })

  it('결과 카드와 채팅 사진이 같은 다리 함수를 지나고, 받은 파일 이름 대신 새 이름이 간다', async () => {
    const seen: string[] = []
    const bridge = makeFakeBridge({ saveImage: vi.fn(async (img) => { seen.push(img.fileName); return 'saved' as const }) })
    await saveImageToDevice(bridge, { dataUrl: PNG }, 'result')
    await saveImageToDevice(bridge, { dataUrl: PNG }, 'result')
    await saveImageToDevice(bridge, { dataUrl: 'data:image/jpeg;base64,AA' }, 'chat')
    expect(seen).toHaveLength(3)
    expect(new Set(seen).size).toBe(3)
    expect(seen[0]).toMatch(/^ondolog-result-/)
    expect(seen[2]).toMatch(/^ondolog-chat-.*\.jpg$/)
    expect(seen.every((s) => s !== 'ondolog-result.png')).toBe(true)
  })

  it('실패하면 failed만 돌려주고(던지지 않음) 안내 문장이 있다 / 시트를 닫으면 안내 없음', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bridge = makeFakeBridge({ saveImage: vi.fn(async () => { throw new Error('/storage/emulated/0/secret-path') }) })
    const r = await saveImageToDevice(bridge, { dataUrl: PNG }, 'result')
    expect(r).toBe('failed')
    expect(saveNotice(r, '저장했어요', '저장하지 못했어요')).toBe('저장하지 못했어요')
    expect(saveNotice('saved', '저장했어요', '못했어요')).toBe('저장했어요')
    expect(saveNotice('cancelled', 'a', 'b')).toBeNull()
    expect(saveNotice('shared', 'a', 'b')).toBeNull()
    expect(log).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('앱(Capacitor) 저장은 캐시에 쓴 파일을 공유 시트로 보낸다 - 문서 폴더에 직접 쓰지 않고, 로그에 경로를 남기지 않는다', async () => {
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')].map((s) => s.mockImplementation(() => {}))
    writeFile.mockResolvedValue({ uri: 'file:///cache/x.png' })
    share.mockResolvedValue({})
    expect(await capacitorBridge.saveImage({ dataUrl: PNG, fileName: 'ondolog-result-1.png' })).toBe('shared')
    expect(writeFile.mock.calls[0][0]).toMatchObject({ path: 'ondolog-result-1.png', directory: 'CACHE' })
    expect(share).toHaveBeenCalledTimes(1)

    share.mockRejectedValueOnce(new Error('Share canceled'))
    expect(await capacitorBridge.saveImage({ dataUrl: PNG, fileName: 'b.png' })).toBe('cancelled')
    writeFile.mockRejectedValueOnce(new Error('EACCES /storage/emulated/0/Documents/ONDOLOG/b.png'))
    expect(await capacitorBridge.saveImage({ dataUrl: PNG, fileName: 'c.png' })).toBe('failed')
    for (const l of logs) expect(l).not.toHaveBeenCalled()
  })
})
