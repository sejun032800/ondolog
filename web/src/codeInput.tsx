/**
 * 초대 코드 입력 칸(B9) - 영문 대문자 키보드로 열리고, 입력값은 대문자로 바꿔 허용 글자만 남긴다.
 * 규칙은 RN 앱(`app/(onboarding)/invite.tsx`)의 `toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)`와 같다.
 * A18 코드 입력은 6칸 모양이라 `features/couple/CodeBoxes.tsx`가 `normalizeCodeInput`을 가져다 쓴다(이 단일 칸 `CodeInput`은 6칸이 필요 없는 곳용).
 */
export const INVITE_CODE_LENGTH = 6

export function normalizeCodeInput(raw: string, length: number = INVITE_CODE_LENGTH): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length)
}

export function CodeInput({ value, onChange, length = INVITE_CODE_LENGTH }: {
  value: string; onChange: (next: string) => void; length?: number
}) {
  return (
    <input
      className="input"
      value={value}
      maxLength={length}
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      inputMode="text"
      enterKeyHint="done"
      aria-label="초대 코드"
      onChange={(e) => onChange(normalizeCodeInput(e.target.value, length))}
    />
  )
}
