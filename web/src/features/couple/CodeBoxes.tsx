/**
 * 6칸 코드 입력(A18) - 투명한 입력 칸 하나가 칸 전체를 덮어 글자를 받고, 칸이 그것을 보여 준다.
 * 입력 규칙은 `codeInput.tsx`의 `normalizeCodeInput`(영문 대문자 + 숫자, 6자리) · 영문 대문자 키보드 · 자동 대문자(B9).
 * 입력 칸은 창이 키보드 높이만큼 줄어들 때 `platform/keyboardFocus`가 화면 안으로 스크롤한다(칸을 가리지 않는다).
 */
import { useEffect, useRef, useState } from 'react'
import { INVITE_CODE_LENGTH, normalizeCodeInput } from '../../codeInput'

export function CodeBoxes({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  useEffect(() => { inputRef.current?.focus() }, [])
  const active = Math.min(value.length, INVITE_CODE_LENGTH - 1)
  return (
    <div className="codeBoxes" style={{ marginTop: 32 }} data-testid="invite-boxes">
      {Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => (
        <div key={i} className={`codeBoxCell ${focused && i === active ? 'on' : ''}`}>{value[i] ?? ''}</div>
      ))}
      <input
        ref={inputRef}
        className="codeBoxesInput"
        type="text"
        name="invite-code"
        lang="en"
        value={value}
        maxLength={INVITE_CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="done"
        aria-label="초대 코드"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(normalizeCodeInput(e.target.value))}
      />
    </div>
  )
}
