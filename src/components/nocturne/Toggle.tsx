/**
 * Toggle - 켬 = lilac 트랙. 46 x 28. 행 전체를 누르는 영역으로 쓰려면 ListRow의 control로 넣는다.
 */
import { Pressable, StyleSheet, View } from 'react-native'
import { nocturne, shape, withAlpha } from '../../theme/nocturne'

export interface ToggleProps {
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  accessibilityLabel?: string
  testID?: string
}

export function Toggle({ value, onValueChange, disabled, accessibilityLabel, testID }: ToggleProps) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      style={[styles.track, value ? styles.trackOn : styles.trackOff, disabled && styles.disabled]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: { width: 46, height: 28, borderRadius: shape.radius.pill, justifyContent: 'center' },
  trackOn: { backgroundColor: nocturne.lilac },
  trackOff: { backgroundColor: withAlpha(nocturne.text, 0.14) },
  knob: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: shape.radius.pill },
  knobOn: { right: 3, backgroundColor: nocturne.ink },
  knobOff: { left: 3, backgroundColor: nocturne.textMute },
  disabled: { opacity: 0.5 },
})
