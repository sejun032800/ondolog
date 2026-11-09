/**
 * 껍질(Capacitor)과 웹 화면 사이의 얇은 다리. 화면 코드는 Capacitor를 직접 부르지 않는다(시험에서 바꿔 끼운다).
 */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { SplashScreen } from '@capacitor/splash-screen'

export type ShareResult = 'shared' | 'cancelled' | 'failed'
export type SaveResult = 'saved' | 'shared' | 'failed'

export interface ImageFile {
  /** `data:image/png;base64,...` */
  dataUrl: string
  fileName: string
}

export interface NativeBridge {
  /** 하드웨어 뒤로 가기 버튼을 받는다. 돌려준 함수로 푼다. */
  onBackButton: (cb: () => void) => () => void
  exitApp: () => void
  /** 첫 화면이 그려진 뒤 스플래시를 걷는다. */
  hideSplash: () => void
  /** 로그인용 브라우저(앱 안 브라우저)를 연다. */
  openBrowser: (url: string) => Promise<void>
  closeBrowser: () => void
  /** 브라우저가 닫혔을 때(사용자가 닫음 · 우리가 닫음 모두). */
  onBrowserFinished: (cb: () => void) => () => void
  /** 앱 링크(`ondolog://...`)로 앱이 열렸을 때. */
  onAppUrlOpen: (cb: (url: string) => void) => () => void
  /** OS 공유 시트로 이미지를 보낸다. */
  shareImage: (image: ImageFile, dialogTitle: string) => Promise<ShareResult>
  /** 이미지를 폰에 저장한다. 저장 칸을 못 쓰면 공유 시트로 대신한다(`shared`). */
  saveImage: (image: ImageFile) => Promise<SaveResult>
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function base64Of(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? ''
}

/** 브라우저 개발 서버용: 웹 API(공유 시트 · 내려받기)가 있으면 쓴다. */
export const webBridge: NativeBridge = {
  onBackButton: () => () => {},
  exitApp: () => {},
  hideSplash: () => {},
  openBrowser: async (url) => {
    window.location.assign(url)
  },
  closeBrowser: () => {},
  onBrowserFinished: () => () => {},
  onAppUrlOpen: () => () => {},
  shareImage: async (image) => {
    try {
      const file = new File([dataUrlToBlob(image.dataUrl)], image.fileName, { type: 'image/png' })
      if (typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] })) return 'failed'
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      return (err as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed'
    }
  },
  saveImage: async (image) => {
    try {
      const url = URL.createObjectURL(dataUrlToBlob(image.dataUrl))
      const a = document.createElement('a')
      a.href = url
      a.download = image.fileName
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      return 'saved'
    } catch {
      return 'failed'
    }
  },
}

function isCancel(err: unknown): boolean {
  return /cancel/i.test(String((err as { message?: unknown })?.message ?? ''))
}

/**
 * Android 웹뷰(Capacitor)용. 웹뷰는 `navigator.share`(웹 공유 API)가 없고, `<a download>` 내려받기도 막혀 있어
 * 공유 · 저장은 1차 플러그인(@capacitor/share · @capacitor/filesystem)으로 한다.
 */
export const capacitorBridge: NativeBridge = {
  onBackButton: (cb) => {
    const handle = App.addListener('backButton', cb)
    return () => {
      void handle.then((h) => h.remove())
    }
  },
  exitApp: () => {
    void App.exitApp()
  },
  hideSplash: () => {
    void SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {})
  },
  openBrowser: async (url) => {
    await Browser.open({ url })
  },
  closeBrowser: () => {
    void Browser.close().catch(() => {})
  },
  onBrowserFinished: (cb) => {
    const handle = Browser.addListener('browserFinished', cb)
    return () => {
      void handle.then((h) => h.remove())
    }
  },
  onAppUrlOpen: (cb) => {
    const handle = App.addListener('appUrlOpen', (e) => cb(e.url))
    return () => {
      void handle.then((h) => h.remove())
    }
  },
  shareImage: async (image, dialogTitle) => {
    try {
      const written = await Filesystem.writeFile({
        path: image.fileName,
        data: base64Of(image.dataUrl),
        directory: Directory.Cache,
      })
      await Share.share({ files: [written.uri], dialogTitle })
      return 'shared'
    } catch (err) {
      return isCancel(err) ? 'cancelled' : 'failed'
    }
  },
  saveImage: async (image) => {
    try {
      await Filesystem.writeFile({
        path: `ONDOLOG/${image.fileName}`,
        data: base64Of(image.dataUrl),
        directory: Directory.Documents,
        recursive: true,
      })
      return 'saved'
    } catch {
      // 저장 칸을 못 쓰면 공유 시트로 대신한다(시트에서 저장할 곳을 고른다).
      const shared = await capacitorBridge.shareImage(image, '이미지 저장')
      return shared === 'shared' ? 'shared' : 'failed'
    }
  },
}

export function defaultBridge(): NativeBridge {
  return Capacitor.isNativePlatform() ? capacitorBridge : webBridge
}
