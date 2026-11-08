/**
 * 웹뷰 티 없애기(73-1b). 입력 칸 밖에서는 길게 누르기 메뉴(contextmenu) · 끌기 · 두 손가락 확대를 막는다.
 * 입력 칸(input · textarea · contenteditable) 안은 그대로 둔다 - 선택 · 붙여넣기 · 한글 조합에 손대지 않는다.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null
  return !!el?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
}

export function installWebFeel(doc: Document): () => void {
  const onContext = (e: Event) => { if (!isEditableTarget(e.target)) e.preventDefault() }
  const onDrag = (e: Event) => { if (!isEditableTarget(e.target)) e.preventDefault() }
  const onGesture = (e: Event) => e.preventDefault()
  doc.addEventListener('contextmenu', onContext)
  doc.addEventListener('dragstart', onDrag)
  doc.addEventListener('gesturestart', onGesture)
  return () => {
    doc.removeEventListener('contextmenu', onContext)
    doc.removeEventListener('dragstart', onDrag)
    doc.removeEventListener('gesturestart', onGesture)
  }
}
