/**
 * 탭 바 (Part 11-2/11-3). Nocturne v5 TabBar로 교체(U0, `53-`).
 *
 * "미연결 유저 | 5개 탭 전부 표시" - 진입 자체를 막지 않는다. 각 탭
 * 내부에서 필요할 때만 `<CoupleGate>`로 게이팅한다(Part 11-2 표 참조).
 *
 * 탭 바는 떠 있는 섬(`TabBar`, absolute)이라 화면 영역을 줄이지 않는다.
 * 옛 화면(색·서체가 옛 테마) 위에 새 탭 바가 뜨는 것은 의도된 중간 상태다 -
 * 화면은 U1부터 하나씩 새 디자인으로 교체한다.
 *
 * 각 탭 화면은 자체 헤더를 그리므로 네이티브 헤더는 끈다.
 */
import { Tabs } from 'expo-router'
import { TabBar } from '../../src/components/nocturne/TabBar'
import { useStartDateRecheck } from '../../src/hooks/useStartDateRecheck'

export default function TabsLayout() {
  // 상대가 고친 사귄 날짜가 있으면 A20을 다시 보인다(`67-`).
  useStartDateRecheck()
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="main" options={{ title: '메인' }} />
      <Tabs.Screen name="chat" options={{ title: '채팅' }} />
      <Tabs.Screen name="feed" options={{ title: '피드' }} />
      <Tabs.Screen name="magazine" options={{ title: '매거진' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  )
}
