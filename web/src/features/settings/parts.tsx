/**
 * 설정 화면 공통 부품(74-7) - RN `components/settings/SettingsScreen` · `nocturne/ListGroup` · `Toggle` · `DangerButton`의 웹판.
 *  - `SettingsFrame`: 푸시 화면 틀. 머리(← 제목 · 오른쪽 글자 버튼) · 본문(스크롤) · 아래 고정 영역. 머리는 맨 위 안전 영역 아래에서 시작한다(B10).
 *    뒤로 가기는 규칙표(`app/backRules`)를 따르는 `nav.back`이다(하드웨어 뒤로 가기와 같다).
 *  - `ListGroup` · `ListRow`: 보드 H01~H19의 줄 목록(라벨 왼쪽, 값 + → 오른쪽). 값이 늦게 채워지는 줄은 `loading`이면 I03 뼈대가 값 자리를 잡는다(B14).
 *  - `Toggle`: 켜짐 lilac 알약(H11 마케팅).
 * 색 · 크기는 `styles.css`의 `.set*` 클래스(토큰 변수만 쓴다).
 */
import type { ReactNode } from 'react'
import { Skeleton } from '../../components/Skeleton'

export function SettingsFrame({ title, onBack, action, children, footer, testId }: {
  title: string
  onBack: () => void
  /** 머리 오른쪽 글자 버튼(예: 저장). 비활성은 textFaint. */
  action?: { label: string; onPress: () => void; disabled?: boolean; testId?: string }
  children?: ReactNode
  footer?: ReactNode
  testId?: string
}) {
  return (
    <div className="screen solid" data-testid={testId}>
      <div className="pushHeader">
        <button type="button" className="back press" aria-label="뒤로" onClick={onBack}>←</button>
        <h1 className="t-title c-text">{title}</h1>
        {action ? (
          <button type="button" className="setAction press" disabled={action.disabled} onClick={action.onPress} data-testid={action.testId}>{action.label}</button>
        ) : (
          <span className="pushHeaderSpacer" aria-hidden="true" />
        )}
      </div>
      <div className="setBody">{children}</div>
      {footer ? <div className="footer setFooter">{footer}</div> : null}
    </div>
  )
}

export function ListGroup({ children, testId }: { children: ReactNode; testId?: string }) {
  return <div className="setGroup" data-testid={testId}>{children}</div>
}

export function ListRow({ label, value, description, onPress, disabled, control, loading, testId }: {
  label: string
  value?: string
  /** 라벨 아래 한 줄(H05 "몇 번이든 바꿀 수 있어요" 등). */
  description?: string
  onPress?: () => void
  disabled?: boolean
  /** 오른쪽 컨트롤(토글). 있으면 → 를 그리지 않는다. */
  control?: ReactNode
  /** 값이 아직 안 왔다 - 값 자리에 뼈대(I03). */
  loading?: boolean
  testId?: string
}) {
  const body = (
    <>
      <span className="setRowText">
        <span className="setRowLabel">{label}</span>
        {description ? <span className="setRowDesc">{description}</span> : null}
      </span>
      {control ?? (
        <span className="setRowValue">
          {loading ? <Skeleton width={56} height={12} /> : value ? <span className="setValueText">{value}</span> : null}
          {onPress ? <span className="setArrow" aria-hidden="true">→</span> : null}
        </span>
      )}
    </>
  )
  if (control !== undefined || !onPress) return <div className="setRow static" data-testid={testId}>{body}</div>
  return <button type="button" className="setRow press" disabled={disabled} onClick={onPress} data-testid={testId}>{body}</button>
}

export function Toggle({ value, onChange, disabled, label, testId }: {
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  testId?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={`setToggle press ${value ? 'on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!value)}
      data-testid={testId}
    ><i /></button>
  )
}

/** [연결 해제] 같은 되돌리기 어려운 길의 버튼 - 짙은 면 + 장미색 선 · 글자. 주 버튼이 아니다(보드 H04). */
export function DangerButton({ label, onClick, disabled, testId }: { label: string; onClick: () => void; disabled?: boolean; testId?: string }) {
  return <button type="button" className="setDanger press" disabled={disabled} onClick={onClick} data-testid={testId}>{label}</button>
}

/** 값이 늦게 오는 한 줄 글자의 뼈대(예: 이름 · 날짜). */
export function SettingsSkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="setSkeleton" data-testid="settings-skeleton">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} width={i % 2 === 0 ? '72%' : '48%'} height={14} />)}
    </div>
  )
}
