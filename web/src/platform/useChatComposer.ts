/**
 * 채팅 입력창 처리 - 화면 코드와 분리(73-1c, 74-5에서 입력 이벤트 방식으로 다시 씀 R73-2).
 *
 * ① 보내기 버튼이 눌려도 입력 칸의 포커스를 가져가지 않는다(누름 시작 단계에서 기본 동작을 막는다). 보낸 뒤에도 키보드가 내려가지 않는다.
 * ② 한글 조합 - **시간으로 무시하지 않는다**(옛 300ms 가드 삭제). 조합 이벤트(`compositionstart` · `compositionupdate` · `compositionend`)와
 *    `beforeinput` · `input`의 `inputType`(`insertCompositionText` · `insertText` · `deleteContentBackward` ...)으로 "키보드 앱이 보낸 뒤 다시 넣는 조합 글자(잔여)"와
 *    "사용자가 새로 친 글자"를 가른다.
 *    - 보낼 문자열은 React 상태가 아니라 입력 칸의 현재 값(DOM)에서 읽는다. 조합 중인 글자도 값에 들어 있고, 상태는 한 박자 늦기 때문이다. 입력 칸은 비제어다.
 *    - 조합 중에 보냈다면, 그때 조합 중이던 글자(`tail`)를 "묵은 조합"(`stale`)으로 적어 둔다. 이 묵은 조합에 속한 이벤트만 잔여로 본다.
 *        · 같은 글자가 조합 글자로 다시 들어오면(`insertCompositionText` data === stale) 잔여 -> 지운다.
 *        · 묵은 조합 글자 뒤에 새 글자가 붙어 들어오면(data가 stale로 시작) 앞부분만 지우고 새 글자는 남긴다.
 *        · 묵은 조합이 끝나며(`compositionend`) 글자를 확정해 넣으면 그 글자를 지우고 묵은 조합을 끝낸다.
 *        · stale과 관계없는 조합 글자(`ㅎ` 등) · 조합이 아닌 입력(`insertText` · 붙여넣기) · 지우기가 오면 사용자가 새로 친 것이므로 stale을 버리고 그대로 받는다.
 *      조합 중이 아니었으면 stale을 만들지 않는다(다음 타이핑을 먹지 않는다).
 *    - 엔터는 조합 중이어도 같은 규칙으로 한 번 보낸다. 보낸 뒤 값이 비므로 두 번째 엔터는 빈 입력이라 무시되고, 잔여 글자만 남았을 때도 보내지 않는다(빈 말풍선 0).
 *    - 공백만 있는 입력은 보내지 않는다(`canSendBody` - 화면 · 훅 · API가 쓰는 단 하나의 규칙).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { canSendBody } from '@/utils/chatMessages'

/** 묵은 조합(`stale`)을 잔여로 알아보는 판단. 시험이 직접 부르는 순수 함수. */
export type ResidueVerdict =
  | { kind: 'echo' } // 같은 글자가 다시 들어옴 - 전부 지운다
  | { kind: 'prefixed'; rest: string } // 묵은 글자 뒤에 새 글자 - 새 글자만 남긴다
  | { kind: 'fresh' } // 관계없음 - 사용자가 새로 침

export function judgeResidue(stale: string, data: string): ResidueVerdict {
  if (data === stale) return { kind: 'echo' }
  if (data.length > stale.length && data.startsWith(stale)) return { kind: 'prefixed', rest: data.slice(stale.length) }
  return { kind: 'fresh' }
}

/**
 * 값 안의 잔여 조합 글자 `data` 자리를 `rest`로 바꾼다. 보통은 값 끝이지만, 키보드가 묵은 조합을 확정해 넣고 새 조합이 그 뒤에 붙은 순서(`안녕` + `ㅎ`)면
 * 값 앞쪽이다. 어느 쪽도 아니면 건드리지 않는다(사용자가 친 글자를 지우지 않는다).
 */
function replaceResidue(el: HTMLInputElement, data: string, rest: string): void {
  if (data.length === 0) return
  const v = el.value
  let next: string
  if (v.endsWith(data)) next = v.slice(0, v.length - data.length) + rest
  else if (v.startsWith(data)) next = rest + v.slice(data.length)
  else return
  if (next !== v) el.value = next
}

/** 사용자가 새로 친 것으로 보는 입력 종류(묵은 조합을 끝낸다). 조합 글자 교체(`insertCompositionText` · `deleteCompositionText`)는 판단 대상이다. */
const USER_INPUT_TYPES = new Set([
  'insertText', 'insertFromPaste', 'insertFromDrop', 'insertReplacementText', 'insertLineBreak', 'insertFromYank',
  'deleteContentBackward', 'deleteContentForward', 'deleteWordBackward', 'deleteWordForward', 'deleteByCut', 'deleteByDrag',
])

interface ComposerState {
  /** 조합 중인가(`compositionstart` ~ `compositionend`). */
  composing: boolean
  /** 지금 조합 중인 글자(마지막 `compositionupdate` / `insertCompositionText`의 data). */
  tail: string | null
  /** 보낼 때 조합 중이던 글자. 이 조합에 속한 이벤트가 잔여다. 없으면 null. */
  stale: string | null
  /** 직전 `beforeinput` - `input`이 inputType · data를 주지 않는 웹뷰를 위해 기억한다. */
  before: { inputType: string; data: string | null } | null
}

