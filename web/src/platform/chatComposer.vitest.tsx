/**
 * 채팅 입력창 시험(74-5, R73-2 · §5-②) - 한글 조합을 **입력 이벤트 방식**으로 다룬다(300ms 시간 방식 삭제).
 * 키보드 앱이 어떤 순서로 이벤트를 주는지 흉내 낸다. 두 가지 모양을 모두 본다.
 *   삼성 키보드형: 보낸 뒤 키보드가 **같은 조합 글자를 다시 넣고**(`insertCompositionText`), 사용자가 새로 치면 그 조합을 끝내고(`compositionend`) 새 조합을 연다.
 *   Gboard형: 보낸 뒤 키보드가 조합을 끝내며(`compositionend`) 확정한 글자를 값에 넣고, 새로 치면 새 조합이 시작된다.
 * 옛 `chatFeel.vitest.tsx`(74-1에서 사라짐)의 손맛 시험(포커스 유지 · 연속 보내기)은 실제 채팅 화면 기준으로 `chat.vitest.tsx`에 있다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { judgeResidue, useChatComposer } from './useChatComposer'

function Harness({ onSend }: { onSend: (t: string) => void }) {
  const { hasText, inputProps, sendButtonProps } = useChatComposer(onSend)
  return (
    <div>
      <input data-testid="in" {...inputProps} />
      <button data-testid="send" aria-disabled={!hasText} {...sendButtonProps} />
    </div>
  )
}

afterEach(cleanup)

function setup() {
  const sent: string[] = []
  render(<Harness onSend={(t) => sent.push(t)} />)
  const el = screen.getByTestId('in') as HTMLInputElement
  el.focus()
  return { el, sent }
}

// ---- 키보드 흉내 ---------------------------------------------------------
const ev = (el: HTMLElement, e: Event) => { fireEvent(el, e) }
const compStart = (el: HTMLElement) => ev(el, new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
const compEnd = (el: HTMLElement, data: string) => ev(el, new CompositionEvent('compositionend', { bubbles: true, data }))
/** 조합 글자 하나가 들어오는 순서: beforeinput -> (값 바뀜) -> compositionupdate -> input. */
function compose(el: HTMLInputElement, value: string, data: string) {
  ev(el, new InputEvent('beforeinput', { bubbles: true, inputType: 'insertCompositionText', data }))
  el.value = value
  ev(el, new CompositionEvent('compositionupdate', { bubbles: true, data }))
  ev(el, new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data }))
}
/** 조합이 아닌 입력(영문 · 붙여넣기 · 지우기). */
function plain(el: HTMLInputElement, value: string, inputType: string, data: string | null = null) {
  ev(el, new InputEvent('beforeinput', { bubbles: true, inputType, data }))
  el.value = value
  ev(el, new InputEvent('input', { bubbles: true, inputType, data }))
}
/** 한 낱말을 조합 중으로 친다(값 전체가 조합 글자 - 한 글자씩 늘어난다). 마지막 글자는 아직 조합 중. */
function typeWord(el: HTMLInputElement, steps: string[]) {
  compStart(el)
  for (const s of steps) compose(el, s, s)
}
const tap = () => fireEvent.click(screen.getByTestId('send'))
const enter = (el: HTMLElement, composing: boolean) => fireEvent.keyDown(el, { key: 'Enter', isComposing: composing })

const ANNYEONG = ['ㅇ', '아', '안', '안ㄴ', '안녀', '안녕']

describe('judgeResidue - 묵은 조합 글자를 잔여로 알아보는 판단(순수)', () => {
  it('같은 글자 = 잔여 · 뒤에 새 글자가 붙음 = 새 글자만 · 관계없음 = 새로 침', () => {
    expect(judgeResidue('안녕', '안녕')).toEqual({ kind: 'echo' })
    expect(judgeResidue('안녕', '안녕ㅎ')).toEqual({ kind: 'prefixed', rest: 'ㅎ' })
    expect(judgeResidue('안녕', 'ㅎ')).toEqual({ kind: 'fresh' })
    expect(judgeResidue('안녕', '안')).toEqual({ kind: 'fresh' })
  })
})

