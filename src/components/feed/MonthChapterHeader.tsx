/**
 * 월 챕터 머리 - 큰 달 숫자 · 영문 달 · "기록 N · 사진 N · 데이트 N".
 * MVP 조정표: 디자인의 "✦ 별 N"은 쓰지 않고 "데이트 N"으로 쓴다(하늘이 돌아오면 별).
 * 기록 N = 그 달 데이트에 남긴 메모 수, 사진 N = 사진 수, 데이트 N = 데이트 수(내부 결정, HANDOFF).
 */
import { StyleSheet, Text, View } from 'react-native'
import { englishMonth } from '../../utils/dateRecord'
import { fontFamily, nocturne, type, withAlpha } from '../../theme/nocturne'

export interface MonthChapterHeaderProps {
  month: number
  memoTotal: number
  photoTotal: number
  dateTotal: number
}

export function monthCountsLabel({ memoTotal, photoTotal, dateTotal }: Omit<MonthChapterHeaderProps, 'month'>): string {
  return `기록 ${memoTotal} · 사진 ${photoTotal} · 데이트 ${dateTotal}`
}

export function MonthChapterHeader(props: MonthChapterHeaderProps) {
  const { month } = props
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.numeral} accessibilityLabel={`${month}월`}>
          {String(month).padStart(2, '0')}
        </Text>
        <View style={styles.side}>
          <Text style={styles.kicker}>{englishMonth(month)}</Text>
          <Text style={styles.counts}>{monthCountsLabel(props)}</Text>
        </View>
      </View>
      <View style={styles.rule} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  // 디자인 원본: 112pt, 자간 -0.07em, 줄 높이 104.
  numeral: {
    fontFamily: fontFamily.regular,
    fontSize: 112,
    lineHeight: 104,
    letterSpacing: -7.84,
    color: nocturne.text,
  },
  side: { paddingTop: 20, gap: 6, flexShrink: 1 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  counts: { ...type.sub, color: nocturne.textMute },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(nocturne.text, 0.14) },
})
