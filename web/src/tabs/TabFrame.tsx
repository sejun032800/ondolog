/**
 * 탭 화면의 빈 틀 - 보드 톤(바탕 `#0A0814`, 머리에 탭 이름 한 줄). **가짜 데이터 0**.
 * 각 묶음이 자기 탭 화면을 채울 때 `children`으로 본문을 넣거나 이 틀 대신 자기 화면을 쓴다.
 * 탭 바(바닥에서 12 + 64)에 가려지지 않게 아래 여백을 둔다.
 */
import type { ReactNode } from 'react'
import { TAB_LABEL, type TabRoute } from '../app/routes'

export function TabFrame({ tab, children }: { tab: TabRoute; children?: ReactNode }) {
  return (
    <div className="screen solid tabScreen" data-testid={`tab-screen-${tab}`}>
      <div className="tabHeader">
        <h1 className="t-display c-text">{TAB_LABEL[tab]}</h1>
      </div>
      <div className="tabBody">{children}</div>
    </div>
  )
}
