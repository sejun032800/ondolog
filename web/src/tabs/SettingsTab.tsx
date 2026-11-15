/**
 * 설정 탭(H01 · H02) - 74-7. 그리는 일은 `features/settings/SettingsView`. 머리 "설정"은 맨 위 안전 영역 아래에 고정되고 목록만 스크롤한다(B10).
 * 미연결이어도 전부 열린다(I01은 눌러서 열리는 커플 화면 안에서). 탭 바 높이만큼 아래 여백은 `.tabBody`가 갖는다.
 */
import { useCoupleRefresh } from '../couple/useCoupleRefresh'
import { SettingsView } from '../features/settings/SettingsView'
import type { Nav } from '../navigation'
import { TabFrame } from './TabFrame'

export function SettingsTab({ nav }: { nav: Nav }) {
  useCoupleRefresh() // 탭에 들어올 때 · 앱 복귀 때 커플 값을 다시 읽는다(A-19)
  return (
    <TabFrame tab="settings">
      <SettingsView nav={nav} />
    </TabFrame>
  )
}
