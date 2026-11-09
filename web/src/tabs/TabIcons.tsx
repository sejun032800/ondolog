/**
 * 탭 아이콘 5종 - 보드 `docs/design/nocturne/nocturne/icons/*.svg`의 경로 원문 그대로(`tab_icons.md`가 구현 명세).
 * viewBox 24 · 선 1.6 · 둥근 끝 · `currentColor` - 색은 부모가 정한다. 아이콘 라이브러리는 쓰지 않는다(R18-3).
 * (RN `TabIcons.tsx`의 경로는 보드와 달라, 보드가 이긴다.)
 */
import type { TabRoute } from '../app/routes'

export const TAB_ICON_SIZE = 18

export function TabIcon({ name, size = TAB_ICON_SIZE }: { name: TabRoute; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'main' ? <path d="M19.1 14.8A7.6 7.6 0 019.2 4.9a7.6 7.6 0 109.9 9.9z" /> : null}
      {name === 'chat' ? (
        <path d="M4.6 6.6a2 2 0 012-2h10.8a2 2 0 012 2v6.6a2 2 0 01-2 2h-6.9l-4 3.1a.45.45 0 01-.72-.36v-2.74a2 2 0 01-1.18-2z" />
      ) : null}
      {name === 'feed' ? (
        <>
          <rect x="4.2" y="5" width="15.6" height="14" rx="2.6" />
          <path d="M5.2 16.4l3.7-4 2.6 2.7 3.3-3.7 3.9 4.3" />
        </>
      ) : null}
      {name === 'magazine' ? (
        <path d="M12 6.6S10.2 5 7.3 5H4.6v12.6h3.1c2.6 0 4.3 1.4 4.3 1.4m0-12.4S13.8 5 16.7 5h2.7v12.6h-3.1c-2.6 0-4.3 1.4-4.3 1.4m0-12.4V19" />
      ) : null}
      {name === 'settings' ? (
        <>
          <path d="M5 7.4h14M5 12h14M5 16.6h14" />
          <circle cx="9.2" cy="7.4" r="1.9" />
          <circle cx="15.4" cy="12" r="1.9" />
          <circle cx="9.2" cy="16.6" r="1.9" />
        </>
      ) : null}
    </svg>
  )
}
