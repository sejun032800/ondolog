/**
 * 온보딩 그룹 스택 (Part 11-3 라우트 트리).
 * 화면 2~5(basic-info~result-brief)는 비로그인, 화면 6~8+(auth~start-date)는 로그인 이후 - 이 레이아웃 자체는 두 구간을 가르지 않는다
 * (가르는 것은 저장 위치일 뿐, 라우팅상으로는 하나의 연속된 스택이다).
 *
 * 모든 화면이 Nocturne이다(U6 1부 A01~A13 + 2부 A14~A20). 머리(←)와 바탕은 각 화면이 직접 그리므로 네이티브 헤더는 없다.
 * 순서(MASTER 6-1): result-brief(A08) -> consent(A10) -> auth(A11 로그인) -> result-detail(A14~A16) -> invite(A17·A18) -> start-date(A19·A20).
 * 약관 전문(A12)은 `(modals)/legal-document`. 로그인 뒤 화면(result-detail · invite · start-date)은 밀어서 뒤로 갈 수 없다 -
 * 앞 단계는 이미 서버에 저장됐고(세이브포인트) 되돌아갈 곳이 로그인이기 때문이다.
 */
import { Stack } from 'expo-router'
import { nocturne } from '../../src/theme/nocturne'

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: nocturne.ink } }}>
      <Stack.Screen name="basic-info" />
      <Stack.Screen name="mbti" />
      <Stack.Screen name="love-quiz" />
      <Stack.Screen name="result-brief" />
      <Stack.Screen name="consent" />
      <Stack.Screen name="underage" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="result-detail" options={{ gestureEnabled: false }} />
      <Stack.Screen name="invite" options={{ gestureEnabled: false }} />
      <Stack.Screen name="start-date" options={{ gestureEnabled: false }} />
    </Stack>
  )
}
