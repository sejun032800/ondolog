/**
 * 탭 바 (Part 11-2/11-3, docs/ONDOLOG_DESIGN.md §5-2/§12/§13-1).
 *
 * "미연결 유저 | 5개 탭 전부 표시" — 진입 자체를 막지 않는다. 각 탭
 * 내부에서 필요할 때만 `<CoupleGate>`로 게이팅한다(Part 11-2 표 참조).
 *
 * §13-1 골격은 각 탭 화면이 자체 `<PageHeader>`(지면 헤더)를 그려야
 * 하므로 네이티브 헤더는 끈다(`headerShown: false`). 탭바는 §5-2 규격 —
 * 배경 paper, 상단 hairline, 라벨은 caption 자간 0.06em(≈12*0.06=0.72,
 * §11-4에 별도 토큰이 없어 caption 위에 letterSpacing만 얹는다), 아이콘은
 * 쓰지 않는다(§12 — 한글 텍스트 라벨만).
 *
 * ⚠️ 탭 내부 화면(chat/feed/magazine 일부)은 Phase 3(온보딩)/Phase 4(탭
 * 골격) 범위가 아니라 최소 골격만 둔다 — 실제 기능은 Phase 5+에서 채운다.
 */
import { Tabs } from 'expo-router'
import { useTheme } from '../../src/theme'

export default function TabsLayout() {
  const { colors, typography, lines } = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.inkFull,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: {
          fontFamily: typography.caption.fontFamily,
          fontSize: typography.caption.fontSize,
          letterSpacing: 0.72,
        },
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.rule,
          borderTopWidth: lines.hairline,
        },
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
