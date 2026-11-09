/**
 * 탭 화면 안에서 연 시트 · 뷰어를 **탭 바 위로** 올리는 층. 탭 화면은 자기 쌓임 맥락(z-index 2)이라 안에서 그리면 탭 바(10)에 가려진다.
 * 폰 틀(`.phone`)에 붙여 그린다(없으면 body - 시험 · 틀 없는 환경).
 */
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export function PhoneLayer({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  const host = document.querySelector('.phone') ?? document.body
  return createPortal(children, host)
}
