import type { CapacitorConfig } from '@capacitor/cli'

// 첫 화면이 실제로 칠하는 바탕색(.phone 바탕 = Nocturne ink). 네이티브 층 · index.html 인라인 · CSS가 모두 같은 값이다.
const INK = '#0A0814'

const config: CapacitorConfig = {
  appId: 'com.ondolog.app.web',
  appName: '온도록',
  webDir: 'dist',
  backgroundColor: INK,
  android: { backgroundColor: INK },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: INK, showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: INK },
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover', style: 'DARK' },
  },
}

export default config
