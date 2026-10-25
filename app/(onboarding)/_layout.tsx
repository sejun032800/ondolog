/**
 * 온보딩 그룹 스택 (Part 11-3 라우트 트리).
 * 화면 2~5(basic-info~result-brief)는 비로그인, 화면 6~8+(auth~start-date)는
 * 로그인 이후 — 이 레이아웃 자체는 두 구간을 가르지 않는다(가르는 것은
 * 저장 위치일 뿐, 라우팅상으로는 하나의 연속된 스택이다).
 *
 * 네이티브 헤더는 각 화면의 내비게이션 타이틀(작은 상단바)만 담당하고,
 * 화면 본문의 큰 제목은 `ScreenContainer`의 `title`(display 토큰)이
 * 별도로 그린다 — Phase 3부터의 이 이중 구조를 그대로 유지한다.
 */
import { Stack } from 'expo-router'
import { useTheme } from '../../src/theme'
import { nocturne } from '../../src/theme/nocturne'

/**
 * U6 1부로 Nocturne 화면이 된 라우트 - 머리(←)와 바탕을 화면이 직접 그린다. 네이티브 헤더가 없다.
 * 순서(MASTER 6-1): result-brief(A08) -> consent(A10) -> auth(A11 로그인) -> result-detail. 만 14세 미만은 consent에서 underage(A13)로.
 * 약관 전문(A12)은 `(modals)/legal-document`.
 */
const NOCTURNE_SCREEN = { headerShown: false, contentStyle: { backgroundColor: nocturne.ink } } as const

export default function OnboardingLayout() {
  const { colors, typography } = useTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.inkFull,
        headerStyle: { backgroundColor: colors.paper },
        headerTitleStyle: {
          fontFamily: typography.title.fontFamily,
          fontSize: typography.title.fontSize,
        },
        headerShadowVisible: false,
        headerBackTitle: '',
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="basic-info" options={NOCTURNE_SCREEN} />
      <Stack.Screen name="mbti" options={NOCTURNE_SCREEN} />
      <Stack.Screen name="love-quiz" options={NOCTURNE_SCREEN} />
      <Stack.Screen name="result-brief" options={NOCTURNE_SCREEN} />
      <Stack.Screen name="consent" options={NOCTURNE_SCREEN} />
      <Stack.Screen name="underage" options={NOCTURNE_SCREEN} />
      <Stack.Screen name="auth" options={NOCTURNE_SCREEN} />
      <Stack.Screen
        name="result-detail"
        options={{ title: '나의 연애유형', headerBackVisible: false }}
      />
      <Stack.Screen
        name="invite"
        options={{ title: '연인 초대', headerBackVisible: false }}
      />
      <Stack.Screen
        name="start-date"
        options={{ title: '사귄 날짜', headerBackVisible: false }}
      />
    </Stack>
  )
}
