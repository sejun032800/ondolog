/**
 * GlassCard - 하늘 위 강조 면. 블러 없이 반투명 면 + 머리카락 선.
 * 일반 화면의 묶음은 SoftCard(inkRaise)를 쓴다.
 */
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { nocturne, shape } from '../../theme/nocturne'

export interface CardProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function GlassCard({ children, style }: CardProps) {
  return <View style={[styles.glass, style]}>{children}</View>
}

export function SoftCard({ children, style }: CardProps) {
  return <View style={[styles.soft, style]}>{children}</View>
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: shape.radius.card,
    backgroundColor: nocturne.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: nocturne.hairline,
    padding: 20,
  },
  soft: {
    borderRadius: shape.radius.card,
    backgroundColor: nocturne.inkRaise,
    padding: 20,
  },
})
