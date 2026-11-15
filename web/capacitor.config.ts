import type { CapacitorConfig } from '@capacitor/cli'

// 첫 화면이 실제로 칠하는 바탕색(.phone 바탕 = Nocturne ink). 네이티브 층 · index.html 인라인 · CSS가 모두 같은 값이다.
const INK = '#0A0814'

const config: CapacitorConfig = {
  appId: 'com.ondolog.app.web',
  appName: '온도록',
  webDir: 'dist',
  backgroundColor: INK,
  android: { backgroundColor: INK },
  // A-7: 앱 링크(로그인 코드가 실린 주소)가 기기 로그(logcat)에 찍히지 않게 네이티브 로그를 끈다. 켜야 할 때만 'debug'로 바꿔 시험한다.
  loggingBehavior: 'none',
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: INK, showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: INK },
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover', style: 'DARK' },
  },
}

export default config
