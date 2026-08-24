/**
 * 탭 바 (Part 11-2/11-3).
 *
 * "미연결 유저 | 5개 탭 전부 표시" — 진입 자체를 막지 않는다. 각 탭
 * 내부에서 필요할 때만 `<CoupleGate>`로 게이팅한다(Part 11-2 표 참조).
 *
 * ⚠️ 탭 내부 화면(main/chat/feed/magazine/settings)은 Phase 3(온보딩)
 * 범위가 아니라 최소 골격만 둔다 — 실제 기능은 Phase 4+에서 채운다.
 * 이 그룹을 둔 이유는 온보딩 화면 8/+ 완료 후 갈 곳이 있어야 하고,
 * "미연결 유저에게도 5개 탭 모두 표시"·"36.5도 고정"을 라우팅상으로
 * 실제로 보여주기 위함이다.
 */
import { Tabs } from 'expo-router'
import { COLORS } from '../../src/constants/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { backgroundColor: COLORS.bg, borderTopColor: COLORS.border },
      }}
    >
      <Tabs.Screen name="main" options={{ title: '메인' }} />
      <Tabs.Screen name="chat" options={{ title: '채팅' }} />
      <Tabs.Screen name="feed" options={{ title: '피드' }} />
      <Tabs.Screen name="magazine" options={{ title: '매거진' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  )
}
