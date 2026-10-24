/**
 * ScreenFrame - 새 화면의 공통 화면 틀. 바탕(ink) 위에 자식을 그리고 그레인을 맨 위에 얹는다(R20-3).
 * 그레인은 루트가 아니라 이 틀에만 있다(옛 화면과 공존하는 동안). 터치는 그레인을 통과한다.
 */
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { nocturne } from '../../theme/nocturne'
import { Grain } from './Grain'

export interface ScreenFrameProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function ScreenFrame({ children, style }: ScreenFrameProps) {
  return (
    <View style={[styles.frame, style]} testID="screen-frame">
      {children}
      <Grain />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: nocturne.ink },
})
