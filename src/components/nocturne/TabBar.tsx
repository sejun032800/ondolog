/**
 * TabBar - 아이콘 + 글자, 바닥에서 띄운 섬. 활성 = rose 빛.
 * 5개 탭을 항상 모두 보인다(미연결 유저도 - 잠긴 문을 보여주는 것이 설계).
 * 탭의 잠금은 이 바가 아니라 각 화면의 <CoupleGate>가 맡는다.
 *
 * - `TabBarView`: 그리기만 하는 부분(확인 화면에서도 쓴다).
 * - `TabBar`: expo-router `tabBar` 렌더러 어댑터. `(tabs)/_layout.tsx`가 쓴다.
 *
 * 위치: absolute, bottom = insets.bottom + 12. 높이 64, 모서리 22.
 */
import { StyleSheet, Text, View } from 'react-native'
import type { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { PressScale } from './PressScale'
import { TabIcon, isTabIconName } from './TabIcons'
import { fontFamily, nocturne, shape, type, withAlpha } from '../../theme/nocturne'

export interface TabBarItem {
  key: string
  /** 라우트 이름. 아이콘 5종(main/chat/feed/magazine/settings)과 맞으면 아이콘이 그려진다. */
  name: string
  label: string
}

export interface TabBarViewProps {
  items: readonly TabBarItem[]
  activeIndex: number
  onPressItem: (index: number) => void
  /** 안전영역 아래 여백. bottom = bottomInset + 12 */
  bottomInset: number
}

export function TabBarView({ items, activeIndex, onPressItem, bottomInset }: TabBarViewProps) {
  return (
    <View
      style={[styles.island, { bottom: bottomInset + shape.tabBarGap }]}
      accessibilityRole="tablist"
      testID="nocturne-tab-bar"
    >
      {items.map((item, index) => {
        const focused = index === activeIndex
        return (
          <PressScale
            key={item.key}
            onPress={() => onPressItem(index)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            testID={`tab-${item.name}`}
            style={styles.item}
          >
            <View style={styles.iconWrap}>
              {focused ? <View style={styles.iconGlow} /> : null}
              {isTabIconName(item.name) ? (
                <TabIcon name={item.name} color={focused ? nocturne.rose : nocturne.textMute} />
              ) : null}
            </View>
            <Text style={[styles.label, focused ? styles.labelOn : styles.labelOff]}>{item.label}</Text>
          </PressScale>
        )
      })}
    </View>
  )
}

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>['tabBar']>
export type TabBarProps = Parameters<TabBarRenderer>[0]

export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const visible: { item: TabBarItem; routeIndex: number }[] = []
  state.routes.forEach((route, routeIndex) => {
    const { options } = descriptors[route.key]
    // expo-router는 숨긴 화면에 href: null을 준다.
    if ((options as { href?: string | null }).href === null) return
    visible.push({
      routeIndex,
      item: {
        key: route.key,
        name: route.name,
        label: typeof options.title === 'string' ? options.title : route.name,
      },
    })
  })

  const activeIndex = visible.findIndex((v) => v.routeIndex === state.index)

  return (
    <TabBarView
      items={visible.map((v) => v.item)}
      activeIndex={activeIndex}
      bottomInset={insets.bottom}
      onPressItem={(i) => {
        const { routeIndex } = visible[i]
        const route = state.routes[routeIndex]
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        })
        if (state.index !== routeIndex && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params)
        }
      }}
    />
  )
}

const styles = StyleSheet.create({
  island: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: shape.tabBarHeight,
    borderRadius: shape.radius.tabBar,
    backgroundColor: withAlpha(nocturne.ink, 0.92),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(nocturne.text, 0.1),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  item: {
    minWidth: shape.touch,
    minHeight: shape.touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  // 활성 아이콘의 rose 빛. 블러 없이 반투명 원 + boxShadow.
  iconGlow: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: shape.radius.pill,
    backgroundColor: withAlpha(nocturne.rose, 0.18),
    boxShadow: `0 0 12px 4px ${withAlpha(nocturne.rose, 0.5)}`,
  },
  label: { fontFamily: type.tab.fontFamily, fontSize: type.tab.fontSize, letterSpacing: type.tab.letterSpacing },
  labelOn: { fontFamily: fontFamily.semiBold, color: nocturne.text },
  labelOff: { color: nocturne.textMute },
})
