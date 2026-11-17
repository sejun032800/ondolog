/**
 * I05 되돌릴 수 없는 확인 - 보드 I05. 어두운 면(ink) 위 가운데 카드(inkRaise, 모서리 28) + "지우기"(rose 글자 · rose 선) + "취소".
 * 블러 없음. 열고 닫는 모션 없음. 뒤로 가기 = 취소. 처리 중(`busy`)에는 두 버튼을 막고 뒤로 가기도 삼킨다.
 * 부르는 쪽이 `open` 상태를 한 곳에서 쥔다(한 번에 하나만).
 */
import { useBackHandler } from '../platform/backStack'

export function ConfirmDialog({ open, title, message, notes, confirmLabel = '지우기', cancelLabel = '취소', onConfirm, onCancel, busy = false, testId }: {
  open: boolean
  title: string
  message: string
  /** 81-b: 있으면 본문 아래 줄마다 하나씩 더(예: 로그아웃 때 보내지 못한 메시지 수). */
  notes?: readonly string[]
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  testId?: string
}) {
  useBackHandler(open ? (busy ? () => {} : onCancel) : undefined)
  if (!open) return null
  return (
    <div className="dialogBack" data-testid={testId ?? 'confirm-dialog'}>
      <div className="dialogCard" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialogTitle">{title}</h2>
        <p className="dialogMsg">{message}</p>
        {(notes ?? []).map((n) => <p key={n} className="dialogMsg" data-testid="confirm-note">{n}</p>)}
        <div className="dialogBtns">
          <button type="button" className="dBtn danger press" disabled={busy} onClick={onConfirm} data-testid="confirm-yes">{confirmLabel}</button>
          <button type="button" className="dBtn press" disabled={busy} onClick={onCancel} data-testid="confirm-no">{cancelLabel}</button>
        </div>
      </div>
    </div>
  )
}
