/**
 * 껍질(Capacitor)과 웹 화면 사이의 얇은 다리. 화면 코드는 Capacitor를 직접 부르지 않는다(시험에서 바꿔 끼운다).
 */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'

export interface NativeBridge {
  /** 하드웨어 뒤로 가기 버튼을 받는다. 돌려준 함수로 푼다. */
  onBackButton: (cb: () => void) => () => void
  exitApp: () => void
  /** 첫 화면이 그려진 뒤 스플래시를 걷는다. */
  hideSplash: () => void
}

export const webBridge: NativeBridge = {
  onBackButton: () => () => {},
  exitApp: () => {},
  hideSplash: () => {},
}

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
}

export function defaultBridge(): NativeBridge {
  return Capacitor.isNativePlatform() ? capacitorBridge : webBridge
}
