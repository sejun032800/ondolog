/**
 * 키보드 시험(74-h2 ③) - **시험 빌드 전용**. 설정 탭 맨 아래(앱 정보 아래)의 줄에서 연다. 운영 빌드에서는 줄 · 이 화면이 번들에서 빠진다(`IS_TRIAL_BUILD`).
 * 초대 코드 칸이 영문 자판으로 열리게 하는 입력 칸 속성 조합을 폰에서 가리려는 시험이다(`lang="en"`은 삼성 키보드와 Gboard가 따르지 않았다 - h1 폰 확인).
 * 칸 네 개 - 각각 다른 조합. 모두 자동 대문자 · 자동 고침 · 맞춤법 · 자동 완성을 끈다. 어느 칸이 영문으로 열리는지 번호로 알려 주면 된다.
 *   1. inputMode="email"   2. type="url"   3. type="email"   4. inputMode="url"
 * 아무것도 저장 · 전송하지 않는다.
 */
import { useState } from 'react'
import type { Nav } from '../../navigation'
import { SettingsFrame } from './parts'

export const KEYBOARD_TEST_COPY = {
  title: '키보드 시험',
  hint: '영문으로 바꿔 입력해 주세요',
  guide: '칸을 눌러 영문 자판으로 열리는지 봐 주세요. 번호를 알려 주세요.',
} as const

const FIELDS = [
  { n: 1, label: '1 · inputMode="email"', props: { type: 'text', inputMode: 'email' } },
  { n: 2, label: '2 · type="url"', props: { type: 'url' } },
  { n: 3, label: '3 · type="email"', props: { type: 'email' } },
  { n: 4, label: '4 · inputMode="url"', props: { type: 'text', inputMode: 'url' } },
] as const

export function KeyboardTestScreen({ nav }: { nav: Nav }) {
  const [values, setValues] = useState<Record<number, string>>({})
  return (
    <SettingsFrame title={KEYBOARD_TEST_COPY.title} onBack={nav.back} testId="keyboard-test">
      <p className="t-sub c-sub" style={{ lineHeight: '22px' }}>{KEYBOARD_TEST_COPY.guide}</p>
      {FIELDS.map((f) => (
        <div className="kbTest" key={f.n}>
          <label htmlFor={`kb-${f.n}`}>{f.label}</label>
          <input
            id={`kb-${f.n}`}
            data-testid={`kb-field-${f.n}`}
            className="input"
            {...f.props}
            value={values[f.n] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.n]: e.target.value }))}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        </div>
      ))}
      <p className="t-caption c-mute" style={{ marginTop: 12 }}>{KEYBOARD_TEST_COPY.hint}</p>
    </SettingsFrame>
  )
}