describe('"ㅋㅋ"를 치고 바로 보내면 "ㅋㅋ"가 간다', () => {
  it('두 번째 ㅋ가 아직 조합 중일 때 바로 보내도 둘 다 간다 · 입력 칸은 빈다', () => {
    const { el, sent } = setup()
    compStart(el)
    compose(el, 'ㅋ', 'ㅋ')
    compEnd(el, 'ㅋ') // 첫 ㅋ 확정
    compStart(el)
    compose(el, 'ㅋㅋ', 'ㅋ') // 둘째 ㅋ는 조합 중 - 값에는 이미 들어 있다
    tap()
    expect(sent).toEqual(['ㅋㅋ'])
    expect(el.value).toBe('')
  })

  it('삼성형: 보낸 뒤 키보드가 조합 글자 ㅋ를 다시 넣어도 지워진다(빈 말풍선 · 잔여 0)', () => {
    const { el, sent } = setup()
    compStart(el)
    compose(el, 'ㅋ', 'ㅋ')
    compEnd(el, 'ㅋ')
    compStart(el)
    compose(el, 'ㅋㅋ', 'ㅋ')
    tap()
    compose(el, 'ㅋ', 'ㅋ') // 잔여 다시 넣기
    expect(el.value).toBe('')
    enter(el, false) // 잔여만 있는 칸에서 엔터 - 보내지 않는다
    expect(sent).toEqual(['ㅋㅋ'])
  })
})

describe('"안녕"을 보내고 곧바로(0ms) "ㅎ"를 치면 "ㅎ"가 입력 칸에 남는다', () => {
  it('삼성형 A: 잔여 "안녕"이 다시 들어온 뒤 조합이 끝나고 새 조합 ㅎ', () => {
    const { el, sent } = setup()
    typeWord(el, ANNYEONG)
    tap()
    expect(sent).toEqual(['안녕'])
    expect(el.value).toBe('')
    compose(el, '안녕', '안녕') // 키보드가 조합 글자를 다시 넣음 -> 지운다
    expect(el.value).toBe('')
    compEnd(el, '안녕') // ㅎ를 치려고 묵은 조합을 끝냄
    compStart(el)
    compose(el, 'ㅎ', 'ㅎ')
    expect(el.value).toBe('ㅎ')
    expect(sent).toEqual(['안녕']) // 새로 친 글자는 보내지 않았다
  })

  it('삼성형 B: 묵은 조합이 이어져 "안녕ㅎ"으로 들어오면 앞의 "안녕"만 지우고 "ㅎ"를 남긴다', () => {
    const { el } = setup()
    typeWord(el, ANNYEONG)
    tap()
    compose(el, '안녕', '안녕')
    compose(el, '안녕ㅎ', '안녕ㅎ')
    expect(el.value).toBe('ㅎ')
  })

  it('Gboard형: 보내자 조합이 끝나며 "안녕"을 값에 확정해 넣고, 곧바로 새 조합 ㅎ - "안녕"은 지우고 ㅎ만 남는다', () => {
    const { el, sent } = setup()
    typeWord(el, ANNYEONG)
    tap()
    el.value = '안녕' // 키보드가 확정 글자를 넣음
    compEnd(el, '안녕')
    expect(el.value).toBe('')
    compStart(el)
    compose(el, 'ㅎ', 'ㅎ')
    expect(el.value).toBe('ㅎ')
    expect(sent).toEqual(['안녕'])
  })

  it('Gboard형(순서 뒤바뀜): 새 조합 ㅎ가 먼저 값에 붙고 그 뒤에 묵은 조합이 끝나도 "안녕"만 지운다', () => {
    const { el } = setup()
    typeWord(el, ANNYEONG)
    tap()
    el.value = '안녕ㅎ' // 확정 글자가 앞에, 새 조합이 뒤에
    compEnd(el, '안녕')
    expect(el.value).toBe('ㅎ')
  })
})

describe('조합 중 엔터는 한 번만 보내고 빈 말풍선 0', () => {
  it('조합 중 엔터 -> 한 번 · 키보드가 조합을 확정하며 다시 넣은 글자는 지워짐 · 두 번째 엔터는 무시', () => {
    const { el, sent } = setup()
    typeWord(el, ANNYEONG)
    enter(el, true)
    expect(sent).toEqual(['안녕'])
    expect(el.value).toBe('')
    el.value = '안녕'
    compEnd(el, '안녕')
    expect(el.value).toBe('')
    enter(el, false) // 두 번째 엔터
    enter(el, true)
    expect(sent).toEqual(['안녕'])
    expect(sent.every((t) => t.length > 0)).toBe(true)
  })

  it('잔여 글자만 남은 상태의 엔터도 보내지 않는다', () => {
    const { el, sent } = setup()
    typeWord(el, ANNYEONG)
    enter(el, true)
    el.value = '안녕' // 잔여가 값에 다시 들어왔지만 이벤트로 알려 주지 않은 키보드
    enter(el, false)
    expect(sent).toEqual(['안녕'])
    expect(el.value).toBe('')
  })

  it('공백만 있는 입력은 보내지 않는다', () => {
    const { el, sent } = setup()
    plain(el, '   ', 'insertText', ' ')
    tap()
    enter(el, false)
    expect(sent).toEqual([])
    expect(screen.getByTestId('send').getAttribute('aria-disabled')).toBe('true')
  })
})

