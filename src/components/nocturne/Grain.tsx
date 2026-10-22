/**
 * 필름 그레인 - 256px 타일 반복, 루트에 1회. 터치는 통과한다.
 * 화면마다 두지 않는다. 앱 루트 하나에서만 마운트한다.
 */
import { Image, StyleSheet, View } from 'react-native'

const GRAIN = require('../../../assets/grain.png')

/** 디자인 원본 .gr opacity */
const GRAIN_OPACITY = 0.65

export function Grain() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="grain"
    >
      <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: GRAIN_OPACITY }]} />
    </View>
  )
}
