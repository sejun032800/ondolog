/**
 * I06 토스트 - 보드 I06. 하단 가운데 밝은 알약(text 면 + ink 글자) + 선택 글자 버튼("보기", 어두운 lilac 톤).
 * 탭 바 위에 뜬다(탭 화면일 때). 시간이 지나면 저절로 사라진다(`TOAST_DURATION_MS`). 연출은 짧은 떠오름 하나(reduced-motion이면 없음).
 * Shell에 하나만 둔다.
 * 위치(A-10 D10 · W2): 아래쪽 주 버튼(메인 [연인 초대하기] · 화면 푸터 · 시트 저장 버튼)이 있는 곳에서는 알약이 버튼을 덮으므로 위쪽(상태 줄 아래)에 띄운다(`top`).
 * 피드 · 채팅 · 매거진 · 설정 탭처럼 아래에 주 버튼이 없는 곳은 보드 I06대로 탭 바 위.
 */
import { useEffect } from 'react'
import { IS_TRIAL_BUILD } from '../config/env'
import { PhotoDiag } from './PhotoDiag'
import { TOAST_DURATION_MS, useToastStore } from '../stores/toastStore'

export function ToastHost({ aboveTabBar, top = false }: { aboveTabBar: boolean; top?: boolean }) {
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
    <div className={`toastWrap ${top ? 'atTop' : aboveTabBar ? 'aboveTabs' : ''}`} data-placement={top ? 'top' : 'bottom'}>
      <div className="toastPill" role="alert" key={toast.id} data-testid="toast">
        <span className="toastMsg" data-testid="toast-message">{toast.message}</span>
        {toast.actionLabel ? (
          <button type="button" className="toastAction" data-testid="toast-action" onClick={() => { hide(); toast.onAction?.() }}>{toast.actionLabel}</button>
        ) : null}
      </div>
      {IS_TRIAL_BUILD && toast.message.includes('사진') ? <PhotoDiag testId="photo-diag-toast" /> : null}
    </div>
  )
}
