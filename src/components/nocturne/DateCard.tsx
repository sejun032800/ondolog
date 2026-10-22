/**
 * DateCard - 데이트 카드. 사진 + 하단 장막 140. 글자는 장막 위에만.
 * 큰 카드(기본 230) / 2열 작은 카드(compact).
 */
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native'
import { PhotoScrim } from './PhotoScrim'
import { PressScale } from './PressScale'
import { nocturne, shape, type } from '../../theme/nocturne'

export interface DateCardProps {
  photo?: ImageSourcePropType
  /** "2026.10.03 · 연남동" */
  dateLabel: string
  title: string
  /** "사진 11 · 메모 2" */
  meta?: string
  compact?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function DateCard({ photo, dateLabel, title, meta, compact, onPress, style }: DateCardProps) {
  const height = compact ? 180 : 230
  const card = (
    <View style={[styles.card, { height }, style]}>
      {photo ? <Image source={photo} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      <PhotoScrim />
      <View style={styles.text}>
        <Text style={styles.date}>{dateLabel}</Text>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
          {title}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </View>
  )
  if (!onPress) return card
  return (
    <PressScale onPress={onPress} accessibilityLabel={`${dateLabel} ${title}`}>
      {card}
    </PressScale>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: shape.radius.photo + 4,
    overflow: 'hidden',
    backgroundColor: nocturne.inkRaise,
    justifyContent: 'flex-end',
  },
  text: { padding: 16, paddingHorizontal: 18, gap: 4 },
  date: { ...type.caption, color: nocturne.textSub },
  title: { ...type.title, fontSize: 19, lineHeight: 26, color: nocturne.text },
  titleCompact: { fontSize: 15, lineHeight: 21 },
  meta: { ...type.caption, fontSize: 12.5, color: nocturne.textSub },
})
