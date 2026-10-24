/**
 * 쪽 이미지 한 장 - 핀치 줌(두 손가락)과 두 번 탭 확대/복귀(D11, R13-6).
 *
 * `react-native-gesture-handler` + Reanimated만 쓴다(새 의존성 없음). 확대 중에만 한 손가락 이동을 받고,
 * 확대 여부는 `onZoomChange`로 알려 바깥 가로 넘김을 잠그게 한다. 계산(`clampScale` 등)은 `utils/magazine.ts`의
 * 순수 함수이고 워크릿 지시어가 있다. 이미지가 안 열리면 `onError`로 알린다(서명 URL 만료 처리는 바깥이 한다).
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { nocturne, withAlpha } from '../../theme/nocturne'
import { clampScale, clampTranslate, isZoomed, nextDoubleTapScale } from '../../utils/magazine'

export interface ZoomablePageProps {
  width: number
  height: number
  /** 서명 URL. 아직 못 받았으면 빈 면을 그린다. */
  uri: string | undefined
  label: string
  onZoomChange?: (zoomed: boolean) => void
  onError?: () => void
}

const RESET_MS = 180

export function ZoomablePage({ width, height, uri, label, onZoomChange, onError }: ZoomablePageProps) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)
  const [zoomed, setZoomed] = useState(false)

  const zoomCallback = useRef(onZoomChange)
  zoomCallback.current = onZoomChange
  const report = useCallback((next: boolean) => {
    setZoomed(next)
    zoomCallback.current?.(next)
  }, [])

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart(() => {
        savedScale.value = scale.value
      })
      .onUpdate((e) => {
        scale.value = clampScale(savedScale.value * e.scale)
      })
      .onEnd(() => {
        if (isZoomed(scale.value)) {
          tx.value = clampTranslate(tx.value, scale.value, width)
          ty.value = clampTranslate(ty.value, scale.value, height)
          runOnJS(report)(true)
        } else {
          scale.value = withTiming(1, { duration: RESET_MS })
          tx.value = withTiming(0, { duration: RESET_MS })
          ty.value = withTiming(0, { duration: RESET_MS })
          runOnJS(report)(false)
        }
      })

    const pan = Gesture.Pan()
      .enabled(zoomed)
      .minPointers(1)
      .maxPointers(1)
      .onStart(() => {
        savedTx.value = tx.value
        savedTy.value = ty.value
      })
      .onUpdate((e) => {
        tx.value = clampTranslate(savedTx.value + e.translationX, scale.value, width)
        ty.value = clampTranslate(savedTy.value + e.translationY, scale.value, height)
      })

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((_e, success) => {
        if (!success) return
        const next = nextDoubleTapScale(scale.value)
        scale.value = withTiming(next, { duration: RESET_MS })
        if (next === 1) {
          tx.value = withTiming(0, { duration: RESET_MS })
          ty.value = withTiming(0, { duration: RESET_MS })
        }
        runOnJS(report)(next > 1)
      })

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))
    // 흔드는 값은 공유 값뿐이다 - 확대 여부와 크기가 바뀔 때만 제스처를 다시 만든다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed, width, height])

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }))

  return (
    <View style={{ width, height }} testID="zoomable-page">
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.fill, animated]}>
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.fill}
              resizeMode="contain"
              onError={onError}
              accessibilityLabel={label}
              accessibilityIgnoresInvertColors
              testID="page-image"
            />
          ) : (
            <View style={styles.blank} testID="page-blank" accessibilityLabel={label} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  blank: { width: '100%', height: '100%', backgroundColor: withAlpha(nocturne.paper, 0.06) },
})
