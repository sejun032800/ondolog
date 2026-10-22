/**
 * Skeleton - 스피너 대신 뼈대. 펄스 .06 <-> .12, 1.6초.
 * 막대는 text 색에 투명도 펄스를 준다.
 */
import { useEffect } from 'react'
import { StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { motion, nocturne, shape } from '../../theme/nocturne'

export interface SkeletonProps {
  width?: DimensionValue
  height?: number
  style?: StyleProp<ViewStyle>
}

export function Skeleton({ width = '100%', height = 10, style }: SkeletonProps) {
  const { from, to, durationMs } = motion.skeletonPulse
  const opacity = useSharedValue<number>(from)

  useEffect(() => {
    opacity.value = from
    opacity.value = withRepeat(
      withTiming(to, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(opacity)
  }, [from, to, durationMs, opacity])

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.bar, { width, height }, animated, style]}
    />
  )
}

const styles = StyleSheet.create({
  bar: { borderRadius: shape.radius.pill, backgroundColor: nocturne.text },
})
