/**
 * D01 다음 호 카드(NEXT ISSUE) - 디자인 `N-T-Tabs` D01.
 *
 * 진행률은 기간 경과율이고(R18-6) **정지 값으로 그린다**: 채움·카운트업 애니메이션이 없다.
 * "제작 현황 →" 링크는 숨긴다(D02는 U5). 재료 수는 못 셌으면 그리지 않는다.
 * 초안에는 번호가 없으므로 Vol 표시도 없다. `moon`도 쓰지 않는다(발행된 호만).
 */
import { StyleSheet, Text, View } from 'react-native'
import { NEXT_ISSUE_COPY } from '../../constants/magazineCopy'
import type { NextIssueData } from '../../hooks/useLibrary'
import { fontFamily, glow, ink, nocturne, type, withAlpha } from '../../theme/nocturne'

const CARD_WIDTH = 168
const CARD_HEIGHT = 226

export interface NextIssueCardProps {
  data: NextIssueData
}

/** "대화 412 · 사진 18" / "데이트 3" - 두 줄. 못 셌으면 null. */
export function materialLines(counts: NextIssueData['counts']): [string, string] | null {
  if (!counts) return null
  return [`대화 ${counts.messages} \u00B7 사진 ${counts.photos}`, `데이트 ${counts.dates}`]
}

export function NextIssueCard({ data }: NextIssueCardProps) {
  const lines = materialLines(data.counts)
  const monthNumber = /^(\d+)/.exec(data.monthLabel)?.[1] ?? ''
  const lineTop = ((100 - data.percent) / 100) * CARD_HEIGHT
  return (
    <View testID="next-issue-card" accessibilityLabel={`${data.monthLabel} ${NEXT_ISSUE_COPY.status} ${data.percent}%`}>
      <View style={styles.stage}>
        {monthNumber ? (
          <Text style={styles.bigMonth} accessibilityElementsHidden importantForAccessibility="no" numberOfLines={1}>
            {monthNumber}
          </Text>
        ) : null}
        <View style={styles.silhouette}>
          <View style={[styles.below, { top: lineTop }]} />
          <View style={[styles.line, { top: lineTop }]} />
          <Text style={styles.writing}>{NEXT_ISSUE_COPY.writing}</Text>
        </View>
        <View style={styles.titles}>
          <Text style={styles.kicker}>{NEXT_ISSUE_COPY.kicker}</Text>
          <Text style={styles.month}>{data.monthLabel}</Text>
          <Text style={styles.status}>{NEXT_ISSUE_COPY.status}</Text>
        </View>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.percent} testID="next-issue-percent">{`${data.percent}%`}</Text>
        {lines ? (
          <View style={styles.counts} testID="next-issue-counts">
            <Text style={styles.countLine}>{lines[0]}</Text>
            <Text style={styles.countLine}>{lines[1]}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: { height: CARD_HEIGHT + 24, justifyContent: 'flex-end' },
  bigMonth: {
    position: 'absolute',
    left: -16,
    top: -20,
    fontFamily: fontFamily.regular,
    fontSize: 260,
    lineHeight: 250,
    letterSpacing: -20,
    color: withAlpha(nocturne.text, 0.06),
  },
  silhouette: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: nocturne.inkRaise,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.1),
    ...glow.lift,
  },
  below: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: withAlpha(nocturne.orchid, 0.18) },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(nocturne.rose, 0.7),
    boxShadow: `0 0 10px ${withAlpha(nocturne.rose, 0.8)}`,
  },
  writing: { position: 'absolute', left: 12, top: 12, ...type.caption, fontSize: 12, color: nocturne.textMute },
  titles: { gap: 4, paddingBottom: 6, maxWidth: '55%' },
  kicker: { ...type.kicker, color: nocturne.textMute },
  month: { fontFamily: fontFamily.semiBold, fontSize: 24, lineHeight: 30, color: nocturne.text, marginTop: 4 },
  status: { ...type.sub, color: nocturne.textMute },
  metricRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 6 },
  percent: {
    ...ink('metric'),
    fontFamily: fontFamily.regular,
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -2.8,
  },
  counts: { gap: 2, paddingBottom: 6 },
  countLine: { ...type.caption, fontFamily: fontFamily.regular, color: nocturne.textMute },
})
