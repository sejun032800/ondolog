/** [연결 해제] 같은 되돌리기 어려운 길의 버튼 - 보드(H04): 짙은 면 + 장미색 선 · 글자. 주 버튼이 아니다. */
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { PressScale } from '../nocturne/PressScale'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'

export interface DangerButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function DangerButton({ label, onPress, disabled, style, testID }: DangerButtonProps) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.base, disabled && styles.disabled, style]}
    >
      <Text style={[styles.label, disabled && styles.disabledLabel]}>{label}</Text>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  base: {
    height: shape.buttonHeight,
    borderRadius: shape.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(nocturne.text, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(nocturne.rose, 0.35),
  },
  disabled: { borderColor: withAlpha(nocturne.text, 0.14) },
  label: { fontSize: 15.5, fontFamily: fontFamily.medium, color: nocturne.rose },
  disabledLabel: { color: nocturne.textFaint },
})
