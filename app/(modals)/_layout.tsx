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
      {/* 데이트 기록 쓰기(E11)·사진 더하기(E10) - 시트가 손잡이 + ✕ 머리를 직접 그린다. */}
      <Stack.Screen name="upload" options={{ headerShown: false }} />
      {/* 매거진 뷰어(D10 속표지 -> D11) - 속표지가 ✕를 직접 그린다. */}
      <Stack.Screen name="magazine-viewer" options={{ headerShown: false }} />
    </Stack>
  )
}
