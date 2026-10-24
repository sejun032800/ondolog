/**
 * 피드의 한 달 - 머리 + 대표 카드(그 달 가장 최근 데이트) + 원문 한 줄 + 2열 작은 카드.
 * 원문 한 줄은 그 데이트의 메모 첫 줄(MaruBuri + textSub). 메모가 없으면 줄을 그리지 않는다.
 */
import { StyleSheet, Text, View } from 'react-native'
import type { FeedChapter } from '../../hooks/useFeed'
import { buildCardTexts } from '../../utils/dateRecord'
import { DateCard } from '../nocturne/DateCard'
import { fontFamily, nocturne, type } from '../../theme/nocturne'
import { MonthChapterHeader } from './MonthChapterHeader'

export interface FeedChapterViewProps {
  chapter: FeedChapter
  /** 사진 경로 -> 서명 URL */
  urls: Record<string, string>
  /** 작성자 id -> 표시 이름 */
  names: Record<string, string>
  onOpenDate: (dateId: string) => void
}

export function FeedChapterView({ chapter, urls, names, onOpenDate }: FeedChapterViewProps) {
  const [lead, ...rest] = chapter.dates
  const photoOf = (path: string | null) => (path && urls[path] ? { uri: urls[path] } : undefined)
  const leadTexts = buildCardTexts(lead, false)
  const quoteAuthor = lead.quote ? names[lead.quote.authorId] : undefined

  return (
    <View style={styles.chapter}>
      <MonthChapterHeader
        month={chapter.month}
        memoTotal={chapter.memoTotal}
        photoTotal={chapter.photoTotal}
        dateTotal={chapter.dates.length}
      />
      <DateCard
        photo={photoOf(lead.coverPath)}
        dateLabel={leadTexts.dateLabel}
        title={leadTexts.title}
        meta={`사진 ${lead.photoCount} · 메모 ${lead.memoCount}`}
        onPress={() => onOpenDate(lead.id)}
      />
      {lead.quote ? (
        <View style={styles.quoteRow}>
          <Text style={styles.quote} testID="feed-quote">{`“${lead.quote.text}”`}</Text>
          {quoteAuthor ? <Text style={styles.author}>{quoteAuthor}</Text> : null}
        </View>
      ) : null}
      {rest.length > 0 ? (
        <View style={styles.grid}>
          {rest.map((d) => {
            const texts = buildCardTexts(d, true)
            return (
              <View key={d.id} style={styles.cell}>
                <DateCard
                  compact
                  photo={photoOf(d.coverPath)}
                  dateLabel={texts.dateLabel}
                  title={texts.title}
                  onPress={() => onOpenDate(d.id)}
                />
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chapter: { gap: 16 },
  quoteRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 4 },
  // 두 사람의 원문: MaruBuri + textSub. 디자인 값은 15/23.
  quote: { fontFamily: fontFamily.serif, fontSize: 15, lineHeight: 23, color: nocturne.textSub, flexShrink: 1 },
  author: { ...type.caption, color: nocturne.textMute },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47%', flexGrow: 1 },
})
