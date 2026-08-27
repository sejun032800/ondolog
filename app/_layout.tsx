/**
 * 루트 레이아웃 (Part 11-3).
 * 세션/onboarding_step 분기 자체는 `app/index.tsx`에서 처리한다 —
 * 여기서는 그룹별 네비게이터를 배선만 한다.
 *
 * 폰트 로드 (docs/ONDOLOG_DESIGN.md §11-6): `assets/fonts/`에 MaruBuri
 * Light/Regular/SemiBold(.ttf) + Pretendard Regular/SemiBold(.otf) 5개가
 * 배치되어(2026-08-26) `useFonts` 호출을 활성화했다. Pretendard는 배포
 * 원본이 `.otf`라 `require` 경로도 `.ttf`가 아닌 `.otf`를 가리킨다(§11-6
 * 원문은 확장자를 명시하지 않는다 — 실제 배치된 파일 확장자를 그대로
 * 따름). `src/theme/typography.ts`의 fontFamily 값(`'MaruBuri-Light'` 등)과
 * 아래 키가 정확히 일치해야 한다 — RN은 미등록 fontFamily를 만나면
 * 시스템 폰트로 조용히 폴백하므로, 오타가 나도 크래시 대신 폰트만
 * 틀리게 보인다(발견하기 어려움).
 */
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { useHydrateThemePreference } from '../src/theme'

export default function RootLayout() {
  useHydrateThemePreference()
  const [fontsLoaded] = useFonts({
    'MaruBuri-Light': require('../assets/fonts/MaruBuri-Light.ttf'),
    'MaruBuri-Regular': require('../assets/fonts/MaruBuri-Regular.ttf'),
    'MaruBuri-SemiBold': require('../assets/fonts/MaruBuri-SemiBold.ttf'),
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
  })
  if (!fontsLoaded) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
