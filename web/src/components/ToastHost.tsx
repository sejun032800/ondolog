/**
 * I06 토스트 - 보드 I06. 하단 가운데 밝은 알약(text 면 + ink 글자) + 선택 글자 버튼("보기", 어두운 lilac 톤).
 * 탭 바 위에 뜬다(탭 화면일 때). 시간이 지나면 저절로 사라진다(`TOAST_DURATION_MS`). 연출은 짧은 떠오름 하나(reduced-motion이면 없음).
 * Shell에 하나만 둔다.
 */
import { useEffect } from 'react'
import { TOAST_DURATION_MS, useToastStore } from '../stores/toastStore'

export function ToastHost({ aboveTabBar }: { aboveTabBar: boolean }) {
  const toast = useToastStore((s) => s.toast)
  const hide = useToastStore((s) => s.hide)
  const id = toast?.id
  useEffect(() => {
    if (id === undefined) return
    const t = window.setTimeout(hide, TOAST_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [id, hide])
  if (!toast) return null
  return (
    <div className={`toastWrap ${aboveTabBar ? 'aboveTabs' : ''}`}>
      <div className="toastPill" role="alert" key={toast.id} data-testid="toast">
        <span className="toastMsg" data-testid="toast-message">{toast.message}</span>
        {toast.actionLabel ? (
          <button type="button" className="toastAction" data-testid="toast-action" onClick={() => { hide(); toast.onAction?.() }}>{toast.actionLabel}</button>
        ) : null}
      </div>
    </div>
  )
}
