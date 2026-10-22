/**
 * 배경 별 명멸 - 9-12초 주기, 투명도 .35 <-> .75. 별마다 주기가 다르다.
 * 위치는 고정 표(결정적). OS "동작 줄이기"가 켜져 있으면 멈추고 중간 투명도로 둔다.
 * 후광을 가진 데이트 별(DateStar)과는 다르다 - 이쪽은 점 하나뿐이다.
 */
import { memo, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { motion, nocturne } from '../../theme/nocturne'

interface StarSpec {
  /** 0-1, 화면 폭 기준 */
  x: number
  /** 0-1, 화면 높이 기준 */
  y: number
  size: number
}

export const BACKGROUND_STARS: readonly StarSpec[] = [
  { x: 0.08, y: 0.06, size: 2 },
  { x: 0.22, y: 0.14, size: 1.5 },
  { x: 0.37, y: 0.05, size: 2 },
  { x: 0.55, y: 0.11, size: 1.5 },
  { x: 0.71, y: 0.04, size: 2.5 },
  { x: 0.88, y: 0.13, size: 1.5 },
  { x: 0.14, y: 0.27, size: 1.5 },
  { x: 0.31, y: 0.33, size: 2 },
  { x: 0.48, y: 0.24, size: 1.5 },
  { x: 0.64, y: 0.3, size: 2 },
  { x: 0.82, y: 0.26, size: 1.5 },
  { x: 0.94, y: 0.36, size: 2 },
  { x: 0.06, y: 0.44, size: 2 },
  { x: 0.26, y: 0.5, size: 1.5 },
  { x: 0.43, y: 0.42, size: 2.5 },
  { x: 0.6, y: 0.49, size: 1.5 },
  { x: 0.77, y: 0.45, size: 2 },
  { x: 0.9, y: 0.54, size: 1.5 },
]

/** 별마다 9-12초 사이의 서로 다른 주기(결정적). */
export function twinklePeriodMs(index: number): number {
  const { minMs, maxMs } = motion.starTwinkle
  const steps = 7
  return minMs + ((index * 3) % steps) * ((maxMs - minMs) / (steps - 1))
}

function Star({ spec, index, reduced }: { spec: StarSpec; index: number; reduced: boolean }) {
  const { from, to } = motion.starTwinkle
  const mid = (from + to) / 2
  const opacity = useSharedValue(reduced ? mid : from)

  useEffect(() => {
    if (reduced) {
      cancelAnimation(opacity)
      opacity.value = mid
      return
    }
    // 위상을 어긋나게 시작한다: 반 주기 안에서 별마다 다른 지연.
    const half = twinklePeriodMs(index) / 2
    opacity.value = from
    opacity.value = withDelay(
      (index * 997) % half,
      withRepeat(withTiming(to, { duration: half, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => cancelAnimation(opacity)
  }, [reduced, index, from, to, mid, opacity])

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: `${spec.x * 100}%`,
          top: `${spec.y * 100}%`,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size,
        },
        animated,
      ]}
    />
  )
}

function BackgroundStarsImpl() {
  const reduced = useReducedMotion()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="background-stars">
      {BACKGROUND_STARS.map((spec, i) => (
        <Star key={i} spec={spec} index={i} reduced={reduced} />
      ))}
    </View>
  )
}

export const BackgroundStars = memo(BackgroundStarsImpl)

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: nocturne.text,
  },
})