describe('연속 세 번 보내도 순서와 글자가 맞다', () => {
  it('삼성형: 매번 잔여가 다시 들어와도 세 글이 차례로 간다', () => {
    const { el, sent } = setup()
    const words: Array<[string, string[]]> = [
      ['하나', ['ㅎ', '하', '핫', '하나']],
      ['둘', ['ㄷ', '두', '둘']],
      ['셋', ['ㅅ', '세', '섿', '셋']],
    ]
    for (const [word, steps] of words) {
      typeWord(el, steps)
      tap()
      compose(el, word, word) // 잔여
      expect(el.value).toBe('')
    }
    expect(sent).toEqual(['하나', '둘', '셋'])
  })

  it('Gboard형: 매번 조합이 끝나며 확정 글자를 넣어도 세 글이 차례로 간다', () => {
    const { el, sent } = setup()
    for (const [word, steps] of [['하나', ['ㅎ', '하', '핫', '하나']], ['둘', ['ㄷ', '두', '둘']], ['셋', ['ㅅ', '세', '섿', '셋']]] as Array<[string, string[]]>) {
      typeWord(el, steps)
      tap()
      el.value = word
      compEnd(el, word)
      expect(el.value).toBe('')
    }
    expect(sent).toEqual(['하나', '둘', '셋'])
  })

  it('엔터와 버튼을 섞어도 순서가 같다', () => {
    const { el, sent } = setup()
    typeWord(el, ['ㅎ', '하']); enter(el, true)
    typeWord(el, ['ㄴ', '나']); tap()
    typeWord(el, ['ㅁ', '마']); enter(el, true)
    expect(sent).toEqual(['하', '나', '마'])
  })
})

describe('사용자가 새로 친 것은 잔여로 오해하지 않는다', () => {
  it('조합이 이미 끝난 뒤 보냈으면 걸어 두지 않는다 - 같은 글자를 바로 다시 쳐도 남는다', () => {
    const { el, sent } = setup()
    compStart(el)
    compose(el, 'ㅎ', 'ㅎ')
    compEnd(el, 'ㅎ') // 확정
    tap()
    expect(sent).toEqual(['ㅎ'])
    compStart(el)
    compose(el, 'ㅎ', 'ㅎ') // 사용자가 또 침(같은 글자)
    expect(el.value).toBe('ㅎ')
  })

  it('보낸 뒤 조합이 아닌 입력(영문 · 붙여넣기)이 오면 묵은 조합을 버린다 - 같은 글자가 나중에 와도 남는다', () => {
    const { el } = setup()
    typeWord(el, ANNYEONG)
    tap()
    plain(el, 'a', 'insertText', 'a')
    plain(el, '', 'deleteContentBackward')
    compose(el, '안녕', '안녕') // 이제는 사용자가 친 것
    expect(el.value).toBe('안녕')
  })

  it('조합 중이던 글자와 관계없는 조합 글자는 처음부터 받는다', () => {
    const { el } = setup()
    typeWord(el, ANNYEONG)
    tap()
    compose(el, '사', 'ㅅ') // 묵은 조합과 관계없음
    expect(el.value).toBe('사')
  })
})

describe('보내기 버튼은 입력 칸의 포커스를 가져가지 않는다', () => {
  it('누름 시작(pointerdown · mousedown)의 기본 동작을 막고, 세 번 보내도 포커스가 입력 칸에 있다', () => {
    const { el, sent } = setup()
    const send = screen.getByTestId('send')
    for (const t of ['a', 'b', 'c']) {
      plain(el, t, 'insertText', t)
      const down = new Event('pointerdown', { bubbles: true, cancelable: true })
      fireEvent(send, down)
      expect(down.defaultPrevented).toBe(true)
      const mouse = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      fireEvent(send, mouse)
      expect(mouse.defaultPrevented).toBe(true)
      tap()
      expect(document.activeElement).toBe(el)
    }
    expect(sent).toEqual(['a', 'b', 'c'])
  })

  it('보내는 동안 어떤 이유로든 포커스가 빠졌으면 보낸 뒤 입력 칸으로 돌려놓는다(안전망)', () => {
    const sent: string[] = []
    render(<Harness onSend={(t) => { sent.push(t); (document.activeElement as HTMLElement).blur() }} />)
    const el = screen.getByTestId('in') as HTMLInputElement
    el.focus()
    plain(el, 'x', 'insertText', 'x')
    tap()
    expect(sent).toEqual(['x'])
    expect(document.activeElement).toBe(el)
  })
})
