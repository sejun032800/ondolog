/**
 * 루트 레이아웃 (Part 11-3).
 * 세션/onboarding_step 분기 자체는 `app/index.tsx`에서 처리한다 —
 * 여기서는 그룹별 네비게이터를 배선만 한다.
 */
import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
