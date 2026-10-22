/**
 * 화면 진입 "떠오름" - 8px 위로 + 페이드, 260ms, ease-out.
 * OS "동작 줄이기"가 켜져 있으면 멈추고 곧바로 최종 상태로 그린다.
 */
import { useEffect, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { motion } from '../../theme/nocturne'

export interface RiseInProps {
  children: ReactNode
  delayMs?: number
  style?: StyleProp<ViewStyle>
}

export function RiseIn({ children, delayMs = 0, style }: RiseInProps) {
  const reduced = useReducedMotion()
  const progress = useSharedValue(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) {
      progress.value = 1
      return
    }
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: motion.rise.durationMs, easing: Easing.out(Easing.cubic) }),
    )
  }, [reduced, delayMs, progress])

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * motion.rise.distance }],
  }))

  return <Animated.View style={[animated, style]}>{children}</Animated.View>
}
