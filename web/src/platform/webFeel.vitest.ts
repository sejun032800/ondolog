import { afterEach, describe, expect, it } from 'vitest'
import { installWebFeel } from './webFeel'

let off: (() => void) | undefined
afterEach(() => { off?.(); off = undefined; document.body.innerHTML = '' })

function fire(el: Element, type: string): boolean {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  el.dispatchEvent(ev)
  return ev.defaultPrevented
}

describe('웹뷰 티 없애기', () => {
  it('입력 칸 밖에서는 contextmenu가 막힌다', () => {
    off = installWebFeel(document)
    document.body.innerHTML = '<p id="t">글</p><img id="i" /><a id="a" href="#x">링크</a>'
    expect(fire(document.getElementById('t')!, 'contextmenu')).toBe(true)
    expect(fire(document.getElementById('i')!, 'contextmenu')).toBe(true)
    expect(fire(document.getElementById('a')!, 'contextmenu')).toBe(true)
  })

  it('입력 칸 안에서는 막히지 않는다', () => {
    off = installWebFeel(document)
    document.body.innerHTML = '<input id="a" /><textarea id="b"></textarea><div contenteditable="true"><span id="c">x</span></div>'
    expect(fire(document.getElementById('a')!, 'contextmenu')).toBe(false)
    expect(fire(document.getElementById('b')!, 'contextmenu')).toBe(false)
    expect(fire(document.getElementById('c')!, 'contextmenu')).toBe(false)
  })

  it('이미지 끌기는 막고 입력 칸 끌기는 둔다', () => {
    off = installWebFeel(document)
    document.body.innerHTML = '<img id="i" /><input id="a" />'
    expect(fire(document.getElementById('i')!, 'dragstart')).toBe(true)
    expect(fire(document.getElementById('a')!, 'dragstart')).toBe(false)
  })

  it('해제하면 더는 막지 않는다', () => {
    const undo = installWebFeel(document)
    undo()
    document.body.innerHTML = '<p id="t">글</p>'
    expect(fire(document.getElementById('t')!, 'contextmenu')).toBe(false)
  })
})
