/**
 * 소프트 키보드가 열려 있는가. Capacitor 8 SystemBars `insetsHandling: native`에서는 키보드가 열리면 창(`innerHeight`)이 키보드 높이만큼 줄어든다.
 * 글자 입력 칸에 포커스가 있고 창이 직전 "닫힘" 높이보다 `KEYBOARD_MIN_PX` 넘게 줄어야 열림으로 본다 - PC에서 창을 줄이는 것(포커스 없음)은 열림이 아니다.
 * 채팅 탭이 이것으로 탭 바를 비키고 입력줄 아래 여백을 줄인다(RN `keyboardVisible`).
 */
import { useEffect, useState } from 'react'

export const KEYBOARD_MIN_PX = 120

function textFieldFocused(): boolean {
  const a = document.activeElement
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let baseline = window.innerHeight
    const measure = () => {
      const focused = textFieldFocused()
      if (!focused || window.innerHeight > baseline) baseline = window.innerHeight // 닫힘 높이를 기억한다
      setOpen(focused && baseline - window.innerHeight >= KEYBOARD_MIN_PX)
    }
    window.addEventListener('resize', measure)
    document.addEventListener('focusin', measure)
    document.addEventListener('focusout', measure)
    return () => {
      window.removeEventListener('resize', measure)
      document.removeEventListener('focusin', measure)
      document.removeEventListener('focusout', measure)
    }
  }, [])
  return open
}
