/**
 * F06 사진 크게 보기의 [저장] · [공유](보드 F06). 이미지를 받아 `NativeBridge`로 넘긴다.
 *
 * 저장은 결과 공유 카드와 같은 한 함수(`platform/imageSave.ts`의 `saveImageToDevice`)를 지난다(F2): 저장할 때마다 파일 이름이 새로 정해지고,
 * 실패하면 `failed`만 돌려줘 호출한 쪽이 안내 토스트를 띄운다(원인 · 경로 · 이름 로그 0).
 */
import type { ImageFile, NativeBridge, SaveResult, ShareResult } from '../../platform/bridge'
import { extOfDataUrl, saveImageToDevice, savedImageFileName, type SaveImageDeps } from '../../platform/imageSave'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(blob)
  })
}

export interface PhotoActionDeps extends SaveImageDeps {
  fetchImpl?: typeof fetch
}

/** 서명 주소의 사진을 받아 다리가 받는 모양(`ImageFile`)으로. */
export async function photoUrlToImageFile(url: string, deps: PhotoActionDeps = {}): Promise<ImageFile> {
  const blob = await (await (deps.fetchImpl ?? fetch)(url)).blob()
  const dataUrl = await blobToDataUrl(blob)
  return { dataUrl, fileName: savedImageFileName('chat', (deps.now ?? (() => new Date()))(), extOfDataUrl(dataUrl), deps.random) }
}

export async function saveChatPhoto(bridge: NativeBridge, url: string, deps: PhotoActionDeps = {}): Promise<SaveResult> {
  try {
    const image = await photoUrlToImageFile(url, deps)
    return await saveImageToDevice(bridge, image, 'chat', deps)
  } catch {
    return 'failed'
  }
}

export async function shareChatPhoto(bridge: NativeBridge, url: string, deps: PhotoActionDeps = {}): Promise<ShareResult> {
  try {
    return await bridge.shareImage(await photoUrlToImageFile(url, deps), '사진 공유')
  } catch {
    return 'failed'
  }
}
