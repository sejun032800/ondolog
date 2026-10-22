/**
 * StatusChip, MilestoneChip, VolBadge, LockBadge(글자 배지).
 * 높이 28, 좌우 12, 12pt. 잠금은 자물쇠 그림 없이 글자만(MASTER 9-7-3), 흐림·워터마크 없음.
 * 12pt 글자에는 lilac을 쓰지 않는다.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { PressScale } from './PressScale'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'

export type StatusChipTone = 'ready' | 'gathering' | 'waiting' | 'answered'

export interface StatusChipProps {
  label: string
  tone?: StatusChipTone
  /** tone="waiting"일 때만 누를 수 있다. */
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function StatusChip({ label, tone = 'ready', onPress, style }: StatusChipProps) {
  const body = (
    <View style={[styles.chip, toneStyle[tone].chip, style]}>
      <Text style={[styles.label, toneStyle[tone].label]}>{label}</Text>
    </View>
  )
  if (tone === 'waiting' && onPress) {
    return (
      <PressScale onPress={onPress} accessibilityLabel={label} hitSlop={10}>
        {body}
      </PressScale>
    )
  }
  return body
}

export interface MilestoneChipProps {
  label: string
  style?: StyleProp<ViewStyle>
}

/** 기념일 칩. 마일스톤 7일 전부터. 당일은 별도 연출. */
export function MilestoneChip({ label, style }: MilestoneChipProps) {
  return (
    <View style={[styles.chip, styles.milestone, style]}>
      <Text style={[styles.label, styles.milestoneLabel]}>{label}</Text>
    </View>
  )
}

export interface VolBadgeProps {
  /** 발행된 호 번호. 초안에는 번호가 없으므로 이 컴포넌트를 그리지 않는다. */
  volume: number
  style?: StyleProp<ViewStyle>
}

export function formatVol(volume: number): string {
  return `VOL.${String(Math.max(0, Math.trunc(volume))).padStart(2, '0')}`
}

/** 발행된 호에만. moon 색은 이 배지처럼 발행된 호 표식에만 쓴다. */
export function VolBadge({ volume, style }: VolBadgeProps) {
  return (
    <View style={[styles.chip, styles.vol, style]}>
      <Text style={[styles.label, styles.volLabel]}>{formatVol(volume)}</Text>
    </View>
  )
}

export interface LockBadgeProps {
  label?: string
  style?: StyleProp<ViewStyle>
}

export function LockBadge({ label = '구독', style }: LockBadgeProps) {
  return (
    <View style={[styles.chip, styles.lock, style]}>
      <Text style={[styles.label, styles.lockLabel]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: shape.radius.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fontFamily.medium, fontSize: 12 },
  milestone: { backgroundColor: withAlpha(nocturne.orchid, 0.12) },
  milestoneLabel: { fontFamily: fontFamily.semiBold, color: nocturne.orchid },
  vol: { borderWidth: 1, borderColor: withAlpha(nocturne.moon, 0.4) },
  volLabel: { fontFamily: fontFamily.semiBold, color: nocturne.moon, letterSpacing: 0.48 },
  lock: { borderWidth: 1, borderColor: withAlpha(nocturne.rose, 0.45) },
  lockLabel: { fontFamily: fontFamily.semiBold, color: nocturne.rose },
})

const toneStyle = {
  ready: {
    chip: { backgroundColor: withAlpha(nocturne.text, 0.08) },
    label: { color: nocturne.text },
  },
  gathering: {
    chip: { borderWidth: 1, borderColor: withAlpha(nocturne.text, 0.16) },
    label: { color: nocturne.textSub },
  },
  // 참여 대기(누를 수 있음). 디자인 보드의 연보라 글자색은 토큰에 없어 mist(링크색)로 둔다.
  waiting: {
    chip: { backgroundColor: withAlpha(nocturne.lilac, 0.14) },
    label: { color: nocturne.mist, fontFamily: fontFamily.semiBold },
  },
  answered: {
    chip: { backgroundColor: withAlpha(nocturne.text, 0.08) },
    label: { color: nocturne.text },
  },
} as const
