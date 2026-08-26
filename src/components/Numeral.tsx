/**
 * 숫자 표기 — docs/ONDOLOG_DESIGN.md §2-3, §11-7.
 *
 * `74.2`처럼 정수부는 크게, 소수부는 45% 크기로 이어 붙인다. 온도(`38.2°`)는
 * `°`도 소수부와 같은 크기로 붙인다(suffix). 중첩 `<Text>`가 베이스라인을
 * 자동으로 맞춰준다 — 별도 정렬 불필요.
 *
 * §16: `numeral-xl`만 `allowFontScaling={false}`.
 * 색은 이 컴포넌트가 정하지 않는다 — 호출부가 `ink('metric')` 등을 `style`로
 * 넘긴다(잉크 위계는 내용의 성격을 아는 호출부의 책임).
 */
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useTheme } from '../theme'

interface NumeralProps {
  value: number
  variant?: 'numeralXl' | 'numeral'
  /** `°` 등 소수부와 같은 크기로 이어 붙일 단위 기호. */
  suffix?: string
  style?: StyleProp<TextStyle>
}

export function Numeral({ value, variant = 'numeralXl', suffix = '', style }: NumeralProps) {
  const { typography } = useTheme()
  const base = typography[variant]
  const [int, dec] = value.toFixed(1).split('.')

  return (
    <Text allowFontScaling={variant === 'numeralXl' ? false : undefined} style={[base, style]}>
      {int}
      <Text style={{ fontSize: base.fontSize * 0.45 }}>
        .{dec}
        {suffix}
      </Text>
    </Text>
  )
}