export function useChatComposer(onSend: (text: string) => void) {
  const elRef = useRef<HTMLInputElement | null>(null)
  const state = useRef<ComposerState>({ composing: false, tail: null, stale: null, before: null })
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend
  const [hasText, setHasText] = useState(false)
  const detach = useRef<(() => void) | null>(null)

  const syncHasText = useCallback(() => {
    const el = elRef.current
    setHasText(el !== null && canSendBody(el.value))
  }, [])

  const clear = useCallback(() => {
    const el = elRef.current
    if (el && el.value !== '') el.value = ''
    setHasText(false)
  }, [])

  const send = useCallback((): boolean => {
    const el = elRef.current
    if (!el) return false
    const s = state.current
    const raw = el.value // 입력 칸의 현재 값(조합 중인 글자 포함)
    // 묵은 조합의 잔여 글자만 들어 있으면 사용자가 친 것이 아니다 - 비우고 보내지 않는다.
    if (s.stale !== null && raw === s.stale) {
      clear()
      return false
    }
    if (!canSendBody(raw)) return false
    const text = raw.trim()
    const hadFocus = document.activeElement === el
    const wasComposing = s.composing
    clear()
    // 조합 중에 보냈을 때만 그 조합 글자를 묵은 조합으로 적는다. 조합 중이 아니었으면 아무것도 걸어 두지 않는다.
    s.stale = wasComposing && s.tail ? s.tail : null
    onSendRef.current(text)
    // 안전망: 어떤 이유로든 포커스가 빠졌으면 돌려놓는다.
    if (hadFocus && document.activeElement !== el) el.focus({ preventScroll: true })
    return true
  }, [clear])

  /** 입력 칸이 붙을 때 이벤트를 단다(콜백 ref). 칸이 나중에 그려져도(불러오는 중 뒤) 붙는다. */
  const setInput = useCallback((el: HTMLInputElement | null) => {
    detach.current?.()
    detach.current = null
    elRef.current = el
    if (!el) return
    const s = state.current

    const onCompositionStart = () => { s.composing = true }
    const onCompositionUpdate = (e: Event) => {
      const data = (e as CompositionEvent).data
      if (typeof data === 'string') s.tail = data
    }
    const onCompositionEnd = (e: Event) => {
      s.composing = false
      const data = (e as CompositionEvent).data ?? ''
      if (s.stale !== null) {
        // 묵은 조합이 끝나며 확정한 글자를 지운다. 그 뒤로는 새 조합이다.
        const verdict = data ? judgeResidue(s.stale, data) : (el.value === s.stale ? ({ kind: 'echo' } as const) : ({ kind: 'fresh' } as const))
        if (verdict.kind === 'echo') replaceResidue(el, data || el.value, '')
        else if (verdict.kind === 'prefixed') replaceResidue(el, data, verdict.rest)
        s.stale = null
      }
      s.tail = null
      syncHasText()
    }
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent
      s.before = { inputType: ie.inputType ?? '', data: ie.data ?? null }
      if (s.stale !== null && USER_INPUT_TYPES.has(s.before.inputType)) s.stale = null // 사용자가 새로 쳤다
    }
    const onInput = (e: Event) => {
      const ie = e as InputEvent
      const inputType = ie.inputType || s.before?.inputType || ''
      const data = ie.data ?? s.before?.data ?? null
      s.before = null
      if (inputType === 'insertCompositionText') {
        const d = data ?? el.value
        if (s.stale !== null) {
          const verdict = judgeResidue(s.stale, d)
          if (verdict.kind === 'echo') replaceResidue(el, d, '') // 보낸 뒤 키보드가 다시 넣은 조합 글자
          else if (verdict.kind === 'prefixed') replaceResidue(el, d, verdict.rest) // 새 글자만 남긴다
          else s.stale = null // 관계없는 조합 글자 = 사용자가 새로 침
        }
        if (data !== null) s.tail = data
      } else if (s.stale !== null && inputType !== 'deleteCompositionText') {
        s.stale = null // 조합이 아닌 입력 = 사용자가 새로 침
      }
      syncHasText()
    }
    el.addEventListener('compositionstart', onCompositionStart)
    el.addEventListener('compositionupdate', onCompositionUpdate)
    el.addEventListener('compositionend', onCompositionEnd)
    el.addEventListener('beforeinput', onBeforeInput)
    el.addEventListener('input', onInput)
    detach.current = () => {
      el.removeEventListener('compositionstart', onCompositionStart)
      el.removeEventListener('compositionupdate', onCompositionUpdate)
      el.removeEventListener('compositionend', onCompositionEnd)
      el.removeEventListener('beforeinput', onBeforeInput)
      el.removeEventListener('input', onInput)
    }
  }, [syncHasText])

  useEffect(() => () => detach.current?.(), [])

  const inputProps = {
    ref: setInput,
    enterKeyHint: 'send' as const,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      e.preventDefault()
      send() // 조합 중(`isComposing`)이어도 한 번만 보낸다 - 보낸 뒤 값이 비어 두 번째 엔터는 무시된다
    },
  }

  /** 포커스를 빼앗지 않는 버튼에 펼쳐 쓴다. */
  const keepFocusProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => e.preventDefault(),
    onMouseDown: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  }
  const sendButtonProps = { ...keepFocusProps, onClick: () => { send() } }

  return { inputRef: elRef, hasText, inputProps, sendButtonProps, keepFocusProps, send }
}
