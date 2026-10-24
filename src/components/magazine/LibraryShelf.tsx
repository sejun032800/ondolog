/**
 * D01 서재 - 발행된 호의 표지 그리드(디자인 `N-T-Tabs` D01).
 *
 * 표지는 `cover_path`의 1쪽 이미지 그대로다. **표지 그림 위에는 아무것도 얹지 않는다** - 호 번호는
 * 표지 밖(아래) 라벨 "VOL.NN" + "N월호"이고, 번호는 발행된 호에만 있다(R13-11 #3, R21-3).
 * `moon`은 이 Vol 라벨에만 쓴다. 호 수 표시는 "N권".
 */
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { PublishedIssue } from '../../services/magazineApi'
import { issueMonthLabel } from '../../utils/magazine'
import { fontFamily, glow, nocturne, type, withAlpha } from '../../theme/nocturne'
import { formatVol } from '../nocturne/Chips'
import { PressScale } from '../nocturne/PressScale'

/** 표지 비율(MASTER 9-5): 1 : 1.414 */
export const COVER_ASPECT = 1 / 1.414
const GAP = 16
const SIDE = 24

export interface LibraryShelfProps {
  issues: readonly PublishedIssue[]
  /** 표지 경로 -> 서명 URL. 없는 호는 빈 종이 면으로 둔다. */
  coverUrls: Record<string, string>
  onOpen: (issue: PublishedIssue) => void
}

/** 표지 밖 라벨의 두 줄. 번호는 발행된 호의 `issue_number`다. */
export function shelfLabels(issue: Pick<PublishedIssue, 'issueNumber' | 'issueType' | 'periodStart' | 'title'>): {
  vol: string
  month: string
} {
  return {
    vol: formatVol(issue.issueNumber),
    month: issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title }),
  }
}

export function LibraryShelf({ issues, coverUrls, onOpen }: LibraryShelfProps) {
  const { width } = useWindowDimensions()
  const cell = Math.floor((width - SIDE * 2 - GAP) / 2)
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.kicker}>LIBRARY</Text>
        <Text style={styles.count} testID="library-count">{`${issues.length}권`}</Text>
      </View>
      <View style={styles.grid}>
        {issues.map((issue) => {
          const labels = shelfLabels(issue)
          const uri = issue.coverPath ? coverUrls[issue.coverPath] : undefined
          return (
            <PressScale
              key={issue.id}
              onPress={() => onOpen(issue)}
              accessibilityLabel={`${labels.vol} \u00B7 ${labels.month}`}
              testID={`shelf-issue-${issue.id}`}
              style={{ width: cell }}
            >
              <View style={[styles.cover, { width: cell, height: Math.round(cell / COVER_ASPECT) }]} testID="shelf-cover">
                {uri ? <Image source={{ uri }} style={styles.coverImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
              </View>
              <View style={styles.labels}>
                <Text style={styles.vol}>{labels.vol}</Text>
                {labels.month ? <Text style={styles.month}>{labels.month}</Text> : null}
              </View>
            </PressScale>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  count: { ...type.caption, fontFamily: fontFamily.regular, color: nocturne.textMute },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 22 },
  cover: {
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: nocturne.paper,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.06),
    ...glow.lift,
  },
  coverImage: { width: '100%', height: '100%' },
  labels: { gap: 2, marginTop: 10 },
  vol: { fontFamily: fontFamily.semiBold, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.7, color: nocturne.moon },
  month: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, color: nocturne.text },
})
