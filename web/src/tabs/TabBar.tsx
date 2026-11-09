/**
 * 탭 바 - 보드 `docs/design/nocturne/` 기준: 바닥에서 12px 띄운 섬(높이 64 · 반경 22), 아이콘 + 글자 5개.
 * 활성 = 장밋빛(rose) 아이콘 + 글로우, 글자 text 600. 비활성 = textMute 500. **활성 표시에 점 없음**(patch6).
 * 5개 탭을 항상 모두 보인다(미연결 유저도 - 잠긴 문을 보여주는 것이 설계). 잠금은 이 바가 아니라 각 화면의 `<CoupleGate>`가 맡는다.
 * 바탕은 `#0A0814` 단색(반투명 겹침 0, B5).
 */
import { TAB_LABEL, TAB_ROUTES, type TabRoute } from '../app/routes'
import { TabIcon } from './TabIcons'

export function TabBar({ active, onSelect }: { active: TabRoute | null; onSelect: (tab: TabRoute) => void }) {
  return (
    <nav className="tabBar" role="tablist" aria-label="메인 탭" data-testid="tab-bar">
      {TAB_ROUTES.map((name) => {
        const on = name === active
        return (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={TAB_LABEL[name]}
            data-testid={`tab-${name}`}
            className={`tabItem press ${on ? 'on' : ''}`}
            onClick={() => onSelect(name)}
          >
            <span className="tabIcon"><TabIcon name={name} /></span>
            <span className="tabLabel">{TAB_LABEL[name]}</span>
          </button>
        )
      })}
    </nav>
  )
}
