import { Stack } from 'expo-router'
import { useTheme } from '../../src/theme'

/** Part 11-3 — 모달 그룹. 전 화면이 모달 프레젠테이션으로 뜬다. */
export default function ModalsLayout() {
  const { colors, typography } = useTheme()

  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.inkFull,
        headerTitleStyle: {
          fontFamily: typography.title.fontFamily,
          fontSize: typography.title.fontSize,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="couple-gate" options={{ title: '연인 초대' }} />
      <Stack.Screen name="biometric-consent" options={{ title: '생체정보 동의' }} />
      <Stack.Screen name="reference-photo" options={{ title: '대표사진 등록' }} />
    </Stack>
  )
}
