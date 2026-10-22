/**
 * PhotoScrim - 사진 위 글자를 위한 하단 장막(높이 140, 투명 -> ink .82).
 * `experimental_backgroundImage` 그라디언트를 먼저 쓴다. 실기기에서 안 되면 장막 PNG(1x140)로
 * 바꾼다(R18-7, 실기기 확인은 `51-`). 사진 위 글자는 이 장막 위에서만 올린다.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { nocturne, shape, withAlpha } from '../../theme/nocturne'

export const PHOTO_SCRIM_GRADIENT = `linear-gradient(180deg, ${withAlpha(nocturne.ink, 0)} 0%, ${withAlpha(
  nocturne.ink,
  0.82,
)} 100%)`

export function PhotoScrim({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View pointerEvents="none" style={[styles.scrim, style]} testID="photo-scrim" />
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: shape.photoScrimHeight,
    experimental_backgroundImage: PHOTO_SCRIM_GRADIENT,
  },
})
