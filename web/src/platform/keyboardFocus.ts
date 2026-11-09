/**
 * 입력 칸이 키보드 위로 오게 한다(B9). 창 크기는 Capacitor 내장 SystemBars(insetsHandling: native)가 키보드 높이만큼 줄여 주고,
 * 여기서는 칸에 포커스가 가거나 창 크기가 바뀔 때(키보드가 올라오는 중) 그 칸을 화면 가운데로 스크롤한다.
 * 채팅 입력줄(.composer)은 아래에 고정이라 건드리지 않는다(G4에서 통과한 손맛 유지).
 */
const REVEAL_DELAY_MS = 300

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
}

function skip(el: Element): boolean {
  return !!el.closest('.composer')
}

export function installKeyboardFocus(doc: Document, win: Window = window): () => void {
  let timer: number | undefined
  const reveal = (el: Element) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (doc.activeElement === el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, REVEAL_DELAY_MS)
  }
  const onFocusIn = (e: Event) => {
    const t = e.target instanceof Element ? e.target : null
    if (isTextField(t) && !skip(t)) reveal(t)
  }
  const onResize = () => {
    const a = doc.activeElement
    if (isTextField(a) && !skip(a)) reveal(a)
  }
  doc.addEventListener('focusin', onFocusIn)
  win.addEventListener('resize', onResize)
  return () => {
    window.clearTimeout(timer)
    doc.removeEventListener('focusin', onFocusIn)
    win.removeEventListener('resize', onResize)
  }
}
