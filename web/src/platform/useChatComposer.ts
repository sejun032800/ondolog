/**
 * 채팅 입력창 처리(73-1c) - 화면 코드와 분리. 75- 정식 채팅이 그대로 가져다 쓴다.
 *
 * ① 보내기 버튼이 눌려도 입력 칸의 포커스를 가져가지 않는다(누름 시작 단계에서 기본 동작을 막는다).
 * ② 한글 조합:
 *    - 함정 1 (값에 확정 안 된 조합 글자가 이미 들어 있다 / 상태가 한 박자 늦는다)
 *      -> 보낼 문자열은 React 상태가 아니라 입력 칸의 현재 값(DOM)에서 읽는다. 입력 칸은 비제어(uncontrolled)다.
 *    - 함정 2 (조합 중에 비우면 키보드 앱이 조합 글자를 다시 넣는다)
 *      -> 조합 중에 보냈으면 짧은 시간(RESIDUE_GUARD_MS) 동안 조합 입력 · compositionend 로 들어오는 글자를 바로 비운다.
 *         조합 중이 아니었으면 가드를 켜지 않는다(다음 타이핑을 먹지 않기 위해).
 *    - 엔터는 조합 중이어도 같은 규칙으로 한 번 보낸다. 보낸 뒤 값이 비므로 두 번째 엔터는 빈 입력이라 무시된다.
 *    - 공백만 있는 입력은 보내지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CompositionEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react'

/** 조합 중에 보낸 뒤 조합 잔여 글자를 지우는 시간(ms). 이 안에 오는 조합 입력은 잔여로 본다. */
export const RESIDUE_GUARD_MS = 300

export function useChatComposer(onSend: (text: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const guard = useRef(false)
  const guardTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasText, setHasText] = useState(false)

  useEffect(() => () => { if (guardTimer.current) clearTimeout(guardTimer.current) }, [])

  const armGuard = () => {
    guard.current = true
    if (guardTimer.current) clearTimeout(guardTimer.current)
    guardTimer.current = setTimeout(() => { guard.current = false }, RESIDUE_GUARD_MS)
  }

  const clear = () => {
    const el = inputRef.current
    if (el && el.value !== '') el.value = ''
    setHasText(false)
  }

  const send = useCallback((): boolean => {
    const el = inputRef.current
    if (!el) return false
    const text = el.value.trim() // 입력 칸의 현재 값(조합 중인 글자 포함)
    if (text.length === 0) return false
    const hadFocus = document.activeElement === el
    const wasComposing = composing.current
    clear()
    if (wasComposing) armGuard()
    onSend(text)
    // 안전망: 어떤 이유로든 포커스가 빠졌으면 돌려놓는다.
    if (hadFocus && document.activeElement !== el) el.focus({ preventScroll: true })
    return true
  }, [onSend])

  const inputProps = {
    ref: inputRef,
    enterKeyHint: 'send' as const,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const el = e.currentTarget
      const isComposingNow = composing.current || (e.nativeEvent as InputEvent).isComposing === true
      if (guard.current && isComposingNow) { el.value = ''; setHasText(false); return } // 조합 잔여
      setHasText(el.value.trim().length > 0)
    },
    onCompositionStart: () => { composing.current = true },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => {
      composing.current = false
      if (guard.current) { e.currentTarget.value = ''; setHasText(false); return }
      setHasText(e.currentTarget.value.trim().length > 0)
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      e.preventDefault()
      send()
    },
  }

  /** 포커스를 빼앗지 않는 버튼에 펼쳐 쓴다. */
  const keepFocusProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => e.preventDefault(),
    onMouseDown: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  }
  const sendButtonProps = { ...keepFocusProps, onClick: () => { send() } }

  return { inputRef, hasText, inputProps, sendButtonProps, keepFocusProps, send }
}
