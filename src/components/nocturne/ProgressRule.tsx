/**
 * ProgressRule - 2pt 진행 선. 정지 상태 그대로 그린다(채움 애니메이션 금지).
 * 제작 = rose, 스캔 = lilac.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { nocturne, withAlpha } from '../../theme/nocturne'

export interface ProgressRuleProps {
  /** 0-1 */
  progress: number
  tone?: 'rose' | 'lilac'
  style?: StyleProp<ViewStyle>
}

export function clampProgress(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.min(1, Math.max(0, p))
}

export function ProgressRule({ progress, tone = 'rose', style }: ProgressRuleProps) {
  const ratio = clampProgress(progress)
  return (
    <View
      style={[styles.track, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <View
        style={[
          styles.fill,
          { width: `${ratio * 100}%`, backgroundColor: tone === 'rose' ? nocturne.rose : nocturne.lilac },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    borderRadius: 2,
    backgroundColor: withAlpha(nocturne.text, 0.1),
  },
  fill: { height: 2, borderRadius: 2 },
})
