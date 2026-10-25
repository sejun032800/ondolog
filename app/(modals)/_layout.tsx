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
      {/* 초대 시트(F02) - 아래 화면이 비치는 투명 모달 위에 시트를 직접 그린다. */}
      <Stack.Screen
        name="couple-gate"
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'slide_from_bottom' }}
      />
      {/* 채팅 시트: 스토리 보기(F03)·사진 크게 보기(F06) - 손잡이 + ✕를 직접 그린다. */}
      <Stack.Screen name="story-viewer" options={{ headerShown: false }} />
      <Stack.Screen name="photo-viewer" options={{ headerShown: false }} />
      {/* 약관 전문(A12) - A10의 [보기]가 여는 시트. 손잡이 + ✕를 직접 그린다. */}
      <Stack.Screen name="legal-document" options={{ headerShown: false }} />
      <Stack.Screen name="biometric-consent" options={{ title: '생체정보 동의' }} />
      <Stack.Screen name="reference-photo" options={{ title: '대표사진 등록' }} />
      {/* 데이트 기록 쓰기(E11)·사진 더하기(E10) - 시트가 손잡이 + ✕ 머리를 직접 그린다. */}
      <Stack.Screen name="upload" options={{ headerShown: false }} />
      {/* 매거진 뷰어(D10 속표지 -> D11) - 속표지가 ✕를 직접 그린다. */}
      <Stack.Screen name="magazine-viewer" options={{ headerShown: false }} />
    </Stack>
  )
}
