/**
 * 공용 시트 부품: 열기 연출(아래에서 올라옴 380ms) · 닫기 연출(260ms) · 바깥(어두운 면) 누르면 닫힘 · 뒤로 가기로 닫힘.
 *  - 닫는 중에는 뒤로 가기 · 바깥 누름을 삼킨다(연출 도중 두 번 닫히거나 앞 화면이 같이 뒤로 가지 않게).
 *  - 열려 있는 동안 뒤로 가기는 이 시트만 닫는다(`platform/backStack`이 규칙표보다 먼저 받는다).
 *  - `prefers-reduced-motion`이면 연출 없이 즉시 닫힌다.
 *  - 한 번에 하나만 열리는 보장은 `stores/sheetStore`(앱 시트) 몫이다. 이 부품은 그리기만 한다.
 * 바탕은 `#0A0814` 계열 단색, 바깥 면은 ink를 어둡게 한 값(보드 I05) - 흰 프레임 · 반투명 겹침 0(B5).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useBackHandler } from '../platform/backStack'
import { prefersReducedMotion } from '../platform/motion'

export const SHEET_CLOSE_MS = 260

const SheetCloseContext = createContext<() => void>(() => {})
/** 시트 안의 버튼이 시트를 닫을 때(연출을 거쳐 닫힌다). */
export function useSheetClose(): () => void {
  return useContext(SheetCloseContext)
}

export function Sheet({ onClosed, variant = 'auto', handle = true, children, testId }: {
  /** 닫기 연출이 끝난 뒤 부른다. 부모는 여기서 시트를 내린다. */
  onClosed: () => void
  /** `full`: 위쪽 48px만 남기고 가득(법적 문서 등). `auto`: 내용 높이. */
  variant?: 'full' | 'auto'
  handle?: boolean
  children: ReactNode
  testId?: string
}) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    if (prefersReducedMotion()) {
      onClosedRef.current()
      return
    }
    setClosing(true)
    timer.current = window.setTimeout(() => onClosedRef.current(), SHEET_CLOSE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // 닫는 중에는 뒤로 가기를 삼킨다(빈 함수를 등록해 앞 화면으로 새지 않게).
  useBackHandler(closing ? () => {} : close)

  return (
    <SheetCloseContext.Provider value={close}>
      <div className="sheetBack" data-testid="sheet-backdrop" onClick={close} style={closing ? { opacity: 0, transition: `opacity ${SHEET_CLOSE_MS}ms` } : undefined} />
      <div className={`sheet ${variant} ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" data-testid={testId ?? 'sheet'}>
        {handle ? <div className="handle" /> : null}
        {children}
      </div>
    </SheetCloseContext.Provider>
  )
}
