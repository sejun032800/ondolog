/**
 * 필름 그레인 - 256px 타일 반복, 표시 크기 128pt(256px 타일 @2x, R20-3). 터치는 통과한다.
 *
 * 옛 화면과 공존하는 동안은 새 화면의 공통 화면 틀(`ScreenFrame`)에만 올린다. 루트에는 올리지 않는다 -
 * 마지막 옛 화면이 사라지면 루트 1회로 옮긴다.
 *
 * RN의 `repeat`은 타일을 이미지의 pt 크기(256pt)로 깐다. 128pt로 보이게 하려고 폭·높이를 2배로 잡은 면을
 * 왼쪽 위 기준 0.5배로 줄인다.
 */
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native'

const GRAIN = require('../../../assets/grain.png')

/** 디자인 원본 .gr opacity */
const GRAIN_OPACITY = 0.65

/** 타일 원본 픽셀 크기. */
export const GRAIN_TILE_PX = 256
/** 화면에 보이는 타일 크기(pt). 캔버스 `background-size: 128px`. */
export const GRAIN_TILE_PT = 128

/** 반복 면의 크기와 축소 비율. 화면을 덮는 데 필요한 값만 계산한다(순수). */
export function grainLayout(width: number, height: number): { scale: number; width: number; height: number } {
  const scale = GRAIN_TILE_PT / GRAIN_TILE_PX
  return { scale, width: width / scale, height: height / scale }
}

export function Grain() {
  const { width, height } = useWindowDimensions()
  const layout = grainLayout(width, height)
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.clip]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="grain"
    >
      <Image
        source={GRAIN}
        resizeMode="repeat"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: layout.width,
          height: layout.height,
          opacity: GRAIN_OPACITY,
          transformOrigin: 'top left',
          transform: [{ scale: layout.scale }],
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
})
