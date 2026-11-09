/**
 * I04 빈 상태 - 보드 I04. 점선 네모 셋 + 굵은 한 줄 + 보조 문장(두 줄까지) + (선택) 주 버튼 하나. 해요체, 고장이 아니라 아직 시작 전이라는 말투.
 * 화면에 이미 자기 보드가 있는 빈 상태는 그 화면의 문장이 이긴다. 이 부품은 보드가 따로 없는 목록의 빈 상태가 쓴다.
 */
import { PrimaryButton } from '../ui'

export function EmptyState({ title, body, actionLabel, onAction, actionDisabled, testId }: {
  title: string
  /** 보조 문장. 줄바꿈은 `\n`. */
  body?: string
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
  testId?: string
}) {
  return (
    <div className="emptyState" data-testid={testId ?? 'empty-state'}>
      <div className="emptySquares" aria-hidden="true"><i /><i /><i /></div>
      <p className="emptyTitle">{title}</p>
      {body ? <p className="emptyBody pre">{body}</p> : null}
      {actionLabel && onAction ? (
        <div className="emptyAction"><PrimaryButton label={actionLabel} onClick={onAction} disabled={actionDisabled} /></div>
      ) : null}
    </div>
  )
}
