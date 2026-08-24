/**
 * 온보딩 그룹 스택 (Part 11-3 라우트 트리).
 * 화면 2~5(basic-info~result-brief)는 비로그인, 화면 6~8+(auth~start-date)는
 * 로그인 이후 — 이 레이아웃 자체는 두 구간을 가르지 않는다(가르는 것은
 * 저장 위치일 뿐, 라우팅상으로는 하나의 연속된 스택이다).
 */
import { COLORS } from '../../src/constants/theme'
import { Stack } from 'expo-router'

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: COLORS.text,
        headerStyle: { backgroundColor: COLORS.bg },
        headerShadowVisible: false,
        headerBackTitle: '',
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="basic-info" options={{ title: '기본 정보' }} />
      <Stack.Screen name="mbti" options={{ title: 'MBTI' }} />
      <Stack.Screen name="love-quiz" options={{ title: '연애유형 질문' }} />
      <Stack.Screen name="result-brief" options={{ title: '결과 미리보기' }} />
      <Stack.Screen
        name="auth"
        options={{ title: '회원가입 · 로그인', headerBackVisible: true }}
      />
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
