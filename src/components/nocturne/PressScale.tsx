/**
 * 누름 촉감 - scale .98, 120ms. 모든 누르는 컴포넌트의 바탕.
 */
import type { ReactNode } from 'react'
import { Pressable, type AccessibilityRole, type Insets, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { motion } from '../../theme/nocturne'

export interface PressScaleProps {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  accessibilityRole?: AccessibilityRole
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean }
  hitSlop?: Insets | number
  testID?: string
}

export function PressScale({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
  testID,
}: PressScaleProps) {
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withTiming(motion.press.scale, { duration: motion.press.durationMs })
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: motion.press.durationMs })
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      hitSlop={hitSlop}
      testID={testID}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  )
}
