/**
 * PrimaryButton · GhostButton. 한 화면에 주 버튼은 하나. 아우라 그라디언트 버튼은 없다.
 * 높이 54, 모서리 18.
 *
 * 비활성 글자색: 디자인 보드는 가장 옅은 선·비활성 색으로 그렸으나 그 색은 글자 금지 규칙이라
 * textMute로 둔다. 면(반투명)으로 비활성임이 드러나고, 이유는 버튼 위에 글로 적는다.
 */
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { PressScale } from './PressScale'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'

export interface ButtonProps {
  label: string
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function PrimaryButton({ label, onPress, disabled, style, testID }: ButtonProps) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.base, disabled ? styles.disabledFill : styles.primaryFill, style]}
    >
      <Text style={[styles.label, styles.primaryLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </PressScale>
  )
}

export function GhostButton({ label, onPress, disabled, style, testID }: ButtonProps) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.base, disabled ? styles.disabledFill : styles.ghostFill, style]}
    >
      <Text style={[styles.label, styles.ghostLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  base: {
    height: shape.buttonHeight,
    borderRadius: shape.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryFill: { backgroundColor: nocturne.text },
  ghostFill: {
    backgroundColor: withAlpha(nocturne.text, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.14),
  },
  disabledFill: { backgroundColor: withAlpha(nocturne.text, 0.06) },
  label: { fontSize: 15.5 },
  primaryLabel: { color: nocturne.ink, fontFamily: fontFamily.semiBold },
  ghostLabel: { color: nocturne.text, fontFamily: fontFamily.medium },
  disabledLabel: { color: nocturne.textMute, fontFamily: fontFamily.medium },
})
