/**
 * 탭 아이콘 5종 - canvas/N-T-Tabs.dc.html의 인라인 SVG 경로를 그대로 옮겼다.
 * viewBox 24, 선 1.6, 둥근 끝. 아이콘 라이브러리는 쓰지 않는다(R18-3).
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg'

export type TabIconName = 'main' | 'chat' | 'feed' | 'magazine' | 'settings'

export interface TabIconProps {
  name: TabIconName
  color: string
  size?: number
}

export function TabIcon({ name, color, size = 22 }: TabIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'main' ? <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /> : null}
      {name === 'chat' ? (
        <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4A2.5 2.5 0 0 1 4 13.5z" />
      ) : null}
      {name === 'feed' ? (
        <>
          <Rect x={4} y={5} width={16} height={14} rx={2.5} />
          <Path d="M4 16l4.5-4.5 4 4 2.5-2.5L20 18" />
        </>
      ) : null}
      {name === 'magazine' ? (
        <Path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" />
      ) : null}
      {name === 'settings' ? (
        <>
          <Path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0" />
          <Circle cx={16} cy={7} r={2} />
          <Circle cx={10} cy={12} r={2} />
          <Circle cx={18} cy={17} r={2} />
        </>
      ) : null}
    </Svg>
  )
}

export const TAB_ICON_NAMES: readonly TabIconName[] = ['main', 'chat', 'feed', 'magazine', 'settings']

export function isTabIconName(name: string): name is TabIconName {
  return (TAB_ICON_NAMES as readonly string[]).includes(name)
}
