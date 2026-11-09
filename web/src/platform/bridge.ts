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
export type SaveResult = 'saved' | 'shared' | 'cancelled' | 'failed'

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
  /** 메일 앱을 연다(`mailto:`). 시스템이 메일 앱을 못 열면(예외) `failed` - 화면이 토스트로 주소를 안내한다. 새 의존성 없이 웹뷰 이동 하나다. */
  openMail: (mailtoUrl: string) => Promise<'opened' | 'failed'>
  /** 로그인용 브라우저(앱 안 브라우저)를 연다. */
  openBrowser: (url: string) => Promise<void>
  closeBrowser: () => void
  /** 브라우저가 닫혔을 때(사용자가 닫음 · 우리가 닫음 모두). */
  onBrowserFinished: (cb: () => void) => () => void
  /** 앱 링크(`ondolog://...`)로 앱이 열렸을 때. */
  onAppUrlOpen: (cb: (url: string) => void) => () => void
  /** OS 공유 시트로 이미지를 보낸다. */
  shareImage: (image: ImageFile, dialogTitle: string) => Promise<ShareResult>
  /** OS 공유 시트로 글(초대 코드 등)을 보낸다. */
  shareText: (text: string, dialogTitle: string) => Promise<ShareResult>
  /** 이미지를 폰에 저장한다. 앱(Capacitor)에서는 공유 시트로 저장한다(`shared` / 닫으면 `cancelled`). 파일 이름은 부르는 쪽이 매번 새로 정한다(`platform/imageSave.ts`). */
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

/**
 * `mailto:` 주소로 이동한다. 안드로이드 웹뷰(Capacitor)는 http(s)가 아닌 주소를 시스템 인텐트로 넘기므로 화면은 그대로 남는다.
 * 메일 앱이 하나도 없을 때 그 사실을 웹뷰가 알려 주지 않는다 - 예외가 났을 때만 `failed`(실기기 확인 항목).
 */
async function openMailLink(mailtoUrl: string): Promise<'opened' | 'failed'> {
  try {
    window.location.href = mailtoUrl
    return 'opened'
  } catch {
    return 'failed'
  }
}

/** 브라우저 개발 서버용: 웹 API(공유 시트 · 내려받기)가 있으면 쓴다. */
export const webBridge: NativeBridge = {
  onBackButton: () => () => {},
  exitApp: () => {},
  openMail: openMailLink,
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
  shareText: async (text) => {
    try {
      if (typeof navigator.share !== 'function') return 'failed'
      await navigator.share({ text })
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
  openMail: openMailLink,
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
  shareText: async (text, dialogTitle) => {
    try {
      await Share.share({ text, dialogTitle })
      return 'shared'
    } catch (err) {
      return isCancel(err) ? 'cancelled' : 'failed'
    }
  },
  // [판단] 74-8 F2: 앱 폴더(Documents 등)에 직접 쓰지 않고 공유 시트로 저장한다. 이유: ① 파일을 직접 쓰는 방식은 갤러리가 새 파일을
  // 알아채게 하는 미디어 스캔(네이티브)이 있어야 보이는데 새 플러그인 · 네이티브 수정이 허가 밖이고, ② 재설치 뒤 이전 설치가 만든
  // 같은 이름 파일을 못 덮어쓰는 문제(F2)가 이 길에는 없다(캐시에 새 이름으로 쓰고 시트가 넘긴다). 실기기 확인: 시트에서 사진/갤러리에 저장되는지.
  saveImage: async (image) => {
    const r = await capacitorBridge.shareImage(image, '이미지 저장')
    return r === 'shared' ? 'shared' : r === 'cancelled' ? 'cancelled' : 'failed'
  },
}

export function defaultBridge(): NativeBridge {
  return Capacitor.isNativePlatform() ? capacitorBridge : webBridge
}
