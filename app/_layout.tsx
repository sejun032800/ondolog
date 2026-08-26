/**
 * 루트 레이아웃 (Part 11-3).
 * 세션/onboarding_step 분기 자체는 `app/index.tsx`에서 처리한다 —
 * 여기서는 그룹별 네비게이터를 배선만 한다.
 *
 * 폰트 로드 (docs/ONDOLOG_DESIGN.md §11-6): `assets/fonts/`에 MaruBuri
 * ·Pretendard 5개 TTF가 아직 없다(§11-1, §10 열린 항목 — 네이티브 자산이라
 * Dev Build 재빌드가 필요하고, Phase 6 일괄 빌드에 포함될 예정이다).
 * `require('../assets/fonts/...')`는 메트로 번들 시점에 파일 존재를
 * 요구하므로, 파일이 없는 지금 이 경로를 그대로 쓰면 번들러가 즉시
 * 에러를 낸다 — 그래서 `useFonts` 호출 자체를 아직 하지 않는다(§11-6
 * 마지막 문단 "Dev Build 재빌드 전까지는 로드 코드만 넣고 시스템 폰트로
 * 폴백한다"를, "파일이 생기기 전까지는 빌드를 깨지 않는 방식"으로
 * 만족시킨다). `src/theme/typography.ts`의 fontFamily 값은 문서 그대로
 * (`'MaruBuri-Light'` 등) 유지되어 있고, RN은 등록되지 않은 fontFamily
 * 이름을 만나면 시스템 폰트로 자동 폴백한다 — 폰트 파일이 assets/fonts에
 * 추가되는 즉시 아래 주석을 해제하면 그대로 동작한다.
 */
import { Stack } from 'expo-router'
import { useHydrateThemePreference } from '../src/theme'

// import { useFonts } from 'expo-font'
// const [fontsLoaded] = useFonts({
//   'MaruBuri-Light': require('../assets/fonts/MaruBuri-Light.ttf'),
//   'MaruBuri-Regular': require('../assets/fonts/MaruBuri-Regular.ttf'),
//   'MaruBuri-SemiBold': require('../assets/fonts/MaruBuri-SemiBold.ttf'),
//   'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.ttf'),
//   'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.ttf'),
// })
// if (!fontsLoaded) return null

export default function RootLayout() {
  useHydrateThemePreference()

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
