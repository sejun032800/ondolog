/**
 * GlowNumeral - 온도록이 계산한 값(metric) 전용 숫자.
 * 정수/소수를 42% 크기로 나눠 그린다. 카운트업 없음 - 받은 값을 그대로 보인다.
 * 발광은 textShadow(그라디언트 글자 아님). 미연결(connected=false)은 textSub, 발광 없음(R36-1).
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { NUMERAL_DECIMAL_RATIO, glow, nocturne, type } from '../../theme/nocturne'

export interface GlowNumeralProps {
  /** 표시할 값. 소수 한 자리로 그린다(36.5 -> "36" + ".5°"). */
  value: number
  /** 정수부 크기. 기본 hero(92). */
  size?: number
  /** false면 미연결 표시: textSub, 발광 없음. 값은 호출자가 고정값을 넘긴다. */
  connected?: boolean
  /** 소수부 뒤에 붙는 기호. 기본 도(°). */
  unit?: string
  style?: StyleProp<ViewStyle>
}

export function splitNumeral(value: number): { integer: string; decimal: string } {
  const fixed = value.toFixed(1)
  const [integer, decimal] = fixed.split('.')
  return { integer, decimal }
}

export function GlowNumeral({
  value,
  size = type.hero.fontSize,
  connected = true,
  unit = '\u00B0',
  style,
}: GlowNumeralProps) {
  const { integer, decimal } = splitNumeral(value)
  const scale = size / type.hero.fontSize
  const decimalSize = Math.round(size * NUMERAL_DECIMAL_RATIO)
  const color = connected ? nocturne.rose : nocturne.textSub
  const shadow = connected ? glow.numeral : null

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={`${integer}.${decimal}${unit === '\u00B0' ? '도' : unit}`}
    >
      <Text
        style={[
          {
            fontFamily: type.hero.fontFamily,
            fontSize: size,
            lineHeight: Math.round(type.hero.lineHeight * scale),
            letterSpacing: type.hero.letterSpacing * scale,
            color,
          },
          shadow,
        ]}
        importantForAccessibility="no"
      >
        {integer}
      </Text>
      <Text
        style={[
          {
            fontFamily: type.hero.fontFamily,
            fontSize: decimalSize,
            lineHeight: Math.round(decimalSize * 1.1),
            letterSpacing: -0.03 * decimalSize,
            marginTop: Math.round(4 * scale),
            color,
          },
          shadow,
        ]}
        importantForAccessibility="no"
      >
        {`.${decimal}${unit}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
})
