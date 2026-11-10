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
    <>
    <div className="codeBoxes" style={{ marginTop: 32 }} data-testid="invite-boxes">
      {Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => (
        <div key={i} className={`codeBoxCell ${focused && i === active ? 'on' : ''}`}>{value[i] ?? ''}</div>
      ))}
      <input
        ref={inputRef}
        className="codeBoxesInput"
        type="text"
        name="invite-code"
        value={value}
        maxLength={INVITE_CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        lang="en"
        // 영문 자판으로 열릴 가능성이 가장 높은 조합(74-h2 ③, 결정 기록): 안드로이드가 입력 종류를 이메일 형으로 알려 삼성 키보드 · Gboard가 영문 자판(@ . 키 포함)으로 연다.
        // `type="email"`은 글자 수 제한 · 선택 영역 조작이 막혀 `inputMode`로만 준다. 폰 확인(키보드 시험)에서 더 나은 조합이 나오면 그것으로 확정한다(R78-3).
        inputMode="email"
        enterKeyHint="done"
        aria-label="초대 코드"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(normalizeCodeInput(e.target.value))}
      />
    </div>
    {/* 영문 자판 안내(74-h2 ③) - 오류 문구(칸 아래)와 겹치지 않게 칸 바로 아래 한 줄. 폰 확인에서 영문으로 열리는 조합이 확정되면 이 줄을 뺀다. */}
    <p className="t-caption c-mute" style={{ marginTop: 10 }} data-testid="invite-code-hint">영문으로 바꿔 입력해 주세요</p>
    </>
  )
}
